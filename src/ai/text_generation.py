"""
AI Text Generation — WEATHER-FISH
===================================
Generates personalized, context-aware weather reports using Gemini.
Falls back to a template report when all models are quota-exhausted.

Pipeline position:
  Context Engine → [Prompt Engineering + Gemini] → TTS
"""

import os
import time
import random

from google import genai
from google.genai.errors import ClientError
from database import io

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

# Model priority — falls back automatically on quota exhaustion
MODELS = [
    "gemini-1.5-flash",       # 1 500 req/day free (highest free quota)
    "gemini-1.5-flash-8b",    # 1 500 req/day, faster/lighter
    "gemini-2.0-flash-lite",  # separate quota bucket
    "gemini-2.0-flash",       # original (200 req/day)
]

MAX_RETRIES = 3
BASE_WAIT   = 15  # seconds for first retry (per-minute 429)


def prompt(
    cities:   list,
    person:   str,
    hobbies:  list,
    language: str,
    zipcodes: list,
    context:  dict | None = None,
) -> str:
    """
    Generate a weather narration report via Gemini, or a template if quota exhausted.

    Parameters
    ----------
    cities, zipcodes : location identifiers (used to load weather JSON)
    person           : presenter style (Fisch | Merkel | Haftbefehl)
    hobbies          : user hobbies for personalisation
    language         : ISO 639 language code
    context          : output of context_engine.analyze() — enables adaptive tone
    """
    data       = io.get_dict_from_json(zipcodes, cities)
    prompt_str = _build_prompt(data, person, hobbies, language, context)

    last_error: Exception | None = None

    for model in MODELS:
        for attempt in range(MAX_RETRIES):
            try:
                print(f"[Gemini] model={model} attempt={attempt + 1} presenter={person}")
                response = client.models.generate_content(model=model, contents=prompt_str)
                print(f"[Gemini] OK — model={model} presenter={person}")
                return response.text

            except ClientError as exc:
                last_error = exc
                code = _extract_code(exc)
                if code == 429:
                    if _is_daily_limit(exc):
                        # Daily quota exhausted — retrying won't help, skip model immediately
                        print(f"[Gemini] Daily quota exhausted for {model} — skipping")
                        break
                    wait = BASE_WAIT * (2 ** attempt) + random.uniform(0, 5)
                    print(f"[Gemini] 429 on {model} (per-minute) — waiting {wait:.1f}s")
                    time.sleep(wait)
                else:
                    print(f"[Gemini] Non-retryable error on {model}: {exc}")
                    break

            except Exception as exc:
                last_error = exc
                print(f"[Gemini] Unexpected error on {model}: {exc}")
                break

        else:
            # All retries exhausted via per-minute 429 — try next model
            print(f"[Gemini] Per-minute retries exhausted for {model} — trying next model")
            continue

    # All models failed — use deterministic template fallback
    print(f"[Gemini] All models failed — using template fallback for {person}")
    return _template_fallback(data, person, language, context)


# ── Prompt builder ────────────────────────────────────────────────────────────

def _build_prompt(
    data:     dict,
    person:   str,
    hobbies:  list,
    language: str,
    context:  dict | None,
) -> str:
    parts: list[str] = []

    parts.append(
        "I have weather data for several cities as JSON. "
        f"Here is the data (format is zipcode_cityname — use the city name): {data}."
    )

    if context:
        parts.append(
            f"Current weather context: "
            f"severity='{context['severity']}', "
            f"time of day='{context['time_of_day']}', "
            f"temperature feels '{context['temperature_feel']}'. "
            f"Adopt a {context['tone']}."
        )
        if context.get("highlights"):
            joined = "; ".join(context["highlights"])
            parts.append(f"Key highlights to naturally weave into the report: {joined}.")

    if hobbies:
        parts.append(
            f"The report is personalised for someone who enjoys: {', '.join(hobbies)}. "
            f"Briefly mention how today's weather affects at least one of these activities."
        )

    parts.append(
        f"The ISO 639 language code is '{language}'. Write the entire report in that language."
    )

    if person:
        parts.append(f"Write in the distinctive style of {person}.")

    parts.append(
        "Output rules: fully written prose only — absolutely no bullet points or headings. "
        "Start the report immediately without acknowledging this prompt. "
        "Exactly 5 sentences total: one engaging introduction, then one sentence per city."
    )

    return " ".join(parts)


# ── Template fallback ─────────────────────────────────────────────────────────

def _template_fallback(
    data:     dict,
    person:   str,
    language: str,
    context:  dict | None,
) -> str:
    """
    Generates a structured weather summary without AI.
    Used when all Gemini models are quota-exhausted.
    """
    _CONDITION_DE = {
        "clear":         "klarer Himmel",
        "partly cloudy": "teils bewölkt",
        "cloudy":        "bewölkt",
        "overcast":      "bedeckt",
    }

    severity_prefix = ""
    if context:
        if context["severity"] == "warning":
            severity_prefix = "⚠️ Wettervorsicht heute! "
        elif context["severity"] == "cheerful":
            severity_prefix = "☀️ Herrliches Wetter! "

    city_lines: list[str] = []
    for key, loc in list(data.items())[:4]:
        city  = key.split("_", 1)[1] if "_" in key else key
        cur   = loc.get("current", {})
        temp  = cur.get("temperature", "?")
        feels = cur.get("feels like", temp)
        sky   = _CONDITION_DE.get(cur.get("overcast", ""), cur.get("overcast", "unbekannt"))
        rain  = ", mit Niederschlag" if cur.get("current_precipitation") == "rain" else ""
        city_lines.append(f"{city}: {temp}°C (gefühlt {feels}°C), {sky}{rain}")

    cities_str = " — ".join(city_lines) if city_lines else "Keine Standortdaten verfügbar"

    template = (
        f"{severity_prefix}Automatischer Wetterbericht ({person}): {cities_str}. "
        f"[KI-Berichte sind derzeit nicht verfügbar — Gemini-Tageskontingent erschöpft. "
        f"Bitte morgen erneut generieren.]"
    )
    return template


# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_daily_limit(exc: ClientError) -> bool:
    """True when the quota violation is a daily (not per-minute) limit."""
    try:
        msg = str(exc)
        return "PerDay" in msg or "limit: 0" in msg
    except Exception:
        return False


def _extract_code(exc: ClientError) -> int | None:
    code = getattr(exc, "code", None)
    if code:
        return code
    try:
        return exc.args[0].get("error", {}).get("code")
    except Exception:
        return None
