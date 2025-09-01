from pydantic import BaseModel, Field
from typing import Literal, Optional, List, Any


class ScanRequest(BaseModel):
    kind: Literal["address", "xpub"] = Field(description="Single address or extended public key")
    input: str = Field(min_length=4, description="Address or xpub/ypub/zpub/tpub")
    chain: Optional[str] = Field(default=None, description="Chain, e.g. 'bitcoin', 'ethereum'")


class ScanStatus(BaseModel):
    id: str
    status: Literal["pending", "running", "completed", "error"]
    progress: int = 0
    logs: Optional[List[str]] = None


class ScanResults(BaseModel):
    summary: dict[str, Any] | None = None
    tx_volume_over_time: list[dict[str, Any]] | None = None
    balance_over_time: list[dict[str, Any]] | None = None

