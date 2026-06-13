"""
Chat — WEATHER-FISH
====================
Conversational weather assistant powered by Gemini.
Uses real-time MongoDB weather data as grounding context.
"""

import os
from google import genai

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
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
    system_lines = [
        "You are WEATHER-FISH Assistant — a smart, friendly weather companion. "
        "Answer weather-related questions clearly and conversationally. "
        "Keep answers concise (2–4 sentences) unless the user asks for detail. "
        "If asked about something unrelated to weather, politely redirect."
    ]

    if weather_ctx:
        city = weather_ctx.get("city", "")
        cur  = weather_ctx.get("current", {})
        system_lines.append(
            f"Live weather for {city}: "
            f"{cur.get('temperature')}°C (feels {cur.get('feels like')}°C), "
            f"humidity {cur.get('humidity')}%, "
            f"sky: {cur.get('overcast')}, "
            f"precipitation: {cur.get('current_precipitation') or 'none'}."
        )

        hourly = weather_ctx.get("hourly", {})
        if hourly:
            temps = [e.get("temperature") for e in hourly.values() if isinstance(e, dict) and e.get("temperature") is not None]
            rain_hours = [h for h, e in hourly.items() if isinstance(e, dict) and e.get("precipitation probability", 0) >= 60]
            if temps:
                system_lines.append(f"Today's temp range: {min(temps)}–{max(temps)}°C.")
            if rain_hours:
                system_lines.append(f"Rain likely around: {', '.join(rain_hours[:3])}:00.")

        weekone = weather_ctx.get("daily_weekone", {})
        days = list(weekone.items()) if weekone else []
        if len(days) >= 2:
            d, data = days[1]
            system_lines.append(
                f"Tomorrow ({d}): {data.get('mintemp')}–{data.get('maxtemp')}°C, "
                f"{data.get('overcast')}, wind up to {data.get('maxwindspeed')} km/h."
            )

    system_lines.append(
        "Respond in English." if language == "en"
        else "Antworte immer auf Deutsch."
    )

    system_prompt = " ".join(system_lines)

    # Build conversation — last 10 turns only
    contents = []
    for h in history[-10:]:
        contents.append({
            "role": h.get("role", "user"),
            "parts": [{"text": h.get("text", "")}],
        })
    contents.append({"role": "user", "parts": [{"text": message}]})

    # Inject system context into the first user message
    if contents:
        contents[0]["parts"][0]["text"] = (
            system_prompt + "\n\n" + contents[0]["parts"][0]["text"]
        )

    try:
        response = _get_client().models.generate_content(
            model="gemini-2.0-flash",
            contents=contents,
        )
        return response.text.strip()
    except Exception as exc:
        print(f"[Chat] ERROR: {exc}")
        return (
            "Sorry, the assistant is temporarily unavailable."
            if language == "en"
            else "Entschuldigung, der Assistent ist gerade nicht verfügbar."
        )
