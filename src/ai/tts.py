"""
TTS — WEATHER-FISH
===================
Converts AI-generated text to speech using Microsoft Edge TTS (neural voices).
Each presenter gets a distinct German neural voice for character differentiation.

Voice reference: https://speech.microsoft.com/portal/voicegallery
"""

import asyncio
import concurrent.futures
import os

import edge_tts

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_SPEECH_DIR = os.path.join(BASE_DIR, "..", "frontend", "public", "speech")

# SPEECH_DIR env var overrides the default path (used in Docker / HF Spaces).
# In dev, speech files land in frontend/public/speech/ so Vite serves them.
# In production, set SPEECH_DIR=/data/speech for HF persistent storage.
SPEECH_DIR = os.environ.get("SPEECH_DIR", _DEFAULT_SPEECH_DIR)

# Neural voices per presenter, per language
_VOICES_DE: dict[str, str] = {
    "Fisch":       "de-DE-KillianNeural",   # warm, friendly male
    "Merkel":      "de-DE-KatjaNeural",     # clear, authoritative female
    "Haftbefehl":  "de-DE-ConradNeural",    # punchy, urban male
}
_VOICES_EN: dict[str, str] = {
    "Fisch":       "en-GB-RyanNeural",      # friendly British male
    "Merkel":      "en-GB-SoniaNeural",     # composed British female
    "Haftbefehl":  "en-US-GuyNeural",       # punchy American male
}
DEFAULT_VOICE = "de-DE-KillianNeural"


def generate_mp3(language_code: str, text: str, person: str) -> None:
    """
    Generate an MP3 audio file from text using neural edge-tts.
    File is saved as {person}_{language_code}.mp3 (e.g. Fisch_de.mp3).

    Runs in a dedicated thread so asyncio.run() gets a clean event loop,
    avoiding conflicts with uvicorn's running loop.
    """
    voices      = _VOICES_EN if language_code == "en" else _VOICES_DE
    voice       = voices.get(person, DEFAULT_VOICE)
    os.makedirs(SPEECH_DIR, exist_ok=True)
    output_path = os.path.join(SPEECH_DIR, f"{person}_{language_code}.mp3")

    def _run_in_thread():
        asyncio.run(_generate_async(text, voice, output_path))

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            executor.submit(_run_in_thread).result(timeout=60)
        print(f"[TTS] {person} ({language_code}) -> {voice} -> {output_path}")
    except concurrent.futures.TimeoutError:
        print(f"[TTS] TIMEOUT for {person} after 60s")
    except Exception as exc:
        print(f"[TTS] ERROR for {person}: {exc}")


async def _generate_async(text: str, voice: str, output_path: str) -> None:
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)
