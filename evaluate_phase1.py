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
PROJECT_ROOT = Path(__file__).resolve().parent
PHASE0_PRETRAINED_PATH = PROJECT_ROOT / "models" / "pretrained" / "yolo11m.pt"
PHASE0_MODEL_PATH = str(PHASE0_PRETRAINED_PATH if PHASE0_PRETRAINED_PATH.exists() else (PROJECT_ROOT / "yolo11m.pt"))

MODELS_TRAINED_GPU_PATH = PROJECT_ROOT / "models" / "trained" / "intelliproctor_phase1_iter1" / "best.pt"
PHASE1_ITER1_GPU_PATH = str(PROJECT_ROOT / "runs" / "detect" / "intelliproctor_phase1_iter1_gpu" / "weights" / "best.pt")
PHASE1_ITER1_PATH = str(PROJECT_ROOT / "runs" / "detect" / "intelliproctor_phase1_iter1" / "weights" / "best.pt")
PHASE1_LEGACY_PATH = str(PROJECT_ROOT / "runs" / "detect" / "intelliproctor_phase1" / "weights" / "best.pt")

if MODELS_TRAINED_GPU_PATH.exists():
    PHASE1_MODEL_PATH = str(MODELS_TRAINED_GPU_PATH)
elif os.path.exists(PHASE1_ITER1_GPU_PATH):
    PHASE1_MODEL_PATH = PHASE1_ITER1_GPU_PATH
elif os.path.exists(PHASE1_ITER1_PATH):
    PHASE1_MODEL_PATH = PHASE1_ITER1_PATH
else:
    PHASE1_MODEL_PATH = PHASE1_LEGACY_PATH

DEFAULT_CONF_THRESHOLD = 0.65
IMG_SIZE = 1280
MIN_SIZE = 12

ALL_CATEGORIES = [
    "phone", "book", "smartwatch", "laptop", "tablet",
    "calculator", "notebook", "pen", "water_bottle", "headphones",
    "hand_no_prohibited_object", "other"
]

# Class definitions per phase
MODEL_CONFIGS = {
    "phase0": {
        "name": "Phase 0 (YOLO11m COCO Pretrained)",
        "weights": PHASE0_MODEL_PATH,
        "target_mapping": {
            cat: ("cell phone" if cat == "phone" else ("book" if cat == "book" else "none"))
            for cat in ALL_CATEGORIES
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
            cat: ("phone" if cat == "phone" else ("book_notebook" if cat == "book" else "none"))
            for cat in ALL_CATEGORIES
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
        "benchmark_negatives_140": [],
        "negatives_raw": [],
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

    # 2. Benchmark 140 negative images across 9 categories in tests/test_data/
    benchmark_neg_cats = [
        "laptop", "tablet", "smartwatch", "calculator", "notebook",
        "headphones", "water_bottle", "pen", "other"
    ]
    for cat in benchmark_neg_cats:
        cat_dir = os.path.join("tests", "test_data", cat)
        if os.path.isdir(cat_dir):
            found_paths = set()
            for ext in ("*.jpg", "*.jpeg", "*.png", "*.webp", "*.bmp"):
                for p in glob.glob(os.path.join(cat_dir, ext)):
                    found_paths.add(os.path.normpath(p))
            for p in sorted(list(found_paths)):
                suites["benchmark_negatives_140"].append((p, cat))

    # 3. Validation images from yolo_dataset/images/val
    val_dir = PROJECT_ROOT / "dataset" / "yolo_dataset" / "images" / "val"
    if val_dir.exists():
        raw_base = PROJECT_ROOT / "dataset" / "raw"
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

    # 4. All Raw Negative images (28 local raw negatives)
    wb_dir = PROJECT_ROOT / "dataset" / "raw" / "water_bottle"
    if wb_dir.exists():
        for p in sorted(wb_dir.glob("*.*")):
            if not p.name.endswith(".txt"):
                suites["negatives_raw"].append((str(p), "water_bottle"))

    hand_dir = PROJECT_ROOT / "dataset" / "raw" / "hand_no_prohibited_object"
    if hand_dir.exists():
        for p in sorted(hand_dir.glob("*.*")):
            if not p.name.endswith(".txt"):
                suites["negatives_raw"].append((str(p), "hand_no_prohibited_object"))

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
        phone_fps = sum(1 for r in records if r["filter_passed"] and ("phone" in r["predicted_class"].lower() or "cell phone" in r["predicted_class"].lower()))
        book_fps = sum(1 for r in records if r["filter_passed"] and ("book" in r["predicted_class"].lower()))
        return {
            "total_images": total,
            "false_positives": filtered_dets,
            "false_positive_rate": rate,
            "phone_fps": phone_fps,
            "book_fps": book_fps,
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

        # 1. Evaluate Phase 0 held-out suite (17 phone, 15 book)
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

        # 2. Evaluate 140 benchmark negatives across 9 categories
        bench_items = suites["benchmark_negatives_140"]
        bench_140_records = []
        bench_by_cat = {}
        for img_path, gt in bench_items:
            rec = evaluate_single_image(
                model=model_obj,
                image_path=img_path,
                ground_truth=gt,
                phase_key=phase_key,
                conf_threshold=conf_threshold,
                phone_aspect_lower=phone_aspect_lower,
            )
            rec["suite"] = "benchmark_negatives_140"
            phase_records.append(rec)
            bench_140_records.append(rec)
            bench_by_cat.setdefault(gt, []).append(rec)

        # 3. Evaluate local raw negatives suite (water bottle, hand)
        neg_raw_items = suites["negatives_raw"]
        wb_records = []
        hand_records = []
        for img_path, gt in neg_raw_items:
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
        cat_metrics = {}
        for cat, recs in bench_by_cat.items():
            cat_metrics[cat] = calculate_group_metrics(recs)

        comparisons[phase_key] = {
            "model_name": MODEL_CONFIGS[phase_key]["name"],
            "weights": MODEL_CONFIGS[phase_key]["weights"],
            "phone_held_out": calculate_group_metrics(p0_phone_records),
            "book_held_out": calculate_group_metrics(p0_book_records),
            "benchmark_140_negatives": calculate_group_metrics(bench_140_records),
            "benchmark_by_category": cat_metrics,
            "water_bottle_raw_negatives": calculate_group_metrics(wb_records),
            "hand_raw_negatives": calculate_group_metrics(hand_records),
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

        print("  BENCHMARK 140 NEGATIVES (Full 9 categories):")
        b140_m = data["benchmark_140_negatives"]
        print(f"    False positives   : {b140_m.get('false_positives')}/{b140_m.get('total_images')} (FPR: {b140_m.get('false_positive_rate')*100:.1f}%)")
        print(f"    Phone FP count    : {b140_m.get('phone_fps')}")
        print(f"    Book FP count     : {b140_m.get('book_fps')}")
        print(f"    Correct rejections: {b140_m.get('correct_rejections')}/{b140_m.get('total_images')}")
        for cname, cm in data.get("benchmark_by_category", {}).items():
            print(f"      - {cname:<14}: {cm.get('false_positives', 0)}/{cm.get('total_images', 0)} FP (FPR: {cm.get('false_positive_rate', 0)*100:.1f}%)")

        print("  WATER BOTTLE RAW NEGATIVES (14 images):")
        wb_m = data["water_bottle_raw_negatives"]
        print(f"    False positives   : {wb_m.get('false_positives')}/{wb_m.get('total_images')} (FPR: {wb_m.get('false_positive_rate')*100:.1f}%)")

        print("  HAND RAW NEGATIVES (14 images):")
        h_m = data["hand_raw_negatives"]
        print(f"    False positives   : {h_m.get('false_positives')}/{h_m.get('total_images')} (FPR: {h_m.get('false_positive_rate')*100:.1f}%)")

    print("\n" + "=" * 80)
    print(f"Saved CSV Report  : {csv_file}")
    print(f"Saved JSON Report : {json_file}")
    print("=" * 80)

    return payload


if __name__ == "__main__":
    run_full_comparative_evaluation()
