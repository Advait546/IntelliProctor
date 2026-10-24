# IntelliProctor Backend (FastAPI)

The authoritative backend described in [`../BACKEND_ARCHITECTURE.md`](../BACKEND_ARCHITECTURE.md):
the **single source of truth** for identities, exams, passkeys, answers, proctoring
events, the suspicion-score ledger, evidence, examiner reviews and reports.

## Run (Windows / PowerShell)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env      # optional -- every setting has a working default
uvicorn src.main:app --port 8000 --reload
```

On startup the server runs `alembic upgrade head`, seeds demo data on an empty
database (examiner `dr.sharma@university.edu` / `password123`, candidate PRN
`2026-CS-042` / `student123`, exam code `AI2026CS01`) and connects to the CV
worker at `PROCTOR_SERVICE_URL` (default `http://localhost:8001`). Interactive API
docs: http://localhost:8000/docs.

macOS/Linux: `source .venv/bin/activate` instead of `Activate.ps1`.

## Configuration (`backend/.env`)

| Setting | Default | Notes |
|---|---|---|
| `DATABASE_URL` | SQLite in the data dir | PostgreSQL 16 / Supabase: paste the connection URI (`postgresql://...`); the asyncpg driver is selected automatically |
| `DATA_DIR` | `%LOCALAPPDATA%\IntelliProctor` (Windows), `backend/data` (else) | SQLite file, evidence images, generated JWT secret -- kept out of OneDrive |
| `REDIS_URL` | in-process | Redis pub/sub backplane + 24 h idempotency cache (needed only for >1 API process) |
| `S3_ENDPOINT_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_EVIDENCE` | private local folder | MinIO / AWS S3 for evidence; pre-signed 15-min URLs |
| `JWT_SECRET_KEY` | generated once | HS256 by default (`JWT_ALGORITHM`) |
| `INTERNAL_SERVICE_TOKEN` | `dev-internal-token-change-me` | Must match `proctoring-service/.env`; change in production |
| `SEED_DEMO_DATA` | `true` | Set `false` for real deployments |
| `ALLOW_EXAMINER_SIGNUP` | `false` | Only the first examiner may self-register otherwise |

`docker compose up -d` (repository root) starts PostgreSQL 16, Redis 7 and MinIO
with credentials matching the commented examples in `.env.example`.

## Accounts

```powershell
python -m src.seed create-examiner "Dr. Name" name@uni.edu "StrongPass123!"
```
Candidates self-register on their first sign-in with a new PRN.

## Architecture map

```
src/
  main.py              app factory, CORS, error envelope, lifespan (migrate, seed, expiry sweeper)
  config.py            settings (.env)
  db.py / models.py    async SQLAlchemy 2.0; schema = BACKEND_ARCHITECTURE.md 12.1 (+ documented extensions)
  security.py          Argon2id passwords & passkeys, JWTs, Fernet-encrypted passkey copy, signed URLs
  deps.py              auth dependencies (RBAC, exam session token, internal token), rate limiting
  api/
    auth.py            /auth/*  (login, candidate login, register, refresh rotation + reuse detection)
    exams.py           /exams/* (authoring, publish, passkey admission, questions, drafts, submit)
    proctor.py         /proctor/* (ingestion, frames -> CV, live hall, ledger, evidence, review)
    reports.py         /reports/* (role-scoped reports, CSV)
    misc.py            question bank, settings, stats, reference photo
    ws.py              /ws/v1/proctor/live[/{examId}], /ws/v1/candidate/session/{id}
  services/
    scoring.py         THE scoring policy (pure functions)
    ingest.py          ingestion pipeline: idempotency -> evidence -> event -> ledger -> publish
    exams.py           exam state machine, passkeys, admission, grading, timer expiry
    storage.py         S3 / local evidence storage
    live_bus.py        Redis or in-process pub/sub, idempotency cache
    cv_client.py       HTTP client for proctoring-service
    live_state.py      volatile latest keyframe / observation per session (examiner grid)
```

### Scoring policy (BACKEND_ARCHITECTURE.md section 5) -- `services/scoring.py`

| Accepted event | Points |
|---|---|
| each completed group of 3 `HEAD_TURN_SIDEWAYS` | +10 |
| each distinct `BOOK_DETECTED` episode | +50 |
| each distinct `PHONE_DETECTED` episode | +100 |
| `TAB_BLUR`/`TAB_FOCUS`, `CANDIDATE_ABSENT`, `MULTIPLE_FACES`, `MANUAL_FLAG` | 0 |

`S_new = min(1000, S + dS)`; suspicious iff `S >= 100`. Every scoring decision is an
append-only `suspicion_score_ledger` row written under a per-session lock
(`SELECT ... FOR UPDATE` on PostgreSQL). Duplicate deliveries (same
`SHA256(session_id + event_type + episode_id)`) return HTTP 200 with the original
event and never re-score. Examiner dismissals add an `examiner_reviews` row and
change `review_status` only -- events, evidence and the ledger are never altered.

### Documented deviations from the recommended stack (section 20.1)

* SQLite is the zero-setup default; PostgreSQL 16 is fully supported and tested
  (`TEST_DATABASE_URL=... pytest`).
* Redis and S3/MinIO are optional; without them the backend uses an in-process bus
  and a private local evidence folder with the same signed-URL access model.
* Celery is not used: ingestion is synchronous and fast (one scoring transaction per
  episode, not per frame). Add a queue only if load testing shows a need.
* JWTs are HS256 (the spec's `.env` example); RS256 is a config change.
* Remote video is keyframe-based (the candidate's latest uploaded frame), not WebRTC.

## Tests

```powershell
pytest -q                                                # SQLite
$env:TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/test_db"; pytest -q   # PostgreSQL (drops that DB's schema!)
$env:TEST_REDIS_URL="redis://localhost:6379/0"; pytest -q                            # with Redis backplane
```
`tests/test_acceptance_scoring.py` implements the 18 acceptance scenarios of
section 21; `tests/test_api_flows.py` covers auth rotation, passkeys, windows,
timer expiry, grading, IDOR isolation, the CV frame pipeline, reports and WebSockets.
