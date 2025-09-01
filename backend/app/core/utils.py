import asyncio
import random
from typing import Callable, TypeVar, Awaitable


T = TypeVar("T")


async def async_retry(fn: Callable[[], Awaitable[T]], *, retries: int = 3, base_delay: float = 0.5, max_delay: float = 5.0) -> T:
    """Retry an async callable with exponential backoff and jitter."""
    attempt = 0
    last_exc: Exception | None = None
    while attempt <= retries:
        try:
            return await fn()
        except Exception as e:  # noqa: BLE001 - deliberate broad catch at boundary
            last_exc = e
            if attempt == retries:
                break
            delay = min(max_delay, base_delay * (2 ** attempt))
            delay = delay * (0.7 + random.random() * 0.6)  # jitter 70%-130%
            await asyncio.sleep(delay)
            attempt += 1
    assert last_exc is not None
    raise last_exc

