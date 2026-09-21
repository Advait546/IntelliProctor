import cv2
import time
import numpy as np
import mediapipe as mp
import os
from ultralytics import YOLO
from temporal_filter import TemporalProctoringManager

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

# Phase configurations (Selectable via INTELLIPROCTOR_PHASE environment variable:
# 'phase0' (optimized), 'phase0_baseline' (original Phase 0 baseline), or 'phase1')
PHASE_CONFIGS = {
    "phase0_baseline": {
        "name": "Phase 0 (Original Baseline)",
        "model_path": "yolo11m.pt",
        "conf_threshold": 0.65,
        "min_size": 12,
        "target_classes": {
            "cell phone": {"type": "phone", "aspect_range": (1.3, 2.9), "color": (0, 0, 255)},
            "book":       {"type": "book",  "aspect_range": None,        "color": (0, 165, 255)},
        },
        "use_temporal_filter": False,
    },
    "phase0": {
        "name": "Phase 0 (Optimized Inference Pipeline)",
        "model_path": "yolo11m.pt",
        "conf_threshold": 0.65,
        "min_size": 12,
        "target_classes": {
            "cell phone": {"type": "phone", "aspect_range": (1.1, 2.9), "color": (0, 0, 255)},
            "book":       {"type": "book",  "aspect_range": None,        "color": (0, 165, 255)},
        },
        "use_temporal_filter": True,
    },
    "phase1": {
        "name": "Phase 1 (Fine-tuned Prohibited-Object Detector)",
        "model_path": "runs/detect/intelliproctor_phase1/weights/best.pt",
        "conf_threshold": 0.65,
        "min_size": 12,
        "target_classes": {
            "phone":         {"type": "phone", "aspect_range": (1.1, 2.9), "color": (0, 0, 255)},
            "book_notebook": {"type": "book",  "aspect_range": None,        "color": (0, 165, 255)},
        },
        "use_temporal_filter": True,
    },
}

CURRENT_PHASE = os.environ.get("INTELLIPROCTOR_PHASE", "phase0").lower()
if CURRENT_PHASE not in PHASE_CONFIGS or not os.path.exists(PHASE_CONFIGS[CURRENT_PHASE]["model_path"]):
    # Fallback to optimized Phase 0 if requested model weights are not found
    CURRENT_PHASE = "phase0"

active_cfg = PHASE_CONFIGS[CURRENT_PHASE]
MODEL_PATH = active_cfg["model_path"]
yolo_model = YOLO(MODEL_PATH)
CONF_THRESHOLD = active_cfg["conf_threshold"]
MIN_SIZE = active_cfg.get("min_size", 12)
IMG_SIZE = 1280
TARGET_CLASSES = active_cfg["target_classes"]
USE_TEMPORAL_FILTER = active_cfg.get("use_temporal_filter", False)

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

# MediaPipe landmark indices for 6 key face points:
# Nose tip, Chin, Left eye outer corner, Right eye outer corner, Left mouth corner, Right mouth corner
LANDMARK_IDS = [1, 152, 33, 263, 61, 287]

GENERIC_FACE_3D = np.array([
    [0.0, 0.0, 0.0],          # Nose tip
    [0.0, -330.0, -65.0],     # Chin
    [-225.0, 170.0, -135.0],  # Left eye outer corner
    [225.0, 170.0, -135.0],   # Right eye outer corner
    [-150.0, -150.0, -125.0], # Left mouth corner
    [150.0, -150.0, -125.0]   # Right mouth corner
], dtype=np.float64)

# Global data structure holding head pose estimates for all faces in the current frame
current_head_poses = []


def get_current_head_poses():
    """Exposes current frame head-pose measurements for external modules to retrieve."""
    return current_head_poses


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

        # Approximate camera matrix based on frame dimensions
        focal_length = float(w_img)
        cam_matrix = np.array([
            [focal_length, 0, w_img / 2.0],
            [0, focal_length, h_img / 2.0],
            [0, 0, 1.0]
        ], dtype=np.float64)
        dist_matrix = np.zeros((4, 1), dtype=np.float64)

        # Solve PnP
        success, rot_vec, trans_vec = cv2.solvePnP(
            GENERIC_FACE_3D, face_2d, cam_matrix, dist_matrix, flags=cv2.SOLVEPNP_ITERATIVE
        )
        if not success:
            return None

        # Convert rotation vector to rotation matrix
        rmat, _ = cv2.Rodrigues(rot_vec)

        # Extract Euler angles via RQ decomposition
        angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
        raw_pitch, raw_yaw, raw_roll = angles[0], angles[1], angles[2]

        # Normalize angles so facing straight ahead corresponds to ~0 degrees
        pitch = (raw_pitch - 180) if raw_pitch > 90 else raw_pitch
        yaw = raw_yaw
        roll = (raw_roll + 180) if raw_roll < -90 else (raw_roll - 180 if raw_roll > 90 else raw_roll)

        yaw_val = round(float(yaw), 1)
        pitch_val = round(float(pitch), 1)
        roll_val = round(float(roll), 1)

        # Check generous breathing-room neutral limits
        is_neutral = (abs(yaw_val) <= YAW_LIMIT) and (abs(pitch_val) <= PITCH_LIMIT) and (abs(roll_val) <= ROLL_LIMIT)

        return {
            "yaw": yaw_val,
            "pitch": pitch_val,
            "roll": roll_val,
            "is_neutral": is_neutral
        }
    except Exception:
        return None


def run_proctoring_loop():
    global current_head_poses
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Could not open webcam. Check camera index/permissions.")

    no_face_start = None  # timestamp when face count first dropped to 0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to grab frame.")
            break

        h_img, w_img = frame.shape[:2]
        now = time.time()

        # Reset current frame head-pose data
        current_head_poses = []

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
                    connection_drawing_spec=mp_drawing_styles
                        .get_default_face_mesh_tesselation_style(),
                )
                mp_drawing.draw_landmarks(
                    image=frame,
                    landmark_list=face_landmarks,
                    connections=mp_face_mesh.FACEMESH_CONTOURS,
                    landmark_drawing_spec=None,
                    connection_drawing_spec=mp_drawing_styles
                        .get_default_face_mesh_contours_style(),
                )
                xs = [lm.x * w_img for lm in face_landmarks.landmark]
                ys = [lm.y * h_img for lm in face_landmarks.landmark]
                x1, x2 = int(min(xs)), int(max(xs))
                y1, y2 = int(min(ys)), int(max(ys))
                cv2.putText(frame, "Face", (x1, y1 - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

                # Calculate head pose for current face
                head_pose = calculate_head_pose(face_landmarks, w_img, h_img)
                current_head_poses.append(head_pose)

                # Debug overlay for head pose angles & neutral state below face box
                if head_pose is not None:
                    pose_str = f"Yaw: {head_pose['yaw']}  Pitch: {head_pose['pitch']}  Roll: {head_pose['roll']}"
                    neutral_str = "Head: Neutral" if head_pose["is_neutral"] else "Head: Outside neutral range"

                    cv2.putText(frame, pose_str, (x1, min(y2 + 20, h_img - 25)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                    status_color = (0, 255, 0) if head_pose["is_neutral"] else (0, 165, 255)
                    cv2.putText(frame, neutral_str, (x1, min(y2 + 40, h_img - 5)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, status_color, 1)

        # --- Alert state tracking ---
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

        # 2. Object detection (phone + book)
        results = yolo_model(frame, imgsz=IMG_SIZE, device="cpu", verbose=False)[0]
        prohibited_counts = {"phone": 0, "book": 0}

        for box in results.boxes:
            cls_name = yolo_model.names[int(box.cls[0])]
            conf = float(box.conf[0])

            if cls_name not in TARGET_CLASSES or conf < CONF_THRESHOLD:
                continue

            x1, y1, x2, y2 = map(int, box.xyxy[0])
            box_w, box_h = x2 - x1, y2 - y1
            long_side = max(box_w, box_h)
            short_side = max(min(box_w, box_h), 1)
            aspect_ratio = long_side / short_side

            aspect_range = TARGET_CLASSES[cls_name]["aspect_range"]
            if aspect_range is not None and not (aspect_range[0] <= aspect_ratio <= aspect_range[1]):
                continue
            if short_side < MIN_SIZE:
                continue

            obj_type = TARGET_CLASSES[cls_name].get("type", "phone" if "phone" in cls_name else "book")
            prohibited_counts[obj_type] += 1
            color = TARGET_CLASSES[cls_name]["color"]
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(frame, f"{cls_name} {conf:.2f}", (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        # Alert generation (Temporal filtering if enabled, otherwise instantaneous frame detection)
        if USE_TEMPORAL_FILTER:
            temporal_alerts = temporal_manager.update(prohibited_counts)
            if temporal_alerts["phone"]:
                alerts.append("ALERT: Phone detected! (Persisted)")
            if temporal_alerts["book"]:
                alerts.append("ALERT: Book/notes detected! (Persisted)")
        else:
            if prohibited_counts["phone"] > 0:
                alerts.append("ALERT: Phone detected!")
            if prohibited_counts["book"] > 0:
                alerts.append("ALERT: Book/notes detected!")

        # 3. Status overlay
        temporal_indicator = " | Filter: Temporal" if USE_TEMPORAL_FILTER else " | Filter: Frame"
        status = (f"[{CURRENT_PHASE.upper()}{temporal_indicator}] Faces: {face_count} | Phones: {prohibited_counts['phone']} "
                  f"| Books: {prohibited_counts['book']}")
        cv2.putText(frame, status, (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)

        # Draw alerts stacked below status
        for i, alert_text in enumerate(alerts):
            cv2.putText(frame, alert_text, (10, 60 + i * 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

        cv2.imshow("Face + Phone Detector", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    face_mesh.close()
    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    run_proctoring_loop()