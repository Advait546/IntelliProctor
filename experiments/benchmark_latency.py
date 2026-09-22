"""
Phase 0F: Latency Baseline Measurement on CPU.

Profiles per-frame processing time over 500 iterations:
- MediaPipe Face Mesh processing & head pose calculation
- Drawing overlays
- YOLOv11m inference (imgsz=1280, device='cpu')
- Post-processing filters & alert aggregation
Calculates Median, Mean, P90, P95, Min, Max latencies and FPS.
Saves results to tests/results/latency_baseline_results.json.
"""

import os
import time
import json
import numpy as np
import cv2
import mediapipe as mp
from ultralytics import YOLO

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_JSON = os.path.join(BASE_DIR, "tests", "results", "latency_baseline_results.json")

PRETRAINED_MODEL = os.path.join(BASE_DIR, "models", "pretrained", "yolo11m.pt")
MODEL_PATH = PRETRAINED_MODEL if os.path.exists(PRETRAINED_MODEL) else os.path.join(BASE_DIR, "yolo11m.pt")
IMG_SIZE = 1280
CONF_THRESHOLD = 0.65
TARGET_CLASSES = {
    "cell phone": {"aspect_range": (1.3, 2.9), "color": (0, 0, 255)},
    "book":       {"aspect_range": None,        "color": (0, 165, 255)},
}
YAW_LIMIT = 30.0
PITCH_LIMIT = 25.0
ROLL_LIMIT = 25.0
LANDMARK_IDS = [1, 152, 33, 263, 61, 287]
GENERIC_FACE_3D = np.array([
    [0.0, 0.0, 0.0],
    [0.0, -330.0, -65.0],
    [-225.0, 170.0, -135.0],
    [225.0, 170.0, -135.0],
    [-150.0, -150.0, -125.0],
    [150.0, -150.0, -125.0]
], dtype=np.float64)


def calculate_head_pose(face_landmarks, w_img, h_img):
    try:
        face_2d = []
        for idx in LANDMARK_IDS:
            lm = face_landmarks.landmark[idx]
            face_2d.append([lm.x * w_img, lm.y * h_img])
        face_2d = np.array(face_2d, dtype=np.float64)
        focal_length = float(w_img)
        cam_matrix = np.array([
            [focal_length, 0, w_img / 2.0],
            [0, focal_length, h_img / 2.0],
            [0, 0, 1.0]
        ], dtype=np.float64)
        dist_matrix = np.zeros((4, 1), dtype=np.float64)
        success, rot_vec, trans_vec = cv2.solvePnP(
            GENERIC_FACE_3D, face_2d, cam_matrix, dist_matrix, flags=cv2.SOLVEPNP_ITERATIVE
        )
        if not success:
            return None
        rmat, _ = cv2.Rodrigues(rot_vec)
        angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
        raw_pitch, raw_yaw, raw_roll = angles[0], angles[1], angles[2]
        pitch = (raw_pitch - 180) if raw_pitch > 90 else raw_pitch
        yaw = raw_yaw
        roll = (raw_roll + 180) if raw_roll < -90 else (raw_roll - 180 if raw_roll > 90 else raw_roll)
        return {
            "yaw": round(float(yaw), 1),
            "pitch": round(float(pitch), 1),
            "roll": round(float(roll), 1),
            "is_neutral": (abs(yaw) <= YAW_LIMIT) and (abs(pitch) <= PITCH_LIMIT) and (abs(roll) <= ROLL_LIMIT),
        }
    except Exception:
        return None


TASK_PATH = os.path.join(BASE_DIR, "face_landmarker.task")


def setup_face_detector():
    from mediapipe.tasks.python import vision, BaseOptions
    with open(TASK_PATH, "rb") as f:
        buf = f.read()
    options = vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_buffer=buf),
        running_mode=vision.RunningMode.IMAGE,
        num_faces=5,
    )
    return vision.FaceLandmarker.create_from_options(options)


def run_benchmark(num_frames: int = 500, warmup_frames: int = 20):
    print("=" * 70)
    print(f" PHASE 0F: LATENCY BASELINE MEASUREMENT ({num_frames} FRAMES)")
    print("=" * 70)
    
    detector = setup_face_detector()
    yolo_model = YOLO(MODEL_PATH)

    # Load or generate representative test frame (standard 720p 1280x720 webcam resolution)
    sample_img_path = os.path.join(BASE_DIR, "tests", "test_data", "phone", "WhatsApp Image 2026-08-31 at 14.34.58 (2).jpeg")
    if os.path.exists(sample_img_path):
        base_frame = cv2.imread(sample_img_path)
        base_frame = cv2.resize(base_frame, (1280, 720))
    else:
        base_frame = np.zeros((720, 1280, 3), dtype=np.uint8)

    print(f"Frame resolution: {base_frame.shape[1]}x{base_frame.shape[0]}")
    print(f"Warming up ({warmup_frames} frames)...")
    for _ in range(warmup_frames):
        frame = base_frame.copy()
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        _ = detector.detect(mp_img)
        _ = yolo_model(frame, imgsz=IMG_SIZE, device="cpu", verbose=False)[0]

    print(f"Running benchmark over {num_frames} frames...")
    mediapipe_times = []
    yolo_times = []
    postproc_times = []
    total_frame_times = []

    for i in range(num_frames):
        frame = base_frame.copy()
        h_img, w_img = frame.shape[:2]
        
        t0 = time.perf_counter()
        
        # 1. MediaPipe
        t_mp_start = time.perf_counter()
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        detection_result = detector.detect(mp_img)
        face_count = 0
        if detection_result.face_landmarks:
            face_count = len(detection_result.face_landmarks)
            for face_landmarks in detection_result.face_landmarks:
                xs = [lm.x * w_img for lm in face_landmarks]
                ys = [lm.y * h_img for lm in face_landmarks]
                x1, x2 = int(min(xs)), int(max(xs))
                y1, y2 = int(min(ys)), int(max(ys))
                for lm in face_landmarks:
                    cv2.circle(frame, (int(lm.x * w_img), int(lm.y * h_img)), 1, (255, 255, 255), -1)
                cv2.putText(frame, "Face", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                _ = calculate_head_pose(face_landmarks, w_img, h_img)
        t_mp_end = time.perf_counter()


        # 2. YOLO
        t_yolo_start = time.perf_counter()
        results = yolo_model(frame, imgsz=IMG_SIZE, device="cpu", verbose=False)[0]
        t_yolo_end = time.perf_counter()

        # 3. Post-processing & alert generation
        t_post_start = time.perf_counter()
        detection_counts = {name: 0 for name in TARGET_CLASSES}
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
            if short_side < 12:
                continue
            detection_counts[cls_name] += 1
        t_post_end = time.perf_counter()
        
        t_total_end = time.perf_counter()

        mediapipe_times.append((t_mp_end - t_mp_start) * 1000.0)
        yolo_times.append((t_yolo_end - t_yolo_start) * 1000.0)
        postproc_times.append((t_post_end - t_post_start) * 1000.0)
        total_frame_times.append((t_total_end - t0) * 1000.0)

        if (i + 1) % 100 == 0:
            print(f"  Processed {i + 1}/{num_frames} frames (current FPS: {1000.0 / np.median(total_frame_times):.2f})")

    def calc_stats(times):

        arr = np.array(times)
        return {
            "mean_ms": round(float(np.mean(arr)), 2),
            "median_ms": round(float(np.median(arr)), 2),
            "p90_ms": round(float(np.percentile(arr, 90)), 2),
            "p95_ms": round(float(np.percentile(arr, 95)), 2),
            "min_ms": round(float(np.min(arr)), 2),
            "max_ms": round(float(np.max(arr)), 2),
        }

    total_stats = calc_stats(total_frame_times)
    fps_median = round(1000.0 / total_stats["median_ms"], 2)
    fps_p95 = round(1000.0 / total_stats["p95_ms"], 2)

    results_payload = {
        "benchmark_name": "Phase 0F: Baseline Latency Measurement (CPU)",
        "hardware": "CPU",
        "num_frames_benchmarked": num_frames,
        "resolution": f"{base_frame.shape[1]}x{base_frame.shape[0]}",
        "yolo_imgsz": IMG_SIZE,
        "yolo_model": MODEL_PATH,
        "metrics": {
            "mediapipe_face_mesh": calc_stats(mediapipe_times),
            "yolo_inference": calc_stats(yolo_times),
            "post_processing_filtering": calc_stats(postproc_times),
            "total_frame": total_stats,
            "throughput_fps": {
                "median_fps": fps_median,
                "p95_fps": fps_p95,
            },
        },
    }

    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(results_payload, f, indent=2)

    print("\n" + "=" * 70)
    print(" BENCHMARK RESULTS:")
    print(f"  MediaPipe Face Mesh (median) : {results_payload['metrics']['mediapipe_face_mesh']['median_ms']} ms")
    print(f"  YOLOv11m Inference  (median) : {results_payload['metrics']['yolo_inference']['median_ms']} ms")
    print(f"  Post-processing     (median) : {results_payload['metrics']['post_processing_filtering']['median_ms']} ms")
    print(f"  Total Per-Frame     (median) : {total_stats['median_ms']} ms")
    print(f"  Total Per-Frame     (P95)    : {total_stats['p95_ms']} ms")
    print(f"  Effective Throughput (FPS)   : {fps_median} FPS (median), {fps_p95} FPS (P95)")
    print(f"  Results saved to             : {OUTPUT_JSON}")
    print("=" * 70)
    return results_payload


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--frames", type=int, default=500, help="Number of benchmark frames")
    parser.add_argument("--warmup", type=int, default=20, help="Number of warmup frames")
    args = parser.parse_args()
    run_benchmark(num_frames=args.frames, warmup_frames=args.warmup)
