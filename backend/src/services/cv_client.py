"""Client for the computer-vision inference worker (proctoring-service/).

The CV worker is an *observation generator* (section 4.2): it returns the live
per-frame observation plus zero or more structured episode events. It never
assigns points; every returned event goes through ``ingest.ingest_event``.
"""

from __future__ import annotations

import logging

import httpx

from ..config import get_settings

log = logging.getLogger("intelliproctor.cv")

_client: httpx.AsyncClient | None = None


class CVUnavailable(Exception):
    pass


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        s = get_settings()
        _client = httpx.AsyncClient(
            base_url=s.PROCTOR_SERVICE_URL.rstrip("/"),
            timeout=s.PROCTOR_SERVICE_TIMEOUT_SECONDS,
            headers={"X-Internal-Token": s.INTERNAL_SERVICE_TOKEN},
        )
    return _client


async def analyze_frame(session_id: str, image_base64: str, captured_at: str | None) -> dict:
    try:
        resp = await _get_client().post(
            "/analyze", json={"session_id": session_id, "image_base64": image_base64, "captured_at": captured_at}
        )
    except httpx.HTTPError as exc:
        raise CVUnavailable(str(exc)) from exc
    if resp.status_code >= 500 or resp.status_code in (401, 403, 404):
        raise CVUnavailable(f"proctoring-service returned HTTP {resp.status_code}")
    if resp.status_code >= 400:
        raise ValueError(resp.text[:300])
    return resp.json()


async def end_session(session_id: str) -> None:
    try:
        await _get_client().delete(f"/session/{session_id}")
    except httpx.HTTPError as exc:  # best effort
        log.info("proctoring-service end_session(%s) failed: %s", session_id, exc)


async def health() -> dict | None:
    try:
        resp = await _get_client().get("/health", timeout=3.0)
        return resp.json() if resp.status_code == 200 else None
    except httpx.HTTPError:
        return None


async def close() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
