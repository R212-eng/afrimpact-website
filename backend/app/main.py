from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .auth import ensure_bootstrap_admin
from .config import get_settings
from .database import SessionLocal
from .routers import admin, content, events, forms, news, opportunities

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        with SessionLocal() as db:
            ensure_bootstrap_admin(db)  # creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD
    except Exception:  # database not migrated yet — `alembic upgrade head` first
        pass
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.1.0",
    description="Backend API for the Afrimpact Consultancy website (investment & travel advisory).",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (content.router, opportunities.router, news.router, events.router, forms.router,
          admin.auth_router, admin.router):
    app.include_router(r, prefix="/api")

# Images uploaded from the admin portal
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}
