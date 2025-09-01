from .base import BaseScanner
from ...core.http_client import get_http_client
from ...core.config import settings
from ...core.utils import async_retry
from ...core.cache import cache_get, cache_set
from ...core.limits import sem_infura
from ...core.circuit import breaker_infura

WEI = 10**18


class EthereumScanner(BaseScanner):
    def __init__(self, network: str = "ethereum") -> None:
        self.network = network

    def _rpc_url(self) -> str:
        key = settings.INFURA_KEY
        if not key:
            raise RuntimeError("INFURA_KEY not configured")
        # mainnet
        return f"https://mainnet.infura.io/v3/{key}"

    async def scan_address(self, address: str):
        if not address or not isinstance(address, str) or not address.startswith("0x") or len(address) != 42:
            # quick sanity check; full EIP-55 checksum verification omitted
            raise ValueError("Invalid Ethereum address format")
        cache_key = f"scan:eth:{self.network}:addr:{address}"
        cached = await cache_get(cache_key)
        if cached:
            return cached

        client = get_http_client()
        rpc = self._rpc_url()
        payload_bal = {"jsonrpc": "2.0", "id": 1, "method": "eth_getBalance", "params": [address, "latest"]}
        payload_nonce = {"jsonrpc": "2.0", "id": 2, "method": "eth_getTransactionCount", "params": [address, "latest"]}

        async def _do_balance():
            async with sem_infura:
                resp = await breaker_infura.call_async(client.post, rpc, json=payload_bal)
                resp.raise_for_status()
                return resp

        async def _do_nonce():
            async with sem_infura:
                resp = await breaker_infura.call_async(client.post, rpc, json=payload_nonce)
                resp.raise_for_status()
                return resp

        import asyncio as _asyncio
        r1, r2 = await _asyncio.gather(async_retry(_do_balance), async_retry(_do_nonce))
        bal_hex = (r1.json().get("result") or "0x0")
        nonce_hex = (r2.json().get("result") or "0x0")
        balance_eth = int(bal_hex, 16) / WEI
        tx_outgoing = int(nonce_hex, 16)
        result = {
            "summary": {
                "addresses_scanned": 1,
                "total_transactions": tx_outgoing,  # outgoing only; incoming transfers not counted here
                "current_balance": balance_eth,
                "unit": "ETH",
                "currency": "ETH",
            },
            "addresses_scanned": [address],
            "balance_over_time": [],
            "tx_volume_over_time": [],
        }
        await cache_set(cache_key, result)
        return result

    async def scan_xpub(self, xpub: str):
        return {"error": "xpub not supported on Ethereum"}
