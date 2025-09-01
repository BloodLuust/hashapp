from pydantic import BaseModel, Field
from typing import Literal, Optional, List, Any


class ScanRequest(BaseModel):
    kind: Literal["address", "xpub"] = Field(description="Single address or extended public key")
    input: str = Field(min_length=4, description="Address or xpub/ypub/zpub/tpub")
    chain: Optional[str] = Field(default=None, description="Chain, e.g. 'bitcoin', 'ethereum'")
    compare_providers: Optional[bool] = Field(default=False, description="Fetch from multiple providers when available")


class ScanStatus(BaseModel):
    id: str
    status: Literal["pending", "running", "completed", "error"]
    progress: int = 0
    logs: Optional[List[str]] = None


class ScanResults(BaseModel):
    summary: dict[str, Any] | None = None
    tx_volume_over_time: list[dict[str, Any]] | None = None
    balance_over_time: list[dict[str, Any]] | None = None


class StartScanRequest(BaseModel):
    mode: Literal["random", "range", "specific"] = Field(description="Source of keys to scan")
    # Range mode
    min_hex: Optional[str] = Field(default=None, description="Inclusive start hex")
    max_hex: Optional[str] = Field(default=None, description="Inclusive end hex")
    randomize: bool = Field(default=True, description="Randomize within range for seed selection")
    # Specific mode
    input: Optional[str] = Field(default=None, description="Specific 64-hex, address, or extended key")
    # Common
    chains: Optional[List[str]] = Field(default=None, description="Chains to target; default ['bitcoin']")
    perPath: Optional[int] = Field(default=None, description="Children per derivation path (future use)")
    maxKeys: Optional[int] = Field(default=1, description="How many seeds to start (MVP uses first only)")
    seedConcurrency: Optional[int] = Field(default=None, description="Parallel seed workers (future use)")
