# IntelliProctor — Backend Current State Audit & Gap Analysis

> **Document Version**: 1.0.0  
> **Repository Root**: [`c:\Users\tanis\IntelliProctor`](file:///c:/Users/tanis/IntelliProctor)  
> **Companion Documents**: Root [`README.md`](file:///c:/Users/tanis/IntelliProctor/README.md), Target Specification [`BACKEND_ARCHITECTURE.md`](file:///c:/Users/tanis/IntelliProctor/BACKEND_ARCHITECTURE.md), and [`FRONTEND_CURRENT_STATE.md`](file:///c:/Users/tanis/IntelliProctor/FRONTEND_CURRENT_STATE.md).  
> **Audit Date**: October 2026  
> **Status**: **VERIFIED REPOSITORY AUDIT** (Factual inventory of current backend assets, computer vision isolation, mock fallbacks, missing services, and architecture gaps).

---

## Table of Contents

1. [Purpose & Audit Boundaries](#1-purpose--audit-boundaries)
2. [Current Backend Technology Stack](#2-current-backend-technology-stack)
3. [Existing Backend Repository & File Structure](#3-existing-backend-repository--file-structure)
4. [Existing API Routes & Endpoint Audit](#4-existing-api-routes--endpoint-audit)
5. [Existing Authentication & Authorization](#5-existing-authentication--authorization)
6. [Existing Database & Persistence](#6-existing-database--persistence)
7. [Existing Examination Lifecycle](#7-existing-examination-lifecycle)
8. [Existing Computer Vision Integration](#8-existing-computer-vision-integration)
   - [8.1 Architecture of `video_input_analysis.py`](#81-architecture-of-video_input_analysispy)
   - [8.2 MediaPipe Head-Pose Tracking](#82-mediapipe-head-pose-tracking)
   - [8.3 YOLO Inference & Temporal Filtering](#83-yolo-inference--temporal-filtering)
   - [8.4 The CV-to-Backend Disconnect](#84-the-cv-to-backend-disconnect)
9. [Existing Suspicion-Scoring Implementation](#9-existing-suspicion-scoring-implementation)
   - [9.1 Target Rules vs. Actual Implementation Audit](#91-target-rules-vs-actual-implementation-audit)
   - [9.2 Client-Side Scoring Conflict](#92-client-side-scoring-conflict)
10. [Existing Tab-Switch Monitoring Support](#10-existing-tab-switch-monitoring-support)
11. [Existing Evidence Storage & Retrieval](#11-existing-evidence-storage--retrieval)
12. [Existing Alert & Report Architecture](#12-existing-alert--report-architecture)
13. [Existing Reliability & Security Vulnerabilities](#13-existing-reliability--security-vulnerabilities)
14. [Comprehensive Gap Analysis Table](#14-comprehensive-gap-analysis-table)
15. [Prioritized Backend Implementation Roadmap](#15-prioritized-backend-implementation-roadmap)
16. [Verification Record](#16-verification-record)
17. [Recommended Next Actions](#17-recommended-next-actions)

---

## 1. Purpose & Audit Boundaries

This document provides a rigorous, evidence-based audit of the **IntelliProctor** backend as it exists today in the repository.

While [`BACKEND_ARCHITECTURE.md`](file:///c:/Users/tanis/IntelliProctor/BACKEND_ARCHITECTURE.md) defines the authoritative target specification for future engineering, this document answers:

> **What backend code currently exists in the repository, how does it work, what is mocked, and what specific gaps must be bridged to establish the authoritative backend engine?**

### Audit Classification Labels
All findings in this audit are classified using strict repository-verified labels:
- **`Implemented and verified`**: The code exists in the repository, executes in the runtime environment, and has been confirmed through direct inspection or command output.
- **`Partially implemented`**: Standalone scripts or frontend scaffolding exist, but integration into an end-to-end backend service is incomplete.
- **`Placeholder/mock`**: Data or behavior is simulated via static JSON/JavaScript objects in the client without persistent storage.
- **`Planned`**: Required by the target architecture but completely unwritten in current repository code.
- **`Needs verification`**: Code exists but lacks running backend infrastructure or end-to-end automated tests.

> [!CAUTION]
> **Strict Non-Modification Principle**: This audit is purely observational. No backend server code was created, no database tables were migrated, no model checkpoints were replaced, and no configuration files were modified.

---

## 2. Current Backend Technology Stack

A comprehensive inspection of root directory files, Python dependencies, and frontend API configurations reveals the following verified technology baseline:

| Stack Layer | Technology / Tool | Verified Version / Asset | Source File / Evidence | Operational Status |
|---|---|---|---|---|
| **Backend Web Framework** | *None* (FastAPI, Flask, Django absent) | *N/A* | Root directory search | `Planned` |
| **Runtime Language** | Python | `3.11` / `3.14` | Virtual environment (`.venv`) | `Implemented and verified` |
| **Object Detection Model** | YOLO11 Medium (Ultralytics) | `11.0` | [`models/pretrained/yolo11m.pt`](file:///c:/Users/tanis/IntelliProctor/models/pretrained/yolo11m.pt) | `Implemented and verified` |
| **Facial Landmark Model** | MediaPipe FaceMesh | `0.10.x` | [`face_landmarker.task`](file:///c:/Users/tanis/IntelliProctor/face_landmarker.task) / `mediapipe` | `Implemented and verified` |
| **Image Processing Library** | OpenCV | `4.10.0+` | `cv2` in `video_input_analysis.py` | `Implemented and verified` |
| **Temporal Filter** | Hysteresis State Machine | Custom Python | [`temporal_filter.py`](file:///c:/Users/tanis/IntelliProctor/temporal_filter.py) | `Implemented and verified` |
| **Relational Database** | *None* (PostgreSQL / SQLite absent) | *N/A* | Zero `.sql`, `.db`, `.sqlite` files | `Planned` |
| **Database ORM / Migrations**| *None* (SQLAlchemy / Alembic absent) | *N/A* | No migration directories | `Planned` |
| **In-Memory Cache / PubSub** | *None* (Redis absent) | *N/A* | No Redis client installed | `Planned` |
| **Object Storage** | *None* (MinIO / S3 SDK absent) | *N/A* | No AWS SDK (`boto3`) integration | `Planned` |
| **API Transport Gateway** | *None* (Targeting port 8000) | *N/A* | [`Frontend/src/api/client.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/client.js) | `Planned` |
| **Real-Time WebSockets** | *None* | *N/A* | No WebSocket server in repo | `Planned` |
| **Test Runner** | pytest | `8.4.2` / `9.1.1` | [`tests/conftest.py`](file:///c:/Users/tanis/IntelliProctor/tests/conftest.py) | `Implemented and verified` |

---

## 3. Existing Backend Repository & File Structure

The backend and computer-vision components in the repository consist of the following verified source files:

```
IntelliProctor/
├── video_input_analysis.py            # Standalone desktop CV proctoring script (931 lines)
├── temporal_filter.py                 # 3-on / 4-off temporal hysteresis filter (146 lines)
├── train_phase1.py                    # Historical Phase 1 YOLO fine-tuning script
├── evaluate_phase1.py                 # Historical model evaluation on negative benchmark
├── face_landmarker.task               # MediaPipe FaceMesh binary model bundle (3.7 MB)
├── models/
│   ├── pretrained/
│   │   └── yolo11m.pt                 # Production Phase 0 model checkpoint (40 MB)
│   └── trained/
│       └── intelliproctor_phase1_iter1/
│           └── best.pt                # Overfitted Phase 1 checkpoint (DO NOT DEPLOY)
├── tests/
│   ├── conftest.py                    # Pytest fixtures and mock frames
│   ├── detector_evaluator.py          # Metric calculations (Precision, Recall, FPR)
│   ├── run_live_webcam_test.py        # Desktop live webcam test harness
│   ├── test_aspect_ratio_sweep.py     # Aspect ratio filter validation
│   ├── test_decoupled_pipeline.py     # Multithreaded capture/worker unit tests
│   ├── test_object_detection.py       # YOLO inference tests on static images
│   ├── test_production_integration.py # Integration test for Phase 0 config
│   └── test_temporal_filter.py        # Hysteresis state machine tests
├── tools/
│   ├── audit_dataset.py               # Dataset class balance analysis
│   ├── augment_train_split.py         # Synthetic augmentation generator
│   └── evaluate_cross_benchmark.py    # Cross-dataset validation tool
└── Frontend/src/api/
    ├── client.js                      # Axios client pointing to http://localhost:8000/api/v1
    ├── mockData.js                    # Master client-side mock database (535 lines)
    ├── authApi.js                     # Mock auth service
    ├── examApi.js                     # Mock exam questions and submission
    ├── proctorApi.js                  # Mock candidate monitoring and alerts
    ├── questionApi.js                 # Mock AI question generator
    ├── reportApi.js                   # Mock candidate reports
    ├── statsApi.js                    # Mock dashboard metrics
    └── testApi.js                     # Mock test creation and passkeys
```

### Critical Finding: Total Absence of a Web Application Server
There is **no web application server** (e.g., FastAPI, Flask, Django, Express) implemented anywhere in the repository. 
- The frontend Axios instance in [`Frontend/src/api/client.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/client.js) expects a server listening on `http://localhost:8000/api/v1`.
- Because no server exists, all HTTP requests fail immediately and are silently caught by client-side fallback handlers that return static arrays from [`Frontend/src/api/mockData.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/mockData.js).

---

## 4. Existing API Routes & Endpoint Audit

The table below maps every endpoint targeted by the frontend API client against the actual state of the backend:

| Frontend API Method | Target HTTP Endpoint | Target Handler in Backend | Data Persistence | Verified Backend Status |
|---|---|---|---|---|
| `authApi.login()` | `POST /auth/login` | *None (Server absent)* | None (Static mock JWT) | `Placeholder/mock` |
| `authApi.register()` | `POST /auth/register` | *None (Server absent)* | None (Static mock JWT) | `Placeholder/mock` |
| `authApi.logout()` | `POST /auth/logout` | *None (Server absent)* | Clears local storage | `Placeholder/mock` |
| `examApi.getExamQuestions()` | `GET /exams/:id/questions` | *None (Server absent)* | None (Returns `mockQuestions`) | `Placeholder/mock` |
| `examApi.saveAnswerDraft()` | `POST /exams/:id/draft` | *None (Server absent)* | None (Returns `{ status: 'saved' }`) | `Placeholder/mock` |
| `examApi.submitExam()` | `POST /exams/:id/submit` | *None (Server absent)* | None (Returns `{ score: 85 }`) | `Placeholder/mock` |
| `proctorApi.getLiveCandidates()`| `GET /proctor/live-candidates` | *None (Server absent)* | None (Returns `mockLiveCandidates`) | `Placeholder/mock` |
| `proctorApi.getEvents()` | `GET /proctor/events` | *None (Server absent)* | None (Returns `mockProctorEvents`) | `Placeholder/mock` |
| `proctorApi.dismissEvent()` | `POST /proctor/events/:id/dismiss`| *None (Server absent)* | Updates local React memory only | `Placeholder/mock` |
| `questionApi.generateQuestions()`| `POST /questions/generate` | *None (Server absent)* | None (Returns sliced mock questions) | `Placeholder/mock` |
| `reportApi.getReportById()` | `GET /reports/:id` | *None (Server absent)* | None (Returns `mockReports[0]`) | `Placeholder/mock` |
| `statsApi.getOverview()` | `GET /stats/overview` | *None (Server absent)* | None (Returns `mockDashboardStats`) | `Placeholder/mock` |
| `testApi.createTest()` | `POST /tests` | *None (Server absent)* | Appends to temporary array in RAM | `Placeholder/mock` |
| `testApi.verifyPasskey()` | `POST /tests/verify-passkey` | *None (Server absent)* | Evaluated against `mockTests` array | `Placeholder/mock` |
| *Telemetry Ingestion* | `POST /proctor/events` | *None (Endpoint unwritten)*| None (Events not transmitted) | `Planned` |

> [!WARNING]
> **No Backend Endpoints Exist**: 100% of the API routes described in the project documentation and frontend client are currently unwritten on the backend. The application operates entirely on client-side simulation.

---

## 5. Existing Authentication & Authorization

### Audit Findings
1. **No Password Hashing or Identity Verification**: There is no user authentication logic, Argon2/Bcrypt hashing, or credential database in the backend.
2. **Hardcoded Mock Tokens**: Login requests return static, hardcoded tokens:
   - Examiner: `'mock-setter-jwt-token-2026'`
   - Examinee: `'mock-student-jwt-token-2026'`
3. **Frontend-Only Role Enforcement**: Role-based access control is enforced solely in the client browser via [`Frontend/src/components/layout/ProtectedRoute.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/layout/ProtectedRoute.jsx). Any client capable of modifying `localStorage.getItem('user')` can bypass all role restrictions.
4. **No Scoped Session Authorization**: There are no backend authorization checks to verify whether a candidate is authorized to access a specific examination, submit answers, or view report dossiers.

---

## 6. Existing Database & Persistence

### Database Audit Summary
- **Database Engine**: **ABSENT**. There is no PostgreSQL, SQLite, MySQL, or MongoDB database installed, configured, or connected.
- **Relational Models / ORM**: **ABSENT**. There are no SQLAlchemy, Prisma, or Tortoise models in the codebase.
- **Migration Scripts**: **ABSENT**. There is no Alembic or database migration directory.
- **Existing State Storage**: All application data resides exclusively in:
  1. [`Frontend/src/api/mockData.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/mockData.js) (Static read-only mock arrays).
  2. Browser `localStorage` (Auth tokens, user profile objects, theme).
  3. Ephemeral React component state (lost upon page reload).

---

## 7. Existing Examination Lifecycle

The lifecycle of an examination as currently implemented is purely a client-side mock walkthrough:

```
[Create Test (CustomTestPage)]  ──> Saves to React RAM state (lost on reload)
[Schedule (TestSchedulePage)]   ──> Generates client-side string (e.g. "PROCTOR-882")
[Join Exam (PasskeyEntryPage)]  ──> Compares entered PIN with `mockTests[].passkey` in client
[Take Exam (ExamTakingPage)]     ──> Questions fetched from `mockQuestions`
[Answer Drafts]                 ──> Squelched by Axios catch block; not persisted
[Submission]                    ──> Squelched by Axios catch block; redirects to dashboard
```

- **Passkeys**: Passkeys (e.g., `TEST2026`) are stored as plaintext strings in the frontend bundle. No server-side validation or hashing occurs.
- **Answer Persistence**: Submitting an answer draft calls `POST /exams/:id/draft`, which fails immediately. If an examinee refreshes their browser, all entered answers are lost.

---

## 8. Existing Computer Vision Integration

### 8.1 Architecture of `video_input_analysis.py`
The script [`video_input_analysis.py`](file:///c:/Users/tanis/IntelliProctor/video_input_analysis.py) is a standalone, desktop-native Python application. It operates through a decoupled multithreaded architecture:
- **`ThreadedVideoCapture` (Lines 463–533)**: Runs a dedicated background daemon thread continuously grabbing frames from `cv2.VideoCapture(0)`.
- **`AsyncDetectionWorker` (Lines 535–708)**: Runs a dedicated worker thread executing YOLO11m inference on clean frame copies, decoupled from camera capture frame rates.
- **Main Thread Loop (Lines 710–915)**:
  1. Retrieves the latest webcam frame.
  2. Executes MediaPipe FaceMesh to calculate head pose.
  3. Checks `AsyncDetectionWorker` for completed YOLO bounding boxes.
  4. Renders annotations onto the video frame using `cv2.putText` and `cv2.rectangle`.
  5. Displays the annotated feed locally via `cv2.imshow("IntelliProctor - Dual Monitoring", frame)`.

### 8.2 MediaPipe Head-Pose Tracking
- **Landmark Extraction**: Uses MediaPipe FaceMesh with `refine_landmarks=True` (lines 31–38).
- **Pose Calculation**: The function `calculate_head_pose()` (lines 249–312) uses 6 3D facial landmarks (nose tip 1, chin 152, left eye corner 33, right eye corner 263, left mouth corner 61, right mouth corner 291) and solves the Perspective-n-Point problem via `cv2.solvePnP()`.
- **Euler Angles**: Decomposes the rotation matrix into Yaw, Pitch, and Roll in degrees.
- **Neutral Boundaries**:
  - `YAW_LIMIT = 30.0` degrees (line 200).
  - `PITCH_LIMIT = 25.0` degrees (line 201).
  - `ROLL_LIMIT = 25.0` degrees (line 202).
  - `is_neutral = (abs(yaw) <= 30.0) and (abs(pitch) <= 25.0) and (abs(roll) <= 25.0)`.
- **Limitation**: Head pose is evaluated strictly **per-frame**. There is **no state machine or event aggregator** tracking whether a sideways turn has started, dwelled, or returned to neutral to qualify as a distinct event.

### 8.3 YOLO Inference & Temporal Filtering
- **Active Model**: Loaded in line 133 as `YOLO("models/pretrained/yolo11m.pt")` (Phase 0 baseline).
- **Target Classes**: Detects COCO class 67 (`cell phone`) and class 73 (`book`).
- **Aspect Ratio Filtering**: Enforced in lines 56–70:
  - Cell phone: $1.15 \le \text{Aspect Ratio} \le 2.90$.
  - Book: $0.80 \le \text{Aspect Ratio} \le 2.50$.
- **Temporal Filter Integration**: Imports `TemporalFilter` from [`temporal_filter.py`](file:///c:/Users/tanis/IntelliProctor/temporal_filter.py):
  - Requires 3 consecutive frames with detection to transition to `ON` (`on_threshold=3`).
  - Requires 4 consecutive clean frames to clear (`off_threshold=4`).

### 8.4 The CV-to-Backend Disconnect
The computer vision pipeline is **completely disconnected** from any backend or web frontend:
1. **Zero IPC / Sockets**: `video_input_analysis.py` contains **zero networking code**. There are no HTTP POST calls, WebSockets, gRPC endpoints, or Unix domain sockets.
2. **Local GUI Output Only**: Visual feedback is rendered strictly to an OpenCV desktop window (`cv2.imshow`) on the machine running the script.
3. **No Screenshot Export**: In the current implementation, `video_input_analysis.py` does **NOT call `cv2.imwrite`** or save JPEG evidence to disk.
4. **Independent Frontend Camera**: The frontend ([`Frontend/src/components/proctor/CameraWidget.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/CameraWidget.jsx)) opens its own browser webcam via HTML5 `getUserMedia`. The video seen in the browser has **no connection** to the YOLO or MediaPipe inference running in Python.

---

## 9. Existing Suspicion-Scoring Implementation

### 9.1 Target Rules vs. Actual Implementation Audit

The table below contrasts the target scoring rules specified in [`BACKEND_ARCHITECTURE.md`](file:///c:/Users/tanis/IntelliProctor/BACKEND_ARCHITECTURE.md) with the actual implementation in the repository:

| Requirement | Target Rule (`BACKEND_ARCHITECTURE.md`) | Actual Repository Implementation | Current Status | Specific Gap |
|---|---|---|---|---|
| **Sideways Head Turns** | **+10 points** per completed group of 3 qualifying sideways turns. | `video_input_analysis.py` checks `is_neutral` per-frame. Renders amber text on frame. Points added: **0**. | `Planned` | No event-grouping state machine; zero points assigned. |
| **Phone Detection** | **+100 points** per distinct accepted phone-detection episode. | `video_input_analysis.py` appends text string `"ALERT: Phone detected!"` to local list. Points added: **0**. | `Planned` | No episode scoring; text string rendered to OpenCV frame only. |
| **Book Detection** | **+50 points** per distinct accepted book-detection episode. | `video_input_analysis.py` appends text string `"ALERT: Book/notes detected!"` to local list. Points added: **0**. | `Planned` | No episode scoring; text string rendered to OpenCV frame only. |
| **Suspicious Threshold** | $S \ge 100 \implies \text{Suspicious}$ | No scoring threshold in backend. Frontend uses hardcoded mock risk values (`78`, `12`). | `Planned` | Centralized threshold evaluation does not exist. |
| **Score Ceiling** | Hard cap at **1000 points**. | None on backend. Frontend `useProctoringSim.js` arbitrarily caps at 100. | `Planned` | 1000-point score ceiling not implemented. |
| **Event Deduplication** | Idempotency keys; continuous frames group into single episode. | Temporal filter smooths bounding boxes over 3 frames, but does not emit structured episodes to an API. | `Planned` | No event idempotency or deduplication layer. |
| **Score History & Ledger** | Immutable append-only ledger (`suspicion_score_ledger`). | Database does not exist. No scoring history is recorded. | `Planned` | Entire ledger architecture unwritten. |
| **Candidate Isolation** | Scores isolated by `session_id`. | No session context exists in `video_input_analysis.py`. | `Planned` | CV runs locally without candidate identity. |
| **Human Review Dismissal** | Updates review status; preserves original event and score. | In `ReportDetailsPage.jsx`, clicking "Dismiss" mutates local React state in memory only. | `Placeholder/mock` | No backend persistence for examiner reviews. |
| **Frontend Score Delivery**| Frontend displays authoritative backend score. | Disconnected. Frontend uses mock scores from `mockData.js`. | `Placeholder/mock` | No live score synchronization. |

### 9.2 Client-Side Scoring Conflict
In [`Frontend/src/hooks/useProctoringSim.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/hooks/useProctoringSim.js), the frontend runs a client-side simulation that calculates suspicion scores:
```javascript
// Excerpt from Frontend/src/hooks/useProctoringSim.js (Line 24)
setScore((prev) => Math.min(100, prev + anomaly.weight));
```
This directly violates the core architectural invariant: **The frontend must NEVER calculate suspicion scores**.

---

## 10. Existing Tab-Switch Monitoring Support

### Verified Audit Findings
1. **Frontend Runtime Listeners**: **ABSENT**. There is no `visibilitychange`, `blur`, or `focus` listener implemented in `ExamTakingPage.jsx` or any active hook.
2. **Backend Telemetry Route**: **ABSENT**. There is no ingestion endpoint (such as `POST /proctor/events`) to receive tab-switch events.
3. **Database Schema**: **ABSENT**. There are no database tables or columns to store tab-switch timestamps or dwell durations.
4. **Mock Appearance**: The string `"Browser Tab Focus Lost"` appears solely in [`Frontend/src/api/mockData.js:272`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/mockData.js#L272) as a static mock event entry.

---

## 11. Existing Evidence Storage & Retrieval

### Verified Audit Findings
- **Screenshot Creation**: In `video_input_analysis.py`, there is **no code executing `cv2.imwrite`** to save frames to disk.
- **Object Storage**: There is no MinIO, AWS S3, or cloud storage integration.
- **Evidence Metadata**: No database records exist linking screenshots to candidate sessions or anomaly events.
- **Frontend Display**: In `ReportDetailsPage.jsx` and `EventLogTable.jsx`, evidence image tags point to placeholder paths (e.g., `/evidence/snapshot_101.jpg`), resulting in broken image icons in the browser.

---

## 12. Existing Alert & Report Architecture

- **Alert Generation in CV**: Handled via `cv2.putText(frame, alert_text, ...)` in `video_input_analysis.py` (lines 452–455). Alerts exist solely as pixels drawn onto the desktop OpenCV display.
- **Alert Generation in Frontend**: Handled via `useProctoringSim.js`, which displays simulated red toast alerts in `ExamTakingPage.jsx` every 18 seconds.
- **Examiner Reports**: In `ReportDetailsPage.jsx`, reports are rendered from static JSON objects in `mockData.js` (`mockReports[0]`).
- **Dismissal Handling**: Clicking "Dismiss as False Positive" triggers a mock API call that resolves `{ success: true }` after a 400ms delay. The event is marked as dismissed in temporary React component state and reverts on page refresh.

---

## 13. Existing Reliability & Security Vulnerabilities

1. **Silent Fallback Trap**: The Axios client in `Frontend/src/api/client.js` catches all network errors and serves static mock data. Developers and testers running the web app are given the false impression that a backend is functioning.
2. **Plaintext Passkey Exposure**: Passkeys are shipped to the client browser inside the `mockTests` JavaScript bundle, allowing candidates to inspect source code and obtain exam passkeys.
3. **Examiner Webcam Loop**: In `LiveMonitoringPage.jsx`, each candidate card renders `CameraWidget`, which attempts to open the **examiner's local webcam** instead of streaming candidate video.
4. **Zero Authentication on Local Python Script**: Anyone with access to the machine can launch `video_input_analysis.py`; it requires no credentials, session tokens, or parameters.
5. **Client-Side Score Manipulation**: Because suspicion scores are computed locally in `useProctoringSim.js`, an examinee can use browser developer tools to set `score = 0` at will.

---

## 14. Comprehensive Gap Analysis Table

| Subsystem / Capability | Current Repository Status | Target Architecture Requirement | Specific Implementation Gap | Relevant Files / Components | Priority |
|---|---|---|---|---|---|
| **Backend Web Server** | `Planned` | High-throughput asynchronous REST/WebSocket server. | Entire application framework unwritten. | Needs `src/main.py` (FastAPI) | Critical |
| **Relational Database** | `Planned` | PostgreSQL 16 schema with 9 core tables and ACID transactions. | Zero database tables, models, or migrations exist. | Needs PostgreSQL & SQLAlchemy | Critical |
| **Object Storage (S3)** | `Planned` | S3-compatible bucket for reference photos and evidence JPEGs. | No object store integration or upload handlers. | Needs MinIO / `boto3` client | High |
| **User Authentication** | `Placeholder/mock` | Argon2 password hashing, RS256 JWT access tokens, refresh cookies. | Mock tokens in `localStorage`; no backend auth. | `authApi.js`, `AuthContext.jsx` | High |
| **Passkey Validation** | `Placeholder/mock` | Argon2id passkey hashing, time-window validation, session creation. | Plaintext PIN evaluated in client bundle. | `testApi.js`, `PasskeyEntryPage.jsx` | High |
| **Question & Answer Persistence**| `Placeholder/mock` | Secure question delivery, draft caching, final submission evaluation. | Drafts fail silently; answers lost on refresh. | `examApi.js`, `ExamTakingPage.jsx` | High |
| **CV Telemetry Transport** | `Planned` | Asynchronous HTTP/gRPC bridge sending structured events to backend. | `video_input_analysis.py` has zero network code. | `video_input_analysis.py` | Critical |
| **Event Ingestion API** | `Planned` | `POST /proctor/events` endpoint with Pydantic validation and idempotency. | Ingestion endpoint completely unwritten. | Needs `src/api/proctor.py` | Critical |
| **Event Deduplication** | `Planned` | Group continuous frames into discrete episodes via temporal state machine. | Frames not grouped into discrete backend episodes. | `temporal_filter.py` | Critical |
| **Centralized Scoring Engine** | `Planned` | Apply exact rules (+10 per 3 turns, +50 book, +100 phone). | Scoring engine absent; rules unwritten. | Needs `src/services/scoring.py` | Critical |
| **Suspicious Threshold (100)** | `Planned` | Classify candidate as Suspicious if and only if $S \ge 100$. | No threshold check on backend. | Needs `src/services/scoring.py` | Critical |
| **Score Ceiling (1000)** | `Planned` | Cap cumulative candidate score at exactly 1000 points. | No score ceiling implemented. | Needs `src/services/scoring.py` | Critical |
| **Immutable Score Ledger** | `Planned` | Append-only `suspicion_score_ledger` table with transaction locking. | Score ledger table completely unwritten. | Needs PostgreSQL schema | Critical |
| **Tab-Switch Telemetry** | `Planned` | `useTabVisibility` hook sending `TAB_BLUR` / `TAB_FOCUS` events. | Zero DOM listeners in active React code. | `Frontend/src/hooks/useTabVisibility.js` | Critical |
| **Tab-Switch Ingestion** | `Planned` | Ingest and persist tab-switch duration and frequency (0 points). | No tab event ingestion or persistence. | Needs `src/api/proctor.py` | Critical |
| **Evidence JPEG Persistence**| `Planned` | Upload anomaly frames to S3; store metadata in `evidence_records`. | Frames not written to disk or uploaded. | `video_input_analysis.py` | High |
| **Pre-Signed Evidence URLs** | `Planned` | 15-minute time-bound signed S3 URLs for authorized examiner review. | Evidence endpoints unwritten. | Needs `src/api/evidence.py` | High |
| **Examiner Review & Dismissal**| `Placeholder/mock` | Persist dismissal note to `examiner_reviews`; preserve audit trail. | Dismissal updates local React state only. | `ReportDetailsPage.jsx` | High |
| **Live Hall WebSocket Feed** | `Planned` | Real-time Redis Pub/Sub WebSocket feed to examiner monitoring hall. | WebSocket server unwritten. | Needs `src/ws/live_hall.py` | High |
| **Examiner Remote Video** | `Placeholder/mock` | WebRTC / HLS streaming from examinee to examiner dashboard. | Candidate cards open examiner's local webcam. | `StudentLiveCard.jsx` | High |
| **Automated Backend Tests** | `Partially implemented` | Unit and integration test suite verifying scoring and APIs. | Tests exist only for CV/ML; zero API tests. | `tests/` | High |

---

## 15. Prioritized Backend Implementation Roadmap

Based on actual repository dependencies, future backend development must execute in seven sequential phases:

```
[Phase A: Foundations & Storage]
             │
             ▼
[Phase B: Auth & Exam Lifecycle]
             │
             ▼
[Phase C: CV Ingestion Bridge] ◄──► [video_input_analysis.py adapter]
             │
             ▼
[Phase D: Centralized Scoring Engine & Ledger]
             │
             ▼
[Phase E: Tab-Switch Telemetry & Live WebSockets]
             │
             ▼
[Phase F: Evidence S3 Storage & Examiner Dismissals]
             │
             ▼
[Phase G: Security Hardening & Concurrency Load Testing]
```

### Phase A — Backend Foundations & Relational Persistence
1. Initialize FastAPI project structure with Uvicorn ASGI runner.
2. Configure SQLAlchemy 2.0 async engine and Alembic migration environment.
3. Deploy PostgreSQL 16 and apply the 9 target tables defined in `BACKEND_ARCHITECTURE.md`.
4. Deploy local MinIO container and Redis 7 instance.

### Phase B — Authentication & Examination Lifecycle
1. Implement `POST /auth/register` and `POST /auth/login` with Argon2id password hashing and JWT issuance.
2. Implement candidate reference photo upload to S3 (`POST /candidates/reference-photo`).
3. Implement exam creation, Argon2 passkey generation, and schedule validation (`/api/v1/exams`).
4. Implement question delivery and answer draft persistence (`POST /exams/:id/draft`).

### Phase C — Computer Vision Ingestion Bridge
1. Create structured ingestion endpoint (`POST /api/v1/proctor/events`).
2. Build an asynchronous HTTP adapter in `video_input_analysis.py` to transmit confirmed anomaly episodes and JPEG frames.
3. Implement Redis-backed idempotency key validation to reject duplicate event deliveries.

### Phase D — Centralized Suspicion-Scoring Engine
1. Implement the mathematical scoring service:
   - Sideways head-turn aggregator (+10 per completed group of 3).
   - Phone detection episode scorer (+100).
   - Book detection episode scorer (+50).
   - Score ceiling at 1000 and suspicious threshold at 100.
2. Implement transaction-safe ledger inserts into `suspicion_score_ledger`.
3. Execute and pass all 18 formal acceptance test scenarios defined in `BACKEND_ARCHITECTURE.md`.

### Phase E — Tab-Switch Monitoring & Live Telemetry Broadcasting
1. Implement frontend `useTabVisibility.js` and connect to `POST /api/v1/proctor/events` (assigning 0 points).
2. Build Redis Pub/Sub WebSocket broadcaster (`/ws/v1/proctor/live/:examId`) to push real-time candidate score updates to examiner dashboards.

### Phase F — Evidence Persistence & Examiner Review Engine
1. Implement secure S3 evidence upload and persist metadata in `evidence_records`.
2. Implement pre-signed URL generator (`GET /api/v1/proctor/events/:id/evidence`).
3. Implement examiner dismissal endpoint (`POST /proctor/events/:id/dismiss`) with mandatory justification audit notes.

### Phase G — Security Hardening & System Verification
1. Remove all mock fallbacks from `Frontend/src/api/client.js`.
2. Fix `StudentLiveCard.jsx` to consume remote WebRTC streams instead of re-opening the local webcam.
3. Execute automated concurrency load tests simulating 500 active candidates.

---

## 16. Verification Record

The conclusions in this document were established through direct verification of the following repository assets:

### Files Inspected Directly
- [`video_input_analysis.py`](file:///c:/Users/tanis/IntelliProctor/video_input_analysis.py): Inspected capture thread, MediaPipe pose calculation, YOLO inference, and display loop. Confirmed zero network endpoints and absence of `cv2.imwrite`.
- [`temporal_filter.py`](file:///c:/Users/tanis/IntelliProctor/temporal_filter.py): Inspected hysteresis state transitions (on=3, off=4).
- [`models/pretrained/yolo11m.pt`](file:///c:/Users/tanis/IntelliProctor/models/pretrained/yolo11m.pt): Verified active model file size and presence.
- [`Frontend/src/api/client.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/client.js): Confirmed `baseURL: 'http://localhost:8000/api/v1'` and verified interceptor structure.
- [`Frontend/src/api/mockData.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/mockData.js): Inspected 535 lines of static mock arrays.
- [`Frontend/src/hooks/useProctoringSim.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/hooks/useProctoringSim.js): Confirmed local client-side score computation conflict.
- [`Frontend/src/components/proctor/StudentLiveCard.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/StudentLiveCard.jsx): Verified local webcam re-instantiation bug in examiner monitoring grid.
- All test files in [`tests/`](file:///c:/Users/tanis/IntelliProctor/tests): Verified existing pytest coverage is strictly limited to CV/ML algorithms.

### Commands & Static Analysis Executed
- Recursive file system search: Confirmed zero `.sql`, `.db`, `.sqlite`, Alembic, or Django/FastAPI files exist in the repository.
- Full-text search for `cv2.imwrite` and `screenshot`: Confirmed absence of image export in active Python code.
- Full-text search for `visibilitychange`, `blur`, and `focus`: Confirmed absence of runtime browser tab listeners.

---

## 17. Recommended Next Actions

The following concrete steps are recommended for the initial backend engineering sprint:

1. **Bootstrap FastAPI Project**:
   - Create root directory `backend/` with `main.py`, `config.py`, and `requirements.txt`.
   - Install `fastapi`, `uvicorn`, `sqlalchemy[asyncio]`, `asyncpg`, `pydantic-settings`, and `alembic`.

2. **Initialize Database Schema**:
   - Initialize Alembic migrations and apply the 9 target tables defined in Section 12.1 of [`BACKEND_ARCHITECTURE.md`](file:///c:/Users/tanis/IntelliProctor/BACKEND_ARCHITECTURE.md).

3. **Build CV Ingestion Adapter**:
   - Add a lightweight background HTTP worker thread to [`video_input_analysis.py`](file:///c:/Users/tanis/IntelliProctor/video_input_analysis.py) that POSTs confirmed anomaly episodes to `http://localhost:8000/api/v1/proctor/events`.

4. **Implement Scoring Engine Service**:
   - Implement `ScoringEngineService` enforcing the exact rules (+10 per 3 head turns, +50 book, +100 phone, ceiling 1000, threshold 100).
   - Write automated pytest tests executing all 18 acceptance scenarios in `tests/test_backend_scoring.py`.

5. **Expose Real Auth Endpoints**:
   - Implement `POST /api/v1/auth/login` and update [`Frontend/src/api/authApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/authApi.js) to connect to real backend authentication.
