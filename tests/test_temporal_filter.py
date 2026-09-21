"""
Unit tests for Temporal Filtering and Debounce Engine (temporal_filter.py).
"""

import pytest
from temporal_filter import (
    SlidingWindowFilter,
    HysteresisDebounceFilter,
    TemporalProctoringManager,
    simulate_temporal_rejection,
)


def test_sliding_window_transient_suppression():
    """Verifies that transient detections (< min_hits) are rejected."""
    window = SlidingWindowFilter(window_size=5, min_hits=3)
    
    # 2 isolated hits out of 5 frames
    assert not window.update(True)
    assert not window.update(True)
    assert not window.update(False)
    assert not window.update(False)
    assert not window.update(False)
    assert window.density == 0.4  # 2 of 5 frames positive, below min_hits=3


def test_sliding_window_sustained_activation():
    """Verifies that sustained detections (>= min_hits) trigger an alert."""
    window = SlidingWindowFilter(window_size=5, min_hits=3)
    assert not window.update(True)
    assert not window.update(True)
    assert window.update(True)   # 3rd hit triggers alert
    assert window.update(False)  # 3 of 4 frames positive (0.75) -> still active
    assert window.density == 0.75
    assert window.update(False)  # 3 of 5 frames positive (0.60) -> still active
    assert window.density == 0.60


def test_hysteresis_debounce_activation_and_deactivation():
    """
    Verifies hysteresis on/off state transitions:
    - Requires on_threshold consecutive frames to activate.
    - Requires off_threshold consecutive negative frames to deactivate.
    """
    debouncer = HysteresisDebounceFilter(on_threshold=3, off_threshold=4)

    # 1. Fleeting false alarm (2 frames) -> Must NOT activate
    assert not debouncer.update(True)
    assert not debouncer.update(True)
    assert not debouncer.update(False)  # Resets positive streak
    assert not debouncer.is_active

    # 2. Sustained detection (3 consecutive frames) -> Must activate
    assert not debouncer.update(True)
    assert not debouncer.update(True)
    assert debouncer.update(True)       # 3rd consecutive -> Turns ON
    assert debouncer.is_active

    # 3. Momentary occlusion (2 frames) while active -> Must STAY active
    assert debouncer.update(False)
    assert debouncer.update(False)
    assert debouncer.is_active

    # 4. Sustained negative (4 consecutive frames) -> Must deactivate
    debouncer.reset()
    # activate again
    for _ in range(3):
        debouncer.update(True)
    assert debouncer.is_active
    
    # 4 negative frames to turn off
    assert debouncer.update(False)
    assert debouncer.update(False)
    assert debouncer.update(False)
    assert not debouncer.update(False)  # 4th negative -> Turns OFF
    assert not debouncer.is_active


def test_temporal_proctoring_manager():
    """Verifies multi-category manager coordinates independent alert streams."""
    mgr = TemporalProctoringManager(
        categories=["phone", "book"],
        filter_type="hysteresis",
        on_threshold=2,
        off_threshold=3,
    )

    # Phone detected for 2 frames, book for 0
    res1 = mgr.update({"phone": 1, "book": 0})
    assert not res1["phone"]
    assert not res1["book"]

    res2 = mgr.update({"phone": 1, "book": 0})
    assert res2["phone"]  # Activated
    assert not res2["book"]


def test_simulation_suppresses_transient_spikes():
    """Verifies 100% transient spike suppression in simulation."""
    # 5 normal frames, 1 spike, 5 normal frames
    stream = [False, False, False, False, False, True, False, False, False, False]
    sim = simulate_temporal_rejection(stream, filter_type="hysteresis", on_thresh=2)
    assert sim["raw_positives"] == 1
    assert sim["filtered_positives"] == 0
    assert sim["suppressed_frames"] == 1
