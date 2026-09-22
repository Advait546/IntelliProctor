import cv2
import time
import numpy as np
import mediapipe as mp
import os
import sys
import argparse
from pathlib import Path
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


# Global pipeline state (initialized to default phase0)
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


def set_active_phase(phase_name: str):
    """Dynamically switch the active proctoring phase and reload model weights."""
    global CURRENT_PHASE, active_cfg, MODEL_PATH, yolo_model
    global CONF_THRESHOLD, MIN_SIZE, TARGET_CLASSES, USE_TEMPORAL_FILTER

    CURRENT_PHASE, active_cfg = resolve_phase_config(phase_name)
    MODEL_PATH = active_cfg["model_path"]
    yolo_model = YOLO(MODEL_PATH)
    CONF_THRESHOLD = active_cfg["conf_threshold"]
    MIN_SIZE = active_cfg.get("min_size", 12)
    TARGET_CLASSES = active_cfg["target_classes"]
    USE_TEMPORAL_FILTER = active_cfg.get("use_temporal_filter", True)
    print(f"[INFO] IntelliProctor Active Phase set to: {active_cfg['name']} ({MODEL_PATH})")


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


def process_single_frame(frame: np.ndarray, no_face_start: float = None, now: float = None) -> tuple:
    """Processes a single video frame end-to-end:
    1. Runs MediaPipe Face Mesh on RGB frame.
    2. Runs YOLO on an unmodified CLEAN frame copy (MediaPipe overlay confound fix).
    3. Applies per-class confidence, aspect ratio, and size filters.
    4. Renders face landmarks, detection boxes, and status overlays onto display frame.
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
    mesh_results = face_mesh.process(rgb_frame)

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

    # 2. Object detection on CLEAN frame (isolated from drawings)
    results = yolo_model(clean_frame, imgsz=IMG_SIZE, device="cpu", verbose=False)[0]
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

    # Status overlay
    temporal_indicator = " | Filter: Temporal" if USE_TEMPORAL_FILTER else " | Filter: Frame"
    status = (f"[{CURRENT_PHASE.upper()}{temporal_indicator}] Faces: {face_count} | Phones: {prohibited_counts['phone']} "
              f"| Books: {prohibited_counts['book']}")
    cv2.putText(frame, status, (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)

    # Draw stacked alert overlays
    for i, alert_text in enumerate(alerts):
        cv2.putText(frame, alert_text, (10, 60 + i * 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

    return frame, alerts, prohibited_counts, face_count, no_face_start


def run_proctoring_loop(
    phase: str = None,
    camera_index: int = 0,
    max_frames: int = None,
    display: bool = True,
    synthetic: bool = False,
):
    """Main execution loop for webcam or synthetic proctoring feed."""
    if phase:
        set_active_phase(phase)

    print(f"[START] Starting IntelliProctor proctoring loop.")
    print(f"        Active Configuration: {active_cfg['name']}")
    print(f"        Model Checkpoint:     {MODEL_PATH}")
    print(f"        Temporal Filtering:   {USE_TEMPORAL_FILTER}")

    cap = None
    if not synthetic:
        cap = cv2.VideoCapture(camera_index)
        if not cap.isOpened():
            print(f"[WARN] Could not open webcam (index {camera_index}). Falling back to synthetic test feed.")
            synthetic = True

    no_face_start = None
    frame_count = 0

    try:
        while True:
            if synthetic:
                # Create a synthetic 1280x720 frame for testing/headless execution
                frame = np.full((720, 1280, 3), 40, dtype=np.uint8)
                cv2.putText(frame, f"Synthetic Exam Feed - Frame {frame_count}", (50, 360),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.0, (200, 200, 200), 2)
            else:
                ret, frame = cap.read()
                if not ret:
                    print("Failed to grab webcam frame.")
                    break

            frame_count += 1
            frame, alerts, counts, face_cnt, no_face_start = process_single_frame(
                frame, no_face_start=no_face_start, now=time.time()
            )

            if display:
                cv2.imshow("IntelliProctor - Production Detection", frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

            if max_frames and frame_count >= max_frames:
                print(f"[INFO] Reached requested max_frames ({max_frames}). Stopping loop.")
                break

    finally:
        face_mesh.close()
        if cap is not None:
            cap.release()
        if display:
            cv2.destroyAllWindows()
        print(f"[STOP] Proctoring loop terminated cleanly after {frame_count} frames.")


def parse_args():
    parser = argparse.ArgumentParser(description="IntelliProctor Production Video Input Analysis")
    parser.add_argument("--phase", type=str, default=None,
                        help="Select active phase: 'phase0' (default), 'phase2_gpu', 'phase0_baseline'")
    parser.add_argument("--camera", type=int, default=0,
                        help="Webcam device index (default: 0)")
    parser.add_argument("--test-frames", type=int, default=None,
                        help="Run for N frames and exit (useful for automated testing/CI)")
    parser.add_argument("--no-display", action="store_true",
                        help="Headless execution (do not open OpenCV display window)")
    parser.add_argument("--synthetic", action="store_true",
                        help="Run with synthetic generated frames instead of webcam")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_proctoring_loop(
        phase=args.phase,
        camera_index=args.camera,
        max_frames=args.test_frames,
        display=not args.no_display,
        synthetic=args.synthetic,
    )