from .base import BaseScanner
from ...core.http_client import get_http_client
from ...core.config import settings
from ...core.utils import async_retry
from ...core.cache import cache_get, cache_set
from ...core.limits import sem_blockchair
from ...core.circuit import breaker_blockchair


SATOSHI = 100_000_000


class BitcoinScanner(BaseScanner):
    def __init__(self, network: str = "bitcoin") -> None:
        self.network = network

    def _base(self) -> str:
        # Blockchair network path
        if self.network in {"bitcoin-testnet", "testnet", "btc-testnet"}:
            return "https://api.blockchair.com/bitcoin/testnet"
        return "https://api.blockchair.com/bitcoin"

    def _auth_params(self) -> dict:
        params = {}
        if settings.BLOCKCHAIR_API_KEY:
            params["key"] = settings.BLOCKCHAIR_API_KEY
        return params

    async def scan_address(self, address: str):
        # Cache lookup
        cache_key = f"scan:btc:{self.network}:addr:{address}"
        cached = await cache_get(cache_key)
        if cached:
            return cached

        client = get_http_client()
        url = f"{self._base()}/dashboards/address/{address}"

        async def _do():
            async with sem_blockchair:
                resp = await breaker_blockchair.call_async(client.get, url, params={**self._auth_params()})
                resp.raise_for_status()
                return resp

        r = await async_retry(_do)
        data = r.json().get("data", {})
        addr_info = data.get(address, {}).get("address", {})
        tx_count = int(addr_info.get("transaction_count", 0))
        balance_sats = int(addr_info.get("balance", 0))
        total_received = int(addr_info.get("received", 0))
        total_spent = int(addr_info.get("spent", 0))
        result = {
            "summary": {
                "addresses_scanned": 1,
                "total_transactions": tx_count,
                "total_received": total_received / SATOSHI,
                "total_sent": total_spent / SATOSHI,
                "current_balance": balance_sats / SATOSHI,
                "unit": "BTC",
                "currency": "BTC",
            },
            "addresses_scanned": [address],
            "balance_over_time": [],
            "tx_volume_over_time": [],
        }
        await cache_set(cache_key, result)
        return result

    async def scan_xpub(self, xpub: str):
        cache_key = f"scan:btc:{self.network}:xpub:{xpub}"
        cached = await cache_get(cache_key)
        if cached:
            return cached

        client = get_http_client()
        url = f"{self._base()}/dashboards/xpub/{xpub}"

        async def _do():
            async with sem_blockchair:
                resp = await breaker_blockchair.call_async(client.get, url, params={**self._auth_params()})
                resp.raise_for_status()
                return resp

        r = await async_retry(_do)
        data = r.json().get("data", {})
        x = data.get(xpub, {})
        # Blockchair response has aggregated values and addresses list
        addresses = [a.get("address") for a in (x.get("addresses", []) or []) if a.get("address")]
        agg = x.get("xpub", {})
        # Some Blockchair variants place totals on xpub or as sum of addresses
        balance_sats = int(agg.get("balance", 0))
        total_received = int(agg.get("received", 0))
        total_spent = int(agg.get("spent", 0))
        tx_count = int(agg.get("transaction_count", 0))
        if not tx_count and addresses:
            # Fallback: sum child address transaction_count if provided
            tx_count = sum(int((a or {}).get("transaction_count", 0)) for a in x.get("addresses", []) if a)
        result = {
            "summary": {
                "addresses_scanned": len(addresses) or int(agg.get("address_count", 0)) or len(addresses),
                "total_transactions": tx_count,
                "total_received": total_received / SATOSHI if total_received else None,
                "total_sent": total_spent / SATOSHI if total_spent else None,
                "current_balance": balance_sats / SATOSHI,
                "unit": "BTC",
                "currency": "BTC",
            },
            "addresses_scanned": addresses,
            "balance_over_time": [],
            "tx_volume_over_time": [],
        }
        await cache_set(cache_key, result)
        return result
