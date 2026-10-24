"""The 18 formal acceptance scenarios of BACKEND_ARCHITECTURE.md section 21,
executed end-to-end through the HTTP API (real ingestion pipeline, real ledger)."""

from __future__ import annotations

import asyncio
import base64
import uuid

import pytest
from sqlalchemy import select

from src import db as dbmod
from src.models import EvidenceRecord, ExaminerReview, ProctoringEvent, SuspicionScoreLedger
from src.services import scoring
from src.services.storage import StorageError, get_storage, set_storage_for_tests
from conftest import now_iso

pytestmark = pytest.mark.asyncio

JPEG = base64.b64encode(b"\xff\xd8\xff\xe0" + bytes(512)).decode()


async def _ledger(session_id: str) -> list[SuspicionScoreLedger]:
    async with dbmod.get_sessionmaker()() as db:
        return list(
            (
                await db.execute(
                    select(SuspicionScoreLedger).where(SuspicionScoreLedger.session_id == uuid.UUID(session_id)).order_by(SuspicionScoreLedger.created_at)
                )
            ).scalars()
        )


async def test_01_three_head_turns_add_10(world, live):
    sid = live["session"]["id"]
    for _ in range(3):
        assert (await world.event(sid, "HEAD_TURN_SIDEWAYS")).status_code == 201
    assert await world.score(sid) == (10, False)


async def test_02_six_head_turns_add_20(world, live):
    sid = live["session"]["id"]
    for _ in range(6):
        await world.event(sid, "HEAD_TURN_SIDEWAYS")
    assert await world.score(sid) == (20, False)


async def test_03_phone_episode_immediately_suspicious(world, live):
    sid = live["session"]["id"]
    await world.event(sid, "PHONE_DETECTED", confidence=0.82)
    assert await world.score(sid) == (100, True)


async def test_04_book_episode_sub_threshold(world, live):
    sid = live["session"]["id"]
    await world.event(sid, "BOOK_DETECTED")
    assert await world.score(sid) == (50, False)


async def test_05_two_books_reach_threshold(world, live):
    sid = live["session"]["id"]
    await world.event(sid, "BOOK_DETECTED")
    await world.event(sid, "BOOK_DETECTED")
    assert await world.score(sid) == (100, True)


async def test_06_phone_plus_three_turns(world, live):
    sid = live["session"]["id"]
    await world.event(sid, "PHONE_DETECTED")
    for _ in range(3):
        await world.event(sid, "HEAD_TURN_SIDEWAYS")
    assert await world.score(sid) == (110, True)


async def test_06b_matrix_phone_two_books_nine_turns(world, live):
    sid = live["session"]["id"]
    await world.event(sid, "PHONE_DETECTED")
    await world.event(sid, "BOOK_DETECTED")
    await world.event(sid, "BOOK_DETECTED")
    for _ in range(9):
        await world.event(sid, "HEAD_TURN_SIDEWAYS")
    assert await world.score(sid) == (230, True)


async def test_07_hard_ceiling_1000(world, live):
    sid = live["session"]["id"]
    for _ in range(12):
        await world.event(sid, "PHONE_DETECTED")
    assert await world.score(sid) == (1000, True)
    rows = await _ledger(sid)
    assert len(rows) == 12
    assert [r.applied_points for r in rows[-2:]] == [0, 0] and all(r.nominal_points == 100 for r in rows)
    assert rows[-1].new_score == 1000


async def test_08_idempotent_duplicate_delivery(world, live):
    sid = live["session"]["id"]
    r1 = await world.event(sid, "PHONE_DETECTED", episode_id="ep-phone-001")
    r2 = await world.event(sid, "PHONE_DETECTED", episode_id="ep-phone-001")
    assert r1.status_code == 201 and r2.status_code == 200
    assert r2.json()["duplicate"] is True and r2.json()["event"]["id"] == r1.json()["event"]["id"]
    assert await world.score(sid) == (100, True)


async def test_09_continuous_frame_suppression(world, live):
    sid = live["session"]["id"]
    for _ in range(30):  # 30 inference frames of the same episode
        await world.event(sid, "PHONE_DETECTED", episode_id="ep-phone-continuous")
    assert await world.score(sid) == (100, True)
    assert len(await _ledger(sid)) == 1


async def test_10_boundary_99_not_suspicious(world, live):
    assert scoring.is_suspicious(99) is False
    state, entry = scoring.evaluate(scoring.ScoreState(score=99), scoring.EVENT_TAB_BLUR)
    assert entry is None and state.score == 99 and state.is_suspicious is False


async def test_11_boundary_100_suspicious(world, live):
    assert scoring.is_suspicious(100) is True
    state = scoring.ScoreState(score=90, head_turn_pending=2, head_turns_total=26)
    state, entry = scoring.evaluate(state, scoring.EVENT_HEAD_TURN)
    assert entry.new_score == 100 and entry.is_suspicious is True and state.head_turn_pending == 0


async def test_12_session_isolation(world, live):
    a = live["session"]["id"]
    b = (await world.session(live["exam"]["passkey"]))["id"]
    await world.event(a, "PHONE_DETECTED", episode_id="shared-episode-id")
    await world.event(b, "BOOK_DETECTED", episode_id="shared-episode-id")
    assert await world.score(a) == (100, True)
    assert await world.score(b) == (50, False)


async def test_13_concurrent_score_safety(world, live):
    sid = live["session"]["id"]
    results = await asyncio.gather(*[world.event(sid, "PHONE_DETECTED") for _ in range(10)])
    assert all(r.status_code == 201 for r in results)
    assert await world.score(sid) == (1000, True)
    rows = await _ledger(sid)
    assert len(rows) == 10
    # Ledger forms an unbroken chain: no lost updates.
    chain = sorted(rows, key=lambda r: r.previous_score)
    for prev, nxt in zip(chain, chain[1:]):
        assert prev.new_score == nxt.previous_score
    assert sum(r.applied_points for r in rows) == 1000


async def test_14_audit_trail_preserved_on_dismissal(world, live):
    sid = live["session"]["id"]
    r = await world.event(sid, "PHONE_DETECTED", evidenceBase64=JPEG, confidence=0.71)
    event_id = r.json()["event"]["id"]
    hdr = {"Authorization": f"Bearer {live['examinerToken']}"}
    bad = await world.c.post(f"/api/v1/proctor/events/{event_id}/dismiss", headers=hdr, json={"justificationNote": "short"})
    assert bad.status_code == 422  # mandatory justification (>= 10 chars)
    d = await world.c.post(
        f"/api/v1/proctor/events/{event_id}/dismiss", headers=hdr, json={"justificationNote": "Candidate held a scientific calculator."}
    )
    assert d.status_code == 200, d.text
    body = d.json()
    assert body["event"]["reviewStatus"] == "DISMISSED"
    assert body["session"]["automatedScore"] == 100
    assert body["session"]["officialStatus"] == "Suspicious (Flagged by AI, Dismissed by Examiner)"
    async with dbmod.get_sessionmaker()() as db:
        ev = await db.get(ProctoringEvent, uuid.UUID(event_id))
        assert ev is not None and float(ev.confidence) == pytest.approx(0.71)
        assert (await db.execute(select(EvidenceRecord).where(EvidenceRecord.event_id == ev.event_id))).scalar_one()
        assert (await db.execute(select(ExaminerReview).where(ExaminerReview.event_id == ev.event_id))).scalar_one().action == "DISMISS"
    assert len(await _ledger(sid)) == 1
    assert await world.score(sid) == (100, True)
    ev_url = await world.c.get(f"/api/v1/proctor/events/{event_id}/evidence", headers=hdr)
    assert ev_url.status_code == 200
    report = (await world.c.get(f"/api/v1/reports/{sid}", headers=hdr)).json()
    assert report["proctoring"]["suspicionScore"] == 100 and report["proctoring"]["reviewAdjustedScore"] == 0


async def test_15_tab_switching_zero_weight(world, live):
    sess = live["session"]
    hdr = {"Authorization": f"Bearer {sess['token']}"}
    for i in range(5):
        for etype, dur in (("TAB_BLUR", None), ("TAB_FOCUS", 120)):
            body = {"sessionId": sess["id"], "episodeId": f"tab-{i}", "source": "BROWSER_VISIBILITY", "eventType": etype, "timestamp": now_iso()}
            if dur is not None:
                body["durationMs"] = dur
            r = await world.c.post("/api/v1/proctor/events", headers=hdr, json=body)
            assert r.status_code == 201, r.text
    assert await world.score(sess["id"]) == (0, False)
    cards = (await world.c.get("/api/v1/proctor/live-candidates", headers={"Authorization": f"Bearer {live['examinerToken']}"})).json()
    card = next(c for c in cards if c["sessionId"] == sess["id"])
    assert card["tabSwitchCount"] == 5 and card["riskScore"] == 0
    assert len(await _ledger(sess["id"])) == 0


async def test_16_score_synchronization(world, live):
    sid = live["session"]["id"]
    await world.event(sid, "BOOK_DETECTED")
    for _ in range(3):
        await world.event(sid, "HEAD_TURN_SIDEWAYS")
    cards = (await world.c.get("/api/v1/proctor/live-candidates", headers={"Authorization": f"Bearer {live['examinerToken']}"})).json()
    card = next(c for c in cards if c["sessionId"] == sid)
    assert card["suspicionScore"] == (await _ledger(sid))[-1].new_score == 60


async def test_17_idor_report_isolation(world, live):
    a = live["session"]
    b = await world.session(live["exam"]["passkey"])
    for s in (a, b):
        r = await world.c.post(f"/api/v1/exams/{s['examId']}/submit", headers={"Authorization": f"Bearer {s['token']}"}, json={})
        assert r.status_code == 200
    own = await world.c.get(f"/api/v1/reports/{a['id']}", headers={"Authorization": f"Bearer {a['candidateToken']}"})
    assert own.status_code == 200
    other = await world.c.get(f"/api/v1/reports/{b['id']}", headers={"Authorization": f"Bearer {a['candidateToken']}"})
    assert other.status_code == 403
    # A different examiner cannot read this examiner's reports either.
    other_examiner = await world.examiner()
    r = await world.c.get(f"/api/v1/reports/{a['id']}", headers={"Authorization": f"Bearer {other_examiner}"})
    assert r.status_code == 403


async def test_18_evidence_failure_resilience(world, live):
    class BrokenStorage:
        bucket = "broken"

        async def put(self, *a, **k):
            raise StorageError("S3 offline")

    original = get_storage()
    set_storage_for_tests(BrokenStorage())
    try:
        r = await world.event(live["session"]["id"], "PHONE_DETECTED", evidenceBase64=JPEG)
    finally:
        set_storage_for_tests(original)
    assert r.status_code == 201
    assert r.json()["event"]["evidenceStatus"] == "FAILED"
    assert await world.score(live["session"]["id"]) == (100, True)


async def test_zero_weight_absence_and_multiple_faces(world, live):
    sid = live["session"]["id"]
    await world.event(sid, "CANDIDATE_ABSENT", durationMs=12000)
    await world.event(sid, "MULTIPLE_FACES", details={"faceCount": 2})
    assert await world.score(sid) == (0, False)
