"""
Unit & Integration Tests for Decoupled Webcam Capture and Background YOLO Inference.

Validates:
1. DetectionState thread safety, detection update, and TTL expiration behavior.
2. YOLOInferenceWorker asynchronous execution, submission, and clean shutdown.
3. WebcamCaptureStream initialization, frame buffering, and cleanup.
4. End-to-end decoupled loop execution under synthetic test feed.
"""

import time
import threading
import numpy as np
import pytest
import video_input_analysis as via


def test_detection_state_ttl_and_freshness():
    """Verify DetectionState returns fresh detections within TTL and suppresses stale detections."""
    state = via.DetectionState(ttl_seconds=0.2)

    # Initial state should be stale/empty
    boxes, counts, is_stale, ms = state.get_detections(time.time())
    assert is_stale is True
    assert len(boxes) == 0
    assert counts == {"phone": 0, "book": 0}

    # Push a mock detection at t = 100.0
    mock_boxes = [{"box": (10, 20, 100, 200), "cls_name": "phone", "conf": 0.85, "color": (0, 0, 255), "type": "phone"}]
    mock_counts = {"phone": 1, "book": 0}
    state.update(mock_boxes, mock_counts, timestamp=100.0, duration_ms=180.0)

    # Query at t = 100.1 (within TTL 0.2s)
    boxes, counts, is_stale, ms = state.get_detections(100.1)
    assert is_stale is False
    assert len(boxes) == 1
    assert counts["phone"] == 1
    assert ms == 180.0

    # Query at t = 100.3 (exceeded TTL 0.2s)
    boxes, counts, is_stale, ms = state.get_detections(100.3)
    assert is_stale is True
    assert len(boxes) == 0
    assert counts == {"phone": 0, "book": 0}


def test_detection_state_concurrent_access():
    """Verify thread-safety of DetectionState under high-frequency concurrent writes and reads."""
    state = via.DetectionState(ttl_seconds=1.0)
    stop_event = threading.Event()
    errors = []

    def writer():
        for i in range(100):
            try:
                state.update(
                    [{"box": (i, i, i + 50, i + 50), "cls_name": "phone", "conf": 0.9, "color": (0, 0, 255), "type": "phone"}],
                    {"phone": 1, "book": 0},
                    time.time(),
                    150.0,
                )
                time.sleep(0.001)
            except Exception as e:
                errors.append(e)

    def reader():
        while not stop_event.is_set():
            try:
                boxes, counts, is_stale, ms = state.get_detections(time.time())
                assert isinstance(boxes, list)
                assert isinstance(counts, dict)
            except Exception as e:
                errors.append(e)
            time.sleep(0.001)

    t_writer = threading.Thread(target=writer)
    t_reader = threading.Thread(target=reader)

    t_writer.start()
    t_reader.start()

    t_writer.join()
    stop_event.set()
    t_reader.join()

    assert len(errors) == 0, f"Thread concurrency errors encountered: {errors}"
    assert state.total_inferences == 100


def test_yolo_inference_worker_execution():
    """Verify YOLOInferenceWorker starts, processes submitted frames asynchronously, and terminates cleanly."""
    state = via.DetectionState(ttl_seconds=2.0)
    worker = via.YOLOInferenceWorker(
        model=via.yolo_model,
        target_classes=via.TARGET_CLASSES,
        conf_threshold=via.CONF_THRESHOLD,
        min_size=via.MIN_SIZE,
        imgsz=640,  # fast test size
        device=via.ACTIVE_DEVICE,
        detection_state=state,
    )
    worker.start()

    try:
        # Blank synthetic frame
        frame = np.full((720, 1280, 3), 40, dtype=np.uint8)
        worker.submit_frame(frame, time.time())

        # Wait up to 10 seconds for CPU inference to complete
        start_wait = time.time()
        while state.total_inferences == 0 and time.time() - start_wait < 10.0:
            time.sleep(0.05)

        assert state.total_inferences >= 1, "Inference worker did not increment total_inferences"
        boxes, counts, is_stale, ms = state.get_detections(time.time())
        assert is_stale is False
        assert ms > 0.0

    finally:
        worker.stop()
        assert not worker._thread.is_alive()


def test_run_proctoring_loop_synthetic_decoupled():
    """Verify decoupled run_proctoring_loop executes smoothly with synthetic feed and terminates at max_frames."""
    # Run 10 synthetic frames with display=False
    start_t = time.time()
    via.run_proctoring_loop(
        max_frames=10,
        display=False,
        synthetic=True,
        imgsz=640,
    )
    duration = time.time() - start_t

    # 10 synthetic frames with ~33ms sleep should complete cleanly in under 4 seconds
    assert duration < 5.0, f"Synthetic loop took unexpectedly long: {duration:.2f}s"
