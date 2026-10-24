# IntelliProctor — Master Backend Architecture Specification

> **Document Version**: 1.0.0  
> **Repository Root**: [`c:\Users\tanis\IntelliProctor`](file:///c:/Users/tanis/IntelliProctor)  
> **System Architecture Reference**: Root [`README.md`](file:///c:/Users/tanis/IntelliProctor/README.md)  
> **Frontend Companion Specifications**: [`FRONTEND_ARCHITECTURE.md`](file:///c:/Users/tanis/IntelliProctor/FRONTEND_ARCHITECTURE.md) & [`FRONTEND_CURRENT_STATE.md`](file:///c:/Users/tanis/IntelliProctor/FRONTEND_CURRENT_STATE.md)  
> **Audit Companion**: [`BACKEND_CURRENT_STATE.md`](file:///c:/Users/tanis/IntelliProctor/BACKEND_CURRENT_STATE.md)  
> **Status**: **AUTHORITATIVE TARGET SPECIFICATION — IMPLEMENTED** in [`backend/`](backend/README.md) (Oct 2026). Verified status per section: [`BACKEND_CURRENT_STATE.md`](BACKEND_CURRENT_STATE.md).

---

## Table of Contents

1. [Purpose & Architectural Authority](#1-purpose--architectural-authority)
2. [Core Architectural Principle: The Backend is the Source of Truth](#2-core-architectural-principle-the-backend-is-the-source-of-truth)
3. [High-Level Target Architecture](#3-high-level-target-architecture)
   - [3.1 Logical Architecture & Subsystems](#31-logical-architecture--subsystems)
   - [3.2 Component Architecture Diagram](#32-component-architecture-diagram)
   - [3.3 Process & Deployment Boundaries](#33-process--deployment-boundaries)
4. [Responsibility Boundaries: Frontend, Model, & Backend](#4-responsibility-boundaries-frontend-model--backend)
   - [4.1 Frontend Responsibilities](#41-frontend-responsibilities)
   - [4.2 Computer Vision Responsibilities](#42-computer-vision-responsibilities)
   - [4.3 Backend Responsibilities](#43-backend-responsibilities)
5. [Mandatory Suspicion-Scoring Policy](#5-mandatory-suspicion-scoring-policy)
   - [5.1 Score Range & Suspicious Threshold](#51-score-range--suspicious-threshold)
   - [5.2 Required Scoring Rules & Weights](#52-required-scoring-rules--weights)
   - [5.3 Event Deduplication & Temporal Grouping](#53-event-deduplication--temporal-grouping)
   - [5.4 Scoring Examples Matrix](#54-scoring-examples-matrix)
   - [5.5 Signals Without Assigned Numerical Weight](#55-signals-without-assigned-numerical-weight)
   - [5.6 Score Persistence & Auditable Ledger](#56-score-persistence--auditable-ledger)
   - [5.7 Human Review & Score Integrity](#57-human-review--score-integrity)
6. [Backend Event-Ingestion Architecture](#6-backend-event-ingestion-architecture)
   - [6.1 Ingestion Pipeline Overview](#61-ingestion-pipeline-overview)
   - [6.2 Ingestion Data Contract](#62-ingestion-data-contract)
   - [6.3 Idempotency & Validation Rules](#63-idempotency--validation-rules)
7. [Computer Vision Integration & Model Lifecycle](#7-computer-vision-integration--model-lifecycle)
   - [7.1 Decoupled Vision Architecture](#71-decoupled-vision-architecture)
   - [7.2 Active Model Checkpoint & Baseline](#72-active-model-checkpoint--baseline)
   - [7.3 Model Lifecycle Protection Policy](#73-model-lifecycle-protection-policy)
8. [Browser Tab-Switch Monitoring Integration](#8-browser-tab-switch-monitoring-integration)
   - [8.1 Independent DOM Observation Flow](#81-independent-dom-observation-flow)
   - [8.2 Server-Side Verification & Timing](#82-server-side-verification--timing)
   - [8.3 Policy Decoupling](#83-policy-decoupling)
9. [Evidence & Screenshot Persistence](#9-evidence--screenshot-persistence)
   - [9.1 Six-Stage Evidence Lifecycle](#91-six-stage-evidence-lifecycle)
   - [9.2 Secure Storage Architecture](#92-secure-storage-architecture)
   - [9.3 Storage Reference Data Model](#93-storage-reference-data-model)
10. [Examination Lifecycle & Passkey Engine](#10-examination-lifecycle--passkey-engine)
    - [10.1 Examination State Machine](#101-examination-state-machine)
    - [10.2 Cryptographic Passkey Engine](#102-cryptographic-passkey-engine)
    - [10.3 Session Admission & Token Issuance](#103-session-admission--token-issuance)
11. [Authentication & Role-Based Authorization](#11-authentication--role-based-authorization)
    - [11.1 RBAC Model](#111-rbac-model)
    - [11.2 JWT Token Strategy & Rotation](#112-jwt-token-strategy--rotation)
    - [11.3 Resource-Level Isolation](#113-resource-level-isolation)
12. [Database & Persistence Architecture](#12-database--persistence-architecture)
    - [12.1 Target Relational Schema (PostgreSQL)](#121-target-relational-schema-postgresql)
    - [12.2 Entity-Relationship Diagram](#122-entity-relationship-diagram)
    - [12.3 Indexing, Concurrency, & Transactions](#123-indexing-concurrency--transactions)
13. [Backend API & Service Architecture](#13-backend-api--service-architecture)
    - [13.1 Service Layer Boundaries](#131-service-layer-boundaries)
    - [13.2 REST API Endpoint Catalog (`/api/v1`)](#132-rest-api-endpoint-catalog-apiv1)
    - [13.3 WebSocket Protocols (`/ws/v1`)](#133-websocket-protocols-wsv1)
14. [Live Updates, Alerts, & Telemetry Streaming](#14-live-updates-alerts--telemetry-streaming)
    - [14.1 Examiner Hall Real-Time Feed](#141-examiner-hall-real-time-feed)
    - [14.2 Examinee Notification Channel](#142-examinee-notification-channel)
    - [14.3 WebRTC Video Streaming Path](#143-webrtc-video-streaming-path)
15. [Reports & Result Generation Service](#15-reports--result-generation-service)
    - [15.1 Academic Evaluation Pipeline](#151-academic-evaluation-pipeline)
    - [15.2 Proctoring Integrity Synthesis](#152-proctoring-integrity-synthesis)
    - [15.3 Report Authorization Profiles](#153-report-authorization-profiles)
16. [Examiner Review & Dismissal Engine](#16-examiner-review--dismissal-engine)
    - [16.1 Audit Trail & Justification](#161-audit-trail--justification)
    - [16.2 Score Decoupling Principle](#162-score-decoupling-principle)
17. [Error Handling, Fault Tolerance, & Reliability](#17-error-handling-fault-tolerance--reliability)
    - [17.1 Standardized API Error Envelope](#171-standardized-api-error-envelope)
    - [17.2 Failure Mode Matrix](#172-failure-mode-matrix)
18. [Security, Privacy, & Candidate Data Protection](#18-security-privacy--candidate-data-protection)
    - [18.1 Biometric & Video Data Governance](#181-biometric--video-data-governance)
    - [18.2 Anti-Tamper & Replay Protection](#182-anti-tamper--replay-protection)
19. [Performance & Scalability Targets](#19-performance--scalability-targets)
    - [19.1 Concurrency Sizing](#191-concurrency-sizing)
    - [19.2 Caching & Asynchronous Queues](#192-caching--asynchronous-queues)
20. [Development, Testing, & Deployment Operations](#20-development-testing--deployment-operations)
    - [20.1 Recommended Technology Stack](#201-recommended-technology-stack)
    - [20.2 Environment Configuration](#202-environment-configuration)
    - [20.3 Database Migrations & Commands](#203-database-migrations--commands)
21. [Acceptance Test Scenarios](#21-acceptance-test-scenarios)
22. [Implementation Roadmap & Phased Delivery](#22-implementation-roadmap--phased-delivery)
23. [Mandatory Guidance for Future Backend Agents](#23-mandatory-guidance-for-future-backend-agents)

---

## 1. Purpose & Architectural Authority

This document defines the **authoritative target backend architecture for IntelliProctor**.

The backend serves as the centralized, authoritative engine connecting the user interfaces, computer-vision processing pipeline, persistent relational storage, object storage, real-time telemetry feeds, suspicion-scoring engine, and post-examination reporting.

This document establishes the official architectural boundaries, API contracts, database schemas, scoring formulas, and security protocols. All future backend development, API refactoring, model integration, and testing must strictly follow this specification in coordination with the root [`README.md`](file:///c:/Users/tanis/IntelliProctor/README.md) and [`FRONTEND_ARCHITECTURE.md`](file:///c:/Users/tanis/IntelliProctor/FRONTEND_ARCHITECTURE.md).

> [!IMPORTANT]
> **Specification vs. Implementation**: This document describes the target architecture. It has been implemented in `backend/` (FastAPI) and `proctoring-service/` (CV worker); see [`BACKEND_CURRENT_STATE.md`](BACKEND_CURRENT_STATE.md) for the verified, section-by-section status and the few documented deviations (SQLite default, optional Redis/S3, keyframe video instead of WebRTC).

---

## 2. Core Architectural Principle: The Backend is the Source of Truth

The foundational design invariant of IntelliProctor is:

> **The backend is the sole, untrusted-client-resistant source of truth for all examination states, candidate authorizations, proctoring events, evidence integrity, and suspicion scores.**

### State Ownership Matrix

| System Domain | Authoritative Owner | Role of Frontend | Role of Computer Vision Pipeline |
|---|---|---|---|
| **Identity & Authentication** | **Backend** | Collects credentials; stores bearer JWT. | *None* |
| **Candidate Reference Photos** | **Backend** | Captures snapshot canvas; uploads via HTTPS. | Encodes baseline facial embeddings (planned). |
| **Exam Lifecycle & Timing** | **Backend** | Renders countdown; disables inputs on expiry. | *None* |
| **Passkey Validation** | **Backend** | Inputs 6-digit PIN; transmits to API. | *None* |
| **Questions & Answers** | **Backend** | Renders questions; caches local answer drafts. | *None* |
| **Proctoring Telemetry Ingestion**| **Backend** | Emits browser tab/window focus events. | Emits YOLO & MediaPipe detection events. |
| **Evidence / Screenshot Store** | **Backend** | Renders signed URLs inside authorized views. | Generates candidate JPEG frames upon anomaly. |
| **Authoritative Suspicion Score**| **Backend** | **Displays backend score; NEVER calculates.** | **Emits observations; NEVER scores.** |
| **Suspicious Classification** | **Backend** | Renders status badge (`S >= 100`). | *None* |
| **Examiner Review & Dismissal** | **Backend** | Renders review action; submits justification. | *None* |
| **Post-Exam Reports** | **Backend** | Renders authorized report view. | *None* |

### Absolute Prohibitions
1. **No Client-Side Scoring**: The frontend must never calculate, increment, decrement, or adjust candidate suspicion scores.
2. **No Model-Side Scoring**: The computer-vision pipeline (`video_input_analysis.py` or inference workers) must never assign point values or decide if a candidate is "cheating". It emits raw, structured observations.
3. **No Unauthenticated Event Submission**: Every proctoring event (browser or CV) must be cryptographically authenticated and bound to an active `session_id`.
4. **No Silent State Overwrites**: Human dismissal of false positives must update review metadata while preserving original model detections, screenshots, and automated score logs.

---

## 3. High-Level Target Architecture

### 3.1 Logical Architecture & Subsystems

The target IntelliProctor backend architecture consists of six core subsystems:
1. **Gateway & API Transport Layer**: Fast, asynchronous HTTP/WebSocket gateway handling CORS, SSL termination, rate limiting, and JWT authentication.
2. **Examination Management Subsystem**: Handles examination authoring, AI/question-bank compilation, scheduling, cryptographic passkey verification, and candidate attempt lifecycle.
3. **Event Ingestion & Deduplication Pipeline**: Ingests high-frequency telemetry from both CV inference workers and browser Page Visibility hooks, deduplicating repeated frame detections into discrete episodes.
4. **Authoritative Suspicion-Scoring Engine**: Evaluates accepted anomaly episodes against the official scoring rules, manages the non-decreasing score ledger ($0 \le S \le 1000$), enforces the suspicious threshold ($S \ge 100$), and publishes live score updates.
5. **Evidence & Object Storage Subsystem**: Securely stores candidate reference photographs and anomaly screenshots in an S3-compatible object store (e.g., MinIO or AWS S3), issuing time-bound pre-signed URLs for examiner review.
6. **Live Telemetry & Examiner Broadcasting Service**: Maintains real-time WebSocket multiplexing between active examinees and examiner monitoring halls.

### 3.2 Component Architecture Diagram

```mermaid
flowchart TD
    subgraph ClientLayer["Untrusted Client Layer"]
        CandidateBrowser["Examinee Browser<br/>(React 19 / Vite)<br/>• Local Camera Preview<br/>• Tab Visibility Hook<br/>• Answer Drafts"]
        ExaminerBrowser["Examiner Browser<br/>(React 19 / Vite)<br/>• Live Monitoring Hall<br/>• Evidence Review<br/>• Exam Creator"]
    end

    subgraph GatewayLayer["Gateway & Security Perimeter"]
        APIGateway["FastAPI Gateway / Reverse Proxy<br/>• JWT Authentication & RBAC<br/>• Rate Limiting & SSL<br/>• Route Routing (/api/v1, /ws/v1)"]
    end

    subgraph CoreBackend["IntelliProctor Central Backend Engine (Python / FastAPI)"]
        AuthService["Auth & Identity Service<br/>• Password Hashing (Argon2)<br/>• JWT Minting & Refresh<br/>• Profile Management"]
        ExamService["Exam Lifecycle Service<br/>• Passkey Validation<br/>• Question Delivery<br/>• Answer Persistence & Submission"]
        EventIngestService["Event Ingestion & Deduplication<br/>• Session Verification<br/>• Episode Grouping<br/>• Cooldown Filtering"]
        ScoringEngine["Authoritative Scoring Engine<br/>• Rule Evaluation (+10, +50, +100)<br/>• Score Ledger ($0 \le S \le 1000$)<br/>• Threshold Check ($S \ge 100$)"]
        ReviewService["Examiner Review Service<br/>• Event Dismissal<br/>• Audit Trail Recording<br/>• Report Generation"]
        LivePubSub["Live Telemetry Broadcaster<br/>• WebSocket Multiplexer<br/>• Redis Pub/Sub Backplane"]
    end

    subgraph VisionSubsystem["Computer Vision Inference Subsystem"]
        WebRTCServer["Media Relay / WebRTC Gateway<br/>(aiortc / MediaMTX)"]
        CVWorker["CV Inference Engine (video_input_analysis.py)<br/>• Decoupled Frame Capture<br/>• MediaPipe Face Mesh (6-pt PnP)<br/>• YOLO11m Object Detector (Phase 0)<br/>• Temporal Hysteresis Filter (3-on/4-off)"]
    end

    subgraph PersistenceLayer["Authoritative Persistence Layer"]
        PostgresDB[(PostgreSQL 16 Relational DB<br/>• Users & Exam Sessions<br/>• Questions & Answers<br/>• Proctoring Events & Ledger<br/>• Audit Trails & Dismissals)]
        ObjectStore[(S3-Compatible Object Storage<br/>(MinIO / AWS S3)<br/>• Candidate Reference Photos<br/>• Anomaly Screenshot JPEGs)]
        RedisCache[(Redis 7 In-Memory Cache<br/>• Session State & Passkeys<br/>• Deduplication Cooldown Keys<br/>• Live Telemetry Pub/Sub)]
    end

    %% Client Interactions
    CandidateBrowser -->|HTTPS REST: Answers & Tab Events| APIGateway
    CandidateBrowser -->|WebRTC / Media Stream| WebRTCServer
    ExaminerBrowser -->|HTTPS REST: Review & Exam Mgmt| APIGateway
    ExaminerBrowser <-->|WSS: Live Candidate Telemetry| APIGateway

    %% Gateway Routing
    APIGateway --> AuthService
    APIGateway --> ExamService
    APIGateway --> EventIngestService
    APIGateway --> ReviewService
    APIGateway <--> LivePubSub

    %% CV Flow
    WebRTCServer --> CVWorker
    CVWorker -->|Structured Observation Events & JPEG Evidence| EventIngestService

    %% Core Engine Interconnections
    EventIngestService --> ScoringEngine
    ScoringEngine --> PostgresDB
    ScoringEngine --> LivePubSub
    ExamService --> PostgresDB
    AuthService --> PostgresDB
    ReviewService --> PostgresDB
    ReviewService --> ObjectStore
    EventIngestService --> ObjectStore
    LivePubSub <--> RedisCache
```

### 3.3 Process & Deployment Boundaries
- **Modular Monolith Baseline**: To maximize development velocity and simplify transactions, the target backend runs as a unified FastAPI ASGI application.
- **Inference Process Separation**: The CV inference pipeline (`video_input_analysis.py`) runs as a separate, GPU-accelerated worker process (or cluster of workers) communicating with the backend gateway via authenticated internal gRPC or REST over mTLS.
- **Stateless Application Servers**: All session data, deduplication keys, and live candidate rosters reside in Redis and PostgreSQL, allowing the API gateway to scale horizontally across multiple container instances.

---

## 4. Responsibility Boundaries: Frontend, Model, & Backend

```
+---------------------------------------------------------------------------------------+
|                               RESPONSIBILITY BOUNDARIES                               |
+---------------------------------------------------------------------------------------+
| FRONTEND                                                                              |
|   • Capture local webcam preview (HTML5 <video>)                                      |
|   • Capture browser Page Visibility API events (hidden/visible)                       |
|   • Render questions, collect answers, manage local draft caching                     |
|   • Display backend-generated scores, alarms, and candidate reports                   |
|   X NEVER calculate suspicion scores                                                  |
|   X NEVER authorize exam entry without backend token                                  |
+---------------------------------------------------------------------------------------+
| COMPUTER VISION PIPELINE                                                              |
|   • Perform YOLO11m inference (detect cell phone, book)                               |
|   • Perform MediaPipe Face Mesh tracking (yaw, pitch, roll via solvePnP)              |
|   • Track face count (no face, single face, multiple faces)                           |
|   • Generate evidence JPEG screenshots upon threshold breach                          |
|   X NEVER assign point values (+10, +50, +100)                                        |
|   X NEVER classify a candidate as "Suspicious"                                       |
+---------------------------------------------------------------------------------------+
| BACKEND ENGINE (SOURCE OF TRUTH)                                                      |
|   • Authenticate session tokens and validate candidate identity                       |
|   • Ingest, validate, and deduplicate CV and browser events                           |
|   • Apply mandatory scoring rules (+10 per 3 turns, +50 book, +100 phone)             |
|   • Enforce hard score ceiling (1000) and suspicious threshold (S >= 100)             |
|   • Maintain immutable score ledger and persist evidence metadata                     |
|   • Enforce examiner review decisions and preserve audit trail                        |
+---------------------------------------------------------------------------------------+
```

### 4.1 Frontend Responsibilities
The frontend client operates in an inherently untrusted execution environment (the candidate's web browser). Its responsibilities are strictly limited to user interaction, local media acquisition, and telemetry reporting:
- Acquire user media (`navigator.mediaDevices.getUserMedia`) for local candidate preview.
- Monitor DOM visibility transitions (`document.visibilitychange`, window `blur`/`focus`) and report timestamped occurrences.
- Cache candidate answer drafts locally to protect against network drops.
- Render backend-authorized questions, timers, examiner notifications, and final reports.
- **Explicit Prohibitions**:
  - The frontend must never calculate, increment, or decrement the candidate suspicion score.
  - The frontend must never grant exam entry based on local passkey matching.
  - The frontend must never store authoritative exam results or evidence metadata.

### 4.2 Computer Vision Responsibilities
The computer vision layer (`video_input_analysis.py`) is an observation generator, not a judicial authority:
- Decode video streams from candidate webcams.
- Execute MediaPipe Face Mesh 3D head pose estimation using `cv2.solvePnP` against the 6 generic facial landmark coordinates.
- Execute YOLO11m object detection on clean, unannotated frames to detect cell phones and books.
- Apply temporal hysteresis filtering (3-frame activation, 4-frame deactivation) to prevent detection flicker.
- Capture raw JPEG evidence frames with bounding-box annotations when an anomaly is confirmed.
- **Explicit Prohibitions**:
  - The CV pipeline must never calculate suspicion scores or apply point weights.
  - The CV pipeline must never declare a candidate "Suspicious".
  - The CV pipeline must never dismiss or alter historical detection events.

### 4.3 Backend Responsibilities
The backend coordinates all system components and maintains data integrity:
- Validate that incoming events belong to an active, non-expired candidate session.
- Group repeated frame detections into discrete, timestamped anomaly episodes.
- Execute the authoritative scoring engine and update the candidate score ledger.
- Determine official suspicious status ($S \ge 100$).
- Persist evidence metadata in PostgreSQL and raw image bytes in S3 object storage.
- Manage examiner review workflows, maintaining separate fields for automated flags versus human dismissals.
- Deliver synchronized live updates to examiner dashboards via WebSockets.

---

## 5. Mandatory Suspicion-Scoring Policy

This section specifies the **official, non-negotiable target scoring algorithm** for IntelliProctor. All future backend services and database triggers must implement these exact mathematical rules.

### 5.1 Score Range & Suspicious Threshold

Every candidate examination attempt maintains an independent cumulative suspicion score, denoted as $S$:

$$0 \le S \le 1000$$

1. **Score Range**: The score starts at $S = 0$ upon session initialization and is monotonically non-decreasing during automated event processing.
2. **Hard Ceiling**: The score is subject to an absolute upper bound of $1000$. If an accepted scoring event would cause $S > 1000$, the cumulative score is capped at exactly $1000$:
   $$S_{new} = \min(1000, S_{current} + \Delta S)$$
3. **Suspicious Classification Threshold**: A candidate is classified as **Suspicious** if and only if the cumulative score $S \ge 100$:
   $$\text{Suspicious Status} = \begin{cases} \text{False}, & S < 100 \\ \text{True}, & S \ge 100 \end{cases}$$
4. **Sub-Threshold Significance**: A score below 100 ($0 < S < 100$) indicates that anomalies were detected (e.g., one book episode or 3–27 sideways head turns) but did not cross the threshold. All contributing events must remain fully recorded in the audit trail.

### 5.2 Required Scoring Rules & Weights

The backend must evaluate incoming events against the following strict point values:

| Qualifying Event Type | Scoring Rule Specification | Score Increment ($\Delta S$) |
|---|---|:---:|
| **Sideways Head Turns** | Each **completed group of three (3)** qualifying sideways-turn events within the same exam attempt. | **+10** |
| **Phone Detected** | Each **distinct accepted phone-detection episode** confirmed by CV pipeline. | **+100** |
| **Book Detected** | Each **distinct accepted book-detection episode** confirmed by CV pipeline. | **+50** |

#### Head Turn Qualification Criteria
- A single sideways head-turn event is counted when the head pose exceeds the neutral yaw threshold ($|\text{Yaw}| > 30.0^\circ$) continuously for a qualifying duration (minimum $1.0\text{ s}$ dwell time) and subsequently returns to the neutral range ($|\text{Yaw}| \le 30.0^\circ$).
- Every completed group of 3 qualifying events adds 10 points:
  - 1 or 2 turns: $\Delta S = 0$ (recorded in event log, pending counter = 1 or 2).
  - 3 turns: $\Delta S = +10$ (counter resets to 0, cumulative turns = 3).
  - 6 turns: $\Delta S = +10$ (total added: 20 points).
  - 9 turns: $\Delta S = +10$ (total added: 30 points).
- Individual frames showing a turned head must **never** be counted as separate events.

#### Phone & Book Episode Qualification Criteria
- A detection episode begins when YOLO11m detects the prohibited object with confidence $\ge 0.65$ and valid aspect ratio (Phone: $1.15 \le AR \le 2.90$; Book: $0.80 \le AR \le 2.50$) across 3 consecutive inference frames (temporal hysteresis filter activation).
- The episode remains active as long as the object is detected.
- Consecutive frames during the same episode contribute **zero additional points**.
- A new episode for the same object class can only begin after the object has disappeared for at least the configured deactivation cooldown (minimum 4 consecutive clean frames plus a 5.0-second temporal guard).

### 5.3 Event Deduplication & Temporal Grouping

The backend must strictly enforce a 4-tier abstraction hierarchy to prevent frame-rate-dependent score inflation:

```
[Raw Frame Prediction]      YOLO/MediaPipe runs on frame #1402 (detects phone, conf=0.78)
        │
        ▼
[Temporal Hysteresis]       Temporal filter requires 3 consecutive hits to confirm presence
        │
        ▼
[Discrete Anomaly Episode]  One continuous episode: ID "ep-phone-001" (Started: 10:14:02, Ended: 10:14:18)
        │
        ▼
[Authoritative Score Event] Exactly ONE score transaction (+100) dispatched to candidate ledger
```

- **Idempotency Keys**: Every event ingested by the backend must supply or generate an idempotency key:
  $$\text{IdempotencyKey} = \text{SHA256}(\text{session\_id} + \text{event\_type} + \text{episode\_id})$$
- **Duplicate Rejection**: If an ingestion request arrives with an existing idempotency key, the backend returns HTTP 200 with the existing event record and skips scoring.

### 5.4 Scoring Examples Matrix

The table below defines the required outcomes for acceptance testing:

| Event Sequence for Single Candidate Attempt | Mathematical Computation | Final Score ($S$) | Official Status | Rationale |
|---|---|:---:|:---:|---|
| No anomalies recorded | Initial state | 0 | **Not Suspicious** | Clean examination attempt. |
| 1 qualifying sideways head turn | Pending counter = 1 | 0 | **Not Suspicious** | Incomplete group of three. |
| 3 qualifying sideways head turns | $1 \times (+10)$ | 10 | **Not Suspicious** | One completed group of 3 turns. |
| 5 qualifying sideways head turns | $1 \times (+10) + \text{pending } 2$ | 10 | **Not Suspicious** | Only first group of 3 scored. |
| 1 distinct book detection episode | $1 \times (+50)$ | 50 | **Not Suspicious** | Sub-threshold prohibited object. |
| 2 distinct book detection episodes | $2 \times (+50)$ | 100 | **Suspicious** | Exactly reaches the 100-point threshold. |
| 1 distinct phone detection episode | $1 \times (+100)$ | 100 | **Suspicious** | Single phone episode reaches threshold immediately. |
| 1 phone episode + 3 sideways turns | $(+100) + (+10)$ | 110 | **Suspicious** | Crossed threshold. |
| 1 phone + 2 books + 9 sideways turns | $(+100) + 2(+50) + 3(+10)$ | 230 | **Suspicious** | Highly flagged session. |
| 12 phone episodes ($12 \times 100 = 1200$) | $\min(1000, 1200)$ | 1000 | **Suspicious** | **Enforces hard ceiling of 1000 points.** |

### 5.5 Signals Without Assigned Numerical Weight

IntelliProctor tracks several vital proctoring signals that currently have **NO assigned numerical score weight**:
1. **Browser Tab Switching (`TAB_BLUR` / `TAB_FOCUS`)**: Logged with dwell duration and frequency; score contribution = $+0$.
2. **Candidate Absence (`CANDIDATE_ABSENT`)**: Triggered when no face is detected for $> 10\text{ seconds}$; score contribution = $+0$.
3. **Multiple Faces (`MULTIPLE_FACES`)**: Triggered when $> 1$ face is detected in frame; score contribution = $+0$.
4. **Pitch / Roll Deviations**: Head tilting up/down or rolling sideways beyond limits; score contribution = $+0$.

> [!CAUTION]
> **No Fabricated Weights**: Backend engineers must **never** assign arbitrary point values to tab switching, absence, or multiple faces. These events must be persisted with complete audit metadata and surfaced in examiner dashboards as non-numeric flags. Any future numerical weighting must be approved via an official policy amendment.

### 5.6 Score Persistence & Auditable Ledger

The candidate's score must not be stored as a single mutable integer. Instead, the backend must implement an **immutable append-only scoring ledger** table (`suspicion_score_ledger`):

```sql
-- Target Schema: Immutable Append-Only Ledger Entry
CREATE TABLE suspicion_score_ledger (
    ledger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES exam_sessions(session_id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES proctoring_events(event_id),
    rule_applied VARCHAR(64) NOT NULL,            -- e.g., 'PHONE_EPISODE', 'HEAD_TURN_GROUP_3'
    nominal_points INTEGER NOT NULL,              -- e.g., 100, 50, 10
    applied_points INTEGER NOT NULL,              -- Points added after 1000-ceiling cap
    previous_score INTEGER NOT NULL,              -- Score before transaction
    new_score INTEGER NOT NULL,                   -- Score after transaction
    is_suspicious BOOLEAN NOT NULL,               -- True if new_score >= 100
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- **Concurrency Control**: Score updates must execute inside a PostgreSQL transaction using row-level locking on the parent `exam_sessions` row (`SELECT ... FOR UPDATE`) to guarantee serializability during rapid concurrent event ingestion.
- **Peak Score Tracking**: The `exam_sessions` table stores both `current_suspicion_score` and `peak_suspicion_score`. Since the automated ledger is non-decreasing, `peak_suspicion_score` matches `current_suspicion_score`.

### 5.7 Human Review & Score Integrity

Examiners have full administrative authority to review flagged events and dismiss false positives (e.g., an examiner verifies that a detected "phone" was a handheld calculator or black wallet).

To guarantee forensic integrity:
1. **Separation of Concerns**: Dismissing an event updates `review_status = 'DISMISSED'` on the `proctoring_events` table.
2. **No Automatic Point Deduction**: The automated suspicion score ($S$) on the ledger is **NOT automatically reduced** upon event dismissal unless an explicit organizational review policy is enacted.
3. **Dual Status Reporting**: All examiner reports and dashboard views present both metrics side-by-side:
   - **Automated AI Score**: e.g., $S = 100$ (Suspicious).
   - **Human Review Resolution**: e.g., `DISMISSED` by Examiner Dr. Jane Doe with note: *"Candidate held up scientific calculator during math section."*

---

## 6. Backend Event-Ingestion Architecture

### 6.1 Ingestion Pipeline Overview

The backend ingestion endpoint (`POST /api/v1/proctor/events`) is the high-throughput intake valve for all telemetry:

```
[Inference Worker / Client]
          │
          │ HTTPS POST (Bearer Session Token)
          ▼
[FastAPI Ingestion Endpoint]
  ├── 1. Authenticate JWT & Verify Session State == 'IN_PROGRESS'
  ├── 2. Validate Payload Schema (Pydantic v2)
  ├── 3. Check Redis Idempotency Key (Reject duplicates)
  ├── 4. Upload Attached Screenshot to S3 Object Store
  ├── 5. Insert Record into `proctoring_events` (PostgreSQL)
  ├── 6. Check Scoring Rule -> If eligible, append to `suspicion_score_ledger`
  ├── 7. Publish Event & Score Update to Redis Pub/Sub Backplane
  └── 8. Return HTTP 201 Created with persisted Event Record
```

### 6.2 Ingestion Data Contract

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ProctoringEventIngestRequest",
  "type": "object",
  "required": ["sessionId", "eventType", "source", "timestamp", "episodeId"],
  "properties": {
    "sessionId": { "type": "string", "format": "uuid" },
    "episodeId": { "type": "string", "description": "Unique ID for the continuous detection episode" },
    "source": { "type": "string", "enum": ["YOLO_CV", "MEDIAPIPE_HEAD_POSE", "MEDIAPIPE_FACE_COUNT", "BROWSER_VISIBILITY"] },
    "eventType": { 
      "type": "string", 
      "enum": ["PHONE_DETECTED", "BOOK_DETECTED", "HEAD_TURN_SIDEWAYS", "TAB_BLUR", "TAB_FOCUS", "CANDIDATE_ABSENT", "MULTIPLE_FACES"] 
    },
    "timestamp": { "type": "string", "format": "date-time" },
    "durationMs": { "type": "integer", "minimum": 0 },
    "confidence": { "type": "number", "minimum": 0.0, "maximum": 1.0 },
    "boundingBox": {
      "type": "object",
      "properties": {
        "x": { "type": "integer" },
        "y": { "type": "integer" },
        "width": { "type": "integer" },
        "height": { "type": "integer" }
      }
    },
    "headPoseAngles": {
      "type": "object",
      "properties": {
        "yaw": { "type": "number" },
        "pitch": { "type": "number" },
        "roll": { "type": "number" }
      }
    },
    "evidenceBase64": { "type": "string", "description": "Optional JPEG image payload if evidence captured" }
  }
}
```

### 6.3 Idempotency & Validation Rules
- **Session Expiry**: Ingestion requests for sessions that are `'COMPLETED'`, `'SUBMITTED'`, or `'EXPIRED'` must be rejected with HTTP 409 Conflict.
- **Clock Drift Guard**: Event timestamps differing from backend server time by $> 30\text{ seconds}$ are flagged with `is_clock_skewed = true` to preserve audit records without breaking scoring.

---

## 7. Computer Vision Integration & Model Lifecycle

### 7.1 Decoupled Vision Architecture
As established in [`video_input_analysis.py`](file:///c:/Users/tanis/IntelliProctor/video_input_analysis.py), computer vision inference runs in a decoupled architecture:
1. **Threaded Video Capture**: Dedicated thread captures OpenCV frames without blocking.
2. **MediaPipe Tracking**: Synchronous FaceMesh on 640x480 RGB frames computing 6-point Perspective-n-Point pose estimation.
3. **Asynchronous YOLO Worker**: Dedicated worker thread running inference on clean frame copies, decoupled from display frame rates.

### 7.2 Active Model Checkpoint & Baseline
- **Active Production Model**: **Phase 0 Baseline** (`models/pretrained/yolo11m.pt`).
- **Target Classes**: `cell phone` (COCO class 67) and `book` (COCO class 73).
- **Inference Filters**:
  - Global Confidence Threshold: $0.65$.
  - Cell Phone Aspect Ratio Sweep Range: $1.15 \le \text{Aspect Ratio} \le 2.90$.
  - Book Aspect Ratio Range: $0.80 \le \text{Aspect Ratio} \le 2.50$.
  - Temporal Hysteresis Filter: $3\text{ consecutive on-frames}$ to trigger, $4\text{ consecutive off-frames}$ to clear.

### 7.3 Model Lifecycle Protection Policy
The project history includes Phase 1 fine-tuning (`train_phase1.py`), which trained a model checkpoint on custom datasets (`models/trained/intelliproctor_phase1_iter1/best.pt`). 
- **Evaluation Finding**: In [`evaluate_phase1.py`](file:///c:/Users/tanis/IntelliProctor/evaluate_phase1.py), the Phase 1 fine-tuned model suffered catastrophic false-positive degradation on the negative benchmark (False Positive Rate of **47.9%**, triggering on empty rooms, hands, and water bottles).
- **Mandatory Lifecycle Policy**: Future backend or ML engineers **MUST NOT deploy Iteration 1 weights**. The Phase 0 baseline (`yolo11m.pt`) remains the mandatory active inference model until Iteration 2 training on `Dataset_it2` passes formal false-positive regression gates ($FPR < 5.0\%$).

---

## 8. Browser Tab-Switch Monitoring Integration

### 8.1 Independent DOM Observation Flow
Browser visibility is an independent telemetry stream completely decoupled from OpenCV and YOLO:
1. When candidate enters `/student/exam/:testId`, the frontend initializes [`useTabVisibility.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/hooks/useTabVisibility.js).
2. When the user navigates away or switches applications:
   - `document.visibilityState == 'hidden'` triggers `TAB_BLUR`.
   - Frontend captures timestamp $T_{blur}$ and immediately dispatches telemetry.
3. When the user returns to the examination tab:
   - `document.visibilityState == 'visible'` triggers `TAB_FOCUS`.
   - Frontend captures $T_{focus}$, calculates duration $D = T_{focus} - T_{blur}$, and dispatches return telemetry.

### 8.2 Server-Side Verification & Timing
Because client timestamps can be manipulated, the backend validates tab telemetry:
- Upon receiving `TAB_BLUR`, the backend notes server timestamp $S_{blur}$.
- Upon receiving `TAB_FOCUS`, the backend notes server timestamp $S_{focus}$.
- The backend computes authoritative duration:
  $$\text{AuthoritativeDuration} = S_{focus} - S_{blur}$$
- If client-reported duration and server duration diverge by $> 3.0\text{ seconds}$, the event is flagged with `timing_discrepancy = true`.

### 8.3 Policy Decoupling
Tab-switch events are persisted to `proctoring_events` with `event_type = 'TAB_SWITCH'` and duration in milliseconds. In accordance with Section 5.5, the scoring engine assigns **zero points** ($\Delta S = 0$) to tab switches. Frequency and total duration are aggregated on candidate report summaries.

---

## 9. Evidence & Screenshot Persistence

### 9.1 Six-Stage Evidence Lifecycle
Evidence progression must follow six discrete, verifiable stages:

```
[Stage 1: Frame Captured]         Inference worker extracts video frame containing anomaly
           │
           ▼
[Stage 2: Screenshot Generated]   Annotated with bounding box and timestamp; encoded as JPEG
           │
           ▼
[Stage 3: Transferred to Backend] POSTed via internal ingestion payload or secure upload URL
           │
           ▼
[Stage 4: Persisted to S3 Store]  Stored at: s3://evidence/{exam_id}/{session_id}/{event_id}.jpg
           │
           ▼
[Stage 5: Metadata Linked in DB]  `evidence_records` table stores S3 key, SHA256 hash, and dimensions
           │
           ▼
[Stage 6: Examiner Authorization] Backend generates 15-minute pre-signed GET URL for authorized review
```

### 9.2 Secure Storage Architecture
- Evidence images must never be stored as raw BLOBs in PostgreSQL.
- Images are stored in an S3-compatible private bucket with strict access policies (no public read).
- Access is granted exclusively through short-lived (15-minute) pre-signed URLs generated by `GET /api/v1/proctor/events/:id/evidence`.
- Examinees are **never** provided access to raw evidence screenshots during the active examination to prevent reverse-engineering of camera blind spots.

---

## 10. Examination Lifecycle & Passkey Engine

### 10.1 Examination State Machine

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Examiner creates exam
    DRAFT --> SCHEDULED: Passkey generated & schedule set
    SCHEDULED --> ACTIVE: Window opens (start_time)
    ACTIVE --> IN_PROGRESS: Candidate enters valid passkey
    IN_PROGRESS --> SUBMITTED: Candidate completes test
    IN_PROGRESS --> FORCED_SUBMITTED: Timer expires
    SUBMITTED --> EVALUATED: Academic scoring & proctoring rollup
    FORCED_SUBMITTED --> EVALUATED
    ACTIVE --> CLOSED: Window closes (end_time)
    EVALUATED --> ARCHIVED: 90-day retention policy
```

### 10.2 Cryptographic Passkey Engine
- Passkeys are 6-to-8 character alphanumeric tokens (e.g., `INTEL-982`) generated by the backend.
- Passkeys must never be stored as plaintext in the database.
- The backend stores:
  $$\text{PasskeyHash} = \text{Argon2id}(\text{passkey} + \text{exam\_id})$$
- When an examinee enters a passkey, the backend validates the hash, verifies current time against $[T_{start}, T_{end}]$, and checks that candidate is enrolled.

### 10.3 Session Admission & Token Issuance
Upon successful passkey verification, the backend creates an entry in `exam_sessions` with `status = 'IN_PROGRESS'` and mints a scoped, short-lived **Exam Session Token** containing `{ session_id, candidate_id, exam_id, exp }`. All subsequent question requests, answer drafts, and telemetry events must present this session token.

---

## 11. Authentication & Role-Based Authorization

### 11.1 RBAC Model
IntelliProctor implements strict role-based access control with two primary roles:
1. **`ROLE_EXAMINER` (`setter`)**:
   - Authorized to create/edit examinations, view all candidate rosters, access real-time live monitoring halls, review and dismiss flagged events, and download comprehensive audit reports.
2. **`ROLE_EXAMINEE` (`student`)**:
   - Authorized only to view their enrolled exams, submit answers to active sessions, view their own local camera preview, and access their own sanitized post-exam reports.

### 11.2 JWT Token Strategy & Rotation
- **Access Token**: Short-lived (15 minutes), signed with asymmetric RS256 private key. Contains `sub` (user_id), `role`, `email`, and `session_fingerprint`.
- **Refresh Token**: Long-lived (7 days), stored in an `HttpOnly`, `SameSite=Strict`, `Secure` cookie. Stored in Redis with rotation on every use to detect token reuse.

### 11.3 Resource-Level Isolation
To prevent Insecure Direct Object References (IDOR):
- An examinee requesting `GET /api/v1/exams/:id/questions` must have an active session where `session.candidate_id == jwt.user_id`.
- An examiner requesting `GET /api/v1/reports/:id` must own the examination (`exam.examiner_id == jwt.user_id`) or possess institutional administrative rights.

---

## 12. Database & Persistence Architecture

### 12.1 Target Relational Schema (PostgreSQL)

The persistence layer requires the following relational schema:

```sql
-- Core Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('student', 'setter', 'admin')),
    institution VARCHAR(255),
    candidate_id_number VARCHAR(64),
    reference_photo_s3_key VARCHAR(512),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Examinations Table
CREATE TABLE examinations (
    exam_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    examiner_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    subject VARCHAR(128) NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    total_marks INTEGER NOT NULL DEFAULT 100,
    passkey_hash VARCHAR(255) NOT NULL,
    start_window TIMESTAMPTZ NOT NULL,
    end_window TIMESTAMPTZ NOT NULL,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Questions Table
CREATE TABLE questions (
    question_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES examinations(exam_id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(32) NOT NULL CHECK (question_type IN ('mcq', 'msq', 'subjective')),
    options JSONB,                         -- Array of choices: ["A", "B", "C", "D"]
    correct_answer JSONB NOT NULL,         -- Indices: [0] or ["text"]
    marks INTEGER NOT NULL DEFAULT 1,
    difficulty VARCHAR(32) DEFAULT 'medium',
    topic VARCHAR(128),
    order_index INTEGER NOT NULL DEFAULT 0
);

-- 4. Candidate Examination Sessions Table
CREATE TABLE exam_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES examinations(exam_id) ON DELETE RESTRICT,
    candidate_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    status VARCHAR(32) NOT NULL DEFAULT 'INITIALIZED' CHECK (status IN ('INITIALIZED', 'IN_PROGRESS', 'SUBMITTED', 'FORCED_SUBMITTED', 'EVALUATED')),
    started_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    academic_score NUMERIC(5, 2),
    current_suspicion_score INTEGER NOT NULL DEFAULT 0 CHECK (current_suspicion_score BETWEEN 0 AND 1000),
    peak_suspicion_score INTEGER NOT NULL DEFAULT 0 CHECK (peak_suspicion_score BETWEEN 0 AND 1000),
    is_suspicious BOOLEAN NOT NULL DEFAULT FALSE,
    head_turn_pending_count INTEGER NOT NULL DEFAULT 0 CHECK (head_turn_pending_count BETWEEN 0 AND 2),
    total_head_turns_completed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_candidate_exam_session UNIQUE (exam_id, candidate_id)
);

-- 5. Candidate Answers Table
CREATE TABLE candidate_answers (
    answer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES exam_sessions(session_id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
    selected_options JSONB,
    subjective_text TEXT,
    marks_awarded NUMERIC(5, 2),
    is_marked_for_review BOOLEAN NOT NULL DEFAULT FALSE,
    last_saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_session_question UNIQUE (session_id, question_id)
);

-- 6. Proctoring Events Table
CREATE TABLE proctoring_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES exam_sessions(session_id) ON DELETE CASCADE,
    episode_id VARCHAR(128) NOT NULL,
    event_source VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    severity VARCHAR(32) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    timestamp TIMESTAMPTZ NOT NULL,
    duration_ms INTEGER DEFAULT 0,
    confidence NUMERIC(4, 3),
    bounding_box JSONB,
    head_pose_angles JSONB,
    review_status VARCHAR(32) NOT NULL DEFAULT 'UNREVIEWED' CHECK (review_status IN ('UNREVIEWED', 'DISMISSED', 'CONFIRMED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Suspicion Score Ledger Table (Append-Only)
CREATE TABLE suspicion_score_ledger (
    ledger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES exam_sessions(session_id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES proctoring_events(event_id) ON DELETE RESTRICT,
    rule_applied VARCHAR(64) NOT NULL,
    nominal_points INTEGER NOT NULL,
    applied_points INTEGER NOT NULL,
    previous_score INTEGER NOT NULL,
    new_score INTEGER NOT NULL,
    is_suspicious BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Evidence Records Table
CREATE TABLE evidence_records (
    evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID UNIQUE NOT NULL REFERENCES proctoring_events(event_id) ON DELETE CASCADE,
    s3_bucket VARCHAR(128) NOT NULL,
    s3_key VARCHAR(512) NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    image_hash_sha256 VARCHAR(64) NOT NULL,
    mime_type VARCHAR(64) NOT NULL DEFAULT 'image/jpeg',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Examiner Reviews Table
CREATE TABLE examiner_reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES proctoring_events(event_id) ON DELETE CASCADE,
    examiner_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    action VARCHAR(32) NOT NULL CHECK (action IN ('DISMISS', 'CONFIRM')),
    justification_note TEXT NOT NULL,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 12.2 Entity-Relationship Diagram

```mermaid
erDiagram
    users ||--o{ examinations : "creates"
    users ||--o{ exam_sessions : "participates"
    users ||--o{ examiner_reviews : "conducts"
    
    examinations ||--|{ questions : "contains"
    examinations ||--o{ exam_sessions : "hosts"
    
    exam_sessions ||--o{ candidate_answers : "records"
    exam_sessions ||--o{ proctoring_events : "generates"
    exam_sessions ||--o{ suspicion_score_ledger : "tracks"
    
    questions ||--o{ candidate_answers : "answered in"
    
    proctoring_events ||--o| evidence_records : "has evidence"
    proctoring_events ||--o{ suspicion_score_ledger : "triggers"
    proctoring_events ||--o{ examiner_reviews : "reviewed in"
```

### 12.3 Indexing, Concurrency, & Transactions
- **Performance Indexes**:
  - `CREATE INDEX idx_sessions_exam ON exam_sessions(exam_id, status);`
  - `CREATE INDEX idx_events_session_time ON proctoring_events(session_id, timestamp);`
  - `CREATE INDEX idx_ledger_session ON suspicion_score_ledger(session_id, created_at);`
  - `CREATE INDEX idx_questions_exam_order ON questions(exam_id, order_index);`
- **Transactions**: Every scoring ingestion executes in an `ISOLATION LEVEL READ COMMITTED` transaction with row-level locks on `exam_sessions`.

---

## 13. Backend API & Service Architecture

### 13.1 Service Layer Boundaries
The backend enforces clean decoupling between HTTP controllers, domain business logic, and database repositories:
- `AuthService`: Authentication, Argon2 verification, JWT minting.
- `ExamService`: Passkey hashing, question delivery, answer submission.
- `TelemetryIngestService`: Event validation, episode deduplication, S3 upload coordination.
- `ScoringEngineService`: Mathematical rule evaluation, ledger append, threshold evaluation.
- `ReviewService`: Examiner dismissals, audit logs, pre-signed URL issuance.

### 13.2 REST API Endpoint Catalog (`/api/v1`)

| Endpoint & Method | Purpose | Invoking Client | Authorization Required | Target Status |
|---|---|---|---|---|
| `POST /auth/register` | User account registration | RegisterPage | Public | **Implemented** |
| `POST /auth/login` | Login and JWT token issuance | LoginPage | Public | **Implemented** |
| `POST /auth/refresh` | Refresh expired access token | Axios Client | Refresh Cookie | **Implemented** |
| `POST /auth/logout` | Revoke session & clear cookie | Navbar | Authenticated | **Implemented** |
| `GET /exams` | List available exams | Dashboards | Authenticated | **Implemented** |
| `POST /exams` | Create custom exam | CustomTestPage | `setter` | **Implemented** |
| `POST /exams/generate` | Question-bank-driven test generation (no external LLM) | QuestionBankPage | `setter` | **Implemented** |
| `POST /exams/verify-passkey` | Validate passkey & admit candidate | PasskeyEntryPage | `student` | **Implemented** |
| `GET /exams/:id/questions` | Retrieve exam question set | ExamTakingPage | `student` (Scoped) | **Implemented** |
| `POST /exams/:id/draft` | Save single answer draft | ExamTakingPage | `student` (Scoped) | **Implemented** |
| `POST /exams/:id/submit` | Final exam submission | ExamTakingPage | `student` (Scoped) | **Implemented** |
| `POST /proctor/events` | Telemetry event ingestion | CV / Browser | Authenticated | **Implemented** |
| `GET /proctor/live-candidates` | Active candidate status list | LiveMonitoringPage | `setter` | **Implemented** |
| `GET /proctor/events/:id/evidence` | Fetch pre-signed screenshot URL | ReportDetailsPage | `setter` | **Implemented** |
| `POST /proctor/events/:id/dismiss` | Dismiss event as false positive | LiveMonitoringPage | `setter` | **Implemented** |
| `GET /reports/:id` | Fetch post-exam report | Report Pages | Role-Scoped | **Implemented** |

> **As implemented**, the catalog above is extended with: `POST /auth/examiner/login`, `POST /auth/candidate/login`, `GET /auth/me`, `GET /exams/lookup/{code}`, examiner exam management (`GET/PUT/DELETE /exams/{id}`, `/publish`, `/close`, `/passkey/regenerate`), `POST /proctor/sessions/{id}/frames` (webcam keyframes -> CV worker), `GET /proctor/sessions/{id}[/events|/ledger|/snapshot]`, `POST /proctor/sessions/{id}/flag|notify`, `POST /proctor/events/{id}/confirm`, `GET /reports`, `GET /reports/{id}/download`, `/question-bank`, `/settings`, `/stats/overview`, `POST /candidates/reference-photo`. Full list: `backend/README.md` and `http://localhost:8000/docs`.

### 13.3 WebSocket Protocols (`/ws/v1`)
- **Examiner Hall Channel (`/ws/v1/proctor/live/:examId`, or `/ws/v1/proctor/live` for all of the examiner's exams; JWT passed as `?token=`)**: High-throughput telemetry feed delivering candidate status changes, score updates, and newly flagged anomaly alerts to examiners in JSON frames.
- **Candidate Notification Channel (`/ws/v1/candidate/session/:sessionId`)**: Low-frequency channel delivering administrative notifications or time warnings to examinees.

---

## 14. Live Updates, Alerts, & Telemetry Streaming

### 14.1 Examiner Hall Real-Time Feed
When an anomaly episode is accepted and scored by the backend, the event is published to Redis:
```
PUBLISH exam:{exam_id}:events '{"candidateId":"...","score":100,"isSuspicious":true,"anomaly":"PHONE_DETECTED"}'
```
All active examiner WebSocket connections subscribe to `exam:{exam_id}:events` and push the payload immediately to the client, triggering real-time UI updates without page polling.

### 14.2 Examinee Notification Channel
Examinees receive non-alarming operational status updates (e.g., *"Examiner has broadcasted a 10-minute warning"*). Telemetry and suspicion scores are **never** pushed to active examinees during the exam.

### 14.3 WebRTC Video Streaming Path
To support remote video monitoring in `StudentLiveCard.jsx`:
- Examinees establish an upstream WebRTC connection to a media server (e.g., MediaMTX or Janos).
- The examiner dashboard connects as a downstream consumer, viewing live candidate video feeds without looping back to the local webcam.

---

## 15. Reports & Result Generation Service

### 15.1 Academic Evaluation Pipeline
Upon final submission, the backend evaluates objective questions (MCQ/MSQ) against `questions.correct_answer`, calculating percentage marks and rank percentiles.

### 15.2 Proctoring Integrity Synthesis
The proctoring summary aggregates:
- Final suspicion score ($0 \le S \le 1000$).
- Official status (`Suspicious` if $S \ge 100$).
- Total anomaly count by category (Head Pose, Phone, Book, Tab Switch).
- Total tab-switch count and cumulative dwell duration.
- Chronological event timeline with examiner review annotations.

### 15.3 Report Authorization Profiles
- **Candidate View (`/student/report/:id`)**: Shows academic marks, trust score, and high-level anomaly counts. **Omits raw evidence screenshots and internal examiner notes**.
- **Examiner View (`/admin/reports/:id`)**: Shows full forensic dossier, pre-signed evidence screenshot links, raw model confidence values, and dismissal controls.

---

## 16. Examiner Review & Dismissal Engine

### 16.1 Audit Trail & Justification
When an examiner clicks "Dismiss as False Positive" in `ReportDetailsPage.jsx`:
1. The frontend submits `POST /api/v1/proctor/events/:id/dismiss` with a mandatory `justificationNote`.
2. The backend records an entry in `examiner_reviews`.
3. The event's `review_status` is updated to `'DISMISSED'`.
4. The event is **never deleted**, and the screenshot remains preserved in S3.

### 16.2 Score Decoupling Principle
The automated suspicion score on the ledger remains preserved. The candidate's public status badge updates to reflect human review:
$$\text{Status} = \text{"Suspicious (Flagged by AI, Dismissed by Examiner)"}$$

---

## 17. Error Handling, Fault Tolerance, & Reliability

### 17.1 Standardized API Error Envelope
All error responses adhere to RFC 7807 problem details format:
```json
{
  "error": {
    "code": "INVALID_PASSKEY",
    "message": "The exam passkey entered is invalid or the exam window is closed.",
    "timestamp": "2026-10-19T18:00:00Z",
    "details": []
  }
}
```

### 17.2 Failure Mode Matrix

| Failure Mode | HTTP Status | Backend Recovery Action |
|---|:---:|---|
| **Invalid JWT or Expired Session** | 401 Unauthorized | Reject request; client triggers token refresh or routes to `/login`. |
| **Passkey Expired / Window Closed** | 403 Forbidden | Block entry; return exact window timing details. |
| **Duplicate Event Ingestion** | 200 OK | Idempotency hit: return existing event record without re-scoring. |
| **S3 Screenshot Upload Failure** | 502 Bad Gateway | Log error; persist proctoring event with `evidence_status = 'FAILED'`. |
| **Database Transaction Deadlock** | 409 Conflict | Retry scoring transaction up to 3 times with exponential backoff. |
| **Candidate Disconnection** | 200 OK | Mark session telemetry as paused; resume on reconnect without score loss. |

---

## 18. Security, Privacy, & Candidate Data Protection

### 18.1 Biometric & Video Data Governance
- Candidate reference photographs and anomaly screenshots are classified as **Sensitive Personal Data**.
- All S3 buckets enforce AES-256 server-side encryption at rest.
- Strict 90-day automated lifecycle expiration deletes raw screenshots while retaining anonymized statistical scores.

### 18.2 Anti-Tamper & Replay Protection
- Telemetry events without a valid, active session UUID are dropped immediately.
- Replay attacks are blocked by enforcing monotonically increasing event timestamps and caching SHA256 idempotency keys in Redis for 24 hours.

---

## 19. Performance & Scalability Targets

### 19.1 Concurrency Sizing
- **Target Concurrent Examinees**: 500 active candidates per examination cohort.
- **Telemetry Ingestion Rate**: Up to 100 events/second during peak testing windows.
- **API Response Latency**: $\le 100\text{ ms}$ for answer draft saves; $\le 50\text{ ms}$ for telemetry ingestion.

### 19.2 Caching & Asynchronous Queues
- Redis in-memory caching for active examination metadata, passkeys, and rate-limiting counters.
- Telemetry ingestion is decoupled: FastAPI pushes accepted events to a Celery/Redis queue for asynchronous score computation and S3 evidence transfer under extreme load.

---

## 20. Development, Testing, & Deployment Operations

### 20.1 Recommended Technology Stack
- **Language**: Python 3.11+
- **Web Framework**: FastAPI `^0.110.0` with Uvicorn ASGI server.
- **Database & ORM**: PostgreSQL 16 with SQLAlchemy 2.0 (asyncio) and Alembic migrations.
- **Cache & Pub/Sub**: Redis 7.2.
- **Object Storage**: MinIO (local dev) / AWS S3 (production).
- **Inference Integration**: Standalone Python workers invoking `video_input_analysis.py`.

### 20.2 Environment Configuration (`.env.example`)
```ini
APP_ENV=development
PORT=8000
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/intelliproctor
REDIS_URL=redis://localhost:6379/0
S3_ENDPOINT_URL=http://localhost:9000
S3_BUCKET_EVIDENCE=intelliproctor-evidence
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
JWT_SECRET_KEY=change-in-production-to-64-byte-secret
JWT_ALGORITHM=HS256
```

### 20.3 Database Migrations & Commands
```bash
# Run database migrations
alembic upgrade head

# Start FastAPI server
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

# Start background worker
celery -A src.tasks worker --loglevel=info
```

---

## 21. Acceptance Test Scenarios

Every future backend implementation must pass the following 18 formal acceptance test scenarios before staging deployment:

1. **Test 1 (Sideways Head Turns Baseline)**: Three qualifying sideways-turn events add exactly 10 points ($S = 10$, Not Suspicious).
2. **Test 2 (Sideways Head Turns Multiplier)**: Six qualifying sideways-turn events add exactly 20 points ($S = 20$, Not Suspicious).
3. **Test 3 (Phone Episode Immediate Threshold)**: A single accepted phone episode adds 100 points, immediately transitioning a zero-score candidate to Suspicious ($S = 100$, Suspicious).
4. **Test 4 (Book Episode Sub-Threshold)**: A single accepted book episode adds 50 points ($S = 50$, Not Suspicious).
5. **Test 5 (Dual Book Threshold)**: Two distinct book episodes add 100 points ($S = 100$, Suspicious).
6. **Test 6 (Combined Anomaly Aggregation)**: One phone episode (+100) and three sideways turns (+10) add 110 points ($S = 110$, Suspicious).
7. **Test 7 (Hard Ceiling Enforcement)**: Twelve phone episodes ($12 \times 100 = 1200$) cap the stored score at exactly 1000 ($S = 1000$, Suspicious).
8. **Test 8 (Idempotent Duplicate Delivery)**: Transmitting the identical event payload twice adds points only once ($S = 100$, not 200).
9. **Test 9 (Continuous Frame Suppression)**: Receiving 30 consecutive inference frames for the same phone episode results in exactly one score addition (+100).
10. **Test 10 (Strict Boundary Check at 99)**: A candidate with $S = 99$ evaluates to `is_suspicious = False`.
11. **Test 11 (Strict Boundary Check at 100)**: A candidate with $S = 100$ evaluates to `is_suspicious = True`.
12. **Test 12 (Session Isolation)**: Scoring events for Candidate A do not alter the score or state of Candidate B.
13. **Test 13 (Concurrent Score Safety)**: Ten concurrent scoring transactions execute without lost updates or race conditions.
14. **Test 14 (Audit Trail Preservation on Dismissal)**: Dismissing a flagged event updates review status without erasing evidence or score history.
15. **Test 15 (Zero Weight for Tab Switching)**: Ingesting 5 tab-switch events records duration and frequency but leaves $S = 0$.
16. **Test 16 (Score Synchronization)**: The frontend query to `/api/v1/proctor/live-candidates` returns the exact score recorded on the backend ledger.
17. **Test 17 (IDOR Report Isolation)**: Candidate A receives HTTP 403 Forbidden when requesting Candidate B's report.
18. **Test 18 (Evidence Failure Resilience)**: If S3 storage is offline, the event record is persisted with `evidence_status = 'FAILED'` rather than dropping the anomaly.

---

## 22. Implementation Roadmap & Phased Delivery

```
[Phase A: Foundations & Storage] ===> [Phase B: Auth & Exam Lifecycle] ===> [Phase C: CV Ingestion Bridge]
                                                                                        │
                                                                                        ▼
[Phase G: Security & Hardening]  <=== [Phase F: Reports & Reviews]    <=== [Phase D: Scoring Engine]
                                                                                        │
                                                                                        ▼
                                                                           [Phase E: Tab Hook & Live WSS]
```

- **Phase A — Backend Foundations & Database Schema**: Initialize FastAPI application skeleton, configure SQLAlchemy async engine, apply PostgreSQL migrations, and configure Redis/MinIO.
- **Phase B — Authentication & Examination Lifecycle**: Implement JWT authentication, candidate reference photo upload, exam creation, Argon2 passkey hashing, and question delivery.
- **Phase C — CV Telemetry Ingestion Bridge**: Build structured ingestion endpoint (`POST /proctor/events`), integrate with `video_input_analysis.py` via asynchronous HTTP worker, and establish S3 evidence upload.
- **Phase D — Centralized Scoring Engine**: Implement the append-only `suspicion_score_ledger`, hard ceiling of 1000, threshold of 100, and execute all 18 acceptance test scenarios.
- **Phase E — Browser Tab Hook & Live WebSocket Broadcasting**: Wire independent `useTabVisibility` events into backend telemetry; implement Redis Pub/Sub WebSocket multiplexer for examiner live halls.
- **Phase F — Evidence Retrieval & Human Review**: Implement pre-signed S3 URL issuance, examiner dismissal audit records, and dual-status candidate reports.
- **Phase G — Security Hardening & Concurrency Verification**: Implement rate limiting, anti-tamper timestamp checks, and execute load tests with 500 simulated concurrent examinees.

---

## 23. Mandatory Guidance for Future Backend Agents

Future coding agents working on the IntelliProctor backend must strictly adhere to the following 18 rules:

1. **Read Core Architecture First**: Read `README.md`, `BACKEND_ARCHITECTURE.md`, `BACKEND_CURRENT_STATE.md`, and `FRONTEND_ARCHITECTURE.md` before writing code.
2. **Inspect Existing Code**: Always verify existing repository code before assuming endpoints, schemas, or models exist.
3. **The Backend is the Source of Truth**: Never trust client-calculated scores, client-reported roles, or unauthenticated parameters.
4. **Enforce Exact Scoring Weights**: Sideways turns add +10 per completed group of 3; phone episodes add +100; book episodes add +50.
5. **Enforce Suspicious Threshold**: A candidate is suspicious if and only if $S \ge 100$.
6. **Enforce Hard Ceiling**: Never allow a candidate score to exceed 1000 points.
7. **Deduplicate Frame Predictions**: Never treat continuous inference frames as independent scoring events; group frames into discrete episodes.
8. **Do Not Invent Scoring Weights**: Never assign arbitrary numerical points to tab switching, candidate absence, or multiple faces without an approved policy amendment.
9. **Preserve Immutable Audit Ledgers**: Never overwrite or delete scoring rows; use an append-only ledger table.
10. **Keep Tab Switching Decoupled from CV**: Browser visibility is an independent DOM telemetry source, not an OpenCV/MediaPipe detection.
11. **Do Not Deploy Iteration 1 Weights**: The active production model is the Phase 0 baseline (`models/pretrained/yolo11m.pt`). Do not deploy `intelliproctor_phase1_iter1/best.pt`.
12. **Store Evidence in S3, Not DB**: Store image metadata in PostgreSQL and raw image bytes in S3 object storage. Access via pre-signed URLs.
13. **Human Dismissal Does Not Delete**: Examiner dismissals record justification metadata; they must never delete evidence or alter raw model outputs.
14. **Protect Sensitive Biometric Data**: Webcam reference photos and screenshots are sensitive personal data; enforce strict access controls.
15. **Use Database Transactions**: Wrap scoring ledger updates in database transactions with row-level locks to prevent concurrency race conditions.
16. **Prevent IDOR Vulnerabilities**: Verify ownership on every examination, session, evidence, and report query.
17. **Pass Acceptance Tests**: Verify that implementation satisfies all 18 acceptance scenarios before merging backend code.
18. **Update Documentation**: Update architecture and audit documents whenever an API contract, schema, or scoring rule changes.
