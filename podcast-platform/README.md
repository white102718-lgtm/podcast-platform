# Podcast Platform

One-stop podcast creation platform. Upload audio → AI transcription → text-driven editing → export.

## Architecture

```
frontend/   React + TypeScript (Vite) — deploy to Vercel
agent/      FastAPI + Python — deploy to Railway
            PostgreSQL provided by Railway
            Audio files stored in S3 / Cloudflare R2
```

Users enter their own OpenAI and Anthropic API keys in the browser. Keys are stored in localStorage and sent as request headers — never stored on the server.

---

## Cloud Deployment (Production)

### 1. Object Storage — Cloudflare R2 (recommended, free tier)

1. Create an R2 bucket at dash.cloudflare.com
2. Create an API token with R2 read/write permissions
3. Note: bucket name, account ID, access key ID, secret access key

### 2. Deploy backend to Railway

1. Create a new Railway project
2. Add a **PostgreSQL** plugin — Railway sets `DATABASE_URL` automatically
3. Connect your GitHub repo, set the **Root Directory** to `agent/`
4. Set environment variables:

```
DATABASE_URL          (auto-set by Railway PostgreSQL plugin)
S3_BUCKET             your-r2-bucket-name
S3_ENDPOINT_URL       https://<account-id>.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID     your-r2-access-key-id
AWS_SECRET_ACCESS_KEY your-r2-secret-access-key
ALLOWED_ORIGINS       https://your-app.vercel.app
```

5. Railway will build using `agent/Dockerfile` and run migrations + uvicorn automatically.
6. Note your Railway public URL (e.g. `https://podcast-agent.up.railway.app`)

### 3. Deploy frontend to Vercel

1. Import your GitHub repo on vercel.com, set **Root Directory** to `frontend/`
2. Set environment variable:

```
VITE_API_BASE_URL     https://podcast-agent.up.railway.app
```

3. Deploy — Vercel builds with `npm run build` automatically.

### 4. Update CORS

Set `ALLOWED_ORIGINS` on Railway to your Vercel URL:
```
ALLOWED_ORIGINS=https://your-app.vercel.app
```

---

## Local Development

### Prerequisites
- Docker (for PostgreSQL)
- Python 3.11+
- Node.js 18+
- An S3-compatible bucket (or use [MinIO](https://min.io) locally)

### 1. Start PostgreSQL

```bash
docker compose up -d
```

### 2. Backend

```bash
cd agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Fill in S3_BUCKET, S3_ENDPOINT_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

alembic upgrade head
uvicorn main:app --reload
# → http://localhost:8000/docs
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Set VITE_API_BASE_URL=http://localhost:8000

npm run dev
# → http://localhost:5173
```

---

## Usage

1. Open the app URL
2. Click **⚙ Set API Keys** and enter your OpenAI + Anthropic keys (saved in browser only)
3. Create a project, upload an audio file
4. Wait for transcription (Whisper API)
5. Edit the transcript — deleted text = audio cut on export
6. **Remove Fillers** auto-cuts 嗯/啊/um/uh; **Cut Silences** auto-detects long pauses
7. **Export MP3** renders the final audio with noise reduction + -16 LUFS normalization
8. Optionally generate Show Notes or Marketing Copy via Claude

---

## Project Structure

```
agent/
  Dockerfile                      Production container (includes ffmpeg)
  railway.toml                    Railway deployment config
  main.py                         FastAPI app entry point
  app/
    config.py                     Env vars (DB, S3, CORS)
    db/database.py                SQLAlchemy async engine
    db/migrations/                Alembic migrations
    models/models.py              ORM models
    api/routes/
      projects.py                 Project CRUD
      recordings.py               Upload → S3, transcribe, serve audio
      edit_sessions.py            Non-destructive edit operations + export
      content.py                  Show notes + marketing copy (Claude)
    services/
      storage.py                  S3/R2 upload, download, presign
      whisper.py                  OpenAI Whisper API (word-level timestamps)
      audio_pipeline.py           Splice, crossfade, noise reduction, loudness

frontend/
  vercel.json                     Vercel deployment config
  src/
    types/index.ts                Shared TypeScript types
    api/client.ts                 Axios client + API key header interceptor
    store/index.ts                Zustand state + LCS word diff
    components/
      ApiKeySettings/             API key modal (localStorage)
      ProjectList/                Project list + create
      RecordingUploader/          Drag-drop upload + transcription polling
      TranscriptEditor/           Word tokens, editable textarea, autosave
      WaveformViewer/             wavesurfer.js + cut region overlays
      ExportPanel/                Export trigger + content generation
```

## Key Design Decisions

- **No server-side API keys**: OpenAI/Anthropic keys travel as request headers from the browser, never stored on the server.
- **S3 for all audio**: Railway has no persistent disk. All audio (uploads + exports) lives in S3/R2. The backend uses presigned URLs so the browser streams audio directly from S3.
- **Non-destructive editing**: original audio is never modified. Every edit is an `edit_operations` row with `{start_ms, end_ms}`. Export replays operations to build a keep-segments list, splices with pydub + 30ms crossfades.
- **LCS word diff**: deleting text in the editor runs a bottom-up LCS diff against the original word array to find exact deleted time ranges — handles repeated words correctly.
