"""Per-session episode tracking: per-frame observations -> discrete events.

This is the CV-side half of the 4-tier abstraction in BACKEND_ARCHITECTURE.md
section 5.3 / MODEL_ARCHITECTURE.md section 4.2:

    raw frame prediction -> temporal hysteresis -> discrete episode -> ONE event

The worker NEVER assigns points or decides "suspicious" (section 4.2). It only
emits structured observations; the backend scores them.

Implemented state machines (parameters from MODEL_ARCHITECTURE.md section 7.3):

* Prohibited objects (phone / book): hysteresis 3-on / 4-off per YOLO inference,
  one event per activation; a re-activation within the 5.0 s temporal guard after
  the previous episode ended is treated as the SAME episode (no new event).
* Sideways head turn (section 5.3): |yaw| > 30 deg continuously for >= 1.0 s, then
  a return to neutral -> one HEAD_TURN_SIDEWAYS event; 2.0 s cooldown afterwards.
  Transient glances (< 1.0 s) are discarded.
* Candidate absence: no face for >= 10 s continuously -> one CANDIDATE_ABSENT
  event per absence period.
* Multiple faces: > 1 face for 3 consecutive frames -> one MULTIPLE_FACES event
  per episode (cleared after 4 frames with <= 1 face, plus the 5 s guard).

This module is pure Python (no model imports) so it is unit-testable.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field

from .temporal_filter import HysteresisDebounceFilter

YAW_LIMIT = 30.0
PITCH_LIMIT = 25.0
ROLL_LIMIT = 25.0
TURN_MIN_DWELL_S = 1.0
TURN_COOLDOWN_S = 2.0
TURN_MAX_FACE_LOSS_S = 10.0
ABSENCE_ALERT_S = 10.0
OBJECT_REARM_GUARD_S = 5.0
TEMPORAL_ON = 3
TEMPORAL_OFF = 4


def _iso(ts: float) -> str:
    from datetime import datetime, timezone

    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass
class ObjectEpisodeTracker:
    kind: str  # "phone" | "book"
    session_id: str
    filter: HysteresisDebounceFilter = field(default_factory=lambda: HysteresisDebounceFilter(TEMPORAL_ON, TEMPORAL_OFF))
    active: bool = False
    episode_seq: int = 0
    last_end_ts: float | None = None
    pending_best: tuple | None = None  # (conf, box, ts) during the activation streak

    @property
    def event_type(self) -> str:
        return "PHONE_DETECTED" if self.kind == "phone" else "BOOK_DETECTED"

    def update(self, detected: bool, best: tuple | None, ts: float) -> dict | None:
        """``best`` = (confidence, box{x,y,width,height}) of this inference, if any.
        Returns an event dict (without evidence) when a NEW episode starts."""
        if detected and best is not None:
            if self.pending_best is None or best[0] > self.pending_best[0]:
                self.pending_best = (best[0], best[1], ts)
        was = self.active
        now_on = self.filter.update(detected)
        self.active = now_on
        if now_on and not was:
            rearm = self.last_end_ts is None or (ts - self.last_end_ts) >= OBJECT_REARM_GUARD_S
            best_seen = self.pending_best
            if not rearm:
                return None  # same episode resumed inside the temporal guard
            self.episode_seq += 1
            conf, box, _ = best_seen if best_seen else (None, None, ts)
            return {
                "eventType": self.event_type,
                "source": "YOLO_CV",
                "episodeId": f"{self.session_id}:{self.kind}:{self.episode_seq}",
                "timestamp": _iso(ts),
                "confidence": round(float(conf), 3) if conf is not None else None,
                "boundingBox": box,
            }
        if was and not now_on:
            self.last_end_ts = ts
            self.pending_best = None
        if not detected and not now_on:
            self.pending_best = None
        return None


@dataclass
class HeadTurnTracker:
    session_id: str
    state: str = "NEUTRAL"  # NEUTRAL | TURN_STARTED | QUALIFIED_HOLD
    t_start: float = 0.0
    last_out: float = 0.0
    peak_pose: dict | None = None
    cooldown_until: float = 0.0
    seq: int = 0

    def _reset(self):
        self.state = "NEUTRAL"
        self.peak_pose = None

    def update(self, face_count: int, pose: dict | None, ts: float) -> dict | None:
        sideways = face_count == 1 and pose is not None and abs(pose["yaw"]) > YAW_LIMIT
        neutral = face_count == 1 and pose is not None and abs(pose["yaw"]) <= YAW_LIMIT

        if self.state == "NEUTRAL":
            if sideways and ts >= self.cooldown_until:
                self.state = "TURN_STARTED"
                self.t_start = self.last_out = ts
                self.peak_pose = dict(pose)
            return None

        # In a turn
        if sideways:
            self.last_out = ts
            if self.peak_pose is None or abs(pose["yaw"]) > abs(self.peak_pose["yaw"]):
                self.peak_pose = dict(pose)
        elif face_count == 0 and ts - self.t_start <= TURN_MAX_FACE_LOSS_S:
            # A fully turned head often loses face detection: keep counting.
            self.last_out = ts
        elif face_count == 0:
            self._reset()  # this is absence, not a head turn
            return None

        if self.last_out - self.t_start >= TURN_MIN_DWELL_S:
            self.state = "QUALIFIED_HOLD"

        if neutral:
            qualified = self.state == "QUALIFIED_HOLD"
            event = None
            if qualified:
                self.seq += 1
                event = {
                    "eventType": "HEAD_TURN_SIDEWAYS",
                    "source": "MEDIAPIPE_HEAD_POSE",
                    "episodeId": f"{self.session_id}:headturn:{self.seq}",
                    "timestamp": _iso(self.t_start),
                    "durationMs": int((self.last_out - self.t_start) * 1000),
                    "headPoseAngles": {k: self.peak_pose[k] for k in ("yaw", "pitch", "roll")} if self.peak_pose else None,
                }
                self.cooldown_until = ts + TURN_COOLDOWN_S
            self._reset()
            return event
        return None


@dataclass
class AbsenceTracker:
    session_id: str
    absent_since: float | None = None
    reported: bool = False
    seq: int = 0

    def update(self, face_count: int, ts: float) -> dict | None:
        if face_count > 0:
            self.absent_since = None
            self.reported = False
            return None
        if self.absent_since is None:
            self.absent_since = ts
        if not self.reported and ts - self.absent_since >= ABSENCE_ALERT_S:
            self.reported = True
            self.seq += 1
            return {
                "eventType": "CANDIDATE_ABSENT",
                "source": "MEDIAPIPE_FACE_COUNT",
                "episodeId": f"{self.session_id}:absent:{self.seq}",
                "timestamp": _iso(self.absent_since),
                "durationMs": int((ts - self.absent_since) * 1000),
                "details": {"faceCount": 0},
            }
        return None


@dataclass
class MultiFaceTracker:
    session_id: str
    filter: HysteresisDebounceFilter = field(default_factory=lambda: HysteresisDebounceFilter(TEMPORAL_ON, TEMPORAL_OFF))
    active: bool = False
    last_end_ts: float | None = None
    max_faces: int = 0
    seq: int = 0

    def update(self, face_count: int, ts: float) -> dict | None:
        multi = face_count > 1
        if multi:
            self.max_faces = max(self.max_faces, face_count)
        was = self.active
        self.active = self.filter.update(multi)
        if self.active and not was:
            if self.last_end_ts is not None and ts - self.last_end_ts < OBJECT_REARM_GUARD_S:
                return None
            self.seq += 1
            return {
                "eventType": "MULTIPLE_FACES",
                "source": "MEDIAPIPE_FACE_COUNT",
                "episodeId": f"{self.session_id}:multiface:{self.seq}",
                "timestamp": _iso(ts),
                "details": {"faceCount": self.max_faces},
            }
        if was and not self.active:
            self.last_end_ts = ts
            self.max_faces = 0
        return None


def gaze_label(face_count: int, pose: dict | None) -> str:
    if face_count == 0:
        return "Away"
    if pose is None:
        return "Center"
    if pose["yaw"] > YAW_LIMIT:
        return "Right"
    if pose["yaw"] < -YAW_LIMIT:
        return "Left"
    if abs(pose["pitch"]) > PITCH_LIMIT:
        return "Down" if pose["pitch"] > 0 else "Up"
    return "Center"


class SessionTracker:
    """All per-session CV state. Thread-safe: face updates arrive on request
    threads, YOLO updates on the inference worker thread."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.lock = threading.Lock()
        self.phone = ObjectEpisodeTracker("phone", session_id)
        self.book = ObjectEpisodeTracker("book", session_id)
        self.head = HeadTurnTracker(session_id)
        self.absence = AbsenceTracker(session_id)
        self.multi = MultiFaceTracker(session_id)
        self.events: list[dict] = []
        self.observation: dict = {}
        self.last_activity: float = 0.0
        self.yolo_runs = 0

    def update_face(self, face_count: int, pose: dict | None, ts: float) -> None:
        with self.lock:
            self.last_activity = ts
            for ev in (self.head.update(face_count, pose, ts), self.absence.update(face_count, ts), self.multi.update(face_count, ts)):
                if ev:
                    self.events.append(ev)
            looking_away = pose is not None and not pose.get("is_neutral", True)
            self.observation.update(
                {
                    "faceCount": face_count,
                    "multipleFaces": face_count > 1,
                    "lookingAway": bool(looking_away),
                    "gazeDirection": gaze_label(face_count, pose),
                    "headPose": {k: pose[k] for k in ("yaw", "pitch", "roll")} | {"isNeutral": pose["is_neutral"]} if pose else None,
                    "headTurnState": self.head.state,
                }
            )

    def update_objects(self, detections: dict[str, tuple | None], ts: float) -> list[tuple[dict, str]]:
        """``detections`` = {"phone": (conf, box) | None, "book": ...} for one YOLO
        inference. Returns [(event, kind)] for newly started episodes so the
        caller can attach annotated evidence."""
        started = []
        with self.lock:
            self.yolo_runs += 1
            for kind, tracker in (("phone", self.phone), ("book", self.book)):
                best = detections.get(kind)
                ev = tracker.update(best is not None, best, ts)
                if ev:
                    started.append((ev, kind))
            self.observation["phoneInView"] = self.phone.active
            self.observation["bookInView"] = self.book.active
        return started

    def push_events(self, events: list[dict]) -> None:
        with self.lock:
            self.events.extend(events)

    def drain(self) -> tuple[dict, list[dict]]:
        with self.lock:
            events, self.events = self.events, []
            obs = dict(self.observation)
            obs.setdefault("phoneInView", False)
            obs.setdefault("bookInView", False)
            return obs, events
