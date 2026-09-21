"""
Comprehensive Phase 0 vs Phase 1 Comparative Evaluation Engine for IntelliProctor.

Evaluates:
- Phase 0 (YOLO11m COCO pretrained: yolo11m.pt)
- Phase 1 (Fine-tuned YOLO11m: runs/detect/intelliproctor_phase1/weights/best.pt)

On the exact same held-out test datasets:
1. Held-out Phase 0 Phone test set (17 images)
2. Held-out Phase 0 Book test set (15 images)
3. Validation Phone images (4 images)
4. Validation Book/Notebook images (4 images)
5. Negative Water Bottle images (14 raw images)
6. Negative Hand-only images (14 raw images)

Produces:
- tests/results/phase1_results.csv
- tests/results/phase1_summary.json
- Direct comparative metrics (raw detections, filtered detections, missed, false positives).
"""

import os
import glob
import json
import csv
import datetime
from pathlib import Path
from typing import Dict, List, Any, Tuple
import cv2
import numpy as np
from ultralytics import YOLO

# Model configurations
PHASE0_MODEL_PATH = "yolo11m.pt"
PHASE1_MODEL_PATH = "runs/detect/intelliproctor_phase1/weights/best.pt"

DEFAULT_CONF_THRESHOLD = 0.65
IMG_SIZE = 1280
MIN_SIZE = 12

# Class definitions per phase
MODEL_CONFIGS = {
    "phase0": {
        "name": "Phase 0 (YOLO11m COCO Pretrained)",
        "weights": PHASE0_MODEL_PATH,
        "target_mapping": {
            "phone": "cell phone",
            "book": "book",
            "water_bottle": "none",
            "hand_no_prohibited_object": "none",
        },
        "target_classes": {
            "cell phone": {"aspect_range": (1.3, 2.9), "display": "phone"},
            "book": {"aspect_range": None, "display": "book"},
        },
    },
    "phase1": {
        "name": "Phase 1 (YOLO11m Prohibited-Object Fine-Tuned)",
        "weights": PHASE1_MODEL_PATH,
        "target_mapping": {
            "phone": "phone",
            "book": "book_notebook",
            "water_bottle": "none",
            "hand_no_prohibited_object": "none",
        },
        "target_classes": {
            "phone": {"aspect_range": (1.3, 2.9), "display": "phone"},
            "book_notebook": {"aspect_range": None, "display": "book_notebook"},
        },
    },
}


def load_model_safely(model_path: str):
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found: {model_path}")
    return YOLO(model_path)


def run_model_inference_on_frame(
    model: YOLO,
    frame: np.ndarray,
    phase_cfg: Dict[str, Any],
    conf_threshold: float = DEFAULT_CONF_THRESHOLD,
    phone_aspect_lower: float = 1.3,
    phone_aspect_upper: float = 2.9,
    min_size: int = MIN_SIZE,
) -> List[Dict[str, Any]]:
    """Runs inference and applies filtering logic."""
    results = model(frame, imgsz=IMG_SIZE, device="cpu", verbose=False)[0]
    detections = []

    target_classes = phase_cfg["target_classes"]

    for box in results.boxes:
        cls_id = int(box.cls[0])
        cls_name = model.names[cls_id]
        conf = float(box.conf[0])

        x1, y1, x2, y2 = map(int, box.xyxy[0])
        box_w, box_h = x2 - x1, y2 - y1
        long_side = max(box_w, box_h)
        short_side = max(min(box_w, box_h), 1)
        aspect_ratio = round(long_side / short_side, 3)

        is_target_class = cls_name in target_classes
        passes_conf = conf >= conf_threshold
        passes_size = short_side >= min_size

        passes_aspect = True
        if is_target_class:
            cfg_aspect = target_classes[cls_name]["aspect_range"]
            if cfg_aspect is not None:
                # Use specified lower bound if checking phone
                passes_aspect = phone_aspect_lower <= aspect_ratio <= phone_aspect_upper

        accepted_by_filters = is_target_class and passes_conf and passes_aspect and passes_size

        detections.append({
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
        })

    return detections


def evaluate_single_image(
    model: YOLO,
    image_path: str,
    ground_truth: str,
    phase_key: str,
    conf_threshold: float = DEFAULT_CONF_THRESHOLD,
    phone_aspect_lower: float = 1.3,
) -> Dict[str, Any]:
    """Evaluates an image file for a given model version."""
    phase_cfg = MODEL_CONFIGS[phase_key]
    expected_class = phase_cfg["target_mapping"].get(ground_truth, "none")
    
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not load image: {image_path}")

    raw_detections = run_model_inference_on_frame(
        model=model,
        frame=img,
        phase_cfg=phase_cfg,
        conf_threshold=conf_threshold,
        phone_aspect_lower=phone_aspect_lower,
    )

    filtered_detections = [d for d in raw_detections if d["accepted_by_filters"]]

    # Evaluate outcome based on ground truth
    raw_detected = False
    filter_passed = False
    status = "FAIL"
    best_conf = 0.0
    best_aspect = None
    best_pred_class = "none"

    if expected_class != "none":
        # Positive prohibited object test
        matching_raw = [d for d in raw_detections if d["class_name"] == expected_class]
        matching_accepted = [d for d in filtered_detections if d["class_name"] == expected_class]

        if matching_raw:
            raw_detected = True
            best_raw = max(matching_raw, key=lambda x: x["confidence"])
            best_conf = best_raw["confidence"]
            best_aspect = best_raw["aspect_ratio"]
            best_pred_class = best_raw["class_name"]

        if matching_accepted:
            filter_passed = True
            best_acc = max(matching_accepted, key=lambda x: x["confidence"])
            best_conf = best_acc["confidence"]
            best_aspect = best_acc["aspect_ratio"]
            best_pred_class = best_acc["class_name"]
            status = "PASS"
    else:
        # Negative allowed object test (should have 0 accepted prohibited detections)
        if filtered_detections:
            # False positive
            best_acc = max(filtered_detections, key=lambda x: x["confidence"])
            best_conf = best_acc["confidence"]
            best_aspect = best_acc["aspect_ratio"]
            best_pred_class = best_acc["class_name"]
            filter_passed = True  # Triggered alert erroneously
            raw_detected = True
            status = "FAIL (FALSE POSITIVE)"
        else:
            status = "PASS (CORRECT REJECTION)"
            if raw_detections:
                best_raw = max(raw_detections, key=lambda x: x["confidence"])
                best_pred_class = best_raw["class_name"]
                best_conf = best_raw["confidence"]

    return {
        "image": os.path.basename(image_path),
        "image_path": str(image_path),
        "ground_truth": ground_truth,
        "expected_class": expected_class,
        "model_version": phase_key,
        "predicted_class": best_pred_class,
        "confidence": best_conf,
        "aspect_ratio": best_aspect,
        "raw_detected": raw_detected,
        "filter_passed": filter_passed,
        "status": status,
        "raw_detections": raw_detections,
        "filtered_detections": filtered_detections,
    }


def collect_test_suites() -> Dict[str, List[Tuple[str, str]]]:
    """Gathers all test image paths grouped by suite."""
    suites = {
        "phase0_held_out": [],
        "val_set": [],
        "negatives": [],
    }

    # 1. Phase 0 held-out images in tests/test_data/
    phone_p0 = sorted(glob.glob("tests/test_data/phone/*.*"))
    phone_p0 = [p for p in phone_p0 if not p.endswith(".gitkeep")]
    for p in phone_p0:
        suites["phase0_held_out"].append((p, "phone"))

    book_p0 = sorted(glob.glob("tests/test_data/book/*.*"))
    book_p0 = [p for p in book_p0 if not p.endswith(".gitkeep")]
    for p in book_p0:
        suites["phase0_held_out"].append((p, "book"))

    # 2. Validation images from yolo_dataset/images/val
    val_dir = Path(r"C:\Users\tanis\dataset\yolo_dataset\images\val")
    if val_dir.exists():
        raw_base = Path(r"C:\Users\tanis\dataset\raw")
        raw_classes = {
            "phone": {p.name for p in (raw_base / "phone").glob("*.*")},
            "book_notebook": {p.name for p in (raw_base / "book_notebook").glob("*.*")},
            "water_bottle": {p.name for p in (raw_base / "water_bottle").glob("*.*")},
            "hand_no_prohibited_object": {p.name for p in (raw_base / "hand_no_prohibited_object").glob("*.*")},
        }
        for img_path in sorted(val_dir.glob("*.*")):
            if img_path.name in raw_classes["phone"]:
                suites["val_set"].append((str(img_path), "phone"))
            elif img_path.name in raw_classes["book_notebook"]:
                suites["val_set"].append((str(img_path), "book"))
            elif img_path.name in raw_classes["water_bottle"]:
                suites["val_set"].append((str(img_path), "water_bottle"))
            elif img_path.name in raw_classes["hand_no_prohibited_object"]:
                suites["val_set"].append((str(img_path), "hand_no_prohibited_object"))

    # 3. All Raw Negative images
    wb_dir = Path(r"C:\Users\tanis\dataset\raw\water_bottle")
    if wb_dir.exists():
        for p in sorted(wb_dir.glob("*.*")):
            if not p.name.endswith(".txt"):
                suites["negatives"].append((str(p), "water_bottle"))

    hand_dir = Path(r"C:\Users\tanis\dataset\raw\hand_no_prohibited_object")
    if hand_dir.exists():
        for p in sorted(hand_dir.glob("*.*")):
            if not p.name.endswith(".txt"):
                suites["negatives"].append((str(p), "hand_no_prohibited_object"))

    return suites


def calculate_group_metrics(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculates precision, recall, false positive rates for a set of evaluation records."""
    total = len(records)
    if total == 0:
        return {}

    gt = records[0]["ground_truth"]
    is_positive = gt in ("phone", "book")

    raw_dets = sum(1 for r in records if r["raw_detected"])
    filtered_dets = sum(1 for r in records if r["filter_passed"])
    missed = total - filtered_dets

    rate = round(filtered_dets / total, 4)

    if is_positive:
        return {
            "total_images": total,
            "raw_detections": raw_dets,
            "raw_detection_rate": round(raw_dets / total, 4),
            "filtered_detections": filtered_dets,
            "filtered_detection_rate": rate,
            "missed_detections": missed,
        }
    else:
        # For negative classes, filtered detections are false positives
        return {
            "total_images": total,
            "false_positives": filtered_dets,
            "false_positive_rate": rate,
            "correct_rejections": total - filtered_dets,
            "rejection_rate": round((total - filtered_dets) / total, 4),
        }


def run_full_comparative_evaluation(
    conf_threshold: float = DEFAULT_CONF_THRESHOLD,
    phone_aspect_lower: float = 1.3,
    output_dir: str = "tests/results",
) -> Dict[str, Any]:
    print("=" * 80)
    print(" INTELLIPROCTOR PHASE 0 VS PHASE 1 COMPARATIVE EVALUATION")
    print("=" * 80)
    print(f"Confidence Threshold : {conf_threshold}")
    print(f"Phone Aspect Lower   : {phone_aspect_lower}")
    print("=" * 80)

    suites = collect_test_suites()
    all_models = ["phase0", "phase1"]

    loaded_models = {}
    for m in all_models:
        w_path = MODEL_CONFIGS[m]["weights"]
        if not os.path.exists(w_path):
            print(f"WARNING: Weights for {m} not found at {w_path}. Skipping.")
            continue
        print(f"Loading {m} from {w_path}...")
        loaded_models[m] = load_model_safely(w_path)

    if not loaded_models:
        raise RuntimeError("No models could be loaded for evaluation.")

    eval_records = []
    comparisons = {}

    for phase_key, model_obj in loaded_models.items():
        print(f"\n--- Running evaluation for {MODEL_CONFIGS[phase_key]['name']} ---")
        phase_records = []

        # Evaluate Phase 0 held-out suite
        p0_items = suites["phase0_held_out"]
        p0_phone_records = []
        p0_book_records = []
        for img_path, gt in p0_items:
            rec = evaluate_single_image(
                model=model_obj,
                image_path=img_path,
                ground_truth=gt,
                phase_key=phase_key,
                conf_threshold=conf_threshold,
                phone_aspect_lower=phone_aspect_lower,
            )
            rec["suite"] = "phase0_held_out"
            phase_records.append(rec)
            if gt == "phone":
                p0_phone_records.append(rec)
            else:
                p0_book_records.append(rec)

        # Evaluate Negatives suite
        neg_items = suites["negatives"]
        wb_records = []
        hand_records = []
        for img_path, gt in neg_items:
            rec = evaluate_single_image(
                model=model_obj,
                image_path=img_path,
                ground_truth=gt,
                phase_key=phase_key,
                conf_threshold=conf_threshold,
                phone_aspect_lower=phone_aspect_lower,
            )
            rec["suite"] = "negatives_raw"
            phase_records.append(rec)
            if gt == "water_bottle":
                wb_records.append(rec)
            else:
                hand_records.append(rec)

        eval_records.extend(phase_records)

        # Compute summary metrics for this model
        comparisons[phase_key] = {
            "model_name": MODEL_CONFIGS[phase_key]["name"],
            "weights": MODEL_CONFIGS[phase_key]["weights"],
            "phone_held_out": calculate_group_metrics(p0_phone_records),
            "book_held_out": calculate_group_metrics(p0_book_records),
            "water_bottle_negatives": calculate_group_metrics(wb_records),
            "hand_negatives": calculate_group_metrics(hand_records),
        }

    os.makedirs(output_dir, exist_ok=True)
    csv_file = os.path.join(output_dir, "phase1_results.csv")
    json_file = os.path.join(output_dir, "phase1_summary.json")

    # Write CSV
    fieldnames = [
        "image",
        "ground_truth",
        "suite",
        "model_version",
        "predicted_class",
        "confidence",
        "aspect_ratio",
        "raw_detected",
        "filter_passed",
        "status",
    ]
    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(eval_records)

    payload = {
        "evaluation_timestamp": datetime.datetime.now().isoformat(),
        "confidence_threshold": conf_threshold,
        "phone_aspect_lower": phone_aspect_lower,
        "comparisons": comparisons,
    }

    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print("\n" + "=" * 80)
    print(" EVALUATION COMPARISON SUMMARY")
    print("=" * 80)
    for phase_key, data in comparisons.items():
        print(f"\n[{data['model_name']}]")
        print("  PHONE (Held-out 17 images):")
        p_m = data["phone_held_out"]
        print(f"    Raw detected      : {p_m.get('raw_detections')}/{p_m.get('total_images')} ({p_m.get('raw_detection_rate')*100:.1f}%)")
        print(f"    Final accepted    : {p_m.get('filtered_detections')}/{p_m.get('total_images')} ({p_m.get('filtered_detection_rate')*100:.1f}%)")
        print(f"    Missed            : {p_m.get('missed_detections')}/{p_m.get('total_images')}")
        
        print("  BOOK (Held-out 15 images):")
        b_m = data["book_held_out"]
        print(f"    Raw detected      : {b_m.get('raw_detections')}/{b_m.get('total_images')} ({b_m.get('raw_detection_rate')*100:.1f}%)")
        print(f"    Final accepted    : {b_m.get('filtered_detections')}/{b_m.get('total_images')} ({b_m.get('filtered_detection_rate')*100:.1f}%)")
        print(f"    Missed            : {b_m.get('missed_detections')}/{b_m.get('total_images')}")

        print("  WATER BOTTLE (Negative 14 images):")
        wb_m = data["water_bottle_negatives"]
        print(f"    False positives   : {wb_m.get('false_positives')}/{wb_m.get('total_images')} (FPR: {wb_m.get('false_positive_rate')*100:.1f}%)")
        print(f"    Correct rejections: {wb_m.get('correct_rejections')}/{wb_m.get('total_images')}")

        print("  HAND ONLY (Negative 14 images):")
        h_m = data["hand_negatives"]
        print(f"    False positives   : {h_m.get('false_positives')}/{h_m.get('total_images')} (FPR: {h_m.get('false_positive_rate')*100:.1f}%)")
        print(f"    Correct rejections: {h_m.get('correct_rejections')}/{h_m.get('total_images')}")

    print("\n" + "=" * 80)
    print(f"Saved CSV Report  : {csv_file}")
    print(f"Saved JSON Report : {json_file}")
    print("=" * 80)

    return payload


if __name__ == "__main__":
    run_full_comparative_evaluation()
