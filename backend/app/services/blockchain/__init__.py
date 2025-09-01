from typing import Optional
from .base import BaseScanner
from .bitcoin import BitcoinScanner
from .ethereum import EthereumScanner


def get_scanner(chain: Optional[str]):
    key = (chain or "").lower() if chain else None
    if key in {None, "", "auto"}:
        return None
    if key in {"bitcoin", "btc"}:
        return BitcoinScanner(network="bitcoin")
    if key in {"bitcoin-testnet", "btc-testnet", "testnet"}:
        return BitcoinScanner(network="bitcoin-testnet")
    if key in {"ethereum", "eth"}:
        return EthereumScanner(network="ethereum")
    return None
