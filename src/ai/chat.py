"""
Chat — WEATHER-FISH
====================
Conversational weather assistant powered by Gemini.
"""

import os
from google import genai
from google.genai.errors import ClientError

# ── Module-level client — same pattern as text_generation.py ──────────────────
# Created once at import time so any key/config issues surface at startup.
_client: genai.Client | None = None
try:
    _key = os.environ.get("GEMINI_API_KEY", "")
    if _key:
        _client = genai.Client(api_key=_key)
        print("[Chat] Gemini client ready")
    else:
        print("[Chat] WARNING: GEMINI_API_KEY not set — chat disabled")
except Exception as _exc:
    print(f"[Chat] WARNING: could not create Gemini client: {_exc}")

# Model list — broadest quota coverage across buckets
# 2.5 models have a separate free-tier quota from 2.0 models
# 1.5 models need versioned names for v1beta API
_CHAT_MODELS = [
    "gemini-2.5-flash-preview-05-20",  # newest, separate quota bucket
    "gemini-2.5-flash",                # 2.5 GA
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash-001",            # versioned name (not gemini-1.5-flash)
    "gemini-1.5-flash-8b-001",
]


def reply(
    message: str,
    history: list[dict],
    weather_ctx: dict | None,
    language: str = "de",
) -> str:
    if _client is None:
        print("[Chat] reply() called but client is None — returning fallback")
        return _fallback(language)

    prompt = _build_prompt(message, history, weather_ctx, language)

    for model in _CHAT_MODELS:
        try:
            print(f"[Chat] Trying model={model}")
            response = _client.models.generate_content(model=model, contents=prompt)
            try:
                text = (response.text or "").strip()
            except Exception as exc:
                print(f"[Chat] response.text error on {model}: {exc}")
                text = ""
            if text:
                print(f"[Chat] OK — model={model}")
                return text
            print(f"[Chat] Empty response from {model}")
        except ClientError as exc:
            code = getattr(exc, "code", None)
            msg  = str(exc)
            print(f"[Chat] ClientError on {model}: code={code} — {exc}")
            if code == 401:
                break  # invalid key — no point trying other models
            if code == 429 and ("PerDay" in msg or "limit: 0" in msg):
                print(f"[Chat] Daily quota exhausted for {model} — skipping")
            continue   # 404, 429 per-min, 500 → try next model
        except Exception as exc:
            print(f"[Chat] Exception on {model}: {type(exc).__name__}: {exc}")
            continue

    return _fallback(language)


def _build_prompt(
    message: str,
    history: list[dict],
    weather_ctx: dict | None,
    language: str,
) -> str:
    system = _build_system_prompt(weather_ctx, language)
    parts = [system, "\n\nConversation so far:\n"]
    for h in history[-8:]:
        role = h.get("role", "")
        text = h.get("text", "")
        if role == "user":
            parts.append(f"User: {text}\n")
        elif role == "model":
            parts.append(f"Assistant: {text}\n")
    parts.append(f"\nUser: {message}\nAssistant:")
    return "".join(parts)


def _fallback(language: str) -> str:
    return (
        "Sorry, the weather assistant is temporarily unavailable. Please try again shortly."
        if language == "en"
        else "Entschuldigung, der Wetter-Assistent ist gerade nicht verfügbar. Bitte später erneut versuchen."
    )


def _build_system_prompt(weather_ctx: dict | None, language: str) -> str:
    lines = [
        "You are WEATHER-FISH Assistant — a smart, friendly weather companion. "
        "Answer weather-related questions clearly and conversationally. "
        "For simple questions keep it to 2–4 sentences; for analysis, multi-day forecasts, or chart requests give a detailed structured response. "
        "If asked something unrelated to weather, politely redirect to weather topics."
    ]

    if weather_ctx:
        city = weather_ctx.get("city", "the selected location")
        cur  = weather_ctx.get("current", {})
        lines.append(
            f"Current live weather for {city}: "
            f"temperature {cur.get('temperature')}°C "
            f"(feels like {cur.get('feels like')}°C), "
            f"humidity {cur.get('humidity')}%, "
            f"sky: {cur.get('overcast')}, "
            f"precipitation: {cur.get('current_precipitation') or 'none'}, "
            f"wind: {cur.get('wind speed', 'unknown')} km/h."
        )

        hourly = weather_ctx.get("hourly", {})
        if hourly:
            temps = [
                e.get("temperature")
                for e in hourly.values()
                if isinstance(e, dict) and e.get("temperature") is not None
            ]
            rain_hours = [
                h for h, e in hourly.items()
                if isinstance(e, dict) and e.get("precipitation probability", 0) >= 60
            ]
            if temps:
                lines.append(f"Today's temperature range: {min(temps)}–{max(temps)}°C.")
            if rain_hours:
                hrs = ", ".join(str(h) for h in sorted(rain_hours, key=int)[:4])
                lines.append(f"Rain likely around: {hrs}:00.")
            else:
                lines.append("No significant rain expected today.")

        weekone = weather_ctx.get("daily_weekone", {})
        if weekone:
            day_parts = [
                f"{d}: {v.get('mintemp')}–{v.get('maxtemp')}°C, {v.get('overcast')}"
                for d, v in weekone.items()
            ]
            lines.append(f"7-day forecast: {' | '.join(day_parts)}.")

        weektwo = weather_ctx.get("daily_weektwo", {})
        if weektwo:
            day_parts2 = [
                f"{d}: {v.get('mintemp')}–{v.get('maxtemp')}°C, {v.get('overcast')}"
                for d, v in weektwo.items()
            ]
            if day_parts2:
                lines.append(f"Extended forecast (days 8–14): {' | '.join(day_parts2)}.")

    lines.append(
        "Respond ONLY in English." if language == "en"
        else "Antworte IMMER auf Deutsch."
    )
    return " ".join(lines)
