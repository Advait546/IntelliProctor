"""Test harness: real app, real migrations, isolated database per test session.

* default: a fresh temporary SQLite file
* set TEST_DATABASE_URL=postgresql://user:pass@host/db to run the same suite on
  PostgreSQL (the schema in that database is dropped and re-created!)
"""

from __future__ import annotations

import asyncio
import os
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest
import pytest_asyncio

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

_tmp = tempfile.mkdtemp(prefix="intelliproctor-test-")
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL") or f"sqlite+aiosqlite:///{Path(_tmp, 'test.db').as_posix()}"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-" + "x" * 48
os.environ["SEED_DEMO_DATA"] = "false"
os.environ["DB_AUTO_MIGRATE"] = "false"
os.environ["REDIS_URL"] = os.environ.get("TEST_REDIS_URL", "")
os.environ["S3_ENDPOINT_URL"] = ""
os.environ["LOCAL_STORAGE_DIR"] = str(Path(_tmp, "storage"))
os.environ["INTERNAL_SERVICE_TOKEN"] = "test-internal-token"
os.environ["PROCTOR_SERVICE_URL"] = "http://127.0.0.1:9"  # nothing listens here

import httpx  # noqa: E402

from src.config import get_settings  # noqa: E402

get_settings.cache_clear()

from src import db as dbmod  # noqa: E402
from src.main import create_app  # noqa: E402
from src.migrate import run_migrations  # noqa: E402
from src.services import live_bus  # noqa: E402

INTERNAL = {"X-Internal-Token": "test-internal-token"}


def _reset_postgres(url: str) -> None:
    import sqlalchemy as sa

    sync_url = url.replace("postgresql+asyncpg://", "postgresql+psycopg2://").replace("postgresql://", "postgresql+psycopg2://")
    try:
        eng = sa.create_engine(sync_url)
    except Exception:  # psycopg2 not installed -> use asyncpg
        eng = None
    if eng is not None:
        with eng.begin() as conn:
            conn.exec_driver_sql("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
        eng.dispose()
        return

    async def _drop():
        import asyncpg

        conn = await asyncpg.connect(url.replace("postgresql+asyncpg://", "postgresql://"))
        await conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
        await conn.close()

    asyncio.run(_drop())


@pytest.fixture(scope="session", autouse=True)
def _database():
    url = get_settings().database_url
    if url.startswith("postgresql"):
        _reset_postgres(url)
    run_migrations()
    yield


@pytest_asyncio.fixture
async def client():
    live_bus.reset_for_tests()
    await dbmod.dispose_engine()
    app = create_app()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c
    await dbmod.dispose_engine()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class World:
    """Factory helpers for examiners, exams, candidates and sessions."""

    def __init__(self, client: httpx.AsyncClient):
        self.c = client

    async def examiner(self, email: str | None = None) -> str:
        from src.seed import create_user

        email = email or f"examiner-{uuid.uuid4().hex[:8]}@uni.edu"
        await create_user("Examiner " + email[:6], "password123", "setter", email=email)
        r = await self.c.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
        assert r.status_code == 200, r.text
        return r.json()["token"]

    async def exam(self, examiner_token: str, *, duration: int = 60, publish: bool = True, questions=None, settings=None) -> dict:
        questions = questions or [
            {"type": "MCQ", "text": "2+2?", "optionA": "3", "optionB": "4", "optionC": "5", "optionD": "6", "correctAnswer": "B", "marks": 2},
            {"type": "TrueFalse", "text": "The sky is blue.", "correctAnswer": "A", "marks": 1},
            {"type": "FillBlank", "text": "Capital of France?", "correctAnswer": "Paris", "marks": 2},
            {"type": "Subjective", "text": "Explain overfitting.", "marks": 5},
        ]
        r = await self.c.post(
            "/api/v1/exams",
            headers={"Authorization": f"Bearer {examiner_token}"},
            json={"title": "Test Exam", "subject": "CS", "durationMinutes": duration, "questions": questions, "publish": publish, "settings": settings or {}},
        )
        assert r.status_code == 201, r.text
        return r.json()

    async def candidate(self, prn: str | None = None, name: str = "Candidate") -> str:
        prn = prn or f"PRN-{uuid.uuid4().hex[:8]}"
        r = await self.c.post("/api/v1/auth/candidate/login", json={"candidateId": prn, "password": "student123", "fullName": name})
        assert r.status_code == 200, r.text
        return r.json()["token"]

    async def session(self, passkey: str, candidate_token: str | None = None) -> dict:
        candidate_token = candidate_token or await self.candidate()
        r = await self.c.post("/api/v1/exams/verify-passkey", headers={"Authorization": f"Bearer {candidate_token}"}, json={"passkey": passkey})
        assert r.status_code == 200, r.text
        d = r.json()
        return {"token": d["sessionToken"], "id": d["session"]["sessionId"], "examId": d["exam"]["id"], "candidateToken": candidate_token}

    async def event(self, session_id: str, event_type: str, episode_id: str | None = None, **extra) -> httpx.Response:
        source = {
            "PHONE_DETECTED": "YOLO_CV",
            "BOOK_DETECTED": "YOLO_CV",
            "HEAD_TURN_SIDEWAYS": "MEDIAPIPE_HEAD_POSE",
            "CANDIDATE_ABSENT": "MEDIAPIPE_FACE_COUNT",
            "MULTIPLE_FACES": "MEDIAPIPE_FACE_COUNT",
            "TAB_BLUR": "BROWSER_VISIBILITY",
            "TAB_FOCUS": "BROWSER_VISIBILITY",
        }[event_type]
        body = {
            "sessionId": session_id,
            "episodeId": episode_id or f"ep-{uuid.uuid4().hex}",
            "source": source,
            "eventType": event_type,
            "timestamp": now_iso(),
            **extra,
        }
        return await self.c.post("/api/v1/proctor/events", headers=INTERNAL, json=body)

    async def score(self, session_id: str) -> tuple[int, bool]:
        from src.models import ExamSession

        async with dbmod.get_sessionmaker()() as db:
            s = await db.get(ExamSession, uuid.UUID(session_id))
            return s.current_suspicion_score, s.is_suspicious


@pytest_asyncio.fixture
async def world(client) -> World:
    return World(client)


@pytest_asyncio.fixture
async def live(world) -> dict:
    """An examiner + published exam + one in-progress candidate session."""
    et = await world.examiner()
    exam = await world.exam(et)
    sess = await world.session(exam["passkey"])
    return {"examinerToken": et, "exam": exam, "session": sess}
