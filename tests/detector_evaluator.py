"""
Evaluation engine for object detection in video_input_analysis.py.

IMPORTANT: This module re-uses the EXACT YOLO model, confidence thresholds,
class targets, aspect-ratio filters, and bounding-box size filters defined in
video_input_analysis.py WITHOUT modifying the original script.
"""

import os
import csv
import json
import time
import datetime
from typing import Dict, List, Any, Optional
import cv2
import numpy as np
from ultralytics import YOLO

# --- Exact constants from video_input_analysis.py ---
MODEL_PATH = "yolo11m.pt"
CONF_THRESHOLD = 0.65
IMG_SIZE = 1280

TARGET_CLASSES = {
    "cell phone": {"aspect_range": (1.3, 2.9), "color": (0, 0, 255)},
    "book":       {"aspect_range": None,        "color": (0, 165, 255)},
}

CATEGORY_EXPECTED_TARGET = {
    "phone": "cell phone",
    "book": "book",
    "smartwatch": "none",
    "laptop": "none",
    "tablet": "none",
    "calculator": "none",
    "notebook": "none",
    "pen": "none",
    "water_bottle": "none",
    "headphones": "none",
    "other": "none",
}


class ObjectDetectionEvaluator:
    def __init__(self, model_path: str = MODEL_PATH):
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"YOLO model file not found: {model_path}")
        self.model = YOLO(model_path)

    def evaluate_frame(self, frame: np.ndarray, category: str, source_name: str = "image") -> Dict[str, Any]:
        """
        Runs YOLO inference on a single image frame using the EXACT filtering rules
        from video_input_analysis.py.
        """
        expected_class = CATEGORY_EXPECTED_TARGET.get(category.lower(), "none")
        
        # Run YOLO inference matching video_input_analysis.py settings
        results = self.model(frame, imgsz=IMG_SIZE, device="cpu", verbose=False)[0]

        raw_detections = []
        filtered_target_detections = []

        for box in results.boxes:
            cls_id = int(box.cls[0])
            cls_name = self.model.names[cls_id]
            conf = float(box.conf[0])

            x1, y1, x2, y2 = map(int, box.xyxy[0])
            box_w, box_h = x2 - x1, y2 - y1
            long_side = max(box_w, box_h)
            short_side = max(min(box_w, box_h), 1)
            aspect_ratio = round(long_side / short_side, 3)

            is_target_class = cls_name in TARGET_CLASSES
            passes_conf = conf >= CONF_THRESHOLD

            aspect_range = TARGET_CLASSES[cls_name]["aspect_range"] if is_target_class else None
            passes_aspect = True
            if aspect_range is not None:
                passes_aspect = aspect_range[0] <= aspect_ratio <= aspect_range[1]

            passes_size = short_side >= 12

            accepted_by_filters = is_target_class and passes_conf and passes_aspect and passes_size

            det_info = {
                "class_name": cls_name,
                "confidence": round(conf, 4),
                "bbox": [x1, y1, x2, y2],
                "box_width": box_w,
                "box_height": box_h,
                "aspect_ratio": aspect_ratio,
                "is_target_class": is_target_class,
                "passes_conf": passes_conf,
                "passes_aspect": passes_aspect,
                "passes_size": passes_size,
                "accepted_by_filters": accepted_by_filters,
            }

            raw_detections.append(det_info)
            if accepted_by_filters:
                filtered_target_detections.append(det_info)

        # Determine pass / fail status based on expected class & category
        status = "FAIL"
        reason = ""

        if expected_class != "none":
            # For target classes (e.g. phone -> 'cell phone', book -> 'book')
            matching_accepted = [d for d in filtered_target_detections if d["class_name"] == expected_class]
            if matching_accepted:
                best_match = max(matching_accepted, key=lambda x: x["confidence"])
                status = "PASS"
                reason = (f"Detected expected target class '{expected_class}' (conf={best_match['confidence']:.2f}, "
                          f"aspect_ratio={best_match['aspect_ratio']}) passing all filters.")
            else:
                matching_raw = [d for d in raw_detections if d["class_name"] == expected_class]
                if matching_raw:
                    best_raw = max(matching_raw, key=lambda x: x["confidence"])
                    reason = (f"Predicted '{expected_class}' (conf={best_raw['confidence']:.2f}, "
                              f"aspect_ratio={best_raw['aspect_ratio']}) but rejected by filters "
                              f"(passes_conf={best_raw['passes_conf']}, passes_aspect={best_raw['passes_aspect']}, passes_size={best_raw['passes_size']}).")
                else:
                    status = "FAIL"
                    raw_summary = ", ".join([f"{d['class_name']} ({d['confidence']:.2f})" for d in raw_detections]) or "None"
                    reason = f"Target class '{expected_class}' not predicted by YOLO. Raw predictions: [{raw_summary}]"
        else:
            # For non-target objects (smartwatch, laptop, etc.), check for false positive target detections
            if filtered_target_detections:
                status = "FAIL"
                fp_classes = ", ".join([f"{d['class_name']} ({d['confidence']:.2f})" for d in filtered_target_detections])
                reason = f"False positive alert: target class(es) [{fp_classes}] accepted by filters for non-target object '{category}'."
            else:
                status = "PASS"
                raw_summary = ", ".join([f"{d['class_name']} ({d['confidence']:.2f})" for d in raw_detections]) or "None"
                reason = f"No target class false positives accepted by filters. Raw predictions: [{raw_summary}]"

        # Summarize predicted class string
        if raw_detections:
            predicted_class_str = ", ".join(set([d["class_name"] for d in raw_detections]))
            conf_str = ", ".join([f"{d['confidence']:.2f}" for d in raw_detections])
            bbox_str = "; ".join([str(d["bbox"]) for d in raw_detections])
            aspect_str = ", ".join([str(d["aspect_ratio"]) for d in raw_detections])
        else:
            predicted_class_str = "none"
            conf_str = "N/A"
            bbox_str = "N/A"
            aspect_str = "N/A"

        accepted_flag = len(filtered_target_detections) > 0

        return {
            "timestamp": datetime.datetime.now().isoformat(),
            "object_tested": category,
            "source": source_name,
            "expected_class": expected_class,
            "yolo_predicted_class": predicted_class_str,
            "confidence": conf_str,
            "bounding_box": bbox_str,
            "aspect_ratio": aspect_str,
            "accepted_by_filters": accepted_flag,
            "status": status,
            "reason": reason,
            "manual_mark": "N/A",
            "raw_detections": raw_detections,
            "filtered_target_detections": filtered_target_detections,
        }

    def evaluate_image_file(self, image_path: str, category: str) -> Dict[str, Any]:
        """Evaluates an image file on disk."""
        if not os.path.exists(image_path):
            return {
                "timestamp": datetime.datetime.now().isoformat(),
                "object_tested": category,
                "source": image_path,
                "expected_class": CATEGORY_EXPECTED_TARGET.get(category.lower(), "none"),
                "yolo_predicted_class": "N/A",
                "confidence": "N/A",
                "bounding_box": "N/A",
                "aspect_ratio": "N/A",
                "accepted_by_filters": False,
                "status": "SKIPPED",
                "reason": f"Image file not found: {image_path}",
                "manual_mark": "N/A",
                "raw_detections": [],
                "filtered_target_detections": [],
            }

        img = cv2.imread(image_path)
        if img is None:
            return {
                "timestamp": datetime.datetime.now().isoformat(),
                "object_tested": category,
                "source": image_path,
                "expected_class": CATEGORY_EXPECTED_TARGET.get(category.lower(), "none"),
                "yolo_predicted_class": "N/A",
                "confidence": "N/A",
                "bounding_box": "N/A",
                "aspect_ratio": "N/A",
                "accepted_by_filters": False,
                "status": "SKIPPED",
                "reason": f"Could not decode image file: {image_path}",
                "manual_mark": "N/A",
                "raw_detections": [],
                "filtered_target_detections": [],
            }

        return self.evaluate_frame(img, category=category, source_name=os.path.basename(image_path))


class ResultsStorageManager:
    def __init__(self, results_dir: str = "tests/results"):
        self.results_dir = results_dir
        os.makedirs(self.results_dir, exist_ok=True)

    def save_results(self, records: List[Dict[str, Any]], session_prefix: str = "detection_results") -> Dict[str, str]:
        """
        Saves a list of test records to both CSV and JSON in tests/results/
        and updates latest_results.json and latest_results.csv.
        """
        timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        csv_filename = f"{session_prefix}_{timestamp_str}.csv"
        json_filename = f"{session_prefix}_{timestamp_str}.json"

        csv_path = os.path.join(self.results_dir, csv_filename)
        json_path = os.path.join(self.results_dir, json_filename)
        latest_csv_path = os.path.join(self.results_dir, f"latest_{session_prefix}.csv")
        latest_json_path = os.path.join(self.results_dir, f"latest_{session_prefix}.json")

        fieldnames = [
            "timestamp",
            "object_tested",
            "source",
            "expected_class",
            "yolo_predicted_class",
            "confidence",
            "bounding_box",
            "aspect_ratio",
            "accepted_by_filters",
            "status",
            "reason",
            "manual_mark",
        ]

        # Sanitized records for flat CSV/JSON exports
        clean_records = []
        for r in records:
            clean_records.append({
                "timestamp": r.get("timestamp", ""),
                "object_tested": r.get("object_tested", ""),
                "source": r.get("source", ""),
                "expected_class": r.get("expected_class", ""),
                "yolo_predicted_class": r.get("yolo_predicted_class", ""),
                "confidence": r.get("confidence", ""),
                "bounding_box": r.get("bounding_box", ""),
                "aspect_ratio": r.get("aspect_ratio", ""),
                "accepted_by_filters": r.get("accepted_by_filters", False),
                "status": r.get("status", ""),
                "reason": r.get("reason", ""),
                "manual_mark": r.get("manual_mark", "N/A"),
            })

        # Write CSV files
        for target_path in [csv_path, latest_csv_path]:
            with open(target_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(clean_records)

        # Build detailed JSON payload with summary metrics
        summary = {
            "total_tested": len(records),
            "passed": sum(1 for r in records if r.get("status") == "PASS"),
            "failed": sum(1 for r in records if r.get("status") == "FAIL"),
            "skipped": sum(1 for r in records if r.get("status") == "SKIPPED"),
        }

        json_payload = {
            "summary": summary,
            "results": records,
        }

        # Write JSON files
        for target_path in [json_path, latest_json_path]:
            with open(target_path, "w", encoding="utf-8") as f:
                json.dump(json_payload, f, indent=2)

        return {
            "csv_path": csv_path,
            "json_path": json_path,
            "latest_csv_path": latest_csv_path,
            "latest_json_path": latest_json_path,
        }
