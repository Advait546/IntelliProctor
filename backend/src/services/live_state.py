"""Volatile per-session live state for the examiner hall.

Holds the latest CV observation (face count, head pose, objects currently in
view) and the latest webcam keyframe for each active session, so the examiner's
Live Monitoring grid shows the *candidate's* camera rather than re-opening the
examiner's own webcam (BACKEND_CURRENT_STATE.md section 13, item 3).

Nothing here is authoritative: scores live in the database ledger. This is a
best-effort cache that is lost on restart (by design -- raw video frames are
sensitive data and are not persisted unless they become evidence).
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field


@dataclass
class LiveSessionState:
    observation: dict = field(default_factory=dict)
    snapshot_jpeg: bytes | None = None
    snapshot_at: float = 0.0
    last_seen: float = 0.0
    cv_online: bool = False
    frames_analyzed: int = 0


_STATE: dict[str, LiveSessionState] = {}


def get(session_id) -> LiveSessionState:
    key = str(session_id)
    st = _STATE.get(key)
    if st is None:
        st = _STATE[key] = LiveSessionState()
    return st


def peek(session_id) -> LiveSessionState | None:
    return _STATE.get(str(session_id))


def update_frame(session_id, jpeg: bytes | None) -> None:
    st = get(session_id)
    now = time.time()
    st.last_seen = now
    if jpeg:
        st.snapshot_jpeg = jpeg
        st.snapshot_at = now


def update_observation(session_id, observation: dict, cv_online: bool) -> None:
    st = get(session_id)
    st.observation = observation or {}
    st.cv_online = cv_online
    if cv_online:
        st.frames_analyzed += 1


def drop(session_id) -> None:
    _STATE.pop(str(session_id), None)


def seconds_since_seen(session_id) -> float | None:
    st = peek(session_id)
    if st is None or not st.last_seen:
        return None
    return time.time() - st.last_seen
