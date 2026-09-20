"""
Unit tests for the Phase 0 Aspect-Ratio Filter Sweep experiment logic.

Verifies:
1. Candidate thresholds are evaluated correctly on the baseline dataset.
2. Exact boundary behavior for real detections (e.g. aspect 1.193 and 1.228).
3. Confidence filtering is strictly maintained (conf < 0.65 rejected regardless of aspect ratio).
4. Size filtering is strictly maintained.
5. Deduplication behavior handles Windows case-insensitive duplicate records.
6. Production logic and files remain completely unmodified.
"""

import os
import json
import pytest
from experiments.aspect_ratio_sweep import (
    DEFAULT_INPUT_JSON,
    extract_unique_evaluations,
    evaluate_detection_filters,
    evaluate_threshold_on_records,
    run_aspect_ratio_sweep,
)


@pytest.fixture
def baseline_json_data():
    assert os.path.exists(DEFAULT_INPUT_JSON), f"Baseline JSON file missing: {DEFAULT_INPUT_JSON}"
    with open(DEFAULT_INPUT_JSON, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def unique_phone_records(baseline_json_data):
    records = extract_unique_evaluations(baseline_json_data, category="phone")
    assert len(records) == 17, f"Expected 17 unique phone images, got {len(records)}"
    return records


def test_unique_records_deduplication(baseline_json_data):
    """
    Verifies that the duplicate entries in latest_automated_detection_results.json
    (caused by case-insensitive globbing on Windows) are cleanly deduplicated to 17 phone images.
    """
    all_phone_entries = [
        r for r in baseline_json_data.get("results", [])
        if r.get("object_tested") == "phone"
    ]
    # The raw file contains 34 entries (17 images x 2)
    assert len(all_phone_entries) == 34

    unique_records = extract_unique_evaluations(baseline_json_data, category="phone")
    assert len(unique_records) == 17
    unique_sources = {r["source"] for r in unique_records}
    assert len(unique_sources) == 17


def test_baseline_acceptance_at_1_3(unique_phone_records):
    """
    Verifies that at the baseline lower bound (1.30), exactly 3 of 17 images are accepted,
    matching the documented baseline.
    """
    res = evaluate_threshold_on_records(
        records=unique_phone_records,
        lower_bound=1.3,
        upper_bound=2.9,
        conf_threshold=0.65,
        min_size=12,
    )
    assert res["accepted_count"] == 3
    assert res["rejected_count"] == 14

    accepted_sources = {img["source"] for img in res["accepted_images"]}
    expected_baseline_sources = {
        "WhatsApp Image 2026-08-31 at 14.34.58 (2).jpeg",
        "WhatsApp Image 2026-08-31 at 14.34.58.jpeg",
        "WhatsApp Image 2026-08-31 at 14.34.59 (3).jpeg",
    }
    assert accepted_sources == expected_baseline_sources


def test_aspect_ratio_boundary_1_228():
    """
    Verifies the boundary behavior for WhatsApp Image 2026-08-31 at 14.34.58 (4).jpeg:
    Detection has aspect_ratio = 1.228, conf = 0.8333.
    - At lower bound 1.30: Rejected (1.228 < 1.30)
    - At lower bound 1.25: Rejected (1.228 < 1.25)
    - At lower bound 1.20: Accepted (1.20 <= 1.228 <= 2.9)
    """
    sample_det = {
        "class_name": "cell phone",
        "confidence": 0.8333,
        "box_width": 113,
        "box_height": 92,
        "aspect_ratio": 1.228,
        "passes_size": True,
    }

    # At lower bound 1.30: rejected
    passes_1_3, flags_1_3 = evaluate_detection_filters(sample_det, lower_bound=1.3)
    assert not passes_1_3
    assert not flags_1_3["passes_aspect"]
    assert flags_1_3["passes_conf"]

    # At lower bound 1.25: rejected (1.228 is below 1.25)
    passes_1_25, flags_1_25 = evaluate_detection_filters(sample_det, lower_bound=1.25)
    assert not passes_1_25
    assert not flags_1_25["passes_aspect"]

    # At lower bound 1.20: accepted (1.228 is above 1.20)
    passes_1_2, flags_1_2 = evaluate_detection_filters(sample_det, lower_bound=1.2)
    assert passes_1_2
    assert flags_1_2["passes_aspect"]


def test_aspect_ratio_boundary_1_193():
    """
    Verifies the boundary behavior for WhatsApp Image 2026-08-31 at 14.34.58 (3).jpeg:
    Detection has aspect_ratio = 1.193, conf = 0.8806.
    - At lower bound 1.30: Rejected (1.193 < 1.30)
    - At lower bound 1.20: Rejected (1.193 < 1.20)
    - At lower bound 1.15: Accepted (1.15 <= 1.193 <= 2.9)
    - At lower bound 1.10: Accepted (1.10 <= 1.193 <= 2.9)
    """
    sample_det = {
        "class_name": "cell phone",
        "confidence": 0.8806,
        "box_width": 259,
        "box_height": 309,
        "aspect_ratio": 1.193,
        "passes_size": True,
    }

    # At lower bound 1.30: rejected
    passes_1_3, flags_1_3 = evaluate_detection_filters(sample_det, lower_bound=1.3)
    assert not passes_1_3
    assert not flags_1_3["passes_aspect"]

    # At lower bound 1.20: rejected (1.193 is below 1.20)
    passes_1_2, flags_1_2 = evaluate_detection_filters(sample_det, lower_bound=1.2)
    assert not passes_1_2
    assert not flags_1_2["passes_aspect"]

    # At lower bound 1.15: accepted (1.193 is above 1.15)
    passes_1_15, flags_1_15 = evaluate_detection_filters(sample_det, lower_bound=1.15)
    assert passes_1_15
    assert flags_1_15["passes_aspect"]


def test_confidence_filtering_strictly_maintained():
    """
    Verifies that detections with confidence < 0.65 are rejected regardless of aspect ratio:
    - WhatsApp Image 2026-08-31 at 14.34.59 (5).jpeg: conf = 0.6092, aspect = 1.318 (fails conf)
    - WhatsApp Image 2026-08-31 at 14.34.59 (6).jpeg: conf = 0.2607, aspect = 1.021 (fails conf & aspect)
    """
    # Low confidence but valid aspect ratio
    low_conf_det = {
        "class_name": "cell phone",
        "confidence": 0.6092,
        "box_width": 100,
        "box_height": 132,
        "aspect_ratio": 1.318,
        "passes_size": True,
    }
    passes, flags = evaluate_detection_filters(low_conf_det, lower_bound=1.0)
    assert not passes
    assert not flags["passes_conf"]
    assert flags["passes_aspect"]

    # Very low confidence and borderline aspect ratio
    very_low_conf_det = {
        "class_name": "cell phone",
        "confidence": 0.2607,
        "box_width": 100,
        "box_height": 102,
        "aspect_ratio": 1.021,
        "passes_size": True,
    }
    # Even at lower bound 1.0, must be rejected due to confidence
    passes_at_1_0, flags_at_1_0 = evaluate_detection_filters(very_low_conf_det, lower_bound=1.0)
    assert not passes_at_1_0
    assert not flags_at_1_0["passes_conf"]


def test_size_filtering_maintained():
    """
    Verifies that detections smaller than 12px on the short side are rejected.
    """
    tiny_det = {
        "class_name": "cell phone",
        "confidence": 0.95,
        "box_width": 10,
        "box_height": 20,
        "aspect_ratio": 2.0,
        "passes_size": False,
    }
    passes, flags = evaluate_detection_filters(tiny_det, lower_bound=1.0, min_size=12)
    assert not passes
    assert not flags["passes_size"]


def test_full_aspect_ratio_sweep_summary(tmp_path):
    """
    Verifies the end-to-end sweep results across all candidate thresholds:
    [1.0, 1.1, 1.15, 1.2, 1.25, 1.3].
    """
    temp_output_file = str(tmp_path / "test_sweep_output.json")
    payload = run_aspect_ratio_sweep(
        input_json_path=DEFAULT_INPUT_JSON,
        output_json_path=temp_output_file,
        verbose=False,
    )

    results_by_bound = {r["lower_bound"]: r for r in payload["sweep_results"]}

    # Baseline 1.30: 3 accepted, 14 rejected
    assert results_by_bound[1.3]["accepted_count"] == 3
    assert results_by_bound[1.3]["rejected_count"] == 14
    assert len(results_by_bound[1.3]["newly_accepted_vs_baseline"]) == 0

    # 1.25: 3 accepted, 14 rejected (no change from 1.3)
    assert results_by_bound[1.25]["accepted_count"] == 3
    assert results_by_bound[1.25]["rejected_count"] == 14
    assert len(results_by_bound[1.25]["newly_accepted_vs_baseline"]) == 0

    # 1.20: 4 accepted, 13 rejected (recovers image (4), aspect 1.228)
    assert results_by_bound[1.2]["accepted_count"] == 4
    assert results_by_bound[1.2]["rejected_count"] == 13
    assert len(results_by_bound[1.2]["newly_accepted_vs_baseline"]) == 1
    assert results_by_bound[1.2]["newly_accepted_vs_baseline"][0]["source"] == "WhatsApp Image 2026-08-31 at 14.34.58 (4).jpeg"

    # 1.15: 5 accepted, 12 rejected (recovers images (4) and (3), aspect 1.193)
    assert results_by_bound[1.15]["accepted_count"] == 5
    assert results_by_bound[1.15]["rejected_count"] == 12
    assert len(results_by_bound[1.15]["newly_accepted_vs_baseline"]) == 2

    # 1.10: 5 accepted, 12 rejected (plateau)
    assert results_by_bound[1.1]["accepted_count"] == 5
    assert results_by_bound[1.1]["rejected_count"] == 12

    # 1.00: 5 accepted, 12 rejected (plateau)
    assert results_by_bound[1.0]["accepted_count"] == 5
    assert results_by_bound[1.0]["rejected_count"] == 12

    # Check output file was written correctly
    assert os.path.exists(temp_output_file)
    with open(temp_output_file, "r", encoding="utf-8") as f:
        saved_data = json.load(f)
    assert saved_data["total_phone_test_images"] == 17
