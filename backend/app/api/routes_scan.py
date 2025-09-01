import asyncio
import time
import uuid
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..db.client import get_db
from ..models.scan import ScanRequest
from .routes_auth import get_current_user
from ..services.blockchain import get_scanner


router = APIRouter()
ws_router = APIRouter()


async def _run_scan_job(db: AsyncIOMotorDatabase, job_id: str):
    await db.scans.update_one({"_id": job_id}, {"$set": {"status": "running", "started_at": time.time(), "progress": 5}})
    job = await db.scans.find_one({"_id": job_id})
    kind = job.get("kind")
    chain = job.get("chain")
    inp = job.get("input")
    # autodetect simple cases
    if not chain or chain == "auto":
        if kind == "xpub":
            chain = "bitcoin"
        elif isinstance(inp, str) and inp.startswith("0x") and len(inp) == 42:
            chain = "ethereum"
        else:
            chain = "bitcoin"
        await db.scans.update_one({"_id": job_id}, {"$set": {"chain": chain}})

    await db.scans.update_one({"_id": job_id}, {"$push": {"logs": f"Chain resolved: {chain}"}, "$set": {"progress": 15}})

    # If user selected 'address' but provided an extended public key, switch to xpub scan automatically
    def _looks_like_xpub(s: str) -> bool:
        if not isinstance(s, str) or len(s) < 4:
            return False
        p = s[:4].lower()
        # Mainnet only: accept xpub/ypub/zpub; explicitly exclude testnet
        return p in {"xpub", "ypub", "zpub"}

    if kind == "address" and isinstance(inp, str) and _looks_like_xpub(inp):
        kind = "xpub"
        await db.scans.update_one({"_id": job_id}, {"$push": {"logs": "Detected extended key; switching to xpub scan"}, "$set": {"kind": "xpub"}})

    # Guard: Ethereum doesn't support xpubs
    if (chain or "").lower() in {"ethereum", "eth"} and kind == "xpub":
        await db.scans.update_one({"_id": job_id}, {"$set": {"status": "error", "error": "Ethereum does not support xpub", "progress": 100, "completed_at": time.time()}})
        return

    scanner = get_scanner(chain)
    if not scanner:
        await db.scans.update_one({"_id": job_id}, {"$set": {"status": "error", "error": f"Unsupported chain: {chain}", "progress": 100, "completed_at": time.time()}})
        return

    try:
        await db.scans.update_one({"_id": job_id}, {"$push": {"logs": "Fetching data from provider"}, "$set": {"progress": 40}})
        compare = bool(job.get("compare_providers") or job.get("compare"))
        # Fallback: for BTC xpubs, if compare not requested but TATUM_API_KEY is set,
        # enable compare to probe derived addresses cheaply via Tatum.
        if (chain or "").lower() in {"bitcoin", "btc"} and kind == "xpub" and not compare:
            try:
                from ..core.config import settings as _settings
                if _settings.TATUM_API_KEY:
                    compare = True
            except Exception:
                pass
        original_input = inp
        normalized_info = None
        if kind == "address":
            results = await scanner.scan_address(inp, compare_providers=compare)
        else:
            # Normalize ypub/zpub to xpub and reject testnet keys
            try:
                from ..services.extkeys import convert_to_xpub, is_testnet_extkey
                if is_testnet_extkey(inp):
                    raise HTTPException(status_code=400, detail="Testnet extended keys are not supported")
                normalized = convert_to_xpub(inp)
                if normalized != inp:
                    normalized_info = {
                        "original": inp,
                        "original_prefix": inp[:4],
                        "normalized_xpub": normalized,
                    }
                    # For normalized ypub/zpub on Bitcoin, force provider compare if available
                    try:
                        if (chain or "").lower() in {"bitcoin", "btc"}:
                            from ..core.config import settings as _settings
                            if _settings.TATUM_API_KEY:
                                compare = True
                    except Exception:
                        pass
            except Exception as _e:
                # If it already is a valid xpub, pass through; else raise
                if not inp.startswith("xpub"):
                    raise HTTPException(status_code=400, detail=f"Invalid/unsupported extended key: {str(_e)}")
                normalized = inp
            results = await scanner.scan_xpub(normalized, compare_providers=compare)
            if isinstance(results, dict) and normalized_info:
                results.setdefault("meta", {}).update({"xpub_normalization": normalized_info})
        await db.scans.update_one({"_id": job_id}, {"$push": {"logs": "Aggregating results"}, "$set": {"progress": 80}})
        await asyncio.sleep(0.1)
        await db.scans.update_one({"_id": job_id}, {"$set": {"results": results, "progress": 100, "status": "completed", "completed_at": time.time()}})
    except Exception as e:
        # Surface error to logs for easier debugging via UI
        await db.scans.update_one(
            {"_id": job_id},
            {"$push": {"logs": f"Error: {str(e)}"},
             "$set": {"status": "error", "error": str(e), "progress": 100, "completed_at": time.time()}},
        )
        # Also log server-side
        import logging as _logging
        _logging.getLogger("uvicorn").exception("Scan job %s failed: %s", job_id, e)


@router.post("")
async def create_scan(req: ScanRequest, db: AsyncIOMotorDatabase = Depends(get_db), user = Depends(get_current_user)):
    job_id = uuid.uuid4().hex
    doc = {
        "_id": job_id,
        "user_id": user["_id"],
        "status": "pending",
        "progress": 0,
        "logs": [],
        "kind": req.kind,
        "input": req.input,
        "chain": req.chain,
        "compare_providers": bool(getattr(req, 'compare_providers', False)),
        "created_at": time.time(),
    }
    await db.scans.insert_one(doc)
    asyncio.create_task(_run_scan_job(db, job_id))
    return {"id": job_id, "status": "pending"}


@router.get("")
async def list_scans(db: AsyncIOMotorDatabase = Depends(get_db), user = Depends(get_current_user)):
    cursor = db.scans.find({"user_id": user["_id"]}).sort("created_at", -1).limit(100)
    items = []
    async for job in cursor:
        items.append({
            "id": job["_id"],
            "status": job["status"],
            "progress": job.get("progress", 0),
            "kind": job.get("kind"),
            "input": job.get("input"),
            "chain": job.get("chain"),
            "created_at": job.get("created_at"),
        })
    return items


@router.get("/{job_id}/status")
async def scan_status(job_id: str, db: AsyncIOMotorDatabase = Depends(get_db), user = Depends(get_current_user)):
    job = await db.scans.find_one({"_id": job_id, "user_id": user["_id"]})
    if not job:
        raise HTTPException(status_code=404, detail="Scan not found")
    return {
        "id": job_id,
        "status": job["status"],
        "progress": job.get("progress", 0),
        "logs": (job.get("logs") or [])[-10:],
    }


@router.get("/{job_id}/results")
async def scan_results(job_id: str, db: AsyncIOMotorDatabase = Depends(get_db), user = Depends(get_current_user)):
    job = await db.scans.find_one({"_id": job_id, "user_id": user["_id"]})
    if not job:
        raise HTTPException(status_code=404, detail="Scan not found")
    if job.get("status") != "completed":
        raise HTTPException(status_code=202, detail="Scan not completed")
    return job.get("results", {})


@ws_router.websocket("/ws/scan/{job_id}")
async def ws_scan(ws: WebSocket, job_id: str):
    await ws.accept()
    try:
        # For demo, skip auth in WS; production should validate cookie/token
        from ..db.client import get_db as _get_db
        db = _get_db()
        # Periodically poll DB and push status
        while True:
            job = await db.scans.find_one({"_id": job_id})
            if not job:
                await ws.send_json({"error": "not_found"})
                break
            payload = {
                "id": job_id,
                "status": job.get("status"),
                "progress": job.get("progress", 0),
                "logs": (job.get("logs") or [])[-5:],
            }
            await ws.send_json(payload)
            if job.get("status") in {"completed", "error"}:
                break
            await asyncio.sleep(0.6)
    except WebSocketDisconnect:
        return
