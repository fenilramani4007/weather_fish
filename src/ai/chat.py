"""
Chat — WEATHER-FISH
====================
Conversational weather assistant powered by Gemini.
"""

import os
from google import genai
from google.genai.errors import ClientError

from ai import quota

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

# Model list — shared with text_generation.py via ai.quota so both code paths
# agree on which models are already daily-exhausted (see ai/quota.py docstring).
_CHAT_MODELS = quota.MODELS


def reply(
    message: str,
    history: list[dict],
    weather_ctx: dict | None,
    language: str = "de",
    extra_ctxs: list[dict] | None = None,
) -> str:
    if _client is None:
        print("[Chat] reply() called but client is None — returning fallback")
        return _context_fallback(message, weather_ctx, language)

    prompt = _build_prompt(message, history, weather_ctx, language, extra_ctxs or [])

    for model in _CHAT_MODELS:
        if quota.is_exhausted(model):
            print(f"[Chat] {model} already known exhausted today — skipping (no API call)")
            continue
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
            print(f"[Chat] ClientError on {model}: code={code} — {exc}")
            if code == 401:
                break  # invalid key — no point trying other models
            if code == 429 and quota.is_daily_limit_error(exc):
                print(f"[Chat] Daily quota exhausted for {model} — skipping")
                quota.mark_exhausted(model)
            elif quota.is_model_not_found_error(exc):
                print(f"[Chat] {model} not found (retired?) — skipping for today")
                quota.mark_exhausted(model)
            continue   # 404, 429 per-min, 500 → try next model
        except Exception as exc:
            print(f"[Chat] Exception on {model}: {type(exc).__name__}: {exc}")
            continue

    return _context_fallback(message, weather_ctx, language)


def _build_prompt(
    message: str,
    history: list[dict],
    weather_ctx: dict | None,
    language: str,
    extra_ctxs: list[dict] | None = None,
) -> str:
    system = _build_system_prompt(weather_ctx, language, extra_ctxs or [])
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


def _context_fallback(message: str, weather_ctx: dict | None, language: str) -> str:
    """
    Rule-based fallback when all Gemini models are quota-exhausted.
    Answers common weather questions directly from the context data.
    """
    de = language != "en"

    if not weather_ctx:
        return (
            "No weather data available for this location yet. Please generate a report first."
            if not de else
            "Keine Wetterdaten für diesen Standort. Bitte zuerst einen Bericht generieren."
        )

    cur     = weather_ctx.get("current", {})
    city    = weather_ctx.get("city", "")
    temp    = cur.get("temperature")
    feels   = cur.get("feels like")
    humid   = cur.get("humidity")
    precip  = cur.get("current_precipitation") or "none"
    sky     = cur.get("overcast", "")
    wind    = cur.get("wind speed", "–")
    msg     = message.lower()

    hourly  = weather_ctx.get("hourly", {})
    weekone = weather_ctx.get("daily_weekone", {})

    # ── Outdoor activity / event planning (the core differentiator) ──────────────
    # "Should I plan a picnic?", "Good for cycling?", "Weekend plans?" etc.
    ACTIVITY_WORDS = [
        "picnic", "piknik", "grillparty", "grill", "barbecue",
        "cycling", "radfahren", "fahrrad", "bike", "biking",
        "running", "joggen", "jogging", "laufen",
        "hiking", "wandern", "trekking",
        "walking", "spazieren", "walk",
        "outdoor", "draußen", "outside", "garden", "garten",
        "sport", "exercise", "training",
        "weekend", "wochenende", "plan", "event", "veranstaltung",
        "swimming", "schwimmen", "tennis", "football", "fußball",
    ]
    if any(w in msg for w in ACTIVITY_WORDS):
        return _activity_advice(msg, city, temp, precip, sky, wind, hourly, weekone, de)

    # Rain / umbrella
    if any(w in msg for w in ["umbrella", "schirm", "regenschirm", "regen", "rain"]):
        if precip == "rain":
            return (f"Ja, es regnet gerade in {city} — Regenschirm unbedingt mitnehmen!" if de
                    else f"Yes, it's currently raining in {city} — definitely bring an umbrella!")
        else:
            return (f"Kein Regen in {city} im Moment — kein Schirm nötig." if de
                    else f"No rain in {city} right now — no umbrella needed.")

    # Clothing / what to wear
    if any(w in msg for w in ["wear", "anzieh", "kleidung", "outfit", "jacket", "jacke"]):
        if temp is None:
            return (f"Aktuelle Temperatur in {city}: unbekannt." if de else f"Temperature data unavailable for {city}.")
        if temp < 0:
            tip = ("Winterjacke, Schal, Handschuhe — es ist unter null!" if de
                   else "Winter coat, scarf and gloves — it's below freezing!")
        elif temp < 10:
            tip = ("Warme Jacke und Pullover empfohlen." if de else "Warm jacket and sweater recommended.")
        elif temp < 18:
            tip = ("Leichte Jacke oder Pullover reicht." if de else "A light jacket or sweater is enough.")
        elif temp < 26:
            tip = ("T-Shirt-Wetter — angenehm!" if de else "T-shirt weather — pleasant!")
        else:
            tip = ("Leichte, luftige Kleidung — es ist warm!" if de else "Light, airy clothes — it's warm!")
        return f"{city}: {temp}°C — {tip}"

    # Tomorrow
    if any(w in msg for w in ["morgen", "tomorrow"]):
        days = list(weekone.items())
        if len(days) >= 2:
            d, data = days[1]
            return (f"Morgen ({d}) in {city}: {data.get('mintemp')}–{data.get('maxtemp')}°C, {data.get('overcast')}." if de
                    else f"Tomorrow ({d}) in {city}: {data.get('mintemp')}–{data.get('maxtemp')}°C, {data.get('overcast')}.")

    # Next week / forecast / analysis
    if any(w in msg for w in ["woche", "week", "forecast", "prognose", "vorhersage", "analyse", "analysis", "next"]):
        if weekone:
            lines = []
            for d, v in list(weekone.items())[:7]:
                lines.append(f"{d}: {v.get('mintemp')}–{v.get('maxtemp')}°C, {v.get('overcast')}")
            header = f"7-Tage-Prognose für {city}:" if de else f"7-day forecast for {city}:"
            return header + "\n" + "\n".join(lines)

    # Warmest time of day
    if any(w in msg for w in ["wärmst", "warmest", "hottest", "wann warm"]):
        if hourly:
            peak = max(hourly.items(), key=lambda kv: kv[1].get("temperature", -99) if isinstance(kv[1], dict) else -99, default=(None, {}))
            if peak[0]:
                return (f"Am wärmsten in {city} um {peak[0]}:00 Uhr mit {peak[1].get('temperature')}°C." if de
                        else f"Warmest in {city} at {peak[0]}:00 with {peak[1].get('temperature')}°C.")

    # Current conditions (default)
    if temp is not None:
        parts = [f"{city}: {temp}°C"]
        if feels: parts.append(f"({'gefühlt' if de else 'feels like'} {feels}°C)")
        if sky:   parts.append(sky)
        if precip == "rain": parts.append("🌧️")
        if humid: parts.append(f"{'Feuchte' if de else 'Humidity'} {humid}%")
        return " · ".join(parts)

    return (
        "Leider sind die KI-Dienste momentan nicht verfügbar. Bitte später erneut versuchen."
        if de else
        "AI services are temporarily unavailable. Please try again later."
    )


def _activity_advice(
    msg: str,
    city: str,
    temp: float | None,
    precip: str,
    sky: str,
    wind,
    hourly: dict,
    weekone: dict,
    de: bool,
) -> str:
    """
    Contextual outdoor activity advice — the core differentiator.
    Works without Gemini by reasoning directly over weather data.
    Handles: picnic, cycling, running, hiking, outdoor events, weekend plans.
    """
    # Determine which activity was asked about
    msg_l = msg.lower()
    if any(w in msg_l for w in ["picnic", "piknik", "grill", "barbecue", "bbq"]):
        act_de, act_en = "Picknick", "picnic"
        wind_limit = 30
    elif any(w in msg_l for w in ["cycling", "radfahren", "fahrrad", "bike", "biking"]):
        act_de, act_en = "Radfahren", "cycling"
        wind_limit = 35
    elif any(w in msg_l for w in ["running", "joggen", "jogging", "laufen"]):
        act_de, act_en = "Joggen", "running"
        wind_limit = 45
    elif any(w in msg_l for w in ["hiking", "wandern", "trekking"]):
        act_de, act_en = "Wandern", "hiking"
        wind_limit = 40
    elif any(w in msg_l for w in ["swimming", "schwimmen"]):
        act_de, act_en = "Schwimmen", "swimming"
        wind_limit = 50
    elif any(w in msg_l for w in ["tennis", "football", "fußball", "sport", "exercise", "training"]):
        act_de, act_en = "Sport", "sport/exercise"
        wind_limit = 40
    else:
        act_de, act_en = "Outdoor-Aktivitäten", "outdoor activities"
        wind_limit = 35

    act = act_de if de else act_en

    # Check if asking about weekend vs today
    is_weekend_query = any(w in msg_l for w in ["weekend", "wochenende", "samstag", "sonntag", "saturday", "sunday"])

    if is_weekend_query and weekone:
        # Find Saturday/Sunday in the 7-day forecast
        from datetime import datetime
        weekend_days = []
        for d, v in weekone.items():
            try:
                wd = datetime.strptime(d, "%Y-%m-%d").weekday()
                if wd in (5, 6):  # Saturday=5, Sunday=6
                    weekend_days.append((d, v))
            except Exception:
                pass

        if weekend_days:
            lines = []
            for d, v in weekend_days:
                # "precipitation" in daily data is a string ("rain" or ""), not a percentage
                rains    = v.get("precipitation", "") == "rain"
                too_hot  = (v.get("maxtemp") or 0) > 33
                too_cold = (v.get("mintemp") or 0) < 4
                good     = not rains and not too_hot and not too_cold and v.get("overcast", "") != "overcast"
                icon     = "✅" if good else "⚠️"
                weekday  = datetime.strptime(d, "%Y-%m-%d").weekday()
                day_label = ("Samstag" if weekday == 5 else "Sonntag") if de else \
                            ("Saturday" if weekday == 5 else "Sunday")
                note = (" — " + ("Regen" if de else "rain")) if rains else \
                       (" — " + ("sehr heiß" if de else "very hot")) if too_hot else \
                       (" — " + ("zu kalt" if de else "too cold")) if too_cold else ""
                lines.append(
                    f"{icon} {day_label} ({d}): {v.get('mintemp')}–{v.get('maxtemp')}°C, {v.get('overcast')}{note}"
                )
            header = (f"{act} dieses Wochenende in {city}:" if de
                      else f"{act} this weekend in {city}:")
            return header + "\n" + "\n".join(lines)

    # Today's assessment
    raining       = precip == "rain"
    max_rain_prob = max(
        (e.get("precipitation probability", 0) for e in hourly.values() if isinstance(e, dict)),
        default=0,
    )
    hot   = temp is not None and temp > 33
    cold  = temp is not None and temp < 4
    windy = isinstance(wind, (int, float)) and wind > wind_limit

    problems = []
    if raining:         problems.append("Regen" if de else "rain")
    elif max_rain_prob >= 50:
        problems.append(f"{max_rain_prob}% {'Regenwahrscheinlichkeit' if de else 'rain chance'}")
    if hot:             problems.append(f"{'sehr heiß' if de else 'very hot'} ({temp}°C)")
    if cold:            problems.append(f"{'zu kalt' if de else 'too cold'} ({temp}°C)")
    if windy:           problems.append(f"{'starker Wind' if de else 'strong wind'} ({wind} km/h)")

    if not problems:
        cond = f"{temp}°C, {sky}" if temp is not None else sky
        return (
            f"✅ Heute ist ideal für {act} in {city}! {cond} — perfekte Bedingungen."
            if de else
            f"✅ Today is ideal for {act} in {city}! {cond} — perfect conditions."
        )
    else:
        reason = ", ".join(problems)
        cond   = f"{temp}°C, {sky}" if temp is not None else sky
        return (
            f"⚠️ {act} in {city} heute eher schwierig: {reason}. Aktuell {cond}."
            if de else
            f"⚠️ {act} in {city} is tricky today due to: {reason}. Currently {cond}."
        )


def _fallback(language: str) -> str:
    return (
        "Sorry, the weather assistant is temporarily unavailable. Please try again shortly."
        if language == "en"
        else "Entschuldigung, der Wetter-Assistent ist gerade nicht verfügbar. Bitte später erneut versuchen."
    )


def _build_system_prompt(weather_ctx: dict | None, language: str, extra_ctxs: list[dict] | None = None) -> str:
    lines = [
        "You are WEATHER-FISH Agent — an autonomous weather intelligence system with access to "
        "real-time weather data, 7–14 day forecasts, hourly breakdowns, and multi-location data. "
        "Answer weather questions clearly and conversationally. "
        "For simple questions keep it to 2–4 sentences; for analysis, multi-day forecasts, or comparison requests give a structured detailed response. "
        "You can reference any of the weather data provided to give contextual, actionable advice. "
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
                t
                for e in hourly.values()
                if isinstance(e, dict) and (t := e.get("temperature")) is not None
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

    if extra_ctxs:
        summaries = []
        for ctx in extra_ctxs:
            city = ctx.get("city", "?")
            cur  = ctx.get("current", {})
            summaries.append(
                f"{city}: {cur.get('temperature')}°C, {cur.get('overcast')}, "
                f"precip={cur.get('current_precipitation') or 'none'}"
            )
        lines.append(
            f"Other saved locations you can reference: {' | '.join(summaries)}. "
            "Use this data if the user asks to compare locations or asks about one of these cities."
        )

    lines.append(
        "Respond ONLY in English." if language == "en"
        else "Antworte IMMER auf Deutsch."
    )
    return " ".join(lines)
