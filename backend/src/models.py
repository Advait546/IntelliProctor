"""Relational schema (BACKEND_ARCHITECTURE.md section 12.1).

The nine target tables are implemented as specified. Documented extensions
(each needed by an existing frontend flow) are marked ``# EXTENSION``:

* refresh_tokens       -- rotating refresh-token families (section 11.2) persisted in
                          the DB so the backend still works without Redis.
* question_bank_items  -- reusable questions for the Question Bank page / "Generate
                          Test" workflow (the spec's ``questions`` table is per-exam).
* examiner_settings    -- AI threshold & notification preferences (Settings page).
* extra columns on examinations / exam_sessions / proctoring_events for passkey
  lookup, server-authoritative expiry, tab-switch aggregation, idempotency,
  clock-skew / timing-discrepancy flags and evidence status (sections 6.3, 8.2, 17.2).
* question_type additionally allows 'truefalse' and 'fillblank' (the question
  editor already supports both).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, JSONType, TZDateTime, utcnow

ROLE_STUDENT = "student"
ROLE_SETTER = "setter"
ROLE_ADMIN = "admin"

EXAM_STATUSES = ("DRAFT", "SCHEDULED", "ACTIVE", "CLOSED")
SESSION_STATUSES = ("INITIALIZED", "IN_PROGRESS", "SUBMITTED", "FORCED_SUBMITTED", "EVALUATED")
QUESTION_TYPES = ("mcq", "msq", "truefalse", "fillblank", "subjective")
SEVERITIES = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
REVIEW_STATUSES = ("UNREVIEWED", "DISMISSED", "CONFIRMED")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _in(values) -> str:
    return ", ".join(f"'{v}'" for v in values)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint(f"role IN ({_in((ROLE_STUDENT, ROLE_SETTER, ROLE_ADMIN))})", name="role"),)

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    institution: Mapped[str | None] = mapped_column(String(255))
    candidate_id_number: Mapped[str | None] = mapped_column(String(64), unique=True)
    reference_photo_s3_key: Mapped[str | None] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow, onupdate=utcnow)


class Examination(Base):
    __tablename__ = "examinations"
    __table_args__ = (
        CheckConstraint("duration_minutes > 0", name="duration_positive"),
        CheckConstraint(f"status IN ({_in(EXAM_STATUSES)})", name="status"),
    )

    exam_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    examiner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(128), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    total_marks: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    passkey_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    start_window: Mapped[datetime] = mapped_column(TZDateTime, nullable=False)
    end_window: Mapped[datetime] = mapped_column(TZDateTime, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="DRAFT")
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow, onupdate=utcnow)
    # EXTENSION: keyed HMAC of the normalized passkey (indexed lookup without
    # storing plaintext) and the passkey encrypted at rest so the owning
    # examiner can display / share it again. Neither is plaintext.
    passkey_lookup: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    passkey_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    instructions: Mapped[str | None] = mapped_column(Text)
    settings: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)

    questions: Mapped[list["Question"]] = relationship(
        back_populates="exam", cascade="all, delete-orphan", order_by="Question.order_index"
    )


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (
        CheckConstraint(f"question_type IN ({_in(QUESTION_TYPES)})", name="question_type"),
        Index("idx_questions_exam_order", "exam_id", "order_index"),
    )

    question_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    exam_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("examinations.exam_id", ondelete="CASCADE"), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(String(32), nullable=False)
    options: Mapped[list | None] = mapped_column(JSONType)
    correct_answer: Mapped[list] = mapped_column(JSONType, nullable=False)
    marks: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    difficulty: Mapped[str | None] = mapped_column(String(32), default="medium")
    topic: Mapped[str | None] = mapped_column(String(128))
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    exam: Mapped[Examination] = relationship(back_populates="questions")


class ExamSession(Base):
    __tablename__ = "exam_sessions"
    __table_args__ = (
        UniqueConstraint("exam_id", "candidate_id", name="unique_candidate_exam_session"),
        CheckConstraint(f"status IN ({_in(SESSION_STATUSES)})", name="status"),
        CheckConstraint("current_suspicion_score BETWEEN 0 AND 1000", name="current_score_range"),
        CheckConstraint("peak_suspicion_score BETWEEN 0 AND 1000", name="peak_score_range"),
        CheckConstraint("head_turn_pending_count BETWEEN 0 AND 2", name="head_turn_pending_range"),
        Index("idx_sessions_exam", "exam_id", "status"),
    )

    session_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    exam_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("examinations.exam_id", ondelete="RESTRICT"), nullable=False)
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="INITIALIZED")
    started_at: Mapped[datetime | None] = mapped_column(TZDateTime)
    submitted_at: Mapped[datetime | None] = mapped_column(TZDateTime)
    academic_score: Mapped[float | None] = mapped_column(Numeric(7, 2))
    current_suspicion_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    peak_suspicion_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_suspicious: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    head_turn_pending_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_head_turns_completed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow, onupdate=utcnow)
    # EXTENSION columns
    expires_at: Mapped[datetime | None] = mapped_column(TZDateTime)  # server-authoritative timer (FRONTEND 4.3)
    submission_type: Mapped[str | None] = mapped_column(String(32))  # MANUAL | TIMER_EXPIRED
    evaluated_at: Mapped[datetime | None] = mapped_column(TZDateTime)
    max_academic_score: Mapped[float | None] = mapped_column(Numeric(7, 2))
    question_order: Mapped[list | None] = mapped_column(JSONType)  # per-candidate shuffle (question ids)
    tab_switch_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tab_hidden_total_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_tab_blur_server_at: Mapped[datetime | None] = mapped_column(TZDateTime)
    manually_flagged: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    manual_flag_reason: Mapped[str | None] = mapped_column(Text)
    last_event_timestamp: Mapped[datetime | None] = mapped_column(TZDateTime)

    exam: Mapped[Examination] = relationship()
    candidate: Mapped[User] = relationship()


class CandidateAnswer(Base):
    __tablename__ = "candidate_answers"
    __table_args__ = (UniqueConstraint("session_id", "question_id", name="unique_session_question"),)

    answer_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exam_sessions.session_id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.question_id", ondelete="CASCADE"), nullable=False)
    selected_options: Mapped[list | None] = mapped_column(JSONType)
    subjective_text: Mapped[str | None] = mapped_column(Text)
    marks_awarded: Mapped[float | None] = mapped_column(Numeric(7, 2))
    is_marked_for_review: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    last_saved_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)


class ProctoringEvent(Base):
    __tablename__ = "proctoring_events"
    __table_args__ = (
        CheckConstraint(f"severity IN ({_in(SEVERITIES)})", name="severity"),
        CheckConstraint(f"review_status IN ({_in(REVIEW_STATUSES)})", name="review_status"),
        Index("idx_events_session_time", "session_id", "timestamp"),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exam_sessions.session_id", ondelete="CASCADE"), nullable=False)
    episode_id: Mapped[str] = mapped_column(String(128), nullable=False)
    event_source: Mapped[str] = mapped_column(String(64), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(TZDateTime, nullable=False)
    duration_ms: Mapped[int | None] = mapped_column(Integer, default=0)
    confidence: Mapped[float | None] = mapped_column(Numeric(4, 3))
    bounding_box: Mapped[dict | None] = mapped_column(JSONType)
    head_pose_angles: Mapped[dict | None] = mapped_column(JSONType)
    review_status: Mapped[str] = mapped_column(String(32), nullable=False, default="UNREVIEWED")
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    # EXTENSION columns
    idempotency_key: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    server_received_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    is_clock_skewed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    timing_discrepancy: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    evidence_status: Mapped[str] = mapped_column(String(16), nullable=False, default="NONE")  # NONE|STORED|FAILED
    details: Mapped[dict | None] = mapped_column(JSONType)

    session: Mapped[ExamSession] = relationship()
    evidence: Mapped["EvidenceRecord | None"] = relationship(back_populates="event", uselist=False)


class SuspicionScoreLedger(Base):
    """Immutable append-only ledger (section 5.6). Rows are never updated or deleted."""

    __tablename__ = "suspicion_score_ledger"
    __table_args__ = (Index("idx_ledger_session", "session_id", "created_at"),)

    ledger_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exam_sessions.session_id", ondelete="CASCADE"), nullable=False)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("proctoring_events.event_id", ondelete="RESTRICT"), nullable=False)
    rule_applied: Mapped[str] = mapped_column(String(64), nullable=False)
    nominal_points: Mapped[int] = mapped_column(Integer, nullable=False)
    applied_points: Mapped[int] = mapped_column(Integer, nullable=False)
    previous_score: Mapped[int] = mapped_column(Integer, nullable=False)
    new_score: Mapped[int] = mapped_column(Integer, nullable=False)
    is_suspicious: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)


class EvidenceRecord(Base):
    __tablename__ = "evidence_records"

    evidence_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proctoring_events.event_id", ondelete="CASCADE"), unique=True, nullable=False
    )
    s3_bucket: Mapped[str] = mapped_column(String(128), nullable=False)
    s3_key: Mapped[str] = mapped_column(String(512), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    image_hash_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(64), nullable=False, default="image/jpeg")
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)

    event: Mapped[ProctoringEvent] = relationship(back_populates="evidence")


class ExaminerReview(Base):
    __tablename__ = "examiner_reviews"
    __table_args__ = (CheckConstraint("action IN ('DISMISS', 'CONFIRM')", name="action"),)

    review_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("proctoring_events.event_id", ondelete="CASCADE"), nullable=False)
    examiner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    justification_note: Mapped[str] = mapped_column(Text, nullable=False)
    reviewed_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)

    examiner: Mapped[User] = relationship()


# ---------------------------------------------------------------- EXTENSIONS


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    token_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    family_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(TZDateTime)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)


class QuestionBankItem(Base):
    __tablename__ = "question_bank_items"
    __table_args__ = (CheckConstraint(f"question_type IN ({_in(QUESTION_TYPES)})", name="question_type"),)

    item_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(String(32), nullable=False)
    options: Mapped[list | None] = mapped_column(JSONType)
    correct_answer: Mapped[list] = mapped_column(JSONType, nullable=False)
    marks: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    difficulty: Mapped[str | None] = mapped_column(String(32), default="medium")
    topic: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)


class ExaminerSettings(Base):
    __tablename__ = "examiner_settings"

    examiner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    data: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow, onupdate=utcnow)
