"""IntelliProctor central backend -- FastAPI ASGI application.

Run (from the backend/ directory):
    uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import auth, exams, misc, proctor, reports, ws
from .config import get_settings
from .db import dispose_engine, get_sessionmaker
from .errors import install_error_handlers
from .services import cv_client
from .services.exams import sweep_expired_sessions

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("intelliproctor")

API_PREFIX = "/api/v1"


async def _sweeper(interval: int) -> None:
    while True:
        await asyncio.sleep(interval)
        try:
            n = await sweep_expired_sessions(get_sessionmaker())
            if n:
                log.info("Force-submitted %d expired exam session(s)", n)
        except Exception as exc:  # noqa: BLE001
            log.warning("session sweeper error: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    from .config import data_dir

    log.info("Database: %s", f"SQLite ({s.database_url.split(':///')[-1]})" if s.is_sqlite else "PostgreSQL")
    log.info("Local data directory (evidence, secret key): %s", data_dir())
    if s.DB_AUTO_MIGRATE:
        from .migrate import run_migrations

        await asyncio.to_thread(run_migrations)
    if s.SEED_DEMO_DATA:
        from .seed import seed_demo_data

        await seed_demo_data()
    sweeper = asyncio.create_task(_sweeper(s.SESSION_SWEEP_INTERVAL_SECONDS))
    cv = await cv_client.health()
    log.info("Proctoring service at %s: %s", s.PROCTOR_SERVICE_URL, f"online ({cv.get('phase')})" if cv else "OFFLINE (frames will report cvOnline=false)")
    yield
    sweeper.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await sweeper
    await cv_client.close()
    await dispose_engine()


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(
        title="IntelliProctor Backend",
        version="1.0.0",
        description="Authoritative backend for IntelliProctor (see BACKEND_ARCHITECTURE.md).",
        lifespan=lifespan,
        docs_url="/docs",
        openapi_url=f"{API_PREFIX}/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_error_handlers(app)

    for r in (auth.router, exams.router, proctor.router, proctor.files_router, reports.router,
              misc.bank_router, misc.settings_router, misc.stats_router, misc.candidate_router):
        app.include_router(r, prefix=API_PREFIX)
    app.include_router(ws.router)

    @app.get("/health")
    async def health():
        cv = await cv_client.health()
        return {"status": "ok", "database": "sqlite" if s.is_sqlite else "postgresql", "cvService": "online" if cv else "offline"}

    return app


app = create_app()
