# 🎙 PodCraft - AI 播客编辑平台

一站式播客创作平台：上传音频 → AI 转录 → 智能编辑 → 一键导出

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com)

## ✨ 新版本亮点 (v2.0.0)

### 🎨 全新三栏工作台
- **左侧边栏**：项目导航，一键切换
- **中间编辑区**：词级标注 + 波形图，一屏完成所有编辑
- **右侧操作面板**：快捷操作、音频增强、编辑统计、AI 生成

### 🎚 音频增强功能（新增）
- **录音室级 EQ**：专业均衡器调节
- **音频平衡**：自动调节高低音

### 🎵 波形图增强
- 播放/暂停控制
- 时间显示
- 缩放控制（+ / −）
- 高度可调（60px - 200px）

### 📊 实时编辑统计
- 剪切次数统计
- 节省时间计算
- 时长对比（原始 vs 剪辑后）

## 🏗️ 架构

```
frontend/   React 18 + TypeScript + Vite + Tailwind CSS
            → 部署到 Vercel

agent/      FastAPI + Python + SQLAlchemy
            → 部署到 Railway
            → PostgreSQL (Railway 提供)
            → 音频文件存储在 S3 / Cloudflare R2
```

**安全设计**：用户在浏览器中输入自己的 OpenAI 和 Anthropic API 密钥。密钥存储在 localStorage 中，通过请求头发送 — 服务器永不存储。

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

5. Railway will build using nixpacks and run migrations + uvicorn automatically.
6. Note your Railway public URL (e.g. `https://podcast-agent.up.railway.app`)

### 3. Deploy frontend to Vercel

1. Update `frontend/vercel.json` — replace the destination with your Railway URL:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-backend.up.railway.app/:path*"
    }
  ]
}
```

2. Import your GitHub repo on vercel.com, set **Root Directory** to `frontend/`
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
npm run dev
# → http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:8000` automatically — no `.env.local` needed for local dev.

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
