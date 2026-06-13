# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /frontend

COPY src/frontend/package*.json ./
RUN npm ci

COPY src/frontend/ ./
RUN npm run build

# ── Stage 2: Python backend ────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# System deps needed by some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY src/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Backend source modules
COPY src/backend/   ./backend/
COPY src/ai/        ./ai/
COPY src/database/  ./database/

# Frontend public assets (postal codes, mascots, etc.) needed at runtime
COPY src/frontend/public/ ./frontend/public/

# Built React app from Stage 1
COPY --from=frontend-build /frontend/dist/ ./frontend/dist/

# HF Spaces persistent storage — speech files live here at runtime
RUN mkdir -p /data/speech

# ── Runtime configuration ──────────────────────────────────────────────────────
# GEMINI_API_KEY, OPENWEATHER_API_KEY, and MONGODB_URI must be set as
# Hugging Face Space secrets (Settings → Variables and secrets).

ENV SPEECH_DIR=/data/speech
ENV PORT=7860

EXPOSE 7860

# ── Start ──────────────────────────────────────────────────────────────────────
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
