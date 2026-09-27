# IntelliProctor Proctoring Service

A small FastAPI microservice that takes a single webcam frame (as base64 JPEG/PNG)
and returns face-count, head-pose, and prohibited-object (phone/book) detection
results for it. The Node/Express backend calls this once per frame a student's
browser uploads during an exam session; it does not talk to the browser directly.

## What's in here

- `app/main.py` -- the FastAPI app: `GET /health`, `POST /analyze`, `DELETE /session/{id}`.
- `app/detector.py` -- the actual detection pipeline (MediaPipe FaceMesh for
  face count + head pose, YOLO for phone/book detection). This is a port of
  the project root's `video_input_analysis.py` ("Phase 4" of the ML team's
  implementation plan) into a class that a server can call once per HTTP
  request instead of a single continuous webcam loop -- see the docstring at
  the top of `app/detector.py` for the two deliberate behavioral differences
  that come from serving many concurrent exam sessions instead of one
  webcam feed.
- `app/temporal_filter.py` -- a verbatim copy of the project root's
  `temporal_filter.py` (hysteresis-debounced multi-frame smoothing so a
  single stray frame doesn't flip an alert on/off). Kept as a copy so this
  service stays deployable on its own; keep it in sync if the root version
  changes.

## Choosing a detection phase

`app/detector.py` ports the project's `PHASE_CONFIGS` system verbatim: the
model file, per-class confidence thresholds, and aspect-ratio filters are all
selected by an `INTELLIPROCTOR_PHASE` env var (see `.env.example`).

**The default is `phase0`, the pretrained YOLO11m baseline -- not the
fine-tuned "Iteration 1" model (`phase2_gpu`).** This matches
`video_input_analysis.py`'s own default and the ML team's own written
decision in `reports/ml/PHASE3_POST_PROCESSING_REVIEW.md`
("Production Integration Decision (Phase 4 Gate): DO NOT DEPLOY ITERATION 1
MODEL TO PRODUCTION"). That model showed a 47.9% false-positive rate on the
team's 140-image negative benchmark and weak book/notebook recall. Don't
change the default in `.env` / `.env.example` to `phase2_gpu` without
re-reading that report -- the gate is explicitly "blocked on Training
Iteration 2 passing Phase 2 exit criteria," which hasn't happened yet as of
this integration.

## Per-session state

A single process serves every exam session concurrently. Two pieces of state
are therefore keyed by `session_id` (sent by the Node backend on every
`/analyze` call) rather than being global:

- The temporal filter (`ProctorDetector._temporal_managers`, a dict of
  `TemporalProctoringManager` instances, one per session).
- Nothing else is per-session -- the loaded YOLO model and MediaPipe FaceMesh
  instance are shared (they're stateless per call).

Call `DELETE /session/{id}` when a student submits their exam so the
service drops that session's filter state instead of holding it for the rest
of the process's uptime. The Node backend's `submitSession` controller does
this automatically (best-effort, non-blocking -- it won't fail the submit if
this service is briefly unreachable).

## Running locally

```bash
cd proctoring-service
python3 -m venv .venv
source .venv/bin/activate  # .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env       # then edit as needed
uvicorn app.main:app --reload --port 8001
```

The first startup downloads/loads the YOLO model named in the active phase's
`model_path`, which can take a few seconds.

Point the Node backend at this service by setting `PROCTOR_SERVICE_URL`
(see `server/`'s own `.env.example`) to `http://localhost:8001`.

## API

### `GET /health`
Returns `{"status": "ok", "phase": "<active phase key>"}`. Use this to confirm
which phase actually loaded (it may have fallen back to `phase0` if the
configured phase's model file wasn't found -- see `resolve_phase` in
`app/detector.py`).

### `POST /analyze`
```json
{
  "image_base64": "<base64-encoded JPEG/PNG, with or without a data: URI prefix>",
  "session_id": "<the exam session's id>"
}
```
`session_id` is optional for manual/local testing (frames without one all
share a single `"default"` bucket) but the Node backend always sends the real
exam session id -- without it, concurrent students' temporal-filter state
would mix.

Response:
```json
{
  "phase": "phase0",
  "face_count": 1,
  "phone_detected": false,
  "phone_confidence": null,
  "book_detected": false,
  "book_confidence": null,
  "head_pose": {"yaw": 2.3, "pitch": -1.1, "roll": 0.4, "is_neutral": true},
  "looking_away": false,
  "alerts": []
}
```

### `DELETE /session/{session_id}`
Drops that session's temporal-filter state. Idempotent -- safe to call even
if the session was never seen. Returns `{"status": "ok"}`.
