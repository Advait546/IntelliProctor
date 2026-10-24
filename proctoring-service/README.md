# IntelliProctor CV Inference Worker

HTTP service that wraps the ML team's production pipeline (`../video_input_analysis.py`)
for many concurrent exam sessions. It is an **observation generator**: it returns
what it saw plus discrete *episode* events, and never assigns points or decides
"suspicious" (BACKEND_ARCHITECTURE.md section 4.2). Only the backend calls it.

```powershell
cd proctoring-service
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --port 8001
```
`GET http://localhost:8001/health` shows the active phase, device and last YOLO latency.

## Pipeline

```
POST /analyze {session_id, image_base64, captured_at}       (X-Internal-Token)
  ├─ MediaPipe FaceMesh (sync, every frame) -> face count, 6-point solvePnP head pose
  │     └─ HeadTurnTracker / AbsenceTracker / MultiFaceTracker  -> events
  ├─ clean frame copy -> per-session slot -> YOLO worker thread (decoupled; stale frames dropped)
  │     └─ production filters (conf 0.65, aspect ratio, min size) -> 3-on/4-off hysteresis
  │        -> ObjectEpisodeTracker -> PHONE_DETECTED / BOOK_DETECTED + annotated evidence JPEG
  └─ response: {observation, events[]}   (events from the worker are returned on the next call)
DELETE /session/{id}   drop a session's tracking state (called on submit)
```

Episode rules (MODEL_ARCHITECTURE.md 5.3 / 7.3): an object episode starts after 3
consecutive positive inferences and ends after 4 negatives; a re-detection within
5 s of the end is the same episode. A head turn qualifies after >= 1.0 s with
|yaw| > 30 deg and a return to neutral, followed by a 2 s cooldown. Absence = no face
for >= 10 s. Multiple faces = > 1 face for 3 consecutive frames.

## Configuration (`.env`, optional)

| Variable | Default | |
|---|---|---|
| `INTERNAL_SERVICE_TOKEN` | `dev-internal-token-change-me` | must equal the backend's |
| `INTELLIPROCTOR_PHASE` | `phase0` | **only phase0 is production-approved** (`phase2_gpu` had a 47.9% false-positive rate) |
| `PROCTOR_DEVICE` | `auto` | `cpu`, `cuda`, or a GPU index |
| `PROCTOR_IMGSZ` | `1280` | validated setting; `640` is ~3x faster on CPU with lower small-object recall |
| `PROCTOR_YOLO_ASYNC` | `true` | decoupled YOLO worker |

CPU latency for YOLO11m at 1280 px is roughly 0.9-2.5 s per inference depending on
the machine, so a phone episode is confirmed a few seconds after it appears (3
inferences). A CUDA GPU brings this to ~20 ms.

## Tests

```powershell
pytest -q      # tests/test_episodes.py -- state machines, no models required
```
