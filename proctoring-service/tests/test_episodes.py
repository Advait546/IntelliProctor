"""Unit tests for the CV-side episode state machines (no models needed)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.episodes import (  # noqa: E402
    AbsenceTracker,
    HeadTurnTracker,
    MultiFaceTracker,
    ObjectEpisodeTracker,
    SessionTracker,
)


def pose(yaw, pitch=0.0, roll=0.0):
    return {"yaw": yaw, "pitch": pitch, "roll": roll, "is_neutral": abs(yaw) <= 30 and abs(pitch) <= 25 and abs(roll) <= 25}


def feed_turn(t: HeadTurnTracker, start: float, out_seconds: float, fps: float = 4.0):
    events, ts, step = [], start, 1.0 / fps
    while ts - start <= out_seconds + 1e-9:
        ev = t.update(1, pose(42.0), ts)
        events += [ev] if ev else []
        ts += step
    ev = t.update(1, pose(2.0), ts)  # return to neutral
    events += [ev] if ev else []
    return events, ts


def test_head_turn_qualifies_after_one_second_and_return():
    t = HeadTurnTracker("s")
    events, _ = feed_turn(t, 100.0, 1.5)
    assert len(events) == 1
    ev = events[0]
    assert ev["eventType"] == "HEAD_TURN_SIDEWAYS" and ev["source"] == "MEDIAPIPE_HEAD_POSE"
    assert ev["durationMs"] >= 1000 and ev["headPoseAngles"]["yaw"] == 42.0


def test_transient_glance_discarded():
    t = HeadTurnTracker("s")
    events, _ = feed_turn(t, 100.0, 0.5)
    assert events == []


def test_holding_head_sideways_counts_once():
    t = HeadTurnTracker("s")
    events = [t.update(1, pose(50), 100 + i * 0.25) for i in range(80)]  # 20 s sideways
    assert [e for e in events if e] == []  # nothing until return
    assert t.update(1, pose(0), 121.0)["eventType"] == "HEAD_TURN_SIDEWAYS"


def test_cooldown_prevents_double_count_at_boundary():
    t = HeadTurnTracker("s")
    events, ts = feed_turn(t, 100.0, 1.2)
    assert len(events) == 1
    # Jitter right after the turn (inside the 2 s cooldown) cannot start a turn.
    more, _ = feed_turn(t, ts + 0.25, 1.2)
    assert more == []
    later, _ = feed_turn(t, ts + 5.0, 1.2)
    assert len(later) == 1 and later[0]["episodeId"].endswith(":2")


def test_face_loss_during_turn_still_counts():
    t = HeadTurnTracker("s")
    t.update(1, pose(40), 100.0)
    t.update(0, None, 100.6)  # head turned so far the mesh is lost
    t.update(0, None, 101.4)
    ev = t.update(1, pose(3), 101.8)
    assert ev and ev["durationMs"] >= 1000


def test_object_episode_hysteresis_and_single_event():
    t = ObjectEpisodeTracker("phone", "s")
    box = {"x": 1, "y": 2, "width": 30, "height": 60}
    out = [t.update(True, (0.7 + i / 100, box), 10 + i) for i in range(10)]
    events = [e for e in out if e]
    assert len(events) == 1  # 10 positive inferences -> one episode
    assert events[0]["eventType"] == "PHONE_DETECTED" and events[0]["confidence"] == 0.72  # best of first 3
    assert out.index(events[0]) == 2  # activates on the 3rd consecutive frame


def test_object_two_frames_never_activate():
    t = ObjectEpisodeTracker("book", "s")
    assert t.update(True, (0.9, None), 1) is None
    assert t.update(True, (0.9, None), 2) is None
    assert t.update(False, None, 3) is None
    assert t.update(True, (0.9, None), 4) is None
    assert not t.active


def test_object_rearm_guard_and_new_episode():
    t = ObjectEpisodeTracker("phone", "s")
    seq = [True] * 3 + [False] * 4  # episode 1 then cleared at ts=6
    evs = [t.update(d, (0.8, None) if d else None, float(i)) for i, d in enumerate(seq)]
    assert sum(1 for e in evs if e) == 1
    # Re-appears 2 s after clearing -> same episode (inside 5 s guard): no event
    evs = [t.update(True, (0.8, None), 8.0 + i) for i in range(3)]
    assert not any(evs)
    for i in range(4):
        t.update(False, None, 11.0 + i)  # cleared at ts=14
    evs = [t.update(True, (0.8, None), 20.0 + i) for i in range(3)]
    assert sum(1 for e in evs if e) == 1 and [e for e in evs if e][0]["episodeId"].endswith(":2")


def test_absence_after_ten_seconds_once():
    t = AbsenceTracker("s")
    evs = [t.update(0, 100 + i) for i in range(25)]
    got = [e for e in evs if e]
    assert len(got) == 1 and got[0]["eventType"] == "CANDIDATE_ABSENT" and got[0]["durationMs"] >= 10000
    assert t.update(1, 130) is None
    evs = [t.update(0, 140 + i) for i in range(11)]
    assert sum(1 for e in evs if e) == 1


def test_multiple_faces_episode():
    t = MultiFaceTracker("s")
    evs = [t.update(2, float(i)) for i in range(6)]
    got = [e for e in evs if e]
    assert len(got) == 1 and got[0]["details"]["faceCount"] == 2


def test_session_tracker_observation_and_drain():
    st = SessionTracker("abc")
    st.update_face(1, pose(45), 1.0)
    for i in range(3):
        st.update_objects({"phone": (0.9, {"x": 0, "y": 0, "width": 20, "height": 40}), "book": None}, 1.0 + i)
    obs, events = st.drain()
    assert obs["phoneInView"] is True and obs["lookingAway"] is True and obs["gazeDirection"] == "Right"
    assert [e["eventType"] for e in events] == []  # object events are returned by the detector after evidence is attached
    obs, events = st.drain()
    assert events == []
