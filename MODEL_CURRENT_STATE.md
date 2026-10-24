# IntelliProctor — Computer Vision & Model Current State Audit

> **Document Version**: 1.0.0  
> **Repository Root**: [`c:\Users\tanis\IntelliProctor`](file:///c:/Users/tanis/IntelliProctor)  
> **Companion Documents**: Root [`README.md`](file:///c:/Users/tanis/IntelliProctor/README.md), Target Specification [`MODEL_ARCHITECTURE.md`](file:///c:/Users/tanis/IntelliProctor/MODEL_ARCHITECTURE.md), [`BACKEND_ARCHITECTURE.md`](file:///c:/Users/tanis/IntelliProctor/BACKEND_ARCHITECTURE.md), and [`FRONTEND_ARCHITECTURE.md`](file:///c:/Users/tanis/IntelliProctor/FRONTEND_ARCHITECTURE.md).  
> **Audit Date**: October 2026  
> **Status**: **VERIFIED REPOSITORY AUDIT** (Factual inventory of current model files, inference scripts, training/evaluation artifacts, and computer-vision integration gaps).

---

## Table of Contents

1. [Purpose & Audit Boundaries](#1-purpose--audit-boundaries)
2. [Model & Checkpoint Inventory](#2-model--checkpoint-inventory)
3. [Current YOLO Object-Detection Implementation](#3-current-yolo-object-detection-implementation)
   - [3.1 Model Loading & Inference Pipeline](#31-model-loading--inference-pipeline)
   - [3.2 Decoupled Capture & Asynchronous Worker Architecture](#32-decoupled-capture--asynchronous-worker-architecture)
   - [3.3 Clean-Frame Overlay Isolation](#33-clean-frame-overlay-isolation)
4. [Current Class Definitions & Allowed-Object Handling](#4-current-class-definitions--allowed-object-handling)
5. [Current Inference Parameters & Hardware Configuration](#5-current-inference-parameters--hardware-configuration)
6. [Current MediaPipe Facial-Landmark & Head-Pose Implementation](#6-current-mediapipe-facial-landmark--head-pose-implementation)
   - [6.1 Landmark Extraction & Generic 3D Reference Model](#61-landmark-extraction--generic-3d-reference-model)
   - [6.2 Perspective-n-Point Pose Solver & Euler Angles](#62-perspective-n-point-pose-solver--euler-angles)
   - [6.3 Existing Neutral Thresholds & Sideways-Turn Gap](#63-existing-neutral-thresholds--sideways-turn-gap)
7. [Detailed Code Analysis of `video_input_analysis.py`](#7-detailed-code-analysis-of-video_input_analysispy)
8. [Current Event Generation & Temporal Aggregation](#8-current-event-generation--temporal-aggregation)
9. [Current Computer-Vision-to-Backend Integration](#9-current-computer-vision-to-backend-integration)
10. [Current Examiner-Side Experience](#10-current-examiner-side-experience)
11. [Current Examinee-Side Experience](#11-current-examinee-side-experience)
    - [11.1 Official Examination Experience](#111-official-examination-experience)
    - [11.2 Practice Examination Experience](#112-practice-examination-experience)
12. [Current Suspicion-Scoring Boundary](#12-current-suspicion-scoring-boundary)
13. [Current Model Quality, Benchmark Metrics, & Evaluation Artifacts](#13-current-model-quality-benchmark-metrics--evaluation-artifacts)
    - [13.1 Phase 0 Pre-Trained Baseline Performance](#131-phase-0-pre-trained-baseline-performance)
    - [13.2 Training Iteration 1 Evaluation & Overfitting Audit](#132-training-iteration-1-evaluation--overfitting-audit)
    - [13.3 Phase 3 Post-Processing Sweep Findings](#133-phase-3-post-processing-sweep-findings)
    - [13.4 Dataset Iteration 2 Readiness Analysis](#134-dataset-iteration-2-readiness-analysis)
14. [Model Implementation-Gap Matrix](#14-model-implementation-gap-matrix)
15. [Recommended Model Implementation Roadmap](#15-recommended-model-implementation-roadmap)
16. [Verification Record & Test Execution Summary](#16-verification-record--test-execution-summary)
17. [Guidance for Future Model Engineers](#17-guidance-for-future-model-engineers)

---

## 1. Purpose & Audit Boundaries

This document provides a factual, evidence-backed technical audit of the computer-vision, machine-learning, and model assets currently present in the **IntelliProctor** repository.

While [`MODEL_ARCHITECTURE.md`](file:///c:/Users/tanis/IntelliProctor/MODEL_ARCHITECTURE.md) establishes the target vision specification for future engineering, this audit answers:

> **What model weights exist on disk, which checkpoint is actively executed, how does `video_input_analysis.py` work, what evaluation data is verified, and what architectural disconnects currently isolate the computer-vision pipeline from the backend and frontend?**

### Audit Classification Labels
Every finding, script, checkpoint, and data pipeline is classified using strict repository-verified labels:
- **`Implemented and verified`**: Code or model artifacts exist, have been inspected directly, and have been validated through static analysis or test execution.
- **`Partially implemented`**: Components exist in working order (e.g., local OpenCV inference), but integration with upstream web or backend layers is missing.
- **`Placeholder/mock`**: Values are simulated or hardcoded (e.g., frontend risk scores or simulated proctoring alerts).
- **`Planned`**: Required by target architecture but completely unwritten in repository source code.
- **`Needs verification`**: Code exists but lacks execution logs or dependencies to establish runtime validity.

> [!CAUTION]
> **Strict Non-Modification Boundary**: This audit is strictly observational. No model checkpoints were altered, no training runs were initiated, no inference thresholds were modified, and no application code was refactored.

---

## 2. Model & Checkpoint Inventory

A comprehensive inspection of the repository reveals the following verified model artifacts, weights files, dataset configurations, and evaluation logs:

| Artifact Name | Exact File Path | Checkpoint Type & Phase | Model Architecture | Verified Size | Operational Role & Status |
|---|---|---|---|:---:|---|
| **YOLO11m Baseline** | [`models/pretrained/yolo11m.pt`](file:///c:/Users/tanis/IntelliProctor/models/pretrained/yolo11m.pt) | Pre-trained COCO (Phase 0) | Ultralytics YOLO11m | 40.5 MB (40,577,132 B) | **ACTIVE PRODUCTION MODEL** (`Implemented and verified`) |
| **Iteration 1 Best** | [`models/trained/intelliproctor_phase1_iter1/best.pt`](file:///c:/Users/tanis/IntelliProctor/models/trained/intelliproctor_phase1_iter1/best.pt) | Fine-Tuned Custom (Phase 1/2) | YOLO11m (2 classes) | 40.5 MB (40,577,132 B) | **QUARANTINED / DO NOT DEPLOY** (47.9% negative FPR) |
| **Iteration 1 Last** | `models/trained/intelliproctor_phase1_iter1/last.pt` | Fine-Tuned (Epoch 29) | YOLO11m (2 classes) | 40.5 MB (40,577,132 B) | Checkpoint at early-stopping termination (`Implemented and verified`) |
| **MediaPipe FaceMesh**| [`face_landmarker.task`](file:///c:/Users/tanis/IntelliProctor/face_landmarker.task) | MediaPipe Vision Task | FaceLandmarker Bundle | 3.7 MB (3,758,596 B) | MediaPipe landmark tracking binary (`Implemented and verified`) |
| **Iteration 1 Config**| [`models/trained/intelliproctor_phase1_iter1/args.yaml`](file:///c:/Users/tanis/IntelliProctor/models/trained/intelliproctor_phase1_iter1/args.yaml) | Training Configuration | YAML | 2.1 KB | Training hyperparameters for Iteration 1 (`Implemented and verified`) |
| **Iteration 1 Summary**| [`models/trained/intelliproctor_phase1_iter1/training_summary.json`](file:///c:/Users/tanis/IntelliProctor/models/trained/intelliproctor_phase1_iter1/training_summary.json) | Training Metrics Log | JSON | 1.2 KB | Epoch losses, best mAP50 (0.7825) (`Implemented and verified`) |
| **Dataset Iteration 2**| [`Dataset_it2/data.yaml`](file:///c:/Users/tanis/IntelliProctor/Dataset_it2/data.yaml) | Dataset Configuration | YAML | 201 B | 377 images (152 hard negatives); ready for Iteration 2 (`Implemented and verified`) |
| **Iteration 2 Weights**| `models/trained/intelliproctor_phase2_iter2/weights/best.pt` | Target Training Checkpoint | YOLO11m | *Not Yet Trained* | Pre-wired configuration placeholder (`Planned`) |

---

## 3. Current YOLO Object-Detection Implementation

### 3.1 Model Loading & Inference Pipeline

The object-detection pipeline is implemented in [`video_input_analysis.py`](file:///c:/Users/tanis/IntelliProctor/video_input_analysis.py):
- **Model Loader**: Line 183 executes `yolo_model = YOLO(MODEL_PATH)`.
- **Phase Resolution**: Lines 105–127 define `resolve_phase_config()`. The active phase is resolved via `os.environ.get("INTELLIPROCTOR_PHASE", "phase0")` or CLI flag `--phase`.
- **Active Phase**: The default configuration is **`phase0`** (`"Phase 0 (Optimized Production Baseline)"`).
- **Target Checkpoint**: Loads `models/pretrained/yolo11m.pt`.
- **Active Target Classes**:
  ```python
  # Excerpt from video_input_analysis.py (Lines 66-69)
  "target_classes": {
      "cell phone": {"type": "phone", "conf_threshold": 0.65, "aspect_range": (1.15, 2.9), "color": (0, 0, 255)},
      "book":       {"type": "book",  "conf_threshold": 0.65, "aspect_range": (0.80, 2.50), "color": (0, 165, 255)},
  }
  ```
- **Forward Pass**: Executed in line 644 via `results = self.model(frame_to_process, imgsz=self.imgsz, device=self.device, verbose=False)[0]`.
- **Image Resolution**: Defaults to `imgsz = 1280`.

### 3.2 Decoupled Capture & Asynchronous Worker Architecture

In previous revisions, running YOLO inference directly inside the camera capture loop caused webcam frame rates to collapse to ~1 FPS on CPU hardware. The current codebase implements a **decoupled multithreaded architecture**:

1. **`WebcamCaptureStream` (Lines 463–537)**:
   - Dedicated daemon thread `WebcamCaptureThread`.
   - Opens camera via `cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)` on Windows.
   - Enforces `CAP_PROP_BUFFERSIZE = 1` to prevent stale frame queuing in driver buffers.
   - Thread-safe latest-frame buffer protected by `threading.Lock`.
2. **`DetectionState` Container (Lines 539–570)**:
   - Holds latest bounding boxes, prohibited counts, timestamp, duration, and inference count.
   - Enforces a **1.5-second TTL (Time-To-Live)**: if no new inference result arrives within 1.5 seconds, detections are flagged as stale (`is_stale = True`) and cleared to eliminate ghost bounding boxes.
3. **`YOLOInferenceWorker` (Lines 572–698)**:
   - Dedicated background daemon thread `YOLOInferenceWorker`.
   - Drains the newest submitted clean frame, executes YOLO inference, applies aspect ratio and size filtering, and updates `DetectionState`.
   - Single-item work queue: if the worker is busy, intermediate frames are dropped without buffering latency.

### 3.3 Clean-Frame Overlay Isolation

A subtle but severe confound discovered during Phase 0 was that rendering MediaPipe FaceMesh wireframes on the video frame *before* passing it to YOLO caused YOLO's convolutional filters to mistake the green landmark lines for printed text or edge clutter.

- **Confound Fix (Lines 336–338, 781)**:
  `video_input_analysis.py` captures an unmodified clean copy:
  ```python
  clean_frame = frame.copy()
  worker.submit_frame(clean_frame, now)
  ```
- All MediaPipe landmark tesselation and contour drawings are rendered exclusively on the display frame, ensuring the YOLO model receives pure, uncorrupted pixel data. Verified by automated test `test_clean_frame_yolo_isolation` in [`tests/test_production_integration.py`](file:///c:/Users/tanis/IntelliProctor/tests/test_production_integration.py).

---

## 4. Current Class Definitions & Allowed-Object Handling

### Active Production Class Vocabulary (`phase0`)
In `phase0`, the model uses standard COCO 80-class weights:
- **`cell phone` (COCO Class ID 67)**: Filtered with confidence $\ge 0.65$ and aspect ratio $[1.15, 2.90]$.
- **`book` (COCO Class ID 73)**: Filtered with confidence $\ge 0.65$ and aspect ratio $[0.80, 2.50]$.
- **All other 78 COCO classes**: Explicitly filtered out by `if cls_name not in self.target_classes: continue` (line 655).

### Allowed Objects Handling
- In the active Phase 0 baseline, ordinary objects (pens, pencils, chairs, desks, water bottles) are ignored because they do not match `cell phone` or `book` above the $0.65$ threshold.
- However, laptops, computer monitors, and tablets frequently exhibit rectangular screens or keyboards that can trigger low-to-medium confidence activations.
- **Geometric Filtering Protection**:
  - The phone aspect ratio filter ($1.15 \le AR \le 2.90$) successfully rejects square laptop screens and smartwatch displays.
  - The book aspect ratio filter ($0.80 \le AR \le 2.50$) successfully rejects thin pen shafts, cables, and horizontal desk edges.
  - Size filter `MIN_SIZE = 12` rejects microscopic pixel noise.

---

## 5. Current Inference Parameters & Hardware Configuration

The table below documents the verified inference parameters in `video_input_analysis.py`:

| Parameter | Configuration Key / Variable | Hardcoded vs. Configurable | Verified Current Value | Source Location |
|---|---|---|:---:|---|
| **Active Phase** | `CURRENT_PHASE` | Configurable (`--phase` / env `INTELLIPROCTOR_PHASE`) | `"phase0"` | Line 181 |
| **Model Weights** | `MODEL_PATH` | Derived from active phase | `"models/pretrained/yolo11m.pt"` | Line 182 |
| **Inference Image Size** | `IMG_SIZE` | Configurable (`--imgsz`) | `1280` | Line 186 |
| **Global Confidence Threshold**| `CONF_THRESHOLD`| Derived from active phase | `0.65` | Line 184 |
| **Minimum Object Dimension** | `MIN_SIZE` | Hardcoded in phase config | `12` pixels | Line 185 |
| **NMS IoU Threshold** | Ultralytics internal default | Library default | `0.45` | Ultralytics YOLO |
| **Temporal Filter Activation** | `on_threshold` | Hardcoded in `temporal_manager` | `3` consecutive frames | Line 193 |
| **Temporal Filter Clear** | `off_threshold` | Hardcoded in `temporal_manager` | `4` consecutive frames | Line 194 |
| **No-Face Absence Delay** | `NO_FACE_ALERT_SECONDS` | Hardcoded constant | `10` seconds | Line 197 |
| **Head Yaw Neutral Bound** | `YAW_LIMIT` | Hardcoded constant | `30.0` degrees | Line 200 |
| **Head Pitch Neutral Bound** | `PITCH_LIMIT` | Hardcoded constant | `25.0` degrees | Line 201 |
| **Head Roll Neutral Bound** | `ROLL_LIMIT` | Hardcoded constant | `25.0` degrees | Line 202 |
| **Execution Device** | `ACTIVE_DEVICE` | Configurable (`--device` / env `INTELLIPROCTOR_DEVICE`) | Auto-detect (GPU `0` if CUDA available, else `"cpu"`) | Lines 129–163 |
| **Detection State TTL** | `ttl_seconds` | Hardcoded in `run_proctoring_loop` | `1.5` seconds | Line 737 |

---

## 6. Current MediaPipe Facial-Landmark & Head-Pose Implementation

### 6.1 Landmark Extraction & Generic 3D Reference Model

Facial tracking is initialized in lines 19–25:
```python
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=5,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)
```
- **Tracked Landmark IDs (Line 204)**: `LANDMARK_IDS = [1, 152, 33, 263, 61, 287]`.
  - 1: Nose tip
  - 152: Chin base
  - 33: Left eye outer corner
  - 263: Right eye outer corner
  - 61: Left mouth corner
  - 287: Right mouth corner
- **Generic 3D Face Reference Model (Lines 206–213)**: Metric 3D coordinates in millimeters defined relative to the nose tip.

### 6.2 Perspective-n-Point Pose Solver & Euler Angles

In `calculate_head_pose()` (lines 249–312):
1. 2D image coordinates are scaled by frame dimensions: `lm.x * w_img, lm.y * h_img`.
2. Camera intrinsic matrix is approximated using focal length $f = w_{\text{img}}$ and center $(\frac{w}{2}, \frac{h}{2})$.
3. `cv2.solvePnP()` executes Levenberg-Marquardt iterative pose estimation (`cv2.SOLVEPNP_ITERATIVE`).
4. Rotation vector is converted to a $3 \times 3$ rotation matrix via `cv2.Rodrigues()`.
5. Rotation matrix is decomposed into Euler angles (Yaw, Pitch, Roll) with singularity handling ($s_y < 10^{-6}$).

### 6.3 Existing Neutral Thresholds & Sideways-Turn Gap

- **Neutral Range Definition (Line 303)**:
  ```python
  is_neutral = (abs(yaw_val) <= YAW_LIMIT) and (abs(pitch_val) <= PITCH_LIMIT) and (abs(roll_val) <= ROLL_LIMIT)
  ```
- **Visual Status**: If `is_neutral` is True, renders green text `"Head: Neutral"`. If False, renders amber text `"Head: Outside neutral range"`.
- **Critical Architectural Gap**:
  - `video_input_analysis.py` evaluates head pose **strictly on a per-frame basis**.
  - There is **no state machine** tracking turn start, minimum dwell time ($\ge 1.0\text{ s}$), or return to neutral.
  - There is **no event counter** tracking completed groups of 3 sideways turns.
  - The script does **not assign suspicion points** for head turns.

---

## 7. Detailed Code Analysis of `video_input_analysis.py`

The 943 lines of `video_input_analysis.py` encompass several discrete capabilities and legacy entry points:

1. **Lines 1–176**: Imports, MediaPipe initialization, phase configurations (`phase0`, `phase0_baseline`, `phase2_gpu`, `iteration2`), device resolution, and friendly device description helpers.
2. **Lines 177–247**: Global pipeline state initialization, phase switching helper `set_active_phase()`, and device switching helper `set_active_device()`.
3. **Lines 248–313**: `calculate_head_pose()` implementing `solvePnP` head-pose estimation.
4. **Lines 314–457**: `process_single_frame()` — synchronous frame-processing function used by integration tests and batch scripts.
5. **Lines 463–537**: `WebcamCaptureStream` — dedicated capture thread.
6. **Lines 539–570**: `DetectionState` — thread-safe container with 1.5s TTL expiration.
7. **Lines 572–698**: `YOLOInferenceWorker` — asynchronous background detection thread.
8. **Lines 700–910**: `run_proctoring_loop()` — main live execution loop with OpenCV display window (`cv2.imshow`), FPS smoothing, and overlay rendering.
9. **Lines 911–943**: CLI argument parser (`--phase`, `--device`, `--imgsz`, `--camera`, `--test-frames`, `--no-display`, `--synthetic`, `--clean-overlay`) and script entry point.

### Absence of Evidence Persistence and Network Serialization
- **Zero `cv2.imwrite` Calls**: An audit of `video_input_analysis.py` confirms that `cv2.imwrite` does **not appear anywhere in the file**. Screenshots are never written to disk.
- **Zero Network Sockets**: The script contains no `requests`, `urllib`, `aiohttp`, `websockets`, or socket calls.

---

## 8. Current Event Generation & Temporal Aggregation

### Temporal Filtering via `temporal_filter.py`
In line 190, `video_input_analysis.py` instantiates `TemporalProctoringManager`:
- Tracks categories `["phone", "book"]`.
- Uses `HysteresisDebounceFilter`: requires 3 consecutive hits to activate alert, 4 consecutive negative frames to deactivate.
- In line 859, `temporal_manager.update(prohibited_counts)` updates state:
  - If phone is active: appends `"ALERT: Phone detected! (Persisted)"`.
  - If book is active: appends `"ALERT: Book/notes detected! (Persisted)"`.

### Absence of Discrete Episode Data Structures
- While the temporal filter smooths visual alerts on the OpenCV display, it **does not serialize discrete episode records** containing UUIDs, start/end timestamps, or bounding-box coordinates.
- Alerts exist solely as transient strings in a Python list (`cached_alerts`), rendered onto display frames via `cv2.putText`.

---

## 9. Current Computer-Vision-to-Backend Integration

The diagram below illustrates the complete reality of the computer-vision to backend integration today:

```
[video_input_analysis.py]                        [Backend Application Layer]
  • Captures webcam via OpenCV                     • NON-EXISTENT
  • Computes PnP head pose                         • No FastAPI / Flask server
  • Runs YOLO11m on GPU/CPU                        • No POST /proctor/events route
  • Draws alerts on desktop OpenCV GUI             • No PostgreSQL database
          │                                                    │
          ▼                                                    ▼
   (DISCONNECTED)                                       (DISCONNECTED)
          │                                                    │
          x ─── No HTTP / WebSocket / IPC Bridge ──────────── x
          │                                                    │
          ▼                                                    ▼
[Frontend React Application]                     [Candidate Browser Screen]
  • Opens separate browser webcam via getUserMedia • ExamTakingPage runs mock proctoring sim
  • Displays local video inside CameraWidget       • Simulates random anomalies every 18s
  • Renders static mock reports from mockData.js   • Calculates risk score locally in RAM
```

### Gap Summary
1. `video_input_analysis.py` cannot transmit observations to the backend because no backend server exists.
2. The frontend cannot receive telemetry from `video_input_analysis.py` because no WebRTC or WebSocket relay exists.
3. The frontend's camera preview is an isolated HTML5 `getUserMedia` stream that is never analyzed by YOLO or MediaPipe.

---

## 10. Current Examiner-Side Experience

When an examiner accesses the Live Hall ([`Frontend/src/pages/admin/LiveMonitoringPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/LiveMonitoringPage.jsx)):
- **The Local Webcam Loop Bug**: In [`StudentLiveCard.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/StudentLiveCard.jsx), each candidate card renders `CameraWidget`. Because there is no WebRTC streaming server, **every card re-executes `useWebcam()`**, opening the examiner's local computer webcam multiple times.
- **Mock Telemetry**: Candidate risk scores (`78`, `42`, `88`) and proctoring logs (`"Looking Away"`, `"Phone Detected"`) are read statically from [`Frontend/src/api/mockData.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/mockData.js).
- **Dismissal Behavior**: Clicking "Dismiss" calls `proctorApi.dismissEvent()`, which resolves mock data and updates local React component memory. The dismissal is lost on page reload.

---

## 11. Current Examinee-Side Experience

### 11.1 Official Examination Experience
When an examinee joins an examination at `/student/exam/:testId`:
- **Active Video**: The examinee sees their own camera preview in a floating `CameraWidget`.
- **Canvas Overlay**: `CameraWidget` draws client-side animated green circles (simulating MediaPipe facial landmarks) and dummy bounding boxes using `requestAnimationFrame`.
- **Proctoring Simulation**: [`Frontend/src/hooks/useProctoringSim.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/hooks/useProctoringSim.js) sets a `setInterval(..., 18000)`. Every 18 seconds, it randomly picks an anomaly (`"LOOKING_AWAY"`, `"OBJECT_DETECTED"`, `"MULTIPLE_FACES"`) and displays a red toast alert.
- **Target Invariant Violation**: The candidate's exam screen displays intrusive alerts and simulated landmark drawings, violating the target design principle of a *clean, non-alarming examinee view*.
- **Tab-Switching**: **Completely absent**. No DOM listeners exist to detect when the candidate leaves the exam tab.

### 11.2 Practice Examination Experience
When a candidate accesses `/student/practice` ([`Frontend/src/pages/student/PracticeExamPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/student/PracticeExamPage.jsx)):
- The practice test is a purely offline 10-question general knowledge quiz.
- Proctoring components, camera widgets, and diagnostic overlays are **completely omitted**.
- The educational diagnostic experience specified in Mode B of [`MODEL_ARCHITECTURE.md`](file:///c:/Users/tanis/IntelliProctor/MODEL_ARCHITECTURE.md) (rendering real YOLO bounding boxes, confidence %, and yaw/pitch/roll angles) is not implemented.

---

## 12. Current Suspicion-Scoring Boundary

The table below contrasts the target scoring rules with the actual implementation in the repository:

| Rule / Requirement | Target Specification (`MODEL_ARCHITECTURE.md`) | Actual Repository Status | Current Gap |
|---|---|---|---|
| **Sideways Head Turns** | **+10 points** per completed group of 3 qualifying turns. | Checks `is_neutral` per-frame. Points added: **0**. | `Planned` (State machine and scoring unwritten). |
| **Phone Detection** | **+100 points** per distinct accepted phone episode. | Appends text alert to OpenCV frame. Points added: **0**. | `Planned` (No backend scoring). |
| **Book Detection** | **+50 points** per distinct accepted book episode. | Appends text alert to OpenCV frame. Points added: **0**. | `Planned` (No backend scoring). |
| **Suspicious Threshold**| $S \ge 100 \implies \text{Suspicious}$ | Static integers in `mockData.js` (`78`, `12`). | `Planned` (Threshold evaluation absent). |
| **Score Ceiling** | Hard ceiling at **1000 points**. | Frontend `useProctoringSim.js` arbitrarily caps at 100. | `Planned` (1000 cap absent). |
| **Client-Side Scoring** | Strictly prohibited on frontend. | `useProctoringSim.js` calculates `prev + anomaly.weight`. | `Conflict` (Client-side scoring must be removed). |
| **Tab-Switch Scoring** | Unassigned / zero points. | Zero listeners; string in `mockData.js`. | `Planned` (DOM listener and ingestion unwritten). |

---

## 13. Current Model Quality, Benchmark Metrics, & Evaluation Artifacts

### 13.1 Phase 0 Pre-Trained Baseline Performance

The baseline model is out-of-the-box YOLO11m (`models/pretrained/yolo11m.pt`) evaluated on the held-out test suite:
- **Phone Raw Recall**: 64.7% (11/17 test images detected).
- **Phone Filtered Recall ($\ge 0.65$ + Aspect)**: **17.6%** (3/17 test images passed).
- **Book Raw Recall**: 13.3% (2/15 test images detected).
- **Book Filtered Recall ($\ge 0.65$ + Aspect)**: **0.0%** (0/15 test images passed).
- **Negative Benchmark False Positive Rate (140 images)**: **13.6%** (19/140 images triggered false alarms).
- **Local Negative Rejection (28 images)**: **0.0% FPR** (0/28 images triggered false alarms).
- **Median CPU Latency**: **911.25 ms** (1.10 FPS) at 1280x1280.

### 13.2 Training Iteration 1 Evaluation & Overfitting Audit

Training Iteration 1 (`train_phase1.py`) fine-tuned YOLO11m on custom positive images:
- **Training Setup**: 21 raw positive images per class, expanded via Albumentations to ~327 images/class; batch size 4; `imgsz = 1280`; 10 backbone layers frozen; AdamW optimizer; trained on NVIDIA RTX 4050 GPU. Early stopped at epoch 29 (best epoch 16, mAP50 = 0.7825).
- **Evaluation Findings ([`reports/ml/TRAINING_ITERATION_1_REPORT.md`](file:///c:/Users/tanis/IntelliProctor/reports/ml/TRAINING_ITERATION_1_REPORT.md))**:
  - Raw sensitivity improved (Phone raw recall: 100%, Book raw recall: 66.7%).
  - Confidence on external test images dropped severely ($0.15 - 0.58$), yielding **Phone Filtered Recall of 11.8%** and **Book Filtered Recall of 0.0%**.
  - **Severe False Alarm Explosion**: Negative benchmark FPR spiked from 13.6% to **47.9%** (67/140 false positives). Laptops and tablets exhibited a **65.0% false positive rate**.
  - **Root Cause**: Extreme domain overfitting. Positive data was captured from a single subject in a single room with zero negative supervision on laptops or tablets.
  - **Exit Criteria Result**: **`FAILED` — DO NOT DEPLOY TO PRODUCTION**.

### 13.3 Phase 3 Post-Processing Sweep Findings

In [`reports/ml/PHASE3_POST_PROCESSING_REVIEW.md`](file:///c:/Users/tanis/IntelliProctor/reports/ml/PHASE3_POST_PROCESSING_REVIEW.md), a parametric sweep across confidence thresholds and aspect ratios proved that post-processing cannot salvage Iteration 1:
- To achieve 40% book recall, the confidence threshold must be dropped to $0.10$.
- At $\text{conf} = 0.10$, the negative benchmark false positive rate explodes to **86.4%** (121 out of 140 non-prohibited desk objects trigger false alarms).
- **Formal Decision**: Maintain Phase 0 baseline in `video_input_analysis.py`. Proceed to dataset expansion for Iteration 2.

### 13.4 Dataset Iteration 2 Readiness Analysis

The consolidated dataset [`Dataset_it2`](file:///c:/Users/tanis/IntelliProctor/Dataset_it2) resolves the root deficiencies of Iteration 1:
- **Total Images**: 377 images (1280x720 RGB JPEG).
- **Positive Balance**: 114 phone images (117 bounding boxes), 111 book_notebook images (115 bounding boxes).
- **Negative Supervision**: **152 hard-negative background images** (58 water bottles, 44 hands/desks, 15 calculators, 15 pens, 20 smartwatches).
- **Leakage Prevention**: Grouped into 16 recording sessions and stratified across train, val, and test splits without cross-split bleeding.

---

## 14. Model Implementation-Gap Matrix

| Capability / Requirement | Current Implementation State | Target Architecture Requirement | Specific Implementation Gap | Relevant Files | Priority |
|---|---|---|---|---|---|
| **Production Model Checkpoint** | `Implemented and verified` | Phase 0 baseline (`models/pretrained/yolo11m.pt`). | None (Active and verified). | `video_input_analysis.py` | Low |
| **Model Lifecycle Protection** | `Implemented and verified` | Strict quarantine of overfitted Iteration 1 weights. | None (Enforced via Phase 3 policy). | `reports/ml/` | Low |
| **Phone Detection Pipeline** | `Implemented and verified` | YOLO11m with conf $\ge 0.65$ and aspect $[1.15, 2.90]$. | None in local script; missing telemetry export. | `video_input_analysis.py` | Medium |
| **Book Detection Pipeline** | `Implemented and verified` | YOLO11m with conf $\ge 0.65$ and aspect $[0.80, 2.50]$. | Pretrained book recall is 0.0%; needs Iteration 2. | `video_input_analysis.py` | High |
| **Allowed-Object Filtering** | `Partially implemented` | Discard non-prohibited desk objects without alarms. | Needs negative supervision training from `Dataset_it2`.| `Dataset_it2` | High |
| **Head Pose Estimation** | `Implemented and verified` | MediaPipe FaceMesh + `solvePnP` on 6 landmarks. | None in single frame pose calculation. | `video_input_analysis.py` | Low |
| **Sideways-Turn State Machine**| `Planned` | Event state machine: dwell $\ge 1.0\text{ s}$, return to neutral. | Code evaluates pose per-frame; no turn events. | Needs `src/cv/head_turn.py` | Critical |
| **Face-Presence Absence Timer** | `Implemented and verified` | 10-second absence triggers candidate absence alert. | Local string alert only; not sent to backend. | `video_input_analysis.py` | Medium |
| **Multiple Faces Detection** | `Implemented and verified` | Detects face count $> 1$ and raises alert. | Local string alert only; not sent to backend. | `video_input_analysis.py` | Medium |
| **Decoupled Capture Thread** | `Implemented and verified` | Single-frame buffer (`CAP_PROP_BUFFERSIZE = 1`). | None (Implemented and verified). | `video_input_analysis.py` | Low |
| **Asynchronous YOLO Worker** | `Implemented and verified` | Threaded inference worker with 1.5s TTL state. | None (Implemented and verified). | `video_input_analysis.py` | Low |
| **Clean Frame Isolation** | `Implemented and verified` | Passes unannotated frame copy to YOLO worker. | None (Verified by automated unit tests). | `video_input_analysis.py` | Low |
| **Temporal Hysteresis Filter** | `Implemented and verified` | 3-on / 4-off debouncing state machine. | Filter updates local display text; no API events. | `temporal_filter.py` | Medium |
| **Structured Telemetry Export**| `Planned` | Asynchronous worker serializing JSON event payloads. | `video_input_analysis.py` has zero network code. | `video_input_analysis.py` | Critical |
| **Backend Telemetry Ingestion**| `Planned` | `POST /api/v1/proctor/events` endpoint. | Endpoint completely unwritten on backend. | Needs backend server | Critical |
| **JPEG Evidence Persistence** | `Planned` | Event-triggered JPEG capture uploaded to S3. | Script does not call `cv2.imwrite` or upload. | `video_input_analysis.py` | High |
| **Examiner Hall WebRTC Stream** | `Placeholder/mock` | WebRTC / HLS streaming from examinee to examiner. | Cards re-open examiner's local webcam. | `StudentLiveCard.jsx` | High |
| **Examinee Official Mode UX** | `Partially implemented` | Clean preview; NO internal bounding boxes or scores. | Frontend displays simulated landmark wireframes. | `CameraWidget.jsx` | High |
| **Examinee Practice Mode UX** | `Placeholder/mock` | Educational diagnostics (boxes, angles, confidences).| Practice page omits all proctoring components. | `PracticeExamPage.jsx` | Medium |
| **Centralized Backend Scoring**| `Planned` | Apply exact rules (+10 per 3 turns, +50 book, +100 phone).| Unwritten; frontend calculates mock scores. | `useProctoringSim.js` | Critical |
| **Browser Tab-Switch Hook** | `Planned` | `useTabVisibility` hook tracking Page Visibility API. | Zero DOM listeners in active React code. | `ExamTakingPage.jsx` | Critical |

---

## 15. Recommended Model Implementation Roadmap

```
[Phase A: Structured Telemetry Bridge] ──> [Phase B: Sideways-Turn State Machine] ──> [Phase C: S3 Evidence Export]
                                                                                               │
                                                                                               ▼
[Phase F: Mode-Specific UI Alignment]  <── [Phase E: Iteration 2 Model Training] <── [Phase D: WebRTC Streaming]
```

### Phase A — Structured Telemetry Serialization
1. Build an event serialization module in `video_input_analysis.py` that formats anomaly episodes into the JSON contract defined in `MODEL_ARCHITECTURE.md`.
2. Implement a background HTTP worker thread inside `video_input_analysis.py` that POSTs events to `POST /api/v1/proctor/events`.

### Phase B — Sideways Head-Turn State Machine
1. Implement `HeadTurnStateMachine` in Python tracking Yaw deviations outside $\pm 30.0^\circ$.
2. Enforce minimum $1.0\text{ second}$ dwell time and return-to-neutral transition before counting a turn.
3. Emit `HEAD_TURN_GROUP_COMPLETED` upon every 3 completed turns.

### Phase C — Event-Triggered Evidence Persistence
1. Add JPEG image encoding (`cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])`) inside `video_input_analysis.py` upon confirmed anomaly events.
2. Transmit the JPEG payload to the backend for S3 persistence.

### Phase D — WebRTC Remote Video Relay
1. Integrate an upstream WebRTC client (e.g., `aiortc` or browser RTCPeerConnection) to stream examinee video to a media server.
2. Update [`StudentLiveCard.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/StudentLiveCard.jsx) to consume remote WebRTC streams, eliminating the local webcam loop bug.

### Phase E — Training Iteration 2 (Dataset_it2)
1. Execute training on [`Dataset_it2`](file:///c:/Users/tanis/IntelliProctor/Dataset_it2) incorporating the 152 hard-negative background images.
2. Evaluate resulting checkpoint against acceptance gates: Phone Recall $\ge 50\%$, Book Recall $\ge 40\%$, Negative FPR $\le 5.0\%$.
3. If gates pass, promote weights to `models/trained/intelliproctor_phase2_iter2/weights/best.pt`.

### Phase F — Examination Mode UI Alignment
1. Refactor [`CameraWidget.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/CameraWidget.jsx) to hide canvas wireframes during official exams (Mode A).
2. Wire actual CV diagnostics (boxes, Euler angles, face counts) into [`PracticeExamPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/student/PracticeExamPage.jsx) for Mode B.

---

## 16. Verification Record & Test Execution Summary

The conclusions in this document were established through direct verification of the following repository assets and test executions:

### Direct File & Asset Inspections
- [`video_input_analysis.py`](file:///c:/Users/tanis/IntelliProctor/video_input_analysis.py): Inspected all 943 lines. Confirmed multithreaded architecture, MediaPipe landmarks, `solvePnP` head pose, and verified the complete absence of `cv2.imwrite` and network sockets.
- [`temporal_filter.py`](file:///c:/Users/tanis/IntelliProctor/temporal_filter.py): Inspected hysteresis debouncing implementation (on=3, off=4).
- Model Checkpoints: Verified file presence and 40.5 MB size of `models/pretrained/yolo11m.pt` and `models/trained/intelliproctor_phase1_iter1/best.pt`.
- Dataset Assets: Inspected `Dataset_it2/data.yaml` and `Dataset_it2/dataset_audit_report.txt` (377 images, 152 negatives).
- Evaluation Reports: Audited `TRAINING_ITERATION_1_REPORT.md` (47.9% negative FPR) and `PHASE3_POST_PROCESSING_REVIEW.md` (DO NOT DEPLOY decision).

### Automated Tests Executed in Python 3.11 (`.venv`)
The following automated pytest suites were executed directly during this audit:
1. **`tests/test_production_integration.py`**:
   - `test_phase_configs_integrity`: **PASSED**
   - `test_phase_resolution_and_fallback`: **PASSED**
   - `test_clean_frame_yolo_isolation`: **PASSED**
   - `test_process_single_frame_phase0`: **PASSED**
   - `test_process_single_frame_phase2_gpu`: **PASSED**
   - `test_detector_evaluator_alignment`: **PASSED**
   - `test_device_resolution_and_switching`: **PASSED**
   - `test_process_single_frame_with_fps_overlay`: **PASSED**
   - *Result*: **8 passed in 40.47s**.
2. **`tests/test_decoupled_pipeline.py`**:
   - `test_detection_state_ttl_and_freshness`: **PASSED**
   - `test_detection_state_concurrent_access`: **PASSED**
   - `test_yolo_inference_worker_execution`: **PASSED**
   - `test_run_proctoring_loop_synthetic_decoupled`: **PASSED**
   - *Result*: **4 passed in 13.85s**.
3. **`tests/test_temporal_filter.py`**:
   - `test_sliding_window_transient_suppression`: **PASSED**
   - `test_sliding_window_sustained_activation`: **PASSED**
   - `test_hysteresis_debounce_activation_and_deactivation`: **PASSED**
   - `test_temporal_proctoring_manager`: **PASSED**
   - `test_simulation_suppresses_transient_spikes`: **PASSED**
   - *Result*: **5 passed in 0.02s**.

---

## 17. Guidance for Future Model Engineers

Future computer-vision and machine-learning engineers working on IntelliProctor must remember:

> **This document is a factual audit of the present system, not the target architecture.**

When implementing future features:
1. Consult [`MODEL_ARCHITECTURE.md`](file:///c:/Users/tanis/IntelliProctor/MODEL_ARCHITECTURE.md) for target specifications, telemetry schemas, and UX boundaries.
2. Do not deploy `intelliproctor_phase1_iter1/best.pt` to production.
3. Maintain the decoupled threading architecture to preserve real-time video performance on CPU hardware.
4. Always isolate YOLO inference on clean, unannotated frame copies.
5. Never compute or manipulate suspicion scores within computer-vision scripts.
