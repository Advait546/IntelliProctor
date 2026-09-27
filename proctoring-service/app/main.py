import base64
import os
from contextlib import asynccontextmanager

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .detector import ProctorDetector

detector: ProctorDetector | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global detector
    # Loaded once at startup (model loading is slow) and reused for every
    # request rather than per-frame. Phase is selectable via INTELLIPROCTOR_PHASE
    # (see detector.py's module docstring for the production-gate reasoning
    # behind why "phase0" -- not the fine-tuned "phase2_gpu" model -- stays the
    # default).
    detector = ProctorDetector()
    yield
    if detector:
        detector.close()


app = FastAPI(title="IntelliProctor Proctoring Service", lifespan=lifespan)

allowed_origins = [o.strip() for o in os.environ.get("CORS_ORIGIN", "http://localhost:8000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["POST", "DELETE"],
    allow_headers=["*"],
)


class FrameRequest(BaseModel):
    image_base64: str
    # Identifies which exam session this frame belongs to, so the detector's
    # per-session temporal filter state (see detector.py's
    # _temporal_manager_for) doesn't mix detections across different students.
    # Optional for backwards compatibility -- frames without one all share a
    # single "default" bucket, which is fine for local/manual testing but NOT
    # safe for concurrent real exam sessions, so the Node backend must always
    # send it.
    session_id: str | None = None


@app.get("/health")
def health():
    return {"status": "ok", "phase": detector.phase_key if detector else None}


@app.post("/analyze")
def analyze(payload: FrameRequest):
    if detector is None:
        raise HTTPException(status_code=503, detail="Detector not ready")

    try:
        raw = payload.image_base64.split(",")[-1]  # strip a data:...;base64, prefix if present
        image_bytes = base64.b64decode(raw)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {exc}") from exc

    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Could not decode image")

    return detector.analyze(frame, session_id=payload.session_id or "default")


@app.delete("/session/{session_id}")
def end_session(session_id: str):
    """Called once a student submits/ends their exam so the server drops that
    session's temporal-filter state instead of holding it for the rest of the
    process's uptime. Idempotent -- safe to call even if the session was never
    seen (e.g. the exam had zero frames)."""
    if detector is None:
        raise HTTPException(status_code=503, detail="Detector not ready")
    detector.end_session(session_id)
    return {"status": "ok"}
