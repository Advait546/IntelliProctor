"""End-to-end API behaviour beyond the scoring scenarios."""

from __future__ import annotations

import base64
import uuid
from datetime import timedelta

import pytest
from sqlalchemy import update

from src import db as dbmod
from src.db import utcnow
from src.models import ExamSession, Examination
from src.services import cv_client

pytestmark = pytest.mark.asyncio


def auth(t: str) -> dict:
    return {"Authorization": f"Bearer {t}"}


async def test_refresh_rotation_and_reuse_detection(client, world):
    await world.examiner("rot@uni.edu")
    r = await client.post("/api/v1/auth/login", json={"email": "rot@uni.edu", "password": "password123"})
    first_cookie = r.cookies.get("ip_refresh")
    assert first_cookie
    r2 = await client.post("/api/v1/auth/refresh")
    assert r2.status_code == 200 and r2.json()["token"]
    # Replaying the original (rotated) refresh token revokes the family.
    client.cookies.clear()
    client.cookies.set("ip_refresh", first_cookie, path="/api/v1/auth")
    r3 = await client.post("/api/v1/auth/refresh")
    assert r3.status_code == 401 and r3.json()["error"]["code"] == "REFRESH_TOKEN_REUSED"


async def test_login_errors_use_envelope(client):
    r = await client.post("/api/v1/auth/login", json={"email": "nobody@x.io", "password": "nope"})
    assert r.status_code == 401
    err = r.json()["error"]
    assert err["code"] == "INVALID_CREDENTIALS" and "timestamp" in err and "details" in err


async def test_student_cannot_use_examiner_portal(client, world):
    st = await world.candidate("S-1", "Stu")
    r = await client.post("/api/v1/exams", headers=auth(st), json={"title": "x"})
    assert r.status_code == 403
    r = await client.post("/api/v1/auth/examiner/login", json={"candidateId": "S-1", "password": "student123"})
    assert r.status_code == 403


async def test_candidate_login_existing_wrong_password(client, world):
    await world.candidate("S-2", "Stu")
    r = await client.post("/api/v1/auth/candidate/login", json={"candidateId": "S-2", "password": "wrongpass"})
    assert r.status_code == 401


async def test_passkey_not_stored_plaintext_and_lookup(client, world):
    et = await world.examiner()
    exam = await world.exam(et)
    code = exam["passkey"]
    async with dbmod.get_sessionmaker()() as db:
        row = await db.get(Examination, uuid.UUID(exam["exam"]["id"]))
        assert code not in (row.passkey_hash + row.passkey_lookup + row.passkey_ciphertext)
        assert row.passkey_hash.startswith("$argon2id$")
    ok = (await client.get(f"/api/v1/exams/lookup/{code.lower()}")).json()
    assert ok["valid"] is True and ok["examTitle"] == "Test Exam"
    assert (await client.get("/api/v1/exams/lookup/NOPE12345")).json()["valid"] is False
    assert (await client.get(f"/api/v1/auth/verify-code/{code}")).json()["valid"] is True


async def test_invalid_passkey_and_draft_exam(client, world):
    et = await world.examiner()
    st = await world.candidate()
    r = await client.post("/api/v1/exams/verify-passkey", headers=auth(st), json={"passkey": "WRONGCODE1"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "INVALID_PASSKEY"
    draft = await world.exam(et, publish=False)
    r = await client.post("/api/v1/exams/verify-passkey", headers=auth(st), json={"passkey": draft["passkey"]})
    assert r.status_code == 403 and r.json()["error"]["code"] == "INVALID_PASSKEY"


async def test_closed_window_blocks_entry(client, world):
    et = await world.examiner()
    exam = await world.exam(et)
    await client.post(f"/api/v1/exams/{exam['exam']['id']}/close", headers=auth(et))
    st = await world.candidate()
    r = await client.post("/api/v1/exams/verify-passkey", headers=auth(st), json={"passkey": exam["passkey"]})
    assert r.status_code == 403 and r.json()["error"]["code"] == "EXAM_WINDOW_CLOSED"


async def test_questions_hide_answer_keys_and_resume(client, world, live):
    s = live["session"]
    r = await client.get(f"/api/v1/exams/{s['examId']}/questions", headers=auth(s["token"]))
    assert r.status_code == 200
    qs = r.json()["questions"]
    assert len(qs) == 4 and all("correctAnswer" not in q for q in qs)
    await client.post(f"/api/v1/exams/{s['examId']}/draft", headers=auth(s["token"]), json={"questionId": qs[0]["id"], "answer": "B", "markedForReview": True})
    # Re-admission resumes the same attempt (reload-safe) with saved drafts.
    again = await client.post("/api/v1/exams/verify-passkey", headers=auth(s["candidateToken"]), json={"passkey": live["exam"]["passkey"]})
    assert again.json()["resumed"] is True and again.json()["session"]["sessionId"] == s["id"]
    r = await client.get(f"/api/v1/exams/{s['examId']}/questions", headers=auth(again.json()["sessionToken"]))
    assert r.json()["answers"][qs[0]["id"]] == "B" and r.json()["markedForReview"][qs[0]["id"]] is True


async def test_access_token_cannot_replace_session_token(client, world, live):
    s = live["session"]
    r = await client.get(f"/api/v1/exams/{s['examId']}/questions", headers=auth(s["candidateToken"]))
    assert r.status_code == 401


async def test_grading_negative_marking_and_single_attempt(client, world):
    et = await world.examiner()
    exam = await world.exam(et, settings={"negativeMarking": 0.5})
    s = await world.session(exam["passkey"])
    qs = (await client.get(f"/api/v1/exams/{s['examId']}/questions", headers=auth(s["token"]))).json()["questions"]
    by_type = {q["type"]: q["id"] for q in qs}
    answers = {by_type["MCQ"]: "B", by_type["TrueFalse"]: "B", by_type["FillBlank"]: " paris ", by_type["Subjective"]: "Model memorises noise."}
    r = await client.post(f"/api/v1/exams/{s['examId']}/submit", headers=auth(s["token"]), json={"answers": answers})
    assert r.status_code == 200 and r.json()["attemptedCount"] == 4 and r.json()["status"] == "EVALUATED"
    rep = (await client.get(f"/api/v1/reports/{s['id']}", headers=auth(et))).json()
    # MCQ +2, TF wrong -0.5, FillBlank +2, subjective manual -> 3.5 / 10
    assert rep["academic"]["score"] == pytest.approx(3.5) and rep["academic"]["maxScore"] == 10
    assert "answers" in rep
    again = await client.post("/api/v1/exams/verify-passkey", headers=auth(s["candidateToken"]), json={"passkey": exam["passkey"]})
    assert again.status_code == 409 and again.json()["error"]["code"] == "ALREADY_SUBMITTED"
    late = await world.event(s["id"], "PHONE_DETECTED")
    assert late.status_code == 409


async def test_timer_expiry_force_submits(client, world, live):
    s = live["session"]
    async with dbmod.get_sessionmaker()() as db:
        await db.execute(update(ExamSession).where(ExamSession.session_id == uuid.UUID(s["id"])).values(expires_at=utcnow() - timedelta(seconds=1)))
        await db.commit()
    r = await world.event(s["id"], "PHONE_DETECTED")
    assert r.status_code == 409
    async with dbmod.get_sessionmaker()() as db:
        row = await db.get(ExamSession, uuid.UUID(s["id"]))
        assert row.submission_type == "TIMER_EXPIRED" and row.status == "EVALUATED"


async def test_examiner_idor_on_exams_and_sessions(client, world, live):
    other = await world.examiner()
    eid, sid = live["exam"]["exam"]["id"], live["session"]["id"]
    assert (await client.get(f"/api/v1/exams/{eid}", headers=auth(other))).status_code == 403
    assert (await client.get(f"/api/v1/proctor/sessions/{sid}/events", headers=auth(other))).status_code == 403
    assert (await client.get("/api/v1/proctor/live-candidates", headers=auth(other))).json() == []
    assert (await client.get(f"/api/v1/exams/{eid}", headers=auth(live["examinerToken"]))).json()["code"] == live["exam"]["passkey"]


async def test_browser_cannot_forge_cv_events_or_other_sessions(client, world, live):
    s = live["session"]
    other = await world.session(live["exam"]["passkey"])
    body = {"sessionId": other["id"], "episodeId": "x", "source": "BROWSER_VISIBILITY", "eventType": "TAB_BLUR", "timestamp": utcnow().isoformat()}
    assert (await client.post("/api/v1/proctor/events", headers=auth(s["token"]), json=body)).status_code == 403
    body = {"sessionId": s["id"], "episodeId": "x", "source": "YOLO_CV", "eventType": "PHONE_DETECTED", "timestamp": utcnow().isoformat()}
    assert (await client.post("/api/v1/proctor/events", headers=auth(s["token"]), json=body)).status_code == 403
    assert (await client.post("/api/v1/proctor/events", json=body)).status_code == 401


async def test_clock_skew_flagged(client, world, live):
    r = await world.event(live["session"]["id"], "BOOK_DETECTED", timestamp=(utcnow() - timedelta(minutes=5)).isoformat())
    assert r.json()["event"]["isClockSkewed"] is True
    assert await world.score(live["session"]["id"]) == (50, False)


async def test_manual_flag_is_zero_points(client, world, live):
    r = await client.post(f"/api/v1/proctor/sessions/{live['session']['id']}/flag", headers=auth(live["examinerToken"]), json={"reason": "Talking"})
    assert r.status_code == 200
    assert await world.score(live["session"]["id"]) == (0, False)
    card = (await client.get(f"/api/v1/proctor/sessions/{live['session']['id']}", headers=auth(live["examinerToken"]))).json()
    assert card["manuallyFlagged"] is True and card["status"] == "Critical"


async def test_frame_pipeline_with_cv_worker(client, world, live, monkeypatch):
    s = live["session"]
    calls = []

    async def fake_analyze(session_id, image_b64, captured_at):
        calls.append(session_id)
        return {
            "observation": {"faceCount": 1, "multipleFaces": False, "lookingAway": False, "gazeDirection": "Center",
                            "headPose": {"yaw": 3.0, "pitch": 1.0, "roll": 0.0}, "phoneInView": True, "bookInView": False},
            "events": [
                {"eventType": "PHONE_DETECTED", "source": "YOLO_CV", "episodeId": "phone-ep-1", "timestamp": utcnow().isoformat(),
                 "confidence": 0.77, "boundingBox": {"x": 1, "y": 2, "width": 30, "height": 60},
                 "evidenceBase64": base64.b64encode(b"\xff\xd8\xff" + bytes(64)).decode()}
            ],
        }

    monkeypatch.setattr(cv_client, "analyze_frame", fake_analyze)
    frame = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff" + bytes(2000)).decode()
    for _ in range(3):  # the worker re-reports the same episode id -> scored once
        r = await client.post(f"/api/v1/proctor/sessions/{s['id']}/frames", headers=auth(s["token"]), json={"imageBase64": frame})
        assert r.status_code == 200, r.text
    body = r.json()
    assert body["cvOnline"] is True and body["observation"]["phoneInView"] is True
    assert "suspicionScore" not in str(body) and "riskScore" not in str(body)  # never sent to examinees
    assert await world.score(s["id"]) == (100, True)
    snap = await client.get(f"/api/v1/proctor/sessions/{s['id']}/snapshot", headers=auth(live["examinerToken"]))
    assert snap.status_code == 200 and snap.headers["content-type"] == "image/jpeg"
    events = (await client.get(f"/api/v1/proctor/sessions/{s['id']}/events", headers=auth(live["examinerToken"]))).json()
    ev = events[0]
    assert ev["hasEvidence"] and ev["pointsApplied"] == 100
    url = (await client.get(f"/api/v1/proctor/events/{ev['id']}/evidence", headers=auth(live["examinerToken"]))).json()["url"]
    img = await client.get(url.replace("http://testserver", ""))
    assert img.status_code == 200 and img.content.startswith(b"\xff\xd8\xff")
    tampered = await client.get(url.replace("http://testserver", "")[:-3] + "abc")
    assert tampered.status_code == 403


async def test_frame_when_cv_offline(client, world, live):
    s = live["session"]
    frame = base64.b64encode(b"\xff\xd8\xff" + bytes(2000)).decode()
    r = await client.post(f"/api/v1/proctor/sessions/{s['id']}/frames", headers=auth(s["token"]), json={"imageBase64": frame})
    assert r.status_code == 200 and r.json()["cvOnline"] is False


async def test_reports_list_csv_and_stats(client, world, live):
    et = live["examinerToken"]
    await world.event(live["session"]["id"], "PHONE_DETECTED")
    reps = (await client.get("/api/v1/reports", headers=auth(et))).json()
    assert reps and reps[0]["students"] == 1 and reps[0]["suspiciousCandidates"] == 1
    csv = await client.get(f"/api/v1/reports/{live['exam']['exam']['id']}/download", headers=auth(et))
    assert csv.status_code == 200 and "Suspicion Score" in csv.text and ",100," in csv.text
    all_csv = await client.get("/api/v1/reports/all/download", headers=auth(et))
    assert all_csv.status_code == 200
    exam_rep = (await client.get(f"/api/v1/reports/{live['exam']['exam']['id']}", headers=auth(et))).json()
    assert exam_rep["reportType"] == "exam" and exam_rep["roster"][0]["suspicionScore"] == 100
    stats = (await client.get("/api/v1/stats/overview", headers=auth(et))).json()
    assert stats["activeSessions"] == 1 and stats["suspiciousSessions"] == 1


async def test_question_bank_import_and_generate(client, world):
    et = await world.examiner()
    csv_text = "type,text,optionA,optionB,optionC,optionD,correctAnswer,marks,difficulty,topic\nMCQ,What is 1+1?,1,2,3,4,B,2,Easy,Math\nTrueFalse,Water is wet,,,,,A,1,Easy,Science\nMCQ,Broken,,,,,Z,1,Easy,Math\n"
    r = await client.post("/api/v1/question-bank/import-csv", headers=auth(et), files={"file": ("q.csv", csv_text, "text/csv")})
    assert r.status_code == 201 and r.json()["importedCount"] == 2 and len(r.json()["errors"]) == 1
    bank = (await client.get("/api/v1/question-bank", headers=auth(et))).json()
    assert len(bank) == 2
    gen = await client.post("/api/v1/exams/generate", headers=auth(et), json={"title": "Gen", "count": 5, "publish": True})
    assert gen.status_code == 201 and gen.json()["exam"]["totalQuestions"] == 2 and gen.json()["exam"]["status"] == "Active"


async def test_settings_roundtrip_policy_readonly(client, world):
    et = await world.examiner()
    s = (await client.get("/api/v1/settings", headers=auth(et))).json()
    assert s["scoringPolicy"]["phoneEpisode"] == 100
    r = await client.put("/api/v1/settings", headers=auth(et), json={"notificationSettings": {"soundAlertsOnWarning": False}, "scoringPolicy": {"phoneEpisode": 1}})
    assert r.status_code == 200
    s = r.json()["settings"]
    assert s["notificationSettings"]["soundAlertsOnWarning"] is False and s["scoringPolicy"]["phoneEpisode"] == 100


async def test_exam_update_and_publish_flow(client, world):
    et = await world.examiner()
    draft = await world.exam(et, publish=False)
    eid = draft["exam"]["id"]
    assert draft["exam"]["status"] == "Draft"
    r = await client.post(f"/api/v1/exams/{eid}/questions", headers=auth(et), json={"questions": [{"type": "MCQ", "text": "Q?", "optionA": "a", "optionB": "b", "correctAnswer": "A"}]})
    assert r.json()["totalQuestions"] == 5
    r = await client.post(f"/api/v1/exams/{eid}/publish", headers=auth(et), json={"code": "MYEXAM2026"})
    assert r.status_code == 200 and r.json()["passkey"] == "MYEXAM2026" and r.json()["exam"]["status"] == "Active"
    assert (await client.get("/api/v1/exams/lookup/myexam2026")).json()["valid"] is True
    dup = await client.post("/api/v1/exams", headers=auth(et), json={"title": "Dup", "code": "MYEXAM2026", "questions": []})
    assert dup.status_code == 409


async def test_websocket_examiner_feed(world, live):
    """Exercise the WS endpoint with Starlette's TestClient (sync)."""
    from starlette.testclient import TestClient

    from src.main import create_app

    # TestClient runs the app on its own event loop; give it a fresh engine
    # (asyncpg connections are bound to the loop that created them).
    await dbmod.dispose_engine()
    from src.services import live_bus

    live_bus.reset_for_tests()  # Redis clients are bound to the loop that created them
    app = create_app()
    with TestClient(app) as tc:
        with tc.websocket_connect(f"/ws/v1/proctor/live/{live['exam']['exam']['id']}?token={live['examinerToken']}") as ws:
            assert ws.receive_json()["type"] == "hello"
            r = tc.post(
                "/api/v1/proctor/events",
                headers={"X-Internal-Token": "test-internal-token"},
                json={"sessionId": live["session"]["id"], "episodeId": "ws-1", "source": "YOLO_CV", "eventType": "BOOK_DETECTED", "timestamp": utcnow().isoformat()},
            )
            assert r.status_code == 201
            msg = ws.receive_json()
            assert msg["type"] == "proctoring_event" and msg["score"] == 50 and msg["anomaly"] == "BOOK_DETECTED"
        with pytest.raises(Exception):
            with tc.websocket_connect("/ws/v1/proctor/live?token=garbage") as ws:
                ws.receive_json()
    dbmod._engine = None  # owned by TestClient's (now closed) loop
    dbmod._sessionmaker = None
