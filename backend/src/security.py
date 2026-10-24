"""Password / passkey hashing and token minting (sections 10.2, 11.2)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from cryptography.fernet import Fernet, InvalidToken

from .config import get_settings
from .db import utcnow

_hasher = PasswordHasher()  # Argon2id with library-recommended parameters

TOKEN_ACCESS = "access"
TOKEN_EXAM_SESSION = "exam_session"


# ----------------------------------------------------------------- passwords


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


# ------------------------------------------------------------------ passkeys


def normalize_passkey(passkey: str) -> str:
    return "".join(ch for ch in (passkey or "").upper() if ch.isalnum())


def generate_passkey() -> str:
    """10-12 character exam code in the format the frontend already uses
    (e.g. AI2026XQZ482). High-entropy part is 3 letters + 3 digits drawn from
    `secrets`, prefixed for human readability."""
    letters = "".join(secrets.choice(string.ascii_uppercase) for _ in range(3))
    digits = "".join(secrets.choice(string.digits) for _ in range(3))
    return f"AI{datetime.now(timezone.utc).year}{letters}{digits}"


def passkey_lookup_digest(passkey: str) -> str:
    key = hashlib.sha256(("passkey-lookup:" + get_settings().jwt_secret).encode()).digest()
    return hmac.new(key, normalize_passkey(passkey).encode(), hashlib.sha256).hexdigest()


def hash_passkey(passkey: str, exam_id: uuid.UUID) -> str:
    """PasskeyHash = Argon2id(passkey + exam_id)  (section 10.2)."""
    return _hasher.hash(normalize_passkey(passkey) + str(exam_id))


def verify_passkey(passkey: str, exam_id: uuid.UUID, passkey_hash: str) -> bool:
    try:
        return _hasher.verify(passkey_hash, normalize_passkey(passkey) + str(exam_id))
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def _fernet() -> Fernet:
    raw = hashlib.sha256(("passkey-encryption:" + get_settings().jwt_secret).encode()).digest()
    return Fernet(base64.urlsafe_b64encode(raw))


def encrypt_passkey(passkey: str) -> str:
    return _fernet().encrypt(normalize_passkey(passkey).encode()).decode()


def decrypt_passkey(ciphertext: str) -> str | None:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except (InvalidToken, ValueError):
        return None


# -------------------------------------------------------------------- tokens


def _encode(payload: dict) -> str:
    s = get_settings()
    return jwt.encode(payload, s.jwt_secret, algorithm=s.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    s = get_settings()
    return jwt.decode(token, s.jwt_secret, algorithms=[s.JWT_ALGORITHM], options={"require": ["exp", "sub", "typ"]})


def create_access_token(user_id: uuid.UUID, role: str, email: str) -> tuple[str, datetime]:
    expires = utcnow() + timedelta(minutes=get_settings().ACCESS_TOKEN_MINUTES)
    token = _encode(
        {
            "sub": str(user_id),
            "role": role,
            "email": email,
            "typ": TOKEN_ACCESS,
            "session_fingerprint": secrets.token_hex(8),
            "iat": int(utcnow().timestamp()),
            "exp": int(expires.timestamp()),
        }
    )
    return token, expires


def create_exam_session_token(
    session_id: uuid.UUID, candidate_id: uuid.UUID, exam_id: uuid.UUID, expires_at: datetime
) -> str:
    """Scoped token {session_id, candidate_id, exam_id, exp} (section 10.3).
    Valid for the attempt plus a 10-minute grace window for the final submit."""
    exp = expires_at + timedelta(minutes=10)
    return _encode(
        {
            "sub": str(candidate_id),
            "typ": TOKEN_EXAM_SESSION,
            "session_id": str(session_id),
            "candidate_id": str(candidate_id),
            "exam_id": str(exam_id),
            "role": "student",
            "iat": int(utcnow().timestamp()),
            "exp": int(exp.timestamp()),
        }
    )


def new_refresh_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(48)
    return raw, hash_refresh_token(raw)


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


# --------------------------------------------------------- signed evidence URLs


def sign_blob(payload: str, expires_at: datetime) -> str:
    exp = int(expires_at.timestamp())
    msg = f"{payload}:{exp}".encode()
    sig = hmac.new(get_settings().jwt_secret.encode(), msg, hashlib.sha256).hexdigest()
    token = base64.urlsafe_b64encode(f"{payload}:{exp}:{sig}".encode()).decode().rstrip("=")
    return token


def verify_blob(token: str) -> str | None:
    try:
        padded = token + "=" * (-len(token) % 4)
        payload, exp, sig = base64.urlsafe_b64decode(padded.encode()).decode().rsplit(":", 2)
    except (ValueError, UnicodeDecodeError):
        return None
    expected = hmac.new(get_settings().jwt_secret.encode(), f"{payload}:{exp}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return None
    if int(exp) < int(utcnow().timestamp()):
        return None
    return payload
