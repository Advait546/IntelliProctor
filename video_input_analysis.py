import cv2
import time
import numpy as np
import mediapipe as mp
import os
import sys
import argparse
from pathlib import Path
import torch
import threading
from ultralytics import YOLO
from temporal_filter import TemporalProctoringManager

# --- MediaPipe Initialization ---
mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=5,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)


def get_face_mesh():
    """Returns active FaceMesh instance, re-initializing if closed or uninitialized."""
    global face_mesh
    if face_mesh is None or getattr(face_mesh, "_graph", None) is None:
        face_mesh = mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=5,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
    return face_mesh

# --- Phase Configurations (Selectable via INTELLIPROCTOR_PHASE or --phase CLI arg) ---
PRETRAINED_MODEL = "models/pretrained/yolo11m.pt" if os.path.exists("models/pretrained/yolo11m.pt") else "yolo11m.pt"
TRAINED_ITER1_MODEL = (
    "models/trained/intelliproctor_phase1_iter1/best.pt"
    if os.path.exists("models/trained/intelliproctor_phase1_iter1/best.pt")
    else "runs/detect/intelliproctor_phase1_iter1_gpu/weights/best.pt"
)

PHASE_CONFIGS = {
    "phase0_baseline": {
        "name": "Phase 0 (Original Strict Baseline)",
        "model_path": PRETRAINED_MODEL,
        "conf_threshold": 0.65,
        "min_size": 12,
        "target_classes": {
            "cell phone": {"type": "phone", "conf_threshold": 0.65, "aspect_range": (1.3, 2.9), "color": (0, 0, 255)},
            "book":       {"type": "book",  "conf_threshold": 0.65, "aspect_range": None,        "color": (0, 165, 255)},
        },
        "use_temporal_filter": False,
    },
    "phase0": {
        "name": "Phase 0 (Optimized Production Baseline)",
        "model_path": PRETRAINED_MODEL,
        "conf_threshold": 0.65,
        "min_size": 12,
        "target_classes": {
            "cell phone": {"type": "phone", "conf_threshold": 0.65, "aspect_range": (1.15, 2.9), "color": (0, 0, 255)},
            "book":       {"type": "book",  "conf_threshold": 0.65, "aspect_range": (0.80, 2.50), "color": (0, 165, 255)},
        },
        "use_temporal_filter": True,
    },
    "phase2_gpu": {
        "name": "Phase 2 (Fine-Tuned Iteration 1 GPU Model)",
        "model_path": TRAINED_ITER1_MODEL,
        "conf_threshold": 0.65,
        "min_size": 12,
        "target_classes": {
            "phone":         {"type": "phone", "conf_threshold": 0.65, "aspect_range": (1.15, 2.9), "color": (0, 0, 255)},
            "book_notebook": {"type": "book",  "conf_threshold": 0.50, "aspect_range": (0.80, 2.50), "color": (0, 165, 255)},
        },
        "use_temporal_filter": True,
    },
    "iteration2": {
        "name": "Iteration 2 (Multi-Subject Diverse Model - Pre-wired Placeholder)",
        "model_path": "models/trained/intelliproctor_phase2_iter2/weights/best.pt",
        "conf_threshold": 0.65,
        "min_size": 12,
        "target_classes": {
            "phone":         {"type": "phone", "conf_threshold": 0.65, "aspect_range": (1.15, 2.9), "color": (0, 0, 255)},
            "book_notebook": {"type": "book",  "conf_threshold": 0.65, "aspect_range": (0.80, 2.50), "color": (0, 165, 255)},
        },
        "use_temporal_filter": True,
    },
}

# Aliases for convenience
PHASE_ALIASES = {
    "phase1": "phase2_gpu",
    "phase2": "phase2_gpu",
    "default": "phase0",
    "baseline": "phase0_baseline",
}


def resolve_phase_config(requested_phase: str = None) -> tuple:
    """Resolves requested phase key, validating checkpoint existence with safe fallback to phase0."""
    if not requested_phase:
        requested_phase = os.environ.get("INTELLIPROCTOR_PHASE", "phase0").lower()
    else:
        requested_phase = requested_phase.lower()

    resolved_key = PHASE_ALIASES.get(requested_phase, requested_phase)

    if resolved_key not in PHASE_CONFIGS:
        print(f"[WARN] Unknown phase '{requested_phase}'. Falling back to 'phase0'.")
        resolved_key = "phase0"

    cfg = PHASE_CONFIGS[resolved_key]
    model_path = cfg["model_path"]

    if not os.path.exists(model_path):
        print(f"[WARN] Model weights not found at '{model_path}'. Falling back to 'phase0'.")
        resolved_key = "phase0"
        cfg = PHASE_CONFIGS["phase0"]

    return resolved_key, cfg


def resolve_device(requested_device=None):
    """
    Resolves the execution device.
    Precedence:
    1. Explicit function argument / CLI arg (--device)
    2. INTELLIPROCTOR_DEVICE environment variable
    3. Auto-detection: GPU (0) if torch.cuda.is_available() else 'cpu'
    """
    target = requested_device
    if target is None:
        target = os.environ.get("INTELLIPROCTOR_DEVICE", None)

    if target is not None:
        target_str = str(target).strip().lower()
        if target_str in ("cuda", "gpu", "0"):
            if torch.cuda.is_available():
                return 0
            else:
                print("[WARN] CUDA requested but not available. Falling back to CPU.")
                return "cpu"
        elif target_str == "cpu":
            return "cpu"
        elif target_str.isdigit():
            idx = int(target_str)
            if torch.cuda.is_available() and idx < torch.cuda.device_count():
                return idx
            else:
                print(f"[WARN] CUDA device {idx} not available. Falling back to CPU.")
                return "cpu"
        return target

    # Auto-detect
    if torch.cuda.is_available():
        return 0
    return "cpu"


def get_device_description(dev) -> str:
    """Returns a user-friendly string describing the device."""
    if dev != "cpu" and torch.cuda.is_available():
        dev_idx = dev if isinstance(dev, int) else 0
        try:
            return f"GPU ({torch.cuda.get_device_name(dev_idx)})"
        except Exception:
            return f"GPU ({dev})"
    return "CPU"


# Global pipeline state (initialized to default phase0 with auto-detected GPU/CPU)
ACTIVE_DEVICE = resolve_device()
DEVICE_DESC = get_device_description(ACTIVE_DEVICE)

CURRENT_PHASE, active_cfg = resolve_phase_config()
MODEL_PATH = active_cfg["model_path"]
yolo_model = YOLO(MODEL_PATH)
CONF_THRESHOLD = active_cfg["conf_threshold"]
MIN_SIZE = active_cfg.get("min_size", 12)
IMG_SIZE = 1280
TARGET_CLASSES = active_cfg["target_classes"]
USE_TEMPORAL_FILTER = active_cfg.get("use_temporal_filter", True)

temporal_manager = TemporalProctoringManager(
    categories=["phone", "book"],
    filter_type="hysteresis",
    on_threshold=3,
    off_threshold=4,
)

NO_FACE_ALERT_SECONDS = 10

# --- Head Pose Estimation Settings & Generic 3D Model ---
YAW_LIMIT = 30.0    # degrees
PITCH_LIMIT = 25.0  # degrees
ROLL_LIMIT = 25.0   # degrees

LANDMARK_IDS = [1, 152, 33, 263, 61, 287]

GENERIC_FACE_3D = np.array([
    [0.0, 0.0, 0.0],          # Nose tip
    [0.0, -330.0, -65.0],     # Chin
    [-225.0, 170.0, -135.0],  # Left eye outer corner
    [225.0, 170.0, -135.0],   # Right eye outer corner
    [-150.0, -150.0, -125.0], # Left mouth corner
    [150.0, -150.0, -125.0]   # Right mouth corner
], dtype=np.float64)

current_head_poses = []


def get_current_head_poses():
    """Exposes current frame head-pose measurements for external modules to retrieve."""
    return current_head_poses


def set_active_device(device_name=None):
    """Dynamically sets the active execution device (e.g. 0, 'cuda', 'cpu')."""
    global ACTIVE_DEVICE, DEVICE_DESC
    ACTIVE_DEVICE = resolve_device(device_name)
    DEVICE_DESC = get_device_description(ACTIVE_DEVICE)
    print(f"[INFO] IntelliProctor Active Device set to: {DEVICE_DESC} ({ACTIVE_DEVICE})")


def set_active_phase(phase_name: str, device=None):
    """Dynamically switch the active proctoring phase and reload model weights."""
    global CURRENT_PHASE, active_cfg, MODEL_PATH, yolo_model
    global CONF_THRESHOLD, MIN_SIZE, TARGET_CLASSES, USE_TEMPORAL_FILTER

    if device is not None:
        set_active_device(device)

    CURRENT_PHASE, active_cfg = resolve_phase_config(phase_name)
    MODEL_PATH = active_cfg["model_path"]
    yolo_model = YOLO(MODEL_PATH)
    CONF_THRESHOLD = active_cfg["conf_threshold"]
    MIN_SIZE = active_cfg.get("min_size", 12)
    TARGET_CLASSES = active_cfg["target_classes"]
    USE_TEMPORAL_FILTER = active_cfg.get("use_temporal_filter", True)
    print(f"[INFO] IntelliProctor Active Phase set to: {active_cfg['name']} ({MODEL_PATH}) on {DEVICE_DESC}")


def calculate_head_pose(face_landmarks, w_img, h_img):
    """Calculates yaw, pitch, and roll using cv2.solvePnP() and Euler angle decomposition.
    Returns a dict with pose angles and is_neutral status, or None if calculation fails.
    """
    try:
        face_2d = []
        for idx in LANDMARK_IDS:
            lm = face_landmarks.landmark[idx]
            face_2d.append([lm.x * w_img, lm.y * h_img])
        face_2d = np.array(face_2d, dtype=np.float64)

        focal_length = w_img
        cam_center = (w_img / 2, h_img / 2)
        cam_matrix = np.array([
            [focal_length, 0, cam_center[0]],
            [0, focal_length, cam_center[1]],
            [0, 0, 1]
        ], dtype=np.float64)

        dist_coeffs = np.zeros((4, 1), dtype=np.float64)

        success, rot_vec, trans_vec = cv2.solvePnP(
            GENERIC_FACE_3D, face_2d, cam_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE
        )
        if not success:
            return None

        rot_mat, _ = cv2.Rodrigues(rot_vec)

        # Decompose rotation matrix into Euler angles
        sy = np.sqrt(rot_mat[0, 0] ** 2 + rot_mat[1, 0] ** 2)
        singular = sy < 1e-6

        if not singular:
            pitch = np.arctan2(rot_mat[2, 1], rot_mat[2, 2])
            yaw = np.arctan2(-rot_mat[2, 0], sy)
            roll = np.arctan2(rot_mat[1, 0], rot_mat[0, 0])
        else:
            pitch = np.arctan2(-rot_mat[1, 2], rot_mat[1, 1])
            yaw = np.arctan2(-rot_mat[2, 0], sy)
            roll = 0

        raw_pitch = float(np.degrees(pitch))
        raw_yaw = float(np.degrees(yaw))
        raw_roll = float(np.degrees(roll))

        pitch = (raw_pitch + 180) if raw_pitch < -90 else (raw_pitch - 180 if raw_pitch > 90 else raw_pitch)
        yaw = raw_yaw
        roll = (raw_roll + 180) if raw_roll < -90 else (raw_roll - 180 if raw_roll > 90 else raw_roll)

        yaw_val = round(float(yaw), 1)
        pitch_val = round(float(pitch), 1)
        roll_val = round(float(roll), 1)

        is_neutral = (abs(yaw_val) <= YAW_LIMIT) and (abs(pitch_val) <= PITCH_LIMIT) and (abs(roll_val) <= ROLL_LIMIT)

        return {
            "yaw": yaw_val,
            "pitch": pitch_val,
            "roll": roll_val,
            "is_neutral": is_neutral
        }
    except Exception:
        return None


def process_single_frame(
    frame: np.ndarray,
    no_face_start: float = None,
    now: float = None,
    fps: float = None,
) -> tuple:
    """Processes a single video frame end-to-end:
    1. Runs MediaPipe Face Mesh on RGB frame.
    2. Runs YOLO on an unmodified CLEAN frame copy (MediaPipe overlay confound fix).
    3. Applies per-class confidence, aspect ratio, and size filters on active GPU/CPU device.
    4. Renders face landmarks, detection boxes, FPS, and status overlays onto display frame.
    Returns: (annotated_frame, alerts, prohibited_counts, face_count, new_no_face_start)
    """
    global current_head_poses
    if now is None:
        now = time.time()

    h_img, w_img = frame.shape[:2]
    current_head_poses = []
    alerts = []

    # Phase 4 Confound Fix: Capture clean frame copy for YOLO before any drawings
    clean_frame = frame.copy()

    # 1. Face detection (MediaPipe Face Mesh)
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    rgb_frame.flags.writeable = False
    mesh_results = get_face_mesh().process(rgb_frame)

    face_count = 0
    if mesh_results.multi_face_landmarks:
        face_count = len(mesh_results.multi_face_landmarks)
        for face_landmarks in mesh_results.multi_face_landmarks:
            mp_drawing.draw_landmarks(
                image=frame,
                landmark_list=face_landmarks,
                connections=mp_face_mesh.FACEMESH_TESSELATION,
                landmark_drawing_spec=None,
                connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_tesselation_style(),
            )
            mp_drawing.draw_landmarks(
                image=frame,
                landmark_list=face_landmarks,
                connections=mp_face_mesh.FACEMESH_CONTOURS,
                landmark_drawing_spec=None,
                connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_contours_style(),
            )
            xs = [lm.x * w_img for lm in face_landmarks.landmark]
            ys = [lm.y * h_img for lm in face_landmarks.landmark]
            x1, x2 = int(min(xs)), int(max(xs))
            y1, y2 = int(min(ys)), int(max(ys))
            cv2.putText(frame, "Face", (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

            head_pose = calculate_head_pose(face_landmarks, w_img, h_img)
            current_head_poses.append(head_pose)

            if head_pose is not None:
                pose_str = f"Yaw: {head_pose['yaw']}  Pitch: {head_pose['pitch']}  Roll: {head_pose['roll']}"
                neutral_str = "Head: Neutral" if head_pose["is_neutral"] else "Head: Outside neutral range"

                cv2.putText(frame, pose_str, (x1, min(y2 + 20, h_img - 25)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                status_color = (0, 255, 0) if head_pose["is_neutral"] else (0, 165, 255)
                cv2.putText(frame, neutral_str, (x1, min(y2 + 40, h_img - 5)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, status_color, 1)

    # Face count alerts
    if face_count == 0:
        if no_face_start is None:
            no_face_start = now
        elif now - no_face_start >= NO_FACE_ALERT_SECONDS:
            alerts.append("ALERT: Candidate not in frame!")
    else:
        no_face_start = None

    if face_count > 1:
        alerts.append("ALERT: Multiple faces detected!")

    # 2. Object detection on CLEAN frame (isolated from drawings) using GPU/CPU
    results = yolo_model(clean_frame, imgsz=IMG_SIZE, device=ACTIVE_DEVICE, verbose=False)[0]
    prohibited_counts = {"phone": 0, "book": 0}

    for box in results.boxes:
        cls_name = yolo_model.names[int(box.cls[0])]
        conf = float(box.conf[0])

        if cls_name not in TARGET_CLASSES:
            continue

        cls_cfg = TARGET_CLASSES[cls_name]
        cls_conf_thresh = cls_cfg.get("conf_threshold", CONF_THRESHOLD)

        if conf < cls_conf_thresh:
            continue

        x1, y1, x2, y2 = map(int, box.xyxy[0])
        box_w, box_h = x2 - x1, y2 - y1
        long_side = max(box_w, box_h)
        short_side = max(min(box_w, box_h), 1)
        aspect_ratio = long_side / short_side

        aspect_range = cls_cfg.get("aspect_range")
        if aspect_range is not None and not (aspect_range[0] <= aspect_ratio <= aspect_range[1]):
            continue
        if short_side < MIN_SIZE:
            continue

        obj_type = cls_cfg.get("type", "phone" if "phone" in cls_name else "book")
        prohibited_counts[obj_type] += 1
        color = cls_cfg.get("color", (0, 0, 255))
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(frame, f"{cls_name} {conf:.2f}", (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    # Alert generation
    if USE_TEMPORAL_FILTER:
        temporal_alerts = temporal_manager.update(prohibited_counts)
        if temporal_alerts.get("phone"):
            alerts.append("ALERT: Phone detected! (Persisted)")
        if temporal_alerts.get("book"):
            alerts.append("ALERT: Book/notes detected! (Persisted)")
    else:
        if prohibited_counts["phone"] > 0:
            alerts.append("ALERT: Phone detected!")
        if prohibited_counts["book"] > 0:
            alerts.append("ALERT: Book/notes detected!")

    # Status overlay (with device and real-time FPS)
    temporal_indicator = " | Filter: Temporal" if USE_TEMPORAL_FILTER else " | Filter: Frame"
    fps_indicator = f" | {fps:.1f} FPS" if fps is not None else ""
    status = (f"[{CURRENT_PHASE.upper()} | {DEVICE_DESC}{fps_indicator}{temporal_indicator}] "
              f"Faces: {face_count} | Phones: {prohibited_counts['phone']} | Books: {prohibited_counts['book']}")
    cv2.putText(frame, status, (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)

    # Draw stacked alert overlays
    for i, alert_text in enumerate(alerts):
        cv2.putText(frame, alert_text, (10, 60 + i * 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

    return frame, alerts, prohibited_counts, face_count, no_face_start


# ==============================================================================
# DECOUPLED WEBCAM CAPTURE & ASYNCHRONOUS INFERENCE PIPELINE
# ==============================================================================

class WebcamCaptureStream:
    """
    Dedicated webcam capture thread with a thread-safe latest-frame buffer.
    Guarantees that readers always receive the most recent frame from the camera,
    preventing stale frames from accumulating in OpenCV/driver queues.
    """
    def __init__(self, camera_index: int = 0, width: int = 1280, height: int = 720):
        self.camera_index = camera_index
        self.width = width
        self.height = height
        self.cap = None
        self._lock = threading.Lock()
        self._latest_frame = None
        self._frame_timestamp = 0.0
        self._ret = False
        self._running = False
        self._thread = None
        self._new_frame_event = threading.Event()

    def start(self) -> bool:
        if sys.platform.startswith("win"):
            self.cap = cv2.VideoCapture(self.camera_index, cv2.CAP_DSHOW)
            if not self.cap.isOpened():
                self.cap = cv2.VideoCapture(self.camera_index)
        else:
            self.cap = cv2.VideoCapture(self.camera_index)

        if not self.cap.isOpened():
            return False

        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        self._running = True
        self._thread = threading.Thread(
            target=self._capture_worker,
            name="WebcamCaptureThread",
            daemon=True,
        )
        self._thread.start()
        # Wait up to 2 seconds for the first frame
        self._new_frame_event.wait(timeout=2.0)
        return self._ret

    def _capture_worker(self):
        while self._running and self.cap.isOpened():
            ret, frame = self.cap.read()
            if not ret:
                time.sleep(0.005)
                continue
            now = time.time()
            with self._lock:
                self._ret = ret
                self._latest_frame = frame
                self._frame_timestamp = now
            self._new_frame_event.set()

    def read_latest(self) -> tuple:
        """Returns (ret, frame, timestamp) of the freshest available frame."""
        with self._lock:
            if self._latest_frame is None:
                return self._ret, None, 0.0
            return self._ret, self._latest_frame.copy(), self._frame_timestamp

    def is_opened(self) -> bool:
        return self.cap is not None and self.cap.isOpened()

    def stop(self):
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)
        if self.cap and self.cap.isOpened():
            self.cap.release()


class DetectionState:
    """Thread-safe container holding latest YOLO detection results with TTL expiration."""
    def __init__(self, ttl_seconds: float = 1.5):
        self.ttl_seconds = ttl_seconds
        self._lock = threading.Lock()
        self.boxes = []
        self.prohibited_counts = {"phone": 0, "book": 0}
        self.timestamp = 0.0
        self.duration_ms = 0.0
        self.total_inferences = 0

    def update(self, boxes: list, prohibited_counts: dict, timestamp: float, duration_ms: float):
        with self._lock:
            self.boxes = boxes
            self.prohibited_counts = prohibited_counts
            self.timestamp = timestamp
            self.duration_ms = duration_ms
            self.total_inferences += 1

    def get_detections(self, current_time: float) -> tuple:
        """
        Returns (boxes, prohibited_counts, is_stale, duration_ms).
        If detections are older than ttl_seconds, returns empty boxes to prevent stale ghost boxes.
        """
        with self._lock:
            if self.timestamp == 0.0:
                return [], {"phone": 0, "book": 0}, True, 0.0
            is_stale = (current_time - self.timestamp) > self.ttl_seconds
            if is_stale:
                return [], {"phone": 0, "book": 0}, True, self.duration_ms
            return list(self.boxes), dict(self.prohibited_counts), False, self.duration_ms


class YOLOInferenceWorker:
    """
    Background worker that runs YOLO object detection asynchronously.
    Drains the newest submitted clean frame, executes YOLO inference,
    applies aspect-ratio and size filtering, and atomically updates DetectionState.
    """
    def __init__(
        self,
        model,
        target_classes: dict,
        conf_threshold: float,
        min_size: int,
        imgsz: int,
        device,
        detection_state: DetectionState,
    ):
        self.model = model
        self.target_classes = target_classes
        self.conf_threshold = conf_threshold
        self.min_size = min_size
        self.imgsz = imgsz
        self.device = device
        self.detection_state = detection_state

        self._running = False
        self._thread = None
        self._pending_frame = None
        self._pending_timestamp = 0.0
        self._lock = threading.Lock()
        self._work_event = threading.Event()

    def start(self):
        self._running = True
        self._thread = threading.Thread(
            target=self._worker_loop,
            name="YOLOInferenceWorker",
            daemon=True,
        )
        self._thread.start()

    def submit_frame(self, frame: np.ndarray, timestamp: float):
        """Submits the freshest clean frame. Replaces any pending unstarted frame."""
        with self._lock:
            self._pending_frame = frame
            self._pending_timestamp = timestamp
        self._work_event.set()

    def is_busy(self) -> bool:
        """Returns True if worker is currently processing a frame or has one queued."""
        with self._lock:
            return self._pending_frame is not None

    def _worker_loop(self):
        while self._running:
            self._work_event.wait(timeout=0.1)
            if not self._running:
                break

            frame_to_process = None
            frame_ts = 0.0
            with self._lock:
                if self._pending_frame is not None:
                    frame_to_process = self._pending_frame
                    frame_ts = self._pending_timestamp
                    self._pending_frame = None
                    self._work_event.clear()

            if frame_to_process is None:
                continue

            t_start = time.perf_counter()
            try:
                results = self.model(
                    frame_to_process, imgsz=self.imgsz, device=self.device, verbose=False
                )[0]

                boxes = []
                prohibited_counts = {"phone": 0, "book": 0}

                for box in results.boxes:
                    cls_name = self.model.names[int(box.cls[0])]
                    conf = float(box.conf[0])

                    if cls_name not in self.target_classes:
                        continue

                    cls_cfg = self.target_classes[cls_name]
                    cls_conf_thresh = cls_cfg.get("conf_threshold", self.conf_threshold)

                    if conf < cls_conf_thresh:
                        continue

                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    box_w, box_h = x2 - x1, y2 - y1
                    long_side = max(box_w, box_h)
                    short_side = max(min(box_w, box_h), 1)
                    aspect_ratio = long_side / short_side

                    aspect_range = cls_cfg.get("aspect_range")
                    if aspect_range is not None and not (aspect_range[0] <= aspect_ratio <= aspect_range[1]):
                        continue
                    if short_side < self.min_size:
                        continue

                    obj_type = cls_cfg.get("type", "phone" if "phone" in cls_name else "book")
                    prohibited_counts[obj_type] += 1
                    color = cls_cfg.get("color", (0, 0, 255))
                    boxes.append({
                        "box": (x1, y1, x2, y2),
                        "cls_name": cls_name,
                        "conf": conf,
                        "color": color,
                        "type": obj_type,
                    })

                duration_ms = (time.perf_counter() - t_start) * 1000
                self.detection_state.update(boxes, prohibited_counts, time.time(), duration_ms)

            except Exception as e:
                print(f"[WARN] YOLOInferenceWorker error: {e}")

    def stop(self):
        self._running = False
        self._work_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)


def run_proctoring_loop(
    phase: str = None,
    camera_index: int = 0,
    max_frames: int = None,
    display: bool = True,
    synthetic: bool = False,
    device: str = None,
    imgsz: int = None,
    clean_overlay: bool = False,
):
    """Main execution loop: Decouples capture, MediaPipe tracking, and asynchronous YOLO detection."""
    global IMG_SIZE, current_head_poses
    if device is not None:
        set_active_device(device)
    if imgsz is not None:
        IMG_SIZE = imgsz
    if phase:
        set_active_phase(phase)

    print(f"[START] Starting IntelliProctor proctoring loop (Decoupled Real-Time Architecture).")
    print(f"        Active Configuration: {active_cfg['name']}")
    print(f"        Model Checkpoint:     {MODEL_PATH}")
    print(f"        Execution Device:     {DEVICE_DESC} ({ACTIVE_DEVICE})")
    print(f"        Inference Image Size: {IMG_SIZE}")
    print(f"        Temporal Filtering:   {USE_TEMPORAL_FILTER}")

    cap_stream = None
    if not synthetic:
        cap_stream = WebcamCaptureStream(camera_index=camera_index)
        opened = cap_stream.start()
        if not opened:
            print(f"[WARN] Could not open webcam (index {camera_index}). Falling back to synthetic test feed.")
            synthetic = True
            if cap_stream:
                cap_stream.stop()
                cap_stream = None

    detection_state = DetectionState(ttl_seconds=1.5)
    worker = YOLOInferenceWorker(
        model=yolo_model,
        target_classes=TARGET_CLASSES,
        conf_threshold=CONF_THRESHOLD,
        min_size=MIN_SIZE,
        imgsz=IMG_SIZE,
        device=ACTIVE_DEVICE,
        detection_state=detection_state,
    )
    worker.start()

    minimal_mesh = clean_overlay
    last_evaluated_inf_id = -1
    cached_alerts = []
    no_face_start = None
    frame_count = 0
    fps_smooth = 0.0
    last_frame_time = time.time()

    try:
        while True:
            # 1. Fetch freshest available frame (0ms buffer latency)
            if synthetic:
                frame = np.full((720, 1280, 3), 40, dtype=np.uint8)
                cv2.putText(frame, f"Synthetic Exam Feed - Frame {frame_count}", (50, 360),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.0, (200, 200, 200), 2)
                time.sleep(0.033)
            else:
                ret, frame, frame_ts = cap_stream.read_latest()
                if not ret or frame is None:
                    time.sleep(0.005)
                    continue

            now = time.time()
            dt = now - last_frame_time
            last_frame_time = now
            if dt > 0:
                current_fps = 1.0 / dt
                fps_smooth = current_fps if fps_smooth == 0.0 else (0.9 * fps_smooth + 0.1 * current_fps)

            frame_count += 1

            # Submit clean copy to inference worker (non-blocking)
            worker.submit_frame(frame.copy(), now)

            # 2. Face detection & head pose estimation (MediaPipe Face Mesh)
            h_img, w_img = frame.shape[:2]
            current_head_poses = []
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb_frame.flags.writeable = False
            mesh_results = get_face_mesh().process(rgb_frame)

            face_count = 0
            if mesh_results.multi_face_landmarks:
                face_count = len(mesh_results.multi_face_landmarks)
                for face_landmarks in mesh_results.multi_face_landmarks:
                    if not minimal_mesh:
                        mp_drawing.draw_landmarks(
                            image=frame,
                            landmark_list=face_landmarks,
                            connections=mp_face_mesh.FACEMESH_TESSELATION,
                            landmark_drawing_spec=None,
                            connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_tesselation_style(),
                        )
                    mp_drawing.draw_landmarks(
                        image=frame,
                        landmark_list=face_landmarks,
                        connections=mp_face_mesh.FACEMESH_CONTOURS,
                        landmark_drawing_spec=None,
                        connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_contours_style(),
                    )
                    xs = [lm.x * w_img for lm in face_landmarks.landmark]
                    ys = [lm.y * h_img for lm in face_landmarks.landmark]
                    x1, x2 = int(min(xs)), int(max(xs))
                    y1, y2 = int(min(ys)), int(max(ys))
                    cv2.putText(frame, "Face", (x1, y1 - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

                    head_pose = calculate_head_pose(face_landmarks, w_img, h_img)
                    current_head_poses.append(head_pose)

                    if head_pose is not None:
                        pose_str = f"Yaw: {head_pose['yaw']}  Pitch: {head_pose['pitch']}  Roll: {head_pose['roll']}"
                        neutral_str = "Head: Neutral" if head_pose["is_neutral"] else "Head: Outside neutral range"
                        cv2.putText(frame, pose_str, (x1, min(y2 + 20, h_img - 25)),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                        status_color = (0, 255, 0) if head_pose["is_neutral"] else (0, 165, 255)
                        cv2.putText(frame, neutral_str, (x1, min(y2 + 40, h_img - 5)),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, status_color, 1)

            # Face count alerts
            alerts = []
            if face_count == 0:
                if no_face_start is None:
                    no_face_start = now
                elif now - no_face_start >= NO_FACE_ALERT_SECONDS:
                    alerts.append("ALERT: Candidate not in frame!")
            else:
                no_face_start = None

            if face_count > 1:
                alerts.append("ALERT: Multiple faces detected!")

            # 3. Retrieve decoupled YOLO detections
            boxes, prohibited_counts, is_stale, yolo_ms = detection_state.get_detections(now)

            # Render detection boxes
            for det in boxes:
                bx1, by1, bx2, by2 = det["box"]
                bcolor = det["color"]
                blabel = f"{det['cls_name']} {det['conf']:.2f}"
                cv2.rectangle(frame, (bx1, by1), (bx2, by2), bcolor, 2)
                cv2.putText(frame, blabel, (bx1, by1 - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, bcolor, 2)

            # Update temporal filter when new inference result is available
            cur_inf_id = detection_state.total_inferences
            if cur_inf_id != last_evaluated_inf_id:
                last_evaluated_inf_id = cur_inf_id
                cached_alerts = []
                if USE_TEMPORAL_FILTER:
                    temporal_alerts = temporal_manager.update(prohibited_counts)
                    if temporal_alerts.get("phone"):
                        cached_alerts.append("ALERT: Phone detected! (Persisted)")
                    if temporal_alerts.get("book"):
                        cached_alerts.append("ALERT: Book/notes detected! (Persisted)")
                else:
                    if prohibited_counts["phone"] > 0:
                        cached_alerts.append("ALERT: Phone detected!")
                    if prohibited_counts["book"] > 0:
                        cached_alerts.append("ALERT: Book/notes detected!")

            alerts.extend(cached_alerts)

            # 4. Status overlay with real-time display FPS and background YOLO latency
            temporal_indicator = " | Filter: Temporal" if USE_TEMPORAL_FILTER else " | Filter: Frame"
            fps_indicator = f" | {fps_smooth:.1f} FPS"
            yolo_indicator = f" | YOLO: {yolo_ms:.0f}ms" if yolo_ms > 0 else ""
            status = (f"[{CURRENT_PHASE.upper()} | {DEVICE_DESC}{fps_indicator}{yolo_indicator}{temporal_indicator}] "
                      f"Faces: {face_count} | Phones: {prohibited_counts['phone']} | Books: {prohibited_counts['book']}")
            cv2.putText(frame, status, (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)

            for i, alert_text in enumerate(alerts):
                cv2.putText(frame, alert_text, (10, 60 + i * 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

            if display:
                cv2.imshow("IntelliProctor - Production Detection", frame)
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    break
                elif key == ord('m'):
                    minimal_mesh = not minimal_mesh
                    print(f"[INFO] Mesh overlay mode toggled: {'Clean Contours' if minimal_mesh else 'Full Tessellation'}")

            if max_frames and frame_count >= max_frames:
                print(f"[INFO] Reached requested max_frames ({max_frames}). Stopping loop.")
                break

    finally:
        global face_mesh
        if face_mesh is not None:
            face_mesh.close()
            face_mesh = None
        worker.stop()
        if cap_stream is not None:
            cap_stream.stop()
        if display:
            cv2.destroyAllWindows()
        print(f"[STOP] Proctoring loop terminated cleanly after {frame_count} frames (avg FPS: {fps_smooth:.1f}).")


def parse_args():
    parser = argparse.ArgumentParser(description="IntelliProctor Production Video Input Analysis")
    parser.add_argument("--phase", type=str, default=None,
                        help="Select active phase: 'phase0' (default), 'phase2_gpu', 'phase0_baseline'")
    parser.add_argument("--device", type=str, default=None,
                        help="Inference device: '0', 'cuda', 'cpu' (default: auto-detect GPU)")
    parser.add_argument("--imgsz", type=int, default=1280,
                        help="YOLO inference image size (default: 1280)")
    parser.add_argument("--camera", type=int, default=0,
                        help="Webcam device index (default: 0)")
    parser.add_argument("--test-frames", type=int, default=None,
                        help="Run for N frames and exit (useful for automated testing/CI)")
    parser.add_argument("--no-display", action="store_true",
                        help="Headless execution (do not open OpenCV display window)")
    parser.add_argument("--synthetic", action="store_true",
                        help="Run with synthetic generated frames instead of webcam")
    parser.add_argument("--clean-overlay", action="store_true",
                        help="Start with clean face contour overlays to reduce visual clutter (toggle live with 'm')")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_proctoring_loop(
        phase=args.phase,
        camera_index=args.camera,
        max_frames=args.test_frames,
        display=not args.no_display,
        synthetic=args.synthetic,
        device=args.device,
        imgsz=args.imgsz,
        clean_overlay=args.clean_overlay,
    )