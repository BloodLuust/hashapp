from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
import secrets

from ..core.config import settings
from .routes_auth import get_current_user  # reuse auth dependency; adjust if anonymous allowed later


router = APIRouter()


class HexGenerateRequest(BaseModel):
    count: int = Field(100, ge=1, description="How many hex values to generate")
    length: Optional[int] = Field(
        64,
        description="Hex length (characters). Used when min_hex/max_hex not provided. Must be even.",
    )
    min_hex: Optional[str] = Field(None, description="Minimum hex value (inclusive). Accepts optional 0x prefix.")
    max_hex: Optional[str] = Field(None, description="Maximum hex value (inclusive). Accepts optional 0x prefix.")
    randomize: bool = Field(True, description="Randomize order / selection within range")
    unique: bool = Field(True, description="Ensure results are unique (ignored if length-only and count is large)")
    prefix_0x: bool = Field(False, description="If true, prefix values with 0x")


class HexGenerateResponse(BaseModel):
    count: int
    items: List[str]
    truncated: bool = False


def _parse_hex(s: str) -> int:
    s = s.lower().strip()
    if s.startswith("0x"):
        s = s[2:]
    if any(c not in "0123456789abcdef" for c in s):
        raise ValueError("Invalid hex string")
    return int(s, 16)


@router.post("/hex/generate", response_model=HexGenerateResponse)
async def generate_hex(req: HexGenerateRequest, user = Depends(get_current_user)):
    # Enforce global cap
    cap = max(1, int(settings.HEX_QUEUE_MAX))
    if req.count > cap:
        req.count = cap

    # Determine mode: range-based vs length-only
    have_range = req.min_hex is not None and req.max_hex is not None
    items: list[str] = []

    if have_range:
        try:
            lo = _parse_hex(req.min_hex or "0")
            hi = _parse_hex(req.max_hex or "0")
        except ValueError:
            raise HTTPException(status_code=400, detail="min_hex/max_hex must be valid hex")
        if lo > hi:
            raise HTTPException(status_code=400, detail="min_hex cannot be greater than max_hex")

        space = hi - lo + 1
        k = min(req.count, space)

        if req.randomize:
            # Sample without replacement if unique requested and feasible
            seen: set[int] = set()
            while len(items) < k:
                x = lo + secrets.randbelow(space)
                if not req.unique or x not in seen:
                    seen.add(x)
                    items.append(x.to_bytes((x.bit_length() + 7) // 8 or 1, "big").hex())
        else:
            # Sequential from lo upward
            for x in range(lo, lo + k):
                items.append(x.to_bytes((x.bit_length() + 7) // 8 or 1, "big").hex())

        truncated = (req.count < (hi - lo + 1))
    else:
        # Length-only random generation
        length = req.length if req.length is not None else 64
        if length % 2 != 0 or length <= 0:
            raise HTTPException(status_code=400, detail="length must be a positive even number")
        nbytes = length // 2
        if req.unique:
            # Best-effort uniqueness; may loop if count is large relative to space
            seen: set[str] = set()
            while len(items) < req.count:
                h = secrets.token_bytes(nbytes).hex()
                if h not in seen:
                    seen.add(h)
                    items.append(h)
        else:
            items = [secrets.token_bytes(nbytes).hex() for _ in range(req.count)]
        truncated = False

    if req.prefix_0x:
        items = ["0x" + x for x in items]

    return HexGenerateResponse(count=len(items), items=items, truncated=truncated)
