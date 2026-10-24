"""Evidence & reference-photo object storage (section 9).

* S3 / MinIO when S3_ENDPOINT_URL + credentials are configured: private bucket,
  15-minute pre-signed GET URLs.
* Otherwise a private local directory (backend/storage/) that is never served
  statically. Files are only reachable through HMAC-signed, expiring URLs handled
  by ``GET /api/v1/evidence/files/{token}`` -- the same access model as pre-signed
  S3 URLs.

Keys follow the spec layout: ``evidence/{exam_id}/{session_id}/{event_id}.jpg``.
Images are never stored as BLOBs in the database.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from datetime import timedelta
from pathlib import Path

from ..config import get_settings
from ..db import utcnow
from ..security import sign_blob, verify_blob

log = logging.getLogger("intelliproctor.storage")

LOCAL_BUCKET = "local"


class StorageError(Exception):
    pass


class _LocalStorage:
    bucket = LOCAL_BUCKET

    def __init__(self, root: Path):
        self.root = root

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root.resolve() not in path.parents:
            raise StorageError("Invalid storage key")
        return path

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        path = self._path(key)

        def _write():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)

        await asyncio.to_thread(_write)

    async def get(self, key: str) -> bytes:
        path = self._path(key)
        if not path.exists():
            raise StorageError("Object not found")
        return await asyncio.to_thread(path.read_bytes)

    async def signed_url(self, key: str, base_url: str, ttl_seconds: int) -> str:
        token = sign_blob(key, utcnow() + timedelta(seconds=ttl_seconds))
        return f"{base_url.rstrip('/')}/api/v1/evidence/files/{token}"


class _S3Storage:
    def __init__(self) -> None:
        import boto3  # optional dependency at runtime
        from botocore.config import Config

        s = get_settings()
        self.bucket = s.S3_BUCKET_EVIDENCE
        self.sse = s.S3_SERVER_SIDE_ENCRYPTION.strip()
        self.client = boto3.client(
            "s3",
            endpoint_url=s.S3_ENDPOINT_URL,
            aws_access_key_id=s.S3_ACCESS_KEY,
            aws_secret_access_key=s.S3_SECRET_KEY,
            region_name=s.S3_REGION,
            config=Config(signature_version="s3v4", retries={"max_attempts": 2}, connect_timeout=3, read_timeout=10),
        )
        self._bucket_ready = False

    def _ensure_bucket(self) -> None:
        if self._bucket_ready:
            return
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except Exception:  # noqa: BLE001
            self.client.create_bucket(Bucket=self.bucket)
        self._bucket_ready = True

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        def _put():
            self._ensure_bucket()
            extra = {"ServerSideEncryption": self.sse} if self.sse else {}
            self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type, **extra)

        try:
            await asyncio.to_thread(_put)
        except Exception as exc:  # noqa: BLE001
            raise StorageError(str(exc)) from exc

    async def get(self, key: str) -> bytes:
        def _get():
            return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()

        try:
            return await asyncio.to_thread(_get)
        except Exception as exc:  # noqa: BLE001
            raise StorageError(str(exc)) from exc

    async def signed_url(self, key: str, base_url: str, ttl_seconds: int) -> str:
        return await asyncio.to_thread(
            self.client.generate_presigned_url,
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=ttl_seconds,
        )


_storage = None


def get_storage():
    global _storage
    if _storage is None:
        s = get_settings()
        if s.s3_enabled:
            try:
                _storage = _S3Storage()
                log.info("Evidence storage: S3 bucket %s at %s", s.S3_BUCKET_EVIDENCE, s.S3_ENDPOINT_URL)
            except Exception as exc:  # noqa: BLE001
                log.warning("S3 storage unavailable (%s); using local private storage", exc)
                _storage = _LocalStorage(s.storage_dir)
        else:
            _storage = _LocalStorage(s.storage_dir)
    return _storage


def set_storage_for_tests(storage) -> None:
    global _storage
    _storage = storage


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def verify_local_token(token: str) -> str | None:
    return verify_blob(token)
