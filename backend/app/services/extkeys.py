import hashlib
from typing import Tuple


# Mainnet-only extended key version bytes (big-endian hex)
PREFIXES = {
    "xprv": bytes.fromhex("0488ADE4"),
    "xpub": bytes.fromhex("0488B21E"),
    "yprv": bytes.fromhex("049D7878"),
    "ypub": bytes.fromhex("049D7CB2"),
    "zprv": bytes.fromhex("04B2430C"),
    "zpub": bytes.fromhex("04B24746"),
}

TESTNET_PREFIXES = {
    # Intentionally unsupported in this app (mainnet-only)
    b"tprv",
    b"tpub",
    b"uprv",
    b"upub",
    b"vprv",
    b"vpub",
}


_B58_ALPH = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def _b58decode(s: str) -> bytes:
    data = s.encode()
    n = 0
    for c in data:
        n *= 58
        if c not in _B58_ALPH:
            raise ValueError("Invalid base58 character")
        n += _B58_ALPH.index(c)
    # Convert to bytes
    full = n.to_bytes((n.bit_length() + 7) // 8, "big") if n else b""
    # Add leading zeros
    pad = 0
    for c in data:
        if c == _B58_ALPH[0]:
            pad += 1
        else:
            break
    return b"\x00" * pad + full


def _b58encode(b: bytes) -> str:
    # Count leading zeros
    pad = 0
    for c in b:
        if c == 0:
            pad += 1
        else:
            break
    n = int.from_bytes(b, "big")
    out = bytearray()
    while n > 0:
        n, rem = divmod(n, 58)
        out.append(_B58_ALPH[rem])
    out = bytes(reversed(out))
    return (b"1" * pad + out).decode()


def _double_sha256(b: bytes) -> bytes:
    return hashlib.sha256(hashlib.sha256(b).digest()).digest()


def detect_prefix(s: str) -> bytes:
    p = s[:4].encode()
    return p


def is_testnet_extkey(s: str) -> bool:
    return detect_prefix(s) in TESTNET_PREFIXES


def _swap_version(ext: str, new_ver: bytes) -> str:
    raw = _b58decode(ext)
    if len(raw) < 4 + 74:  # version + payload + checksum (~78+ bytes total)
        raise ValueError("Invalid extended key length")
    payload = raw[4:-4]
    body = new_ver + payload
    chk = _double_sha256(body)[:4]
    return _b58encode(body + chk)


def convert_to_xpub(ext_pub: str) -> str:
    """
    Normalize ypub/zpub to xpub by swapping version bytes.
    Reject testnet prefixes.
    """
    pref = detect_prefix(ext_pub)
    if pref in TESTNET_PREFIXES:
        raise ValueError("Testnet extended keys are not supported")
    if ext_pub.startswith("xpub"):
        return ext_pub
    if ext_pub.startswith("ypub") or ext_pub.startswith("zpub"):
        return _swap_version(ext_pub, PREFIXES["xpub"])
    raise ValueError("Unsupported extended public key prefix; expected xpub/ypub/zpub")


def looks_like_mainnet_xpub_family(s: str) -> bool:
    return s.startswith(("xpub", "ypub", "zpub"))

