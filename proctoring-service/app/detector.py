"""
Frame-in / alerts-out proctoring detector.

This ports the project's actual "production pipeline" (root `video_input_analysis.py`,
Phase 4 of the ML team's implementation plan) into a stateless-per-request class a
FastAPI server can call once per uploaded frame, instead of the earlier generic
YOLOv8n + MediaPipe wrapper this file used to be.

Two deliberate departures from `video_input_analysis.py`, both because that script
is written for a single webcam loop (one candidate, one continuous stream) while
this service handles many concurrent exam sessions over HTTP:

1. Temporal filtering (see `temporal_filter.py`) is per `session_id`, not a single
   shared global instance -- otherwise one student's phone-in-frame streak could
   "debounce" into another student's frames.
2. MediaPipe FaceMesh runs with `static_image_mode=True`: each request is an
   independent frame that may come from any of several sessions in any order, so
   there's no valid cross-frame tracking assumption to make (the production script
   uses `static_image_mode=False`, correct for its single continuous webcam feed).

Everything else -- the PHASE_CONFIGS model/threshold selection, the aspect-ratio
and confidence filtering, and the head-pose math -- is ported as close to verbatim
as those two constraints allow, so switching PHASE here behaves the same as
switching it in the webcam-loop script.
"""

import os
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from ultralytics import YOLO

from .temporal_filter import TemporalProctoringManager

# proctoring-service/app/detector.py -> proctoring-service/app -> proctoring-service -> project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def _existing(*parts) -> str | None:
    p = PROJECT_ROOT.joinpath(*parts)
    return str(p) if p.exists() else None


PRETRAINED_MODEL = _existing("models", "pretrained", "yolo11m.pt") or "yolo11m.pt"  # falls back to ultralytics auto-download by name
TRAINED_ITER1_MODEL = _existing("models", "trained", "intelliproctor_phase1_iter1", "best.pt") or _existing(
    "runs", "detect", "intelliproctor_phase1_iter1_gpu", "weights", "best.pt"
)
TRAINED_ITER2_MODEL = _existing("models", "trained", "intelliproctor_phase2_iter2", "weights", "best.pt")

# --- Phase configurations -----------------------------------------------------
# Mirrors video_input_analysis.py's PHASE_CONFIGS exactly: same model paths,
# same per-class confidence thresholds, same aspect-ratio filters.
#
# IMPORTANT -- production gate: reports/ml/PHASE3_POST_PROCESSING_REVIEW.md's
# "Production Integration Decision (Phase 4 Gate)" is explicit: "DO NOT DEPLOY
# ITERATION 1 MODEL TO PRODUCTION. Rollback/maintain baseline YOLO11m... Proceed
# to dataset expansion for Training Iteration 2." (Iteration 1's `best.pt` had a
# 47.9% false-positive rate on the team's 140-image negative benchmark, and
# book/notebook recall of only 35-50%.) That's why "phase0" -- the pretrained
# baseline with tuned aspect-ratio filters, NOT the fine-tuned model -- is the
# default here, exactly as it is in video_input_analysis.py. "phase2_gpu" stays
# wired in and selectable (e.g. for side-by-side comparison, or once a future
# iteration clears the gate) but must not become the default on its own.
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
        "name": "Phase 2 (Fine-Tuned Iteration 1 Model -- NOT production-approved; see module docstring)",
        "model_path": TRAINED_ITER1_MODEL,
        "target_classes": {
            "phone": {"type": "phone", "conf_threshold": 0.65, "aspect_range": (1.15, 2.9)},
            "book_notebook": {"type": "book", "conf_threshold": 0.50, "aspect_range": (0.80, 2.50)},
        },
        "use_temporal_filter": True,
    },
    "iteration2": {
        "name": "Iteration 2 (Multi-Subject Diverse Model -- placeholder, not yet trained)",
        "model_path": TRAINED_ITER2_MODEL,
        "target_classes": {
            "phone": {"type": "phone", "conf_threshold": 0.65, "aspect_range": (1.15, 2.9)},
            "book_notebook": {"type": "book", "conf_threshold": 0.65, "aspect_range": (0.80, 2.50)},
        },
        "use_temporal_filter": True,
    },
}

PHASE_ALIASES = {
    "phase1": "phase2_gpu",
    "phase2": "phase2_gpu",
    "default": "phase0",
    "baseline": "phase0_baseline",
}

IMG_SIZE = 1280
MIN_SIZE = 12
TEMPORAL_ON_THRESHOLD = 3
TEMPORAL_OFF_THRESHOLD = 4

# video_input_analysis.py hardcodes device="cpu" for inference even under the
# "phase2_gpu" name (that name refers to how the model was *trained*, not how
# it's served) -- their 864ms-median-latency benchmark that cleared the Phase 2
# gate was measured on CPU. Override via env var if you've separately validated
# GPU inference; it isn't covered by any of the ML team's reports.
PROCTOR_DEVICE = os.environ.get("PROCTOR_DEVICE", "cpu")


def resolve_phase(requested: str = None) -> tuple[str, dict]:
    """Same fallback behavior as video_input_analysis.py's resolve_phase_config:
    an unknown phase, or one whose model weights aren't present on disk, both
    fall back to 'phase0' rather than erroring."""
    requested = (requested or os.environ.get("INTELLIPROCTOR_PHASE", "phase0")).lower()
    key = PHASE_ALIASES.get(requested, requested)

    if key not in PHASE_CONFIGS:
        key = "phase0"

    cfg = PHASE_CONFIGS[key]
    if not cfg["model_path"] or not os.path.exists(cfg["model_path"]):
        key = "phase0"
        cfg = PHASE_CONFIGS["phase0"]

    return key, cfg


# --- Head pose estimation -------------------------------------------------
# Ported verbatim (thresholds, landmark indices, 3D model, Euler decomposition)
# from the project's current video_input_analysis.py.
YAW_LIMIT = 30.0
PITCH_LIMIT = 25.0
ROLL_LIMIT = 25.0

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
    """Calculates yaw, pitch, and roll using cv2.solvePnP() and Euler angle
    decomposition. Returns a dict with pose angles and is_neutral status, or
    None if calculation fails."""
    try:
        face_2d = np.array(
            [
                [face_landmarks.landmark[i].x * w_img, face_landmarks.landmark[i].y * h_img]
                for i in HEAD_POSE_LANDMARK_IDS
            ],
            dtype=np.float64,
        )

        focal_length = float(w_img)
        cam_matrix = np.array(
            [
                [focal_length, 0, w_img / 2.0],
                [0, focal_length, h_img / 2.0],
                [0, 0, 1.0],
            ],
            dtype=np.float64,
        )
        dist_coeffs = np.zeros((4, 1), dtype=np.float64)

        success, rot_vec, _ = cv2.solvePnP(
            GENERIC_FACE_3D, face_2d, cam_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE
        )
        if not success:
            return None

        rot_mat, _ = cv2.Rodrigues(rot_vec)
        sy = np.sqrt(rot_mat[0, 0] ** 2 + rot_mat[1, 0] ** 2)
        singular = sy < 1e-6

        if not singular:
            pitch = np.arctan2(rot_mat[2, 1], rot_mat[2, 2])
            yaw = np.arctan2(-rot_mat[2, 0], sy)
            roll = np.arctan2(rot_mat[1, 0], rot_mat[0, 0])
        else:
            pitch = np.arctan2(-rot_mat[1, 2], rot_mat[1, 1])
            yaw = np.arctan2(-rot_mat[2, 0], sy)
            roll = 0.0

        raw_pitch, raw_yaw, raw_roll = (
            float(np.degrees(pitch)),
            float(np.degrees(yaw)),
            float(np.degrees(roll)),
        )
        pitch = (raw_pitch + 180) if raw_pitch < -90 else (raw_pitch - 180 if raw_pitch > 90 else raw_pitch)
        roll = (raw_roll + 180) if raw_roll < -90 else (raw_roll - 180 if raw_roll > 90 else raw_roll)

        yaw_val, pitch_val, roll_val = round(raw_yaw, 1), round(pitch, 1), round(roll, 1)
        is_neutral = abs(yaw_val) <= YAW_LIMIT and abs(pitch_val) <= PITCH_LIMIT and abs(roll_val) <= ROLL_LIMIT

        return {"yaw": yaw_val, "pitch": pitch_val, "roll": roll_val, "is_neutral": is_neutral}
    except Exception:  # noqa: BLE001
        return None


class ProctorDetector:
    """Loads the ML models once and analyzes frames on demand for many
    concurrent exam sessions."""

    def __init__(self, phase: str = None):
        self.phase_key, self.phase_cfg = resolve_phase(phase)
        self._device = PROCTOR_DEVICE

        self._mp_face_mesh = mp.solutions.face_mesh
        self._face_mesh = self._mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=5,
            refine_landmarks=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

        self._yolo = YOLO(self.phase_cfg["model_path"])
        self._temporal_managers: dict[str, TemporalProctoringManager] = {}

        print(
            f"[ProctorDetector] Active phase: {self.phase_key} ({self.phase_cfg['name']}) "
            f"| model={self.phase_cfg['model_path']} | device={self._device}"
        )

    def _temporal_manager_for(self, session_id: str) -> TemporalProctoringManager:
        mgr = self._temporal_managers.get(session_id)
        if mgr is None:
            mgr = TemporalProctoringManager(
                categories=["phone", "book"],
                filter_type="hysteresis",
                on_threshold=TEMPORAL_ON_THRESHOLD,
                off_threshold=TEMPORAL_OFF_THRESHOLD,
            )
            self._temporal_managers[session_id] = mgr
        return mgr

    def end_session(self, session_id: str) -> None:
        """Drop a session's temporal-filter state once its exam is submitted, so
        the (small) per-session dict doesn't grow unbounded over the server's
        uptime. Safe to call even if the session was never seen."""
        self._temporal_managers.pop(session_id, None)

    def analyze(self, frame: np.ndarray, session_id: str = "default") -> dict:
        """frame: BGR image (as returned by cv2.imdecode). session_id: the exam
        session this frame belongs to, so temporal filtering doesn't mix state
        across different students. Returns a dict of detection results -- no
        drawing, no windows, just data."""

        alerts = []
        h_img, w_img = frame.shape[:2]
        target_classes = self.phase_cfg["target_classes"]

        # 1. Face count + head pose via MediaPipe Face Mesh
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_frame.flags.writeable = False
        mesh_results = self._face_mesh.process(rgb_frame)
        face_count = len(mesh_results.multi_face_landmarks) if mesh_results.multi_face_landmarks else 0

        if face_count == 0:
            alerts.append("Candidate not in frame")
        elif face_count > 1:
            alerts.append("Multiple faces detected")

        # Head pose is only meaningful with exactly one face -- with zero faces
        # there's nothing to measure, and with multiple faces the "multiple
        # persons" alert above already dominates the risk signal.
        head_pose = None
        looking_away = False
        if face_count == 1:
            head_pose = calculate_head_pose(mesh_results.multi_face_landmarks[0], w_img, h_img)
            if head_pose is not None and not head_pose["is_neutral"]:
                looking_away = True
                alerts.append("Candidate looking away from screen")

        # 2. Object detection via YOLO, using the active phase's model + per-class thresholds
        results = self._yolo(frame, imgsz=IMG_SIZE, device=self._device, verbose=False)[0]
        raw_counts = {"phone": 0, "book": 0}
        best_confidence = {"phone": 0.0, "book": 0.0}

        for box in results.boxes:
            cls_name = self._yolo.names[int(box.cls[0])]
            cls_cfg = target_classes.get(cls_name)
            if cls_cfg is None:
                continue

            conf = float(box.conf[0])
            if conf < cls_cfg["conf_threshold"]:
                continue

            x1, y1, x2, y2 = map(int, box.xyxy[0])
            box_w, box_h = x2 - x1, y2 - y1
            long_side = max(box_w, box_h)
            short_side = max(min(box_w, box_h), 1)
            aspect_ratio = long_side / short_side

            aspect_range = cls_cfg["aspect_range"]
            if aspect_range is not None and not (aspect_range[0] <= aspect_ratio <= aspect_range[1]):
                continue
            if short_side < MIN_SIZE:
                continue

            obj_type = cls_cfg["type"]
            raw_counts[obj_type] += 1
            best_confidence[obj_type] = max(best_confidence[obj_type], conf)

        # 3. Temporal filtering (per session), matching video_input_analysis.py's
        # behavior for whichever phase is active.
        if self.phase_cfg.get("use_temporal_filter", True):
            temporal = self._temporal_manager_for(session_id).update(raw_counts)
            phone_detected = temporal["phone"]
            book_detected = temporal["book"]
        else:
            phone_detected = raw_counts["phone"] > 0
            book_detected = raw_counts["book"] > 0

        if phone_detected:
            alerts.append("Phone detected")
        if book_detected:
            alerts.append("Book/notes detected")

        return {
            "phase": self.phase_key,
            "face_count": face_count,
            "phone_detected": phone_detected,
            # Confidence reflects *this frame's* raw detection, not the
            # (possibly temporally-persisted) alert state, so it never shows a
            # confidence for a frame that didn't actually see anything.
            "phone_confidence": f"{best_confidence['phone']:.2%}" if raw_counts["phone"] > 0 else None,
            "book_detected": book_detected,
            "book_confidence": f"{best_confidence['book']:.2%}" if raw_counts["book"] > 0 else None,
            "head_pose": head_pose,
            "looking_away": looking_away,
            "alerts": alerts,
        }

    def close(self):
        self._face_mesh.close()
