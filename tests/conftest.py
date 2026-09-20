import pytest

def pytest_addoption(parser):
    parser.addoption(
        "--live-webcam",
        action="store_true",
        default=False,
        help="Run interactive live webcam test during pytest execution"
    )

def pytest_configure(config):
    config.addinivalue_line("markers", "webcam: mark test as requiring a physical webcam")
