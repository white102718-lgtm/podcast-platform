from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import projects, recordings, edit_sessions, content
from app.config import ALLOWED_ORIGINS


async def run_migrations():
    import subprocess, sys

    def _run():
        return subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            capture_output=True, text=True
        )

    result = await asyncio.to_thread(_run)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr)
    print(f"Migration {'complete' if result.returncode == 0 else f'failed (code {result.returncode})'}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run migrations in background so uvicorn starts immediately
    asyncio.create_task(run_migrations())
    yield


app = FastAPI(title="Podcast Platform Agent", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(recordings.router)
app.include_router(edit_sessions.router)
app.include_router(content.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
