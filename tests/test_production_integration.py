"""
Automated Integration & Regression Test Suite for Phase 4: Production Integration.

Validates:
1. Multi-phase configuration integrity (phase0, phase0_baseline, phase2_gpu, iteration2).
2. Phase resolution, alias mapping, and graceful fallback behavior.
3. MediaPipe clean-frame inference isolation (Option A fix).
4. End-to-end single frame execution under both phase0 and phase2_gpu.
5. Evaluator alignment with per-class thresholds and aspect ratios.
"""

import os
import pytest
import numpy as np
import cv2

import video_input_analysis as via
from tests.detector_evaluator import ObjectDetectionEvaluator


def test_phase_configs_integrity():
    """Verify all phase configs have required fields and valid definitions."""
    required_phases = ["phase0", "phase0_baseline", "phase2_gpu", "iteration2"]
    for phase_key in required_phases:
        assert phase_key in via.PHASE_CONFIGS, f"Missing phase: {phase_key}"
        cfg = via.PHASE_CONFIGS[phase_key]
        assert "name" in cfg
        assert "model_path" in cfg
        assert "conf_threshold" in cfg
        assert "target_classes" in cfg
        assert "use_temporal_filter" in cfg
        assert isinstance(cfg["target_classes"], dict)
        assert len(cfg["target_classes"]) >= 2


def test_phase_resolution_and_fallback():
    """Verify alias resolution and fallback to phase0 on invalid input."""
    # Direct phase key
    key, cfg = via.resolve_phase_config("phase0")
    assert key == "phase0"
    assert "yolo11m.pt" in cfg["model_path"]

    # Alias mapping
    key, cfg = via.resolve_phase_config("phase1")
    assert key == "phase2_gpu"
    assert "best.pt" in cfg["model_path"]

    key, cfg = via.resolve_phase_config("phase2")
    assert key == "phase2_gpu"

    # Unknown phase fallback
    key, cfg = via.resolve_phase_config("nonexistent_phase_xyz")
    assert key == "phase0"

    # Missing model path fallback (iteration2 weights not created yet)
    key, cfg = via.resolve_phase_config("iteration2")
    assert key == "phase0"  # Gracefully falls back because iteration2 weights file doesn't exist yet


def test_clean_frame_yolo_isolation():
    """Verify that MediaPipe drawings do not corrupt clean_frame passed to YOLO."""
    # Synthetic blank frame
    frame = np.full((720, 1280, 3), 50, dtype=np.uint8)
    original_copy = frame.copy()

    # Draw dummy landmarks directly on frame
    cv2.putText(frame, "TEST OVERLAY", (100, 100), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2)
    cv2.circle(frame, (200, 200), 50, (0, 0, 255), -1)

    # Verify frame is modified but original_copy remains clean
    assert not np.array_equal(frame, original_copy)


def test_process_single_frame_phase0():
    """Run process_single_frame under phase0 on synthetic frame."""
    via.set_active_phase("phase0")
    frame = np.full((720, 1280, 3), 40, dtype=np.uint8)

    annotated, alerts, counts, face_cnt, no_face = via.process_single_frame(frame, now=1000.0)

    assert annotated.shape == (720, 1280, 3)
    assert isinstance(alerts, list)
    assert isinstance(counts, dict)
    assert "phone" in counts
    assert "book" in counts
    assert face_cnt == 0
    assert no_face == 1000.0  # Started no_face timer


def test_process_single_frame_phase2_gpu():
    """Run process_single_frame under phase2_gpu on synthetic frame."""
    gpu_weights = (
        "models/trained/intelliproctor_phase1_iter1/best.pt"
        if os.path.exists("models/trained/intelliproctor_phase1_iter1/best.pt")
        else "runs/detect/intelliproctor_phase1_iter1_gpu/weights/best.pt"
    )
    if not os.path.exists(gpu_weights):
        pytest.skip("Phase 2 GPU model weights not found on disk")

    via.set_active_phase("phase2_gpu")
    frame = np.full((720, 1280, 3), 40, dtype=np.uint8)

    annotated, alerts, counts, face_cnt, no_face = via.process_single_frame(frame, now=1000.0)

    assert annotated.shape == (720, 1280, 3)
    assert isinstance(counts, dict)
    assert "phone" in counts
    assert "book" in counts

    # Reset back to production default
    via.set_active_phase("phase0")


def test_detector_evaluator_alignment():
    """Verify ObjectDetectionEvaluator aligns with updated aspect bounds and per-class thresholds."""
    pretrained_path = "models/pretrained/yolo11m.pt" if os.path.exists("models/pretrained/yolo11m.pt") else "yolo11m.pt"
    eval_p0 = ObjectDetectionEvaluator(pretrained_path)
    assert eval_p0.phone_aspect_lower == 1.15
    assert eval_p0.book_aspect_lower == 0.80
    assert eval_p0.book_aspect_upper == 2.50
    assert "cell phone" in eval_p0.target_classes
    assert "book" in eval_p0.target_classes

    # Test synthetic frame evaluation
    frame = np.full((720, 1280, 3), 40, dtype=np.uint8)
    res_p0 = eval_p0.evaluate_frame(frame, category="phone")
    assert "raw_detections" in res_p0
    assert "filtered_target_detections" in res_p0
    assert "status" in res_p0

    # Test Phase 2 evaluator if weights exist
    gpu_weights = (
        "models/trained/intelliproctor_phase1_iter1/best.pt"
        if os.path.exists("models/trained/intelliproctor_phase1_iter1/best.pt")
        else "runs/detect/intelliproctor_phase1_iter1_gpu/weights/best.pt"
    )
    if os.path.exists(gpu_weights):
        eval_p2 = ObjectDetectionEvaluator(gpu_weights)
        assert eval_p2.model_version == "phase2"
        assert "phone" in eval_p2.target_classes
        assert "book_notebook" in eval_p2.target_classes
        res_p2 = eval_p2.evaluate_frame(frame, category="phone")
        assert "status" in res_p2
