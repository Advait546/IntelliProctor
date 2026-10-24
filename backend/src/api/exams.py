"""Examination management & candidate attempt lifecycle (sections 10, 13.2)."""

from __future__ import annotations

import random
import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db, utcnow
from ..deps import (
    ExamSessionContext,
    get_current_user,
    get_exam_session_ctx,
    is_admin,
    passkey_limiter,
    require_examiner,
    require_student,
)
from ..errors import ApiError
from ..models import CandidateAnswer, Examination, ExamSession, Question, QuestionBankItem, User
from ..schemas import (
    DraftAnswerRequest,
    ExamCreateRequest,
    ExamUpdateRequest,
    GenerateExamRequest,
    PublishRequest,
    QuestionsAppendRequest,
    SubmitRequest,
    VerifyPasskeyRequest,
)
from ..security import create_exam_session_token
from ..services import cv_client, live_bus, live_state
from ..services.exams import (
    ACTIVE_SESSION,
    admit_candidate,
    assign_passkey,
    effective_exam_status,
    expire_if_due,
    find_exam_by_passkey,
    finalize_session,
    merge_settings,
    publish_window,
    question_count,
    replace_questions,
    reveal_passkey,
    session_flag_counts,
)
from ..services.questions import answer_to_ui, normalize_answer, shuffled_options, to_ui
from ..services.views import exam_to_ui, iso

router = APIRouter(prefix="/exams", tags=["exams"])


# ------------------------------------------------------------------ helpers


async def exam_stats(db: AsyncSession, exam_ids: list[uuid.UUID]) -> dict[uuid.UUID, dict]:
    if not exam_ids:
        return {}
    final = ExamSession.status.in_(("SUBMITTED", "FORCED_SUBMITTED", "EVALUATED"))
    rows = (
        await db.execute(
            select(
                ExamSession.exam_id,
                func.count(ExamSession.session_id),
                func.sum(case((ExamSession.status == ACTIVE_SESSION, 1), else_=0)),
                func.sum(case((final, 1), else_=0)),
                func.avg(ExamSession.current_suspicion_score),
                func.sum(case((ExamSession.is_suspicious, 1), else_=0)),
                func.avg(
                    case(
                        (
                            (ExamSession.max_academic_score > 0),
                            ExamSession.academic_score * 100.0 / ExamSession.max_academic_score,
                        ),
                        else_=None,
                    )
                ),
            )
            .where(ExamSession.exam_id.in_(exam_ids))
            .group_by(ExamSession.exam_id)
        )
    ).all()
    qcounts = dict(
        (
            await db.execute(
                select(Question.exam_id, func.count(Question.question_id)).where(Question.exam_id.in_(exam_ids)).group_by(Question.exam_id)
            )
        ).all()
    )
    out = {eid: {"questions": int(qcounts.get(eid, 0))} for eid in exam_ids}
    for eid, n, active, submitted, avg_s, susp, avg_pct in rows:
        out[eid].update(
            {
                "sessions": int(n or 0),
                "active": int(active or 0),
                "submitted": int(submitted or 0),
                "avg_suspicion": round(float(avg_s or 0), 1),
                "suspicious": int(susp or 0),
                "avg_score_pct": round(float(avg_pct or 0), 1),
            }
        )
    return out


async def owned_exam(db: AsyncSession, exam_id: uuid.UUID, user: User) -> Examination:
    """IDOR protection (section 11.3): examiners only touch their own exams."""
    exam = await db.get(Examination, exam_id)
    if exam is None:
        raise ApiError(404, "EXAM_NOT_FOUND", "Exam not found")
    if exam.examiner_id != user.user_id and not is_admin(user):
        raise ApiError(403, "FORBIDDEN", "You do not own this exam")
    return exam


async def exam_detail(db: AsyncSession, exam: Examination) -> dict:
    stats = (await exam_stats(db, [exam.exam_id]))[exam.exam_id]
    questions = (
        await db.execute(select(Question).where(Question.exam_id == exam.exam_id).order_by(Question.order_index))
    ).scalars().all()
    out = exam_to_ui(exam, stats=stats, include_passkey=True, question_count=len(questions))
    out["questions"] = [to_ui(q, include_answer=True) for q in questions]
    return out


def _session_ctx_for_exam(ctx: ExamSessionContext, exam_id: uuid.UUID) -> ExamSession:
    if ctx.session.exam_id != exam_id:
        raise ApiError(403, "FORBIDDEN", "This session token is not valid for this exam")
    return ctx.session


# ---------------------------------------------------------------- examiner


@router.get("")
async def list_exams(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.role == "student":
        rows = (
            await db.execute(
                select(ExamSession, Examination)
                .join(Examination, Examination.exam_id == ExamSession.exam_id)
                .where(ExamSession.candidate_id == user.user_id)
                .order_by(ExamSession.created_at.desc())
            )
        ).all()
        return [
            {**exam_to_ui(exam), "sessionId": str(s.session_id), "sessionStatus": s.status, "submittedAt": iso(s.submitted_at)}
            for s, exam in rows
        ]
    stmt = select(Examination).order_by(Examination.created_at.desc())
    if not is_admin(user):
        stmt = stmt.where(Examination.examiner_id == user.user_id)
    exams = (await db.execute(stmt)).scalars().all()
    stats = await exam_stats(db, [e.exam_id for e in exams])
    return [exam_to_ui(e, stats=stats.get(e.exam_id), include_passkey=True) for e in exams]


@router.post("", status_code=201)
async def create_exam(body: ExamCreateRequest, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    exam = Examination(
        exam_id=uuid.uuid4(),
        examiner_id=user.user_id,
        title=body.title.strip(),
        subject=(body.subject or "General").strip() or "General",
        duration_minutes=body.minutes,
        instructions=body.instructions_text(),
        settings=merge_settings(body.merged_settings()),
        status="DRAFT",
        is_published=False,
        start_window=body.startWindow or utcnow(),
        end_window=body.endWindow or utcnow(),
    )
    passkey = await assign_passkey(db, exam, body.passkey)
    publish_window(exam, body.startWindow, body.endWindow, body.availabilityHours)
    db.add(exam)
    await db.flush()
    await replace_questions(db, exam, body.questions, append=True)
    if body.publish:
        if await question_count(db, exam.exam_id) == 0:
            raise ApiError(422, "NO_QUESTIONS", "Add at least one question before publishing")
        exam.is_published = True
        exam.status = "SCHEDULED" if exam.start_window > utcnow() else "ACTIVE"
    await db.commit()
    detail = await exam_detail(db, exam)
    detail["code"] = passkey
    return {"success": True, "exam": detail, "passkey": passkey}


@router.post("/generate", status_code=201)
async def generate_exam(body: GenerateExamRequest, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    """'Generate Test' workflow: assembles an exam from the examiner's question
    bank filtered by topic / difficulty (no external LLM is involved)."""
    stmt = select(QuestionBankItem).where(QuestionBankItem.owner_id == user.user_id)
    if body.topics:
        stmt = stmt.where(QuestionBankItem.topic.in_(body.topics))
    if body.difficulty:
        stmt = stmt.where(func.lower(QuestionBankItem.difficulty) == body.difficulty.lower())
    pool = (await db.execute(stmt)).scalars().all()
    if not pool:
        raise ApiError(422, "EMPTY_QUESTION_BANK", "No question-bank items match these filters")
    picked = random.sample(pool, min(body.count, len(pool)))
    questions = [to_ui(q, include_answer=True) for q in picked]
    req = ExamCreateRequest(
        title=body.title, subject=body.subject, durationMinutes=body.durationMinutes, questions=questions, publish=body.publish, settings=body.settings
    )
    return await create_exam(req, user, db)


@router.get("/lookup/{code}", dependencies=[Depends(passkey_limiter)])
async def lookup_exam_code(code: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Public PIN check for the join page. Reveals only non-sensitive metadata."""
    exam = await find_exam_by_passkey(db, code)
    if exam is None or not exam.is_published:
        return {"valid": False, "error": "Exam code not found or not currently active."}
    status = effective_exam_status(exam)
    return {
        "valid": status in ("ACTIVE", "SCHEDULED"),
        "status": status,
        "code": code.upper(),
        "examTitle": exam.title,
        "subject": exam.subject,
        "durationMinutes": exam.duration_minutes,
        "startWindow": iso(exam.start_window),
        "endWindow": iso(exam.end_window),
        "error": None if status in ("ACTIVE", "SCHEDULED") else "This exam is closed.",
    }


@router.post("/verify-passkey", dependencies=[Depends(passkey_limiter)])
async def verify_passkey_and_admit(body: VerifyPasskeyRequest, user: User = Depends(require_student), db: AsyncSession = Depends(get_db)):
    """Validates the passkey + time window, creates/resumes the attempt and mints
    the scoped Exam Session Token (section 10.3)."""
    exam = await find_exam_by_passkey(db, body.passkey)
    if exam is None or not exam.is_published:
        raise ApiError(403, "INVALID_PASSKEY", "The exam passkey entered is invalid or the exam window is closed.")
    session, resumed = await admit_candidate(db, exam, user)
    await db.commit()
    token = create_exam_session_token(session.session_id, user.user_id, exam.exam_id, session.expires_at)
    if not resumed:
        await live_bus.publish(
            live_bus.exam_channel(exam.exam_id),
            {"type": "session_status", "sessionId": str(session.session_id), "status": session.status, "candidateName": user.full_name},
        )
    return {
        "sessionToken": token,
        "resumed": resumed,
        "session": {
            "sessionId": str(session.session_id),
            "status": session.status,
            "startedAt": iso(session.started_at),
            "expiresAt": iso(session.expires_at),
            "serverNow": iso(utcnow()),
        },
        "exam": exam_to_ui(exam, question_count=await question_count(db, exam.exam_id)),
    }


@router.get("/{exam_id}")
async def get_exam(exam_id: uuid.UUID, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    return await exam_detail(db, await owned_exam(db, exam_id, user))


@router.put("/{exam_id}")
async def update_exam(exam_id: uuid.UUID, body: ExamUpdateRequest, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    exam = await owned_exam(db, exam_id, user)
    if body.title:
        exam.title = body.title.strip()
    if body.subject:
        exam.subject = body.subject.strip()
    if body.durationMinutes or body.duration:
        exam.duration_minutes = body.minutes
    if body.instructions is not None:
        exam.instructions = body.instructions_text()
    merged = body.merged_settings()
    if merged:
        exam.settings = merge_settings({**(exam.settings or {}), **merged})
    if body.passkey:
        await assign_passkey(db, exam, body.passkey)
    if body.startWindow or body.endWindow or body.availabilityHours:
        publish_window(exam, body.startWindow or exam.start_window, body.endWindow, body.availabilityHours)
    if body.questions is not None:
        await replace_questions(db, exam, body.questions)
    await db.commit()
    return {"success": True, "exam": await exam_detail(db, exam)}


@router.delete("/{exam_id}")
async def delete_exam(exam_id: uuid.UUID, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    exam = await owned_exam(db, exam_id, user)
    if (await db.execute(select(ExamSession.session_id).where(ExamSession.exam_id == exam.exam_id).limit(1))).first():
        raise ApiError(409, "EXAM_HAS_ATTEMPTS", "Exams with candidate attempts cannot be deleted (audit retention). Close it instead.")
    await db.delete(exam)
    await db.commit()
    return {"success": True}


@router.post("/{exam_id}/questions", status_code=201)
async def append_questions(exam_id: uuid.UUID, body: QuestionsAppendRequest, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    exam = await owned_exam(db, exam_id, user)
    await replace_questions(db, exam, body.questions, append=True)
    await db.commit()
    return {"success": True, "count": len(body.questions), "totalQuestions": await question_count(db, exam.exam_id)}


@router.post("/{exam_id}/publish")
async def publish_exam(exam_id: uuid.UUID, body: PublishRequest | None = None, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    exam = await owned_exam(db, exam_id, user)
    body = body or PublishRequest()
    if await question_count(db, exam.exam_id) == 0:
        raise ApiError(422, "NO_QUESTIONS", "Add at least one question before publishing")
    passkey = await assign_passkey(db, exam, body.passkey) if body.passkey else reveal_passkey(exam)
    publish_window(exam, body.startWindow, body.endWindow, body.availabilityHours)
    exam.is_published = True
    exam.status = "SCHEDULED" if exam.start_window > utcnow() else "ACTIVE"
    await db.commit()
    return {"success": True, "publishedAt": iso(utcnow()), "passkey": passkey, "exam": await exam_detail(db, exam)}


@router.post("/{exam_id}/close")
async def close_exam(exam_id: uuid.UUID, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    exam = await owned_exam(db, exam_id, user)
    exam.status = "CLOSED"
    exam.end_window = min(exam.end_window, utcnow())
    await db.commit()
    return {"success": True, "exam": exam_to_ui(exam, include_passkey=True)}


@router.get("/{exam_id}/passkey")
async def get_passkey(exam_id: uuid.UUID, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    exam = await owned_exam(db, exam_id, user)
    return {"passkey": reveal_passkey(exam)}


@router.post("/{exam_id}/passkey/regenerate")
async def regenerate_passkey(exam_id: uuid.UUID, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    exam = await owned_exam(db, exam_id, user)
    passkey = await assign_passkey(db, exam)
    await db.commit()
    return {"passkey": passkey}


# ---------------------------------------------------------------- candidate


@router.get("/{exam_id}/questions")
async def candidate_questions(exam_id: uuid.UUID, ctx: ExamSessionContext = Depends(get_exam_session_ctx), db: AsyncSession = Depends(get_db)):
    """Question set WITHOUT answer keys (README section 12.4), in this
    candidate's order, plus saved drafts and the server-authoritative timer so a
    reload resumes exactly where the candidate was (FRONTEND section 4.3)."""
    session = _session_ctx_for_exam(ctx, exam_id)
    if await expire_if_due(db, session):
        await db.commit()
    exam = await db.get(Examination, exam_id)
    questions = {q.question_id: q for q in (await db.execute(select(Question).where(Question.exam_id == exam_id))).scalars()}
    order = [uuid.UUID(q) for q in (session.question_order or [])] or sorted(questions, key=lambda k: questions[k].order_index)
    order = [qid for qid in order if qid in questions] + [qid for qid in questions if qid not in set(order)]
    shuffle_opts = bool((exam.settings or {}).get("shuffleOptions"))
    out_q = []
    for qid in order:
        ui = to_ui(questions[qid], include_answer=False)
        if shuffle_opts:
            ui = shuffled_options(ui, f"{session.session_id}:{qid}")
        out_q.append(ui)
    answers = (await db.execute(select(CandidateAnswer).where(CandidateAnswer.session_id == session.session_id))).scalars().all()
    return {
        "exam": exam_to_ui(exam, question_count=len(out_q)),
        "session": {
            "sessionId": str(session.session_id),
            "status": session.status,
            "startedAt": iso(session.started_at),
            "expiresAt": iso(session.expires_at),
            "serverNow": iso(utcnow()),
        },
        "questions": out_q,
        "answers": {str(a.question_id): answer_to_ui(questions[a.question_id].question_type, a.selected_options, a.subjective_text) for a in answers if a.question_id in questions},
        "markedForReview": {str(a.question_id): True for a in answers if a.is_marked_for_review},
    }


async def _upsert_answer(db: AsyncSession, session: ExamSession, question: Question, answer, marked: bool | None) -> CandidateAnswer:
    row = (
        await db.execute(
            select(CandidateAnswer).where(CandidateAnswer.session_id == session.session_id, CandidateAnswer.question_id == question.question_id)
        )
    ).scalar_one_or_none()
    selected, text = normalize_answer(question.question_type, answer)
    if row is None:
        row = CandidateAnswer(session_id=session.session_id, question_id=question.question_id)
        db.add(row)
    row.selected_options = selected
    row.subjective_text = text
    if marked is not None:
        row.is_marked_for_review = marked
    row.last_saved_at = utcnow()
    return row


@router.post("/{exam_id}/draft")
async def save_draft(exam_id: uuid.UUID, body: DraftAnswerRequest, ctx: ExamSessionContext = Depends(get_exam_session_ctx), db: AsyncSession = Depends(get_db)):
    session = _session_ctx_for_exam(ctx, exam_id)
    if await expire_if_due(db, session):
        await db.commit()
    if session.status != ACTIVE_SESSION:
        raise ApiError(409, "SESSION_NOT_ACTIVE", f"Session is {session.status}")
    question = await db.get(Question, body.questionId)
    if question is None or question.exam_id != exam_id:
        raise ApiError(404, "QUESTION_NOT_FOUND", "Question not found in this exam")
    row = await _upsert_answer(db, session, question, body.answer, body.markedForReview)
    await db.commit()
    return {"status": "saved", "questionId": str(question.question_id), "timestamp": iso(row.last_saved_at)}


@router.post("/{exam_id}/submit")
async def submit_exam(exam_id: uuid.UUID, body: SubmitRequest | None = None, ctx: ExamSessionContext = Depends(get_exam_session_ctx), db: AsyncSession = Depends(get_db)):
    session = _session_ctx_for_exam(ctx, exam_id)
    expired = await expire_if_due(db, session)
    if not expired and session.status == ACTIVE_SESSION:
        if body and body.answers:
            questions = {str(q.question_id): q for q in (await db.execute(select(Question).where(Question.exam_id == exam_id))).scalars()}
            for qid, ans in body.answers.items():
                if qid in questions:
                    await _upsert_answer(db, session, questions[qid], ans, None)
            await db.flush()
        await finalize_session(db, session, "MANUAL")
    elif session.status not in ("SUBMITTED", "FORCED_SUBMITTED", "EVALUATED"):
        raise ApiError(409, "SESSION_NOT_ACTIVE", f"Session is {session.status}")
    await db.commit()

    await cv_client.end_session(str(session.session_id))
    live_state.drop(session.session_id)
    await live_bus.publish(
        live_bus.exam_channel(exam_id), {"type": "session_status", "sessionId": str(session.session_id), "status": session.status}
    )

    total_q = await question_count(db, exam_id)
    attempted = (
        await db.execute(
            select(func.count()).select_from(CandidateAnswer).where(
                CandidateAnswer.session_id == session.session_id,
                (CandidateAnswer.selected_options.is_not(None)) | (CandidateAnswer.subjective_text.is_not(None)),
            )
        )
    ).scalar_one()
    flags = await session_flag_counts(db, session.session_id)
    return {
        "success": True,
        "status": session.status,
        "submissionType": session.submission_type,
        "submittedAt": iso(session.submitted_at),
        "attemptedCount": int(attempted),
        "skippedCount": max(0, total_q - int(attempted)),
        "totalQuestions": total_q,
        # Sanitized summary for the candidate (FRONTEND 16.2): counts only,
        # never scores, evidence or examiner notes.
        "incidentsCount": sum(n for t, n in flags.items() if t not in ("TAB_FOCUS",)),
    }
