"""Authentication & identity (sections 11.1-11.2).

* Argon2id password hashing
* 15-minute access JWT (Authorization: Bearer)
* 7-day refresh token in an HttpOnly, SameSite=Strict cookie, rotated on every
  use; presenting an already-rotated token revokes the whole token family
  (reuse detection).
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import timedelta

from fastapi import APIRouter, Cookie, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_db, utcnow
from ..deps import get_current_user, login_limiter
from ..errors import ApiError
from ..models import ROLE_ADMIN, ROLE_SETTER, ROLE_STUDENT, RefreshToken, User
from ..schemas import LoginRequest, RegisterRequest
from ..security import create_access_token, hash_password, hash_refresh_token, new_refresh_token, verify_password
from ..services.views import iso

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "ip_refresh"
REFRESH_PATH = "/api/v1/auth"


def user_to_ui(user: User) -> dict:
    return {
        "id": str(user.user_id),
        "userId": str(user.user_id),
        "email": user.email,
        "name": user.full_name,
        "fullName": user.full_name,
        "role": user.role,
        "institution": user.institution,
        "candidateId": user.candidate_id_number,
        "rollNumber": user.candidate_id_number,
        "hasReferencePhoto": bool(user.reference_photo_s3_key),
        "createdAt": iso(user.created_at),
    }


def candidate_email(candidate_id: str) -> str:
    slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in candidate_id).strip("-") or uuid.uuid4().hex[:8]
    return f"{slug}@candidates.intelliproctor.local"


async def _issue_tokens(db: AsyncSession, response: Response, user: User, family: uuid.UUID | None = None) -> dict:
    s = get_settings()
    access, expires = create_access_token(user.user_id, user.role, user.email)
    raw, digest = new_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.user_id,
            family_id=family or uuid.uuid4(),
            token_hash=digest,
            expires_at=utcnow() + timedelta(days=s.REFRESH_TOKEN_DAYS),
        )
    )
    await db.commit()
    response.set_cookie(
        REFRESH_COOKIE,
        raw,
        max_age=s.REFRESH_TOKEN_DAYS * 86400,
        httponly=True,
        secure=s.COOKIE_SECURE,
        samesite="strict",
        path=REFRESH_PATH,
    )
    return {
        "token": access,
        "accessToken": access,
        "tokenType": "bearer",
        "expiresAt": iso(expires),
        "user": user_to_ui(user),
    }


async def _find_user(db: AsyncSession, email: str | None, candidate_id: str | None) -> User | None:
    if email:
        user = (await db.execute(select(User).where(func.lower(User.email) == email.strip().lower()))).scalar_one_or_none()
        if user:
            return user
    if candidate_id:
        return (
            await db.execute(select(User).where(func.lower(User.candidate_id_number) == candidate_id.strip().lower()))
        ).scalar_one_or_none()
    return None


async def _create_user(db: AsyncSession, body: RegisterRequest) -> User:
    s = get_settings()
    if body.role == ROLE_SETTER and not s.ALLOW_EXAMINER_SIGNUP:
        any_examiner = (await db.execute(select(User.user_id).where(User.role.in_((ROLE_SETTER, ROLE_ADMIN))).limit(1))).first()
        if any_examiner:
            raise ApiError(403, "EXAMINER_SIGNUP_DISABLED", "Examiner self-registration is disabled. Ask an administrator.")
    if await _find_user(db, body.email, body.candidateId):
        raise ApiError(409, "ACCOUNT_EXISTS", "An account with this email / candidate ID already exists")
    user = User(
        email=(body.email or candidate_email(body.candidateId)).strip().lower(),
        password_hash=await asyncio.to_thread(hash_password, body.password),
        full_name=body.fullName.strip(),
        role=body.role,
        institution=body.institution,
        candidate_id_number=body.candidateId.strip() if body.candidateId else None,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise ApiError(409, "ACCOUNT_EXISTS", "An account with this email / candidate ID already exists") from exc
    return user


@router.post("/register", status_code=201, dependencies=[Depends(login_limiter)])
async def register(body: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    user = await _create_user(db, body)
    return await _issue_tokens(db, response, user)


async def _login(db: AsyncSession, response: Response, body: LoginRequest, required_roles: set[str] | None) -> dict:
    user = await _find_user(db, body.email, body.candidateId)
    ok = user is not None and await asyncio.to_thread(verify_password, body.password, user.password_hash)
    if not ok:
        raise ApiError(401, "INVALID_CREDENTIALS", "Incorrect credentials")
    if required_roles and user.role not in required_roles:
        raise ApiError(403, "WRONG_PORTAL", "This account cannot sign in to this portal")
    return await _issue_tokens(db, response, user)


@router.post("/login", dependencies=[Depends(login_limiter)])
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    roles = None
    if body.role == "setter":
        roles = {ROLE_SETTER, ROLE_ADMIN}
    elif body.role == "student":
        roles = {ROLE_STUDENT}
    return await _login(db, response, body, roles)


@router.post("/examiner/login", dependencies=[Depends(login_limiter)])
async def examiner_login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    return await _login(db, response, body, {ROLE_SETTER, ROLE_ADMIN})


class CandidateLoginRequest(BaseModel):
    candidateId: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    fullName: str | None = Field(default=None, max_length=255)
    institution: str | None = None


@router.post("/candidate/login", dependencies=[Depends(login_limiter)])
async def candidate_login(body: CandidateLoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Examinee sign-in by PRN / roll number. First sign-in with a new PRN
    registers the candidate (the student portal has no separate sign-up page)."""
    user = await _find_user(db, None, body.candidateId)
    if user is None:
        if not body.fullName:
            raise ApiError(404, "CANDIDATE_NOT_FOUND", "No candidate with this PRN. Provide your full name to register.")
        user = await _create_user(
            db,
            RegisterRequest(fullName=body.fullName, password=body.password, candidateId=body.candidateId, role="student", institution=body.institution),
        )
        result = await _issue_tokens(db, response, user)
        result["registered"] = True
        return result
    if user.role != ROLE_STUDENT:
        raise ApiError(403, "WRONG_PORTAL", "This account cannot sign in to the candidate portal")
    if not await asyncio.to_thread(verify_password, body.password, user.password_hash):
        raise ApiError(401, "INVALID_CREDENTIALS", "Incorrect PRN or password")
    result = await _issue_tokens(db, response, user)
    result["registered"] = False
    return result


@router.post("/refresh")
async def refresh(response: Response, db: AsyncSession = Depends(get_db), ip_refresh: str | None = Cookie(default=None)):
    if not ip_refresh:
        raise ApiError(401, "NO_REFRESH_TOKEN", "Missing refresh token")
    row = (await db.execute(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(ip_refresh)))).scalar_one_or_none()
    now = utcnow()
    if row is None or row.expires_at < now:
        raise ApiError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired")
    if row.revoked_at is not None:
        # Reuse of a rotated token: assume theft, revoke the entire family.
        await db.execute(update(RefreshToken).where(RefreshToken.family_id == row.family_id).values(revoked_at=now))
        await db.commit()
        response.delete_cookie(REFRESH_COOKIE, path=REFRESH_PATH)
        raise ApiError(401, "REFRESH_TOKEN_REUSED", "Refresh token reuse detected; please sign in again")
    row.revoked_at = now
    user = await db.get(User, row.user_id)
    if user is None:
        raise ApiError(401, "INVALID_REFRESH_TOKEN", "User no longer exists")
    return await _issue_tokens(db, response, user, family=row.family_id)


@router.post("/logout")
async def logout(response: Response, db: AsyncSession = Depends(get_db), ip_refresh: str | None = Cookie(default=None)):
    if ip_refresh:
        row = (await db.execute(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(ip_refresh)))).scalar_one_or_none()
        if row is not None:
            await db.execute(update(RefreshToken).where(RefreshToken.family_id == row.family_id).values(revoked_at=utcnow()))
            await db.commit()
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_PATH)
    return {"success": True}


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return user_to_ui(user)


@router.get("/verify-code/{code}", include_in_schema=False)
async def verify_code_alias(code: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Alias of GET /exams/lookup/{code} (FRONTEND_ARCHITECTURE.md section 19)."""
    from .exams import lookup_exam_code

    return await lookup_exam_code(code, request, db)
