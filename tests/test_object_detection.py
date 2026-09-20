"""
Pytest suite evaluating YOLO object detection pipeline from video_input_analysis.py.

IMPORTANT:
- Does NOT modify video_input_analysis.py.
- Uses exact YOLO model (yolo11m.pt), confidence threshold (0.65), target classes,
  aspect ratio filters, and bounding box size filters.
- Never fabricates test results. If no test image is found in tests/test_data/<category>/,
  the test is SKIPPED with a clear reason.
- Automatically stores CSV and JSON results in tests/results/.
"""

import datetime
import os
import glob
import pytest
from tests.detector_evaluator import (
    ObjectDetectionEvaluator,
    ResultsStorageManager,
    CATEGORY_EXPECTED_TARGET,
)

TEST_DATA_DIR = "tests/test_data"
RESULTS_DIR = "tests/results"
IMAGE_EXTENSIONS = ("*.jpg", "*.jpeg", "*.png", "*.webp", "*.bmp")

CATEGORIES = [
    "phone",
    "book",
    "smartwatch",
    "laptop",
    "tablet",
    "calculator",
    "notebook",
    "pen",
    "water_bottle",
    "headphones",
    "other",
]

# Shared accumulator for test records created during test run
_accumulated_test_results = []
_evaluator_instance = None


def get_evaluator():
    global _evaluator_instance
    if _evaluator_instance is None:
        _evaluator_instance = ObjectDetectionEvaluator("yolo11m.pt")
    return _evaluator_instance


@pytest.fixture(scope="session", autouse=True)
def save_results_on_finish():
    """Session fixture to automatically save CSV and JSON test results upon completion."""
    yield
    storage = ResultsStorageManager(RESULTS_DIR)
    if _accumulated_test_results:
        saved_paths = storage.save_results(_accumulated_test_results, session_prefix="automated_detection_results")
        print("\n" + "=" * 60)
        print(" AUTOMATED TEST RESULTS STORED SUCCESSFULLY")
        print(f" CSV Report  : {saved_paths['csv_path']}")
        print(f" JSON Report : {saved_paths['json_path']}")
        print("=" * 60)


def find_category_images(category: str):
    cat_dir = os.path.join(TEST_DATA_DIR, category)
    if not os.path.isdir(cat_dir):
        return []
    images = []
    for ext in IMAGE_EXTENSIONS:
        images.extend(glob.glob(os.path.join(cat_dir, ext)))
        images.extend(glob.glob(os.path.join(cat_dir, ext.upper())))
    return sorted(images)


@pytest.mark.parametrize("category", CATEGORIES)
def test_category_object_detection(category: str):
    """
    Automated image test for each category.
    Runs exact YOLO + filtering pipeline from video_input_analysis.py.
    """
    image_paths = find_category_images(category)
    expected_class = CATEGORY_EXPECTED_TARGET.get(category, "none")

    if not image_paths:
        skip_reason = f"No test images found for category '{category}' in {TEST_DATA_DIR}/{category}/"
        skipped_record = {
            "timestamp": datetime.datetime.now().isoformat(),
            "object_tested": category,
            "source": f"{TEST_DATA_DIR}/{category}/",
            "expected_class": expected_class,
            "yolo_predicted_class": "N/A",
            "confidence": "N/A",
            "bounding_box": "N/A",
            "aspect_ratio": "N/A",
            "accepted_by_filters": False,
            "status": "SKIPPED",
            "reason": skip_reason,
            "manual_mark": "N/A",
        }
        _accumulated_test_results.append(skipped_record)
        pytest.skip(skip_reason)

    evaluator = get_evaluator()
    category_failed = False
    failure_messages = []

    for img_path in image_paths:
        result = evaluator.evaluate_image_file(img_path, category=category)
        _accumulated_test_results.append(result)

        if result["status"] == "FAIL":
            category_failed = True
            failure_messages.append(f"{os.path.basename(img_path)}: {result['reason']}")

    assert not category_failed, f"Detection evaluation failed for category '{category}':\n" + "\n".join(failure_messages)


@pytest.mark.webcam
def test_live_webcam(request):
    """
    Optional live webcam test.
    Skipped by default unless --live-webcam flag is provided to pytest.
    """
    if not request.config.getoption("--live-webcam"):
        skip_msg = ("Live webcam test requires a physical webcam and interactive input. "
                    "Skipped by default. Run pytest with --live-webcam or run "
                    "'python tests/run_live_webcam_test.py' directly.")
        pytest.skip(skip_msg)

    from tests.run_live_webcam_test import run_interactive_webcam_test
    print("\nStarting live interactive webcam test...")
    records = run_interactive_webcam_test()
    _accumulated_test_results.extend(records)
    assert len(records) > 0, "No live test records were recorded."
