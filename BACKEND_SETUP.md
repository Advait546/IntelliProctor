# IntelliProctor backend

Two new services were added alongside the existing Vite/React frontend:

```
cep_project/
  server/                 Node/Express REST API (this is what src/api/client.js talks to)
  proctoring-service/     Python FastAPI microservice wrapping video_input_analysis.py's
                           MediaPipe/YOLO detection logic behind a single /analyze endpoint
```

`server` is the one exposing `/api/v1/...`. It is the only thing the frontend
talks to directly; it in turn calls `proctoring-service` internally whenever
a webcam frame needs analyzing.

## 1. Create the Supabase project & schema

1. Create a project at supabase.com if you don't already have one.
2. Open the SQL editor in your Supabase dashboard and run everything in
   `server/db/schema.sql`. This creates all the tables (admins, students,
   exams, questions, exam_sessions, incidents, risk_log, settings) with RLS
   enabled -- safe, since the backend uses the service-role key which
   bypasses RLS, and it keeps these tables unreachable from Supabase's
   public REST API.
3. From Project Settings -> API, copy your Project URL and the
   `service_role` secret key (NOT the `anon` key -- the server needs the
   service role to bypass RLS).
4. Also run `server/db/migration_head_pose.sql` once (see the "Update" section
   below) -- needed for real head-pose data to persist correctly.

## 2. Run the Express API

```powershell
cd server
npm install
copy .env.example .env
# edit .env: paste SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and a random JWT_SECRET
npm run seed:admin -- "Dr. Sharma" admin@example.com "StrongPass123!"
npm run dev
```

This starts on `http://localhost:8000`, which matches the default
`VITE_API_BASE_URL` already set in `src/api/client.js` -- so the existing
frontend will pick it up with zero changes once it's running.

Try it:
```powershell
curl http://localhost:8000/health
```

## 3. Run the proctoring microservice

```powershell
cd proctoring-service
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

See `proctoring-service/README.md` for details (model choice, CPU vs GPU,
first-run download). The Express server expects it at
`http://localhost:8001` by default (`PROCTOR_SERVICE_URL` in `server/.env`).

## 4. Run the frontend

Nothing changes here -- `npm run dev` in the project root as before. Once
both backend services are running, the app will:

- Log admins/students in for real (JWT-backed, Supabase-persisted) instead
  of falling back to the mock localStorage auth.
- Serve exams/questions/settings/reports from Postgres.
- During an actual exam attempt (`ExaminationScreenPage`), capture a frame
  from the student's webcam every 4 seconds, send it to the API, which
  forwards it to the Python detector, and update the risk score / face /
  phone / book indicators in the sidebar and the `Live Camera Proctor`
  header from the real result rather than the earlier scripted demo
  sequence. If either backend service is unreachable it falls back
  automatically to that original simulated warning stream, so the exam flow
  still works standalone.
- Drive the admin `Live Monitoring` dashboard (`LiveMonitoringPage`) from
  real in-progress sessions, polled every 4 seconds, instead of the local
  random fluctuation simulation -- which still runs as a fallback if the
  backend is down.

## Update: adapting to the "antigravity" branch frontend

The project's `src/` tree was later replaced wholesale by a teammate's
"antigravity" branch (a from-scratch rewrite: `src/api/*.js` instead of
`src/services/*.js`, new page/component names, Tailwind v4, etc.). The
backend was extended rather than rewritten to keep working against it:

- **`src/api/client.js`** now defaults `VITE_API_BASE_URL` to
  `http://localhost:8000/api/v1` instead of a placeholder external host --
  it was pointed nowhere real before, so every call silently fell back to
  mock data. Override it via a root `.env` (see `.env.example`) if your
  Express server runs elsewhere.
- **Auth**: this frontend calls `POST /auth/setter/login` (alias for the
  original admin login) and `GET /auth/verify-code/:code` (new), and its
  student login sends `{ rollNumber, name, examCode }` with **no password
  field at all** -- `studentLogin` in `auth.controller.js` now accepts both
  that shape and the original `{ code, prn, name, password }` shape, and
  only enforces the password check when one is actually sent.
- **Exam auto-provisioning**: this frontend's exam-creation pages don't call
  the real `/exams` API yet, so a student can reach login/session-start with
  an exam code that was never persisted. Both `studentLogin` and
  `monitoring.controller.js`'s `startSession` now auto-create a minimal
  `exams` row for an unrecognized code rather than 404ing, so the exam flow
  isn't blocked on the admin side being wired up.
- **Real proctoring**: the antigravity `ExamScreenPage`/`CameraWidget` only
  ever showed the real webcam feed and faked detections on a timer
  (`useProctoringSim`) -- no frames were ever analyzed. `SystemCheckPage`'s
  "Start Examination Now" button now calls `startRealSession` (in the
  rewritten `ProctoringContext`), which starts a real session via
  `POST /monitoring/session/start`; `CameraWidget` then captures a frame
  every 4 seconds and posts it to `POST /monitoring/session/:id/frame`,
  feeding the real risk score / face / phone / book / **head-pose ("looking
  away")** result into `liveStudentAI`. `useProctoringSim` is now gated
  (`!realProctoringActive`) so it only drives the UI as a fallback -- no
  session started, camera denied, or the backend goes unreachable
  mid-exam (3 consecutive failed frame uploads).
- **Head-pose / "looking away" detection**: pulled the yaw/pitch/roll
  estimation (via `cv2.solvePnP`) out of this branch's updated
  `video_input_analysis.py` into `proctoring-service/app/detector.py`, and
  taught `server/src/utils/risk.js` to bump risk and derive a
  Center/Left/Right/Down/Away `gazeDirection` label from it, using the
  `head_pose_limit` setting that was already sitting unused in the schema.
  **Run `server/db/migration_head_pose.sql` once** against your existing
  Supabase project to pick up the two schema changes this needed
  (`head_pose` is now jsonb instead of a static text label, plus a new
  `gaze_direction` column) -- same SQL-editor process as `schema.sql`.

Still mock-only after that pass: the admin dashboard pages
(`DashboardPage`, `LiveMonitoringPage`, `CreateTestPage`, `PublishTestPage`,
`QuestionBankPage`, `ReportsPage`, `SettingsPage`) didn't call the real API
yet -- addressed in the update below.

## Update: recovering from a corrupted git merge, and integrating the ML team's trained model

A later `git pull` of a teammate's `antigravity` branch (bringing in a
custom-trained YOLO model, a training pipeline, and a much more mature
`video_input_analysis.py`) collided with a Windows/OneDrive file-locking
issue during the merge (repeated "Deletion of directory X failed" prompts
that had to be declined). The merge itself completed, but a large part of
`server/` was silently lost in the process:

- `server/package.json` and `server/package-lock.json` (the whole dependency
  manifest -- `node_modules` on disk was orphaned from a manifest that no
  longer existed)
- `server/src/index.js` (the entire Express entry point / app wiring)
- `server/src/config/` (both `env.js` and `supabaseClient.js`)
- `server/src/middleware/` (both `errorHandler.js` and the JWT auth
  middleware)
- `server/src/utils/jwt.js`
- `server/src/routes/monitoring.routes.js`
- `server/scripts/` (the admin-seeding script)
- `proctoring-service/requirements.txt`, `.env.example`, and `README.md`

`server/src/controllers/{auth,monitoring}.controller.js`,
`server/src/utils/risk.js`, `server/src/routes/auth.routes.js`, and
`server/db/*.sql` survived intact. This pass reconstructed everything listed
above from scratch (matching the surviving files' existing conventions), so
**you'll need to re-run `npm install` in `server/` and `cp server/.env.example
server/.env`** (reusing the same Supabase/JWT/proctor values you already had)
before `npm run dev` will start again.

Separately from the recovery, this pass also:

### Integrated the ML team's Phase 2 model + production pipeline

`proctoring-service/app/detector.py` was rewritten to port the *actual*
production pipeline from the project root's `video_input_analysis.py`
(`PHASE_CONFIGS`, per-class confidence/aspect-ratio thresholds, hysteresis
temporal filtering) rather than the generic YOLOv8n wrapper it was before.
Two changes from the original webcam-loop script, both because this service
handles many concurrent exam sessions over HTTP rather than one continuous
feed:

- **Per-session temporal filtering.** `video_input_analysis.py` uses one
  global `TemporalProctoringManager`; that would let one student's sustained
  phone-in-frame streak "debounce" across another student's frames. The
  service now keeps one `TemporalProctoringManager` per `session_id` (see
  `ProctorDetector._temporal_manager_for`), and the Node backend sends
  `session_id` on every `/analyze` call so they never mix. Call
  `DELETE /session/:id` (wired automatically into `submitSession`) once an
  exam is submitted, so that session's filter state doesn't sit in memory
  for the rest of the process's uptime.
- **`static_image_mode=True`** for MediaPipe FaceMesh, since each HTTP
  request may come from any of several sessions in any order -- there's no
  valid cross-frame tracking assumption to make the way there is for a
  single continuous webcam loop.

**Production gate:** the ML team's own `reports/ml/PHASE3_POST_PROCESSING_REVIEW.md`
explicitly says **"DO NOT DEPLOY ITERATION 1 MODEL TO PRODUCTION"** (47.9%
false-positive rate on their negative benchmark, weak book/notebook recall).
`detector.py` defaults to `INTELLIPROCTOR_PHASE=phase0` -- the pretrained
YOLO11m baseline, **not** the fine-tuned model (`phase2_gpu`, aliased as
`phase1`/`phase2`) -- exactly matching `video_input_analysis.py`'s own
default. Don't change this default without re-reading that report; the
fine-tuned model stays selectable (for side-by-side comparison) but isn't
production-approved as of this pass. See `proctoring-service/README.md` for
the full phase list.

### Filled in the rest of the REST API

The original build only ever implemented `/auth/*` and `/monitoring/*`.
Everything the antigravity frontend's `src/api/*.js` already calls (with a
mock-data fallback on failure) now has a real backend behind it:

- `POST /exams`, `GET /exams`, `GET /exams/code/:code`,
  `POST /exams/:examId/publish`, `POST /exams/:examId/questions` --
  `server/src/controllers/exams.controller.js`
- `GET /question-bank`, `POST /question-bank/import-csv` (multipart CSV
  upload, dependency-free parser) -- `server/src/controllers/questions.controller.js`
- `GET /settings`, `PUT /settings` -- `server/src/controllers/settings.controller.js`
- `GET /reports`, `GET /reports/:id/download` (per-exam CSV, or `id=all` for
  every exam combined) -- `server/src/controllers/reports.controller.js`,
  computed live from `exam_sessions`/`incidents` rather than a stored
  snapshot

### Wired the previously mock-only admin pages to real data

- **`ExamContext`**: fetches `exams` and the question bank from the API on
  mount (falling back to the existing mock data if the backend is
  unreachable or has nothing yet, so the UI never renders empty).
  `publishCurrentExam` -- the "Publish Examination Now" button -- now sends
  the whole draft (title, settings, and all of its questions) to
  `POST /exams` in one call with `status: 'Active'`, so the exam is real and
  immediately joinable by students. The multi-step draft flow itself
  (`CreateTestPage` -> `QuestionCreationPage` -> `PublishTestPage`) is
  unchanged and still stays client-side until that final publish.
- **`ProctoringContext`**: the admin `students` list backing
  `LiveMonitoringPage`/`StudentDetailPage` now polls
  `GET /monitoring/live` every 4 seconds (same cadence `CameraWidget` already
  uses to send frames) instead of holding static mock rows. `flagStudent`
  now also calls `POST /monitoring/student/:id/flag` in the background.
- **`SettingsPage`** and **`ReportsPage`** now fetch real settings/reports on
  mount instead of only reading `DEFAULT_SETTINGS`/`MOCK_REPORTS` -- both
  still fall back to that mock data if the backend has nothing to show yet.

### Known remaining gaps (not addressed this pass)

- `StudentDetailPage`'s incident timeline and risk-score graph are still
  `MOCK_INCIDENT_TIMELINE`/`MOCK_RISK_GRAPH_DATA` -- wiring them to the real
  `GET /monitoring/student/:id/incidents` and `GET /monitoring/timeline`
  endpoints (which exist and work) needs two new `monitoringApi` functions
  and a small page change; out of scope for this pass.
- No auto-grading exists for submitted answers (`score` is always `null` on
  submit) -- `QuestionCreationPage`'s "Subjective (AI Auto-Grading
  Placeholder)" question type is exactly that, a placeholder.
- Two stray, unexplained directories sitting at the project root --
  `Frontend/` (a byte-identical duplicate of the pre-antigravity-flatten
  frontend) and `IntelliProctor_Antigravity/` (a leftover nested clone from
  an earlier merge) -- aren't referenced by anything and are safe to delete
  manually; neither this pass nor the ML team's own cleanup report explains
  how `Frontend/` got there, so it wasn't deleted automatically.
- No admin UI exists yet for enrolling students ahead of time or managing
  admin accounts -- admins are created via `npm run seed:admin`, and
  students "self-register" the first time they log in with a given PRN.
- Audio monitoring, browser-focus/tab-switch detection, and fullscreen-exit
  detection are still front-end-only signals -- they aren't persisted as
  incidents server-side.
- Deployment (hosting the two services, environment secrets in production,
  HTTPS) isn't covered here -- this is a local-development setup.
