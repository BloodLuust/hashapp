from typing import Optional
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
    _client = AsyncIOMotorClient(settings.MONGO_URI)
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
    # Users: unique email
    await _db.users.create_index("email", unique=True)
    # Scans: user_id + created_at for listing
    await _db.scans.create_index([("user_id", 1), ("created_at", -1)])

