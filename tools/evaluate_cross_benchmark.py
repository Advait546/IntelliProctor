"""
IntelliProctor — Cross-Benchmark Evaluation Engine

Performs a controlled, rigorous cross-benchmark evaluation of:
- Phase 0 Model: Baseline COCO Pretrained YOLO11m (yolo11m.pt)
- Phase 1 Model: Fine-tuned YOLO11m Iteration 1 (runs/detect/intelliproctor_phase1_iter1_gpu/weights/best.pt)
- Phase 2 Model: Fine-tuned YOLO11m Iteration 2 (runs/detect/intelliproctor_phase1_iter2_augmented_gpu/weights/best.pt)

Across:
- Benchmark A: Phase 0 Benchmark (tests/test_data/ - 172 images: 17 phone, 15 book, 140 negative across 9 categories)
- Benchmark B1: Phase 1 Validation Benchmark (dataset/yolo_dataset/images/val - 14 images with bbox ground truth)
- Benchmark B2: Phase 1 Raw Benchmark (dataset/raw/ - 70 images with bbox ground truth)
- Benchmark C (Supplementary): Phase 2 Held-out Test Benchmark (Dataset_it2/images/test - 75 images with bbox ground truth)

Saves all outputs directly in:
runs/benchmark_eval/phase2_cross_benchmark/
"""

import os
import sys
import glob
import json
import csv
import datetime
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional
import cv2
import numpy as np
import torch
from ultralytics import YOLO

# Project directories
PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "runs" / "benchmark_eval" / "phase2_cross_benchmark"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Model paths
PHASE0_WEIGHTS = (
    PROJECT_ROOT / "models" / "pretrained" / "yolo11m.pt"
    if (PROJECT_ROOT / "models" / "pretrained" / "yolo11m.pt").exists()
    else PROJECT_ROOT / "yolo11m.pt"
)
PHASE1_WEIGHTS = (
    PROJECT_ROOT / "models" / "trained" / "intelliproctor_phase1_iter1" / "best.pt"
    if (PROJECT_ROOT / "models" / "trained" / "intelliproctor_phase1_iter1" / "best.pt").exists()
    else PROJECT_ROOT / "runs" / "detect" / "intelliproctor_phase1_iter1_gpu" / "weights" / "best.pt"
)
PHASE2_WEIGHTS = PROJECT_ROOT / "runs" / "detect" / "intelliproctor_phase1_iter2_augmented_gpu" / "weights" / "best.pt"

# Standard detection pipeline settings
IMG_SIZE = 1280
PROD_CONF_THRESH = 0.65
RELAXED_CONF_THRESH = 0.50
MIN_SIZE = 12

# Production vs Relaxed Aspect-Ratio Settings
# Production: phone [1.3, 2.9], book None
# Relaxed: phone [1.15, 2.9], book [0.80, 2.50]
PROD_FILTERS = {
    "phone": {"conf": PROD_CONF_THRESH, "aspect": (1.3, 2.9), "min_size": MIN_SIZE},
    "book": {"conf": PROD_CONF_THRESH, "aspect": None, "min_size": MIN_SIZE},
}
RELAXED_FILTERS = {
    "phone": {"conf": RELAXED_CONF_THRESH, "aspect": (1.15, 2.9), "min_size": MIN_SIZE},
    "book": {"conf": RELAXED_CONF_THRESH, "aspect": (0.80, 2.50), "min_size": MIN_SIZE},
}

MODEL_CONFIGS = {
    "phase0": {
        "name": "Phase 0 Baseline (YOLO11m COCO)",
        "weights": str(PHASE0_WEIGHTS),
        "target_mapping": {
            "phone": "cell phone",
            "book": "book",
            "notebook": "none",
            "smartwatch": "none",
            "laptop": "none",
            "tablet": "none",
            "calculator": "none",
            "pen": "none",
            "water_bottle": "none",
            "headphones": "none",
            "hand_no_prohibited_object": "none",
            "other": "none",
        },
        "classes": ["cell phone", "book"],
    },
    "phase1": {
        "name": "Phase 1 Fine-Tuned (Iter 1)",
        "weights": str(PHASE1_WEIGHTS),
        "target_mapping": {
            "phone": "phone",
            "book": "book_notebook",
            "notebook": "book_notebook",
            "smartwatch": "none",
            "laptop": "none",
            "tablet": "none",
            "calculator": "none",
            "pen": "none",
            "water_bottle": "none",
            "headphones": "none",
            "hand_no_prohibited_object": "none",
            "other": "none",
        },
        "classes": ["phone", "book_notebook"],
    },
    "phase2": {
        "name": "Phase 2 Fine-Tuned (Iter 2 Augmented)",
        "weights": str(PHASE2_WEIGHTS),
        "target_mapping": {
            "phone": "phone",
            "book": "book_notebook",
            "notebook": "book_notebook",
            "smartwatch": "none",
            "laptop": "none",
            "tablet": "none",
            "calculator": "none",
            "pen": "none",
            "water_bottle": "none",
            "headphones": "none",
            "hand_no_prohibited_object": "none",
            "other": "none",
        },
        "classes": ["phone", "book_notebook"],
    },
}

# The 3 baseline passing phone images for regression tracking
BASELINE_PASSING_IMAGES = [
    "WhatsApp Image 2026-08-31 at 14.34.58 (2).jpeg",
    "WhatsApp Image 2026-08-31 at 14.34.58.jpeg",
    "WhatsApp Image 2026-08-31 at 14.34.59 (3).jpeg",
]


def load_model(weights_path: str) -> YOLO:
    if not os.path.exists(weights_path):
        raise FileNotFoundError(f"Weights file not found: {weights_path}")
    return YOLO(weights_path)


def run_inference_on_image(
    model: YOLO,
    img_bgr: np.ndarray,
    device: Any,
    imgsz: int = IMG_SIZE,
) -> List[Dict[str, Any]]:
    """Runs inference and extracts structured raw detection boxes."""
    results = model(img_bgr, imgsz=imgsz, device=device, verbose=False)[0]
    detections = []
    
    for box in results.boxes:
        cls_id = int(box.cls[0])
        cls_name = model.names[cls_id]
        conf = float(box.conf[0])
        
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        w = max(x2 - x1, 1)
        h = max(y2 - y1, 1)
        long_side = max(w, h)
        short_side = max(min(w, h), 1)
        aspect_ratio = round(long_side / short_side, 3)
        
        detections.append({
            "class_id": cls_id,
            "class_name": cls_name,
            "confidence": round(conf, 4),
            "bbox_xyxy": [x1, y1, x2, y2],
            "width": w,
            "height": h,
            "short_side": short_side,
            "long_side": long_side,
            "aspect_ratio": aspect_ratio,
        })
    return detections


def apply_filter_pipeline(
    raw_detections: List[Dict[str, Any]],
    model_version: str,
    filter_type: str = "production",
) -> List[Dict[str, Any]]:
    """Applies either production filters or relaxed filters to raw detections."""
    accepted = []
    filter_cfg = PROD_FILTERS if filter_type == "production" else RELAXED_FILTERS
    
    for det in raw_detections:
        cls_name = det["class_name"]
        canonical_class = "none"
        if cls_name in ("phone", "cell phone"):
            canonical_class = "phone"
        elif cls_name in ("book", "book_notebook"):
            canonical_class = "book"
        
        if canonical_class == "none":
            continue
            
        rule = filter_cfg[canonical_class]
        passes_conf = det["confidence"] >= rule["conf"]
        passes_size = det["short_side"] >= rule["min_size"]
        
        passes_aspect = True
        if rule["aspect"] is not None:
            passes_aspect = rule["aspect"][0] <= det["aspect_ratio"] <= rule["aspect"][1]
            
        if passes_conf and passes_size and passes_aspect:
            det_copy = dict(det)
            det_copy["canonical_class"] = canonical_class
            det_copy["filter_type"] = filter_type
            accepted.append(det_copy)
            
    return accepted


def evaluate_image_level(
    raw_detections: List[Dict[str, Any]],
    ground_truth_category: str,
    model_version: str,
) -> Dict[str, Any]:
    """Computes image-level evaluation outcomes for production and relaxed filters."""
    mapping = MODEL_CONFIGS[model_version]["target_mapping"]
    expected_class = mapping.get(ground_truth_category, "none")
    is_positive = expected_class != "none"
    
    prod_accepted = apply_filter_pipeline(raw_detections, model_version, filter_type="production")
    relaxed_accepted = apply_filter_pipeline(raw_detections, model_version, filter_type="relaxed")
    
    # Matching raw detections
    matching_raw = [d for d in raw_detections if d["class_name"] == expected_class] if is_positive else []
    raw_detected = len(matching_raw) > 0
    raw_best_conf = max([d["confidence"] for d in matching_raw], default=0.0)
    raw_best_aspect = max(matching_raw, key=lambda x: x["confidence"])["aspect_ratio"] if matching_raw else None
    
    # Production filter outcome
    matching_prod = [d for d in prod_accepted if d["class_name"] == expected_class] if is_positive else []
    prod_passed = len(matching_prod) > 0
    prod_best_conf = max([d["confidence"] for d in matching_prod], default=0.0)
    prod_best_aspect = max(matching_prod, key=lambda x: x["confidence"])["aspect_ratio"] if matching_prod else None
    
    # Relaxed filter outcome
    matching_relaxed = [d for d in relaxed_accepted if d["class_name"] == expected_class] if is_positive else []
    relaxed_passed = len(matching_relaxed) > 0
    
    # Outcome status
    if is_positive:
        prod_status = "TP" if prod_passed else "FN"
        relaxed_status = "TP" if relaxed_passed else "FN"
        # Reason for failure if FN
        failure_reason = ""
        if not prod_passed:
            if not raw_detected:
                failure_reason = "Raw YOLO missed object entirely"
            elif raw_best_conf < PROD_CONF_THRESH:
                failure_reason = f"Confidence {raw_best_conf:.4f} < {PROD_CONF_THRESH}"
            elif raw_best_aspect is not None:
                failure_reason = f"Aspect ratio {raw_best_aspect:.2f} rejected by filter"
            else:
                failure_reason = "Size filter rejected"
    else:
        # Negative image (prohibited detections are False Positives)
        prod_status = "FP" if len(prod_accepted) > 0 else "TN"
        relaxed_status = "FP" if len(relaxed_accepted) > 0 else "TN"
        failure_reason = ""
        if len(prod_accepted) > 0:
            fp_classes = ", ".join([f"{d['class_name']}({d['confidence']:.2f})" for d in prod_accepted])
            failure_reason = f"False positive alert: {fp_classes}"
            
    return {
        "expected_class": expected_class,
        "is_positive": is_positive,
        "raw_detected": raw_detected,
        "raw_best_conf": raw_best_conf,
        "raw_best_aspect": raw_best_aspect,
        "prod_passed": prod_passed,
        "prod_best_conf": prod_best_conf,
        "prod_best_aspect": prod_best_aspect,
        "prod_status": prod_status,
        "relaxed_passed": relaxed_passed,
        "relaxed_status": relaxed_status,
        "failure_reason": failure_reason,
        "raw_detections": raw_detections,
        "prod_accepted": prod_accepted,
        "relaxed_accepted": relaxed_accepted,
    }


def compute_iou(box1: List[float], box2: List[float]) -> float:
    """Computes IoU between two [x1, y1, x2, y2] boxes."""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - inter
    return inter / union if union > 0 else 0.0


def parse_yolo_label_file(label_path: Path, img_w: int, img_h: int) -> List[Dict[str, Any]]:
    """Reads YOLO normalized box annotations and converts to [cls_id, x1, y1, x2, y2]."""
    if not label_path.exists():
        return []
    content = label_path.read_text(encoding="utf-8").strip()
    if not content:
        return []
    
    gt_boxes = []
    for line in content.splitlines():
        parts = line.strip().split()
        if len(parts) != 5:
            continue
        cls_id = int(parts[0])
        xc, yc, w, h = map(float, parts[1:])
        x1 = int((xc - w / 2) * img_w)
        y1 = int((yc - h / 2) * img_h)
        x2 = int((xc + w / 2) * img_w)
        y2 = int((yc + h / 2) * img_h)
        gt_boxes.append({
            "class_id": cls_id,
            "bbox_xyxy": [x1, y1, x2, y2],
            "bbox_norm": [xc, yc, w, h],
        })
    return gt_boxes


# ==============================================================================
# 1. EVALUATION ON BENCHMARK A: PHASE 0 BENCHMARK (172 IMAGES)
# ==============================================================================
def evaluate_benchmark_a(
    models: Dict[str, YOLO],
    device: Any,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Evaluates Phase 0, Phase 1, and Phase 2 models on the 172-image held-out Phase 0 benchmark.
    Returns summary metrics dict and list of per-image prediction records.
    """
    test_dir = PROJECT_ROOT / "tests" / "test_data"
    categories = [
        "phone", "book", "laptop", "tablet", "smartwatch",
        "calculator", "notebook", "headphones", "water_bottle", "pen", "other"
    ]
    
    # Collect unique test image files
    all_test_images = []
    for cat in categories:
        cat_dir = test_dir / cat
        if not cat_dir.is_dir():
            continue
        seen_stems = set()
        for ext in ("*.jpg", "*.jpeg", "*.png", "*.webp", "*.bmp"):
            for p in sorted(cat_dir.glob(ext)):
                norm_key = p.stem.lower()
                if norm_key in seen_stems or p.name.endswith(".gitkeep"):
                    continue
                seen_stems.add(norm_key)
                all_test_images.append((p, cat))
                
    print(f"\n[Benchmark A] Loaded {len(all_test_images)} held-out Phase 0 test images from {test_dir}")
    
    detailed_rows = []
    summary_by_model = {}
    
    for model_key in ["phase0", "phase1", "phase2"]:
        model = models[model_key]
        cfg = MODEL_CONFIGS[model_key]
        print(f"  Evaluating {cfg['name']} on Benchmark A...")
        
        phone_results = []
        book_results = []
        negative_results = []
        neg_per_category = {cat: [] for cat in categories if cat not in ("phone", "book")}
        baseline_check_results = {}
        
        for img_path, cat in all_test_images:
            img = cv2.imread(str(img_path))
            if img is None:
                continue
                
            raw_dets = run_inference_on_image(model, img, device, imgsz=IMG_SIZE)
            eval_res = evaluate_image_level(raw_dets, cat, model_key)
            
            # Record per-image detail row
            row = {
                "benchmark": "Phase 0 Benchmark",
                "model": model_key,
                "model_name": cfg["name"],
                "image_name": img_path.name,
                "category": cat,
                "expected_class": eval_res["expected_class"],
                "raw_detected": eval_res["raw_detected"],
                "raw_best_conf": eval_res["raw_best_conf"],
                "raw_best_aspect": eval_res["raw_best_aspect"],
                "prod_passed": eval_res["prod_passed"],
                "prod_status": eval_res["prod_status"],
                "prod_best_conf": eval_res["prod_best_conf"],
                "prod_best_aspect": eval_res["prod_best_aspect"],
                "relaxed_passed": eval_res["relaxed_passed"],
                "relaxed_status": eval_res["relaxed_status"],
                "failure_reason": eval_res["failure_reason"],
                "num_raw_dets": len(raw_dets),
                "num_prod_dets": len(eval_res["prod_accepted"]),
                "num_relaxed_dets": len(eval_res["relaxed_accepted"]),
                "raw_detections_str": "; ".join([f"{d['class_name']}({d['confidence']:.2f}, AR={d['aspect_ratio']})" for d in raw_dets]),
            }
            detailed_rows.append(row)
            
            # Aggregate by object group
            if cat == "phone":
                phone_results.append(eval_res)
                if img_path.name in BASELINE_PASSING_IMAGES:
                    baseline_check_results[img_path.name] = {
                        "status": eval_res["prod_status"],
                        "prod_pass": eval_res["prod_passed"],
                        "confidence": eval_res["prod_best_conf"],
                        "aspect_ratio": eval_res["prod_best_aspect"],
                        "failure_reason": eval_res["failure_reason"],
                    }
            elif cat == "book":
                book_results.append(eval_res)
            else:
                negative_results.append(eval_res)
                neg_per_category[cat].append(eval_res)
                
        # Compute summary metrics for this model
        n_phone = len(phone_results)
        phone_raw_recall = sum(1 for r in phone_results if r["raw_detected"]) / n_phone if n_phone else 0
        phone_prod_recall = sum(1 for r in phone_results if r["prod_passed"]) / n_phone if n_phone else 0
        phone_relaxed_recall = sum(1 for r in phone_results if r["relaxed_passed"]) / n_phone if n_phone else 0
        phone_tp = sum(1 for r in phone_results if r["prod_status"] == "TP")
        phone_fn = sum(1 for r in phone_results if r["prod_status"] == "FN")
        
        n_book = len(book_results)
        book_raw_recall = sum(1 for r in book_results if r["raw_detected"]) / n_book if n_book else 0
        book_prod_recall = sum(1 for r in book_results if r["prod_passed"]) / n_book if n_book else 0
        book_relaxed_recall = sum(1 for r in book_results if r["relaxed_passed"]) / n_book if n_book else 0
        book_tp = sum(1 for r in book_results if r["prod_status"] == "TP")
        book_fn = sum(1 for r in book_results if r["prod_status"] == "FN")
        
        n_neg = len(negative_results)
        neg_prod_fps = sum(1 for r in negative_results if r["prod_status"] == "FP")
        neg_prod_fpr = neg_prod_fps / n_neg if n_neg else 0
        neg_relaxed_fps = sum(1 for r in negative_results if r["relaxed_status"] == "FP")
        neg_relaxed_fpr = neg_relaxed_fps / n_neg if n_neg else 0
        neg_tn = sum(1 for r in negative_results if r["prod_status"] == "TN")
        
        # Phone vs Book FP counts on negative set
        phone_fps_count = 0
        book_fps_count = 0
        for r in negative_results:
            for d in r["prod_accepted"]:
                if d["canonical_class"] == "phone":
                    phone_fps_count += 1
                elif d["canonical_class"] == "book":
                    book_fps_count += 1
                    
        # Per negative category breakdown
        cat_breakdown = {}
        for cat, items in neg_per_category.items():
            tot = len(items)
            fps = sum(1 for r in items if r["prod_status"] == "FP")
            cat_breakdown[cat] = {
                "total": tot,
                "fps": fps,
                "fpr": round(fps / tot if tot else 0, 4),
                "correct_rejections": tot - fps,
            }
            
        summary_by_model[model_key] = {
            "model_key": model_key,
            "model_name": cfg["name"],
            "phone_metrics": {
                "total": n_phone,
                "raw_detections": sum(1 for r in phone_results if r["raw_detected"]),
                "raw_recall": round(phone_raw_recall, 4),
                "production_recall": round(phone_prod_recall, 4),
                "relaxed_recall": round(phone_relaxed_recall, 4),
                "true_positives": phone_tp,
                "false_negatives": phone_fn,
            },
            "book_metrics": {
                "total": n_book,
                "raw_detections": sum(1 for r in book_results if r["raw_detected"]),
                "raw_recall": round(book_raw_recall, 4),
                "production_recall": round(book_prod_recall, 4),
                "relaxed_recall": round(book_relaxed_recall, 4),
                "true_positives": book_tp,
                "false_negatives": book_fn,
            },
            "negative_140_metrics": {
                "total": n_neg,
                "false_positives": neg_prod_fps,
                "fpr": round(neg_prod_fpr, 4),
                "relaxed_false_positives": neg_relaxed_fps,
                "relaxed_fpr": round(neg_relaxed_fpr, 4),
                "correct_rejections": neg_tn,
                "phone_fps_total": phone_fps_count,
                "book_fps_total": book_fps_count,
                "per_category": cat_breakdown,
            },
            "baseline_passing_check": baseline_check_results,
        }
        
    return summary_by_model, detailed_rows


# ==============================================================================
# 2. EVALUATION ON BENCHMARK B: PHASE 1 BENCHMARKS (B1: VAL, B2: RAW)
# ==============================================================================
def evaluate_bbox_dataset(
    dataset_name: str,
    images_dir: Path,
    labels_dir: Path,
    models: Dict[str, YOLO],
    device: Any,
    yaml_path: Optional[str] = None,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Evaluates models on a dataset with ground-truth bounding box labels.
    Computes both object-level metrics (mAP50, mAP50-95, precision, recall) and image-level metrics.
    """
    image_files = sorted(list(images_dir.glob("*.jpg")) + list(images_dir.glob("*.png")) + list(images_dir.glob("*.jpeg")))
    print(f"\n[{dataset_name}] Evaluating {len(image_files)} images from {images_dir}")
    
    detailed_rows = []
    summary_by_model = {}
    
    # Official Ultralytics validation where applicable
    ultralytics_metrics = {}
    if yaml_path and os.path.exists(yaml_path):
        for model_key in ["phase1", "phase2"]:
            try:
                res = models[model_key].val(data=yaml_path, split="val", imgsz=IMG_SIZE, device=device, verbose=False)
                ultralytics_metrics[model_key] = {
                    "mAP50": round(float(res.results_dict.get("metrics/mAP50(B)", 0.0)), 4),
                    "mAP50-95": round(float(res.results_dict.get("metrics/mAP50-95(B)", 0.0)), 4),
                    "precision": round(float(res.results_dict.get("metrics/precision(B)", 0.0)), 4),
                    "recall": round(float(res.results_dict.get("metrics/recall(B)", 0.0)), 4),
                }
            except Exception as e:
                print(f"  Note: Ultralytics val on {yaml_path} for {model_key} returned: {e}")
                
    for model_key in ["phase0", "phase1", "phase2"]:
        model = models[model_key]
        cfg = MODEL_CONFIGS[model_key]
        print(f"  Evaluating {cfg['name']} on {dataset_name}...")
        
        gt_box_total = {0: 0, 1: 0}
        pred_box_total = {0: 0, 1: 0}
        tp_50_total = {0: 0, 1: 0}
        
        image_level_records = []
        
        for img_path in image_files:
            img = cv2.imread(str(img_path))
            if img is None:
                continue
            h, w = img.shape[:2]
            
            # Load ground truth bounding boxes
            label_path = labels_dir / f"{img_path.stem}.txt"
            gt_boxes = parse_yolo_label_file(label_path, w, h)
            
            # Determine canonical category based on GT boxes
            has_phone = any(b["class_id"] == 0 for b in gt_boxes)
            has_book = any(b["class_id"] == 1 for b in gt_boxes)
            if has_phone and has_book:
                ground_truth_cat = "phone_and_book"
            elif has_phone:
                ground_truth_cat = "phone"
            elif has_book:
                ground_truth_cat = "book"
            else:
                ground_truth_cat = "negative"
                
            raw_dets = run_inference_on_image(model, img, device, imgsz=IMG_SIZE)
            
            # Image-level evaluation
            eval_res = evaluate_image_level(raw_dets, ground_truth_cat, model_key)
            image_level_records.append((eval_res, ground_truth_cat))
            
            # Object-level IoU matching (for custom models where class 0=phone, 1=book)
            # For Phase 0: map cell phone (67) -> 0, book (73) -> 1
            mapped_dets = []
            for d in raw_dets:
                mapped_cls = None
                if model_key == "phase0":
                    if d["class_name"] == "cell phone":
                        mapped_cls = 0
                    elif d["class_name"] == "book":
                        mapped_cls = 1
                else:
                    if d["class_name"] == "phone":
                        mapped_cls = 0
                    elif d["class_name"] == "book_notebook":
                        mapped_cls = 1
                if mapped_cls is not None:
                    mapped_dets.append((mapped_cls, d["confidence"], d["bbox_xyxy"]))
                    
            # Match detections with GT boxes at IoU 0.50
            for gt in gt_boxes:
                c = gt["class_id"]
                if c in gt_box_total:
                    gt_box_total[c] += 1
                    
            for c, conf, pbox in mapped_dets:
                if c in pred_box_total and conf >= 0.25:
                    pred_box_total[c] += 1
                    
            # Greedy IoU matching per class
            matched_gts = set()
            for c, conf, pbox in sorted(mapped_dets, key=lambda x: x[1], reverse=True):
                if conf < 0.25:
                    continue
                best_iou = 0.0
                best_gt_idx = -1
                for idx, gt in enumerate(gt_boxes):
                    if idx in matched_gts or gt["class_id"] != c:
                        continue
                    iou = compute_iou(pbox, gt["bbox_xyxy"])
                    if iou > best_iou:
                        best_iou = iou
                        best_gt_idx = idx
                if best_iou >= 0.50 and best_gt_idx >= 0:
                    matched_gts.add(best_gt_idx)
                    tp_50_total[c] += 1
                    
            # Detailed row
            row = {
                "benchmark": dataset_name,
                "model": model_key,
                "model_name": cfg["name"],
                "image_name": img_path.name,
                "category": ground_truth_cat,
                "num_gt_boxes": len(gt_boxes),
                "expected_class": eval_res["expected_class"],
                "raw_detected": eval_res["raw_detected"],
                "raw_best_conf": eval_res["raw_best_conf"],
                "prod_passed": eval_res["prod_passed"],
                "prod_status": eval_res["prod_status"],
                "relaxed_passed": eval_res["relaxed_passed"],
                "failure_reason": eval_res["failure_reason"],
                "num_raw_dets": len(raw_dets),
                "num_prod_dets": len(eval_res["prod_accepted"]),
                "raw_detections_str": "; ".join([f"{d['class_name']}({d['confidence']:.2f}, AR={d['aspect_ratio']})" for d in raw_dets]),
            }
            detailed_rows.append(row)
            
        # Object-level precision/recall summary
        obj_metrics = {}
        for c, name in [(0, "phone"), (1, "book_notebook")]:
            n_gt = gt_box_total[c]
            n_pred = pred_box_total[c]
            tp = tp_50_total[c]
            prec = tp / n_pred if n_pred else 0.0
            rec = tp / n_gt if n_gt else 0.0
            f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) else 0.0
            obj_metrics[name] = {
                "gt_instances": n_gt,
                "pred_instances": n_pred,
                "true_positives_iou50": tp,
                "precision_iou50": round(prec, 4),
                "recall_iou50": round(rec, 4),
                "f1_iou50": round(f1, 4),
            }
            
        # Image-level summary
        phones = [r for r, cat in image_level_records if cat == "phone"]
        books = [r for r, cat in image_level_records if cat == "book"]
        negs = [r for r, cat in image_level_records if cat == "negative"]
        
        img_metrics = {
            "phone_raw_recall": round(sum(1 for r in phones if r["raw_detected"]) / len(phones), 4) if phones else 0,
            "phone_prod_recall": round(sum(1 for r in phones if r["prod_passed"]) / len(phones), 4) if phones else 0,
            "phone_relaxed_recall": round(sum(1 for r in phones if r["relaxed_passed"]) / len(phones), 4) if phones else 0,
            "book_raw_recall": round(sum(1 for r in books if r["raw_detected"]) / len(books), 4) if books else 0,
            "book_prod_recall": round(sum(1 for r in books if r["prod_passed"]) / len(books), 4) if books else 0,
            "book_relaxed_recall": round(sum(1 for r in books if r["relaxed_passed"]) / len(books), 4) if books else 0,
            "neg_fps": sum(1 for r in negs if r["prod_status"] == "FP"),
            "neg_total": len(negs),
            "neg_fpr": round(sum(1 for r in negs if r["prod_status"] == "FP") / len(negs), 4) if negs else 0,
        }
        
        summary_by_model[model_key] = {
            "model_key": model_key,
            "model_name": cfg["name"],
            "ultralytics_metrics": ultralytics_metrics.get(model_key, {}),
            "object_metrics_iou50": obj_metrics,
            "image_level_metrics": img_metrics,
        }
        
    return summary_by_model, detailed_rows


# ==============================================================================
# MAIN EXECUTION ORCHESTRATOR
# ==============================================================================
def main():
    print("=" * 80)
    print(" INTELLIPROCTOR PHASE 2 MODEL CROSS-BENCHMARK EVALUATION")
    print("=" * 80)
    print(f"Output Directory  : {OUTPUT_DIR}")
    print(f"Phase 0 Weights   : {PHASE0_WEIGHTS} (Exists: {PHASE0_WEIGHTS.exists()})")
    print(f"Phase 1 Weights   : {PHASE1_WEIGHTS} (Exists: {PHASE1_WEIGHTS.exists()})")
    print(f"Phase 2 Weights   : {PHASE2_WEIGHTS} (Exists: {PHASE2_WEIGHTS.exists()})")
    print("=" * 80)
    
    device = 0 if torch.cuda.is_available() else "cpu"
    print(f"Compute Device    : {device} ({torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'})")
    
    # Load all three models safely
    models = {
        "phase0": load_model(str(PHASE0_WEIGHTS)),
        "phase1": load_model(str(PHASE1_WEIGHTS)),
        "phase2": load_model(str(PHASE2_WEIGHTS)),
    }
    
    # -------------------------------------------------------------------------
    # 1. Benchmark A: Phase 0 Benchmark (tests/test_data/ - 172 images)
    # -------------------------------------------------------------------------
    benchmark_a_summary, benchmark_a_rows = evaluate_benchmark_a(models, device)
    
    # Save Benchmark A CSV predictions
    csv_a_path = OUTPUT_DIR / "phase0_benchmark_predictions.csv"
    with open(csv_a_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(benchmark_a_rows[0].keys()))
        writer.writeheader()
        writer.writerows(benchmark_a_rows)
    print(f"Saved Benchmark A predictions to {csv_a_path}")
    
    # -------------------------------------------------------------------------
    # 2. Benchmark B1: Phase 1 Validation Set (dataset/yolo_dataset/images/val - 14 images)
    # -------------------------------------------------------------------------
    p1_val_images = PROJECT_ROOT / "dataset" / "yolo_dataset" / "images" / "val"
    p1_val_labels = PROJECT_ROOT / "dataset" / "yolo_dataset" / "labels" / "val"
    p1_data_yaml = str(PROJECT_ROOT / "dataset" / "yolo_dataset" / "data.yaml")
    
    benchmark_b1_summary, benchmark_b1_rows = evaluate_bbox_dataset(
        dataset_name="Phase 1 Val Benchmark (14 images)",
        images_dir=p1_val_images,
        labels_dir=p1_val_labels,
        models=models,
        device=device,
        yaml_path=p1_data_yaml,
    )
    csv_b1_path = OUTPUT_DIR / "phase1_val_predictions.csv"
    with open(csv_b1_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(benchmark_b1_rows[0].keys()))
        writer.writeheader()
        writer.writerows(benchmark_b1_rows)
    print(f"Saved Benchmark B1 predictions to {csv_b1_path}")
    
    # -------------------------------------------------------------------------
    # 3. Benchmark B2: Phase 1 Raw Set (dataset/raw/ - 70 images)
    # -------------------------------------------------------------------------
    raw_images_dir = PROJECT_ROOT / "dataset" / "raw"
    # Create temporary flat view of raw images and labels for evaluation without modifying anything
    temp_raw_pairs = []
    for cat in ["phone", "book_notebook", "water_bottle", "hand_no_prohibited_object"]:
        cat_dir = raw_images_dir / cat
        if cat_dir.is_dir():
            for p in cat_dir.glob("*.jpg"):
                lbl = cat_dir / f"{p.stem}.txt"
                temp_raw_pairs.append((p, lbl, cat))
                
    # Evaluate raw set
    print(f"\n[Phase 1 Raw Benchmark] Evaluating {len(temp_raw_pairs)} raw images from {raw_images_dir}")
    raw_detailed_rows = []
    raw_summary_by_model = {}
    
    for model_key in ["phase0", "phase1", "phase2"]:
        model = models[model_key]
        cfg = MODEL_CONFIGS[model_key]
        
        gt_box_total = {0: 0, 1: 0}
        pred_box_total = {0: 0, 1: 0}
        tp_50_total = {0: 0, 1: 0}
        image_records = []
        
        for img_path, lbl_path, cat in temp_raw_pairs:
            img = cv2.imread(str(img_path))
            if img is None:
                continue
            h, w = img.shape[:2]
            gt_boxes = parse_yolo_label_file(lbl_path, w, h)
            
            raw_dets = run_inference_on_image(model, img, device, imgsz=IMG_SIZE)
            eval_res = evaluate_image_level(raw_dets, cat, model_key)
            image_records.append((eval_res, cat))
            
            mapped_dets = []
            for d in raw_dets:
                mapped_cls = None
                if model_key == "phase0":
                    if d["class_name"] == "cell phone":
                        mapped_cls = 0
                    elif d["class_name"] == "book":
                        mapped_cls = 1
                else:
                    if d["class_name"] == "phone":
                        mapped_cls = 0
                    elif d["class_name"] == "book_notebook":
                        mapped_cls = 1
                if mapped_cls is not None:
                    mapped_dets.append((mapped_cls, d["confidence"], d["bbox_xyxy"]))
                    
            for gt in gt_boxes:
                c = gt["class_id"]
                if c in gt_box_total:
                    gt_box_total[c] += 1
            for c, conf, pbox in mapped_dets:
                if c in pred_box_total and conf >= 0.25:
                    pred_box_total[c] += 1
            matched_gts = set()
            for c, conf, pbox in sorted(mapped_dets, key=lambda x: x[1], reverse=True):
                if conf < 0.25:
                    continue
                best_iou = 0.0
                best_gt_idx = -1
                for idx, gt in enumerate(gt_boxes):
                    if idx in matched_gts or gt["class_id"] != c:
                        continue
                    iou = compute_iou(pbox, gt["bbox_xyxy"])
                    if iou > best_iou:
                        best_iou = iou
                        best_gt_idx = idx
                if best_iou >= 0.50 and best_gt_idx >= 0:
                    matched_gts.add(best_gt_idx)
                    tp_50_total[c] += 1
                    
            raw_detailed_rows.append({
                "benchmark": "Phase 1 Raw Benchmark",
                "model": model_key,
                "model_name": cfg["name"],
                "image_name": img_path.name,
                "category": cat,
                "expected_class": eval_res["expected_class"],
                "raw_detected": eval_res["raw_detected"],
                "raw_best_conf": eval_res["raw_best_conf"],
                "prod_passed": eval_res["prod_passed"],
                "prod_status": eval_res["prod_status"],
                "relaxed_passed": eval_res["relaxed_passed"],
                "failure_reason": eval_res["failure_reason"],
                "num_raw_dets": len(raw_dets),
                "num_prod_dets": len(eval_res["prod_accepted"]),
                "raw_detections_str": "; ".join([f"{d['class_name']}({d['confidence']:.2f}, AR={d['aspect_ratio']})" for d in raw_dets]),
            })
            
        obj_metrics = {}
        for c, name in [(0, "phone"), (1, "book_notebook")]:
            n_gt = gt_box_total[c]
            n_pred = pred_box_total[c]
            tp = tp_50_total[c]
            prec = tp / n_pred if n_pred else 0.0
            rec = tp / n_gt if n_gt else 0.0
            f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) else 0.0
            obj_metrics[name] = {
                "gt_instances": n_gt,
                "pred_instances": n_pred,
                "true_positives_iou50": tp,
                "precision_iou50": round(prec, 4),
                "recall_iou50": round(rec, 4),
                "f1_iou50": round(f1, 4),
            }
            
        phones = [r for r, cat in image_records if cat == "phone"]
        books = [r for r, cat in image_records if cat == "book_notebook"]
        negs = [r for r, cat in image_records if cat in ("water_bottle", "hand_no_prohibited_object")]
        
        raw_summary_by_model[model_key] = {
            "model_key": model_key,
            "model_name": cfg["name"],
            "object_metrics_iou50": obj_metrics,
            "image_level_metrics": {
                "phone_raw_recall": round(sum(1 for r in phones if r["raw_detected"]) / len(phones), 4) if phones else 0,
                "phone_prod_recall": round(sum(1 for r in phones if r["prod_passed"]) / len(phones), 4) if phones else 0,
                "phone_relaxed_recall": round(sum(1 for r in phones if r["relaxed_passed"]) / len(phones), 4) if phones else 0,
                "book_raw_recall": round(sum(1 for r in books if r["raw_detected"]) / len(books), 4) if books else 0,
                "book_prod_recall": round(sum(1 for r in books if r["prod_passed"]) / len(books), 4) if books else 0,
                "book_relaxed_recall": round(sum(1 for r in books if r["relaxed_passed"]) / len(books), 4) if books else 0,
                "neg_fps": sum(1 for r in negs if r["prod_status"] == "FP"),
                "neg_total": len(negs),
                "neg_fpr": round(sum(1 for r in negs if r["prod_status"] == "FP") / len(negs), 4) if negs else 0,
            },
        }
        
    csv_b2_path = OUTPUT_DIR / "phase1_raw_predictions.csv"
    with open(csv_b2_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(raw_detailed_rows[0].keys()))
        writer.writeheader()
        writer.writerows(raw_detailed_rows)
    print(f"Saved Benchmark B2 predictions to {csv_b2_path}")

    # -------------------------------------------------------------------------
    # 4. Supplementary Benchmark C: Phase 2 Test Set (Dataset_it2/images/test - 75 images)
    # -------------------------------------------------------------------------
    it2_test_images = PROJECT_ROOT / "Dataset_it2" / "images" / "test"
    it2_test_labels = PROJECT_ROOT / "Dataset_it2" / "labels" / "test"
    it2_yaml = str(PROJECT_ROOT / "Dataset_it2" / "data.yaml")
    
    benchmark_c_summary = {}
    if it2_test_images.exists() and it2_test_labels.exists():
        benchmark_c_summary, benchmark_c_rows = evaluate_bbox_dataset(
            dataset_name="Phase 2 Held-Out Test Set (75 images)",
            images_dir=it2_test_images,
            labels_dir=it2_test_labels,
            models=models,
            device=device,
            yaml_path=it2_yaml,
        )
        csv_c_path = OUTPUT_DIR / "phase2_test_predictions.csv"
        with open(csv_c_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(benchmark_c_rows[0].keys()))
            writer.writeheader()
            writer.writerows(benchmark_c_rows)
        print(f"Saved Benchmark C predictions to {csv_c_path}")

    # -------------------------------------------------------------------------
    # 5. Build Final Cross-Benchmark Master Report
    # -------------------------------------------------------------------------
    master_report = {
        "metadata": {
            "evaluation_title": "IntelliProctor Phase 2 Cross-Benchmark Evaluation",
            "timestamp": datetime.datetime.now().isoformat(),
            "device": str(device),
            "device_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU",
            "models_evaluated": {
                "phase0": {"name": MODEL_CONFIGS["phase0"]["name"], "weights": str(PHASE0_WEIGHTS)},
                "phase1": {"name": MODEL_CONFIGS["phase1"]["name"], "weights": str(PHASE1_WEIGHTS)},
                "phase2": {"name": MODEL_CONFIGS["phase2"]["name"], "weights": str(PHASE2_WEIGHTS)},
            },
            "parameters": {
                "imgsz": IMG_SIZE,
                "production_conf_threshold": PROD_CONF_THRESH,
                "relaxed_conf_threshold": RELAXED_CONF_THRESH,
                "min_size_px": MIN_SIZE,
                "phone_aspect_ratio_prod": (1.3, 2.9),
                "phone_aspect_ratio_relaxed": (1.15, 2.9),
                "book_aspect_ratio_prod": None,
                "book_aspect_ratio_relaxed": (0.80, 2.50),
            },
        },
        "benchmark_a_phase0": benchmark_a_summary,
        "benchmark_b1_phase1_val": benchmark_b1_summary,
        "benchmark_b2_phase1_raw": raw_summary_by_model,
        "benchmark_c_phase2_test": benchmark_c_summary,
        "cross_benchmark_comparison_matrix": {
            "phase0_held_out_benchmark_172_images": {
                "description": "External held-out benchmark: 17 phone, 15 book, 140 negative images across 9 classes. Image-level labels only.",
                "metrics": {
                    "phone_raw_recall": {
                        "phase0": benchmark_a_summary["phase0"]["phone_metrics"]["raw_recall"],
                        "phase1": benchmark_a_summary["phase1"]["phone_metrics"]["raw_recall"],
                        "phase2": benchmark_a_summary["phase2"]["phone_metrics"]["raw_recall"],
                    },
                    "phone_production_recall": {
                        "phase0": benchmark_a_summary["phase0"]["phone_metrics"]["production_recall"],
                        "phase1": benchmark_a_summary["phase1"]["phone_metrics"]["production_recall"],
                        "phase2": benchmark_a_summary["phase2"]["phone_metrics"]["production_recall"],
                    },
                    "phone_relaxed_recall": {
                        "phase0": benchmark_a_summary["phase0"]["phone_metrics"]["relaxed_recall"],
                        "phase1": benchmark_a_summary["phase1"]["phone_metrics"]["relaxed_recall"],
                        "phase2": benchmark_a_summary["phase2"]["phone_metrics"]["relaxed_recall"],
                    },
                    "book_raw_recall": {
                        "phase0": benchmark_a_summary["phase0"]["book_metrics"]["raw_recall"],
                        "phase1": benchmark_a_summary["phase1"]["book_metrics"]["raw_recall"],
                        "phase2": benchmark_a_summary["phase2"]["book_metrics"]["raw_recall"],
                    },
                    "book_production_recall": {
                        "phase0": benchmark_a_summary["phase0"]["book_metrics"]["production_recall"],
                        "phase1": benchmark_a_summary["phase1"]["book_metrics"]["production_recall"],
                        "phase2": benchmark_a_summary["phase2"]["book_metrics"]["production_recall"],
                    },
                    "book_relaxed_recall": {
                        "phase0": benchmark_a_summary["phase0"]["book_metrics"]["relaxed_recall"],
                        "phase1": benchmark_a_summary["phase1"]["book_metrics"]["relaxed_recall"],
                        "phase2": benchmark_a_summary["phase2"]["book_metrics"]["relaxed_recall"],
                    },
                    "negative_140_fpr": {
                        "phase0": benchmark_a_summary["phase0"]["negative_140_metrics"]["fpr"],
                        "phase1": benchmark_a_summary["phase1"]["negative_140_metrics"]["fpr"],
                        "phase2": benchmark_a_summary["phase2"]["negative_140_metrics"]["fpr"],
                    },
                    "negative_140_false_positives": {
                        "phase0": benchmark_a_summary["phase0"]["negative_140_metrics"]["false_positives"],
                        "phase1": benchmark_a_summary["phase1"]["negative_140_metrics"]["false_positives"],
                        "phase2": benchmark_a_summary["phase2"]["negative_140_metrics"]["false_positives"],
                    },
                    "negative_140_phone_fps": {
                        "phase0": benchmark_a_summary["phase0"]["negative_140_metrics"]["phone_fps_total"],
                        "phase1": benchmark_a_summary["phase1"]["negative_140_metrics"]["phone_fps_total"],
                        "phase2": benchmark_a_summary["phase2"]["negative_140_metrics"]["phone_fps_total"],
                    },
                    "negative_140_book_fps": {
                        "phase0": benchmark_a_summary["phase0"]["negative_140_metrics"]["book_fps_total"],
                        "phase1": benchmark_a_summary["phase1"]["negative_140_metrics"]["book_fps_total"],
                        "phase2": benchmark_a_summary["phase2"]["negative_140_metrics"]["book_fps_total"],
                    },
                },
            },
            "phase1_validation_benchmark_14_images": {
                "description": "Phase 1 held-out validation set: 4 phone, 4 book, 6 negative images. Standard bounding box labels.",
                "metrics": {
                    "mAP50": {
                        "phase0": "N/A (COCO labels)",
                        "phase1": benchmark_b1_summary["phase1"]["ultralytics_metrics"].get("mAP50", "N/A"),
                        "phase2": benchmark_b1_summary["phase2"]["ultralytics_metrics"].get("mAP50", "N/A"),
                    },
                    "mAP50-95": {
                        "phase0": "N/A (COCO labels)",
                        "phase1": benchmark_b1_summary["phase1"]["ultralytics_metrics"].get("mAP50-95", "N/A"),
                        "phase2": benchmark_b1_summary["phase2"]["ultralytics_metrics"].get("mAP50-95", "N/A"),
                    },
                    "phone_iou50_recall": {
                        "phase0": benchmark_b1_summary["phase0"]["object_metrics_iou50"]["phone"]["recall_iou50"],
                        "phase1": benchmark_b1_summary["phase1"]["object_metrics_iou50"]["phone"]["recall_iou50"],
                        "phase2": benchmark_b1_summary["phase2"]["object_metrics_iou50"]["phone"]["recall_iou50"],
                    },
                    "book_iou50_recall": {
                        "phase0": benchmark_b1_summary["phase0"]["object_metrics_iou50"]["book_notebook"]["recall_iou50"],
                        "phase1": benchmark_b1_summary["phase1"]["object_metrics_iou50"]["book_notebook"]["recall_iou50"],
                        "phase2": benchmark_b1_summary["phase2"]["object_metrics_iou50"]["book_notebook"]["recall_iou50"],
                    },
                    "negative_fpr": {
                        "phase0": benchmark_b1_summary["phase0"]["image_level_metrics"]["neg_fpr"],
                        "phase1": benchmark_b1_summary["phase1"]["image_level_metrics"]["neg_fpr"],
                        "phase2": benchmark_b1_summary["phase2"]["image_level_metrics"]["neg_fpr"],
                    },
                },
            },
        },
    }
    
    # Save master JSON report
    report_path = OUTPUT_DIR / "cross_benchmark_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(master_report, f, indent=2)
    print(f"\n[Master Report] Saved full cross-benchmark report to {report_path}")
    
    # Print formatted summary table
    print("\n" + "=" * 90)
    print(" SUMMARY CROSS-BENCHMARK COMPARISON TABLE")
    print("=" * 90)
    print(f"{'Benchmark / Metric':<35} | {'Phase 0 Baseline':<16} | {'Phase 1 (Iter 1)':<16} | {'Phase 2 (Iter 2 Aug)':<20}")
    print("-" * 90)
    
    p0_m = benchmark_a_summary["phase0"]
    p1_m = benchmark_a_summary["phase1"]
    p2_m = benchmark_a_summary["phase2"]
    
    print(f"{'Phase 0 Phone Raw Recall':<35} | {p0_m['phone_metrics']['raw_recall']*100:>14.1f}% | {p1_m['phone_metrics']['raw_recall']*100:>14.1f}% | {p2_m['phone_metrics']['raw_recall']*100:>18.1f}%")
    print(f"{'Phase 0 Phone Prod Recall (>=0.65)':<35} | {p0_m['phone_metrics']['production_recall']*100:>14.1f}% | {p1_m['phone_metrics']['production_recall']*100:>14.1f}% | {p2_m['phone_metrics']['production_recall']*100:>18.1f}%")
    print(f"{'Phase 0 Phone Relaxed Recall (>=0.50)':<35} | {p0_m['phone_metrics']['relaxed_recall']*100:>14.1f}% | {p1_m['phone_metrics']['relaxed_recall']*100:>14.1f}% | {p2_m['phone_metrics']['relaxed_recall']*100:>18.1f}%")
    print(f"{'Phase 0 Book Raw Recall':<35} | {p0_m['book_metrics']['raw_recall']*100:>14.1f}% | {p1_m['book_metrics']['raw_recall']*100:>14.1f}% | {p2_m['book_metrics']['raw_recall']*100:>18.1f}%")
    print(f"{'Phase 0 Book Prod Recall (>=0.65)':<35} | {p0_m['book_metrics']['production_recall']*100:>14.1f}% | {p1_m['book_metrics']['production_recall']*100:>14.1f}% | {p2_m['book_metrics']['production_recall']*100:>18.1f}%")
    print(f"{'Phase 0 Book Relaxed Recall (>=0.50)':<35} | {p0_m['book_metrics']['relaxed_recall']*100:>14.1f}% | {p1_m['book_metrics']['relaxed_recall']*100:>14.1f}% | {p2_m['book_metrics']['relaxed_recall']*100:>18.1f}%")
    print(f"{'Phase 0 Negative 140 FPR':<35} | {p0_m['negative_140_metrics']['fpr']*100:>14.1f}% | {p1_m['negative_140_metrics']['fpr']*100:>14.1f}% | {p2_m['negative_140_metrics']['fpr']*100:>18.1f}%")
    print(f"{'Phase 0 Neg 140 Total FPs':<35} | {p0_m['negative_140_metrics']['false_positives']:>15} | {p1_m['negative_140_metrics']['false_positives']:>15} | {p2_m['negative_140_metrics']['false_positives']:>19}")
    print(f"{'  ├─ Phone FPs on Negatives':<35} | {p0_m['negative_140_metrics']['phone_fps_total']:>15} | {p1_m['negative_140_metrics']['phone_fps_total']:>15} | {p2_m['negative_140_metrics']['phone_fps_total']:>19}")
    print(f"{'  └─ Book FPs on Negatives':<35} | {p0_m['negative_140_metrics']['book_fps_total']:>15} | {p1_m['negative_140_metrics']['book_fps_total']:>15} | {p2_m['negative_140_metrics']['book_fps_total']:>19}")
    print("-" * 90)
    
    b1_p0 = benchmark_b1_summary["phase0"]
    b1_p1 = benchmark_b1_summary["phase1"]
    b1_p2 = benchmark_b1_summary["phase2"]
    
    p1_val_map50_p1 = b1_p1['ultralytics_metrics'].get('mAP50', 'N/A')
    p1_val_map50_p2 = b1_p2['ultralytics_metrics'].get('mAP50', 'N/A')
    p1_val_map5095_p1 = b1_p1['ultralytics_metrics'].get('mAP50-95', 'N/A')
    p1_val_map5095_p2 = b1_p2['ultralytics_metrics'].get('mAP50-95', 'N/A')
    
    print(f"{'Phase 1 Val mAP50':<35} | {'N/A (COCO)':>15} | {str(p1_val_map50_p1):>15} | {str(p1_val_map50_p2):>19}")
    print(f"{'Phase 1 Val mAP50-95':<35} | {'N/A (COCO)':>15} | {str(p1_val_map5095_p1):>15} | {str(p1_val_map5095_p2):>19}")
    print(f"{'Phase 1 Val Phone Recall (IoU>=0.5)':<35} | {b1_p0['object_metrics_iou50']['phone']['recall_iou50']*100:>14.1f}% | {b1_p1['object_metrics_iou50']['phone']['recall_iou50']*100:>14.1f}% | {b1_p2['object_metrics_iou50']['phone']['recall_iou50']*100:>18.1f}%")
    print(f"{'Phase 1 Val Book Recall (IoU>=0.5)':<35} | {b1_p0['object_metrics_iou50']['book_notebook']['recall_iou50']*100:>14.1f}% | {b1_p1['object_metrics_iou50']['book_notebook']['recall_iou50']*100:>14.1f}% | {b1_p2['object_metrics_iou50']['book_notebook']['recall_iou50']*100:>18.1f}%")
    print(f"{'Phase 1 Val Negative FPR (6 imgs)':<35} | {b1_p0['image_level_metrics']['neg_fpr']*100:>14.1f}% | {b1_p1['image_level_metrics']['neg_fpr']*100:>14.1f}% | {b1_p2['image_level_metrics']['neg_fpr']*100:>18.1f}%")
    print("=" * 90)


if __name__ == "__main__":
    main()
