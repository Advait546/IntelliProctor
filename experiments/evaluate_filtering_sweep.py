"""
Filtering and Aspect-Ratio Sweep Analysis on Negative & Positive Data.

Evaluates the tradeoff between prohibited object recall and negative false alarms across:
- Confidence thresholds: [0.40, 0.50, 0.60, 0.65, 0.70, 0.80]
- Phone aspect-ratio lower bounds: [1.00, 1.10, 1.15, 1.20, 1.25, 1.30]

Tested on:
- 17 held-out phone images
- 15 held-out book images
- 14 raw water bottle negative images
- 14 raw hand-only negative images

Saves results to tests/results/filtering_sweep_results.json.
"""

import os
import json
import argparse
from typing import Dict, List, Any
import numpy as np
from ultralytics import YOLO

from evaluate_phase1 import (
    MODEL_CONFIGS,
    load_model_safely,
    collect_test_suites,
    run_model_inference_on_frame,
    cv2,
)

CANDIDATE_CONFIDENCES = [0.40, 0.50, 0.60, 0.65, 0.70, 0.80]
CANDIDATE_ASPECT_LOWERS = [1.00, 1.10, 1.15, 1.20, 1.25, 1.30]
DEFAULT_OUTPUT_JSON = os.path.join("tests", "results", "filtering_sweep_results.json")


def precompute_raw_inferences(model: YOLO, phase_key: str, suites: Dict[str, List]) -> List[Dict[str, Any]]:
    """Runs inference once per image with minimal filtering to record all candidates."""
    phase_cfg = MODEL_CONFIGS[phase_key]
    items_to_test = []

    for img_path, gt in suites["phase0_held_out"]:
        items_to_test.append((img_path, gt, "phase0_held_out"))
    for img_path, gt in suites["negatives"]:
        items_to_test.append((img_path, gt, "negatives"))

    print(f"Precomputing raw inferences on {len(items_to_test)} images for {phase_key}...")
    records = []
    for img_path, gt, suite in items_to_test:
        img = cv2.imread(img_path)
        if img is None:
            continue
        # Run inference with conf=0.10 and aspect=0.5 to catch all possible detections
        dets = run_model_inference_on_frame(
            model=model,
            frame=img,
            phase_cfg=phase_cfg,
            conf_threshold=0.10,
            phone_aspect_lower=0.5,
            phone_aspect_upper=5.0,
            min_size=5,
        )
        records.append({
            "image": os.path.basename(img_path),
            "ground_truth": gt,
            "suite": suite,
            "expected_class": phase_cfg["target_mapping"].get(gt, "none"),
            "raw_detections": dets,
        })
    return records


def evaluate_filters_on_cache(
    records: List[Dict[str, Any]],
    phase_key: str,
    conf_threshold: float,
    aspect_lower: float,
    aspect_upper: float = 2.9,
    min_size: int = 12,
) -> Dict[str, Any]:
    phase_cfg = MODEL_CONFIGS[phase_key]
    target_classes = phase_cfg["target_classes"]

    phone_total = 0
    phone_detected = 0
    book_total = 0
    book_detected = 0
    water_bottle_total = 0
    water_bottle_fps = 0
    hand_total = 0
    hand_fps = 0

    for r in records:
        gt = r["ground_truth"]
        expected_class = r["expected_class"]

        # Check which detections pass given thresholds
        passing_dets = []
        for d in r["raw_detections"]:
            cls_name = d["class_name"]
            conf = d["confidence"]
            aspect = d["aspect_ratio"]
            box_w, box_h = d["box_width"], d["box_height"]
            short_side = min(box_w, box_h)

            is_target = cls_name in target_classes
            passes_conf = conf >= conf_threshold
            passes_size = short_side >= min_size

            passes_aspect = True
            if is_target:
                cfg_aspect = target_classes[cls_name]["aspect_range"]
                if cfg_aspect is not None:
                    passes_aspect = aspect_lower <= aspect <= aspect_upper

            if is_target and passes_conf and passes_size and passes_aspect:
                passing_dets.append(d)

        if gt == "phone":
            phone_total += 1
            if any(d["class_name"] == expected_class for d in passing_dets):
                phone_detected += 1
        elif gt == "book":
            book_total += 1
            if any(d["class_name"] == expected_class for d in passing_dets):
                book_detected += 1
        elif gt == "water_bottle":
            water_bottle_total += 1
            if passing_dets:
                water_bottle_fps += 1
        elif gt == "hand_no_prohibited_object":
            hand_total += 1
            if passing_dets:
                hand_fps += 1

    return {
        "conf_threshold": conf_threshold,
        "aspect_lower": aspect_lower,
        "phone_recall": round(phone_detected / phone_total, 4) if phone_total else 0.0,
        "phone_detected": phone_detected,
        "phone_total": phone_total,
        "book_recall": round(book_detected / book_total, 4) if book_total else 0.0,
        "book_detected": book_detected,
        "book_total": book_total,
        "water_bottle_fps": water_bottle_fps,
        "water_bottle_total": water_bottle_total,
        "water_bottle_fpr": round(water_bottle_fps / water_bottle_total, 4) if water_bottle_total else 0.0,
        "hand_fps": hand_fps,
        "hand_total": hand_total,
        "hand_fpr": round(hand_fps / hand_total, 4) if hand_total else 0.0,
        "total_false_positives": water_bottle_fps + hand_fps,
    }


def run_sweeps(output_file: str = DEFAULT_OUTPUT_JSON) -> Dict[str, Any]:
    suites = collect_test_suites()

    models_to_test = ["phase0"]
    if os.path.exists(MODEL_CONFIGS["phase1"]["weights"]):
        models_to_test.append("phase1")

    all_sweep_results = {}

    for phase_key in models_to_test:
        print(f"\n==================================================")
        print(f"Running filtering sweep for {phase_key}...")
        print(f"==================================================")
        model = load_model_safely(MODEL_CONFIGS[phase_key]["weights"])
        cached_records = precompute_raw_inferences(model, phase_key, suites)

        # 1. Sweep Confidence (with aspect_lower = 1.30)
        conf_sweep = []
        for c in CANDIDATE_CONFIDENCES:
            res = evaluate_filters_on_cache(cached_records, phase_key, conf_threshold=c, aspect_lower=1.30)
            conf_sweep.append(res)

        # 2. Sweep Aspect Ratio Lower Bound (with conf_threshold = 0.65)
        aspect_sweep = []
        for a in CANDIDATE_ASPECT_LOWERS:
            res = evaluate_filters_on_cache(cached_records, phase_key, conf_threshold=0.65, aspect_lower=a)
            aspect_sweep.append(res)

        # 3. 2D grid sweep (conf x aspect)
        grid_sweep = []
        for c in CANDIDATE_CONFIDENCES:
            for a in CANDIDATE_ASPECT_LOWERS:
                res = evaluate_filters_on_cache(cached_records, phase_key, conf_threshold=c, aspect_lower=a)
                grid_sweep.append(res)

        all_sweep_results[phase_key] = {
            "model_name": MODEL_CONFIGS[phase_key]["name"],
            "confidence_sweep_fixed_aspect_1_3": conf_sweep,
            "aspect_ratio_sweep_fixed_conf_0_65": aspect_sweep,
            "grid_sweep": grid_sweep,
        }

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(all_sweep_results, f, indent=2)

    print(f"\nSaved filtering sweep analysis to: {output_file}")
    print_sweep_summary(all_sweep_results)
    return all_sweep_results


def print_sweep_summary(results: Dict[str, Any]):
    print("\n" + "=" * 90)
    print(" FILTERING SWEEP EMPIRICAL TRADEOFF SUMMARY")
    print("=" * 90)
    for phase_key, pdata in results.items():
        print(f"\nMODEL: {pdata['model_name']}")
        print("\n--- Confidence Sweep (Phone Aspect Fixed at 1.30) ---")
        print(f"{'Conf':<6} | {'Phone Rec.':<12} | {'Book Rec.':<12} | {'WB FPR':<10} | {'Hand FPR':<10} | {'Total FPs'}")
        print("-" * 75)
        for r in pdata["confidence_sweep_fixed_aspect_1_3"]:
            print(f"{r['conf_threshold']:<6.2f} | {r['phone_detected']}/{r['phone_total']} ({r['phone_recall']*100:.1f}%) | "
                  f"{r['book_detected']}/{r['book_total']} ({r['book_recall']*100:.1f}%) | "
                  f"{r['water_bottle_fps']}/{r['water_bottle_total']} ({r['water_bottle_fpr']*100:.1f}%) | "
                  f"{r['hand_fps']}/{r['hand_total']} ({r['hand_fpr']*100:.1f}%) | "
                  f"{r['total_false_positives']}")

        print("\n--- Aspect Ratio Lower Bound Sweep (Conf Fixed at 0.65) ---")
        print(f"{'Lower Bound':<12} | {'Phone Rec.':<12} | {'Book Rec.':<12} | {'WB FPR':<10} | {'Hand FPR':<10} | {'Total FPs'}")
        print("-" * 75)
        for r in pdata["aspect_ratio_sweep_fixed_conf_0_65"]:
            print(f"{r['aspect_lower']:<12.2f} | {r['phone_detected']}/{r['phone_total']} ({r['phone_recall']*100:.1f}%) | "
                  f"{r['book_detected']}/{r['book_total']} ({r['book_recall']*100:.1f}%) | "
                  f"{r['water_bottle_fps']}/{r['water_bottle_total']} ({r['water_bottle_fpr']*100:.1f}%) | "
                  f"{r['hand_fps']}/{r['hand_total']} ({r['hand_fpr']*100:.1f}%) | "
                  f"{r['total_false_positives']}")
    print("=" * 90)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate filtering and aspect ratio sweeps.")
    parser.add_argument("--output", default=DEFAULT_OUTPUT_JSON, help="Path to save output JSON")
    args = parser.parse_args()
    run_sweeps(args.output)
