# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (agent/)
```bash
cd podcast-platform/agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head          # run migrations
uvicorn main:app --reload     # dev server → http://localhost:8000/docs
```

### Frontend (podcast-platform/frontend/)
```bash
cd podcast-platform/frontend
npm install
npm run dev      # → http://localhost:5173
npm run build    # tsc + vite build
```

### Local PostgreSQL
```bash
docker compose up -d   # from podcast-platform/
```

### Migrations
```bash
cd podcast-platform/agent
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## Architecture

Two independently deployed services:

- **frontend/** — React 18 + TypeScript + Vite, deployed to Vercel. Vite dev proxy forwards `/api/*` to `localhost:8000`. In production, `vercel.json` rewrites `/api/*` to the Railway backend URL.
- **agent/** — FastAPI + SQLAlchemy async (asyncpg), deployed to Railway with nixpacks. PostgreSQL is Railway-managed. Audio files live in S3/Cloudflare R2 — Railway has no persistent disk.

### API Key Flow
Users enter OpenAI and Anthropic keys in the browser. Keys are stored in `localStorage` and injected as request headers (`x-openai-key`, `x-anthropic-key`) by the Axios client interceptor in `frontend/src/api/client.ts`. The backend never stores them.

### Editing Model
Editing is non-destructive. The original audio is never modified. Each edit is an `EditOperation` row with `{op_type, payload: {start_ms, end_ms}}`. On export, `audio_pipeline.py:build_keep_segments()` replays all operations to produce a list of keep-segments, then splices with pydub + 30ms crossfades, applies noise reduction, and normalizes to -16 LUFS.

### LCS Word Diff
`frontend/src/store/index.ts:computeDeletedRanges()` converts free-text edits into time ranges. It runs a bottom-up LCS DP against the original word array (with timestamps), then traces back to find deleted word indices. This correctly handles repeated words.

### State Management
Single Zustand store at `frontend/src/store/index.ts` owns all app state: API keys, projects, recording, transcript, edit session, operations, playback position, and export status. Polling for recording transcription and export status uses `setTimeout` recursion.

### Backend Route Structure
| Router | Prefix | Responsibility |
|---|---|---|
| `projects.py` | `/projects` | Project CRUD |
| `recordings.py` | `/projects/{id}/recordings` | Upload → S3, trigger Whisper, serve audio |
| `edit_sessions.py` | `/transcripts`, `/edit-sessions`, `/exports` | Session/operation CRUD, export pipeline |
| `content.py` | `/edit-sessions/{id}/content` | Show notes + marketing copy via Claude |

### Migrations
Alembic migrations run automatically at startup via `asyncio.create_task` in `main.py:lifespan()` — they run in a background thread so uvicorn starts immediately and doesn't block health checks.

## Environment Variables (agent/)

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://podcast:podcast@localhost:5432/podcast` | Auto-set by Railway |
| `S3_BUCKET` | — | Required |
| `S3_ENDPOINT_URL` | `None` | Set for Cloudflare R2; omit for AWS S3 |
| `AWS_ACCESS_KEY_ID` | — | Required |
| `AWS_SECRET_ACCESS_KEY` | — | Required |
| `ALLOWED_ORIGINS` | `*` | Comma-separated; set to Vercel URL in prod |
