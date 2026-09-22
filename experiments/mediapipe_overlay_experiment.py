"""
Phase 0E: MediaPipe Face Mesh Overlay Impact Assessment on YOLO Detection.

Evaluates whether drawing MediaPipe Face Mesh overlays (tesselation, contours, face label)
onto the frame before YOLO inference (as done in video_input_analysis.py) impacts
YOLO object detection results compared to clean images.
"""

import os
import sys
import json
import cv2
import numpy as np
import mediapipe as mp
from ultralytics import YOLO

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from tests.detector_evaluator import (
    MODEL_PATH,
    CONF_THRESHOLD,
    IMG_SIZE,
    TARGET_CLASSES,
)

PHONE_DIR = os.path.join(BASE_DIR, "tests", "test_data", "phone")
BOOK_DIR = os.path.join(BASE_DIR, "tests", "test_data", "book")
OUTPUT_JSON = os.path.join(BASE_DIR, "tests", "results", "mediapipe_overlay_impact.json")



TASK_PATH = os.path.join(BASE_DIR, "face_landmarker.task")


def setup_mediapipe():
    from mediapipe.tasks.python import vision, BaseOptions
    with open(TASK_PATH, "rb") as f:
        buf = f.read()
    options = vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_buffer=buf),
        running_mode=vision.RunningMode.IMAGE,
        num_faces=5,
    )
    detector = vision.FaceLandmarker.create_from_options(options)
    return detector


def apply_mediapipe_overlay(img, detector):
    """Applies face mesh and face label drawing matching production overlay on an image copy."""
    overlay_img = img.copy()
    h_img, w_img = overlay_img.shape[:2]
    rgb_frame = cv2.cvtColor(overlay_img, cv2.COLOR_BGR2RGB)
    mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
    detection_result = detector.detect(mp_img)

    face_detected = False
    face_count = 0
    if detection_result.face_landmarks:
        face_detected = True
        face_count = len(detection_result.face_landmarks)
        for face_landmarks in detection_result.face_landmarks:
            xs = [lm.x * w_img for lm in face_landmarks]
            ys = [lm.y * h_img for lm in face_landmarks]
            x1, x2 = int(min(xs)), int(max(xs))
            y1, y2 = int(min(ys)), int(max(ys))
            
            # Draw facial mesh points & connections (tesselation simulation)
            for lm in face_landmarks:
                px = int(lm.x * w_img)
                py = int(lm.y * h_img)
                cv2.circle(overlay_img, (px, py), 1, (255, 255, 255), -1)

            cv2.putText(overlay_img, "Face", (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    return overlay_img, face_detected, face_count



def run_yolo_detection(model, img):
    results = model(img, imgsz=IMG_SIZE, device="cpu", verbose=False)[0]
    detections = []
    for box in results.boxes:
        cls_id = int(box.cls[0])
        cls_name = model.names[cls_id]
        conf = float(box.conf[0])
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        w, h = x2 - x1, y2 - y1
        long_side = max(w, h)
        short_side = max(min(w, h), 1)
        aspect = round(long_side / short_side, 3)

        is_target = cls_name in TARGET_CLASSES
        passes_conf = conf >= CONF_THRESHOLD
        aspect_range = TARGET_CLASSES[cls_name]["aspect_range"] if is_target else None
        passes_aspect = True
        if aspect_range is not None:
            passes_aspect = aspect_range[0] <= aspect <= aspect_range[1]
        passes_size = short_side >= 12
        accepted = is_target and passes_conf and passes_aspect and passes_size

        detections.append({
            "class_name": cls_name,
            "confidence": round(conf, 4),
            "bbox": [x1, y1, x2, y2],
            "aspect_ratio": aspect,
            "accepted_by_filters": accepted,
        })
    return detections


def evaluate_overlay_impact():
    print("=" * 70)
    print(" PHASE 0E: MEDIAPIPE OVERLAY IMPACT EXPERIMENT")
    print("=" * 70)
    
    yolo_model = YOLO(MODEL_PATH)
    detector = setup_mediapipe()

    test_dirs = [("phone", PHONE_DIR), ("book", BOOK_DIR)]
    comparisons = []
    total_images = 0
    images_with_faces = 0
    discrepancies = 0

    for cat, cdir in test_dirs:
        if not os.path.isdir(cdir):
            continue
        files = sorted([f for f in os.listdir(cdir) if f.lower().endswith((".jpg", ".jpeg", ".png"))])
        for fname in files:
            fpath = os.path.join(cdir, fname)
            img = cv2.imread(fpath)
            if img is None:
                continue
            total_images += 1

            # 1. Clean frame YOLO
            clean_dets = run_yolo_detection(yolo_model, img)

            # 2. Overlay frame YOLO
            overlay_img, has_face, face_cnt = apply_mediapipe_overlay(img, detector)

            if has_face:
                images_with_faces += 1

            overlay_dets = run_yolo_detection(yolo_model, overlay_img)

            # Compare clean vs overlay detections
            clean_target_accepted = [d for d in clean_dets if d["accepted_by_filters"]]
            overlay_target_accepted = [d for d in overlay_dets if d["accepted_by_filters"]]

            clean_target_raw = [d for d in clean_dets if d["class_name"] in TARGET_CLASSES]
            overlay_target_raw = [d for d in overlay_dets if d["class_name"] in TARGET_CLASSES]

            target_outcome_changed = (
                [d["class_name"] for d in clean_target_accepted] !=
                [d["class_name"] for d in overlay_target_accepted]
            )

            if target_outcome_changed:
                discrepancies += 1

            comparisons.append({
                "category": cat,
                "filename": fname,
                "face_detected": has_face,
                "face_count": face_cnt,
                "clean_detections_count": len(clean_dets),
                "overlay_detections_count": len(overlay_dets),
                "clean_target_accepted": clean_target_accepted,
                "overlay_target_accepted": overlay_target_accepted,
                "clean_target_raw": clean_target_raw,
                "overlay_target_raw": overlay_target_raw,
                "target_outcome_changed": target_outcome_changed,
            })

    report = {
        "experiment_name": "Phase 0E: MediaPipe Face Mesh Overlay Impact",
        "total_images_evaluated": total_images,
        "images_with_face_detected": images_with_faces,
        "images_with_target_discrepancy": discrepancies,
        "discrepancy_rate": round(discrepancies / total_images, 4) if total_images else 0.0,
        "detailed_comparisons": comparisons,
        "conclusion": (
            "No change in target class filter outcomes" if discrepancies == 0
            else f"{discrepancies} image(s) experienced target detection discrepancy due to overlay"
        ),
        "recommendation": (
            "Accept current pipeline ordering (overlay effect is negligible on existing data)"
            if discrepancies == 0 else
            "Pipeline reordering recommended: perform YOLO inference on a clean copy of the frame before drawing overlays."
        ),
    }

    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"Total test images evaluated : {total_images}")
    print(f"Images with face detected   : {images_with_faces}")
    print(f"Target filter discrepancies : {discrepancies}")
    print(f"Report saved to             : {OUTPUT_JSON}")
    print("=" * 70)
    return report


if __name__ == "__main__":
    evaluate_overlay_impact()
