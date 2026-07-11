"""
Shared Gemini quota tracker — WEATHER-FISH
=============================================
text_generation.py (report generation) and chat.py each walk the same
model fallback chain independently. Without this module, a model that
report generation discovers is daily-exhausted is unknown to chat (and
vice versa) — every call re-burns a request against a model that is
already dead for the day, on top of every parallel presenter/language
thread doing the same. That's what drains quota fast and pushes both
report generation and chat into their fallback paths early.

This module is the single shared source of truth: once any caller marks
a model exhausted, every other caller (same process or after a restart,
via Mongo) skips it for the rest of the Gemini day — no API call spent.

Google resets Gemini free-tier daily quotas at midnight Pacific time,
so "today" here is computed in that timezone, not UTC/local.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from database import mongo

_PACIFIC = ZoneInfo("America/Los_Angeles")

# Shared fallback chain — single source of truth for both report generation
# and chat, so they can never drift out of sync with each other.
#
# IMPORTANT: the v1beta /models catalog listing a model does NOT mean it's
# actually callable — e.g. gemini-2.5-flash-lite is listed but returns 404
# "no longer available to new users" for this project's key. Every entry
# below was confirmed with a real generateContent call on 2026-07-11 (either
# a successful response, or a 429 quota error — never a 404). If this chain
# starts 404ing again, re-verify with a live call per model, not just the
# catalog listing.
MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-flash-latest",       # alias to Google's current default flash GA
    "gemini-flash-lite-latest",  # alias to Google's current default flash-lite GA
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
]

# In-process cache: {model_name: pacific_date_str_when_marked_exhausted}
_exhausted: dict[str, str] = {}
_loaded_for_day: str | None = None


def _today() -> str:
    return datetime.now(_PACIFIC).strftime("%Y-%m-%d")


def _ensure_loaded() -> None:
    """Load today's exhausted-model set from MongoDB once per process/day."""
    global _loaded_for_day
    today = _today()
    if _loaded_for_day == today:
        return
    try:
        for model in mongo.get_exhausted_models(today):
            _exhausted[model] = today
    except Exception as exc:
        print(f"[Quota] Could not load exhausted-model state: {exc}")
    _loaded_for_day = today


def is_exhausted(model: str) -> bool:
    """True if `model` is already known to be daily-exhausted today — skip it, no API call needed."""
    _ensure_loaded()
    return _exhausted.get(model) == _today()


def mark_exhausted(model: str) -> None:
    """Record that `model` just returned a daily-quota 429 — persisted so every caller skips it today."""
    today = _today()
    _exhausted[model] = today
    try:
        mongo.mark_model_exhausted(model, today)
    except Exception as exc:
        print(f"[Quota] Could not persist exhausted model: {exc}")


def is_daily_limit_error(exc: Exception) -> bool:
    """True when a Gemini ClientError is a daily (not per-minute) quota violation."""
    try:
        msg = str(exc)
        return "PerDay" in msg or "limit: 0" in msg
    except Exception:
        return False


def is_model_not_found_error(exc: Exception) -> bool:
    """
    True when a model has been retired/renamed by Google (HTTP 404) rather than
    just rate-limited. This is permanent, not daily, but our tracker is
    day-granular — marking it exhausted-for-today still stops every other
    caller from re-wasting a request on a dead model for the rest of the day.
    """
    return getattr(exc, "code", None) == 404


def status() -> dict:
    """Snapshot for the /api/status endpoint — which models are dead today."""
    _ensure_loaded()
    today = _today()
    exhausted_today = sorted(m for m, d in _exhausted.items() if d == today)
    return {
        "quota_day":         today,
        "exhausted_models":  exhausted_today,
        "available_models":  [m for m in MODELS if m not in exhausted_today],
    }
