"""Programmatic ``alembic upgrade head`` used at startup (DB_AUTO_MIGRATE=true)
and by the CLI. Equivalent to running ``alembic upgrade head`` in backend/."""

from __future__ import annotations

from alembic import command
from alembic.config import Config

from .config import BACKEND_DIR, get_settings


def alembic_config() -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", get_settings().database_url.replace("%", "%%"))
    return cfg


def run_migrations() -> None:
    command.upgrade(alembic_config(), "head")


if __name__ == "__main__":
    run_migrations()
    print("Database is at the latest migration.")
