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

    scanner = get_scanner(chain)
    if not scanner:
        await db.scans.update_one({"_id": job_id}, {"$set": {"status": "error", "error": f"Unsupported chain: {chain}", "progress": 100, "completed_at": time.time()}})
        return

    try:
        await db.scans.update_one({"_id": job_id}, {"$push": {"logs": "Fetching data from provider"}, "$set": {"progress": 40}})
        if kind == "address":
            results = await scanner.scan_address(inp)
        else:
            results = await scanner.scan_xpub(inp)
        await db.scans.update_one({"_id": job_id}, {"$push": {"logs": "Aggregating results"}, "$set": {"progress": 80}})
        await asyncio.sleep(0.1)
        await db.scans.update_one({"_id": job_id}, {"$set": {"results": results, "progress": 100, "status": "completed", "completed_at": time.time()}})
    except Exception as e:
        await db.scans.update_one({"_id": job_id}, {"$set": {"status": "error", "error": str(e), "progress": 100, "completed_at": time.time()}})


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
