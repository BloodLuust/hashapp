from .base import BaseScanner
from ...core.http_client import get_http_client
from ...core.config import settings
from ...core.utils import async_retry
from ...core.cache import cache_get, cache_set
from ...core.limits import sem_blockchair, sem_tatum
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
        # Prefer primary, fallback to backup key if provided
        key = settings.BLOCKCHAIR_API_KEY or settings.BLOCKCHAIR_BACKUP_KEY
        if key:
            params["key"] = key
        return params

    async def scan_address(self, address: str, compare_providers: bool = False):
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
        result.setdefault("providers", {})["blockchair"] = result["summary"]
        if compare_providers and settings.TATUM_API_KEY:
            try:
                tat = await self._tatum_address_summary(address)
                result.setdefault("providers", {})
                result["providers"]["tatum"] = tat
            except Exception as e:
                result.setdefault("providers", {})["tatum"] = {"error": str(e)}
        await cache_set(cache_key, result)
        return result

    async def scan_xpub(self, xpub: str, compare_providers: bool = False):
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
        j = r.json()
        # Basic response validation and context capture
        ctx = {}
        if isinstance(j, dict):
            ctx = (j or {}).get("context") or {}
        data = j.get("data", {}) if isinstance(j, dict) else {}
        x: dict = {}
        if isinstance(data, dict):
            x = data.get(xpub, {})
            # Some Blockchair variants might key by normalized xpub; try best-effort fallback
            if not x and data:
                for k, v in data.items():
                    if isinstance(k, str) and isinstance(v, dict) and (k.endswith(xpub[-16:]) or xpub.endswith(k[-16:])):
                        x = v
                        break
        elif isinstance(data, list):
            # Unexpected structure; attempt to locate a dict carrying xpub details
            for item in data:
                if isinstance(item, dict):
                    if xpub in item and isinstance(item[xpub], dict):
                        x = item[xpub]
                        break
                    if ("xpub" in item) or ("addresses" in item):
                        x = item
                        break
        fallback_checked_addrs: list[str] = []
        if (not isinstance(x, dict)) or (not x):
            # Try to recover using Blockchair context 'checked' list ("path: address")
            checked = []
            if isinstance(ctx, dict):
                checked = ctx.get("checked") or []
            if isinstance(checked, list) and checked:
                for item in checked:
                    try:
                        if isinstance(item, str) and ":" in item:
                            addr = item.split(":", 1)[1].strip()
                            if addr:
                                fallback_checked_addrs.append(addr)
                    except Exception:
                        continue
            else:
                # Surface useful context in error
                raise RuntimeError(f"Unexpected Blockchair xpub response structure; context={ctx or 'n/a'}")
        # Blockchair response has aggregated values and addresses list
        if x:
            addresses = [a.get("address") for a in (x.get("addresses", []) or []) if isinstance(a, dict) and a.get("address")]
            agg = x.get("xpub", {}) if isinstance(x.get("xpub"), dict) else {}
        else:
            addresses = fallback_checked_addrs
            agg = {}
        # Some Blockchair variants place totals on xpub or as sum of addresses
        balance_sats = int(agg.get("balance", 0) or 0)
        total_received = int(agg.get("received", 0) or 0)
        total_spent = int(agg.get("spent", 0) or 0)
        tx_count = int(agg.get("transaction_count", 0) or 0)
        if not tx_count and addresses:
            # Fallback: sum child address transaction_count if provided
            if x:
                tx_count = sum(int((a or {}).get("transaction_count", 0) or 0) for a in x.get("addresses", []) if a)
        result: dict = {
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
        # Always attach Blockchair summary as a provider row for UI comparison
        result.setdefault("providers", {})["blockchair"] = result["summary"]
        # Attach blockchair meta like request_cost when available
        if ctx:
            result.setdefault("providers", {})
            result["providers"]["blockchair_meta"] = {
                k: ctx.get(k) for k in ("request_cost", "cache", "api", "servers") if k in ctx
            }
        if compare_providers and settings.TATUM_API_KEY:
            try:
                candidates: list[str] = []
                if x:
                    # derive addresses with non-zero balance (or unspent output count) from blockchair dataset
                    addrobjs = (x.get("addresses") or [])
                    for a in addrobjs:
                        try:
                            bal = int((a or {}).get("balance", 0) or 0)
                            uoc = int((a or {}).get("unspent_output_count", 0) or 0) if a else 0
                            if bal > 0 or uoc > 0:
                                addr = a.get("address")
                                if addr:
                                    candidates.append(addr)
                        except Exception:
                            continue
                # If no candidates from Blockchair, fall back to checking a subset of derived addresses from context
                if not candidates and fallback_checked_addrs:
                    candidates = fallback_checked_addrs
                # limit lookups
                limit = settings.TATUM_MAX_LOOKUPS
                to_check = candidates[:limit]
                if not to_check:
                    raise RuntimeError("No candidate addresses to check via Tatum")
                # fetch details concurrently with a small cap
                async def _fetch(addr: str):
                    try:
                        async with sem_tatum:
                            return await self._tatum_address_composite(addr)
                    except Exception as e:
                        return {"address": addr, "error": str(e)}
                import asyncio as _asyncio
                details = await _asyncio.gather(*(_fetch(a) for a in to_check))
                # summarize
                addresses_with_unspent = sum(1 for d in details if (d or {}).get("utxo_count", 0) > 0 or ((d or {}).get("balance", 0) or 0) > 0)
                result.setdefault("providers", {})
                result["providers"]["tatum"] = {
                    "checked": len(to_check),
                    "addresses_with_unspent": addresses_with_unspent,
                    "addresses": details,
                }
            except Exception as e:
                result.setdefault("providers", {})["tatum"] = {"error": str(e)}
        await cache_set(cache_key, result)
        return result

    async def _tatum_address_summary(self, address: str) -> dict:
        """Fetch minimal summary from Tatum for comparison.
        Attempts balance endpoint; values returned in BTC.
        """
        client = get_http_client()
        base = "https://api.tatum.io"
        headers = {"x-api-key": settings.TATUM_API_KEY}
        # Balance endpoint (expected to return satoshis or BTC depending on API version)
        url = f"{base}/v3/bitcoin/address/balance/{address}"
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        j = resp.json() or {}
        # Tatum responses vary. Try common fields.
        balance = None
        if isinstance(j, dict):
            if "balance" in j:
                try:
                    # assume BTC if <= 1000, else satoshis
                    val = float(j["balance"])
                    balance = val if val < 1000 else val / SATOSHI
                except Exception:
                    pass
            elif "incoming" in j or "outgoing" in j:
                try:
                    incoming = float(j.get("incoming", 0))
                    outgoing = float(j.get("outgoing", 0))
                    balance = max(0.0, incoming - outgoing)
                except Exception:
                    pass
        return {
            "addresses_scanned": 1,
            "current_balance": balance,
        }

    async def _tatum_address_composite(self, address: str) -> dict:
        client = get_http_client()
        base = "https://api.tatum.io"
        headers = {"x-api-key": settings.TATUM_API_KEY}
        # balance
        bal_url = f"{base}/v3/bitcoin/address/balance/{address}"
        # utxos (page size limited)
        utxo_url = f"{base}/v3/bitcoin/utxo/{address}?pageSize=50"
        import asyncio as _asyncio
        async def _do(url: str):
            r = await client.get(url, headers=headers)
            r.raise_for_status()
            return r.json()
        bal_j, utxo_j = await _asyncio.gather(_do(bal_url), _do(utxo_url))
        balance = None
        try:
            if isinstance(bal_j, dict) and "balance" in bal_j:
                val = float(bal_j["balance"])
                balance = val if val < 1000 else val / SATOSHI
        except Exception:
            pass
        utxo_count = len(utxo_j) if isinstance(utxo_j, list) else 0
        return {"address": address, "balance": balance, "utxo_count": utxo_count}
