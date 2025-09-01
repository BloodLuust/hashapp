from aiobreaker import CircuitBreaker
from .config import settings


# aiobreaker CircuitBreaker expects `timeout_duration` (not `reset_timeout`).
breaker_blockchair = CircuitBreaker(
    fail_max=settings.CIRCUIT_FAIL_MAX,
    timeout_duration=settings.CIRCUIT_RESET_TIMEOUT,
)
breaker_infura = CircuitBreaker(
    fail_max=settings.CIRCUIT_FAIL_MAX,
    timeout_duration=settings.CIRCUIT_RESET_TIMEOUT,
)
