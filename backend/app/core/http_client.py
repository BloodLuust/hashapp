import httpx
from typing import Optional
from .config import settings


_client: Optional[httpx.AsyncClient] = None


async def init_http_client():
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(20.0, connect=10.0),
            verify=not settings.ALLOW_INSECURE_TLS,
            headers={"User-Agent": "wallet-scanner/0.1 (+https://example.local)"},
            # Use HTTP/1.1 for broad compatibility; switch to HTTP/2 if 'h2' is installed.
        )


async def close_http_client():
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def get_http_client() -> httpx.AsyncClient:
    if _client is None:
        raise RuntimeError("HTTP client not initialized")
    return _client
