"""IntelliProctor CV inference worker (HTTP).

    uvicorn app.main:app --host 0.0.0.0 --port 8001

Only the backend calls this service (service-to-service, ``X-Internal-Token``).
It returns observations + discrete episode events and never scores anything.
"""

from __future__ import annotations

import base64
import hmac
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

try:  # optional: load proctoring-service/.env if python-dotenv is installed
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:  # pragma: no cover
    pass

from .detector import IMG_SIZE, ProctorDetector

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("proctoring")

detector: ProctorDetector | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global detector
    detector = ProctorDetector()  # models load once at startup
    yield
    detector.close()


app = FastAPI(title="IntelliProctor CV Worker", version="2.0.0", lifespan=lifespan)

MAX_FRAME_BYTES = 3 * 1024 * 1024


def require_internal(x_internal_token: str | None = Header(default=None)) -> None:
    expected = os.environ.get("INTERNAL_SERVICE_TOKEN", "dev-internal-token-change-me")
    if expected and not (x_internal_token and hmac.compare_digest(x_internal_token, expected)):
        raise HTTPException(status_code=401, detail="Invalid internal service token")


class FrameRequest(BaseModel):
    image_base64: str = Field(min_length=100)
    session_id: str = Field(min_length=1, max_length=128)
    captured_at: str | None = None  # ISO-8601; defaults to server receive time


@app.get("/health")
def health():
    if detector is None:
        return {"status": "starting"}
    return {
        "status": "ok",
        "phase": detector.phase_key,
        "model": detector.model_name,
        "device": str(detector.device),
        "imgsz": IMG_SIZE,
        "asyncYolo": detector.async_yolo,
        "lastYoloMs": detector.last_yolo_ms,
        "activeSessions": len(detector._sessions),
    }


@app.post("/analyze", dependencies=[Depends(require_internal)])
def analyze(payload: FrameRequest):
    if detector is None:
        raise HTTPException(status_code=503, detail="Detector not ready")
    try:
        data = base64.b64decode(payload.image_base64.split(",")[-1])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {exc}") from exc
    if len(data) > MAX_FRAME_BYTES:
        raise HTTPException(status_code=413, detail="Frame too large")
    frame = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Could not decode image")
    ts = None
    if payload.captured_at:
        try:
            ts = datetime.fromisoformat(payload.captured_at.replace("Z", "+00:00")).timestamp()
        except ValueError:
            ts = None
    return detector.analyze(frame, session_id=payload.session_id, ts=ts)


@app.delete("/session/{session_id}", dependencies=[Depends(require_internal)])
def end_session(session_id: str):
    """Drop a session's tracking state once its exam is submitted (idempotent)."""
    if detector is None:
        raise HTTPException(status_code=503, detail="Detector not ready")
    detector.end_session(session_id)
    return {"status": "ok"}
