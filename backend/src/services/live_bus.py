"""Live telemetry broadcasting (section 14) + idempotency key cache (section 5.3).

Channels follow the spec naming: ``exam:{exam_id}:events`` for the examiner hall
and ``session:{session_id}:notify`` for the low-frequency candidate channel.

With REDIS_URL configured, messages go through Redis Pub/Sub so several API
instances share one backplane. Without it, an in-process fan-out is used, which
is correct for a single uvicorn process (the default dev setup).
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import defaultdict
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from ..config import get_settings

log = logging.getLogger("intelliproctor.live")


def exam_channel(exam_id) -> str:
    return f"exam:{exam_id}:events"


def examiner_channel(examiner_id) -> str:
    return f"examiner:{examiner_id}:events"


def session_channel(session_id) -> str:
    return f"session:{session_id}:notify"


class _MemoryBus:
    def __init__(self) -> None:
        self._subs: dict[str, set[asyncio.Queue]] = defaultdict(set)

    async def publish(self, channel: str, message: dict) -> None:
        for q in list(self._subs.get(channel, ())):
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:  # slow consumer: drop oldest
                try:
                    q.get_nowait()
                    q.put_nowait(message)
                except (asyncio.QueueEmpty, asyncio.QueueFull):
                    pass

    @asynccontextmanager
    async def subscribe(self, *channels: str) -> AsyncIterator[asyncio.Queue]:
        q: asyncio.Queue = asyncio.Queue(maxsize=500)
        for ch in channels:
            self._subs[ch].add(q)
        try:
            yield q
        finally:
            for ch in channels:
                self._subs[ch].discard(q)
                if not self._subs[ch]:
                    self._subs.pop(ch, None)


class _RedisBus:
    def __init__(self, url: str) -> None:
        import redis.asyncio as redis  # imported lazily: optional dependency at runtime

        self._redis = redis.from_url(url, decode_responses=True)

    async def publish(self, channel: str, message: dict) -> None:
        await self._redis.publish(channel, json.dumps(message, default=str))

    @asynccontextmanager
    async def subscribe(self, *channels: str) -> AsyncIterator[asyncio.Queue]:
        q: asyncio.Queue = asyncio.Queue(maxsize=500)
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(*channels)

        async def pump():
            async for item in pubsub.listen():
                if item.get("type") == "message":
                    try:
                        q.put_nowait(json.loads(item["data"]))
                    except (asyncio.QueueFull, json.JSONDecodeError):
                        pass

        task = asyncio.create_task(pump())
        try:
            yield q
        finally:
            task.cancel()
            await pubsub.unsubscribe(*channels)
            await pubsub.aclose()


_bus = None


def get_bus():
    global _bus
    if _bus is None:
        url = get_settings().REDIS_URL.strip()
        if url:
            try:
                _bus = _RedisBus(url)
                log.info("Live bus: Redis pub/sub at %s", url)
            except Exception as exc:  # noqa: BLE001
                log.warning("Redis unavailable (%s); falling back to in-process bus", exc)
                _bus = _MemoryBus()
        else:
            _bus = _MemoryBus()
    return _bus


async def publish(channel: str, message: dict) -> None:
    try:
        await get_bus().publish(channel, message)
    except Exception as exc:  # noqa: BLE001 -- live updates must never break ingestion
        log.warning("live publish failed on %s: %s", channel, exc)


# --------------------------------------------------------- idempotency cache


class IdempotencyCache:
    """24-hour cache of accepted idempotency keys (section 18.2). This is a fast
    path only; the UNIQUE constraint on proctoring_events.idempotency_key is the
    real guarantee, so a cache miss can never cause double scoring."""

    TTL = 24 * 3600

    def __init__(self) -> None:
        self._mem: dict[str, tuple[str, float]] = {}
        self._redis = None
        url = get_settings().REDIS_URL.strip()
        if url:
            try:
                import redis.asyncio as redis

                self._redis = redis.from_url(url, decode_responses=True)
            except Exception:  # noqa: BLE001
                self._redis = None

    async def get(self, key: str) -> str | None:
        if self._redis is not None:
            try:
                return await self._redis.get(f"idem:{key}")
            except Exception:  # noqa: BLE001
                pass
        hit = self._mem.get(key)
        if hit and hit[1] > time.monotonic():
            return hit[0]
        self._mem.pop(key, None)
        return None

    async def set(self, key: str, event_id: str) -> None:
        if self._redis is not None:
            try:
                await self._redis.set(f"idem:{key}", event_id, ex=self.TTL)
                return
            except Exception:  # noqa: BLE001
                pass
        if len(self._mem) > 200_000:
            self._mem.clear()
        self._mem[key] = (event_id, time.monotonic() + self.TTL)


_idem: IdempotencyCache | None = None


def get_idempotency_cache() -> IdempotencyCache:
    global _idem
    if _idem is None:
        _idem = IdempotencyCache()
    return _idem


def reset_for_tests() -> None:
    global _bus, _idem
    _bus = None
    _idem = None
