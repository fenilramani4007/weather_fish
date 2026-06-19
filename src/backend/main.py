from dotenv import load_dotenv
load_dotenv()  # Must be first — loads .env before any module reads os.environ

import os
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import uvicorn

from apscheduler.schedulers.background import BackgroundScheduler

from backend import api
from backend.auth import (
    hash_password, verify_password, create_token,
    get_current_user, optional_user,
)
from database import mongo
from ai import chat as ai_chat

# ── Paths ──────────────────────────────────────────────────────────────────────

_HERE      = os.path.dirname(os.path.abspath(__file__))
DIST_DIR   = os.path.join(_HERE, "..", "frontend", "dist")    # React production build
PUBLIC_DIR = os.path.join(_HERE, "..", "frontend", "public")  # Dev static assets
SPEECH_DIR = os.environ.get(
    "SPEECH_DIR",
    os.path.join(PUBLIC_DIR, "speech"),  # override with /data/speech on HF Spaces
)
PORT = int(os.environ.get("PORT", 8000))

os.makedirs(SPEECH_DIR, exist_ok=True)

# ── APScheduler ──────────────────────────────────────────────────────────────

scheduler = BackgroundScheduler(timezone="UTC")
_last_scheduled_run: datetime | None = None
_last_scheduled_status: str = "never"


def _scheduled_generation():
    """Hourly job: regenerate reports for every location stored in MongoDB."""
    global _last_scheduled_run, _last_scheduled_status
    _last_scheduled_run = datetime.now(timezone.utc)
    try:
        locations = mongo.get_all_locations()
        if not locations:
            _last_scheduled_status = "skipped — no locations saved"
            print("[Scheduler] No locations — skipping generation")
            return
        zipcodes = [loc["zipcode"] for loc in locations]
        cities   = [loc["city"]    for loc in locations]
        print(f"[Scheduler] Auto-generating for {zipcodes}")
        api.get_all_weather_data(cities=cities, zipcodes=zipcodes, language="de")
        _last_scheduled_status = f"ok — {len(zipcodes)} location(s)"
        print(f"[Scheduler] Done — {len(zipcodes)} location(s)")
    except Exception as exc:
        _last_scheduled_status = f"error — {exc}"
        print(f"[Scheduler] ERROR: {exc}")


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    if mongo.ping():
        print("[MongoDB] Connected to", mongo._masked_uri(mongo.MONGODB_URI))
    else:
        print("[MongoDB] WARNING: cannot reach MongoDB")

    scheduler.add_job(_scheduled_generation, "interval", hours=1, id="hourly_generation")
    scheduler.start()
    print("[Scheduler] Started — hourly weather generation enabled")

    yield

    scheduler.shutdown(wait=False)
    print("[Scheduler] Stopped")
    mongo.close()
    print("[MongoDB] Connection closed")


# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="WEATHER-FISH API",
    description="KI-gestützte Wetterberichte — OTH Amberg-Weiden",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── GET /api/info ─────────────────────────────────────────────────────────────

@app.get("/api/info")
def api_info():
    """API overview — lists all available endpoints."""
    return {
        "app": "WEATHER-FISH API",
        "version": "2.0.0",
        "docs": "/docs",
        "endpoints": {
            "POST /generate-documents":        "Run full pipeline (geocode → weather → AI → TTS)",
            "GET  /api/weather/{zipcode}":     "Latest structured weather from MongoDB",
            "GET  /api/report/{presenter}":    "AI text report (Fisch | Merkel | Haftbefehl)",
            "GET  /api/locations":             "All saved locations",
            "DELETE /api/locations/{zipcode}": "Remove a location",
            "GET  /api/status":                "MongoDB health check + data counts",
            "GET  /speech/{filename}":         "Serve TTS audio file",
        },
    }


# ── POST /generate-documents ──────────────────────────────────────────────────

@app.post("/generate-documents")
async def generate_documents(
    request: Request,
    user_payload: dict | None = Depends(optional_user),
):
    """Trigger the full pipeline for one or more German zip codes."""
    try:
        payload   = await request.json()
        cities    = payload.get("cities", [])
        zipcodes  = payload.get("zipcodes", [])
        person    = payload.get("person", "")
        hobbies   = payload.get("hobbies", [])
        language  = payload.get("language", "de")
        languages = payload.get("languages", ["de", "en"])

        print(f"[Pipeline] Generating for zipcodes={zipcodes}, cities={cities}, languages={languages}")
        api.get_all_weather_data(cities, zipcodes, person, hobbies, language, languages)

        # Log activity for authenticated users
        if user_payload and zipcodes and cities:
            try:
                mongo.log_activity(
                    user_id=user_payload["sub"],
                    city=cities[0],
                    zipcode=zipcodes[0],
                    hobbies=hobbies,
                )
            except Exception as exc:
                print(f"[Activity] WARNING: could not log activity — {exc}")

        return {"status": "success", "message": "Wetterdaten wurden erzeugt."}

    except Exception as exc:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(exc)}


# ── GET /api/weather/{zipcode} ────────────────────────────────────────────────

@app.get("/api/weather/{zipcode}")
def get_weather(zipcode: str):
    doc = mongo.get_weather(zipcode)
    if doc is None:
        raise HTTPException(
            status_code=404,
            detail=f"Keine Wetterdaten für PLZ {zipcode}. Bitte POST /generate-documents aufrufen."
        )
    if "fetched_at" in doc and hasattr(doc["fetched_at"], "isoformat"):
        doc["fetched_at"] = doc["fetched_at"].isoformat()
    return doc


# ── GET /api/report/{presenter} ───────────────────────────────────────────────

@app.get("/api/report/{presenter}")
def get_report(presenter: str, lang: str = "de"):
    doc = mongo.get_report(presenter, lang)
    if doc is None:
        raise HTTPException(
            status_code=404,
            detail=f"Kein Bericht für {presenter}/{lang}. Bitte POST /generate-documents aufrufen."
        )
    if "generated_at" in doc and hasattr(doc["generated_at"], "isoformat"):
        doc["generated_at"] = doc["generated_at"].isoformat()
    return doc


# ── GET /api/locations ────────────────────────────────────────────────────────

@app.get("/api/locations")
def get_locations():
    locations = mongo.get_all_locations()
    for loc in locations:
        for key in ("added_at", "last_seen"):
            if key in loc and hasattr(loc[key], "isoformat"):
                loc[key] = loc[key].isoformat()
    return {"locations": locations, "count": len(locations)}


# ── DELETE /api/locations/{zipcode} ──────────────────────────────────────────

@app.delete("/api/locations/{zipcode}")
def delete_location(zipcode: str):
    deleted = mongo.delete_location(zipcode)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"PLZ {zipcode} nicht gefunden.")
    return {"status": "deleted", "zipcode": zipcode}


# ── GET /api/status ───────────────────────────────────────────────────────────

@app.get("/api/status")
def get_status():
    db_ok = mongo.ping()
    return {
        "status":      "ok",
        "mongodb":     "connected" if db_ok else "unreachable",
        "mongodb_uri": mongo._masked_uri(mongo.MONGODB_URI),
        "snapshots":   len(mongo.get_all_weather())    if db_ok else None,
        "reports":     len(mongo.get_all_reports())    if db_ok else None,
        "locations":   len(mongo.get_all_locations())  if db_ok else None,
    }


# ── POST /api/schedule/run ────────────────────────────────────────────────────

@app.post("/api/schedule/run")
def schedule_run():
    import threading
    threading.Thread(target=_scheduled_generation, daemon=True).start()
    return {"status": "triggered", "message": "Scheduled generation started in background."}


# ── GET /api/schedule/status ──────────────────────────────────────────────────

@app.get("/api/schedule/status")
def schedule_status():
    job = scheduler.get_job("hourly_generation")
    next_run = job.next_run_time.isoformat() if job and job.next_run_time else None
    return {
        "scheduler":   "running" if scheduler.running else "stopped",
        "next_run":    next_run,
        "last_run":    _last_scheduled_run.isoformat() if _last_scheduled_run else None,
        "last_status": _last_scheduled_status,
    }


# ── GET /api/history/{zipcode} ───────────────────────────────────────────────

@app.get("/api/history/{zipcode}")
def get_history(zipcode: str, days: int = 14):
    """Return weather history records for a location (last N days, default 14)."""
    days = max(1, min(days, 90))
    records = mongo.get_history(zipcode, days)
    for r in records:
        if "recorded_at" in r and hasattr(r["recorded_at"], "isoformat"):
            r["recorded_at"] = r["recorded_at"].isoformat()
    return {"zipcode": zipcode, "days": days, "count": len(records), "records": records}


# ── POST /api/auth/register ───────────────────────────────────────────────────

@app.post("/api/auth/register")
async def register(request: Request):
    body = await request.json()
    email    = (body.get("email") or "").strip().lower()
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""

    if not email or not username or not password:
        raise HTTPException(status_code=400, detail="email, username and password are required")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if mongo.get_user_by_email(email):
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = mongo.create_user(email, username, hash_password(password))
    token   = create_token(user_id, email)
    return {"token": token, "user": {"id": user_id, "email": email, "username": username, "hobbies": []}}


# ── POST /api/auth/login ──────────────────────────────────────────────────────

@app.post("/api/auth/login")
async def login(request: Request):
    body = await request.json()
    email    = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    user = mongo.get_user_by_email(email)
    if not user or not verify_password(password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user["_id"])
    token   = create_token(user_id, email)
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": user["email"],
            "username": user["username"],
            "hobbies": user.get("hobbies", []),
        },
    }


# ── GET /api/auth/me ──────────────────────────────────────────────────────────

@app.get("/api/auth/me")
async def me(current: dict = Depends(get_current_user)):
    user = mongo.get_user_by_id(current["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user["id"] = str(user.pop("_id", current["sub"]))
    if "created_at" in user and hasattr(user["created_at"], "isoformat"):
        user["created_at"] = user["created_at"].isoformat()
    return user


# ── PUT /api/auth/profile ─────────────────────────────────────────────────────

@app.put("/api/auth/profile")
async def update_profile(request: Request, current: dict = Depends(get_current_user)):
    body = await request.json()
    updates: dict = {}
    if "username" in body and body["username"].strip():
        updates["username"] = body["username"].strip()
    if "hobbies" in body and isinstance(body["hobbies"], list):
        updates["hobbies"] = body["hobbies"]
    if updates:
        mongo.update_user(current["sub"], updates)
    user = mongo.get_user_by_id(current["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user["id"] = str(user.pop("_id", current["sub"]))
    if "created_at" in user and hasattr(user["created_at"], "isoformat"):
        user["created_at"] = user["created_at"].isoformat()
    return user


# ── GET /api/activity/history ─────────────────────────────────────────────────

@app.get("/api/activity/history")
async def activity_history(days: int = 30, current: dict = Depends(get_current_user)):
    days = max(1, min(days, 90))
    records = mongo.get_user_activities(current["sub"], days)
    for r in records:
        if "timestamp" in r and hasattr(r["timestamp"], "isoformat"):
            r["timestamp"] = r["timestamp"].isoformat()
    return {"count": len(records), "records": records}


# ── GET /api/chat/debug ───────────────────────────────────────────────────────

@app.get("/api/chat/debug")
def chat_debug():
    """Returns chat module internal state — helps diagnose API key / client issues."""
    key = os.environ.get("GEMINI_API_KEY", "")
    return {
        "gemini_key_set":    bool(key),
        "gemini_key_length": len(key),
        "chat_client_ready": ai_chat._client is not None,
    }


# ── POST /api/chat ───────────────────────────────────────────────────────────

@app.post("/api/chat")
async def chat_endpoint(request: Request):
    """AI weather assistant — context-grounded conversational replies."""
    try:
        payload  = await request.json()
        message  = payload.get("message", "").strip()
        zipcode  = payload.get("zipcode", "")
        history  = payload.get("history", [])
        language = payload.get("language", "de")

        if not message:
            raise HTTPException(status_code=400, detail="message is required")

        weather_ctx = mongo.get_weather(zipcode) if zipcode else None
        reply = ai_chat.reply(message, history, weather_ctx, language)
        return {"reply": reply}

    except HTTPException:
        raise
    except Exception as exc:
        print(f"[Chat] endpoint error: {exc}")
        return {"reply": "Entschuldigung, ein Fehler ist aufgetreten."}


# ── GET /speech/{filename} ────────────────────────────────────────────────────
# Serves runtime-generated TTS audio files. Path configurable via SPEECH_DIR env var.

@app.get("/speech/{filename}")
def serve_speech(filename: str):
    if not filename.endswith(".mp3") or "/" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
    file_path = os.path.join(SPEECH_DIR, filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail=f"Audio not found: {filename}")
    return FileResponse(file_path, media_type="audio/mpeg")


# ── Production: serve React SPA ───────────────────────────────────────────────
# Only active when the Vite build exists (Docker / HF Spaces).
# Dev mode: files are served by Vite's own dev server.

if os.path.isdir(DIST_DIR):
    print(f"[Static] Serving React build from {DIST_DIR}")

    # Vite-compiled assets (hashed filenames, e.g. index-Abc123.js)
    _assets = os.path.join(DIST_DIR, "assets")
    if os.path.isdir(_assets):
        app.mount("/assets", StaticFiles(directory=_assets), name="vite-assets")

    # Public static dirs bundled into dist by Vite
    for _subdir in ("postal_codes", "data", "mascots"):
        _path = os.path.join(DIST_DIR, _subdir)
        if os.path.isdir(_path):
            app.mount(f"/{_subdir}", StaticFiles(directory=_path), name=_subdir)

    # SPA catch-all — MUST be defined last so API routes take precedence
    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_catchall(full_path: str):
        # Serve the file directly if it exists in dist
        candidate = os.path.join(DIST_DIR, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        # Fall back to index.html for client-side routing
        return FileResponse(os.path.join(DIST_DIR, "index.html"))
else:
    # Development fallback root
    @app.get("/")
    def root():
        return {"app": "WEATHER-FISH API v2.0", "mode": "development", "docs": "/docs"}


if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=PORT, reload=True)
