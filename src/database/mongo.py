"""
MongoDB persistence layer for WEATHER-FISH.

Collections
───────────
  weather_snapshots  — structured weather data per zipcode (upserted on each generation)
  ai_reports         — AI-generated text per presenter (upserted on each generation)
  locations          — every zipcode ever added (upserted, never auto-deleted)
"""

import os
from datetime import datetime, timezone, timedelta

from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.collection import Collection

MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = "weatherfish"


def _masked_uri(uri: str) -> str:
    """Return the URI with the password replaced by ***."""
    try:
        from urllib.parse import urlparse, urlunparse
        p = urlparse(uri)
        if p.password:
            netloc = p.netloc.replace(f":{p.password}@", ":***@")
            return urlunparse(p._replace(netloc=netloc))
    except Exception:
        pass
    return uri

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


def _history_col() -> Collection:
    return get_db()["weather_history"]


def _users_col() -> Collection:
    return get_db()["users"]


def _activities_col() -> Collection:
    return get_db()["user_activities"]


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
    """Insert or replace the AI text report for a given presenter + language."""
    _reports_col().update_one(
        {"presenter": presenter, "language": language},
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


def get_report(presenter: str, language: str = "de") -> dict | None:
    """Return the latest AI report for a presenter + language, or None."""
    return _reports_col().find_one({"presenter": presenter, "language": language}, {"_id": 0})


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


# ── Weather history ────────────────────────────────────────────────────────────

def append_history(
    zipcode: str,
    city: str,
    current: dict,
    daily_weekone: dict,
) -> None:
    """
    Append a weather snapshot to the history log.
    Unlike weather_snapshots (which upserts), history always inserts a new record.
    Keeps at most 90 days per location to avoid unbounded growth.
    """
    now = datetime.now(timezone.utc)

    # Extract today's min/max from daily_weekone if available
    daily_summary: dict = {}
    if daily_weekone:
        today_key = now.strftime("%Y-%m-%d")
        today_data = daily_weekone.get(today_key) or next(iter(daily_weekone.values()), {})
        daily_summary = {
            "mintemp":   today_data.get("mintemp"),
            "maxtemp":   today_data.get("maxtemp"),
            "overcast":  today_data.get("overcast"),
            "rain_prob": today_data.get("precipitation probability", today_data.get("precipitation", 0)),
        }

    _history_col().insert_one({
        "zipcode":       zipcode,
        "city":          city,
        "recorded_at":   now,
        "temperature":   current.get("temperature"),
        "feels_like":    current.get("feels like"),
        "humidity":      current.get("humidity"),
        "overcast":      current.get("overcast"),
        "precipitation": current.get("current_precipitation"),
        "wind_speed":    current.get("wind speed"),
        "daily_summary": daily_summary,
    })

    # Prune records older than 90 days
    cutoff = now - timedelta(days=90)
    _history_col().delete_many({"zipcode": zipcode, "recorded_at": {"$lt": cutoff}})


# ── Users ──────────────────────────────────────────────────────────────────────

def create_user(email: str, username: str, password_hash: str) -> str:
    result = _users_col().insert_one({
        "email": email.lower(),
        "username": username,
        "password_hash": password_hash,
        "hobbies": [],
        "created_at": datetime.now(timezone.utc),
    })
    return str(result.inserted_id)


def get_user_by_email(email: str) -> dict | None:
    return _users_col().find_one({"email": email.lower()})


def get_user_by_id(user_id: str) -> dict | None:
    from bson import ObjectId
    try:
        return _users_col().find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    except Exception:
        return None


def update_user(user_id: str, updates: dict) -> None:
    from bson import ObjectId
    try:
        _users_col().update_one({"_id": ObjectId(user_id)}, {"$set": updates})
    except Exception as exc:
        print(f"[MongoDB] update_user failed: {exc}")


# ── User Activities ────────────────────────────────────────────────────────────

def log_activity(user_id: str, city: str, zipcode: str, hobbies: list) -> None:
    now = datetime.now(timezone.utc)
    _activities_col().insert_one({
        "user_id": user_id,
        "date": now.strftime("%Y-%m-%d"),
        "city": city,
        "zipcode": zipcode,
        "hobbies": hobbies,
        "timestamp": now,
    })


def get_user_activities(user_id: str, days: int = 30) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    return list(
        _activities_col().find(
            {"user_id": user_id, "timestamp": {"$gte": cutoff}},
            {"_id": 0},
        ).sort("timestamp", DESCENDING)
    )


def get_history(zipcode: str, days: int = 14) -> list[dict]:
    """Return weather history records for the past `days` days, oldest first."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cursor = _history_col().find(
        {"zipcode": zipcode, "recorded_at": {"$gte": cutoff}},
        {"_id": 0},
    ).sort("recorded_at", ASCENDING)
    return list(cursor)
