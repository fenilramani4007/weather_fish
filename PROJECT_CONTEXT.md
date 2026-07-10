# WeatherFish — Context for Claude

Paste this file's contents into a new conversation to recall this project's
state without re-explaining it. (Snapshot date: 2026-07-10 — check it
against the current code if much time has passed.)

## What this is

WeatherFish is a personalized, conversational weather platform, built to
satisfy the project definition in `Industry_4_0_Project_Defination (2).pdf`
(a university team project, OTH Amberg-Weiden). It replaces a described
legacy React+Flask prototype (which had bugs: blocking `alert()`, in-memory-only
locations, hardcoded keys, parallel-list city/ZIP mapping, Germany-only
geocoding, local-disk TTS files) — built fresh rather than migrated, per an
explicit decision early in the project.

## Stack & layout

- `backend/` — FastAPI + SQLAlchemy (SQLite). Venv at `backend/venv`.
- `frontend/` — React + TypeScript + Vite, `react-router-dom` + `react-toastify` + `axios`.
- Root `Dockerfile` — single-container build (frontend → static assets served by FastAPI) for HuggingFace Spaces, port 7860.
- `backend/tests/` — 28 passing pytest tests.

## What's implemented (full project scope, not just MVP)

- JWT auth: register/login/me/profile update, password reset (request+confirm; token returned directly in the API response since no SMTP is wired up — see `EXPOSE_PASSWORD_RESET_TOKEN`)
- Dictionary-based international geocoding via Open-Meteo Geocoding API (fixes the original parallel-list bug)
- Weather + Air Quality Index via Open-Meteo, with coordinate-fallback retry logic, plus a public `/weather/global-trends` endpoint
- Listener Profile (tone: Formal/Funny/Casual, language: en/de, age group) that actually shapes generated report text, including translated weather descriptions
- Pluggable LLM report generation (set `ANTHROPIC_API_KEY` to enable; falls back to a deterministic template) with a quality-metrics endpoint
- edge-tts multi-voice audio, cached in the DB by `(text, voice)` hash — **must use `edge-tts>=7.x`, older 6.x pinned versions get 403'd by Microsoft's endpoint**
- Shareable public report links (no login required to view), snapshotting the owner's profile at share time
- APScheduler hourly job pre-generating cached audio for all saved locations
- Frontend: guest/member-adaptive landing page + Global Trends widget, dashboard (search/save locations, hourly/7-day/AQI), Profile settings page, forgot/reset password pages, public shared-report page, toast notifications throughout (no native `alert()`)

## Explicitly out of scope (documented in README, not gaps)

- Real email delivery for password reset
- Actually deploying to a live HuggingFace Space (Dockerfile is ready, unpushed)
- Project poster / technical comparison table (academic, non-code deliverables)

## Environment gotchas worth remembering

- `passlib[bcrypt]==1.7.4` breaks with `bcrypt>=4.1` — pin `bcrypt==4.0.1`
- This is Windows + git-bash: native `venv/Scripts/python.exe` can't read MSYS virtual paths like `/tmp` — use a real Windows-mapped path instead
- No `chromium-cli` here; Playwright + Chromium were installed manually into the scratchpad dir for browser verification

## How I like this project run

I ask for the app to actually be started and demonstrated running (backend
`uvicorn` + frontend `npm run dev`, health-checked, and for UI changes,
driven through a real browser) — not just described as implemented.

## How to run it

```bash
# backend
cd backend && ./venv/Scripts/activate && uvicorn app.main:app --reload --port 8000
# frontend
cd frontend && npm run dev
```

Full details in the repo's own `README.md`.
