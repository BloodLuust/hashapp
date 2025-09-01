import json
import time
from typing import Optional

from .config import settings

try:
    from redis.asyncio import Redis  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    Redis = None  # type: ignore


_memory_cache: dict[str, tuple[float, str]] = {}
_redis: Optional["Redis"] = None


async def init_cache():
    global _redis
    if settings.REDIS_URL and Redis is not None:
        _redis = Redis.from_url(settings.REDIS_URL)


async def close_cache():
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None


async def cache_get(key: str) -> Optional[dict]:
    now = time.time()
    if _redis is not None:
        val = await _redis.get(key)
        if val is None:
            return None
        try:
            return json.loads(val)
        except Exception:
            return None
    # in-memory fallback
    entry = _memory_cache.get(key)
    if not entry:
        return None
    expires_at, blob = entry
    if now >= expires_at:
        _memory_cache.pop(key, None)
        return None
    try:
        return json.loads(blob)
    except Exception:
        return None


async def cache_set(key: str, value: dict, ttl: Optional[int] = None) -> None:
    ttl = ttl or settings.CACHE_TTL_SECONDS
    if _redis is not None:
        try:
            await _redis.set(key, json.dumps(value), ex=ttl)
            return
        except Exception:
            pass
    # in-memory fallback
    expires_at = time.time() + ttl
    _memory_cache[key] = (expires_at, json.dumps(value))

