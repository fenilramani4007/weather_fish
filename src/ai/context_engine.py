"""
Context Engine — WEATHER-FISH
==============================
Analyzes structured weather data and produces context parameters that
drive adaptive, tone-aware prompt engineering.

Pipeline position:
  Weather API → [Context Engine] → Prompt Engineering → AI Model → TTS
"""

from datetime import datetime, timezone


def analyze(current: dict, hourly: dict, daily_weekone: dict) -> dict:
    """
    Analyze weather snapshot and return context parameters.

    Returns
    -------
    dict with keys:
      severity         "warning" | "advisory" | "normal" | "cheerful"
      time_of_day      "morning" | "afternoon" | "evening" | "night"
      tone             human-readable tone instruction for the AI
      temperature_feel human-readable temperature description
      highlights       list[str] — notable facts to weave into the report
    """
    temp     = current.get("temperature", 20)
    precip   = current.get("current_precipitation", "")
    overcast = current.get("overcast", "clear")

    severity    = _severity(temp, precip, overcast)
    time_of_day = _time_of_day()
    highlights  = _highlights(temp, precip, overcast, hourly)

    tone_map = {
        "warning":  "cautionary and urgent — clearly warn the listener about dangerous conditions",
        "advisory": "informative and practical — give helpful, actionable advice",
        "normal":   "friendly and conversational — keep it light but informative",
        "cheerful": "upbeat, enthusiastic, and sunny — radiate positive energy",
    }

    return {
        "severity":         severity,
        "time_of_day":      time_of_day,
        "tone":             tone_map[severity],
        "temperature_feel": _temp_feel(temp),
        "highlights":       highlights,
    }


# ── Severity ──────────────────────────────────────────────────────────────────

def _severity(temp: float, precip: str, overcast: str) -> str:
    # Extreme conditions → warning
    if temp > 35 or temp < -5:
        return "warning"
    if precip == "rain" and temp < 5:
        return "warning"        # cold rain near freezing

    # Moderate conditions → advisory
    if precip == "rain":
        return "advisory"
    if overcast == "cloudy":
        return "advisory"

    # Pleasant → cheerful; mild → normal
    if temp >= 22:
        return "cheerful"
    return "normal"


# ── Time of day ───────────────────────────────────────────────────────────────

def _time_of_day() -> str:
    hour = datetime.now(timezone.utc).hour
    if 5  <= hour < 12: return "morning"
    if 12 <= hour < 17: return "afternoon"
    if 17 <= hour < 21: return "evening"
    return "night"


# ── Highlights ────────────────────────────────────────────────────────────────

def _highlights(temp: float, precip: str, overcast: str, hourly: dict) -> list[str]:
    h: list[str] = []

    # Current conditions
    if precip == "rain":
        h.append("current rainfall — recommend umbrella or rain jacket")
    if temp > 30:
        h.append(f"high heat ({temp}°C) — stay hydrated, avoid peak sun hours")
    if temp < 0:
        h.append(f"sub-zero ({temp}°C) — ice risk, dress in layers")

    # Hourly outlook: upcoming heavy rain
    rainy = [
        str(hour) for hour, e in hourly.items()
        if e.get("precipitation probability", 0) >= 70
    ]
    if rainy:
        h.append(f"heavy rain expected around {', '.join(rainy[:3])}:00")

    # Temperature swing across the day
    temps = [e.get("temperature", temp) for e in hourly.values() if isinstance(e, dict)]
    if len(temps) >= 2 and max(temps) - min(temps) >= 10:
        h.append(
            f"big temperature swing today: {min(temps)}–{max(temps)}°C — dress in layers"
        )

    # Clear sky bonus
    if overcast == "clear" and precip != "rain" and not h:
        h.append("clear skies — great conditions for outdoor activities")

    return h


# ── Temperature feel ──────────────────────────────────────────────────────────

def _temp_feel(temp: float) -> str:
    if temp < -5:  return "extreme cold (frostbite danger)"
    if temp < 0:   return "freezing"
    if temp < 8:   return "very cold"
    if temp < 15:  return "cool"
    if temp < 20:  return "mild"
    if temp < 26:  return "pleasant and comfortable"
    if temp < 32:  return "warm"
    return "hot (heat caution advised)"
