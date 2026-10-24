"""WebSocket protocols (section 13.3).

* ``/ws/v1/proctor/live/{examId}?token=<access token>`` -- examiner hall feed
  (candidate status changes, score updates, new anomaly alerts).
* ``/ws/v1/proctor/live?token=...`` -- same, for every exam the examiner owns.
* ``/ws/v1/candidate/session/{sessionId}?token=<exam session token>`` --
  low-frequency candidate notifications. Scores are never sent here (14.2).

Browsers cannot set Authorization headers on WebSocket upgrades, so the token
travels as a query parameter (short-lived JWTs only).
"""

from __future__ import annotations

import asyncio
import contextlib
import uuid

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from ..db import get_sessionmaker, utcnow
from ..models import ROLE_ADMIN, ROLE_SETTER, Examination, User
from ..security import TOKEN_ACCESS, TOKEN_EXAM_SESSION, decode_token
from ..services import live_bus

router = APIRouter()

PING_SECONDS = 25


async def _pump(ws: WebSocket, channels: list[str]) -> None:
    async with live_bus.get_bus().subscribe(*channels) as queue:
        await ws.send_json({"type": "hello", "channels": len(channels), "serverTime": utcnow().isoformat()})

        async def reader():
            while True:
                await ws.receive_text()  # client pings / keeps connection; content ignored

        reader_task = asyncio.create_task(reader())
        try:
            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=PING_SECONDS)
                except asyncio.TimeoutError:
                    msg = {"type": "ping", "serverTime": utcnow().isoformat()}
                await ws.send_json(msg)
                if reader_task.done():
                    break
        finally:
            reader_task.cancel()
            with contextlib.suppress(BaseException):
                await reader_task


async def _examiner(ws: WebSocket, token: str | None) -> User | None:
    try:
        claims = decode_token(token or "")
    except jwt.PyJWTError:
        return None
    if claims.get("typ") != TOKEN_ACCESS or claims.get("role") not in (ROLE_SETTER, ROLE_ADMIN):
        return None
    async with get_sessionmaker()() as db:
        return await db.get(User, uuid.UUID(claims["sub"]))


@router.websocket("/ws/v1/proctor/live")
@router.websocket("/ws/v1/proctor/live/{exam_id}")
async def examiner_live(ws: WebSocket, exam_id: str | None = None, token: str | None = None):
    user = await _examiner(ws, token)
    if user is None:
        await ws.close(code=4401)
        return
    async with get_sessionmaker()() as db:
        stmt = select(Examination.exam_id)
        if user.role != ROLE_ADMIN:
            stmt = stmt.where(Examination.examiner_id == user.user_id)
        if exam_id:
            try:
                stmt = stmt.where(Examination.exam_id == uuid.UUID(exam_id))
            except ValueError:
                await ws.close(code=4404)
                return
        exam_ids = (await db.execute(stmt)).scalars().all()
    if exam_id and not exam_ids:
        await ws.close(code=4403)
        return
    await ws.accept()
    with contextlib.suppress(WebSocketDisconnect, RuntimeError):
        await _pump(ws, [live_bus.exam_channel(e) for e in exam_ids] or ["examiner:none"])


@router.websocket("/ws/v1/candidate/session/{session_id}")
async def candidate_channel(ws: WebSocket, session_id: str, token: str | None = None):
    try:
        claims = decode_token(token or "")
    except jwt.PyJWTError:
        await ws.close(code=4401)
        return
    if claims.get("typ") != TOKEN_EXAM_SESSION or claims.get("session_id") != session_id:
        await ws.close(code=4403)
        return
    await ws.accept()
    with contextlib.suppress(WebSocketDisconnect, RuntimeError):
        await _pump(ws, [live_bus.session_channel(session_id)])
