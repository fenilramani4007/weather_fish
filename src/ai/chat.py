"""
Chat — WEATHER-FISH
====================
Conversational weather assistant powered by Gemini.
Uses real-time MongoDB weather data as grounding context.
Falls back through multiple model tiers on quota exhaustion.
"""

import os
from google import genai
from google.genai import types as genai_types
from google.genai.errors import ClientError

_client: genai.Client | None = None

# Model fallback chain — same pattern as text_generation.py
_CHAT_MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
]


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        key = os.environ.get("GEMINI_API_KEY", "")
        if not key:
            raise RuntimeError("GEMINI_API_KEY not set")
        _client = genai.Client(api_key=key)
    return _client


def reply(
    message: str,
    history: list[dict],
    weather_ctx: dict | None,
    language: str = "de",
) -> str:
    """
    Return a chat reply grounded in the user's current weather data.

    Parameters
    ----------
    message     : latest user message
    history     : list of {"role": "user"|"model", "text": str}
    weather_ctx : MongoDB weather document for the selected location
    language    : "de" or "en"
    """
    system_prompt = _build_system_prompt(weather_ctx, language)

    # Build conversation contents — Gemini requires alternating user/model
    raw_history = [h for h in history[-10:] if h.get("role") in ("user", "model")]

    # Drop leading model turns — conversation must start with "user"
    while raw_history and raw_history[0].get("role") == "model":
        raw_history = raw_history[1:]

    contents = [
        {"role": h["role"], "parts": [{"text": h.get("text", "")}]}
        for h in raw_history
    ]
    contents.append({"role": "user", "parts": [{"text": message}]})

    # Try each model in the fallback chain
    for model in _CHAT_MODELS:
        try:
            cfg = genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
            )
            response = _get_client().models.generate_content(
                model=model,
                contents=contents,
                config=cfg,
            )
            text = (response.text or "").strip()
            if text:
                print(f"[Chat] OK — model={model}")
                return text
        except ClientError as exc:
            code = getattr(exc, "code", None)
            print(f"[Chat] ClientError on {model}: code={code} — {exc}")
            if code == 429:
                continue   # quota — try next model
            break          # other client error — stop trying
        except (RuntimeError, AttributeError) as exc:
            # GenerateContentConfig may not exist in older SDK — fall back to inline injection
            print(f"[Chat] Config not supported ({exc}), retrying with inline system prompt")
            try:
                inline_contents = list(contents)
                inline_contents[0] = {
                    "role": inline_contents[0]["role"],
                    "parts": [{"text": system_prompt + "\n\n" + inline_contents[0]["parts"][0]["text"]}],
                }
                response = _get_client().models.generate_content(
                    model=model,
                    contents=inline_contents,
                )
                text = (response.text or "").strip()
                if text:
                    print(f"[Chat] OK (inline) — model={model}")
                    return text
            except Exception as exc2:
                print(f"[Chat] Inline fallback also failed on {model}: {exc2}")
            break
        except Exception as exc:
            print(f"[Chat] Unexpected error on {model}: {exc}")
            continue

    return (
        "Sorry, the weather assistant is temporarily unavailable. Please try again shortly."
        if language == "en"
        else "Entschuldigung, der Wetter-Assistent ist gerade nicht verfügbar. Bitte später erneut versuchen."
    )


def _build_system_prompt(weather_ctx: dict | None, language: str) -> str:
    lines = [
        "You are WEATHER-FISH Assistant — a smart, friendly weather companion. "
        "Answer weather-related questions clearly and conversationally. "
        "Keep answers concise (2–4 sentences) unless the user explicitly asks for detail. "
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

        # Hourly range and rain hours
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
                hours_str = ", ".join(str(h) for h in sorted(rain_hours, key=int)[:4])
                lines.append(f"Rain likely around hour(s): {hours_str}:00.")
            else:
                lines.append("No significant rain expected today.")

        # Tomorrow's forecast
        weekone = weather_ctx.get("daily_weekone", {})
        days = list(weekone.items()) if weekone else []
        if len(days) >= 2:
            d, data = days[1]
            lines.append(
                f"Tomorrow ({d}): {data.get('mintemp')}–{data.get('maxtemp')}°C, "
                f"{data.get('overcast')}, wind up to {data.get('maxwindspeed')} km/h."
            )

    # Language instruction
    lines.append(
        "Respond ONLY in English. Do not switch languages."
        if language == "en"
        else "Antworte IMMER auf Deutsch. Kein Sprachwechsel."
    )

    return " ".join(lines)
