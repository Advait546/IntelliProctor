# IntelliProctor — Backend Current State Audit

> **Document Version**: 2.0.0 (supersedes the 1.0.0 audit, which predates the backend)
> **Audit Date**: 24 October 2026
> **Target Specification**: [`BACKEND_ARCHITECTURE.md`](BACKEND_ARCHITECTURE.md)
> **Status labels**: `Implemented and verified` (code exists and is exercised by automated tests and/or a recorded end-to-end run), `Partially implemented`, `Planned`.

---

## 1. Summary

The authoritative backend now exists in [`backend/`](backend/README.md) (Python 3.12, FastAPI, SQLAlchemy 2.0 async, Alembic). The computer-vision pipeline runs as a separate HTTP worker in [`proctoring-service/`](proctoring-service/README.md), and the React frontend in [`Frontend/`](Frontend/) talks only to the backend. All mock data, silent mock fallbacks and the client-side score simulator (`useProctoringSim.js`) were removed from the frontend.

| Verification | Result |
|---|---|
| `backend/tests` on SQLite | 42 passed (includes all 18 acceptance scenarios of spec §21) |
| `backend/tests` on PostgreSQL 16 (`TEST_DATABASE_URL`) | 42 passed |
| `backend/tests` with Redis backplane (`TEST_REDIS_URL`) | 42 passed |
| `proctoring-service/tests` | 11 passed (episode state machines) |
| Live CV pipeline, real YOLO11m + MediaPipe on `tests/test_data` images | 15 phone frames -> 1 `PHONE_DETECTED` (+100); 3 real sideways turns -> +10; second person -> `MULTIPLE_FACES` (0); final S = 110 (Suspicious) |
| Browser end-to-end (Chromium, fake webcam fed with test photos) | Examiner creates & publishes exam -> candidate joins, passes 7/7 system checks, answers, tab-switches, phone episode scored live on the examiner grid, submits -> examiner reviews evidence, confirms, prints audit report, views reports |
| S3 evidence path (S3-compatible server) | put / get / 15-minute pre-signed URL verified |

## 2. Technology Stack (as built)

| Layer | Technology | Status |
|---|---|---|
| Web framework | FastAPI + Uvicorn | Implemented and verified |
| Database | PostgreSQL 16 (asyncpg) **or** SQLite (aiosqlite, zero-setup default) | Implemented and verified (both) |
| ORM / migrations | SQLAlchemy 2.0 async / Alembic (`backend/alembic`) | Implemented and verified |
| Cache / pub-sub | Redis 7 (optional) or in-process bus | Implemented and verified (both) |
| Object storage | S3 / MinIO (optional) or private local folder with HMAC-signed URLs | Implemented and verified (both) |
| Auth | Argon2id, HS256 JWT (15 min), rotating refresh cookie with reuse detection | Implemented and verified |
| CV worker | `proctoring-service` (FastAPI, MediaPipe 0.10.21, Ultralytics YOLO11m `phase0`) | Implemented and verified |
| Async task queue (Celery) | Not used -- ingestion is per-episode and synchronous | Planned (only if load requires) |

## 3. Requirement-by-Requirement Status

| Spec section | Requirement | Status | Where |
|---|---|---|---|
| §2 | Backend is the only source of scores; frontend/CV never score | Implemented and verified | `services/scoring.py`; simulator removed; CV returns events only |
| §5.1-5.2 | +10 per 3 head turns, +50 book, +100 phone, ceiling 1000, suspicious iff S >= 100 | Implemented and verified | `services/scoring.py`, tests 1-7, 10, 11 |
| §5.3 | Episode grouping + `SHA256(session_id+event_type+episode_id)` idempotency, duplicate -> HTTP 200 | Implemented and verified | `services/ingest.py`, `proctoring-service/app/episodes.py`, tests 8-9 |
| §5.5 | Zero weight for tab switch, absence, multiple faces, pitch/roll | Implemented and verified | test 15 + `test_zero_weight_*` |
| §5.6 | Append-only ledger, row lock, peak score | Implemented and verified | `suspicion_score_ledger`, per-session lock + `FOR UPDATE`, test 13 |
| §5.7 / §16 | Dismissal never deletes; dual status reporting | Implemented and verified | `/proctor/events/{id}/dismiss|confirm`, test 14 |
| §6 | Ingestion contract, session-state check (409), clock-skew flag | Implemented and verified | `POST /api/v1/proctor/events` |
| §7 | Decoupled CV; phase0 only; Iteration 1 never deployed | Implemented and verified | `proctoring-service/app/detector.py` |
| §8 | Tab telemetry independent of CV; server-measured duration; >3 s discrepancy flag | Implemented and verified | `useTabVisibility.js`, `ingest.py` |
| §9 | Evidence JPEG -> object store -> `evidence_records` (SHA-256) -> 15-min signed URL; failure -> `FAILED` | Implemented and verified | `services/storage.py`, test 18 |
| §10 | Exam state machine, Argon2id passkeys, window check, scoped exam session token | Implemented and verified | `services/exams.py`, `api/exams.py` |
| §11 | RBAC, refresh rotation, IDOR isolation | Implemented and verified | `deps.py`, test 17, `test_examiner_idor_*` |
| §12 | Nine tables + indexes | Implemented and verified | `models.py`, `alembic/versions/0001_initial_schema.py` |
| §13.3 / §14 | Examiner hall WS, candidate notification WS (no scores to candidates) | Implemented and verified | `api/ws.py` |
| §14.3 | WebRTC video to examiner | Partially implemented | Examiner grid shows the candidate's latest uploaded keyframe (~1 fps). No WebRTC/SFU. |
| §15 | Academic evaluation, proctoring synthesis, role-scoped reports, CSV | Implemented and verified | `api/reports.py` |
| §17.1 | RFC 7807-style error envelope | Implemented and verified | `errors.py` |
| §18.1 | AES-256 at rest, 90-day evidence lifecycle | Partially implemented | `S3_SERVER_SIDE_ENCRYPTION=AES256` on AWS; lifecycle expiry must be configured on the bucket. Local store is outside OneDrive but not encrypted. |
| §18.2 | Replay protection | Implemented | idempotency keys (Redis 24 h + DB unique), out-of-order timestamps flagged |
| §19 | 500 concurrent candidates load test | Planned | Not load-tested. CV throughput is CPU-bound (YOLO11m ~1-2.5 s/inference on CPU); use a GPU for large cohorts. |
| Reference photo (Phase B) | Upload & store candidate reference photo | Implemented | `POST /candidates/reference-photo` (captured at exam start). Face matching against it: Planned. |

## 4. Documented Extensions to the Target Schema

`refresh_tokens`, `question_bank_items`, `examiner_settings`; extra columns for passkey HMAC lookup + Fernet-encrypted copy (never plaintext), server-authoritative `expires_at`, tab-switch aggregates, idempotency key, clock-skew / timing-discrepancy flags, evidence status. Question types additionally include `truefalse` and `fillblank` (already supported by the editor). See the docstring of `backend/src/models.py`.

## 5. Known Limitations / Next Steps

1. WebRTC live video (keyframe preview is implemented instead).
2. Face verification against the reference photo.
3. Subjective answers are stored but graded manually (no auto-grading).
4. Load test with 500 simulated candidates (spec §19) and GPU deployment of the CV worker.
5. Model: recall of the approved `phase0` model on the team's held-out set is limited (in this audit 5/17 phone and 0/15 book images were detected by the raw detector). Improving it is the ML team's Iteration 2 work; the backend does not change model governance.
