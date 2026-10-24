"""Question bank, examiner settings, dashboard stats and candidate reference
photos (frontend pages that sit outside the core spec catalog)."""

from __future__ import annotations

import csv
import io
import json
import uuid

from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_db
from ..deps import is_admin, require_examiner, require_student
from ..errors import ApiError
from ..models import Examination, ExaminerSettings, ExamSession, QuestionBankItem, User
from ..schemas import BankQuestionCreate, SettingsUpdate
from ..services.exams import ACTIVE_SESSION
from ..services.questions import from_ui, to_ui
from ..services.storage import StorageError, get_storage, sha256_hex

bank_router = APIRouter(prefix="/question-bank", tags=["question-bank"])
settings_router = APIRouter(prefix="/settings", tags=["settings"])
stats_router = APIRouter(prefix="/stats", tags=["stats"])
candidate_router = APIRouter(prefix="/candidates", tags=["candidates"])


# ------------------------------------------------------------ question bank


@bank_router.get("")
async def get_bank(user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(select(QuestionBankItem).where(QuestionBankItem.owner_id == user.user_id).order_by(QuestionBankItem.created_at.desc()))
    ).scalars().all()
    return [to_ui(r, include_answer=True) for r in rows]


@bank_router.post("", status_code=201)
async def add_to_bank(body: BankQuestionCreate, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    items = [QuestionBankItem(owner_id=user.user_id, **from_ui(q)) for q in body.questions]
    db.add_all(items)
    await db.commit()
    return {"success": True, "count": len(items), "questions": [to_ui(i, include_answer=True) for i in items]}


@bank_router.delete("/{item_id}")
async def delete_bank_item(item_id: uuid.UUID, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    item = await db.get(QuestionBankItem, item_id)
    if item is None or item.owner_id != user.user_id:
        raise ApiError(404, "NOT_FOUND", "Question not found")
    await db.delete(item)
    await db.commit()
    return {"success": True}


def _parse_upload(raw: bytes, filename: str) -> list[dict]:
    text = raw.decode("utf-8-sig", errors="replace")
    if filename.lower().endswith(".json") or text.lstrip().startswith("["):
        data = json.loads(text)
        if not isinstance(data, list):
            raise ApiError(422, "INVALID_FILE", "JSON import must be an array of questions")
        return data
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for r in reader:
        norm = {(k or "").strip().lower().replace(" ", "").replace("_", ""): (v or "").strip() for k, v in r.items()}
        rows.append(
            {
                "type": norm.get("type") or "MCQ",
                "text": norm.get("text") or norm.get("question") or norm.get("questiontext"),
                "optionA": norm.get("optiona") or norm.get("a"),
                "optionB": norm.get("optionb") or norm.get("b"),
                "optionC": norm.get("optionc") or norm.get("c"),
                "optionD": norm.get("optiond") or norm.get("d"),
                "correctAnswer": norm.get("correctanswer") or norm.get("answer") or norm.get("correct"),
                "marks": norm.get("marks") or 1,
                "difficulty": norm.get("difficulty") or "Medium",
                "topic": norm.get("topic") or None,
            }
        )
    return rows


@bank_router.post("/import-csv", status_code=201)
async def import_csv(file: UploadFile = File(...), user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    """CSV columns: type,text,optionA,optionB,optionC,optionD,correctAnswer,marks,difficulty,topic
    (a JSON array in the frontend question shape is accepted too)."""
    raw = await file.read()
    if len(raw) > 5 * 1024 * 1024:
        raise ApiError(413, "FILE_TOO_LARGE", "Import files are limited to 5 MB")
    try:
        parsed = _parse_upload(raw, file.filename or "")
    except (json.JSONDecodeError, csv.Error) as exc:
        raise ApiError(422, "INVALID_FILE", f"Could not parse file: {exc}") from exc
    items, errors = [], []
    for i, q in enumerate(parsed, start=1):
        try:
            items.append(QuestionBankItem(owner_id=user.user_id, **from_ui(q)))
        except ApiError as exc:
            errors.append({"row": i, "message": exc.message})
    db.add_all(items)
    await db.commit()
    return {"success": True, "importedCount": len(items), "errors": errors, "questions": [to_ui(i, include_answer=True) for i in items]}


# ----------------------------------------------------------------- settings

DEFAULT_SETTINGS = {
    "aiSettings": {
        "yoloConfidenceThreshold": 65,
        "headPoseAngleLimit": 30,
        "gazeOutBoundsTimeLimit": 1,
        "audioNoiseThreshold": 65,
        "autoFlagHighRisk": True,
    },
    "notificationSettings": {"emailAlertsOnCritical": False, "soundAlertsOnWarning": True, "autoTerminateCriticalStudents": False},
    "examRules": {"allowScratchpad": True, "allowCalculator": False, "requireFullscreen": True, "enforceSingleTab": True},
    "account": {},
    # Read-only: the mandatory scoring policy (BACKEND_ARCHITECTURE.md 5.2). Shown
    # on the settings page but never editable from the client.
    "scoringPolicy": {
        "headTurnGroupOf3": 10,
        "bookEpisode": 50,
        "phoneEpisode": 100,
        "suspiciousThreshold": 100,
        "scoreCeiling": 1000,
        "zeroWeightSignals": ["TAB_SWITCH", "CANDIDATE_ABSENT", "MULTIPLE_FACES", "PITCH_ROLL_DEVIATION"],
    },
}


def _deep_merge(base: dict, patch: dict) -> dict:
    out = dict(base)
    for k, v in (patch or {}).items():
        out[k] = _deep_merge(out.get(k, {}), v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


@settings_router.get("")
async def get_settings_(user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    row = await db.get(ExaminerSettings, user.user_id)
    data = _deep_merge(DEFAULT_SETTINGS, row.data if row else {})
    data["scoringPolicy"] = DEFAULT_SETTINGS["scoringPolicy"]
    data["account"] = {"name": user.full_name, "email": user.email, "role": "Exam Setter" if user.role == "setter" else user.role.title(), "department": user.institution or ""}
    return data


@settings_router.put("")
async def put_settings(body: SettingsUpdate, user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    row = await db.get(ExaminerSettings, user.user_id)
    patch = body.model_dump(exclude_none=True)
    account = patch.pop("account", None)
    if row is None:
        row = ExaminerSettings(examiner_id=user.user_id, data={})
        db.add(row)
    row.data = _deep_merge(row.data or {}, patch)
    if account:
        if account.get("name"):
            user.full_name = str(account["name"])[:255]
        if account.get("department") is not None:
            user.institution = str(account["department"])[:255]
    await db.commit()
    return {"success": True, "updated": True, "settings": await get_settings_(user, db)}


# -------------------------------------------------------------------- stats


@stats_router.get("/overview")
async def overview(user: User = Depends(require_examiner), db: AsyncSession = Depends(get_db)):
    exam_filter = [] if is_admin(user) else [Examination.examiner_id == user.user_id]
    total_exams = (await db.execute(select(func.count()).select_from(Examination).where(*exam_filter))).scalar_one()
    base = select(ExamSession).join(Examination, Examination.exam_id == ExamSession.exam_id).where(*exam_filter).subquery()
    candidates = (await db.execute(select(func.count(func.distinct(base.c.candidate_id))))).scalar_one()
    avg_s = (await db.execute(select(func.avg(base.c.current_suspicion_score)))).scalar_one()
    active = (await db.execute(select(func.count()).select_from(base).where(base.c.status == ACTIVE_SESSION))).scalar_one()
    suspicious = (await db.execute(select(func.count()).select_from(base).where(base.c.is_suspicious.is_(True)))).scalar_one()
    return {
        "totalExams": int(total_exams),
        "studentsRegistered": int(candidates),
        "averageSuspicionScore": round(float(avg_s or 0), 1),
        "activeSessions": int(active),
        "suspiciousSessions": int(suspicious),
    }


# ---------------------------------------------------- candidate reference photo


@candidate_router.post("/reference-photo", status_code=201)
async def upload_reference_photo(
    request: Request, file: UploadFile = File(...), user: User = Depends(require_student), db: AsyncSession = Depends(get_db)
):
    data = await file.read()
    if not data or len(data) > 5 * 1024 * 1024:
        raise ApiError(422, "INVALID_PHOTO", "Reference photo must be a JPEG/PNG under 5 MB")
    if not (data[:3] == b"\xff\xd8\xff" or data[:8] == b"\x89PNG\r\n\x1a\n"):
        raise ApiError(422, "INVALID_PHOTO", "Reference photo must be a JPEG or PNG image")
    key = f"reference/{user.user_id}/{sha256_hex(data)[:16]}.jpg"
    try:
        await get_storage().put(key, data, file.content_type or "image/jpeg")
    except StorageError as exc:
        raise ApiError(502, "STORAGE_UNAVAILABLE", str(exc)) from exc
    user.reference_photo_s3_key = key
    await db.commit()
    return {"success": True, "photoKey": key}


@candidate_router.get("/me/reference-photo")
async def my_reference_photo(request: Request, user: User = Depends(require_student)):
    if not user.reference_photo_s3_key:
        raise ApiError(404, "NO_PHOTO", "No reference photo on file")
    url = await get_storage().signed_url(user.reference_photo_s3_key, str(request.base_url), get_settings().EVIDENCE_URL_TTL_SECONDS)
    return {"url": url}
