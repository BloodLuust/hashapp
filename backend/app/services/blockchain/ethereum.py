from .base import BaseScanner
from ...core.http_client import get_http_client
from ...core.config import settings
from ...core.utils import async_retry
from ...core.cache import cache_get, cache_set
from ...core.limits import sem_infura, sem_etherscan
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

    def _etherscan_url(self) -> str:
        return "https://api.etherscan.io/api"

    async def scan_address(self, address: str, compare_providers: bool = False):
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
        # Optional enrichment via Etherscan (if key configured): fetch standard tx list
        tx_volume_over_time = []
        balance_over_time = []
        summary_extra = {}
        if settings.ETHERSCAN_API_KEY:
            import datetime as _dt

            async def _do_txs():
                params = {
                    "module": "account",
                    "action": "txlist",
                    "address": address,
                    "startblock": 0,
                    "endblock": 99999999,
                    "sort": "asc",
                    "apikey": settings.ETHERSCAN_API_KEY,
                }
                async with sem_etherscan:
                    client = get_http_client()
                    resp = await client.get(self._etherscan_url(), params=params)
                    resp.raise_for_status()
                    return resp

        
            try:
                rtx = await async_retry(_do_txs)
                payload = rtx.json()
                if (payload or {}).get("status") == "1":
                    txs = payload.get("result", []) or []
                    # Compute simple monthly volume buckets (count only)
                    buckets: dict[str, int] = {}
                    # Build naive ETH balance series over time (normal tx only)
                    cur_balance = 0
                    addr_lc = address.lower()
                    for t in txs:
                        try:
                            ts = int(t.get("timeStamp", "0"))
                            dt = _dt.datetime.utcfromtimestamp(ts)
                            key = f"{dt.year}-{dt.month:02d}"
                            buckets[key] = buckets.get(key, 0) + 1
                            from_addr = (t.get("from") or "").lower()
                            to_addr = (t.get("to") or "").lower()
                            val_wei = int(t.get("value", "0"))
                            gas_price = int(t.get("gasPrice", "0"))
                            gas_used = int(t.get("gasUsed", t.get("gas", "0")))
                            is_error = (t.get("isError") or "0") != "0"
                            # Apply effect if successful
                            if not is_error:
                                if to_addr == addr_lc:
                                    cur_balance += val_wei
                                if from_addr == addr_lc:
                                    cur_balance -= val_wei + (gas_price * gas_used)
                            balance_over_time.append({
                                "t": _dt.datetime.utcfromtimestamp(ts).isoformat() + "Z",
                                "balance": cur_balance / WEI,
                            })
                        except Exception:
                            continue
                    tx_volume_over_time = [
                        {"month": k, "tx_count": buckets[k]}
                        for k in sorted(buckets.keys())
                    ]
                    summary_extra = {"total_transactions": len(txs)}
            except Exception:
                # Ignore enrichment errors; keep baseline data
                pass

        result = {
            "summary": {
                "addresses_scanned": 1,
                # Prefer enriched total tx count if present; else outgoing-only
                "total_transactions": summary_extra.get("total_transactions", tx_outgoing),
                "current_balance": balance_eth,
                "unit": "ETH",
                "currency": "ETH",
            },
            "addresses_scanned": [address],
            "balance_over_time": balance_over_time,
            "tx_volume_over_time": tx_volume_over_time,
        }
        await cache_set(cache_key, result)
        return result

    async def scan_xpub(self, xpub: str, compare_providers: bool = False):
        return {"error": "xpub not supported on Ethereum"}
