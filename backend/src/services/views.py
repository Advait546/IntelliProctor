"""Response shaping: DB rows -> the JSON shapes the React frontend renders.

Labels follow FRONTEND_ARCHITECTURE.md section 14.2: observations are described
as what was observed ("Sideways Head Turn (Yaw 42 deg)"), never as "cheating".
"""

from __future__ import annotations

from datetime import datetime

from ..models import Examination, ExamSession, ProctoringEvent, User
from . import live_state, scoring
from .exams import effective_exam_status, reveal_passkey

UI_EXAM_STATUS = {"DRAFT": "Draft", "SCHEDULED": "Scheduled", "ACTIVE": "Active", "CLOSED": "Completed"}
UI_SEVERITY = {"CRITICAL": "critical", "HIGH": "critical", "MEDIUM": "warning", "LOW": "info"}


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat().replace("+00:00", "Z") if dt else None


def exam_to_ui(exam: Examination, *, stats: dict | None = None, include_passkey: bool = False, question_count: int | None = None) -> dict:
    status = effective_exam_status(exam)
    stats = stats or {}
    out = {
        "id": str(exam.exam_id),
        "examId": str(exam.exam_id),
        "title": exam.title,
        "subject": exam.subject,
        "duration": exam.duration_minutes,
        "durationMinutes": exam.duration_minutes,
        "totalMarks": exam.total_marks,
        "totalQuestions": question_count if question_count is not None else stats.get("questions", 0),
        "status": UI_EXAM_STATUS[status],
        "statusCode": status,
        "isPublished": exam.is_published,
        "startWindow": iso(exam.start_window),
        "endWindow": iso(exam.end_window),
        "scheduledDate": exam.start_window.date().isoformat() if exam.start_window else None,
        "scheduledTime": iso(exam.start_window),
        "instructions": exam.instructions,
        "settings": exam.settings or {},
        "registeredStudents": stats.get("sessions", 0),
        "activeStudents": stats.get("active", 0),
        "submittedStudents": stats.get("submitted", 0),
        "avgScore": stats.get("avg_score_pct", 0),
        "avgRiskScore": stats.get("avg_suspicion", 0),
        "suspiciousCount": stats.get("suspicious", 0),
        "createdAt": iso(exam.created_at),
    }
    if include_passkey:
        out["code"] = reveal_passkey(exam)
    return out


def _gaze_label(obs: dict) -> str:
    return obs.get("gazeDirection") or ("Away" if obs.get("faceCount") == 0 else "Center")


def live_status(session: ExamSession, obs: dict) -> str:
    if session.is_suspicious or session.manually_flagged:
        return "Critical"
    if (
        session.current_suspicion_score > 0
        or obs.get("phoneInView")
        or obs.get("bookInView")
        or obs.get("multipleFaces")
        or obs.get("faceCount") == 0
        or obs.get("lookingAway")
        or session.last_tab_blur_server_at is not None
    ):
        return "Warning"
    return "Safe"


def session_card(session: ExamSession, candidate: User, exam: Examination, last_incident: str | None = None, warning_count: int = 0) -> dict:
    st = live_state.peek(session.session_id)
    obs = (st.observation if st else {}) or {}
    pose = obs.get("headPose") or {}
    seen = live_state.seconds_since_seen(session.session_id)
    return {
        "id": str(session.session_id),
        "sessionId": str(session.session_id),
        "examId": str(exam.exam_id),
        "examTitle": exam.title,
        "candidateId": str(candidate.user_id),
        "rollNumber": candidate.candidate_id_number or candidate.email,
        "name": candidate.full_name,
        "avatar": None,
        "sessionStatus": session.status,
        # Authoritative backend score (0..1000) -- the frontend only displays it.
        "riskScore": session.current_suspicion_score,
        "suspicionScore": session.current_suspicion_score,
        "isSuspicious": session.is_suspicious,
        "status": live_status(session, obs),
        "officialStatus": scoring.official_status_label(session.current_suspicion_score),
        "manuallyFlagged": session.manually_flagged,
        "faceVisible": obs.get("faceCount", 1) != 0 if obs else True,
        "faceCount": obs.get("faceCount"),
        "phoneDetected": bool(obs.get("phoneInView")),
        "bookDetected": bool(obs.get("bookInView")),
        "multiplePersons": bool(obs.get("multipleFaces")),
        "gazeDirection": _gaze_label(obs) if obs else "Center",
        "headPose": {"pitch": pose.get("pitch", 0), "yaw": pose.get("yaw", 0), "roll": pose.get("roll", 0)},
        "warningCount": warning_count,
        "headTurnsCompleted": session.total_head_turns_completed,
        "headTurnsPending": session.head_turn_pending_count,
        "tabSwitchCount": session.tab_switch_count,
        "tabHiddenTotalMs": session.tab_hidden_total_ms,
        "tabCurrentlyHidden": session.last_tab_blur_server_at is not None,
        "lastIncident": last_incident or "None",
        "cvOnline": bool(st and st.cv_online),
        "hasSnapshot": bool(st and st.snapshot_jpeg),
        "connection": "online" if seen is not None and seen < 10 else ("stale" if seen is not None else "offline"),
        "startedAt": iso(session.started_at),
        "expiresAt": iso(session.expires_at),
        "submittedAt": iso(session.submitted_at),
    }


def event_label(ev: ProctoringEvent) -> tuple[str, str]:
    d = ev.details or {}
    pose = ev.head_pose_angles or {}
    conf = f" ({float(ev.confidence) * 100:.0f}% confidence)" if ev.confidence is not None else ""
    t = ev.event_type
    if t == scoring.EVENT_PHONE:
        return "Phone Detected (YOLO)", f"Cell phone detection episode confirmed by temporal filter{conf}."
    if t == scoring.EVENT_BOOK:
        return "Book / Notes Detected (YOLO)", f"Book or notes detection episode confirmed by temporal filter{conf}."
    if t == scoring.EVENT_HEAD_TURN:
        yaw = pose.get("yaw")
        secs = (ev.duration_ms or 0) / 1000
        yaw_txt = f"Yaw {yaw:+.0f} deg, " if isinstance(yaw, (int, float)) else ""
        return "Sideways Head Turn", f"Head pose outside neutral range ({yaw_txt}{secs:.1f} s) then returned."
    if t == scoring.EVENT_TAB_BLUR:
        return "Browser Tab Hidden", "Exam tab lost visibility / window focus."
    if t == scoring.EVENT_TAB_FOCUS:
        secs = (ev.duration_ms or 0) / 1000
        extra = " Client/server timing mismatch." if ev.timing_discrepancy else ""
        return "Returned to Exam Tab", f"Away for {secs:.1f} s (server-measured).{extra}"
    if t == scoring.EVENT_ABSENT:
        secs = (ev.duration_ms or 0) / 1000
        return "Candidate Absent", f"No face detected for {max(secs, 10):.0f}+ seconds."
    if t == scoring.EVENT_MULTIPLE_FACES:
        return "Multiple Faces in Frame", f"{d.get('faceCount', 2)} faces detected by MediaPipe."
    if t == scoring.EVENT_MANUAL_FLAG:
        return "Manual Examiner Flag", d.get("reason") or "Flagged for review by examiner."
    return t, ""


def event_to_ui(ev: ProctoringEvent, *, points: int = 0, review=None, examiner_view: bool = True) -> dict:
    title, detail = event_label(ev)
    out = {
        "id": str(ev.event_id),
        "eventId": str(ev.event_id),
        "sessionId": str(ev.session_id),
        "eventType": ev.event_type,
        "source": ev.event_source,
        "event": title,
        "detail": detail,
        "severity": UI_SEVERITY.get(ev.severity, "info"),
        "severityCode": ev.severity,
        "time": iso(ev.timestamp),
        "timestamp": iso(ev.timestamp),
        "durationMs": ev.duration_ms,
        "pointsApplied": points,
        "reviewStatus": ev.review_status,
    }
    if examiner_view:
        out.update(
            {
                "episodeId": ev.episode_id,
                "confidence": float(ev.confidence) if ev.confidence is not None else None,
                "boundingBox": ev.bounding_box,
                "headPose": ev.head_pose_angles,
                "evidenceStatus": ev.evidence_status,
                "hasEvidence": ev.evidence_status == "STORED",
                "isClockSkewed": ev.is_clock_skewed,
                "timingDiscrepancy": ev.timing_discrepancy,
                "serverReceivedAt": iso(ev.server_received_at),
                "details": ev.details or {},
                "review": review,
            }
        )
    return out


def review_to_ui(review, examiner_name: str | None) -> dict:
    return {
        "reviewId": str(review.review_id),
        "action": review.action,
        "justificationNote": review.justification_note,
        "examinerId": str(review.examiner_id),
        "examinerName": examiner_name,
        "reviewedAt": iso(review.reviewed_at),
    }
