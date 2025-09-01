from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .db.client import init_db, close_db, create_indexes
from .core.http_client import init_http_client, close_http_client
from .core.cache import init_cache, close_cache
from .api.routes_auth import router as auth_router
from .api.routes_scan import router as scan_router, ws_router as scan_ws_router


logger = logging.getLogger("uvicorn")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db(settings)
    await create_indexes()
    await init_http_client()
    await init_cache()
    yield
    await close_cache()
    await close_http_client()
    await close_db()


app = FastAPI(lifespan=lifespan)

# CORS for local dev; tighten for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # consider restricting to frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


# Routers
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(scan_router, prefix="/scan", tags=["scan"])
app.include_router(scan_ws_router)
