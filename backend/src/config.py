"""Environment configuration (BACKEND_ARCHITECTURE.md section 20.2).

Every setting has a working local-development default so the backend boots with
zero configuration:

* DATABASE_URL unset  -> SQLite file at backend/intelliproctor.db
* REDIS_URL unset     -> in-process pub/sub + idempotency cache
* S3_* unset          -> local private evidence directory (backend/storage/) with
                         HMAC-signed, 15-minute URLs
* JWT_SECRET_KEY unset -> a random key generated once and kept in backend/.secret_key
"""

from __future__ import annotations

import os
import secrets
import sys
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


def data_dir() -> Path:
    """Where local runtime data lives (SQLite file, evidence images, generated
    secret). DATA_DIR overrides. On Windows the default is
    %LOCALAPPDATA%\\IntelliProctor so the database and sensitive evidence
    images are never synced by OneDrive (the repo often lives in a synced folder)."""
    explicit = os.environ.get("DATA_DIR", "").strip()
    if explicit:
        path = Path(explicit)
    elif sys.platform == "win32" and os.environ.get("LOCALAPPDATA"):
        path = Path(os.environ["LOCALAPPDATA"]) / "IntelliProctor"
    else:
        path = BACKEND_DIR / "data"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _default_sqlite_url() -> str:
    return f"sqlite+aiosqlite:///{(data_dir() / 'intelliproctor.db').as_posix()}"


def _persistent_secret() -> str:
    path = data_dir() / ".secret_key"
    if path.exists():
        value = path.read_text(encoding="utf-8").strip()
        if value:
            return value
    value = secrets.token_urlsafe(64)
    path.write_text(value, encoding="utf-8")
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    APP_ENV: str = "development"
    PORT: int = 8000

    DATABASE_URL: str = ""
    DB_AUTO_MIGRATE: bool = True
    DB_ECHO: bool = False

    REDIS_URL: str = ""

    S3_ENDPOINT_URL: str = ""
    S3_BUCKET_EVIDENCE: str = "intelliproctor-evidence"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_REGION: str = "us-east-1"
    # "AES256" on AWS S3 (section 18.1). Leave empty for a default MinIO
    # container, which rejects SSE requests unless a KMS is configured.
    S3_SERVER_SIDE_ENCRYPTION: str = ""
    LOCAL_STORAGE_DIR: str = ""

    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_MINUTES: int = 15
    REFRESH_TOKEN_DAYS: int = 7
    COOKIE_SECURE: bool = False

    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    PROCTOR_SERVICE_URL: str = "http://localhost:8001"
    PROCTOR_SERVICE_TIMEOUT_SECONDS: float = 15.0
    # Shared secret for service-to-service calls (backend <-> proctoring-service,
    # and external CV workers posting to POST /api/v1/proctor/events).
    INTERNAL_SERVICE_TOKEN: str = "dev-internal-token-change-me"

    SEED_DEMO_DATA: bool = True
    ALLOW_EXAMINER_SIGNUP: bool = False

    EVIDENCE_URL_TTL_SECONDS: int = 900
    CLOCK_SKEW_TOLERANCE_SECONDS: int = 30
    TAB_TIMING_DISCREPANCY_SECONDS: float = 3.0
    EXAM_DEFAULT_AVAILABILITY_HOURS: int = 24
    SESSION_SWEEP_INTERVAL_SECONDS: int = 30

    @property
    def database_url(self) -> str:
        url = self.DATABASE_URL.strip() or _default_sqlite_url()
        # Accept plain postgres:// URLs (Supabase/Heroku style) and upgrade them
        # to the asyncpg driver SQLAlchemy needs.
        if url.startswith("postgres://"):
            url = "postgresql+asyncpg://" + url[len("postgres://") :]
        elif url.startswith("postgresql://"):
            url = "postgresql+asyncpg://" + url[len("postgresql://") :]
        elif url.startswith("sqlite:///"):
            url = "sqlite+aiosqlite:///" + url[len("sqlite:///") :]
        return url

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def jwt_secret(self) -> str:
        return self.JWT_SECRET_KEY.strip() or _persistent_secret()

    @property
    def storage_dir(self) -> Path:
        path = Path(self.LOCAL_STORAGE_DIR) if self.LOCAL_STORAGE_DIR else data_dir() / "storage"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def s3_enabled(self) -> bool:
        return bool(self.S3_ENDPOINT_URL and self.S3_ACCESS_KEY and self.S3_SECRET_KEY)

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
