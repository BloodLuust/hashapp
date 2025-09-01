from __future__ import annotations

import hashlib
from typing import Dict, Tuple

from ecdsa import SECP256k1, SigningKey

from .extkeys import PREFIXES, _b58encode as b58encode, _double_sha256 as dsha256


SECP256K1_N = int(
    "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141", 16
)


def is_valid_privkey_int(k: int) -> bool:
    return 1 <= k < SECP256K1_N


def normalize_hex64(h: str) -> str:
    s = h.lower().strip()
    if s.startswith("0x"):
        s = s[2:]
    # left-pad with zeros to 64 chars
    if any(c not in "0123456789abcdef" for c in s):
        raise ValueError("invalid hex characters")
    if len(s) > 64:
        raise ValueError("hex longer than 64 chars")
    return s.rjust(64, "0")


def privkey_bytes_from_hex64(h64: str) -> bytes:
    k = int(h64, 16)
    if not is_valid_privkey_int(k):
        raise ValueError("invalid private key range for secp256k1")
    return k.to_bytes(32, "big")


def _pubkey_compressed_from_priv(priv: bytes) -> bytes:
    sk = SigningKey.from_string(priv, curve=SECP256k1)
    vk = sk.verifying_key
    # compressed encoding
    x = vk.pubkey.point.x()
    y = vk.pubkey.point.y()
    prefix = 0x02 | (y & 1)
    return bytes([prefix]) + x.to_bytes(32, "big")


def _pubkey_uncompressed_from_priv(priv: bytes) -> bytes:
    sk = SigningKey.from_string(priv, curve=SECP256k1)
    vk = sk.verifying_key
    x = vk.pubkey.point.x().to_bytes(32, "big")
    y = vk.pubkey.point.y().to_bytes(32, "big")
    return b"\x04" + x + y


def _fingerprint_from_pubkey_compressed(pub33: bytes) -> bytes:
    h160 = hashlib.new("ripemd160", hashlib.sha256(pub33).digest()).digest()
    return h160[:4]


def _serialize_ext_key(
    *,
    version: bytes,
    depth: int,
    parent_fpr: bytes,
    child_num: int,
    chain_code: bytes,
    key_data: bytes,
) -> str:
    assert len(version) == 4
    assert len(parent_fpr) == 4
    assert len(chain_code) == 32
    assert len(key_data) == 33
    body = (
        version
        + bytes([depth & 0xFF])
        + parent_fpr
        + child_num.to_bytes(4, "big")
        + chain_code
        + key_data
    )
    chk = dsha256(body)[:4]
    return b58encode(body + chk)


def master_extended_keys_from_hex(hex64: str) -> Dict[str, str]:
    """
    Build mainnet-only extended keys at depth=0 with dummy chain code (32x00).
    Returns {xprv,xpub, ypub,zpub} — y/z use swapped version bytes.
    """
    h64 = normalize_hex64(hex64)
    priv = privkey_bytes_from_hex64(h64)
    pub_c = _pubkey_compressed_from_priv(priv)
    chain = b"\x00" * 32
    depth = 0
    parent_fpr = b"\x00\x00\x00\x00"
    child = 0

    xprv_keydata = b"\x00" + priv
    xpub_keydata = pub_c

    xprv = _serialize_ext_key(
        version=PREFIXES["xprv"],
        depth=depth,
        parent_fpr=parent_fpr,
        child_num=child,
        chain_code=chain,
        key_data=xprv_keydata,
    )
    xpub = _serialize_ext_key(
        version=PREFIXES["xpub"],
        depth=depth,
        parent_fpr=parent_fpr,
        child_num=child,
        chain_code=chain,
        key_data=xpub_keydata,
    )
    ypub = _serialize_ext_key(
        version=PREFIXES["ypub"],
        depth=depth,
        parent_fpr=parent_fpr,
        child_num=child,
        chain_code=chain,
        key_data=xpub_keydata,
    )
    zpub = _serialize_ext_key(
        version=PREFIXES["zpub"],
        depth=depth,
        parent_fpr=parent_fpr,
        child_num=child,
        chain_code=chain,
        key_data=xpub_keydata,
    )
    return {"xprv": xprv, "xpub": xpub, "ypub": ypub, "zpub": zpub}


def btc_p2pkh_address_from_pubkey_compressed(pub33: bytes) -> str:
    h160 = hashlib.new("ripemd160", hashlib.sha256(pub33).digest()).digest()
    payload = b"\x00" + h160  # mainnet P2PKH version
    chk = dsha256(payload)[:4]
    return b58encode(payload + chk)


def eth_address_from_priv(priv: bytes) -> str:
    # keccak-256 over uncompressed pubkey (skip 0x04 prefix), take last 20 bytes
    try:
        from Crypto.Hash import keccak  # pycryptodome
    except Exception as e:
        raise RuntimeError("pycryptodome is required for keccak") from e
    pub = _pubkey_uncompressed_from_priv(priv)[1:]
    k = keccak.new(digest_bits=256)
    k.update(pub)
    addr = k.digest()[-20:]
    # EIP-55 checksum
    hex_addr = addr.hex()
    k2 = keccak.new(digest_bits=256)
    k2.update(hex_addr.encode())
    hash_hex = k2.hexdigest()
    checksummed = "".join(
        (c.upper() if int(hash_hex[i], 16) >= 8 else c)
        for i, c in enumerate(hex_addr)
    )
    return "0x" + checksummed


def snapshot_from_hex(hex64: str) -> Dict[str, str]:
    h64 = normalize_hex64(hex64)
    priv = privkey_bytes_from_hex64(h64)
    pub_c = _pubkey_compressed_from_priv(priv)
    xkeys = master_extended_keys_from_hex(h64)
    btc_addr = btc_p2pkh_address_from_pubkey_compressed(pub_c)
    eth_addr = eth_address_from_priv(priv)
    out = {
        **xkeys,
        "btc_address": btc_addr,
        "eth_address": eth_addr,
    }
    return out

