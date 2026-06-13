"""
TTS — WEATHER-FISH
===================
Converts AI-generated text to speech using Microsoft Edge TTS (neural voices).
Each presenter gets a distinct German neural voice for character differentiation.

Voice reference: https://speech.microsoft.com/portal/voicegallery
"""

import asyncio
import os

import edge_tts

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_SPEECH_DIR = os.path.join(BASE_DIR, "..", "frontend", "public", "speech")

# SPEECH_DIR env var overrides the default path (used in Docker / HF Spaces).
# In dev, speech files land in frontend/public/speech/ so Vite serves them.
# In production, set SPEECH_DIR=/data/speech for HF persistent storage.
SPEECH_DIR = os.environ.get("SPEECH_DIR", _DEFAULT_SPEECH_DIR)

# Neural voice assigned per presenter — chosen for character match
PRESENTER_VOICES: dict[str, str] = {
    "Fisch":       "de-DE-KillianNeural",   # warm, friendly male
    "Merkel":      "de-DE-KatjaNeural",     # clear, authoritative female
    "Haftbefehl":  "de-DE-ConradNeural",    # punchy, urban male
}
DEFAULT_VOICE = "de-DE-KillianNeural"


def generate_mp3(language_code: str, text: str, person: str) -> None:
    """
    Generate an MP3 audio file from text using neural edge-tts.

    Parameters
    ----------
    language_code : ISO 639 code (used as fallback if person has no mapping)
    text          : full report text
    person        : presenter name (Fisch | Merkel | Haftbefehl)
    """
    voice       = PRESENTER_VOICES.get(person, DEFAULT_VOICE)
    os.makedirs(SPEECH_DIR, exist_ok=True)
    output_path = os.path.join(SPEECH_DIR, f"{person}.mp3")

    try:
        # Create a fresh event loop to avoid conflicts with FastAPI's async loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(_generate_async(text, voice, output_path))
        loop.close()
        print(f"[TTS] {person} -> {voice} -> {output_path}")
    except Exception as exc:
        print(f"[TTS] ERROR for {person}: {exc}")


async def _generate_async(text: str, voice: str, output_path: str) -> None:
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)
