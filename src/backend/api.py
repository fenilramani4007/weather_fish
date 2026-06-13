import time
import warnings
from datetime import datetime, timezone, timedelta

from backend import geocoder
from database import data as weather_data
from database import io
from database import mongo
from ai import text_generation, tts, context_engine

PRESENTERS = ["Merkel", "Haftbefehl", "Fisch"]
REPORT_TTL_MINUTES = 20  # skip Gemini if report is newer than this


def get_all_weather_data(
    cities: list,
    zipcodes: list = None,
    person: str = "",
    hobbies: list = None,
    language: str = "de",
):
    """
    Full pipeline orchestrator:
    geocode → fetch weather → save to MongoDB + write files
           → generate AI text → save to MongoDB + write txt
           → generate gTTS audio → write MP3
    """
    if not hobbies:
        hobbies = ["gaming", "tennis", "fahrrad fahren"]

    # ── Geocoding ────────────────────────────────────────────────────────────
    if zipcodes is not None:
        coordinate_set = [geocoder.get_coordinates_from_zipcode(z) for z in zipcodes]
    else:
        coordinate_set = [geocoder.get_coordinates_from_city(c) for c in cities]

    if zipcodes is not None and len(cities) != len(zipcodes):
        warnings.warn("Length of cities and zipcodes lists do not match")
        return

    # ── Weather fetch + persist ───────────────────────────────────────────────
    primary_context: dict | None = None  # context from the first valid location

    for i, (lat, lon) in enumerate(coordinate_set):
        if (lat, lon) == (None, None):
            warnings.warn(f"Invalid coordinates for entry {i}")
            continue

        postcode = zipcodes[i] if zipcodes else cities[i]
        city_name = cities[i] if i < len(cities) else postcode

        df_current, df_hourly, df_daily = weather_data.call_openweather_api(lat, lon)

        # Write flat JSON files (used by DailyForecast / WeeklyForecast fallback)
        io.current_weather(df_current, postcode)
        io.forecast_weather_hourly(df_hourly, postcode)
        io.forecast_weather_daily(df_daily, postcode)
        io.write_structured_json(postcode)

        # Save structured snapshot to MongoDB
        structured = _build_structured(df_current, df_hourly, df_daily)
        try:
            mongo.upsert_weather(
                zipcode=postcode,
                city=city_name,
                lat=lat,
                lon=lon,
                current=structured["current"],
                hourly=structured["hourly"],
                daily_weekone=structured["daily_weekone"],
                daily_weektwo=structured["daily_weektwo"],
            )
            mongo.upsert_location(postcode, city_name, lat, lon)
            print(f"[MongoDB] Weather saved for {postcode} ({city_name})")
        except Exception as exc:
            print(f"[MongoDB] WARNING: could not save weather — {exc}")

        # Append to history log (always inserts, keeps trend data)
        try:
            mongo.append_history(
                zipcode=postcode,
                city=city_name,
                current=structured["current"],
                daily_weekone=structured["daily_weekone"],
            )
            print(f"[MongoDB] History appended for {postcode}")
        except Exception as exc:
            print(f"[MongoDB] WARNING: could not append history — {exc}")

        # Compute context from the first valid location only
        if primary_context is None:
            try:
                primary_context = context_engine.analyze(
                    current=structured["current"],
                    hourly=structured["hourly"],
                    daily_weekone=structured["daily_weekone"],
                )
                print(
                    f"[Context] severity={primary_context['severity']} "
                    f"time={primary_context['time_of_day']} "
                    f"highlights={len(primary_context['highlights'])}"
                )
            except Exception as exc:
                print(f"[Context] WARNING: context engine failed — {exc}")

    # ── AI text + audio ───────────────────────────────────────────────────────
    for i, presenter in enumerate(PRESENTERS):
        # Check cache: skip Gemini if a fresh report already exists for the same ZIPs
        cached = _get_cached_report(presenter, zipcodes or cities)
        if cached:
            text = cached
            print(f"[Cache] Using cached report for {presenter} (< {REPORT_TTL_MINUTES} min old)")
        else:
            text = text_generation.prompt(
                cities=cities,
                person=presenter,
                hobbies=hobbies,
                language=language,
                zipcodes=zipcodes,
                context=primary_context,
            )

            # Save report to MongoDB
            try:
                mongo.upsert_report(
                    presenter=presenter,
                    text=text,
                    zipcodes=zipcodes or [],
                    cities=cities,
                    language=language,
                )
                print(f"[MongoDB] Report saved for {presenter}")
            except Exception as exc:
                print(f"[MongoDB] WARNING: could not save report — {exc}")

        # Always write .txt + re-generate MP3 (audio should match latest text)
        io.write_prompt_to_txt(text, presenter)
        tts.generate_mp3(language_code=language, text=text, person=presenter)

        if i < len(PRESENTERS) - 1 and not cached:
            print("Waiting 5 seconds before next Gemini request…")
            time.sleep(5)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_cached_report(presenter: str, keys: list) -> str | None:
    """
    Return the cached report text if it exists in MongoDB, is < REPORT_TTL_MINUTES old,
    and covers the same set of ZIP codes / cities. Otherwise return None.
    """
    try:
        doc = mongo.get_report(presenter)
        if not doc:
            return None
        generated_at = doc.get("generated_at")
        if generated_at is None:
            return None
        if generated_at.tzinfo is None:
            generated_at = generated_at.replace(tzinfo=timezone.utc)
        age = datetime.now(timezone.utc) - generated_at
        if age > timedelta(minutes=REPORT_TTL_MINUTES):
            return None
        # Check same set of locations
        cached_keys = sorted(doc.get("zipcodes") or doc.get("cities") or [])
        if sorted(keys) != cached_keys:
            return None
        return doc.get("text")
    except Exception:
        return None


def _build_structured(df_current, df_hourly, df_daily) -> dict:
    """Convert DataFrames to the nested dict used by the API and the frontend."""
    current = df_current.to_dict("index")["current"]
    hourly  = df_hourly.set_index("time").to_dict("index")

    # daily_weekone = first 7 rows, daily_weektwo = rest
    weekone = df_daily.iloc[:7].set_index("date").to_dict("index")
    weektwo = df_daily.iloc[7:].set_index("date").to_dict("index")

    return {
        "current":       current,
        "hourly":        hourly,
        "daily_weekone": weekone,
        "daily_weektwo": weektwo,
    }
