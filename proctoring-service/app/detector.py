"""Frame-in / observations-out CV inference worker for IntelliProctor.

Ports the production pipeline from the project root's ``video_input_analysis.py``
(PHASE_CONFIGS, per-class confidence / aspect-ratio / size filters, 6-point
solvePnP head pose, 3-on / 4-off hysteresis) behind an HTTP API that serves many
concurrent exam sessions, and adds the episode layer (``episodes.py``) so the
backend receives discrete events instead of per-frame predictions.

Architecture (MODEL_ARCHITECTURE.md sections 2.3 / 7.4 -- decoupled execution):

* MediaPipe FaceMesh runs synchronously on every uploaded frame (fast, tens of
  ms on CPU) -> head pose, face count, head-turn / absence / multi-face episodes.
* YOLO11m runs on a dedicated background worker thread. Each session keeps only
  its *latest* clean frame in a slot (stale frames are dropped), so slow CPU
  inference (~0.9 s at 1280 px) never blocks or backs up the request path.
  Object episodes found by the worker are returned on the session's next
  ``/analyze`` call.
* "Option A" clean buffer: YOLO always sees an un-annotated copy of the frame;
  annotations are only drawn on the separate evidence JPEG.

Production gate: ``phase0`` (pretrained models/pretrained/yolo11m.pt) is the
default and the only production-approved model. ``phase2_gpu`` (Iteration 1
fine-tune, 47.9% false-positive rate on the negative benchmark) stays selectable
for research comparison only -- see reports/ml/PHASE3_POST_PROCESSING_REVIEW.md.
"""

from __future__ import annotations

import base64
import logging
import os
import threading
import time
from collections import OrderedDict
from pathlib import Path

import cv2
import numpy as np

from .episodes import PITCH_LIMIT, ROLL_LIMIT, YAW_LIMIT, SessionTracker

log = logging.getLogger("proctoring.detector")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def _existing(*parts) -> str | None:
    p = PROJECT_ROOT.joinpath(*parts)
    return str(p) if p.exists() else None


PRETRAINED_MODEL = _existing("models", "pretrained", "yolo11m.pt") or "yolo11m.pt"
TRAINED_ITER1_MODEL = _existing("models", "trained", "intelliproctor_phase1_iter1", "best.pt") or _existing(
    "runs", "detect", "intelliproctor_phase1_iter1_gpu", "weights", "best.pt"
)
TRAINED_ITER2_MODEL = _existing("models", "trained", "intelliproctor_phase2_iter2", "weights", "best.pt")

# Mirrors video_input_analysis.py PHASE_CONFIGS (same paths, thresholds, filters).
PHASE_CONFIGS = {
    "phase0_baseline": {
        "name": "Phase 0 (Original Strict Baseline)",
        "model_path": PRETRAINED_MODEL,
        "target_classes": {
            "cell phone": {"type": "phone", "conf_threshold": 0.65, "aspect_range": (1.3, 2.9)},
            "book": {"type": "book", "conf_threshold": 0.65, "aspect_range": None},
        },
        "use_temporal_filter": False,
    },
    "phase0": {
        "name": "Phase 0 (Optimized Production Baseline)",
        "model_path": PRETRAINED_MODEL,
        "target_classes": {
            "cell phone": {"type": "phone", "conf_threshold": 0.65, "aspect_range": (1.15, 2.9)},
            "book": {"type": "book", "conf_threshold": 0.65, "aspect_range": (0.80, 2.50)},
        },
        "use_temporal_filter": True,
    },
    "phase2_gpu": {
        "name": "Phase 2 (Fine-Tuned Iteration 1 Model -- NOT production-approved)",
        "model_path": TRAINED_ITER1_MODEL,
        "target_classes": {
            "phone": {"type": "phone", "conf_threshold": 0.65, "aspect_range": (1.15, 2.9)},
            "book_notebook": {"type": "book", "conf_threshold": 0.50, "aspect_range": (0.80, 2.50)},
        },
        "use_temporal_filter": True,
    },
    "iteration2": {
        "name": "Iteration 2 (placeholder -- not yet trained / not approved)",
        "model_path": TRAINED_ITER2_MODEL,
        "target_classes": {
            "phone": {"type": "phone", "conf_threshold": 0.65, "aspect_range": (1.15, 2.9)},
            "book_notebook": {"type": "book", "conf_threshold": 0.65, "aspect_range": (0.80, 2.50)},
        },
        "use_temporal_filter": True,
    },
}
PHASE_ALIASES = {"phase1": "phase2_gpu", "phase2": "phase2_gpu", "default": "phase0", "baseline": "phase0_baseline"}

IMG_SIZE = int(os.environ.get("PROCTOR_IMGSZ", "1280"))
MIN_SIZE = 12
SESSION_IDLE_EXPIRY_S = 30 * 60


def resolve_phase(requested: str | None = None) -> tuple[str, dict]:
    """Unknown phases, or phases whose weights are missing, fall back to phase0."""
    requested = (requested or os.environ.get("INTELLIPROCTOR_PHASE", "phase0")).lower()
    key = PHASE_ALIASES.get(requested, requested)
    if key not in PHASE_CONFIGS:
        log.warning("Unknown phase '%s'; falling back to phase0", requested)
        key = "phase0"
    cfg = PHASE_CONFIGS[key]
    if key != "phase0" and (not cfg["model_path"] or not os.path.exists(cfg["model_path"])):
        log.warning("Weights for '%s' not found; falling back to phase0", key)
        key, cfg = "phase0", PHASE_CONFIGS["phase0"]
    return key, cfg


def resolve_device() -> str | int:
    """INTELLIPROCTOR_DEVICE / PROCTOR_DEVICE: 'auto' (default), 'cpu', 'cuda', or an index."""
    target = (os.environ.get("INTELLIPROCTOR_DEVICE") or os.environ.get("PROCTOR_DEVICE") or "auto").strip().lower()
    if target == "cpu":
        return "cpu"
    try:
        import torch

        has_cuda = torch.cuda.is_available()
    except Exception:  # noqa: BLE001
        has_cuda = False
    if target in ("auto", "cuda", "gpu"):
        return 0 if has_cuda else "cpu"
    if target.isdigit():
        return int(target) if has_cuda else "cpu"
    return "cpu"


# ------------------------------------------------------------- head pose
# Ported verbatim from video_input_analysis.py (landmarks, 3D model, Euler math).
HEAD_POSE_LANDMARK_IDS = [1, 152, 33, 263, 61, 287]
GENERIC_FACE_3D = np.array(
    [
        [0.0, 0.0, 0.0],
        [0.0, -330.0, -65.0],
        [-225.0, 170.0, -135.0],
        [225.0, 170.0, -135.0],
        [-150.0, -150.0, -125.0],
        [150.0, -150.0, -125.0],
    ],
    dtype=np.float64,
)


def calculate_head_pose(face_landmarks, w_img, h_img):
    try:
        face_2d = np.array(
            [[face_landmarks.landmark[i].x * w_img, face_landmarks.landmark[i].y * h_img] for i in HEAD_POSE_LANDMARK_IDS],
            dtype=np.float64,
        )
        focal_length = float(w_img)
        cam_matrix = np.array([[focal_length, 0, w_img / 2.0], [0, focal_length, h_img / 2.0], [0, 0, 1.0]], dtype=np.float64)
        dist_coeffs = np.zeros((4, 1), dtype=np.float64)
        success, rot_vec, _ = cv2.solvePnP(GENERIC_FACE_3D, face_2d, cam_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE)
        if not success:
            return None
        rot_mat, _ = cv2.Rodrigues(rot_vec)
        sy = np.sqrt(rot_mat[0, 0] ** 2 + rot_mat[1, 0] ** 2)
        if sy >= 1e-6:
            pitch = np.arctan2(rot_mat[2, 1], rot_mat[2, 2])
            yaw = np.arctan2(-rot_mat[2, 0], sy)
            roll = np.arctan2(rot_mat[1, 0], rot_mat[0, 0])
        else:
            pitch = np.arctan2(-rot_mat[1, 2], rot_mat[1, 1])
            yaw = np.arctan2(-rot_mat[2, 0], sy)
            roll = 0.0
        raw_pitch, raw_yaw, raw_roll = float(np.degrees(pitch)), float(np.degrees(yaw)), float(np.degrees(roll))
        pitch = (raw_pitch + 180) if raw_pitch < -90 else (raw_pitch - 180 if raw_pitch > 90 else raw_pitch)
        roll = (raw_roll + 180) if raw_roll < -90 else (raw_roll - 180 if raw_roll > 90 else raw_roll)
        yaw_val, pitch_val, roll_val = round(raw_yaw, 1), round(pitch, 1), round(roll, 1)
        is_neutral = abs(yaw_val) <= YAW_LIMIT and abs(pitch_val) <= PITCH_LIMIT and abs(roll_val) <= ROLL_LIMIT
        return {"yaw": yaw_val, "pitch": pitch_val, "roll": roll_val, "is_neutral": is_neutral}
    except Exception:  # noqa: BLE001
        return None


# -------------------------------------------------------------- evidence


def annotate_evidence(frame: np.ndarray, kind: str, box: dict | None, conf: float | None, ts: float) -> str:
    """Stage 2 of the evidence lifecycle: bounding box + timestamp, JPEG, base64."""
    img = frame.copy()
    color = (0, 0, 255) if kind == "phone" else (0, 165, 255)
    if box:
        x, y, w, h = box["x"], box["y"], box["width"], box["height"]
        cv2.rectangle(img, (x, y), (x + w, y + h), color, 3)
        label = f"{'PHONE' if kind == 'phone' else 'BOOK'} {conf * 100:.0f}%" if conf is not None else kind.upper()
        cv2.rectangle(img, (x, max(0, y - 26)), (x + 12 * len(label), y), color, -1)
        cv2.putText(img, label, (x + 4, max(18, y - 7)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    stamp = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime(ts))
    cv2.putText(img, f"IntelliProctor evidence | {stamp}", (10, img.shape[0] - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return base64.b64encode(buf.tobytes()).decode() if ok else ""


# ----------------------------------------------------------------- YOLO


class YoloEngine:
    """Wraps the active YOLO checkpoint + the production filters."""

    def __init__(self, phase_cfg: dict, device):
        from ultralytics import YOLO

        self.cfg = phase_cfg
        self.device = device
        self.model = YOLO(phase_cfg["model_path"])
        self.names = self.model.names

    def detect(self, frame: np.ndarray) -> dict[str, tuple | None]:
        """Returns the best accepted detection per prohibited type:
        {"phone": (conf, {x,y,width,height}) | None, "book": ...}."""
        results = self.model(frame, imgsz=IMG_SIZE, device=self.device, verbose=False, max_det=10, iou=0.45)[0]
        best: dict[str, tuple | None] = {"phone": None, "book": None}
        for box in results.boxes:
            cls_cfg = self.cfg["target_classes"].get(self.names[int(box.cls[0])])
            if cls_cfg is None:
                continue
            conf = float(box.conf[0])
            if conf < cls_cfg["conf_threshold"]:
                continue
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            bw, bh = x2 - x1, y2 - y1
            short_side = max(min(bw, bh), 1)
            aspect = max(bw, bh) / short_side
            rng = cls_cfg["aspect_range"]
            if rng is not None and not (rng[0] <= aspect <= rng[1]):
                continue
            if short_side < MIN_SIZE:
                continue
            kind = cls_cfg["type"]
            if best[kind] is None or conf > best[kind][0]:
                best[kind] = (conf, {"x": x1, "y": y1, "width": bw, "height": bh})
        return best


class ProctorDetector:
    def __init__(self, phase: str | None = None, async_yolo: bool | None = None, yolo_engine=None, face_mesh=None):
        self.phase_key, self.phase_cfg = resolve_phase(phase)
        self.device = resolve_device()
        self.async_yolo = (os.environ.get("PROCTOR_YOLO_ASYNC", "true").lower() != "false") if async_yolo is None else async_yolo

        if face_mesh is None:
            import mediapipe as mp

            # static_image_mode=True: frames from many sessions interleave, so
            # there is no valid cross-frame tracking assumption.
            face_mesh = mp.solutions.face_mesh.FaceMesh(
                static_image_mode=True, max_num_faces=5, refine_landmarks=False, min_detection_confidence=0.5, min_tracking_confidence=0.5
            )
        self._face_mesh = face_mesh
        self._mesh_lock = threading.Lock()
        self._yolo = yolo_engine or YoloEngine(self.phase_cfg, self.device)

        self._sessions: dict[str, SessionTracker] = {}
        self._sessions_lock = threading.Lock()
        self._slots: OrderedDict[str, tuple[np.ndarray, float]] = OrderedDict()
        self._slot_cv = threading.Condition()
        self._stop = False
        self.last_yolo_ms: float | None = None
        self._worker = None
        if self.async_yolo:
            self._worker = threading.Thread(target=self._yolo_loop, name="yolo-worker", daemon=True)
            self._worker.start()
        log.info(
            "ProctorDetector ready: phase=%s (%s) model=%s device=%s imgsz=%s async_yolo=%s",
            self.phase_key, self.phase_cfg["name"], self.phase_cfg["model_path"], self.device, IMG_SIZE, self.async_yolo,
        )

    @property
    def model_name(self) -> str:
        return os.path.basename(self.phase_cfg["model_path"] or "unknown")

    def tracker(self, session_id: str) -> SessionTracker:
        with self._sessions_lock:
            t = self._sessions.get(session_id)
            if t is None:
                t = self._sessions[session_id] = SessionTracker(session_id)
                self._expire_idle_locked()
            return t

    def _expire_idle_locked(self) -> None:
        now = time.time()
        for sid in [s for s, t in self._sessions.items() if t.last_activity and now - t.last_activity > SESSION_IDLE_EXPIRY_S]:
            self._sessions.pop(sid, None)

    def end_session(self, session_id: str) -> None:
        with self._sessions_lock:
            self._sessions.pop(session_id, None)
        with self._slot_cv:
            self._slots.pop(session_id, None)

    # --------------------------------------------------------------- YOLO

    def _run_yolo(self, session_id: str, frame: np.ndarray, ts: float) -> None:
        t0 = time.perf_counter()
        detections = self._yolo.detect(frame)
        self.last_yolo_ms = (time.perf_counter() - t0) * 1000
        with self._sessions_lock:
            tracker = self._sessions.get(session_id)
        if tracker is None:  # session ended while inference was running
            return
        if not self.phase_cfg.get("use_temporal_filter", True):
            for t in (tracker.phone, tracker.book):
                t.filter.on_threshold = 1
                t.filter.off_threshold = 1
        started = tracker.update_objects(detections, ts)
        events = []
        for ev, kind in started:
            ev["evidenceBase64"] = annotate_evidence(frame, kind, ev.get("boundingBox"), ev.get("confidence"), ts)
            ev["details"] = {"modelPhase": self.phase_key, "model": self.model_name, "imgsz": IMG_SIZE}
            events.append(ev)
        if events:
            tracker.push_events(events)

    def _yolo_loop(self) -> None:
        while True:
            with self._slot_cv:
                while not self._slots and not self._stop:
                    self._slot_cv.wait()
                if self._stop:
                    return
                session_id, (frame, ts) = self._slots.popitem(last=False)  # oldest waiting session first
            try:
                self._run_yolo(session_id, frame, ts)
            except Exception as exc:  # noqa: BLE001
                log.exception("YOLO inference failed: %s", exc)

    def _submit_yolo(self, session_id: str, frame: np.ndarray, ts: float) -> None:
        if not self.async_yolo:
            self._run_yolo(session_id, frame, ts)
            return
        with self._slot_cv:
            self._slots.pop(session_id, None)  # keep only the latest frame per session
            self._slots[session_id] = (frame, ts)
            self._slot_cv.notify()

    # ------------------------------------------------------------ analyze

    def analyze(self, frame: np.ndarray, session_id: str, ts: float | None = None) -> dict:
        ts = ts or time.time()
        tracker = self.tracker(session_id)
        clean = frame.copy()  # Option A: YOLO + evidence never see overlays

        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        with self._mesh_lock:
            mesh = self._face_mesh.process(rgb)
        faces = mesh.multi_face_landmarks or []
        face_count = len(faces)
        pose = calculate_head_pose(faces[0], w, h) if face_count == 1 else None

        tracker.update_face(face_count, pose, ts)
        self._submit_yolo(session_id, clean, ts)

        observation, events = tracker.drain()
        observation.update({"yoloLatencyMs": round(self.last_yolo_ms, 1) if self.last_yolo_ms else None, "phase": self.phase_key})
        return {"phase": self.phase_key, "model": self.model_name, "observation": observation, "events": events}

    def close(self) -> None:
        self._stop = True
        with self._slot_cv:
            self._slot_cv.notify_all()
        try:
            self._face_mesh.close()
        except Exception:  # noqa: BLE001
            pass
