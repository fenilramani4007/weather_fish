"""
MongoDB persistence layer for WEATHER-FISH.

Collections
───────────
  weather_snapshots  — structured weather data per zipcode (upserted on each generation)
  ai_reports         — AI-generated text per presenter (upserted on each generation)
  locations          — every zipcode ever added (upserted, never auto-deleted)
"""

import os
from datetime import datetime, timezone

from pymongo import MongoClient, ASCENDING
from pymongo.collection import Collection

MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = "weatherfish"

_client: MongoClient | None = None


# ── Connection ─────────────────────────────────────────────────────────────────

def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    return _client


def get_db():
    return get_client()[DB_NAME]


def ping() -> bool:
    """Return True if MongoDB is reachable."""
    try:
        get_client().admin.command("ping")
        return True
    except Exception:
        return False


def close():
    global _client
    if _client:
        _client.close()
        _client = None


# ── Collection shortcuts ───────────────────────────────────────────────────────

def _weather_col() -> Collection:
    return get_db()["weather_snapshots"]


def _reports_col() -> Collection:
    return get_db()["ai_reports"]


def _locations_col() -> Collection:
    return get_db()["locations"]


# ── Weather snapshots ──────────────────────────────────────────────────────────

def upsert_weather(
    zipcode: str,
    city: str,
    lat: float,
    lon: float,
    current: dict,
    hourly: dict,
    daily_weekone: dict,
    daily_weektwo: dict,
) -> None:
    """Insert or replace the weather snapshot for a given zipcode."""
    _weather_col().update_one(
        {"zipcode": zipcode},
        {
            "$set": {
                "zipcode": zipcode,
                "city": city,
                "lat": lat,
                "lon": lon,
                "fetched_at": datetime.now(timezone.utc),
                "current": current,
                "hourly": hourly,
                "daily_weekone": daily_weekone,
                "daily_weektwo": daily_weektwo,
            }
        },
        upsert=True,
    )


def get_weather(zipcode: str) -> dict | None:
    """Return the latest structured weather snapshot, or None if not found."""
    return _weather_col().find_one({"zipcode": zipcode}, {"_id": 0})


def get_all_weather() -> list[dict]:
    return list(_weather_col().find({}, {"_id": 0}))


# ── AI Reports ─────────────────────────────────────────────────────────────────

def upsert_report(
    presenter: str,
    text: str,
    zipcodes: list[str],
    cities: list[str],
    language: str,
) -> None:
    """Insert or replace the AI text report for a given presenter."""
    _reports_col().update_one(
        {"presenter": presenter},
        {
            "$set": {
                "presenter": presenter,
                "text": text,
                "zipcodes": zipcodes,
                "cities": cities,
                "language": language,
                "generated_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )


def get_report(presenter: str) -> dict | None:
    """Return the latest AI report for a presenter, or None."""
    return _reports_col().find_one({"presenter": presenter}, {"_id": 0})


def get_all_reports() -> list[dict]:
    return list(_reports_col().find({}, {"_id": 0}))


# ── Locations ──────────────────────────────────────────────────────────────────

def upsert_location(zipcode: str, city: str, lat: float, lon: float) -> None:
    now = datetime.now(timezone.utc)
    _locations_col().update_one(
        {"zipcode": zipcode},
        {
            "$set": {
                "zipcode": zipcode,
                "city": city,
                "lat": lat,
                "lon": lon,
                "last_seen": now,
            },
            "$setOnInsert": {"added_at": now},
        },
        upsert=True,
    )


def get_all_locations() -> list[dict]:
    return list(
        _locations_col().find({}, {"_id": 0}).sort("added_at", ASCENDING)
    )


def delete_location(zipcode: str) -> bool:
    result = _locations_col().delete_one({"zipcode": zipcode})
    return result.deleted_count > 0
