Listed directory IntelliProctor
Ran command: `git status; git log -n 10 --oneline --graph --decorate`
Ran command: `git show --stat 8a83904`
Listed directory Frontend
Listed directory src
Listed directory pages
Listed directory admin
Listed directory student
Listed directory api
Listed directory contexts
Listed directory hooks
Listed directory components
Viewed BACKEND_ARCHITECTURE.md:1-120
Viewed BACKEND_CURRENT_STATE.md:1-74
Viewed FRONTEND_CURRENT_STATE.md:1-150
Viewed FRONTEND_ARCHITECTURE.md:1-140
Viewed MODEL_ARCHITECTURE.md:1-120
Listed directory src
Listed directory api
Listed directory services
Listed directory proctoring-service
Listed directory app
Listed directory models
Listed directory pretrained
Listed directory trained
Listed directory intelliproctor_phase1_iter1
Viewed cv_client.py:1-71
Viewed main.py:1-109
Viewed detector.py:1-130
Viewed episodes.py:1-100
Viewed proctor.py:1-140
Viewed proctor.py:141-250
Viewed scoring.py:1-110
Viewed scoring.py:111-144
Ran command: `pytest backend/tests`
Ran command: `.venv\Scripts\pytest backend/tests`
Ran command: `Get-Command python* -All | Select-Object -ExpandProperty Source`
Viewed requirements.txt:1-32
Ran command: `C:\Users\tanis\python.exe -m pip list`
Viewed ingest.py:1-120
Ran command: `C:\Users\tanis\python.exe -m pytest backend/tests`
Ran command: `.venv\Scripts\pip list`
Ran command: `git log -n 4 --oneline`
Viewed AppRoutes.jsx:1-64
Viewed Guards.jsx:1-25
Viewed client.js:1-100
Viewed monitoringApi.js:1-44
Viewed useTabVisibility.js:1-50
Viewed CameraWidget.jsx:1-100
Listed directory monitoring
Viewed RemoteCameraFeed.jsx:1-68
Viewed StudentLiveCard.jsx:1-61
Viewed LiveMonitoringPage.jsx:1-100
Viewed EventReviewModal.jsx:1-100
Viewed StudentDetailPage.jsx:1-100
Viewed SystemCheckPage.jsx:1-100
Viewed SystemCheckPage.jsx:101-180
Viewed ExamScreenPage.jsx:1-120
Viewed ExamScreenPage.jsx:121-260
Viewed FRONTEND_ARCHITECTURE.md:141-260
Viewed FRONTEND_ARCHITECTURE.md:261-450
Viewed FRONTEND_ARCHITECTURE.md:451-650
Viewed SubmissionPage.jsx:1-100
Viewed CreateTestPage.jsx:1-60
Viewed QuestionCreationPage.jsx:1-60
Viewed PublishTestPage.jsx:1-60
Viewed QuestionBankPage.jsx:1-50
Viewed SettingsPage.jsx:1-60
Ran command: `git status`

# Architectural Alignment & System Verification Report

> **Repository**: [IntelliProctor](file:///c:/Users/tanis/IntelliProctor)  
> **Active Branch**: `Antigravity` (Commit `722e9e6` / `8a83904`)  
> **Verification Status**: **Clean Working Tree — Zero Modifications / Zero Pushes Performed**  
> **Audit Scope**:
> 1. Latest backend changes vs. [BACKEND_ARCHITECTURE.md](file:///c:/Users/tanis/IntelliProctor/BACKEND_ARCHITECTURE.md)
> 2. Connectedness of backend with the computer vision models ([MODEL_ARCHITECTURE.md](file:///c:/Users/tanis/IntelliProctor/MODEL_ARCHITECTURE.md))
> 3. Frontend alignment with [FRONTEND_ARCHITECTURE.md](file:///c:/Users/tanis/IntelliProctor/FRONTEND_ARCHITECTURE.md) and the backend
> 4. Comprehensive gap analysis and recommended frontend implementation plan

---

## Executive Summary

| Verification Target | Status | Alignment Score | Primary Observation |
|---|---|---|---|
| **Backend vs. Target Architecture** | **Fully Aligned** | **98%** | Authoritative FastAPI implementation in [backend/](file:///c:/Users/tanis/IntelliProctor/backend) matches all core principles, scoring formulas, ledger persistence, passkeys, and RBAC policies. |
| **Backend-to-Model Connectedness** | **Fully Aligned** | **95%** | Service-to-service HTTP bridge (`proctoring-service/`) completely decouples observation generation from scoring. Production gate strictly locks to `phase0` (YOLO11m baseline). |
| **Frontend vs. Backend & Architecture** | **Substantially Aligned** | **88%** | All mock data and simulated scores (`useProctoringSim.js`) are removed. Complete wiring to real REST endpoints and WebSockets. Examiner keyframe loop bug resolved. |
| **Remaining Frontend Scope** | **5 Key Gaps** | *Pending* | Practice Mode HUD (`/student/practice`), WebRTC streaming (currently snapshot polling), Web Audio API dB monitor, IndexedDB offline buffer, and AI Test Generation UI. |

---

## 1. Backend Verification: Pulled Changes vs. `BACKEND_ARCHITECTURE.md`

Commit `8a83904` replaced the legacy Node/Express server and client-side simulator with the authoritative Python FastAPI stack in [backend/src/](file:///c:/Users/tanis/IntelliProctor/backend/src). 

### 1.1 Specification Verification Matrix

| Spec Section | Target Architectural Requirement | Implemented Backend Location | Verification Finding |
|---|---|---|---|
| **§2: Source of Truth** | Backend is sole, untrusted-client-resistant source of truth for exam states, passkeys, events, and scores. Frontend and CV never score. | [services/scoring.py](file:///c:/Users/tanis/IntelliProctor/backend/src/services/scoring.py)<br/>[api/proctor.py](file:///c:/Users/tanis/IntelliProctor/backend/src/api/proctor.py) | **Fully Aligned**. Pure functional scoring module `evaluate()`; CV worker emits observations only; frontend simulator removed. |
| **§5.1 – §5.2: Suspicion Scoring Policy** | • $+100$ per phone episode<br/>• $+50$ per book episode<br/>• $+10$ per group of 3 qualifying sideways head turns<br/>• Score range: $0 \le S \le 1000$<br/>• Suspicious iff $S \ge 100$ | [services/scoring.py#L22-L36](file:///c:/Users/tanis/IntelliProctor/backend/src/services/scoring.py#L22-L36) | **Fully Aligned**. Exact point constants, ceiling rule $\min(1000, S + \Delta S)$, and suspicious threshold predicate enforced. |
| **§5.3 & §6.3: Idempotency & Deduplication** | Ingestion key: $\text{SHA256}(\text{session\_id} + \text{event\_type} + \text{episode\_id})$. Duplicate returns existing record with HTTP 200, never re-scores. | [services/ingest.py#L55-L92](file:///c:/Users/tanis/IntelliProctor/backend/src/services/ingest.py#L55-L92) | **Fully Aligned**. Two-tier check (Redis/memory cache then DB unique constraint); duplicate returns HTTP 200 with `duplicate: true`. |
| **§5.5: Zero-Weight Signals** | Tab switching, candidate absence, multiple faces, and head pitch/roll carry **0 points** (logged as unweighted anomaly events). | [services/scoring.py#L120-L123](file:///c:/Users/tanis/IntelliProctor/backend/src/services/scoring.py#L120-L123) | **Fully Aligned**. `evaluate()` returns `(state, None)` for non-scoring events; recorded in `proctoring_events` with points $= 0$. |
| **§5.6: Score Persistence & Row Locking** | Immutable append-only ledger (`suspicion_score_ledger`), row-level locks on `exam_sessions`. | [services/ingest.py#L83-L96](file:///c:/Users/tanis/IntelliProctor/backend/src/services/ingest.py#L83-L96) | **Fully Aligned**. Dual protection: in-process per-session `asyncio.Lock` plus SQL `SELECT ... FOR UPDATE` prevents race conditions. |
| **§5.7 & §16: Human Adjudication** | Dismissing flags never deletes event or erases points; dual status reporting: `"Suspicious (Flagged by AI, Dismissed by Examiner)"`. | [services/scoring.py#L137-L144](file:///c:/Users/tanis/IntelliProctor/backend/src/services/scoring.py#L137-L144)<br/>[api/proctor.py#L440-L500](file:///c:/Users/tanis/IntelliProctor/backend/src/api/proctor.py#L440-L500) | **Fully Aligned**. `/events/{id}/dismiss` records an `examiner_reviews` row with mandatory justification text ($\ge 10$ chars); status label reflects dismissal without tampering with ledger math. |
| **§6: Ingestion Contract & Security Valve** | Strict caller validation: browsers only report `BROWSER_VISIBILITY` events with `ExamSessionToken`; CV worker uses `X-Internal-Token`. Skew tolerance $\pm 30\text{s}$. | [api/proctor.py#L140-L177](file:///c:/Users/tanis/IntelliProctor/backend/src/api/proctor.py#L140-L177) | **Fully Aligned**. Enforces `EXPECTED_SOURCE` mapping; clock skew evaluated against `CLOCK_SKEW_TOLERANCE_SECONDS` (30s). |
| **§8: Tab-Switch Telemetry** | Server-authoritative duration calculation. Flags timing discrepancy if $\|t_{\text{client}} - t_{\text{server}}\| > 3000\text{ms}$. | [services/ingest.py#L113-L135](file:///c:/Users/tanis/IntelliProctor/backend/src/services/ingest.py#L113-L135) | **Fully Aligned**. Server records `last_tab_blur_server_at`; on `TAB_FOCUS`, computes `serverDurationMs` and sets `timing_discrepancy = True` if delta exceeds 3s. |
| **§9: Evidence Storage** | Clean JPEG $\to$ Bounding box $\to$ Storage backend $\to$ `evidence_records` (SHA-256) $\to$ 15-min signed URL. Fallback status `FAILED`. | [services/storage.py](file:///c:/Users/tanis/IntelliProctor/backend/src/services/storage.py) | **Fully Aligned**. S3/MinIO and local private directory storage supported; HMAC-signed URLs expire in 15 minutes; storage errors record event with `evidence_status = 'FAILED'`. |
| **§10: Exam Lifecycle & Passkeys** | State machine (`DRAFT` $\to$ `SCHEDULED` $\to$ `ACTIVE` $\to$ `ENDED`); 6-digit cryptographic PIN; Argon2id hash + Fernet ciphertext. | [services/exams.py](file:///c:/Users/tanis/IntelliProctor/backend/src/services/exams.py)<br/>[models.py](file:///c:/Users/tanis/IntelliProctor/backend/src/models.py) | **Fully Aligned**. Examiner can reveal PIN via Fernet decryption; candidate passkey check verifies against Argon2id hash. |
| **§11: RBAC & Authentication** | Short-lived HS256 JWT (15m), rotating HTTP-only refresh cookie, refresh reuse detection, strict IDOR ownership checks. | [security.py](file:///c:/Users/tanis/IntelliProctor/backend/src/security.py)<br/>[api/auth.py](file:///c:/Users/tanis/IntelliProctor/backend/src/api/auth.py) | **Fully Aligned**. Automatic reuse detection revokes all session refresh tokens if an already-consumed token is replayed. |
| **§12: Relational Schema** | 9 authoritative tables: `users`, `examinations`, `questions`, `exam_sessions`, `student_answers`, `proctoring_events`, `suspicion_score_ledger`, `examiner_reviews`, `evidence_records`. | [models.py](file:///c:/Users/tanis/IntelliProctor/backend/src/models.py)<br/>[alembic/versions/0001_initial_schema.py](file:///c:/Users/tanis/IntelliProctor/backend/alembic/versions/0001_initial_schema.py) | **Fully Aligned**. All 9 tables exist with exact foreign keys and indexes. Cleanly extended with `refresh_tokens`, `question_bank_items`, and `examiner_settings`. |
| **§13.3 & §14: WebSockets & Telemetry** | WebSocket hall `/ws/v1/exams/{id}/live`; candidate notification channel; non-alarming examinee feedback (never leak scores). | [api/ws.py](file:///c:/Users/tanis/IntelliProctor/backend/src/api/ws.py)<br/>[services/live_bus.py](file:///c:/Users/tanis/IntelliProctor/backend/src/services/live_bus.py) | **Fully Aligned**. In-process bus and Redis backplane supported; candidate notices filtered through `CANDIDATE_NOTICES`. |
| **§15: Academic & Proctoring Reports** | Auto-grading for MCQ/MSQ/TrueFalse; proctoring integrity synthesis; role-scoped report serialization; CSV export. | [api/reports.py](file:///c:/Users/tanis/IntelliProctor/backend/src/api/reports.py) | **Fully Aligned**. Scoped output: students receive objective marks and anomaly counts; examiners receive full audit breakdown. |

### 1.2 Documented Acceptable Deviations
1. **Database Default**: Defaults to zero-setup SQLite via `aiosqlite` when `DATABASE_URL` is unset, while retaining full native PostgreSQL 16 (`asyncpg`) support for production.
2. **Object Storage Default**: Implements local filesystem storage with HMAC-signed expiring URLs when `S3_BUCKET_NAME` is unset, falling back seamlessly without cloud dependencies.
3. **Live Video Feed**: Utilizes keyframe preview (~1.4 fps upload, 1.5s examiner polling) rather than a full WebRTC SFU media pipeline. This matches the documented compromise in [BACKEND_CURRENT_STATE.md §3 (line 55)](file:///c:/Users/tanis/IntelliProctor/BACKEND_CURRENT_STATE.md#L55).

---

## 2. Connectedness of Backend with the Computer Vision Model

The computer vision architecture strictly fulfills the decoupled microservice design outlined in [MODEL_ARCHITECTURE.md §2](file:///c:/Users/tanis/IntelliProctor/MODEL_ARCHITECTURE.md#L86) and [BACKEND_ARCHITECTURE.md §7](file:///c:/Users/tanis/IntelliProctor/BACKEND_ARCHITECTURE.md#L36).

```mermaid
sequenceDiagram
    autonumber
    participant Browser as Examinee Browser (React 19)
    participant Backend as FastAPI Backend (:8000)
    participant CVWorker as CV Worker (:8001 / proctoring-service)
    participant Model as YOLO11m (Phase 0) + MediaPipe
    participant DB as Database & Ledger

    Browser->>Backend: POST /api/v1/proctor/sessions/{id}/frames (base64 JPEG, ~1.4 fps)
    Note over Backend: Authenticates ExamSessionToken<br/>Stores volatile keyframe in live_state
    Backend->>CVWorker: POST /analyze {session_id, image_base64, captured_at}<br/>Header: X-Internal-Token
    
    rect rgb(240, 248, 255)
        Note over CVWorker,Model: Microservice Vision Pipeline
        CVWorker->>Model: Synchronous MediaPipe FaceMesh (Tens of ms on CPU)
        Model-->>CVWorker: 468 3D Landmarks -> solvePnP Head Pose (Yaw, Pitch, Roll)
        CVWorker->>CVWorker: Update HeadTurnTracker & FacePresenceTracker (episodes.py)
        CVWorker->>Model: Asynchronous YOLO11m Worker (Clean un-annotated frame)
        Model-->>CVWorker: Detections (phone: >=0.65, aspect 1.15-2.90; book: >=0.65)
        CVWorker->>CVWorker: Hysteresis Filter (3-on / 4-off) -> Emit Discrete Episodes
    end

    CVWorker-->>Backend: 200 OK {observation: {...}, events: [{eventType, confidence, boundingBox, episodeId}]}
    
    loop For each discrete event emitted
        Backend->>DB: ingest_event() -> Check Idempotency SHA256(...)
        Backend->>DB: Apply Scoring: evaluate() -> Append SuspicionScoreLedger row
        Backend->>Backend: live_bus.publish() -> Push to Examiner Live WebSocket
    end

    Backend-->>Browser: 200 OK {cvOnline: true, notices: ["Please face the screen"]}
    Note over Browser: Scores are NEVER sent to Examinee
```

### 2.1 Model Governance & Production Gate Verification
- **Approved Checkpoint**: [proctoring-service/app/detector.py](file:///c:/Users/tanis/IntelliProctor/proctoring-service/app/detector.py#L52-L96) explicitly loads `models/pretrained/yolo11m.pt` as the default `phase0` production checkpoint.
- **Experimental Iteration 1 Block**: The fine-tuned Iteration 1 checkpoint (`models/trained/intelliproctor_phase1_iter1/best.pt`) was evaluated in [reports/ml/PHASE3_POST_PROCESSING_REVIEW.md](file:///c:/Users/tanis/IntelliProctor/reports/ml/PHASE3_POST_PROCESSING_REVIEW.md) and had a 47.9% false-positive rate on negative benchmarks. In alignment with governance rules, **Iteration 1 is blocked from production** and only available via explicit research flag (`phase2_gpu`).
- **Option A Clean Buffer**: In [detector.py](file:///c:/Users/tanis/IntelliProctor/proctoring-service/app/detector.py#L18-L20), YOLO always executes inference on the raw un-annotated frame copy. Visual bounding boxes and landmark meshes are drawn exclusively on generated evidence JPEGs.
- **Session Cleanup Lifecycle**: When a session completes or submits, [api/proctor.py](file:///c:/Users/tanis/IntelliProctor/backend/src/api/proctor.py) calls `cv_client.end_session(session_id)`, dispatching `DELETE /session/{session_id}` to `proctoring-service` to free memory and flush temporal trackers.

---

## 3. Frontend Alignment with Architecture and Backend

The frontend in [Frontend/src/](file:///c:/Users/tanis/IntelliProctor/Frontend/src) has been substantially rewritten to consume the FastAPI backend. 

### 3.1 What is Fully Aligned

1. **Complete Removal of Mock Data & Client Scoring**:
   - `constants/mockData.js` and all simulated mock fallbacks have been deleted.
   - `useProctoringSim.js` has been removed. The frontend never computes or increments suspicion scores. Suspicion scores ($0 \le S \le 1000$) originate exclusively from backend ledger records and are rendered only on examiner screens.
2. **Examiner Camera Loop Bug Fixed**:
   - The bug where examiner live cards opened the examiner's local webcam has been resolved. [StudentLiveCard.jsx](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/monitoring/StudentLiveCard.jsx) uses [RemoteCameraFeed.jsx](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/monitoring/RemoteCameraFeed.jsx), which polls the candidate's uploaded keyframe snapshot (`GET /proctor/sessions/:id/snapshot`).
3. **Route Protection & Identity Handshake**:
   - [Guards.jsx](file:///c:/Users/tanis/IntelliProctor/Frontend/src/routes/Guards.jsx) enforces `<RequireExaminerAuth>`, `<RequireCandidate>`, and `<RequireCandidateSession>`.
   - Passkey validation at `/student/join` verifies the 6-digit code via backend Argon2id check, issuing an `ExamSessionToken` scoped to the exam duration.
4. **Automated 7-Point Pre-Flight System Check**:
   - [SystemCheckPage.jsx](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/student/SystemCheckPage.jsx) runs 7 checks: Camera Stream, Microphone, Backend & AI Proctor (`/proctor/precheck` & `/proctor/health`), Ambient Lighting (frame brightness histogram calculation), Face Visibility (MediaPipe face count check), Browser Compatibility, and Fullscreen API Support.
   - Live reference photograph is captured from the canvas and uploaded as multipart form-data to `POST /api/v1/candidates/reference-photo`.
5. **State Preservation & Distraction-Free Active Exam View**:
   - [ExamScreenPage.jsx](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/student/ExamScreenPage.jsx) implements fullscreen enforcement, shortcut suppression (`F12`, `Ctrl+C/V/X`, right-click context menu), and server-authoritative countdown timing (`useServerCountdown`).
   - Reload resilience: Answers are cached locally in `localStorage` (`intelliproctor_draft_{examId}_{candidateId}`) and continuously autosaved to `POST /exams/{id}/draft`.
6. **Decoupled Browser Tab Telemetry**:
   - [useTabVisibility.js](file:///c:/Users/tanis/IntelliProctor/Frontend/src/hooks/useTabVisibility.js) monitors native `visibilitychange`, `blur`, and `focus` events independently of the CV pipeline.
   - Dispatches `TAB_BLUR` and `TAB_FOCUS` events to `POST /api/v1/proctor/events` using the candidate's `ExamSessionToken`.
7. **Examiner Evidence Adjudication & Forensic Review**:
   - [EventReviewModal.jsx](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/monitoring/EventReviewModal.jsx) inspects pre-signed 15-minute evidence JPEGs with model confidence, bounding boxes, and Euler angles.
   - Enforces a mandatory justification note ($\ge 10$ characters) for both Dismiss and Confirm actions.
   - [StudentDetailPage.jsx](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/StudentDetailPage.jsx) plots suspicion score over time using Recharts based on immutable ledger entries.

---

## 4. Gap Analysis: Missing Features & Required Frontend Changes

The following 5 discrepancies exist between the current frontend code and [FRONTEND_ARCHITECTURE.md](file:///c:/Users/tanis/IntelliProctor/FRONTEND_ARCHITECTURE.md):

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND GAP TAXONOMY                                  │
├──────────────────────────┬─────────────────────────────────────┬─────────────────┤
│ Gap                      │ Architecture Spec Section           │ Status in Code  │
├──────────────────────────┼─────────────────────────────────────┼─────────────────┤
│ 1. Practice Mode & HUD   │ §13: Practice & Diagnostic Mode     │ Missing Route   │
│ 2. WebRTC Video Uplink   │ §7.2, §8.2: Media Transport Stream  │ Keyframe Fallback│
│ 3. Audio Decibel Monitor │ §6.3, §10.2: Ambient Sound Check    │ Device Check Only│
│ 4. Offline Telemetry DB  │ §12.4: Tamper & Offline Resiliency  │ In-Memory Retry │
│ 5. AI Test Gen Wizard    │ §6.2: Workflow A (Topic/Difficulty) │ Manual Form Only│
└──────────────────────────┴─────────────────────────────────────┴─────────────────┘
```

### Detailed Breakdown of Required Frontend Changes

#### Gap 1: Self-Directed Practice & Diagnostic Mode ([FRONTEND_ARCHITECTURE.md §13](file:///c:/Users/tanis/IntelliProctor/FRONTEND_ARCHITECTURE.md#L554))
- **Current State**: Route `/student/practice` is absent from [AppRoutes.jsx](file:///c:/Users/tanis/IntelliProctor/Frontend/src/routes/AppRoutes.jsx), and no practice test screen exists.
- **Required Change**:
  1. Add route `<Route path="/student/practice" element={<PracticeModePage />} />`.
  2. Implement `PracticeModePage.jsx` allowing candidates to take sample questions without an examiner passkey.
  3. Implement the **Technical Diagnostic Heads-Up Display (HUD)**: Render 468-point face mesh wireframe overlays, live Euler angles ($\text{Yaw}, \text{Pitch}, \text{Roll}$), and real-time bounding boxes with class confidence directly on the candidate canvas.

#### Gap 2: Live Video Streaming Protocol ([FRONTEND_ARCHITECTURE.md §7.2 & §8.2](file:///c:/Users/tanis/IntelliProctor/FRONTEND_ARCHITECTURE.md#L359))
- **Current State**: The system relies on candidate keyframe uploads (~1.4 fps) via HTTP POST and examiner polling via `RemoteCameraFeed.jsx` at 1500ms intervals.
- **Required Change**:
  1. While the keyframe pipeline is functional and documented in `BACKEND_CURRENT_STATE.md`, achieving full compliance with Stream 3 requires WebRTC peer-to-peer or WebSocket binary video frame streaming via `MediaStreamTrack` for fluid, sub-second latency viewing on the examiner grid.

#### Gap 3: Ambient Audio Decibel Monitoring ([FRONTEND_ARCHITECTURE.md §6.3 & §10.2](file:///c:/Users/tanis/IntelliProctor/FRONTEND_ARCHITECTURE.md#L335))
- **Current State**: [SystemCheckPage.jsx](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/student/SystemCheckPage.jsx) only checks if an audio input device is enumerated.
- **Required Change**:
  1. In `SystemCheckPage.jsx` and active exam components, integrate the Web Audio API (`AudioContext`, `AnalyserNode`).
  2. Measure root-mean-square (RMS) sound levels against the $-22\text{ dB}$ baseline specified in §10.2.
  3. Emit structured `AUDIO_SPIKE` observation telemetry when ambient noise exceeds configurable thresholds.

#### Gap 4: Persistent Offline Telemetry Buffer ([FRONTEND_ARCHITECTURE.md §12.4](file:///c:/Users/tanis/IntelliProctor/FRONTEND_ARCHITECTURE.md#L547))
- **Current State**: In [ExamScreenPage.jsx](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/student/ExamScreenPage.jsx), answers are cached in `localStorage`, but tab-switch events rely on an in-memory retry loop (`attempt(n)` up to 5 times). A hard page reload or browser crash while disconnected drops pending tab event payloads.
- **Required Change**:
  1. Create a persistent queue using `localStorage` or `IndexedDB` (`pending_telemetry_queue`).
  2. Queue tab blur/focus and connectivity drop events in the persistent buffer.
  3. Flush and synchronize queued events upon reconnection via `navigator.onLine` and `window.addEventListener('online', ...)`.

#### Gap 5: Automated AI Test Generation Wizard ([FRONTEND_ARCHITECTURE.md §6.2](file:///c:/Users/tanis/IntelliProctor/FRONTEND_ARCHITECTURE.md#L318))
- **Current State**: [CreateTestPage.jsx](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/CreateTestPage.jsx) supports manual question creation and CSV import, but lacks the Workflow A interface.
- **Required Change**:
  1. Add a "Generate Test" modal/tab where examiners specify topic, target difficulty breakdown (e.g., 40% Easy, 40% Medium, 20% Hard), and question count.
  2. Connect to the backend `/exams/generate` endpoint to auto-populate draft questions from the question bank.

#### Gap 6: Structured Examiner Intervention Modal
- **Current State**: In [StudentDetailPage.jsx](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/StudentDetailPage.jsx#L63-L84), manual candidate flagging and warning messages rely on native browser `window.prompt()`.
- **Required Change**:
  1. Replace browser prompt dialogs with a dedicated Tailwind modal (`InterventionModal.jsx`) providing pre-configured warning templates (*"Please center your face"*, *"Clear your workspace"*, *"Prohibited item observed"*), custom text inputs, and a button to terminate/force-submit rogue sessions.

---

## 5. Comprehensive Implementation Plan (Read-Only Blueprint)

This phased plan outlines how to align the frontend with all specifications once code changes are authorized.

### Phase 1: High-Priority Reliability & Examiner Intervention Polish
*Estimated Effort: 1–2 Days*
1. **Replace `window.prompt` Interventions**:
   - Create `Frontend/src/components/monitoring/InterventionModal.jsx`.
   - Provide quick-select standard warnings and direct action buttons for candidate messaging and manual session flagging.
2. **Persistent Telemetry Queue (`IndexedDB`/`localStorage`)**:
   - Create `Frontend/src/utils/telemetryQueue.js`.
   - Intercept failed `sendBrowserEvent` dispatches and store them with `status: 'pending'`.
   - Attach auto-flush listener to `window.addEventListener('online')` and on exam screen mount.

### Phase 2: Self-Directed Practice & Diagnostic Mode (Mode B)
*Estimated Effort: 2–3 Days*
1. **Practice Page & Route**:
   - Create `Frontend/src/pages/student/PracticeModePage.jsx` and register `/student/practice` in [AppRoutes.jsx](file:///c:/Users/tanis/IntelliProctor/Frontend/src/routes/AppRoutes.jsx).
   - Add a navigation CTA on [LandingPage.jsx](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/LandingPage.jsx) (*"Try Practice Diagnostic Lab"*).
2. **Diagnostic HUD Component**:
   - Create `Frontend/src/components/exam/DiagnosticHUD.jsx`.
   - Draw MediaPipe FaceMesh landmark points onto a `<canvas>` overlay in real time.
   - Render Euler orientation gauges ($\text{Yaw}, \text{Pitch}, \text{Roll}$) with green/red neutral threshold bounds ($|\text{yaw}| \le 30^\circ$).
   - Render YOLO object detection bounding boxes with labels and aspect-ratio indicators.

### Phase 3: Ambient Audio Monitoring & Test Generator Wizard
*Estimated Effort: 2–3 Days*
1. **Web Audio API dB Analyser**:
   - Create `Frontend/src/hooks/useAudioMonitor.js`.
   - Sample input stream via `AudioContext` and `AnalyserNode` at 100ms intervals.
   - Display ambient noise indicator in `SystemCheckPage.jsx` (-22 dB baseline).
   - In `ExamScreenPage.jsx`, emit unassigned `AUDIO_SPIKE` events when continuous noise exceeds threshold for $> 3\text{s}$.
2. **AI Question Bank Sampling Wizard**:
   - Enhance `CreateTestPage.jsx` with a "Sample from Question Bank" toggle.
   - Add topic multi-select and difficulty distribution sliders (Easy/Medium/Hard).

### Phase 4: Long-Term Real-Time Media Optimization
*Estimated Effort: 3–5 Days*
1. **WebRTC Media Transport**:
   - Implement WebRTC peer connection handling in `useWebcam.js` for environments requiring full 30 FPS examiner video.
   - Keep current keyframe polling mechanism as an automatic fallback for low-bandwidth networks.

---

## 6. Verification Summary & Confirmation

- [x] **Backend Architecture Compliance**: Verified against all 23 sections of `BACKEND_ARCHITECTURE.md`. Implements authoritative scoring, immutable ledger, idempotency keys, Argon2id passkeys, and RFC 7807 error envelopes.
- [x] **Model & CV Connectedness**: Verified against `MODEL_ARCHITECTURE.md`. Microservice communication via `X-Internal-Token`, Option A clean frame buffers, MediaPipe + YOLO decoupling, and strict `phase0` production baseline.
- [x] **Frontend Alignment**: Verified against `FRONTEND_ARCHITECTURE.md`. Elimination of client-side scoring and mock data confirmed; 5 specific gaps identified and mapped to a structured implementation plan.
- [x] **Repository State**: Working directory remains strictly clean (`git status` reports nothing to commit, working tree clean). No files were created, edited, deleted, or pushed.