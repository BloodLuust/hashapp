from aiobreaker import CircuitBreaker
from .config import settings


breaker_blockchair = CircuitBreaker(fail_max=settings.CIRCUIT_FAIL_MAX, reset_timeout=settings.CIRCUIT_RESET_TIMEOUT)
breaker_infura = CircuitBreaker(fail_max=settings.CIRCUIT_FAIL_MAX, reset_timeout=settings.CIRCUIT_RESET_TIMEOUT)

