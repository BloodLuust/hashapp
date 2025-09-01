from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from .routes_auth import get_current_user
from ..services.derivation import snapshot_from_hex


router = APIRouter()


class DeriveFromHexRequest(BaseModel):
    hex: str = Field(..., description="Hex seed (<=64 chars). Left-padded to 64.")


@router.post("/derive/from-hex")
async def derive_from_hex(req: DeriveFromHexRequest, user = Depends(get_current_user)):
    try:
        snap = snapshot_from_hex(req.hex)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return snap

