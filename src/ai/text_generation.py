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
from datetime import datetime, timezone

from google import genai
from google.genai.errors import ClientError
from database import io

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

# Model priority — broadest quota coverage
# 2.5 and 2.0 have separate free-tier quota buckets
# 1.5 models need versioned names (gemini-1.5-flash-001) for v1beta API
MODELS = [
    "gemini-2.5-flash-preview-05-20",  # newest, own quota bucket
    "gemini-2.5-flash",                # 2.5 GA
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash-001",            # versioned (was: gemini-1.5-flash)
    "gemini-1.5-flash-8b-001",         # versioned (was: gemini-1.5-flash-8b)
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

# Variation seeds — injected randomly so each generation has a different feel
_VARIATION_OPENERS = [
    "Open with a vivid sensory detail — what it feels like to step outside right now.",
    "Begin with an observation about the quality of light or sky at this moment.",
    "Start with how this weather connects to the current season or time of year.",
    "Open with what this weather means for the morning commute or start of the day.",
    "Begin by naming the most striking aspect of today's weather conditions.",
    "Start with a brief but evocative comparison: 'Today feels like…'",
    "Open by addressing the listener directly — what should they expect today?",
]

_VARIATION_FOCUS = [
    "Give special attention to how the temperature will evolve through the day.",
    "Focus on the rain outlook and exactly when people should plan around it.",
    "Highlight the wind and how it changes the real-feel temperature.",
    "Emphasize the humidity and comfort level throughout the day.",
    "Contrast this with what yesterday felt like or what is typical for this time of year.",
    "Focus on practical advice: dress code, whether to carry an umbrella, outdoor plans.",
    "Pay extra attention to the evening and night forecast for those planning outings.",
]

_PERSONA = {
    "Fisch": (
        "You are 'Fisch' — a cheerful, warm-hearted fish mascot who loves weather. "
        "Your tone is friendly, witty, and occasionally uses subtle fish-themed humour. "
        "You feel like a trusted neighbourhood forecaster who always finds the bright side."
    ),
    "Merkel": (
        "You are 'Merkel' — deliver the report in the composed, measured style of Angela Merkel. "
        "Be clear, authoritative, and precise. You are reassuring and data-driven, "
        "with an occasional touch of dry German wit. Every word counts."
    ),
    "Haftbefehl": (
        "You are 'Haftbefehl' — a street-smart German rapper from Offenbach. "
        "Your delivery is punchy, energetic, and uses some urban slang naturally. "
        "You still give accurate information but with swagger, rhythm, and attitude. "
        "Keep it real, keep it moving."
    ),
}


def _build_prompt(
    data:     dict,
    person:   str,
    hobbies:  list,
    language: str,
    context:  dict | None,
) -> str:
    parts: list[str] = []

    # Persona instruction — comes first so it frames everything
    persona = _PERSONA.get(person, f"Write in the distinctive style of {person}.")
    parts.append(persona)

    # Weather data
    parts.append(
        "Generate a spoken weather narration report using this structured data "
        "(key format is zipcode_cityname — always use the city name, never the ZIP code): "
        f"{data}."
    )

    # Context-aware tone and highlights
    if context:
        parts.append(
            f"Situation: severity='{context['severity']}', "
            f"time of day='{context['time_of_day']}', "
            f"temperature feels '{context['temperature_feel']}'. "
            f"Adopt this tone: {context['tone']}."
        )
        if context.get("highlights"):
            parts.append(
                "Naturally weave these highlights into your narration: "
                + "; ".join(context["highlights"]) + "."
            )

    # Forecast instruction
    parts.append(
        "Use the 'hourly' data to briefly describe how today unfolds "
        "(morning → afternoon → evening — do not list every hour). "
        "Use 'daily_weekone' to mention what is coming over the next 1–2 days "
        "(e.g. 'tomorrow brings…'). Do not recite raw numbers — narrate like a broadcaster."
    )

    # Personalisation
    if hobbies:
        parts.append(
            f"This report is personalised for someone who loves: {', '.join(hobbies)}. "
            "Weave in a natural tip about how today's or tomorrow's weather affects "
            "one of these activities — don't just list them."
        )

    # Variation seed — prevents identical outputs across generations
    parts.append(
        f"Variation instruction: {random.choice(_VARIATION_OPENERS)} "
        f"Also: {random.choice(_VARIATION_FOCUS)}"
    )

    # Language
    parts.append(
        f"Write the entire report in the language with ISO 639-1 code '{language}'. "
        "No code-switching, no translation notes."
    )

    # Output format
    parts.append(
        "Format rules: "
        "flowing prose only — no bullet points, no headings, no numbered lists. "
        "Begin directly with the report (no 'Here is…' or acknowledgement). "
        "Length: 6–8 sentences. "
        "Structure: engaging opener → current conditions per city → "
        "today's evolving outlook → 1–2 day forecast → closing activity/lifestyle tip."
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
    Fully bilingual — DE and EN produce correctly localised text.
    """
    en = language == "en"

    _CONDITIONS = {
        "clear":         "clear skies"         if en else "klarer Himmel",
        "partly cloudy": "partly cloudy"       if en else "teils bewölkt",
        "cloudy":        "cloudy"               if en else "bewölkt",
        "overcast":      "overcast"             if en else "bedeckt",
    }

    severity_prefix = ""
    if context:
        sev = context.get("severity", "")
        if sev == "warning":
            severity_prefix = "⚠️ Weather caution today! " if en else "⚠️ Wettervorsicht heute! "
        elif sev == "cheerful":
            severity_prefix = "☀️ Gorgeous weather! "      if en else "☀️ Herrliches Wetter! "

    city_lines: list[str] = []
    for key, loc in list(data.items())[:4]:
        city  = key.split("_", 1)[1] if "_" in key else key
        cur   = loc.get("current", {})
        temp  = cur.get("temperature", "?")
        feels = cur.get("feels like", temp)
        raw   = cur.get("overcast", "")
        sky   = _CONDITIONS.get(raw, raw or ("unknown" if en else "unbekannt"))
        rain  = (", rain" if en else ", mit Niederschlag") if cur.get("current_precipitation") == "rain" else ""
        if en:
            city_lines.append(f"{city}: {temp}°C (feels like {feels}°C), {sky}{rain}")
        else:
            city_lines.append(f"{city}: {temp}°C (gefühlt {feels}°C), {sky}{rain}")

    if en:
        cities_str = " — ".join(city_lines) if city_lines else "No location data available"
        template = (
            f"{severity_prefix}Automated weather report ({person}): {cities_str}. "
            f"[AI reports are currently unavailable — Gemini daily quota exhausted. "
            f"Please generate again tomorrow.]"
        )
    else:
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
