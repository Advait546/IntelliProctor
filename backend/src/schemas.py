"""Request payload schemas (Pydantic v2). Field names are camelCase to match
the frontend and the ingestion data contract (section 6.2)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .services.scoring import ALL_EVENT_TYPES, SOURCES


class _Model(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


# ------------------------------------------------------------------ auth


class RegisterRequest(_Model):
    fullName: str = Field(min_length=1, max_length=255, alias="fullName")
    password: str = Field(min_length=6, max_length=128)
    email: str | None = Field(default=None, max_length=255)
    candidateId: str | None = Field(default=None, max_length=64)
    role: Literal["student", "setter"] = "student"
    institution: str | None = None

    @model_validator(mode="after")
    def _identity(self):
        if not self.email and not self.candidateId:
            raise ValueError("Provide an email or a candidate ID (PRN / roll number)")
        if self.role == "setter" and not self.email:
            raise ValueError("Examiner accounts require an email")
        return self


class LoginRequest(_Model):
    email: str | None = None
    candidateId: str | None = None
    password: str = Field(min_length=1, max_length=128)
    role: Literal["student", "setter"] | None = None

    @model_validator(mode="after")
    def _identity(self):
        if not self.email and not self.candidateId:
            raise ValueError("Provide an email or a candidate ID")
        return self


# ----------------------------------------------------------------- exams


class ExamCreateRequest(_Model):
    title: str = Field(min_length=1, max_length=255)
    subject: str = Field(default="General", max_length=128)
    durationMinutes: int | None = Field(default=None, ge=1, le=24 * 60)
    duration: int | None = Field(default=None, ge=1, le=24 * 60)
    instructions: str | list[str] | None = None
    settings: dict[str, Any] | None = None
    questions: list[dict[str, Any]] = Field(default_factory=list)
    publish: bool = False
    passkey: str | None = Field(default=None, alias="code")
    startWindow: datetime | None = None
    endWindow: datetime | None = None
    availabilityHours: int | None = Field(default=None, ge=1, le=24 * 365)
    # Flat toggles the CreateTestPage form already sends; folded into settings.
    negativeMarking: float | None = None
    shuffleQuestions: bool | None = None
    shuffleOptions: bool | None = None
    aiMonitoring: bool | None = None
    browserLock: bool | None = None
    audioMonitoring: bool | None = None
    fullscreenLock: bool | None = None

    @property
    def minutes(self) -> int:
        return self.durationMinutes or self.duration or 60

    def merged_settings(self) -> dict:
        out = dict(self.settings or {})
        for k in ("negativeMarking", "shuffleQuestions", "shuffleOptions", "aiMonitoring", "browserLock", "audioMonitoring", "fullscreenLock"):
            v = getattr(self, k)
            if v is not None:
                out[k] = v
        return out

    def instructions_text(self) -> str | None:
        if isinstance(self.instructions, list):
            return "\n".join(str(i) for i in self.instructions)
        return self.instructions


class ExamUpdateRequest(ExamCreateRequest):
    title: str | None = Field(default=None, max_length=255)  # type: ignore[assignment]
    questions: list[dict[str, Any]] | None = None  # type: ignore[assignment]


class PublishRequest(_Model):
    passkey: str | None = Field(default=None, alias="code")
    startWindow: datetime | None = None
    endWindow: datetime | None = None
    availabilityHours: int | None = Field(default=None, ge=1, le=24 * 365)


class QuestionsAppendRequest(_Model):
    questions: list[dict[str, Any]]


class GenerateExamRequest(_Model):
    title: str = "Generated Examination"
    subject: str = "General"
    durationMinutes: int = Field(default=60, ge=1, le=24 * 60)
    count: int = Field(default=10, ge=1, le=200)
    topics: list[str] | None = None
    difficulty: str | None = None
    publish: bool = False
    settings: dict[str, Any] | None = None


class VerifyPasskeyRequest(_Model):
    passkey: str = Field(min_length=4, max_length=32, alias="passkey")

    @model_validator(mode="before")
    @classmethod
    def _aliases(cls, data):
        if isinstance(data, dict) and "passkey" not in data:
            for k in ("code", "examCode"):
                if k in data:
                    data = {**data, "passkey": data[k]}
                    break
        return data


class DraftAnswerRequest(_Model):
    questionId: uuid.UUID
    answer: Any = None
    markedForReview: bool | None = None


class SubmitRequest(_Model):
    answers: dict[str, Any] | None = None


# ------------------------------------------------------------ proctoring


class BoundingBox(_Model):
    x: int
    y: int
    width: int
    height: int


class HeadPose(_Model):
    yaw: float | None = None
    pitch: float | None = None
    roll: float | None = None


class ProctoringEventIngestRequest(_Model):
    """Ingestion data contract (BACKEND_ARCHITECTURE.md section 6.2)."""

    sessionId: uuid.UUID
    episodeId: str = Field(min_length=1, max_length=128)
    source: str
    eventType: str
    timestamp: datetime
    durationMs: int | None = Field(default=None, ge=0)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    boundingBox: BoundingBox | None = None
    headPoseAngles: HeadPose | None = None
    evidenceBase64: str | None = None
    details: dict[str, Any] | None = None

    @field_validator("source")
    @classmethod
    def _source(cls, v: str) -> str:
        if v not in SOURCES - {"EXAMINER"}:
            raise ValueError(f"source must be one of {sorted(SOURCES - {'EXAMINER'})}")
        return v

    @field_validator("eventType")
    @classmethod
    def _etype(cls, v: str) -> str:
        if v not in ALL_EVENT_TYPES - {"MANUAL_FLAG"}:
            raise ValueError(f"eventType must be one of {sorted(ALL_EVENT_TYPES - {'MANUAL_FLAG'})}")
        return v

    def as_payload(self) -> dict:
        d = self.model_dump()
        d["boundingBox"] = self.boundingBox.model_dump() if self.boundingBox else None
        d["headPoseAngles"] = self.headPoseAngles.model_dump() if self.headPoseAngles else None
        return d


class BrowserEventRequest(_Model):
    """Simplified tab-visibility payload for the candidate browser; the session
    comes from the exam session token, so sessionId is optional here."""

    eventType: Literal["TAB_BLUR", "TAB_FOCUS"]
    episodeId: str = Field(min_length=1, max_length=128)
    timestamp: datetime
    durationMs: int | None = Field(default=None, ge=0)
    details: dict[str, Any] | None = None


class FrameRequest(_Model):
    imageBase64: str = Field(min_length=100)
    capturedAt: datetime | None = None
    currentQuestion: int | None = None


class ReviewRequest(_Model):
    justificationNote: str = Field(min_length=10, max_length=4000)

    @model_validator(mode="before")
    @classmethod
    def _aliases(cls, data):
        if isinstance(data, dict) and "justificationNote" not in data:
            for k in ("justification", "note", "reason"):
                if k in data:
                    data = {**data, "justificationNote": data[k]}
                    break
        return data


class FlagRequest(_Model):
    reason: str = Field(default="Manual proctor flag", max_length=1000)


class NotifyRequest(_Model):
    message: str = Field(min_length=1, max_length=500)
    level: Literal["info", "warning"] = "info"


class SettingsUpdate(_Model):
    aiSettings: dict[str, Any] | None = None
    notificationSettings: dict[str, Any] | None = None
    examRules: dict[str, Any] | None = None
    account: dict[str, Any] | None = None


class BankQuestionCreate(_Model):
    questions: list[dict[str, Any]]
