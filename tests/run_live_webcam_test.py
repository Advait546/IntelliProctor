"""
Interactive Live Webcam Testing Tool for Object Detection Pipeline.

Allows local users to place physical objects in front of their webcam and record
real-time detection performance using the exact YOLO parameters and filters from
video_input_analysis.py.

Usage:
    python tests/run_live_webcam_test.py
OR:
    pytest tests/test_object_detection.py --live-webcam
"""

import sys
import os
import cv2
import time
import datetime
from typing import List, Dict, Any

# Ensure workspace root is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tests.detector_evaluator import (
    ObjectDetectionEvaluator,
    ResultsStorageManager,
    CATEGORY_EXPECTED_TARGET,
    TARGET_CLASSES,
    CONF_THRESHOLD,
)

LIVE_TEST_CATEGORIES = [
    "phone",
    "smartwatch",
    "book",
    "notebook",
    "tablet",
    "laptop",
    "calculator",
    "headphones",
    "pen",
    "water_bottle",
    "other",
]


def run_interactive_webcam_test() -> List[Dict[str, Any]]:
    print("=" * 65)
    print("      INTELLIPROCTOR LIVE WEBCAM OBJECT DETECTION TEST")
    print("=" * 65)
    print("Controls:")
    print("  [SPACE] / [S] : Record current detection snapshot")
    print("  [P]           : Mark current object test as PASS")
    print("  [F]           : Mark current object test as FAIL")
    print("  [U]           : Mark current object test as UNCERTAIN")
    print("  [N] / [ENTER] : Advance to NEXT object category")
    print("  [Q]           : Quit test session and save results")
    print("=" * 65)

    evaluator = ObjectDetectionEvaluator("yolo11m.pt")
    storage = ResultsStorageManager("tests/results")

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("ERROR: Could not open webcam (index 0). Please check camera hardware & permissions.")
        return []

    recorded_results = []
    category_idx = 0
    num_categories = len(LIVE_TEST_CATEGORIES)

    feedback_msg = ""
    feedback_time = 0

    while category_idx < num_categories:
        current_cat = LIVE_TEST_CATEGORIES[category_idx]
        expected_cls = CATEGORY_EXPECTED_TARGET.get(current_cat, "none")

        ret, frame = cap.read()
        if not ret:
            print("Failed to capture frame from webcam.")
            break

        # Run detection evaluation on current frame
        eval_result = evaluator.evaluate_frame(frame, category=current_cat, source_name="live_webcam")
        raw_dets = eval_result["raw_detections"]

        # Draw UI overlay on webcam frame
        h_img, w_img = frame.shape[:2]

        # Draw bounding boxes & annotations
        for det in raw_dets:
            x1, y1, x2, y2 = det["bbox"]
            cls_name = det["class_name"]
            conf = det["confidence"]
            ar = det["aspect_ratio"]
            accepted = det["accepted_by_filters"]

            if accepted:
                color = TARGET_CLASSES.get(cls_name, {}).get("color", (0, 255, 0))
                label = f"ACCEPTED: {cls_name} {conf:.2f} (AR:{ar})"
                thick = 3
            else:
                color = (128, 128, 128) if not det["is_target_class"] else (0, 0, 180)
                label = f"REJECTED: {cls_name} {conf:.2f} (AR:{ar})"
                thick = 1

            cv2.rectangle(frame, (x1, y1), (x2, y2), color, thick)
            cv2.putText(frame, label, (x1, max(y1 - 10, 20)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)

        # Top Header Overlay
        header_text = f"[{category_idx + 1}/{num_categories}] Testing: {current_cat.upper()} | Expected Target: {expected_cls}"
        cv2.rectangle(frame, (0, 0), (w_img, 45), (40, 40, 40), -1)
        cv2.putText(frame, header_text, (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 255), 2)

        # Bottom Instructions Overlay
        cv2.rectangle(frame, (0, h_img - 60), (w_img, h_img), (20, 20, 20), -1)
        inst_1 = "[SPACE/S]: Record Snapshot | [P]: PASS | [F]: FAIL | [U]: UNCERTAIN"
        inst_2 = "[N/ENTER]: Next Object | [Q]: Finish & Save"
        cv2.putText(frame, inst_1, (10, h_img - 35),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        cv2.putText(frame, inst_2, (10, h_img - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

        # Feedback notification overlay if key was recently pressed
        if time.time() - feedback_time < 2.0:
            cv2.putText(frame, feedback_msg, (10, 80),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        cv2.imshow("IntelliProctor - Live Object Detection Test", frame)

        key = cv2.waitKey(30) & 0xFF

        manual_mark = None
        record_now = False
        advance_next = False

        if key in (ord(' '), ord('s'), ord('S')):
            record_now = True
            manual_mark = "UNSPECIFIED"
        elif key in (ord('p'), ord('P')):
            record_now = True
            manual_mark = "PASS"
        elif key in (ord('f'), ord('F')):
            record_now = True
            manual_mark = "FAIL"
        elif key in (ord('u'), ord('U')):
            record_now = True
            manual_mark = "UNCERTAIN"
        elif key in (ord('n'), ord('N'), 13):  # 13 is ENTER
            advance_next = True
        elif key in (ord('q'), ord('Q')):
            print("Quitting live webcam test session...")
            break

        if record_now:
            eval_result["manual_mark"] = manual_mark
            recorded_results.append(eval_result)
            feedback_msg = f"RECORDED! Object '{current_cat}' snapshot saved (Mark: {manual_mark})"
            feedback_time = time.time()
            print(f"[{len(recorded_results)}] Recorded snapshot for '{current_cat}': "
                  f"Predicted='{eval_result['yolo_predicted_class']}', Manual Mark='{manual_mark}', "
                  f"Status='{eval_result['status']}'")

        if advance_next:
            category_idx += 1
            if category_idx < num_categories:
                feedback_msg = f"Advanced to object: {LIVE_TEST_CATEGORIES[category_idx].upper()}"
                feedback_time = time.time()

    cap.release()
    cv2.destroyAllWindows()

    if recorded_results:
        saved_paths = storage.save_results(recorded_results, session_prefix="live_webcam_results")
        print("\n" + "=" * 65)
        print(" LIVE WEBCAM RESULTS SAVED SUCCESSFULLY")
        print(f" Total Snapshots Recorded: {len(recorded_results)}")
        print(f" CSV Path  : {saved_paths['csv_path']}")
        print(f" JSON Path : {saved_paths['json_path']}")
        print("=" * 65)
    else:
        print("\nNo live snapshots were recorded during session.")

    return recorded_results


if __name__ == "__main__":
    run_interactive_webcam_test()
