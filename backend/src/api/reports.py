"""Reports & result generation (section 15) with role-scoped authorization
profiles (section 15.3) and IDOR isolation (Test 17)."""

from __future__ import annotations

import csv
import io
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_current_user, is_admin, require_examiner
from ..errors import ApiError
from ..models import (
    CandidateAnswer,
    Examination,
    ExamSession,
    ProctoringEvent,
    Question,
    SuspicionScoreLedger,
    User,
)
from ..services import scoring
from ..services.exams import effective_exam_status, reveal_passkey
from ..services.questions import answer_to_ui, to_ui
from ..services.views import UI_EXAM_STATUS, event_to_ui, iso
from .exams import exam_stats
from .proctor import latest_reviews, points_by_event

router = APIRouter(prefix="/reports", tags=["reports"])


def _pct(v: float) -> str:
    return f"{v:.1f}%"


async def _proctoring_summary(db: AsyncSession, session: ExamSession) -> dict:
    counts = dict(
        (
            await db.execute(
                select(ProctoringEvent.event_type, func.count()).where(ProctoringEvent.session_id == session.session_id).group_by(ProctoringEvent.event_type)
            )
        ).all()
    )
    dismissed_scored = (
        await db.execute(
            select(func.coalesce(func.sum(SuspicionScoreLedger.applied_points), 0))
            .join(ProctoringEvent, ProctoringEvent.event_id == SuspicionScoreLedger.event_id)
            .where(SuspicionScoreLedger.session_id == session.session_id, ProctoringEvent.review_status == "DISMISSED")
        )
    ).scalar_one()
    adjusted = max(0, session.current_suspicion_score - int(dismissed_scored or 0))
    return {
        "suspicionScore": session.current_suspicion_score,
        "peakSuspicionScore": session.peak_suspicion_score,
        "isSuspicious": session.is_suspicious,
        "officialStatus": scoring.official_status_label(session.current_suspicion_score, bool(dismissed_scored)),
        # Informational only: what the score would be without dismissed events.
        # The automated ledger score above is never reduced (section 5.7).
        "reviewAdjustedScore": adjusted,
        "reviewAdjustedSuspicious": scoring.is_suspicious(adjusted),
        "anomalyCounts": {
            "headTurns": session.total_head_turns_completed,
            "headTurnGroupsScored": session.total_head_turns_completed // scoring.HEAD_TURNS_PER_GROUP,
            "phone": int(counts.get(scoring.EVENT_PHONE, 0)),
            "book": int(counts.get(scoring.EVENT_BOOK, 0)),
            "tabSwitches": session.tab_switch_count,
            "tabHiddenTotalMs": session.tab_hidden_total_ms,
            "candidateAbsent": int(counts.get(scoring.EVENT_ABSENT, 0)),
            "multipleFaces": int(counts.get(scoring.EVENT_MULTIPLE_FACES, 0)),
            "manualFlags": int(counts.get(scoring.EVENT_MANUAL_FLAG, 0)),
        },
        "manuallyFlagged": session.manually_flagged,
    }


async def _session_report(db: AsyncSession, session: ExamSession, examiner_view: bool) -> dict:
    exam = await db.get(Examination, session.exam_id)
    candidate = await db.get(User, session.candidate_id)
    proctoring = await _proctoring_summary(db, session)
    events = (
        await db.execute(select(ProctoringEvent).where(ProctoringEvent.session_id == session.session_id).order_by(ProctoringEvent.timestamp))
    ).scalars().all()
    pts = await points_by_event(db, session.session_id)
    reviews = await latest_reviews(db, [e.event_id for e in events]) if examiner_view else {}
    total = float(session.max_academic_score or 0)
    score = float(session.academic_score) if session.academic_score is not None else None
    report = {
        "reportType": "session",
        "sessionId": str(session.session_id),
        "exam": {"id": str(exam.exam_id), "title": exam.title, "subject": exam.subject, "durationMinutes": exam.duration_minutes},
        "candidate": {"id": str(candidate.user_id), "name": candidate.full_name, "rollNumber": candidate.candidate_id_number},
        "status": session.status,
        "submissionType": session.submission_type,
        "startedAt": iso(session.started_at),
        "submittedAt": iso(session.submitted_at),
        "academic": {
            "score": score,
            "maxScore": total,
            "percentage": round(score * 100 / total, 1) if score is not None and total > 0 else None,
            "evaluated": session.status == "EVALUATED",
        },
        "proctoring": proctoring,
        "timeline": [event_to_ui(e, points=pts.get(e.event_id, 0), review=reviews.get(e.event_id), examiner_view=examiner_view) for e in events],
    }
    if examiner_view:
        questions = (await db.execute(select(Question).where(Question.exam_id == exam.exam_id).order_by(Question.order_index))).scalars().all()
        answers = {a.question_id: a for a in (await db.execute(select(CandidateAnswer).where(CandidateAnswer.session_id == session.session_id))).scalars()}
        report["answers"] = [
            {
                **to_ui(q, include_answer=True),
                "candidateAnswer": answer_to_ui(q.question_type, answers[q.question_id].selected_options, answers[q.question_id].subjective_text)
                if q.question_id in answers
                else None,
                "marksAwarded": float(answers[q.question_id].marks_awarded)
                if q.question_id in answers and answers[q.question_id].marks_awarded is not None
                else None,
            }
            for q in questions
        ]
        report["candidate"]["email"] = candidate.email
    return report


async def _exam_report(db: AsyncSession, exam: Examination) -> dict:
    stats = (await exam_stats(db, [exam.exam_id]))[exam.exam_id]
    rows = (
        await db.execute(
            select(ExamSession, User).join(User, User.user_id == ExamSession.candidate_id).where(ExamSession.exam_id == exam.exam_id).order_by(User.full_name)
        )
    ).all()
    roster = []
    for s, u in rows:
        total = float(s.max_academic_score or 0)
        score = float(s.academic_score) if s.academic_score is not None else None
        roster.append(
            {
                "sessionId": str(s.session_id),
                "name": u.full_name,
                "rollNumber": u.candidate_id_number,
                "status": s.status,
                "academicScore": score,
                "maxScore": total,
                "percentage": round(score * 100 / total, 1) if score is not None and total > 0 else None,
                "suspicionScore": s.current_suspicion_score,
                "isSuspicious": s.is_suspicious,
                "officialStatus": scoring.official_status_label(s.current_suspicion_score),
                "tabSwitches": s.tab_switch_count,
                "headTurns": s.total_head_turns_completed,
                "submittedAt": iso(s.submitted_at),
            }
        )
    return {"reportType": "exam", **(await _exam_summary(db, exam, stats)), "roster": roster}


async def _exam_summary(db: AsyncSession, exam: Examination, stats: dict) -> dict:
    flagged = (
        await db.execute(
            select(func.count())
            .select_from(ProctoringEvent)
            .join(ExamSession, ExamSession.session_id == ProctoringEvent.session_id)
            .where(ExamSession.exam_id == exam.exam_id, ProctoringEvent.severity.in_(("HIGH", "CRITICAL")))
        )
    ).scalar_one()
    sessions = stats.get("sessions", 0)
    return {
        "id": str(exam.exam_id),
        "examName": exam.title,
        "code": reveal_passkey(exam),
        "date": exam.start_window.date().isoformat(),
        "students": sessions,
        "avgScore": _pct(stats.get("avg_score_pct", 0)),
        "avgRiskScore": f"{stats.get('avg_suspicion', 0):.1f}",
        "completionRate": _pct(100 * stats.get("submitted", 0) / sessions if sessions else 0),
        "incidentsFlagged": int(flagged),
        "suspiciousCandidates": stats.get("suspicious", 0),
        "status": UI_EXAM_STATUS[effective_exam_status(exam)],
    }


@router.get("")
async def list_reports(user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    stmt = select(Examination).order_by(Examination.created_at.desc())
    if not is_admin(user):
        stmt = stmt.where(Examination.examiner_id == user.user_id)
    exams = (await db.execute(stmt)).scalars().all()
    stats = await exam_stats(db, [e.exam_id for e in exams])
    return [await _exam_summary(db, e, stats[e.exam_id]) for e in exams]


@router.get("/{report_id}")
async def get_report(report_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """``report_id`` is a session id (candidate or examiner) or an exam id (examiner)."""
    session = await db.get(ExamSession, report_id)
    if session is not None:
        if user.role == "student":
            if session.candidate_id != user.user_id:
                raise ApiError(403, "FORBIDDEN", "You can only view your own report")
            if session.status == "IN_PROGRESS":
                raise ApiError(409, "SESSION_NOT_FINISHED", "Your report is available after submission")
            return await _session_report(db, session, examiner_view=False)
        exam = await db.get(Examination, session.exam_id)
        if exam.examiner_id != user.user_id and not is_admin(user):
            raise ApiError(403, "FORBIDDEN", "You do not own this exam")
        return await _session_report(db, session, examiner_view=True)
    exam = await db.get(Examination, report_id)
    if exam is None:
        raise ApiError(404, "REPORT_NOT_FOUND", "Report not found")
    if user.role == "student" or (exam.examiner_id != user.user_id and not is_admin(user)):
        raise ApiError(403, "FORBIDDEN", "You do not have access to this report")
    return await _exam_report(db, exam)


@router.get("/{report_id}/download")
async def download_report(report_id: str, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    stmt = select(Examination)
    if not is_admin(user):
        stmt = stmt.where(Examination.examiner_id == user.user_id)
    filename = "intelliproctor-all-exams.csv"
    if report_id != "all":
        try:
            eid = uuid.UUID(report_id)
        except ValueError as exc:
            raise ApiError(404, "REPORT_NOT_FOUND", "Report not found") from exc
        stmt = stmt.where(Examination.exam_id == eid)
    exams = (await db.execute(stmt)).scalars().all()
    if report_id != "all" and not exams:
        raise ApiError(404, "REPORT_NOT_FOUND", "Report not found")

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(
        ["Exam Code", "Exam Title", "Candidate", "PRN", "Session Status", "Submission", "Academic Score", "Max Score",
         "Suspicion Score (0-1000)", "Official Status", "Head Turns", "Phone Episodes", "Book Episodes",
         "Tab Switches", "Tab Hidden (s)", "Started At", "Submitted At"]
    )
    for exam in exams:
        if report_id != "all":
            filename = f"{reveal_passkey(exam) or exam.exam_id}-report.csv"
        rows = (
            await db.execute(select(ExamSession, User).join(User, User.user_id == ExamSession.candidate_id).where(ExamSession.exam_id == exam.exam_id))
        ).all()
        for s, u in rows:
            counts = dict(
                (
                    await db.execute(
                        select(ProctoringEvent.event_type, func.count()).where(ProctoringEvent.session_id == s.session_id).group_by(ProctoringEvent.event_type)
                    )
                ).all()
            )
            w.writerow(
                [reveal_passkey(exam), exam.title, u.full_name, u.candidate_id_number, s.status, s.submission_type or "",
                 s.academic_score if s.academic_score is not None else "", s.max_academic_score or "",
                 s.current_suspicion_score, scoring.official_status_label(s.current_suspicion_score),
                 s.total_head_turns_completed, counts.get(scoring.EVENT_PHONE, 0), counts.get(scoring.EVENT_BOOK, 0),
                 s.tab_switch_count, round(s.tab_hidden_total_ms / 1000, 1), iso(s.started_at) or "", iso(s.submitted_at) or ""]
            )
    return StreamingResponse(
        iter([buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
