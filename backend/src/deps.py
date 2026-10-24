"""FastAPI dependencies: authentication, RBAC (section 11) and rate limiting."""

from __future__ import annotations

import hmac
import time
import uuid
from collections import defaultdict, deque
from dataclasses import dataclass

import jwt
from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .db import get_db
from .errors import ApiError
from .models import ROLE_ADMIN, ROLE_SETTER, ROLE_STUDENT, ExamSession, User
from .security import TOKEN_ACCESS, TOKEN_EXAM_SESSION, decode_token


def _bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise ApiError(401, "UNAUTHENTICATED", "Missing bearer token")
    return authorization.split(" ", 1)[1].strip()


def decode_or_401(token: str) -> dict:
    try:
        return decode_token(token)
    except jwt.ExpiredSignatureError as exc:
        raise ApiError(401, "TOKEN_EXPIRED", "Token has expired") from exc
    except jwt.PyJWTError as exc:
        raise ApiError(401, "INVALID_TOKEN", "Invalid token") from exc


async def get_current_user(
    authorization: str | None = Header(default=None), db: AsyncSession = Depends(get_db)
) -> User:
    claims = decode_or_401(_bearer(authorization))
    if claims.get("typ") != TOKEN_ACCESS:
        raise ApiError(401, "INVALID_TOKEN", "An access token is required for this endpoint")
    user = await db.get(User, uuid.UUID(claims["sub"]))
    if user is None:
        raise ApiError(401, "INVALID_TOKEN", "User no longer exists")
    return user


async def require_examiner(user: User = Depends(get_current_user)) -> User:
    if user.role not in (ROLE_SETTER, ROLE_ADMIN):
        raise ApiError(403, "FORBIDDEN", "Examiner role required")
    return user


async def require_student(user: User = Depends(get_current_user)) -> User:
    if user.role != ROLE_STUDENT:
        raise ApiError(403, "FORBIDDEN", "Examinee role required")
    return user


@dataclass
class ExamSessionContext:
    session: ExamSession
    claims: dict


async def get_exam_session_ctx(
    authorization: str | None = Header(default=None), db: AsyncSession = Depends(get_db)
) -> ExamSessionContext:
    claims = decode_or_401(_bearer(authorization))
    if claims.get("typ") != TOKEN_EXAM_SESSION:
        raise ApiError(401, "INVALID_TOKEN", "An exam session token is required (POST /exams/verify-passkey)")
    session = await db.get(ExamSession, uuid.UUID(claims["session_id"]))
    if session is None or str(session.candidate_id) != claims.get("candidate_id"):
        raise ApiError(401, "INVALID_TOKEN", "Exam session not found")
    return ExamSessionContext(session=session, claims=claims)


def is_internal_token(token: str | None) -> bool:
    expected = get_settings().INTERNAL_SERVICE_TOKEN
    return bool(token) and bool(expected) and hmac.compare_digest(token, expected)


def is_admin(user: User) -> bool:
    return user.role == ROLE_ADMIN


# ------------------------------------------------------------ rate limiting


class RateLimiter:
    """Small in-process sliding-window limiter for brute-force-sensitive
    endpoints (login, passkey verification). Per client IP."""

    def __init__(self, limit: int, window_seconds: float):
        self.limit = limit
        self.window = window_seconds
        self.hits: dict[str, deque] = defaultdict(deque)

    def __call__(self, request: Request) -> None:
        if get_settings().APP_ENV == "test":
            return
        key = request.client.host if request.client else "unknown"
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            raise ApiError(429, "RATE_LIMITED", "Too many attempts. Please wait a minute and try again.")
        q.append(now)


login_limiter = RateLimiter(limit=20, window_seconds=60)
passkey_limiter = RateLimiter(limit=30, window_seconds=60)
