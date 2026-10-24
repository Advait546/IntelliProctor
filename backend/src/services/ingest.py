"""Event ingestion & de-duplication pipeline (BACKEND_ARCHITECTURE.md section 6).

    1. Verify session state == IN_PROGRESS            (409 otherwise)
    2. Validate payload (Pydantic, in schemas.py)
    3. Idempotency: SHA256(session_id + event_type + episode_id)
       -> duplicate returns the existing record, never re-scores (Test 8 / 9)
    4. Store attached screenshot (S3 / local private store); on failure the event
       is still persisted with evidence_status = 'FAILED' (Test 18)
    5. Insert proctoring_events row
    6. Apply scoring rule -> append suspicion_score_ledger row (row-locked session)
    7. Publish event + score update to the live bus
"""

from __future__ import annotations

import asyncio
import base64
import binascii
import hashlib
import logging
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import utcnow
from ..errors import ApiError
from ..models import EvidenceRecord, ExamSession, ProctoringEvent, SuspicionScoreLedger
from . import live_bus, scoring
from .exams import ACTIVE_SESSION, expire_if_due
from .storage import StorageError, get_storage, sha256_hex

log = logging.getLogger("intelliproctor.ingest")

# Per-session in-process locks complement SELECT ... FOR UPDATE (which SQLite
# ignores) so concurrent ingestion for one session is always serialized.
_session_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

MAX_EVIDENCE_BYTES = 5 * 1024 * 1024


@dataclass
class IngestResult:
    event: ProctoringEvent
    duplicate: bool
    ledger_entry: SuspicionScoreLedger | None
    session: ExamSession


def idempotency_key(session_id, event_type: str, episode_id: str) -> str:
    return hashlib.sha256(f"{session_id}{event_type}{episode_id}".encode()).hexdigest()


def _decode_evidence(evidence_b64: str | None) -> bytes | None:
    if not evidence_b64:
        return None
    raw = evidence_b64.split(",", 1)[-1] if evidence_b64.startswith("data:") else evidence_b64
    try:
        data = base64.b64decode(raw, validate=False)
    except (binascii.Error, ValueError) as exc:
        raise ApiError(422, "INVALID_EVIDENCE", "evidenceBase64 is not valid base64") from exc
    if len(data) > MAX_EVIDENCE_BYTES:
        raise ApiError(413, "EVIDENCE_TOO_LARGE", "Evidence image exceeds 5 MB")
    return data


async def _existing(db: AsyncSession, key: str) -> ProctoringEvent | None:
    return (await db.execute(select(ProctoringEvent).where(ProctoringEvent.idempotency_key == key))).scalar_one_or_none()


async def ingest_event(db: AsyncSession, session_id: uuid.UUID, payload: dict) -> IngestResult:
    """``payload`` keys follow the ingestion data contract (camelCase, section 6.2)."""
    event_type = payload["eventType"]
    episode_id = str(payload["episodeId"])
    key = idempotency_key(session_id, event_type, episode_id)
    cache = live_bus.get_idempotency_cache()

    async with _session_locks[str(session_id)]:
        # Fast-path duplicate check (Redis / memory), then DB (authoritative).
        cached_id = await cache.get(key)
        existing = await db.get(ProctoringEvent, uuid.UUID(cached_id)) if cached_id else None
        if existing is None:
            existing = await _existing(db, key)
        if existing is not None:
            session = await db.get(ExamSession, session_id)
            return IngestResult(existing, True, None, session)

        session = (
            await db.execute(select(ExamSession).where(ExamSession.session_id == session_id).with_for_update())
        ).scalar_one_or_none()
        if session is None:
            raise ApiError(404, "SESSION_NOT_FOUND", "Exam session not found")
        if await expire_if_due(db, session):
            await db.commit()
        if session.status != ACTIVE_SESSION:
            raise ApiError(409, "SESSION_NOT_ACTIVE", f"Session is {session.status}; events are no longer accepted")

        now = utcnow()
        ts: datetime = payload.get("timestamp") or now
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        skew = abs((now - ts).total_seconds()) > get_settings().CLOCK_SKEW_TOLERANCE_SECONDS

        details = dict(payload.get("details") or {})
        timing_discrepancy = False
        duration_ms = int(payload.get("durationMs") or 0)

        # Browser tab telemetry: server-side authoritative timing (section 8.2).
        if event_type == scoring.EVENT_TAB_BLUR:
            session.last_tab_blur_server_at = now
            session.tab_switch_count += 1
        elif event_type == scoring.EVENT_TAB_FOCUS:
            if session.last_tab_blur_server_at is not None:
                server_ms = int((now - session.last_tab_blur_server_at).total_seconds() * 1000)
                details["serverDurationMs"] = server_ms
                details["clientDurationMs"] = duration_ms
                if abs(server_ms - duration_ms) > get_settings().TAB_TIMING_DISCREPANCY_SECONDS * 1000:
                    timing_discrepancy = True
                session.tab_hidden_total_ms += server_ms
                duration_ms = server_ms
                session.last_tab_blur_server_at = None

        # Anti-replay: event timestamps must be monotonically non-decreasing
        # per session; out-of-order events are kept but flagged (section 18.2).
        if session.last_event_timestamp and ts < session.last_event_timestamp and not skew:
            details["outOfOrder"] = True
        session.last_event_timestamp = max(ts, session.last_event_timestamp or ts)

        event = ProctoringEvent(
            session_id=session.session_id,
            episode_id=episode_id,
            event_source=payload["source"],
            event_type=event_type,
            severity=scoring.SEVERITY.get(event_type, "LOW"),
            timestamp=ts,
            duration_ms=duration_ms,
            confidence=payload.get("confidence"),
            bounding_box=payload.get("boundingBox"),
            head_pose_angles=payload.get("headPoseAngles"),
            idempotency_key=key,
            server_received_at=now,
            is_clock_skewed=skew,
            timing_discrepancy=timing_discrepancy,
            details=details or None,
        )
        db.add(event)
        try:
            await db.flush()
        except IntegrityError:
            # Lost a race against an identical delivery: return the winner.
            await db.rollback()
            existing = await _existing(db, key)
            session = await db.get(ExamSession, session_id)
            return IngestResult(existing, True, None, session)

        # Evidence (stage 3-5 of section 9.1).
        evidence_bytes = _decode_evidence(payload.get("evidenceBase64"))
        if evidence_bytes:
            s3_key = f"evidence/{session.exam_id}/{session.session_id}/{event.event_id}.jpg"
            storage = get_storage()
            try:
                await storage.put(s3_key, evidence_bytes, "image/jpeg")
                db.add(
                    EvidenceRecord(
                        event_id=event.event_id,
                        s3_bucket=storage.bucket,
                        s3_key=s3_key,
                        file_size_bytes=len(evidence_bytes),
                        image_hash_sha256=sha256_hex(evidence_bytes),
                        mime_type="image/jpeg",
                    )
                )
                event.evidence_status = "STORED"
            except StorageError as exc:
                log.error("Evidence upload failed for event %s: %s", event.event_id, exc)
                event.evidence_status = "FAILED"

        # Scoring (section 5) -- the only place points are ever assigned.
        state = scoring.ScoreState(
            score=session.current_suspicion_score,
            head_turn_pending=session.head_turn_pending_count,
            head_turns_total=session.total_head_turns_completed,
        )
        new_state, entry = scoring.evaluate(state, event_type)
        session.head_turn_pending_count = new_state.head_turn_pending
        session.total_head_turns_completed = new_state.head_turns_total
        ledger_row = None
        if entry is not None:
            session.current_suspicion_score = entry.new_score
            session.peak_suspicion_score = max(session.peak_suspicion_score, entry.new_score)
            session.is_suspicious = entry.is_suspicious
            ledger_row = SuspicionScoreLedger(
                session_id=session.session_id,
                event_id=event.event_id,
                rule_applied=entry.rule_applied,
                nominal_points=entry.nominal_points,
                applied_points=entry.applied_points,
                previous_score=entry.previous_score,
                new_score=entry.new_score,
                is_suspicious=entry.is_suspicious,
            )
            db.add(ledger_row)
        if event_type == scoring.EVENT_MANUAL_FLAG:
            session.manually_flagged = True
            session.manual_flag_reason = details.get("reason")

        await db.commit()
        await cache.set(key, str(event.event_id))

    await live_bus.publish(
        live_bus.exam_channel(session.exam_id),
        {
            "type": "proctoring_event",
            "sessionId": str(session.session_id),
            "candidateId": str(session.candidate_id),
            "eventId": str(event.event_id),
            "anomaly": event_type,
            "severity": event.severity,
            "score": session.current_suspicion_score,
            "isSuspicious": session.is_suspicious,
            "pointsApplied": ledger_row.applied_points if ledger_row else 0,
            "timestamp": event.timestamp.isoformat(),
        },
    )
    return IngestResult(event, False, ledger_row, session)
