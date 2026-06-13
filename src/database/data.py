import os
from datetime import datetime, timezone

import pandas as pd
import requests
import requests_cache

from database import helper

OPENWEATHER_API_KEY = os.environ["OPENWEATHER_API_KEY"]
BASE_URL = "https://api.openweathermap.org/data/2.5"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# In production (SPEECH_DIR=/data/speech), put cache in /data/ so it survives restarts.
# In dev, cache sits next to this file.
_speech_dir = os.environ.get("SPEECH_DIR", "")
CACHE_PATH = (
    os.path.join(os.path.dirname(_speech_dir), "weather_cache")
    if _speech_dir
    else os.path.join(BASE_DIR, ".cache")
)

_session = requests_cache.CachedSession(CACHE_PATH, expire_after=3600)


def call_openweather_api(lat: float, lon: float) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Fetch current + 5-day forecast from OpenWeather API.
    Returns three DataFrames with the same column contract as the rest of the pipeline:
      current_df  — single row: temperature, feels like, humidity, current_precipitation, overcast
      hourly_df   — next 24 h (8 × 3 h slots): time, temperature, feels like, humidity,
                    precipitation probability, overcast
      daily_df    — up to 5 days aggregated: date, maxtemp, mintemp, maxwindgusts,
                    maxwindspeed, precipitation, overcast
    """
    current_json = _fetch_current(lat, lon)
    forecast_json = _fetch_forecast(lat, lon)
    return _build_dataframes(current_json, forecast_json)


# ── private helpers ────────────────────────────────────────────────────────────

def _fetch_current(lat: float, lon: float) -> dict:
    params = {"lat": lat, "lon": lon, "appid": OPENWEATHER_API_KEY, "units": "metric"}
    resp = _session.get(f"{BASE_URL}/weather", params=params)
    resp.raise_for_status()
    return resp.json()


def _fetch_forecast(lat: float, lon: float) -> dict:
    params = {"lat": lat, "lon": lon, "appid": OPENWEATHER_API_KEY, "units": "metric"}
    resp = _session.get(f"{BASE_URL}/forecast", params=params)
    resp.raise_for_status()
    return resp.json()


def _build_dataframes(
    current_json: dict, forecast_json: dict
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:

    # ── Current ──────────────────────────────────────────────────────────────
    main = current_json["main"]
    clouds_now = current_json.get("clouds", {}).get("all", 0)
    rain_now = current_json.get("rain", {}).get("1h", 0)
    snow_now = current_json.get("snow", {}).get("1h", 0)

    current_df = pd.DataFrame(
        {
            "temperature":           [round(main["temp"])],
            "feels like":            [round(main["feels_like"])],
            "humidity":              [round(main["humidity"])],
            "current_precipitation": [helper.precipitation(rain_now + snow_now, rain_now, snow_now)],
            "overcast":              [helper.meancloudcover(clouds_now)],
        },
        index=["current"],
    )

    # ── Hourly (next 24 h = first 8 entries, each covers 3 h) ────────────────
    hourly_rows = []
    for item in forecast_json["list"][:8]:
        dt = datetime.fromtimestamp(item["dt"], tz=timezone.utc)
        clouds_h = item["clouds"]["all"]
        hourly_rows.append(
            {
                "time":                     str(dt.hour),
                "temperature":              round(item["main"]["temp"]),
                "feels like":               round(item["main"]["feels_like"]),
                "humidity":                 round(item["main"]["humidity"]),
                "precipitation probability": round(item.get("pop", 0) * 100),
                "overcast":                 helper.meancloudcover(clouds_h),
            }
        )
    hourly_df = pd.DataFrame(hourly_rows)

    # ── Daily (aggregate 5-day forecast by calendar date) ────────────────────
    daily_buckets: dict[str, dict] = {}
    for item in forecast_json["list"]:
        date_str = datetime.fromtimestamp(item["dt"], tz=timezone.utc).strftime("%Y-%m-%d")
        bucket = daily_buckets.setdefault(
            date_str,
            {"temps": [], "wind_speed": [], "wind_gust": [], "clouds": [], "rain": 0.0, "snow": 0.0},
        )
        bucket["temps"].append(item["main"]["temp"])
        bucket["wind_speed"].append(item["wind"]["speed"] * 3.6)       # m/s → km/h
        bucket["wind_gust"].append(item["wind"].get("gust", item["wind"]["speed"]) * 3.6)
        bucket["clouds"].append(item["clouds"]["all"])
        bucket["rain"] += item.get("rain", {}).get("3h", 0)
        bucket["snow"] += item.get("snow", {}).get("3h", 0)

    daily_rows = []
    for date_str, b in daily_buckets.items():
        mean_cloud = sum(b["clouds"]) / len(b["clouds"])
        rain_val, snow_val = b["rain"], b["snow"]
        daily_rows.append(
            {
                "date":         date_str,
                "maxtemp":      round(max(b["temps"])),
                "mintemp":      round(min(b["temps"])),
                "maxwindgusts": round(max(b["wind_gust"])),
                "maxwindspeed": round(max(b["wind_speed"])),
                "overcast":     helper.meancloudcover(mean_cloud),
                "precipitation": helper.precipitation(rain_val + snow_val, rain_val, snow_val),
            }
        )
    daily_df = pd.DataFrame(daily_rows)

    return current_df, hourly_df, daily_df
