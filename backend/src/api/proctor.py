"""Proctoring telemetry, live monitoring, evidence and examiner review
(sections 6, 8, 9, 14, 16)."""

from __future__ import annotations

import base64
import binascii
import time
import uuid

from fastapi import APIRouter, Depends, Header, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_db, utcnow
from ..deps import (
    ExamSessionContext,
    decode_or_401,
    get_exam_session_ctx,
    is_admin,
    is_internal_token,
    require_examiner,
    require_student,
)
from ..errors import ApiError
from ..models import (
    EvidenceRecord,
    Examination,
    ExaminerReview,
    ExamSession,
    ProctoringEvent,
    SuspicionScoreLedger,
    User,
)
from ..schemas import FlagRequest, FrameRequest, NotifyRequest, ProctoringEventIngestRequest, ReviewRequest
from ..security import TOKEN_EXAM_SESSION
from ..services import cv_client, live_bus, live_state, scoring
from ..services.exams import ACTIVE_SESSION, expire_if_due
from ..services.ingest import ingest_event
from ..services.storage import StorageError, get_storage
from ..services.views import event_to_ui, iso, review_to_ui, session_card

router = APIRouter(prefix="/proctor", tags=["proctoring"])

MAX_FRAME_BYTES = 3 * 1024 * 1024
_last_live_publish: dict[str, float] = {}


# ------------------------------------------------------------------ helpers


async def owned_session(db: AsyncSession, session_id: uuid.UUID, user: User) -> tuple[ExamSession, Examination]:
    session = await db.get(ExamSession, session_id)
    if session is None:
        raise ApiError(404, "SESSION_NOT_FOUND", "Exam session not found")
    exam = await db.get(Examination, session.exam_id)
    if exam.examiner_id != user.user_id and not is_admin(user):
        raise ApiError(403, "FORBIDDEN", "You do not own this exam")
    return session, exam


async def owned_event(db: AsyncSession, event_id: uuid.UUID, user: User) -> tuple[ProctoringEvent, ExamSession, Examination]:
    ev = await db.get(ProctoringEvent, event_id)
    if ev is None:
        raise ApiError(404, "EVENT_NOT_FOUND", "Proctoring event not found")
    session, exam = await owned_session(db, ev.session_id, user)
    return ev, session, exam


async def points_by_event(db: AsyncSession, session_id: uuid.UUID) -> dict[uuid.UUID, int]:
    rows = (
        await db.execute(
            select(SuspicionScoreLedger.event_id, func.sum(SuspicionScoreLedger.applied_points))
            .where(SuspicionScoreLedger.session_id == session_id)
            .group_by(SuspicionScoreLedger.event_id)
        )
    ).all()
    return {eid: int(p or 0) for eid, p in rows}


async def latest_reviews(db: AsyncSession, event_ids: list[uuid.UUID]) -> dict[uuid.UUID, dict]:
    if not event_ids:
        return {}
    rows = (
        await db.execute(
            select(ExaminerReview, User.full_name)
            .join(User, User.user_id == ExaminerReview.examiner_id)
            .where(ExaminerReview.event_id.in_(event_ids))
            .order_by(ExaminerReview.reviewed_at)
        )
    ).all()
    out: dict[uuid.UUID, dict] = {}
    for review, name in rows:
        out[review.event_id] = review_to_ui(review, name)  # later rows win -> latest decision
    return out


async def last_incident_and_warnings(db: AsyncSession, session_ids: list[uuid.UUID]) -> dict[uuid.UUID, tuple[str | None, int]]:
    if not session_ids:
        return {}
    counts = dict(
        (
            await db.execute(
                select(ProctoringEvent.session_id, func.count())
                .where(ProctoringEvent.session_id.in_(session_ids), ProctoringEvent.event_type != scoring.EVENT_TAB_FOCUS)
                .group_by(ProctoringEvent.session_id)
            )
        ).all()
    )
    sub = (
        select(ProctoringEvent.session_id, func.max(ProctoringEvent.timestamp).label("ts"))
        .where(ProctoringEvent.session_id.in_(session_ids), ProctoringEvent.event_type != scoring.EVENT_TAB_FOCUS)
        .group_by(ProctoringEvent.session_id)
        .subquery()
    )
    latest = (
        await db.execute(
            select(ProctoringEvent).join(sub, (ProctoringEvent.session_id == sub.c.session_id) & (ProctoringEvent.timestamp == sub.c.ts))
        )
    ).scalars().all()
    from ..services.views import event_label

    titles = {ev.session_id: event_label(ev)[0] for ev in latest}
    return {sid: (titles.get(sid), int(counts.get(sid, 0))) for sid in session_ids}


async def build_cards(db: AsyncSession, rows) -> list[dict]:
    meta = await last_incident_and_warnings(db, [s.session_id for s, _, _ in rows])
    return [session_card(s, cand, exam, *meta.get(s.session_id, (None, 0))) for s, cand, exam in rows]


# ------------------------------------------------------------- ingestion


@router.post("/events", status_code=201)
async def ingest(
    body: ProctoringEventIngestRequest,
    response: Response,
    authorization: str | None = Header(default=None),
    x_internal_token: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Telemetry ingestion valve (section 6.1). Accepted callers:

    * the candidate browser with its Exam Session Token -> BROWSER_VISIBILITY
      events (TAB_BLUR / TAB_FOCUS) for its own session only;
    * a CV inference worker with ``X-Internal-Token`` -> any event type.
    """
    if is_internal_token(x_internal_token):
        pass
    else:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise ApiError(401, "UNAUTHENTICATED", "Exam session token or internal service token required")
        claims = decode_or_401(authorization.split(" ", 1)[1])
        if claims.get("typ") != TOKEN_EXAM_SESSION or claims.get("session_id") != str(body.sessionId):
            raise ApiError(403, "FORBIDDEN", "Token is not valid for this session")
        if body.eventType not in scoring.BROWSER_EVENT_TYPES or body.source != "BROWSER_VISIBILITY":
            raise ApiError(403, "FORBIDDEN", "Browsers may only report BROWSER_VISIBILITY tab events")
    if body.source not in scoring.EXPECTED_SOURCE[body.eventType]:
        raise ApiError(422, "SOURCE_MISMATCH", f"{body.eventType} must come from {sorted(scoring.EXPECTED_SOURCE[body.eventType])}")

    result = await ingest_event(db, body.sessionId, body.as_payload())
    if result.duplicate:
        response.status_code = 200  # idempotent replay (section 17.2)
    pts = result.ledger_entry.applied_points if result.ledger_entry else 0
    return {
        "duplicate": result.duplicate,
        "event": event_to_ui(result.event, points=pts),
        "session": {
            "sessionId": str(result.session.session_id),
            "suspicionScore": result.session.current_suspicion_score,
            "isSuspicious": result.session.is_suspicious,
            "headTurnsPending": result.session.head_turn_pending_count,
            "headTurnsCompleted": result.session.total_head_turns_completed,
        },
    }


def _decode_frame(image_b64: str) -> bytes:
    raw = image_b64.split(",", 1)[-1]
    try:
        data = base64.b64decode(raw, validate=False)
    except (binascii.Error, ValueError) as exc:
        raise ApiError(422, "INVALID_FRAME", "imageBase64 is not valid base64") from exc
    if len(data) > MAX_FRAME_BYTES:
        raise ApiError(413, "FRAME_TOO_LARGE", "Frame exceeds 3 MB")
    return data


CANDIDATE_NOTICES = {
    scoring.EVENT_PHONE: ("critical", "A prohibited device may be visible. Please remove it from your workspace."),
    scoring.EVENT_BOOK: ("warning", "Books or notes may be visible. Please clear your workspace."),
    scoring.EVENT_HEAD_TURN: ("warning", "Please keep facing the screen."),
    scoring.EVENT_ABSENT: ("warning", "Your face has not been visible for a while. Please return to the camera."),
    scoring.EVENT_MULTIPLE_FACES: ("warning", "Only the candidate should be visible to the camera."),
}


@router.post("/sessions/{session_id}/frames")
async def submit_frame(
    session_id: uuid.UUID, body: FrameRequest, ctx: ExamSessionContext = Depends(get_exam_session_ctx), db: AsyncSession = Depends(get_db)
):
    """Webcam keyframe -> CV worker -> structured episode events -> ingestion.

    The candidate gets back only non-alarming guidance (face visible, facing
    the screen, ...). Scores are never sent to examinees (section 14.2)."""
    session = ctx.session
    if session.session_id != session_id:
        raise ApiError(403, "FORBIDDEN", "Token is not valid for this session")
    if await expire_if_due(db, session):
        await db.commit()
    if session.status != ACTIVE_SESSION:
        raise ApiError(409, "SESSION_NOT_ACTIVE", f"Session is {session.status}")

    jpeg = _decode_frame(body.imageBase64)
    live_state.update_frame(session_id, jpeg)
    exam_id = session.exam_id
    await db.commit()  # release the read transaction before the (slow) CV call

    try:
        result = await cv_client.analyze_frame(
            str(session_id), base64.b64encode(jpeg).decode(), iso(body.capturedAt) if body.capturedAt else None
        )
    except cv_client.CVUnavailable:
        live_state.update_observation(session_id, live_state.get(session_id).observation, cv_online=False)
        return {"cvOnline": False, "observation": None, "notices": [], "sessionStatus": ACTIVE_SESSION}
    except ValueError as exc:
        raise ApiError(422, "INVALID_FRAME", f"The CV worker rejected the frame: {exc}") from exc

    observation = result.get("observation") or {}
    live_state.update_observation(session_id, observation, cv_online=True)

    notices = []
    for raw_event in result.get("events") or []:
        try:
            evt = ProctoringEventIngestRequest(**{**raw_event, "sessionId": str(session_id)})
        except Exception:  # noqa: BLE001 -- malformed worker output must not break the exam
            continue
        ingested = await ingest_event(db, session_id, evt.as_payload())
        if not ingested.duplicate and evt.eventType in CANDIDATE_NOTICES:
            level, msg = CANDIDATE_NOTICES[evt.eventType]
            notices.append({"type": level, "message": msg, "eventType": evt.eventType})

    now = time.monotonic()
    if now - _last_live_publish.get(str(session_id), 0) > 2.0:
        _last_live_publish[str(session_id)] = now
        await live_bus.publish(live_bus.exam_channel(exam_id), {"type": "live_state", "sessionId": str(session_id)})

    return {
        "cvOnline": True,
        "sessionStatus": ACTIVE_SESSION,
        "observation": {
            "faceVisible": observation.get("faceCount", 1) > 0,
            "faceCount": observation.get("faceCount"),
            "multipleFaces": bool(observation.get("multipleFaces")),
            "lookingAway": bool(observation.get("lookingAway")),
            "gazeDirection": observation.get("gazeDirection", "Center"),
            "headPose": observation.get("headPose"),
            "phoneInView": bool(observation.get("phoneInView")),
            "bookInView": bool(observation.get("bookInView")),
        },
        "notices": notices,
    }


# ------------------------------------------------------- examiner live hall


@router.get("/live-candidates")
async def live_candidates(
    examId: uuid.UUID | None = Query(default=None),
    includeFinished: bool = Query(default=False),
    user: User = Depends(require_examiner),
    db: AsyncSession = Depends(get_db),
):
    """Active candidate roster with the exact ledger score (Test 16)."""
    stmt = (
        select(ExamSession, User, Examination)
        .join(User, User.user_id == ExamSession.candidate_id)
        .join(Examination, Examination.exam_id == ExamSession.exam_id)
        .order_by(ExamSession.started_at.desc())
    )
    if not is_admin(user):
        stmt = stmt.where(Examination.examiner_id == user.user_id)
    if examId:
        stmt = stmt.where(Examination.exam_id == examId)
    if not includeFinished:
        stmt = stmt.where(ExamSession.status == ACTIVE_SESSION)
    rows = (await db.execute(stmt.limit(500))).all()
    return await build_cards(db, rows)


@router.get("/sessions/{session_id}")
async def session_detail(session_id: uuid.UUID, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    session, exam = await owned_session(db, session_id, user)
    candidate = await db.get(User, session.candidate_id)
    card = (await build_cards(db, [(session, candidate, exam)]))[0]
    counts = dict(
        (
            await db.execute(
                select(ProctoringEvent.event_type, func.count()).where(ProctoringEvent.session_id == session_id).group_by(ProctoringEvent.event_type)
            )
        ).all()
    )
    card["eventCounts"] = {k: int(v) for k, v in counts.items()}
    card["academicScore"] = float(session.academic_score) if session.academic_score is not None else None
    card["maxAcademicScore"] = float(session.max_academic_score) if session.max_academic_score is not None else None
    return card


@router.get("/sessions/{session_id}/events")
async def session_events(session_id: uuid.UUID, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    await owned_session(db, session_id, user)
    events = (
        await db.execute(select(ProctoringEvent).where(ProctoringEvent.session_id == session_id).order_by(ProctoringEvent.timestamp))
    ).scalars().all()
    pts = await points_by_event(db, session_id)
    reviews = await latest_reviews(db, [e.event_id for e in events])
    return [event_to_ui(e, points=pts.get(e.event_id, 0), review=reviews.get(e.event_id)) for e in events]


@router.get("/sessions/{session_id}/ledger")
async def session_ledger(session_id: uuid.UUID, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    session, _ = await owned_session(db, session_id, user)
    rows = (
        await db.execute(
            select(SuspicionScoreLedger, ProctoringEvent.event_type, ProctoringEvent.timestamp, ProctoringEvent.review_status)
            .join(ProctoringEvent, ProctoringEvent.event_id == SuspicionScoreLedger.event_id)
            .where(SuspicionScoreLedger.session_id == session_id)
            .order_by(SuspicionScoreLedger.created_at)
        )
    ).all()
    return {
        "currentScore": session.current_suspicion_score,
        "peakScore": session.peak_suspicion_score,
        "isSuspicious": session.is_suspicious,
        "startedAt": iso(session.started_at),
        "entries": [
            {
                "ledgerId": str(l.ledger_id),
                "eventId": str(l.event_id),
                "eventType": etype,
                "eventTimestamp": iso(ts),
                "eventReviewStatus": rstatus,
                "ruleApplied": l.rule_applied,
                "nominalPoints": l.nominal_points,
                "appliedPoints": l.applied_points,
                "previousScore": l.previous_score,
                "newScore": l.new_score,
                "isSuspicious": l.is_suspicious,
                "createdAt": iso(l.created_at),
            }
            for l, etype, ts, rstatus in rows
        ],
    }


@router.get("/sessions/{session_id}/snapshot")
async def session_snapshot(session_id: uuid.UUID, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    """Latest candidate keyframe for the examiner grid (no local-webcam loop)."""
    await owned_session(db, session_id, user)
    st = live_state.peek(session_id)
    if st is None or not st.snapshot_jpeg:
        raise ApiError(404, "NO_SNAPSHOT", "No camera frame received from this candidate yet")
    return Response(
        content=st.snapshot_jpeg,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store", "X-Snapshot-Age-Ms": str(int((time.time() - st.snapshot_at) * 1000))},
    )


@router.post("/sessions/{session_id}/flag")
async def flag_session(session_id: uuid.UUID, body: FlagRequest, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    """Manual examiner flag. Recorded as an auditable MANUAL_FLAG event with
    ZERO points -- examiners cannot change the automated score (section 5.5)."""
    session, _ = await owned_session(db, session_id, user)
    if session.status != ACTIVE_SESSION:
        session.manually_flagged = True
        session.manual_flag_reason = body.reason
        await db.commit()
        return {"success": True, "flagged": True}
    result = await ingest_event(
        db,
        session_id,
        {
            "eventType": scoring.EVENT_MANUAL_FLAG,
            "episodeId": f"manual-{uuid.uuid4()}",
            "source": "EXAMINER",
            "timestamp": utcnow(),
            "details": {"reason": body.reason, "examinerId": str(user.user_id), "examinerName": user.full_name},
        },
    )
    return {"success": True, "flagged": True, "eventId": str(result.event.event_id), "timestamp": iso(result.event.timestamp)}


@router.post("/sessions/{session_id}/notify")
async def notify_candidate(session_id: uuid.UUID, body: NotifyRequest, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    await owned_session(db, session_id, user)
    await live_bus.publish(live_bus.session_channel(session_id), {"type": "examiner_message", "level": body.level, "message": body.message})
    return {"success": True}


# ------------------------------------------------------ evidence & review


@router.get("/events/{event_id}/evidence")
async def event_evidence(event_id: uuid.UUID, request: Request, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    """15-minute pre-signed URL for the evidence keyframe (section 9.1 stage 6)."""
    ev, _, _ = await owned_event(db, event_id, user)
    rec = (await db.execute(select(EvidenceRecord).where(EvidenceRecord.event_id == ev.event_id))).scalar_one_or_none()
    if rec is None:
        raise ApiError(404, "NO_EVIDENCE", f"No evidence stored for this event (status: {ev.evidence_status})")
    ttl = get_settings().EVIDENCE_URL_TTL_SECONDS
    try:
        url = await get_storage().signed_url(rec.s3_key, str(request.base_url), ttl)
    except StorageError as exc:
        raise ApiError(502, "STORAGE_UNAVAILABLE", str(exc)) from exc
    return {
        "url": url,
        "expiresInSeconds": ttl,
        "sha256": rec.image_hash_sha256,
        "sizeBytes": rec.file_size_bytes,
        "mimeType": rec.mime_type,
        "capturedAt": iso(ev.timestamp),
    }


async def _review(event_id: uuid.UUID, body: ReviewRequest, user: User, db: AsyncSession, action: str) -> dict:
    ev, session, exam = await owned_event(db, event_id, user)
    review = ExaminerReview(event_id=ev.event_id, examiner_id=user.user_id, action=action, justification_note=body.justificationNote.strip())
    db.add(review)
    # Only review metadata changes; the event, its evidence and the score
    # ledger are preserved untouched (sections 5.7, 16; Test 14).
    ev.review_status = "DISMISSED" if action == "DISMISS" else "CONFIRMED"
    await db.commit()
    await live_bus.publish(
        live_bus.exam_channel(exam.exam_id),
        {"type": "event_reviewed", "sessionId": str(session.session_id), "eventId": str(ev.event_id), "reviewStatus": ev.review_status},
    )
    pts = (await points_by_event(db, session.session_id)).get(ev.event_id, 0)
    return {
        "success": True,
        "event": event_to_ui(ev, points=pts, review=review_to_ui(review, user.full_name)),
        "session": {
            "automatedScore": session.current_suspicion_score,
            "isSuspicious": session.is_suspicious,
            "officialStatus": scoring.official_status_label(session.current_suspicion_score, action == "DISMISS"),
        },
    }


@router.post("/events/{event_id}/dismiss")
async def dismiss_event(event_id: uuid.UUID, body: ReviewRequest, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    return await _review(event_id, body, user, db, "DISMISS")


@router.post("/events/{event_id}/confirm")
async def confirm_event(event_id: uuid.UUID, body: ReviewRequest, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    return await _review(event_id, body, user, db, "CONFIRM")


@router.post("/precheck")
async def precheck(body: FrameRequest, user: User = Depends(require_student)):
    """Pre-exam diagnostic (System Check page): runs one frame through the CV
    worker without an exam session, so nothing is recorded or scored."""
    jpeg = _decode_frame(body.imageBase64)
    sid = f"precheck:{user.user_id}"
    try:
        result = await cv_client.analyze_frame(sid, base64.b64encode(jpeg).decode(), None)
    except cv_client.CVUnavailable:
        return {"cvOnline": False, "faceCount": None, "headPose": None}
    finally:
        await cv_client.end_session(sid)
    obs = result.get("observation") or {}
    return {"cvOnline": True, "faceCount": obs.get("faceCount"), "headPose": obs.get("headPose"), "phase": result.get("phase")}


@router.get("/health")
async def proctor_health():
    cv = await cv_client.health()
    return {"cvService": "online" if cv else "offline", "cv": cv}


# ----------------------------------------------------------- signed files

files_router = APIRouter(prefix="/evidence", tags=["evidence"])


@files_router.get("/files/{token}")
async def evidence_file(token: str):
    from ..services.storage import verify_local_token

    key = verify_local_token(token)
    if key is None:
        raise ApiError(403, "URL_EXPIRED", "This evidence link is invalid or has expired")
    try:
        data = await get_storage().get(key)
    except StorageError as exc:
        raise ApiError(404, "NOT_FOUND", "Evidence object not found") from exc
    return Response(content=data, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=60"})
