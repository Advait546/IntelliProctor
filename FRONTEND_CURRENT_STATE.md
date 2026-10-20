# IntelliProctor — Frontend Current State Audit & Gap Analysis

> **Document Version**: 1.0.0  
> **Repository Root**: [`c:\Users\tanis\IntelliProctor`](file:///c:/Users/tanis/IntelliProctor)  
> **Companion Documents**: Root [`README.md`](file:///c:/Users/tanis/IntelliProctor/README.md) & Target Specification [`FRONTEND_ARCHITECTURE.md`](file:///c:/Users/tanis/IntelliProctor/FRONTEND_ARCHITECTURE.md).  
> **Audit Date**: October 2026  
> **Status**: **VERIFIED REPOSITORY AUDIT** (Factual inventory of current code, mock fallbacks, missing integrations, and implementation gaps).

---

## Table of Contents

1. [Purpose & Audit Boundaries](#1-purpose--audit-boundaries)
2. [Current Frontend Technology Stack](#2-current-frontend-technology-stack)
3. [Existing Frontend File & Component Structure](#3-existing-frontend-file--component-structure)
4. [Existing Routes & Navigation Audit](#4-existing-routes--navigation-audit)
5. [Page-by-Page Audit](#5-page-by-page-audit)
   - [5.1 Landing & Role Selection](#51-landing--role-selection)
   - [5.2 Authentication & Registration](#52-authentication--registration)
   - [5.3 Candidate Profile & Photograph Capture](#53-candidate-profile--photograph-capture)
   - [5.4 Examiner Dashboard](#54-examiner-dashboard)
   - [5.5 Test Generation](#55-test-generation)
   - [5.6 Custom Test Creation](#56-custom-test-creation)
   - [5.7 Scheduling & Passkey Generation](#57-scheduling--passkey-generation)
   - [5.8 Examiner Live Hall (Monitoring)](#58-examiner-live-hall-monitoring)
   - [5.9 Examinee Dashboard](#59-examinee-dashboard)
   - [5.10 Passkey Joining](#510-passkey-joining)
   - [5.11 Examination Taking Interface](#511-examination-taking-interface)
   - [5.12 Practice / Random Test](#512-practice--random-test)
   - [5.13 Proctoring Diagnostics](#513-proctoring-diagnostics)
   - [5.14 Candidate Results & Reports](#514-candidate-results--reports)
   - [5.15 Evidence Review & Dismissal](#515-evidence-review--dismissal)
6. [Existing Design & Visual Consistency](#6-existing-design--visual-consistency)
7. [Current Backend & API Integration](#7-current-backend--api-integration)
8. [Current Webcam & Computer Vision Integration](#8-current-webcam--computer-vision-integration)
9. [Tab-Switching Architecture Audit](#9-tab-switching-architecture-audit)
10. [Current Proctoring Events & Suspicion Scoring](#10-current-proctoring-events--suspicion-scoring)
11. [Current Data Models & Response Assumptions](#11-current-data-models--response-assumptions)
12. [Error States & UX Reliability](#12-error-states--ux-reliability)
13. [Comprehensive Gap Analysis Table](#13-comprehensive-gap-analysis-table)
14. [Prioritized Implementation Roadmap](#14-prioritized-implementation-roadmap)
15. [Audit Limitations](#15-audit-limitations)
16. [Recommended Next Actions](#16-recommended-next-actions)

---

## 1. Purpose & Audit Boundaries

This document presents a factual, evidence-backed audit of the **IntelliProctor** frontend as it exists today in the repository. Unlike [`FRONTEND_ARCHITECTURE.md`](file:///c:/Users/tanis/IntelliProctor/FRONTEND_ARCHITECTURE.md), which defines the authoritative target architecture, this document answers:

> **What is implemented today, how does it work, what is mocked, and what remains necessary to achieve the target architecture?**

### Audit Classification Labels
Throughout this document, every feature, route, component, and data pipeline is evaluated against the following strict classification labels:
- **`Implemented and verified`**: The feature exists in source code, executes in the runtime environment, and has been verified by direct code inspection or command execution.
- **`Partially implemented`**: Component scaffolding or partial logic exists, but end-to-end integration or edge-case handling is missing.
- **`Placeholder/mock`**: The UI renders static, hardcoded, or randomly generated mock data without live persistence or network synchronization.
- **`Planned`**: The feature is specified in the target architecture but completely absent from current repository code.
- **`Needs verification`**: Code exists but lacks automated tests or running dependencies required to establish operational validity.

> [!CAUTION]
> **No Modifying Code Principle**: This audit is strictly observational. No application code, backend endpoints, model checkpoints, database schemas, or package configurations were altered during this audit.

---

## 2. Current Frontend Technology Stack

All dependencies and versions are verified directly against [`Frontend/package.json`](file:///c:/Users/tanis/IntelliProctor/Frontend/package.json) and [`Frontend/vite.config.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/vite.config.js).

| Stack Category | Technology / Library | Verified Version | Configuration File / Entry Point | Status |
|---|---|---|---|---|
| **Core Framework** | React | `^19.2.8` | [`Frontend/package.json`](file:///c:/Users/tanis/IntelliProctor/Frontend/package.json#L14) | `Implemented and verified` |
| **DOM Renderer** | React DOM | `^19.2.8` | [`Frontend/package.json`](file:///c:/Users/tanis/IntelliProctor/Frontend/package.json#L15) | `Implemented and verified` |
| **Build Tool & Bundler** | Vite | `^8.2.0` | [`Frontend/vite.config.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/vite.config.js) | `Implemented and verified` |
| **Vite React Plugin** | `@vitejs/plugin-react` | `^4.3.4` | [`Frontend/vite.config.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/vite.config.js#L2) | `Implemented and verified` |
| **Routing** | React Router DOM | `^7.18.2` | [`Frontend/src/routes/AppRoutes.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/routes/AppRoutes.jsx) | `Implemented and verified` |
| **CSS Framework** | Tailwind CSS (v4) | `^4.3.3` | [`Frontend/src/index.css`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/index.css#L1) (`@import "tailwindcss";`) | `Implemented and verified` |
| **Tailwind Vite Plugin** | `@tailwindcss/vite` | `^4.3.3` | [`Frontend/vite.config.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/vite.config.js#L3) | `Implemented and verified` |
| **Tailwind PostCSS** | `@tailwindcss/postcss` | `^4.3.3` | [`Frontend/package.json`](file:///c:/Users/tanis/IntelliProctor/Frontend/package.json#L24) | `Implemented and verified` |
| **HTTP Client** | Axios | `^1.19.0` | [`Frontend/src/api/client.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/client.js) | `Implemented and verified` |
| **Iconography** | Lucide React | `^1.28.0` | [`Frontend/package.json`](file:///c:/Users/tanis/IntelliProctor/Frontend/package.json#L16) | `Implemented and verified` |
| **Data Visualization** | Recharts | `^3.10.1` | [`Frontend/package.json`](file:///c:/Users/tanis/IntelliProctor/Frontend/package.json#L17) | `Implemented and verified` |
| **UI Motion / Animation**| Framer Motion | `^12.43.0` | [`Frontend/package.json`](file:///c:/Users/tanis/IntelliProctor/Frontend/package.json#L18) | `Implemented and verified` |
| **Linter** | Oxlint | `^1.75.0` | [`Frontend/package.json`](file:///c:/Users/tanis/IntelliProctor/Frontend/package.json#L28) | `Implemented and verified` |
| **Test Runner** | Vitest / Jest / Playwright | *None* | *No test script or config in package.json* | `Planned` |
| **WebSocket / WebRTC** | Socket.IO Client / Native RTCPeerConnection | *None* | *No WebRTC or WS client package installed* | `Planned` |

---

## 3. Existing Frontend File & Component Structure

The following tree represents the verified file structure of [`Frontend/src`](file:///c:/Users/tanis/IntelliProctor/Frontend/src):

```
Frontend/src/
├── App.css                                # Default styling overrides
├── App.jsx                                # Root component wrapping AuthProvider and AppRoutes
├── index.css                              # Tailwind v4 import & custom scrollbar styles
├── main.jsx                               # DOM mount entry point (React.StrictMode)
├── api/
│   ├── authApi.js                         # Login, registration, token refresh (mock fallback)
│   ├── client.js                          # Axios instance (baseURL: http://localhost:8000/api/v1)
│   ├── examApi.js                         # Exam fetch, submit, answer draft (mock fallback)
│   ├── mockData.js                        # Master client-side mock database (535 lines)
│   ├── proctorApi.js                      # Live candidates, alerts, dismissal, logs (mock fallback)
│   ├── questionApi.js                     # Question bank queries & test generation (mock fallback)
│   ├── reportApi.js                       # Post-exam reports & metrics (mock fallback)
│   ├── statsApi.js                        # Dashboard overview stats (mock fallback)
│   └── testApi.js                         # Test scheduling, creation, passkeys (mock fallback)
├── components/
│   ├── dashboard/
│   │   ├── ActivityChart.jsx              # Recharts bar/line chart for examinee activity
│   │   ├── StatCard.jsx                   # Metric card with icon, change badge, and counter
│   │   └── TestCard.jsx                   # Exam card displaying title, timing, and action buttons
│   ├── exam/
│   │   ├── ExamTimer.jsx                  # Countdown timer with warning thresholds
│   │   ├── QuestionCard.jsx               # MCQ / MSQ / Subjective single question renderer
│   │   └── QuestionPalette.jsx            # Grid of question numbers with status color indicators
│   ├── layout/
│   │   ├── Footer.jsx                     # Site footer with status pills and copyright
│   │   ├── Navbar.jsx                     # Main navigation bar with role badge & theme toggle
│   │   └── ProtectedRoute.jsx             # Role-based route guard checking AuthContext
│   └── proctor/
│       ├── CameraWidget.jsx               # HTML5 video preview + Canvas wireframe overlay
│       ├── EventLogTable.jsx              # Tabular list of proctoring events with search/filter
│       ├── IdentityVerificationModal.jsx  # Candidate pre-exam webcam snapshot modal
│       ├── RiskMeter.jsx                  # Circular gauge / progress bar for suspicion score
│       └── StudentLiveCard.jsx            # Monitoring card for examiner hall (video + status)
├── context/
│   └── AuthContext.jsx                    # React Context managing user, token, role, and logout
├── hooks/
│   ├── useProctoringSim.js                # Interval-based local event simulation (every 18s)
│   └── useWebcam.js                       # Local navigator.mediaDevices.getUserMedia hook
├── pages/
│   ├── LandingPage.jsx                    # Role selection landing portal (Examiner vs Examinee)
│   ├── LoginPage.jsx                      # Tabbed login form (Student vs Examiner)
│   ├── NotFoundPage.jsx                   # 404 fallback page
│   ├── RegisterPage.jsx                   # Tabbed registration form
│   ├── admin/
│   │   ├── AdminDashboardPage.jsx         # Examiner overview metrics and active exams
│   │   ├── CustomTestPage.jsx             # Manual question-by-question test builder
│   │   ├── GenerateTestPage.jsx           # AI / topic-based automated test generator
│   │   ├── LiveMonitoringPage.jsx         # Examiner live hall monitoring grid
│   │   ├── ProctorDiagnosticsPage.jsx     # Computer vision diagnostic dashboard
│   │   ├── ReportDetailsPage.jsx          # Comprehensive candidate audit & evidence viewer
│   │   └── TestSchedulePage.jsx           # Exam scheduling and passkey manager
│   └── student/
│       ├── ExamTakingPage.jsx             # Active examination interface with proctoring overlay
│       ├── PasskeyEntryPage.jsx           # Candidate exam code / passkey verification screen
│       ├── PracticeExamPage.jsx           # Diagnostic practice test environment
│       ├── StudentDashboardPage.jsx       # Examinee portal showing assigned & past exams
│       └── StudentReportPage.jsx          # Candidate post-examination performance report
└── routes/
    └── AppRoutes.jsx                      # React Router DOM v7 route definitions (17 routes)
```

### Detailed Component Inventory & Dependencies

#### 1. API Services (`Frontend/src/api/`)
- [`client.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/client.js): Configures Axios with `baseURL: 'http://localhost:8000/api/v1'`, 15000ms timeout, and an interceptor that attaches `Bearer <token>` from `localStorage.getItem('token')`.
- [`mockData.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/mockData.js): Contains 535 lines of static mock arrays: `mockUsers`, `mockTests`, `mockQuestions`, `mockLiveCandidates`, `mockProctorEvents`, `mockReports`, and `mockDashboardStats`.
- `authApi.js`, `examApi.js`, `proctorApi.js`, `questionApi.js`, `reportApi.js`, `statsApi.js`, `testApi.js`: Every single API call wraps Axios inside a `try/catch` block. When the backend request fails (which is 100% of the time, as no backend server runs on port 8000), it returns static mock data from `mockData.js`.

#### 2. Layout Components (`Frontend/src/components/layout/`)
- [`Navbar.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/layout/Navbar.jsx): Provides navigation links conditional on `user.role`, displays active candidate/examiner badge, dark/light mode toggle, and logout button.
- [`Footer.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/layout/Footer.jsx): Displays system status indicators, copyright, and documentation links.
- [`ProtectedRoute.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/layout/ProtectedRoute.jsx): Verifies `user` and `token` in `AuthContext`. If `allowedRoles` does not match `user.role`, redirects to `/login`.

#### 3. Proctoring Components (`Frontend/src/components/proctor/`)
- [`CameraWidget.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/CameraWidget.jsx): Renders an HTML5 `<video>` element using `useWebcam()`. On top of the video, it renders an HTML5 `<canvas>` that draws simulated face mesh points and target boxes. It also includes an overlay badge showing simulated status (`ACTIVE`, `NO_FACE`, `MULTIPLE_FACES`).
- [`StudentLiveCard.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/StudentLiveCard.jsx): Represents one candidate card in the Examiner Live Hall. Critically, it renders `CameraWidget` with `customState={student}`, meaning **it attempts to open the examiner's local webcam for every single student card** rather than streaming remote video.
- [`EventLogTable.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/EventLogTable.jsx): Displays a filtered list of proctoring events with severity badges, timestamps, confidence scores, and action buttons (`Dismiss`, `View Screenshot`).
- [`RiskMeter.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/RiskMeter.jsx): Visualizes a numeric risk score (0–100) using SVG circular stroke offsets or horizontal colored bars (Green: 0–30, Yellow: 31–70, Red: 71–100).
- [`IdentityVerificationModal.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/IdentityVerificationModal.jsx): A 3-step modal shown before entering an exam: Hardware Check -> Face Alignment -> Snapshot Capture. The snapshot captures a canvas data URL (`canvas.toDataURL('image/jpeg')`) and saves it to local component state.

---

## 4. Existing Routes & Navigation Audit

The repository defines exactly 17 routes in [`Frontend/src/routes/AppRoutes.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/routes/AppRoutes.jsx). Below is the comprehensive audit of every route:

| Route Path | Page Component | Access Control | Role Restriction | Data Source | Primary Actions | Verified Current Limitations |
|---|---|---|---|---|---|---|
| `/` | `LandingPage.jsx` | Public | None | Static markup | Select role (Examiner vs Examinee), navigate to login | Static links only; no session auto-redirect. |
| `/login` | `LoginPage.jsx` | Public | None | `authApi.login()` | Tab switch role, enter credentials, mock login | Backend connection fails; catches and uses mock JWT. |
| `/register` | `RegisterPage.jsx` | Public | None | `authApi.register()` | Fill user profile, mock register | Form does not validate institutions; uses mock response. |
| `/admin/dashboard` | `AdminDashboardPage.jsx` | Authenticated | `setter` (Examiner) | `statsApi.getOverview()`, `testApi.getTests()` | View aggregate metrics, navigate to exam actions | Data comes from `mockData.js`; non-reactive. |
| `/admin/live-monitoring` | `LiveMonitoringPage.jsx` | Authenticated | `setter` (Examiner) | `proctorApi.getLiveCandidates()`, `getEvents()` | Filter candidates by risk, search, dismiss alerts | Cards render examiner's webcam; events are mock. |
| `/admin/schedule-test` | `TestSchedulePage.jsx` | Authenticated | `setter` (Examiner) | `testApi.getTests()`, `createTest()` | Schedule exam dates, generate passkeys | Passkeys are generated client-side; no backend DB. |
| `/admin/generate-test` | `GenerateTestPage.jsx` | Authenticated | `setter` (Examiner) | `questionApi.generateQuestions()` | Select subject/difficulty, generate AI test | AI generation is simulated via mock questions. |
| `/admin/custom-test` | `CustomTestPage.jsx` | Authenticated | `setter` (Examiner) | `testApi.createTest()` | Add custom questions, set marks, save test | Saved only to local React state; lost on page refresh. |
| `/admin/reports/:reportId`| `ReportDetailsPage.jsx` | Authenticated | `setter` (Examiner) | `reportApi.getReportById()` | Inspect timeline, dismiss events, export PDF | PDF export is a dummy alert; dismissal updates local state. |
| `/admin/diagnostics` | `ProctorDiagnosticsPage.jsx` | Authenticated | `setter` (Examiner) | Local `CameraWidget`, simulated telemetry | Test local camera, view simulated latency & FPS | Disconnected from `video_input_analysis.py`; fake stats. |
| `/student/dashboard` | `StudentDashboardPage.jsx` | Authenticated | `student` (Examinee) | `testApi.getAvailableTests()` | View assigned tests, view past scores, enter test | Static mock exam list; cannot join external exams. |
| `/student/passkey` | `PasskeyEntryPage.jsx` | Authenticated | `student` (Examinee) | `testApi.verifyPasskey()` | Enter 6-digit code, verify schedule | Validates against `mockTests` passkeys (`TEST2026`). |
| `/student/exam/:testId` | `ExamTakingPage.jsx` | Authenticated | `student` (Examinee) | `examApi.getExamQuestions()`, `useProctoringSim` | Answer MCQs, navigate palette, submit exam | No tab-switch listener; proctoring events are simulated. |
| `/student/practice` | `PracticeExamPage.jsx` | Authenticated | `student` (Examinee) | `questionApi.getPracticeQuestions()` | Practice 10 random questions, self-assess | Local score evaluation only; no persistent record. |
| `/student/report/:reportId`| `StudentReportPage.jsx` | Authenticated | `student` (Examinee) | `reportApi.getStudentReport()` | View performance score, view proctoring score | Shows mock risk score; evidence screenshots are static. |
| `/unauthorized` | Inline error block in `AppRoutes.jsx` | Authenticated | None | Static markup | Navigate back to dashboard | Minimalist 403 screen. |
| `*` | `NotFoundPage.jsx` | Public | None | Static markup | Navigate to home | Standard 404 page. |

---

## 5. Page-by-Page Audit

### 5.1 Landing & Role Selection
- **File**: [`Frontend/src/pages/LandingPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/LandingPage.jsx)
- **Status**: `Implemented and verified`
- **Component Breakdown**: Hero section with marketing copy, two prominent role selection cards ("Examiner Portal" and "Candidate Portal"), feature highlights grid, and testimonial/compliance banner.
- **Data Source**: Static JSX content; no network requests.
- **Actions**: Clicking "Examiner Portal" navigates to `/login?role=setter`; clicking "Candidate Portal" navigates to `/login?role=student`.
- **Validation & Error Handling**: None required.
- **Limitations**: Does not check existing authentication state (if an already authenticated user navigates to `/`, they are not automatically forwarded to their dashboard).

### 5.2 Authentication & Registration
- **Files**: [`Frontend/src/pages/LoginPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/LoginPage.jsx), [`Frontend/src/pages/RegisterPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/RegisterPage.jsx)
- **Status**: `Partially implemented` (Mock fallback)
- **Component Breakdown**:
  - `LoginPage`: Role toggle tabs (`student` vs `setter`), email/password input fields, remember-me checkbox, submit button with loading spinner, and quick-fill demo credential buttons.
  - `RegisterPage`: Role toggle tabs, full name, email, password, confirm password, institution name, student ID / employee ID.
- **Data Source & Flow**: Calls `authApi.login({ email, password, role })`. The Axios client attempts `POST http://localhost:8000/api/v1/auth/login`. When connection is refused, `catch` block intercepts error and resolves a mock response containing `{ token: 'mock-setter-jwt-token-2026', user: { ... } }`.
- **State Management**: On resolution, `login()` from [`AuthContext.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/context/AuthContext.jsx) persists `token` and `user` to `localStorage` and updates React state.
- **Validation**: Basic HTML5 `required` attributes and client-side password match check. No server-side format verification.
- **Limitations**: Creates an illusion of authentication. Any arbitrary password works with demo accounts.

### 5.3 Candidate Profile & Photograph Capture
- **File**: [`Frontend/src/components/proctor/IdentityVerificationModal.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/IdentityVerificationModal.jsx) (Embedded inside `ExamTakingPage.jsx`)
- **Status**: `Partially implemented`
- **Component Breakdown**: Modal dialog featuring a 3-step stepper: (1) System & Camera Check, (2) Positioning Guide with circular face-guide overlay, (3) Live Snapshot Capture and review preview.
- **Data Source & Flow**: Uses `navigator.mediaDevices.getUserMedia` to display local webcam feed. The "Capture Photo" button draws current frame to an offscreen `<canvas>` and extracts a Base64 data URL.
- **State Management**: Stores snapshot Base64 in local state `snapshotUrl`. When user clicks "Confirm & Enter Exam", it triggers `onComplete(snapshotUrl)`.
- **Limitations**: **The captured snapshot is NEVER sent to any backend API or face-verification endpoint**. It is stored in temporary component memory in `ExamTakingPage` and discarded upon page navigation. No face-recognition matching is performed between the reference photo and live webcam stream.

### 5.4 Examiner Dashboard
- **File**: [`Frontend/src/pages/admin/AdminDashboardPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/AdminDashboardPage.jsx)
- **Status**: `Partially implemented` (Mock data)
- **Component Breakdown**: Header with examiner greeting and quick action buttons ("Schedule Test", "Generate AI Test", "Custom Test"), 4 `StatCard` widgets (Active Exams, Total Candidates, Flagged Anomalies, System Health), `ActivityChart` rendering candidate volume over time, and a table of upcoming/live examinations.
- **Data Source**: Calls `statsApi.getOverview()` and `testApi.getTests()`, which return `mockDashboardStats` and `mockTests`.
- **State Management**: Standard `useEffect` hook loading data into `stats` and `tests` state variables.
- **Limitations**: No live WebSocket updates. Stats do not update when active exams change or when anomalies are flagged in other tabs.

### 5.5 Test Generation
- **File**: [`Frontend/src/pages/admin/GenerateTestPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/GenerateTestPage.jsx)
- **Status**: `Placeholder/mock`
- **Component Breakdown**: Configuration form (Subject, Topic, Difficulty slider, Question Count, Bloom's Taxonomy focus), "Generate Questions" button with simulated animated progress bar, generated question preview cards with edit/delete buttons, and "Save as Test" button.
- **Data Source**: Calls `questionApi.generateQuestions()`. In reality, the API returns a filtered subset of hardcoded questions from `mockQuestions` after an artificial 1500ms delay.
- **Limitations**: No real LLM or AI generation occurs. The questions are purely static mock objects.

### 5.6 Custom Test Creation
- **File**: [`Frontend/src/pages/admin/CustomTestPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/CustomTestPage.jsx)
- **Status**: `Partially implemented`
- **Component Breakdown**: Multi-section form: Exam metadata (Title, Subject, Total Duration, Passing Marks, Instructions) followed by a dynamic question builder allowing manual input of question text, option choices, correct answer designation, and explanation.
- **State Management**: Form data stored in local component state `formData` and `questions` array.
- **Data Source**: On form submit, calls `testApi.createTest()`. Since backend is offline, the mock fallback appends the test to a local temporary array in memory.
- **Limitations**: Changes do not persist to a database. Refreshing the browser erases newly created tests.

### 5.7 Scheduling & Passkey Generation
- **File**: [`Frontend/src/pages/admin/TestSchedulePage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/TestSchedulePage.jsx)
- **Status**: `Partially implemented`
- **Component Breakdown**: Date/time range pickers, timezone selector, exam duration lock, candidate access list, and an automated passkey generator button (generates 6–8 character alphanumeric strings like `PROCTOR-882`).
- **Data Source**: Reads from and writes to `mockTests`.
- **Limitations**: Passkeys are not cryptographically hashed or stored in a persistent database. No email invitation or candidate notification mechanism exists.

### 5.8 Examiner Live Hall (Monitoring)
- **File**: [`Frontend/src/pages/admin/LiveMonitoringPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/LiveMonitoringPage.jsx)
- **Status**: `Placeholder/mock`
- **Component Breakdown**: Real-time status header (Total Active, High Risk, Warning, Normal), candidate filter bar (search by name/roll no, filter by risk level: All / High / Medium / Low), candidate video grid rendering multiple `StudentLiveCard` components, and a side-drawer displaying detailed event history.
- **Webcam / Video Issue**: Each `StudentLiveCard` renders `CameraWidget`. Because there is no WebRTC media server or remote RTSP/HLS stream, **every card opens the examiner's local computer webcam**.
- **Data Source**: Calls `proctorApi.getLiveCandidates()`. Candidate records in `mockLiveCandidates` contain static fields: `riskScore: 78`, `lastAnomaly: "Looking Away"`.
- **Actions**: Examiner can click "Dismiss" on an event or "Send Warning" to a candidate. These actions only mutate local React state in `LiveMonitoringPage`.

### 5.9 Examinee Dashboard
- **File**: [`Frontend/src/pages/student/StudentDashboardPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/student/StudentDashboardPage.jsx)
- **Status**: `Partially implemented` (Mock data)
- **Component Breakdown**: Welcome banner with candidate name and institution, "Active & Upcoming Exams" section with "Enter Exam" action buttons, "Past Exam Results" section displaying grades and proctoring integrity badges, and quick link to "Practice Exam".
- **Data Source**: Calls `testApi.getAvailableTests()` and `reportApi.getStudentReports()`, falling back to `mockTests` and `mockReports`.
- **Limitations**: Cannot dynamically register for newly created examiner tests; tests are hardcoded.

### 5.10 Passkey Joining
- **File**: [`Frontend/src/pages/student/PasskeyEntryPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/student/PasskeyEntryPage.jsx)
- **Status**: `Partially implemented`
- **Component Breakdown**: Centered security portal featuring a 6-cell PIN input field, hardware prerequisites checklist (Webcam verified, Microphone verified, Browser compatible), and "Proceed to Verification" button.
- **Validation**: Compares entered string against `mockTests[].passkey` (e.g. `TEST2026`). If valid, navigates to `/student/exam/:testId`. If invalid, renders a red error alert.
- **Limitations**: Verification is purely client-side; no backend session token or time-bound entry ticket is issued.

### 5.11 Examination Taking Interface
- **File**: [`Frontend/src/pages/student/ExamTakingPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/student/ExamTakingPage.jsx)
- **Status**: `Partially implemented`
- **Component Breakdown**:
  - `ExamTimer`: Tracks elapsed time and alerts at 5 minutes remaining.
  - `QuestionCard`: Displays current question text, options (radio buttons for MCQ, checkboxes for MSQ), "Clear Choice", and "Mark for Review" toggles.
  - `QuestionPalette`: 20-grid button matrix indicating: Unvisited (Gray), Answered (Green), Marked for Review (Purple), and Visited but Unanswered (Amber).
  - Floating `CameraWidget`: Fixed in the top-right corner displaying live local webcam preview.
  - `IdentityVerificationModal`: Opens automatically before exam starts.
- **Data Source**: Fetches questions via `examApi.getExamQuestions()`. Falls back to `mockQuestions`.
- **Proctoring Simulation**: Mounts [`useProctoringSim.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/hooks/useProctoringSim.js), which sets a JavaScript `setInterval(..., 18000)`. Every 18 seconds, it randomly picks an anomaly (`"LOOKING_AWAY"`, `"MULTIPLE_FACES"`, `"OBJECT_DETECTED"`) and renders a red toast alert on the examinee's screen.
- **Tab-Switching**: **ABSENT**. There is no `visibilitychange`, `blur`, or `focus` event listener in this file or any imported subcomponent.
- **Submission**: On submit, calls `examApi.submitExam()`. Fallback catches failure, simulates a 1-second delay, and navigates to `/student/dashboard`. Answers are not persisted to a database.

### 5.12 Practice / Random Test
- **File**: [`Frontend/src/pages/student/PracticeExamPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/student/PracticeExamPage.jsx)
- **Status**: `Implemented and verified` (Standalone client-side)
- **Component Breakdown**: Self-contained quiz interface with 10 random general knowledge and computer science questions, timer, instantaneous score breakdown, and answer key explanations.
- **Data Source**: Static client-side question array.
- **Limitations**: Proctoring components are omitted; purely an offline practice quiz.

### 5.13 Proctoring Diagnostics
- **File**: [`Frontend/src/pages/admin/ProctorDiagnosticsPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/ProctorDiagnosticsPage.jsx)
- **Status**: `Placeholder/mock`
- **Component Breakdown**: Diagnostic panel displaying camera stream resolution (640x480), frame rate counter (renders a hardcoded `29.8 FPS`), simulated inference latency gauge (`42 ms`), detection sensitivity slider, and toggle switches for YOLO classes (Cell Phone, Book, Laptop, Person).
- **Data Source**: Purely local React state with random jitter added via `setInterval`.
- **Limitations**: **Completely disconnected from `video_input_analysis.py`**. Changing the sliders does not affect the Python CV process in any way.

### 5.14 Candidate Results & Reports
- **Files**: [`Frontend/src/pages/student/StudentReportPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/student/StudentReportPage.jsx), [`Frontend/src/pages/admin/ReportDetailsPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/ReportDetailsPage.jsx)
- **Status**: `Partially implemented` (Mock data)
- **Component Breakdown**:
  - Academic Score Summary: Total Marks, Score Percentage, Percentile rank.
  - Proctoring Integrity Summary: Overall Risk Index (0–100), Trust Score, total flagged anomalies.
  - Anomaly Breakdown: Bar chart and pie chart of detected events by category (Head Pose, Absence, Mobile Device, Tab Switch).
  - Chronological Event Log: Table listing timestamps, event types, severity, and thumbnail links.
- **Data Source**: Fetches from `reportApi.getReportById()`, resolving static data from `mockReports`.
- **Limitations**: Thumbnails reference placeholder Unsplash images or local broken assets (`/evidence/snapshot_101.jpg`). No real evidence images exist on disk.

### 5.15 Evidence Review & Dismissal
- **File**: Contained within [`ReportDetailsPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/ReportDetailsPage.jsx#L140-L195) and [`LiveMonitoringPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/LiveMonitoringPage.jsx#L185-L220)
- **Status**: `Partially implemented` (Client-side mock state only)
- **Component Breakdown**: Action button labeled "Dismiss as False Positive" next to each flagged event row. Clicking opens a prompt requesting an optional examiner justification note.
- **State Flow**: Dispatches `proctorApi.dismissEvent(eventId, note)`. Fallback resolves `{ success: true }`, and the component updates its local `events` array by marking `event.dismissed = true` and recalculating the local display score.
- **Limitations**: The dismissal is never saved to a database. Upon refreshing the page, all dismissed events revert to their active, unreviewed state.

---

## 6. Existing Design & Visual Consistency

### Styling Framework & Configuration
The frontend uses **Tailwind CSS v4** via the `@tailwindcss/vite` plugin. The entry stylesheet is [`Frontend/src/index.css`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/index.css):
```css
@import "tailwindcss";

@layer base {
  body {
    @apply bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100;
  }
}
```

### Visual Audit & Discrepancies
1. **Color Tokens**:
   - Primary: Indigo (`indigo-600`, hover `indigo-700`).
   - Secondary / Accent: Purple (`purple-600`) and Sky (`sky-500`).
   - Neutral: Slate scale (`slate-50` through `slate-950`).
   - Status / Severity:
     - Normal / Low: Emerald (`emerald-500`, `bg-emerald-50`).
     - Warning / Medium: Amber (`amber-500`, `bg-amber-50`).
     - Danger / High: Red/Rose (`red-500`, `rose-600`, `bg-red-50`).
2. **Typography**: Uses system default sans-serif font stack. Headings consistently use `font-bold tracking-tight`, and body text uses `text-sm leading-relaxed`.
3. **Dark Mode Implementation**: Managed in [`Navbar.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/layout/Navbar.jsx) via a button that toggles the `'dark'` class on `document.documentElement` and stores `'dark'` or `'light'` in `localStorage.getItem('theme')`.
4. **Design Inconsistencies & Flaws**:
   - **Exam Screen Alarms**: In [`ExamTakingPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/student/ExamTakingPage.jsx), the proctoring simulation triggers aggressive red floating toast alerts with buzzer icons directly on the candidate's question area. This violates the architectural principle of *Non-Alarming Examinee Aesthetics*.
   - **No Responsive Sidebar**: Admin pages lack a unified persistent sidebar. Navigation relies solely on a top navbar with limited horizontal space, causing wrap issues on tablets and smaller laptop screens.
   - **Ad-Hoc Modal Dialogs**: Modals (such as `IdentityVerificationModal`) implement custom absolute centering and backdrop divs rather than using a standardized accessible `<dialog>` primitive or headless UI component with focus-trapping.

---

## 7. Current Backend & API Integration

The API client layer is implemented in [`Frontend/src/api/client.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/client.js):
```javascript
import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;
```

### Comprehensive API Module Audit

Every service in `Frontend/src/api/` follows an identical pattern of catching Axios network errors and returning static objects from `mockData.js`. The table below records the verified endpoint targets and their actual behavior:

| API File | Exported Function | Target Endpoint & Method | Intended Payload | Mock Fallback Behavior | Operational State |
|---|---|---|---|---|---|
| [`authApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/authApi.js) | `login(credentials)` | `POST /auth/login` | `{ email, password, role }` | Returns `mockUsers[0]` + static JWT token | `Placeholder/mock` |
| [`authApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/authApi.js) | `register(userData)` | `POST /auth/register` | `{ name, email, password, role, ... }` | Returns newly formatted mock user + JWT | `Placeholder/mock` |
| [`authApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/authApi.js) | `logout()` | `POST /auth/logout` | *None* | Clears local storage; returns `{ success: true }` | `Placeholder/mock` |
| [`examApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/examApi.js) | `getExamQuestions(id)` | `GET /exams/:id/questions` | *None* | Returns `mockQuestions` | `Placeholder/mock` |
| [`examApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/examApi.js) | `saveAnswerDraft(id, a)` | `POST /exams/:id/draft` | `{ questionId, selectedOption }` | Returns `{ status: 'saved' }` | `Placeholder/mock` |
| [`examApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/examApi.js) | `submitExam(id, ans)` | `POST /exams/:id/submit` | `{ answers: [...] }` | Returns `{ reportId: 'rep-001', score: 85 }` | `Placeholder/mock` |
| [`proctorApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/proctorApi.js) | `getLiveCandidates()` | `GET /proctor/live-candidates`| *None* | Returns `mockLiveCandidates` | `Placeholder/mock` |
| [`proctorApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/proctorApi.js) | `getEvents(studentId)` | `GET /proctor/events` | Query params | Returns `mockProctorEvents` | `Placeholder/mock` |
| [`proctorApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/proctorApi.js) | `dismissEvent(id, note)`| `POST /proctor/events/:id/dismiss`| `{ note }` | Returns `{ success: true, eventId }` | `Placeholder/mock` |
| [`questionApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/questionApi.js) | `generateQuestions(cfg)`| `POST /questions/generate` | `{ subject, count, difficulty }` | Returns sliced `mockQuestions` after 1.5s delay | `Placeholder/mock` |
| [`reportApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/reportApi.js) | `getReportById(id)` | `GET /reports/:id` | *None* | Returns `mockReports[0]` | `Placeholder/mock` |
| [`statsApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/statsApi.js) | `getOverview()` | `GET /stats/overview` | *None* | Returns `mockDashboardStats` | `Placeholder/mock` |
| [`testApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/testApi.js) | `createTest(testData)` | `POST /tests` | `{ title, subject, duration, ... }` | Prepends to `mockTests`; returns new test | `Placeholder/mock` |
| [`testApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/testApi.js) | `verifyPasskey(code)` | `POST /tests/verify-passkey` | `{ passkey: code }` | Finds match in `mockTests`; returns test info | `Placeholder/mock` |

> [!WARNING]
> **Silent Mock Trap**: Because every API function catches network errors and resolves mock data without throwing or setting an error banner, developers testing the frontend in isolation may mistakenly believe the application is successfully talking to a backend server.

---

## 8. Current Webcam & Computer Vision Integration

The repository contains two distinct camera implementations that are **completely decoupled and isolated from one another**:
1. **Frontend Webcam**: Implemented in [`Frontend/src/hooks/useWebcam.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/hooks/useWebcam.js) and [`Frontend/src/components/proctor/CameraWidget.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/CameraWidget.jsx).
2. **Backend / Desktop CV**: Implemented in Python in [`video_input_analysis.py`](file:///c:/Users/tanis/IntelliProctor/video_input_analysis.py).

### The 8-Stage Pipeline Breakdown

Below is the verified end-to-end trace across the 8 stages required by the target architecture:

```
[1. Local Browser Video]  ====>  [2. Frame Transport]  ====>  [3. CV Inference]
 (useWebcam: 640x480)              (DISCONNECTED)            (video_input_analysis.py)
   IMPLEMENTED                        PLANNED                   STANDALONE PYTHON
        |
        v
[4. Processed Stream]    <====  [5. Event Ingestion]   <====  [6. Evidence Store]
  (Canvas Wireframe)             (DISCONNECTED)              (DISCONNECTED)
   MOCK OVERLAY                       PLANNED                   PLANNED
        |
        v
[7. Examiner Monitoring] ====>  [8. Scoring & Reports]
 (Local Webcam Re-opened)         (Static Mock Data)
   MOCK/PLACEHOLDER                 MOCK/PLACEHOLDER
```

| Stage Number | Pipeline Stage | Source File / Implementation | Verified Status | Detailed Technical Analysis |
|---|---|---|---|---|
| **Stage 1** | **Browser Camera Preview** | [`Frontend/src/hooks/useWebcam.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/hooks/useWebcam.js) | `Implemented and verified` | Calls `navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })`. Streams live video into an HTML5 `<video ref={videoRef} autoPlay playsInline muted />`. Tracks permissions, loading, and device error states. |
| **Stage 2** | **Frame Transport to Inference** | *None* | `Planned` | **No transport mechanism exists**. The browser video stream is not sent to any WebSocket, WebRTC peer connection, HTTP streaming endpoint, or local IPC socket. |
| **Stage 3** | **Actual CV Inference** | [`video_input_analysis.py`](file:///c:/Users/tanis/IntelliProctor/video_input_analysis.py) | `Implemented and verified` *(Standalone)* | Standalone Python script using OpenCV (`cv2.VideoCapture`), MediaPipe FaceMesh, and YOLO (`models/pretrained/yolo11m.pt`). It runs entirely on the desktop OS, displays an OpenCV highgui window, and logs anomalies to terminal stdout. It has no web server or IPC bridge. |
| **Stage 4** | **Processed Stream to Browser** | [`Frontend/src/components/proctor/CameraWidget.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/CameraWidget.jsx#L45-L105) | `Placeholder/mock` | The frontend does not receive processed frames from Python. Instead, `CameraWidget` renders an HTML5 `<canvas>` over the local video and draws client-side animated green circles (simulating MediaPipe facial landmarks) and dummy bounding boxes using `requestAnimationFrame`. |
| **Stage 5** | **Structured Event Delivery to Backend** | *None* | `Planned` | No proctoring events generated by `video_input_analysis.py` or the browser are POSTed to any backend API endpoint. |
| **Stage 6** | **Evidence Persistence** | [`video_input_analysis.py:284`](file:///c:/Users/tanis/IntelliProctor/video_input_analysis.py#L284) | `Partially implemented` *(Desktop only)* | In `video_input_analysis.py`, `cv2.imwrite()` writes screenshots to a local desktop folder `screenshots/` upon threshold breach. However, there is no HTTP upload, database record creation, or S3/MinIO bucket synchronization. |
| **Stage 7** | **Examiner Remote Monitoring** | [`Frontend/src/components/proctor/StudentLiveCard.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/StudentLiveCard.jsx) | `Placeholder/mock` | In `LiveMonitoringPage`, candidate video feeds are rendered using `StudentLiveCard`. Because no WebRTC stream exists, **every card re-executes `useWebcam()`**, attempting to open the examiner's local computer camera multiple times. |
| **Stage 8** | **Report & Suspicion Score Delivery** | [`Frontend/src/api/reportApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/reportApi.js) | `Placeholder/mock` | Reports are read from `mockReports` in `mockData.js`. Scores (`riskIndex: 12`, `78`, etc.) are static integers hardcoded in the mock database. |

---

## 9. Tab-Switching Architecture Audit

A core requirement of IntelliProctor is independent browser-based tab-visibility monitoring. The repository was comprehensively searched for:
- `document.addEventListener('visibilitychange', ...)`
- `document.visibilityState` / `document.hidden`
- `window.addEventListener('blur', ...)`
- `window.addEventListener('focus', ...)`
- Any tab-loss or window-blur telemetry dispatch.

### Verified Audit Findings
1. **Zero Runtime Listeners in Active Code**: There is **no Page Visibility API listener or blur/focus listener anywhere in active JavaScript or JSX files**.
2. **Static Mock Text Only**: The string `"Browser Tab Focus Lost"` appears exactly once in the entire repository: inside [`Frontend/src/api/mockData.js:272`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/mockData.js#L272) as a sample static mock event log description.
3. **Audit of the 8 Required Tab-Switching Stages**:

| Stage | Tab-Switching Requirement | Repository Evidence | Verified Status |
|---|---|---|---|
| **1** | Browser tab visibility detected | No `visibilitychange` listener exists in `ExamTakingPage.jsx` or any hook. | `Planned` |
| **2** | Associated with active exam session | No exam session context or metadata tracking exists for DOM events. | `Planned` |
| **3** | Reaches authenticated backend | No API route or Axios call (`POST /proctor/events`) is invoked on tab switch. | `Planned` |
| **4** | Backend validates & persists event | Backend server and database do not exist in the repository. | `Planned` |
| **5** | Backend applies scoring policy | Centralized scoring engine does not exist in the repository. | `Planned` |
| **6** | Authoritative alerts/score available | No live score synchronization exists; frontend uses static mock scores. | `Planned` |
| **7** | Examiner sees event in monitoring/reports | Table in `LiveMonitoringPage` displays `"Browser Tab Focus Lost"` strictly from static `mockData.js`. | `Placeholder/mock` |
| **8** | Candidate sees permitted feedback | No non-alarming status indicator or tab-switch acknowledgment is displayed to candidate. | `Planned` |

---

## 10. Current Proctoring Events & Suspicion Scoring

### Event Simulation via `useProctoringSim.js`
In the examinee interface ([`ExamTakingPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/student/ExamTakingPage.jsx#L38)), live proctoring events are simulated using the custom hook [`Frontend/src/hooks/useProctoringSim.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/hooks/useProctoringSim.js):

```javascript
// Excerpt from Frontend/src/hooks/useProctoringSim.js
export const useProctoringSim = (isActive = true) => {
  const [events, setEvents] = useState([]);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      // Pick random simulated event
      const anomalies = [
        { type: 'LOOKING_AWAY', severity: 'MEDIUM', weight: 10 },
        { type: 'OBJECT_DETECTED', severity: 'HIGH', weight: 25 },
        { type: 'MULTIPLE_FACES', severity: 'CRITICAL', weight: 40 },
      ];
      const anomaly = anomalies[Math.floor(Math.random() * anomalies.length)];

      setEvents((prev) => [anomaly, ...prev]);
      // Client-side local score calculation:
      setScore((prev) => Math.min(100, prev + anomaly.weight));
    }, 18000);

    return () => clearInterval(interval);
  }, [isActive]);

  return { events, score };
};
```

### Analysis of Current Scoring Mechanisms
1. **Frontend Score Calculation Conflict**: `useProctoringSim.js` directly calculates and increments a suspicion score locally in the browser (`prev + anomaly.weight`). This violates the core architectural rule: **Frontend code must NEVER calculate or modify authoritative suspicion scores**.
2. **Static Scores in Examiner Dashboard**: In `LiveMonitoringPage.jsx` and `ReportDetailsPage.jsx`, candidate risk scores are drawn from static mock objects (`riskScore: 78`, `riskIndex: 12`).
3. **Absence of Backend Scoring Engine**: No scoring formula, decay parameter, or cross-signal correlation engine exists on the backend.
4. **Missing Architectural Bridge**: Neither YOLO detections from `video_input_analysis.py` nor browser tab events reach a centralized scoring service.

---

## 11. Current Data Models & Response Assumptions

The frontend assumes specific object shapes defined in [`Frontend/src/api/mockData.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/mockData.js). Below is an audit of these assumptions against the target database schema:

```
[Target Backend Database Models]             [Current Frontend Mock Objects]
  users (UUID, password_hash, role)  <====>    mockUsers (string id, mock token)
  examinations (UUID, passkey, dates)<====>    mockTests (integer/string id, mock passkey)
  questions (UUID, options JSON, ...) <====>    mockQuestions (MCQ format only)
  proctoring_events (UUID, enum, ...) <====>    mockProctorEvents (hardcoded string types)
  reports (UUID, score, risk_index)   <====>    mockReports (hardcoded scores & static URLs)
```

### Field-by-Field Gap Analysis

#### 1. User Entity
- **Current Mock Fields**: `id`, `name`, `email`, `role` (`'student' | 'setter'`), `institution`, `candidateId`, `avatar`.
- **Target Missing Fields**: `id` as UUID v4, `referencePhotoUrl`, `hardwareProfiles` (Webcam specs), `createdAt`, `isActive`.

#### 2. Examination Entity
- **Current Mock Fields**: `id`, `title`, `subject`, `duration` (minutes), `totalMarks`, `passkey`, `status` (`'live' | 'upcoming' | 'completed'`), `questionsCount`, `scheduledAt`.
- **Target Missing Fields**: `id` as UUID v4, `examinerId` (foreign key), `startTimeWindow`, `endTimeWindow`, `strictTabSwitchLimit`, `isPublished`.

#### 3. Question Entity
- **Current Mock Fields**: `id`, `text`, `options` (array of strings), `correctAnswer` (index integer), `marks`, `type` (`'mcq'`), `difficulty`.
- **Target Missing Fields**: `explanation`, `tags`, `codeSnippet`, `type` support for MSQ (multiple select), Integer/Numerical, and Subjective.

#### 4. Proctoring Event Entity
- **Current Mock Fields**: `id`, `studentId`, `timestamp`, `type` (`'Looking Away' | 'Object Detected' | 'Browser Tab Focus Lost' | 'Multiple Faces'`), `severity` (`'LOW' | 'MEDIUM' | 'HIGH'`), `confidence`, `screenshotUrl`, `status`, `dismissed`.
- **Target Missing Fields**: Standardized enum identifiers (`TAB_BLUR`, `GAZE_AWAY`, `PHONE_DETECTED`, `PERSON_ABSENT`), `sessionId` (exam session UUID), `durationMs` (dwell time of anomaly), `boundingBox` (`[x, y, w, h]`), `evidenceId`, `verifiedBy` (examiner UUID).

#### 5. Report Entity
- **Current Mock Fields**: `id`, `studentId`, `testId`, `score`, `percentage`, `riskIndex`, `anomalyBreakdown` (counts by type), `timeline` (event array).
- **Target Missing Fields**: `reviewStatus` (`'UNREVIEWED' | 'DISMISSED' | 'CONFIRMED'`), `examinerNotes`, `scoreBreakdown` (section-by-section academic scores), `sessionDurationSeconds`.

---

## 12. Error States & UX Reliability

The table below audits how the current frontend handles failure modes, network interruptions, and hardware exceptions:

| Failure / Exception Condition | Target UX Requirement | Verified Current Implementation | UX Reliability Assessment |
|---|---|---|---|
| **Backend Unreachable (Network Error)** | Display persistent banner: "Backend offline. Telemetry paused. Retrying..."; block exam submission. | Axios interceptor catches error silently and serves mock data from `mockData.js`. | **Critical UX Hazard**: Deceives user/tester into believing backend is operational. |
| **Camera Permission Denied** | Modal alert with OS/browser guide; disable "Enter Exam" until stream acquired. | Handled in `useWebcam.js`: sets `error` state. `CameraWidget` displays red error card: "Camera Error: Permission Denied". | `Implemented and verified` |
| **Camera Stream Interrupted Mid-Exam** | Visual warning badge; pause exam timer or notify examiner; retry acquisition. | Video element displays frozen/black frame. No notification dispatched to examiner or server. | `Partially implemented` |
| **Invalid / Expired Passkey** | Inline error banner: "Invalid or expired exam passkey. Contact your examiner." | Checks against `mockTests`. Displays red alert text: "Invalid passkey. Please check and try again." | `Implemented and verified` (Mock only) |
| **Exam Timer Expiry** | Automatic forced submission with disablement of inputs and confirmation dialog. | `ExamTimer` reaches 00:00: triggers `onTimeUp()`, which invokes `handleSubmitExam()`. | `Implemented and verified` |
| **Tab-Switching During Exam** | Non-alarming UI indicator; structured telemetry sent to backend. | **Completely unhandled**. No listener or visual feedback exists. | `Planned` |
| **Failed Answer Draft Save** | Retries with exponential backoff; local queue; warning if unpersisted answers exist. | Network call fails silently; mock returns `{ status: 'saved' }`. Local draft lost on tab close. | `Placeholder/mock` |
| **Evidence Image 404 / Missing** | Fallback placeholder SVG with "Snapshot unavailable" label. | Standard broken HTML `<img>` icon rendered in `ReportDetailsPage` and `EventLogTable`. | `Placeholder/mock` |
| **Unauthorized Role Access** | Immediate redirect to `/unauthorized` or `/login` with explanatory toast. | `ProtectedRoute.jsx` checks `user.role`. Redirects to `/login` if unauthenticated or `/unauthorized` if role mismatch. | `Implemented and verified` |

---

## 13. Comprehensive Gap Analysis Table

The following comparison table presents the definitive gap analysis across all functional areas of the IntelliProctor frontend:

| Feature Area | Current Implementation State | Desired Behavior (`FRONTEND_ARCHITECTURE.md`) | Gap & Required Implementation Work | Relevant Files / Dependencies | Priority |
|---|---|---|---|---|---|
| **Landing & Role Selection** | `Implemented and verified` (Static) | Clean role selection portal with auto-redirect for existing active sessions. | Add session check in `LandingPage.jsx`; redirect active `student` to `/student/dashboard` and `setter` to `/admin/dashboard`. | [`LandingPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/LandingPage.jsx), [`AuthContext.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/context/AuthContext.jsx) | Medium |
| **Authentication & Tokens** | `Placeholder/mock` (Mock JWT) | Real JWT authentication with access/refresh tokens, institutional validation, and secure storage. | Connect `authApi.js` to real backend `/auth/login` and `/auth/refresh`; remove hardcoded mock fallbacks. | [`authApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/authApi.js), [`client.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/client.js) | High |
| **Candidate Photograph Capture** | `Partially implemented` (Local snapshot) | Capture high-resolution reference photo; POST to backend `/candidates/reference-photo` for embedding extraction. | Wire `IdentityVerificationModal` capture to backend API; persist image URL in candidate profile; add face quality validation. | [`IdentityVerificationModal.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/IdentityVerificationModal.jsx) | High |
| **Examiner Dashboard** | `Partially implemented` (Mock stats) | Real-time aggregate telemetry, active exam monitors, flagged candidate counters with live polling or WebSockets. | Replace `mockDashboardStats` with real API calls; connect WebSocket listener for aggregate metric updates. | [`AdminDashboardPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/AdminDashboardPage.jsx), [`statsApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/statsApi.js) | Medium |
| **Test Generation & Custom Tests** | `Partially implemented` (Mock questions) | Save custom and AI-generated tests to PostgreSQL database; support rich question types (MCQ, MSQ, Subjective). | Build backend persistence in `/tests` API; expand `CustomTestPage` form inputs to support MSQ and code snippets. | [`CustomTestPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/CustomTestPage.jsx), [`GenerateTestPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/GenerateTestPage.jsx) | Medium |
| **Exam Scheduling & Passkeys** | `Partially implemented` (Client PIN) | Server-generated cryptographically secure passkeys; time-window validation; candidate roster binding. | Move passkey generation and schedule validation to backend; support candidate email invitations. | [`TestSchedulePage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/TestSchedulePage.jsx), [`testApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/testApi.js) | Medium |
| **Examinee Exam Interface** | `Partially implemented` (Local state) | Focused, distraction-free interface with local answer draft caching, question palette, and resilient submission. | Implement IndexedDB/localStorage answer caching; remove mock proctoring simulation; add connection loss banner. | [`ExamTakingPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/student/ExamTakingPage.jsx), [`examApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/examApi.js) | High |
| **Browser Camera Preview** | `Implemented and verified` (640x480) | Local camera preview with hardware checks and permission recovery; non-alarming UI indicator. | Keep `useWebcam.js`; refine permission error messages and add device selector dropdown. | [`useWebcam.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/hooks/useWebcam.js), [`CameraWidget.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/CameraWidget.jsx) | Low |
| **Remote Examiner Video Stream** | `Placeholder/mock` (Local webcam loop) | WebRTC or HLS live video streaming from examinee browser to examiner monitoring dashboard. | Implement WebRTC peer connection or HLS relay server; update `StudentLiveCard` to receive remote media stream. | [`StudentLiveCard.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/StudentLiveCard.jsx), [`LiveMonitoringPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/LiveMonitoringPage.jsx) | High |
| **CV Pipeline Integration** | `Planned` (Zero IPC / WebSockets) | Real-time CV inference feeding structured observations (YOLO, MediaPipe) into backend proctoring service. | Build WebSocket / WebRTC transport bridge between browser/video stream and Python CV worker (`video_input_analysis.py`). | [`video_input_analysis.py`](file:///c:/Users/tanis/IntelliProctor/video_input_analysis.py), `Frontend/src/api/proctorApi.js` | Critical |
| **Tab-Switching Detection** | `Planned` (Zero runtime listeners) | `useTabVisibility` hook observing `visibilitychange` & window blur/focus; records timestamp & dwell duration. | Create `useTabVisibility.js` hook; bind event listeners to active examination lifecycle; emit telemetry events. | [`ExamTakingPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/student/ExamTakingPage.jsx), `Frontend/src/hooks/useTabVisibility.js` | Critical |
| **Tab-Switching Ingestion & Scoring** | `Planned` (No backend ingestion) | Authenticated `POST /proctor/events` endpoint receiving tab events; backend applies scoring policy. | Implement backend telemetry route; integrate tab events with centralized suspicion score calculator. | Backend service, `Frontend/src/api/proctorApi.js` | Critical |
| **Centralized Backend Suspicion Scoring** | `Placeholder/mock` (Simulated in hook) | Single source of truth: Backend evaluates all signals (CV + Tab) and emits authoritative score (0–100). | Remove client-side score computation from `useProctoringSim.js`; subscribe frontend to backend score updates. | [`useProctoringSim.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/hooks/useProctoringSim.js), [`RiskMeter.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/RiskMeter.jsx) | Critical |
| **Alerts & Event Timelines** | `Partially implemented` (Mock logs) | Chronological event list with severity tags, confidence %, and verified evidence links. | Replace `mockProctorEvents` with live WebSocket feed in `EventLogTable.jsx`; support pagination and sorting. | [`EventLogTable.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/EventLogTable.jsx), [`LiveMonitoringPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/LiveMonitoringPage.jsx) | Medium |
| **Evidence Retrieval & Storage** | `Placeholder/mock` (Broken links) | Secure evidence storage (S3/MinIO); signed URLs for screenshot retrieval in examiner reviews. | Implement backend evidence storage service; update frontend image tags to render authenticated signed URLs. | [`ReportDetailsPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/ReportDetailsPage.jsx) | High |
| **Examiner Event Review & Dismissal** | `Partially implemented` (Local state) | Examiner dismisses false positives with notes; backend persists dismissal and recalculates suspicion score. | Connect "Dismiss" button to `POST /proctor/events/:id/dismiss`; update report view with dismissal audit trail. | [`ReportDetailsPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/admin/ReportDetailsPage.jsx), [`proctorApi.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/proctorApi.js) | High |
| **Candidate Report View** | `Partially implemented` (Mock data) | Accessible post-exam report showing academic performance and permitted proctoring summary without raw images. | Display backend-verified score and summary; protect sensitive evidence from unauthorized candidate viewing. | [`StudentReportPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/student/StudentReportPage.jsx) | Medium |
| **Automated Testing Suite** | `Planned` (No test runner installed) | Comprehensive test suite: Vitest unit tests, React Testing Library component tests, Playwright E2E tests. | Install Vitest, `@testing-library/react`, and configure npm test script; write unit tests for hooks and components. | [`Frontend/package.json`](file:///c:/Users/tanis/IntelliProctor/Frontend/package.json), `Frontend/tests/` | High |

---

## 14. Prioritized Implementation Roadmap

Based on actual repository dependencies and architectural prerequisites, future development must proceed through the following phased sequence:

```
[Phase A: Foundations & Layout]
             |
             v
[Phase B: Auth & Candidate Identity]
             |
             v
[Phase C: Exam Creation & Passkeys]
             |
             v
[Phase D: Exam Taking & Answer Cache]
             |
             v
[Phase E: Browser Monitoring & Tab Hook] <====> [CV Pipeline Bridge]
             |                                         |
             +--------------------+--------------------+
                                  |
                                  v
                [Phase F: Centralized Backend Scoring]
                                  |
                                  v
                [Phase G: Live Monitoring & Evidence]
```

### Phase A — Frontend Foundation & Layouts (Priority: High)
1. **Remove Mock Interceptor Fallbacks**: Update [`Frontend/src/api/client.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/client.js) to propagate real HTTP errors instead of masking them behind mock objects.
2. **Standardize Design System Tokens**: Replace ad-hoc Tailwind classes with consistent semantic tokens for status, surfaces, and spacing.
3. **Build Persistent Admin Shell**: Implement a reusable layout featuring a persistent sidebar for examiner routes (`/admin/*`).
4. **Setup Automated Test Harness**: Install Vitest and React Testing Library; configure `npm run test` in `package.json`.

### Phase B — Authentication & Candidate Identity (Priority: High)
1. **Live Auth Integration**: Connect `LoginPage.jsx` and `RegisterPage.jsx` to real backend `/auth` routes with JWT refresh rotation.
2. **Reference Photograph Upload**: Update `IdentityVerificationModal.jsx` to POST captured snapshots to `/candidates/reference-photo`.
3. **Session Auto-Routing**: Add session verification in `LandingPage.jsx` to route logged-in users directly to their dashboards.

### Phase C — Examination Creation & Joining (Priority: Medium)
1. **Persistent Exam Management**: Connect `CustomTestPage.jsx` and `TestSchedulePage.jsx` to backend `/tests` endpoints.
2. **Server-Side Passkey Validation**: Move passkey verification from client-side array search to `POST /tests/verify-passkey`.
3. **Candidate Admission Flow**: Issue time-bound exam session tokens upon successful passkey verification.

### Phase D — Examination Taking & Resilience (Priority: High)
1. **Local Answer Draft Caching**: Store candidate answers in `localStorage` / IndexedDB to prevent data loss on network drops.
2. **Non-Alarming UI Refactor**: Remove distracting red toast notifications from `ExamTakingPage.jsx`.
3. **Graceful Network Recovery**: Implement offline banners and retry queues for answer draft synchronization.

### Phase E — Browser Monitoring & Proctoring Integration (Priority: Critical)
1. **Implement `useTabVisibility` Hook**: Build the independent browser visibility hook monitoring `visibilitychange`, `blur`, and `focus`.
2. **Session-Bound Telemetry Transport**: Dispatch structured tab-switch telemetry (`TAB_BLUR`, `TAB_FOCUS`) to backend `POST /proctor/events`.
3. **Computer Vision Bridge**: Build WebSocket / WebRTC transport connecting the Python CV pipeline (`video_input_analysis.py`) to the backend proctoring ingestion service.

### Phase F — Centralized Backend Scoring & Live Hall (Priority: Critical)
1. **Decommission Client Scoring**: Remove local score calculations from `useProctoringSim.js`.
2. **Backend Score Subscription**: Connect examiner and examinee views to backend-calculated suspicion scores via WebSockets / Server-Sent Events.
3. **Real Remote Video Streaming**: Replace local webcam instantiation in `StudentLiveCard.jsx` with remote WebRTC / HLS video playback.

### Phase G — Evidence Review, Reporting, & Hardening (Priority: High)
1. **Persistent Dismissal Workflow**: Wire "Dismiss" buttons to backend `POST /proctor/events/:id/dismiss` with examiner justification notes.
2. **Signed Evidence URLs**: Fetch evidence screenshots securely via authenticated S3/MinIO pre-signed URLs.
3. **Role-Based Report Access**: Ensure candidates only see permitted summaries while examiners access full evidence audit trails.
4. **End-to-End Test Suite**: Write Playwright E2E tests validating the complete exam lifecycle from passkey entry to submission.

---

## 15. Audit Limitations

The findings in this audit were established through direct static code inspection, configuration analysis, and repository verification under the following boundaries:
1. **Static Code Inspection**: All frontend JavaScript, JSX, CSS, and configuration files in `Frontend/` were inspected directly.
2. **Backend Server Absence**: No backend server or database was running on `localhost:8000` during this audit. Therefore, live network communication, actual token refresh cycles, and database transactions could not be dynamically verified.
3. **Python CV Pipeline Isolation**: [`video_input_analysis.py`](file:///c:/Users/tanis/IntelliProctor/video_input_analysis.py) was analyzed in source code and historical test logs; it runs strictly as a standalone desktop script without any live web socket or IPC bridge to the frontend.
4. **No Test Runner Installed**: Because no test runner (Vitest / Jest) exists in `Frontend/package.json`, automated unit tests could not be executed on frontend components. Oxlint was verified via package configuration.
5. **No Code Modification**: In accordance with the prompt's instructions, no code or dependencies were modified during this audit.

---

## 16. Recommended Next Actions

The following high-priority actions are recommended for future coding agents:

1. **Implement `useTabVisibility` Hook**:
   - **Target File**: `Frontend/src/hooks/useTabVisibility.js`
   - **Task**: Create the independent browser Page Visibility API hook to capture tab switches, window blurs, and dwell durations.
   - **Dependency**: Connect to active examination session in [`ExamTakingPage.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/pages/student/ExamTakingPage.jsx).

2. **Disable Silent Mock Interceptor**:
   - **Target File**: [`Frontend/src/api/client.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/api/client.js)
   - **Task**: Stop masking network failures with static mock data so real backend connection states can be accurately debugged.

3. **Fix Examiner Remote Video Card**:
   - **Target File**: [`Frontend/src/components/proctor/StudentLiveCard.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/StudentLiveCard.jsx)
   - **Task**: Remove `CameraWidget` instantiation that re-opens the local webcam; prepare the component to receive remote WebRTC video streams.

4. **Deprecate Client-Side Scoring**:
   - **Target File**: [`Frontend/src/hooks/useProctoringSim.js`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/hooks/useProctoringSim.js)
   - **Task**: Remove `setScore(prev + anomaly.weight)` logic; ensure all displayed scores originate from backend API responses.

5. **Wire Snapshot to Candidate Profile**:
   - **Target File**: [`Frontend/src/components/proctor/IdentityVerificationModal.jsx`](file:///c:/Users/tanis/IntelliProctor/Frontend/src/components/proctor/IdentityVerificationModal.jsx)
   - **Task**: Update snapshot confirmation to transmit the captured reference image to the backend candidate profile service.
