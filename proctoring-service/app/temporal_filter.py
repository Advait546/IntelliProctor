"""
Temporal Filtering and Persistence Engine for IntelliProctor.

This is a verbatim copy of the project root's `temporal_filter.py` (the ML
team's module), embedded here so `proctoring-service` stays a self-contained
deployable unit rather than importing across the repo's directory boundary.
Keep it in sync if the root version changes.

Provides multi-frame temporal smoothing to:
1. Filter out transient single-frame false positives (e.g., fleeting hand motions, momentary lighting glares).
2. Stabilize alert signals for sustained prohibited objects (e.g., candidate using a phone or book).
3. Prevent alert flickering via hysteresis debouncing.

Components:
- SlidingWindowFilter: k-of-N rolling window detection density.
- HysteresisDebounceFilter: Stateful activation/deactivation delay.
- TemporalProctoringManager: Multi-class temporal state manager for live video streams.
"""

from collections import deque
from typing import Dict, List, Any, Optional


class SlidingWindowFilter:
    """
    Sliding window temporal filter.
    Maintains a rolling buffer of the last N frames.
    Triggers alert only when positive detections >= k out of N frames.
    """
    def __init__(self, window_size: int = 5, min_hits: int = 3):
        if min_hits > window_size:
            raise ValueError(f"min_hits ({min_hits}) cannot exceed window_size ({window_size})")
        self.window_size = window_size
        self.min_hits = min_hits
        self.buffer = deque(maxlen=window_size)

    def update(self, detected: bool) -> bool:
        self.buffer.append(1 if detected else 0)
        hits = sum(self.buffer)
        return hits >= self.min_hits

    @property
    def density(self) -> float:
        if not self.buffer:
            return 0.0
        return sum(self.buffer) / len(self.buffer)

    def reset(self):
        self.buffer.clear()


class HysteresisDebounceFilter:
    """
    Stateful hysteresis debouncing filter.
    - Requires `on_threshold` consecutive positive frames to switch alert ON.
    - Requires `off_threshold` consecutive negative frames to switch alert OFF.
    """
    def __init__(self, on_threshold: int = 3, off_threshold: int = 5):
        self.on_threshold = on_threshold
        self.off_threshold = off_threshold
        self.is_active = False
        self.positive_streak = 0
        self.negative_streak = 0

    def update(self, detected: bool) -> bool:
        if detected:
            self.positive_streak += 1
            self.negative_streak = 0
            if not self.is_active and self.positive_streak >= self.on_threshold:
                self.is_active = True
        else:
            self.negative_streak += 1
            self.positive_streak = 0
            if self.is_active and self.negative_streak >= self.off_threshold:
                self.is_active = False

        return self.is_active

    def reset(self):
        self.is_active = False
        self.positive_streak = 0
        self.negative_streak = 0


class TemporalProctoringManager:
    """
    Coordinates temporal filtering across multiple prohibited object categories
    (e.g., 'phone', 'book') for webcam frame processing.
    """
    def __init__(
        self,
        categories: List[str] = None,
        filter_type: str = "hysteresis",
        window_size: int = 5,
        min_hits: int = 3,
        on_threshold: int = 3,
        off_threshold: int = 5,
    ):
        if categories is None:
            categories = ["phone", "book"]
        self.categories = categories
        self.filter_type = filter_type.lower()
        self.filters = {}

        for cat in self.categories:
            if self.filter_type == "window":
                self.filters[cat] = SlidingWindowFilter(window_size=window_size, min_hits=min_hits)
            else:
                self.filters[cat] = HysteresisDebounceFilter(on_threshold=on_threshold, off_threshold=off_threshold)

    def update(self, raw_counts: Dict[str, int]) -> Dict[str, bool]:
        """
        Updates each category filter with raw frame detection counts.
        Returns dict mapping category -> temporal_alert_active (bool).
        """
        alerts = {}
        for cat, flt in self.filters.items():
            has_detection = raw_counts.get(cat, 0) > 0
            alerts[cat] = flt.update(has_detection)
        return alerts

    def reset(self):
        for flt in self.filters.values():
            flt.reset()
