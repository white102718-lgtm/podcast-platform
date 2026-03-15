from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import projects, recordings, edit_sessions, content
from app.config import ALLOWED_ORIGINS

app = FastAPI(title="Podcast Platform Agent", version="0.1.0")

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
