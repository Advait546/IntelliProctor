"""Examination lifecycle, passkey engine and session admission (section 10)."""

from __future__ import annotations

import asyncio
import logging
import random
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import utcnow
from ..errors import ApiError
from ..models import CandidateAnswer, Examination, ExamSession, ProctoringEvent, Question, User
from ..security import (
    decrypt_passkey,
    encrypt_passkey,
    generate_passkey,
    hash_passkey,
    normalize_passkey,
    passkey_lookup_digest,
    verify_passkey,
)
from . import live_bus
from .questions import from_ui, grade

log = logging.getLogger("intelliproctor.exams")

ACTIVE_SESSION = "IN_PROGRESS"
FINAL_SESSION_STATUSES = {"SUBMITTED", "FORCED_SUBMITTED", "EVALUATED"}

DEFAULT_EXAM_SETTINGS = {
    "negativeMarking": 0.0,
    "shuffleQuestions": False,
    "shuffleOptions": False,
    "aiMonitoring": True,
    "browserLock": True,
    "audioMonitoring": False,
    "fullscreenLock": True,
}


def effective_exam_status(exam: Examination, now: datetime | None = None) -> str:
    """DRAFT -> SCHEDULED -> ACTIVE -> CLOSED (section 10.1), derived from the
    publish flag and the [start_window, end_window] interval so status can never
    drift from the clock."""
    now = now or utcnow()
    if exam.status == "CLOSED":
        return "CLOSED"
    if not exam.is_published:
        return "DRAFT"
    if now < exam.start_window:
        return "SCHEDULED"
    if now > exam.end_window:
        return "CLOSED"
    return "ACTIVE"


# ---------------------------------------------------------------- passkeys


async def _passkey_in_use(db: AsyncSession, lookup: str, exclude_exam: uuid.UUID | None = None) -> bool:
    stmt = select(Examination.exam_id).where(Examination.passkey_lookup == lookup)
    if exclude_exam:
        stmt = stmt.where(Examination.exam_id != exclude_exam)
    return (await db.execute(stmt)).first() is not None


async def assign_passkey(db: AsyncSession, exam: Examination, requested: str | None = None) -> str:
    """Sets passkey hash / lookup / ciphertext on ``exam``; returns plaintext once."""
    if requested:
        passkey = normalize_passkey(requested)
        if not (6 <= len(passkey) <= 16):
            raise ApiError(422, "INVALID_PASSKEY_FORMAT", "Exam codes must be 6-16 letters/digits")
        if await _passkey_in_use(db, passkey_lookup_digest(passkey), exam.exam_id):
            raise ApiError(409, "PASSKEY_TAKEN", "That exam code is already used by another exam")
    else:
        for _ in range(20):
            passkey = generate_passkey()
            if not await _passkey_in_use(db, passkey_lookup_digest(passkey)):
                break
    exam.passkey_hash = hash_passkey(passkey, exam.exam_id)
    exam.passkey_lookup = passkey_lookup_digest(passkey)
    exam.passkey_ciphertext = encrypt_passkey(passkey)
    return passkey


def reveal_passkey(exam: Examination) -> str | None:
    return decrypt_passkey(exam.passkey_ciphertext)


async def find_exam_by_passkey(db: AsyncSession, passkey: str) -> Examination | None:
    passkey = normalize_passkey(passkey)
    if not passkey:
        return None
    exam = (
        await db.execute(select(Examination).where(Examination.passkey_lookup == passkey_lookup_digest(passkey)))
    ).scalar_one_or_none()
    if exam is None:
        return None
    # Constant-cost Argon2id verification of passkey + exam_id (section 10.2).
    ok = await asyncio.to_thread(verify_passkey, passkey, exam.exam_id, exam.passkey_hash)
    return exam if ok else None


# ------------------------------------------------------------------- authoring


def merge_settings(raw: dict | None) -> dict:
    out = dict(DEFAULT_EXAM_SETTINGS)
    for k, v in (raw or {}).items():
        if v is not None:
            out[k] = v
    try:
        out["negativeMarking"] = float(out.get("negativeMarking") or 0)
    except (TypeError, ValueError):
        out["negativeMarking"] = 0.0
    return out


async def replace_questions(db: AsyncSession, exam: Examination, questions: list[dict], append: bool = False) -> None:
    start = 0
    if append:
        start = (
            await db.execute(select(func.coalesce(func.max(Question.order_index), -1)).where(Question.exam_id == exam.exam_id))
        ).scalar_one() + 1
    else:
        has_sessions = (
            await db.execute(select(ExamSession.session_id).where(ExamSession.exam_id == exam.exam_id).limit(1))
        ).first()
        if has_sessions:
            raise ApiError(409, "EXAM_HAS_ATTEMPTS", "Questions cannot be replaced once candidates have started the exam")
        await db.execute(delete(Question).where(Question.exam_id == exam.exam_id))
        await db.flush()
    for i, raw in enumerate(questions):
        db.add(Question(exam_id=exam.exam_id, order_index=start + i, **from_ui(raw)))
    await db.flush()
    total = (await db.execute(select(func.coalesce(func.sum(Question.marks), 0)).where(Question.exam_id == exam.exam_id))).scalar_one()
    exam.total_marks = int(total or 0)


async def question_count(db: AsyncSession, exam_id: uuid.UUID) -> int:
    return (await db.execute(select(func.count()).select_from(Question).where(Question.exam_id == exam_id))).scalar_one()


def publish_window(exam: Examination, start: datetime | None, end: datetime | None, hours: int | None) -> None:
    now = utcnow()
    exam.start_window = start or now
    min_end = exam.start_window + timedelta(minutes=exam.duration_minutes)
    default_end = exam.start_window + timedelta(hours=hours or get_settings().EXAM_DEFAULT_AVAILABILITY_HOURS)
    exam.end_window = max(end or default_end, min_end)
    if exam.end_window <= exam.start_window:
        raise ApiError(422, "INVALID_WINDOW", "end_window must be after start_window")


# ----------------------------------------------------------- session admission


async def admit_candidate(db: AsyncSession, exam: Examination, candidate: User) -> tuple[ExamSession, bool]:
    """Creates (or resumes) the candidate's single attempt (UNIQUE exam_id,candidate_id).
    Returns (session, resumed)."""
    now = utcnow()
    status = effective_exam_status(exam, now)
    if status == "DRAFT":
        raise ApiError(403, "EXAM_NOT_PUBLISHED", "This exam has not been published yet")
    if status == "SCHEDULED":
        raise ApiError(
            403,
            "EXAM_NOT_STARTED",
            "The exam window has not opened yet",
            {"startWindow": exam.start_window.isoformat(), "endWindow": exam.end_window.isoformat()},
        )

    session = (
        await db.execute(
            select(ExamSession).where(ExamSession.exam_id == exam.exam_id, ExamSession.candidate_id == candidate.user_id)
        )
    ).scalar_one_or_none()

    if session is not None:
        await expire_if_due(db, session)
        if session.status in FINAL_SESSION_STATUSES:
            raise ApiError(409, "ALREADY_SUBMITTED", "You have already submitted this exam")
        if session.status == ACTIVE_SESSION:
            return session, True

    if status == "CLOSED":
        raise ApiError(
            403,
            "EXAM_WINDOW_CLOSED",
            "The exam window is closed",
            {"startWindow": exam.start_window.isoformat(), "endWindow": exam.end_window.isoformat()},
        )

    if session is None:
        session = ExamSession(exam_id=exam.exam_id, candidate_id=candidate.user_id)
        db.add(session)
    session.status = ACTIVE_SESSION
    session.started_at = now
    # Timer is server-authoritative; it never extends past the exam window.
    session.expires_at = min(now + timedelta(minutes=exam.duration_minutes), exam.end_window)
    qids = (
        await db.execute(select(Question.question_id).where(Question.exam_id == exam.exam_id).order_by(Question.order_index))
    ).scalars().all()
    order = [str(q) for q in qids]
    if (exam.settings or {}).get("shuffleQuestions"):
        random.Random(f"{exam.exam_id}:{candidate.user_id}").shuffle(order)
    session.question_order = order
    await db.flush()
    return session, False


# --------------------------------------------------------- submission/grading


async def finalize_session(db: AsyncSession, session: ExamSession, submission_type: str) -> ExamSession:
    """SUBMITTED/FORCED_SUBMITTED -> EVALUATED (academic scoring + proctoring rollup)."""
    if session.status in FINAL_SESSION_STATUSES:
        return session
    now = utcnow()
    exam = await db.get(Examination, session.exam_id)
    session.status = "FORCED_SUBMITTED" if submission_type == "TIMER_EXPIRED" else "SUBMITTED"
    session.submission_type = submission_type
    session.submitted_at = now
    await db.flush()

    questions = (await db.execute(select(Question).where(Question.exam_id == session.exam_id))).scalars().all()
    answers = {
        a.question_id: a
        for a in (await db.execute(select(CandidateAnswer).where(CandidateAnswer.session_id == session.session_id))).scalars()
    }
    negative = float((exam.settings or {}).get("negativeMarking") or 0)
    total = Decimal(0)
    max_total = Decimal(0)
    for q in questions:
        max_total += Decimal(q.marks)
        ans = answers.get(q.question_id)
        if ans is None:
            continue
        awarded = grade(q, ans.selected_options, ans.subjective_text, negative)
        ans.marks_awarded = awarded
        if awarded is not None:
            total += awarded
    session.academic_score = max(Decimal(0), total)
    session.max_academic_score = max_total
    session.status = "EVALUATED"
    session.evaluated_at = now
    await db.flush()
    return session


async def expire_if_due(db: AsyncSession, session: ExamSession) -> bool:
    if session.status == ACTIVE_SESSION and session.expires_at and utcnow() >= session.expires_at:
        await finalize_session(db, session, "TIMER_EXPIRED")
        return True
    return False


async def sweep_expired_sessions(sessionmaker) -> int:
    """Background task: force-submit attempts whose server-side timer expired."""
    async with sessionmaker() as db:
        rows = (
            await db.execute(
                select(ExamSession).where(ExamSession.status == ACTIVE_SESSION, ExamSession.expires_at <= utcnow())
            )
        ).scalars().all()
        exams = {}
        for s in rows:
            await finalize_session(db, s, "TIMER_EXPIRED")
            exams[s.session_id] = s.exam_id
        await db.commit()
    for session_id, exam_id in exams.items():
        await live_bus.publish(live_bus.session_channel(session_id), {"type": "session_closed", "reason": "TIMER_EXPIRED"})
        await live_bus.publish(live_bus.exam_channel(exam_id), {"type": "session_status", "sessionId": str(session_id), "status": "FORCED_SUBMITTED"})
    return len(rows)


async def session_flag_counts(db: AsyncSession, session_id: uuid.UUID) -> dict[str, int]:
    rows = (
        await db.execute(
            select(ProctoringEvent.event_type, func.count())
            .where(ProctoringEvent.session_id == session_id)
            .group_by(ProctoringEvent.event_type)
        )
    ).all()
    return {etype: int(n) for etype, n in rows}
