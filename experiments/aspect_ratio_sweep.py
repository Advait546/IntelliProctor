"""
Phase 0 Aspect-Ratio Filter Experiment for IntelliProctor Object Detection.

This experiment evaluates the effect of sweeping the phone aspect-ratio filter
lower bound across [1.0, 1.1, 1.15, 1.2, 1.25, 1.3] against the raw YOLO predictions
preserved in the baseline test results (tests/results/latest_automated_detection_results.json).

IMPORTANT CONSTRAINTS:
- Does NOT modify production detection code in video_input_analysis.py.
- Does NOT overwrite tests/results/latest_automated_detection_results.json.
- Preserves the production upper bound (2.9), confidence threshold (0.65), and min size (12 px).
- Does NOT claim precision or FPR on the current test set because negative examples
  are required before precision/FPR can be computed.
"""

import os
import sys
import json
import argparse
from typing import Dict, List, Any, Optional, Tuple


DEFAULT_INPUT_JSON = os.path.join("tests", "results", "latest_automated_detection_results.json")
DEFAULT_OUTPUT_JSON = os.path.join("tests", "results", "aspect_ratio_sweep_results.json")
CANDIDATE_LOWER_BOUNDS = [1.0, 1.1, 1.15, 1.2, 1.25, 1.3]
DEFAULT_UPPER_BOUND = 2.9
DEFAULT_CONF_THRESHOLD = 0.65
DEFAULT_MIN_SIZE = 12
BASELINE_LOWER_BOUND = 1.3


def extract_unique_evaluations(
    raw_results_data: Dict[str, Any],
    category: str = "phone"
) -> List[Dict[str, Any]]:
    """
    Extracts test records for a given category and deduplicates by image source.
    Handles duplicate records caused by case-insensitive filesystem globbing on Windows.
    """
    results = raw_results_data.get("results", [])
    seen_sources = set()
    unique_records = []

    for record in results:
        if record.get("object_tested", "").lower() == category.lower():
            src = record.get("source", "")
            if src and src not in seen_sources:
                seen_sources.add(src)
                unique_records.append(record)

    return unique_records


def evaluate_detection_filters(
    det: Dict[str, Any],
    lower_bound: float,
    upper_bound: float = DEFAULT_UPPER_BOUND,
    conf_threshold: float = DEFAULT_CONF_THRESHOLD,
    min_size: int = DEFAULT_MIN_SIZE,
    target_class: str = "cell phone",
) -> Tuple[bool, Dict[str, bool]]:
    """
    Applies confidence, aspect-ratio, and bounding-box size filters to a single raw detection.
    Returns whether the detection passes all filters, along with detailed filter status.
    """
    is_target = det.get("class_name") == target_class
    passes_conf = det.get("confidence", 0.0) >= conf_threshold
    
    aspect = det.get("aspect_ratio", 0.0)
    passes_aspect = lower_bound <= aspect <= upper_bound

    # Short side size check
    box_w = det.get("box_width")
    box_h = det.get("box_height")
    if box_w is not None and box_h is not None:
        short_side = min(box_w, box_h)
        passes_size = short_side >= min_size
    else:
        passes_size = det.get("passes_size", True)

    passes_all = is_target and passes_conf and passes_aspect and passes_size

    filter_flags = {
        "is_target": is_target,
        "passes_conf": passes_conf,
        "passes_aspect": passes_aspect,
        "passes_size": passes_size,
    }
    return passes_all, filter_flags


def evaluate_threshold_on_records(
    records: List[Dict[str, Any]],
    lower_bound: float,
    upper_bound: float = DEFAULT_UPPER_BOUND,
    conf_threshold: float = DEFAULT_CONF_THRESHOLD,
    min_size: int = DEFAULT_MIN_SIZE,
    baseline_accepted_sources: Optional[set] = None,
    target_class: str = "cell phone",
) -> Dict[str, Any]:
    """
    Evaluates a candidate lower bound threshold against a list of unique test image records.
    """
    accepted_images = []
    rejected_images = []
    newly_accepted = []

    for rec in records:
        source_name = rec.get("source", "unknown")
        raw_dets = rec.get("raw_detections", [])

        # Find passing detections for target class
        passing_dets = []
        for d in raw_dets:
            passes_all, _ = evaluate_detection_filters(
                d,
                lower_bound=lower_bound,
                upper_bound=upper_bound,
                conf_threshold=conf_threshold,
                min_size=min_size,
                target_class=target_class,
            )
            if passes_all:
                passing_dets.append(d)

        if passing_dets:
            best_det = max(passing_dets, key=lambda x: x.get("confidence", 0.0))
            detection_summary = {
                "source": source_name,
                "confidence": best_det.get("confidence"),
                "aspect_ratio": best_det.get("aspect_ratio"),
                "bbox": best_det.get("bbox"),
            }
            accepted_images.append(detection_summary)

            if baseline_accepted_sources is not None and source_name not in baseline_accepted_sources:
                newly_accepted.append(detection_summary)
        else:
            rejected_images.append(source_name)

    return {
        "lower_bound": lower_bound,
        "upper_bound": upper_bound,
        "conf_threshold": conf_threshold,
        "total_images": len(records),
        "accepted_count": len(accepted_images),
        "rejected_count": len(rejected_images),
        "acceptance_rate": round(len(accepted_images) / len(records), 4) if records else 0.0,
        "accepted_images": accepted_images,
        "rejected_images": rejected_images,
        "newly_accepted_vs_baseline": newly_accepted,
    }


def run_aspect_ratio_sweep(
    input_json_path: str = DEFAULT_INPUT_JSON,
    output_json_path: Optional[str] = DEFAULT_OUTPUT_JSON,
    candidate_bounds: Optional[List[float]] = None,
    upper_bound: float = DEFAULT_UPPER_BOUND,
    conf_threshold: float = DEFAULT_CONF_THRESHOLD,
    min_size: int = DEFAULT_MIN_SIZE,
    verbose: bool = True,
) -> Dict[str, Any]:
    """
    Executes the full Phase 0 aspect-ratio sweep experiment.
    Loads raw predictions, tests each candidate lower bound, and produces comparative analytics.
    """
    if candidate_bounds is None:
        candidate_bounds = CANDIDATE_LOWER_BOUNDS

    if not os.path.exists(input_json_path):
        raise FileNotFoundError(f"Input JSON results not found at: {input_json_path}")

    with open(input_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Extract deduplicated phone records
    phone_records = extract_unique_evaluations(data, category="phone")
    if not phone_records:
        raise ValueError(f"No phone evaluation records found in {input_json_path}")

    # 2. Determine baseline accepted sources (at lower_bound = BASELINE_LOWER_BOUND = 1.3)
    baseline_result = evaluate_threshold_on_records(
        records=phone_records,
        lower_bound=BASELINE_LOWER_BOUND,
        upper_bound=upper_bound,
        conf_threshold=conf_threshold,
        min_size=min_size,
        baseline_accepted_sources=None,
    )
    baseline_accepted_sources = {img["source"] for img in baseline_result["accepted_images"]}

    # 3. Sweep all candidate lower bounds
    sweep_results = []
    for lb in candidate_bounds:
        res = evaluate_threshold_on_records(
            records=phone_records,
            lower_bound=lb,
            upper_bound=upper_bound,
            conf_threshold=conf_threshold,
            min_size=min_size,
            baseline_accepted_sources=baseline_accepted_sources,
        )
        sweep_results.append(res)

    # 4. Synthesize final output payload
    experiment_payload = {
        "experiment_name": "Phase 0 Phone Aspect-Ratio Filter Sweep",
        "description": (
            "Parametric sweep of phone aspect-ratio lower bound against raw YOLO predictions "
            "from tests/results/latest_automated_detection_results.json."
        ),
        "source_data_file": input_json_path,
        "total_phone_test_images": len(phone_records),
        "baseline_configuration": {
            "model": "yolo11m.pt",
            "conf_threshold": conf_threshold,
            "aspect_range": [BASELINE_LOWER_BOUND, upper_bound],
            "min_size": min_size,
            "accepted_count": baseline_result["accepted_count"],
            "total_count": len(phone_records),
        },
        "negative_dataset_status": (
            "Negative test images are NOT currently available in the dataset. "
            "Precision and False Positive Rate (FPR) CANNOT be computed from this positive-only test set. "
            "Threshold relaxation recommendations remain conditional on Phase 0 negative dataset validation."
        ),
        "sweep_results": sweep_results,
    }

    # 5. Save output if requested
    if output_json_path:
        os.makedirs(os.path.dirname(output_json_path), exist_ok=True)
        with open(output_json_path, "w", encoding="utf-8") as f:
            json.dump(experiment_payload, f, indent=2)

    # 6. Console reporting
    if verbose:
        print_experiment_report(experiment_payload)

    return experiment_payload


def print_experiment_report(payload: Dict[str, Any]) -> None:
    """Formats and prints the experiment findings to stdout."""
    total = payload["total_phone_test_images"]
    base_cfg = payload["baseline_configuration"]
    print("=" * 80)
    print(" INTELLIPROCTOR OBJECT DETECTION -- PHASE 0 FILTER EXPERIMENT REPORT")
    print("=" * 80)
    print(f"Source JSON             : {payload['source_data_file']}")
    print(f"Unique Phone Images     : {total}")
    print(f"Baseline (1.3 - 2.9)    : {base_cfg['accepted_count']}/{total} accepted")
    print("-" * 80)
    print(f"{'Lower Bound':<12} | {'Accepted':<10} | {'Rejected':<10} | {'Acc. Rate':<10} | {'New Recovered vs Baseline'}")
    print("-" * 80)

    for r in payload["sweep_results"]:
        lb_str = f"{r['lower_bound']:4.2f}"
        acc_str = f"{r['accepted_count']}/{total}"
        rej_str = f"{r['rejected_count']}/{total}"
        rate_str = f"{r['acceptance_rate'] * 100:5.1f}%"
        new_count = len(r["newly_accepted_vs_baseline"])
        print(f"{lb_str:<12} | {acc_str:<10} | {rej_str:<10} | {rate_str:<10} | {new_count} newly accepted")

    print("-" * 80)
    print("DETAILED TRANSITIONS (Rejected at 1.3 -> Accepted at lower bound):")
    # Show each image that transitioned and its details
    transitions_reported = set()
    for r in payload["sweep_results"]:
        for new_item in r["newly_accepted_vs_baseline"]:
            src = new_item["source"]
            if src not in transitions_reported:
                transitions_reported.add(src)
                print(f"  * Image: {src}")
                print(f"    - Confidence   : {new_item['confidence']:.4f}")
                print(f"    - Aspect Ratio : {new_item['aspect_ratio']:.3f}")
                print(f"    - Bounding Box : {new_item['bbox']}")
                print(f"    - First accepted at lower bound <= {new_item['aspect_ratio']:.2f}")

    print("-" * 80)
    print("NOTE ON FALSE POSITIVE RATE:")
    print("  " + payload["negative_dataset_status"])
    print("=" * 80)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Phase 0 Aspect-Ratio Sweep Experiment.")
    parser.add_argument(
        "--input-json",
        default=DEFAULT_INPUT_JSON,
        help=f"Path to baseline JSON results (default: {DEFAULT_INPUT_JSON})",
    )
    parser.add_argument(
        "--output-json",
        default=DEFAULT_OUTPUT_JSON,
        help=f"Path to save experiment results JSON (default: {DEFAULT_OUTPUT_JSON})",
    )
    args = parser.parse_args()

    run_aspect_ratio_sweep(
        input_json_path=args.input_json,
        output_json_path=args.output_json,
        verbose=True,
    )
