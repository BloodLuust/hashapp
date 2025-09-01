from typing import Optional
import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from ..core.config import Settings


_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


async def init_db(settings: Settings):
    global _client, _db
    if not settings.MONGO_URI:
        # Allow app to start but raise if DB is accessed
        _client = None
        _db = None
        return
    uri = settings.MONGO_URI
    # Support placeholder substitution for local .env convenience
    # e.g., MONGO_URI=mongodb+srv://user:<ENCODED_PASSWORD>@cluster.mongodb.net
    if "<ENCODED_PASSWORD>" in uri or "${ENCODED_PASSWORD}" in uri:
        pw = os.getenv("ENCODED_PASSWORD")
        if pw:
            uri = uri.replace("<ENCODED_PASSWORD>", pw).replace("${ENCODED_PASSWORD}", pw)
    _client = AsyncIOMotorClient(uri)
    _db = _client[settings.MONGO_DB]


async def close_db():
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Database not configured; set MONGO_URI")
    return _db


async def create_indexes():
    """Create necessary DB indexes (idempotent)."""
    if _db is None:
        return
    try:
        # Users: unique email
        await _db.users.create_index("email", unique=True)
        # Scans: user_id + created_at for listing
        await _db.scans.create_index([("user_id", 1), ("created_at", -1)])
    except Exception as e:  # tolerate startup without a working DB
        # Avoid crashing app startup if MONGO_URI is misconfigured or unavailable.
        # Routes that depend on DB will error at call-time instead.
        print(f"[startup] Skipping index creation due to DB error: {e}")
