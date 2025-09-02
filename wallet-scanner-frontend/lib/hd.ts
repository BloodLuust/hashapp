import * as bs58check from 'bs58check'
import { BIP32Interface, fromSeed as bip32fromSeed } from 'bip32'
import * as bitcoin from 'bitcoinjs-lib'

// Version bytes for xprv/xpub, yprv/ypub, zprv/zpub (Bitcoin mainnet)
const VERS = {
  xprv: 0x0488ade4,
  xpub: 0x0488b21e,
  yprv: 0x049d7878,
  ypub: 0x049d7cb2,
  zprv: 0x04b2430c,
  zpub: 0x04b24746,
}

function setVersion(data: Buffer, version: number): Buffer {
  const out = Buffer.from(data)
  out.writeUInt32BE(version, 0)
  return out
}

function toVersion(xpubOrPrvBase58: string, targetVersion: number): string {
  const data = bs58check.decode(xpubOrPrvBase58)
  const converted = setVersion(data, targetVersion)
  return bs58check.encode(converted)
}

export type ExpandedKeys = {
  seedHex: string
  xprv: string
  xpub: string
  yprv: string
  ypub: string
  zprv: string
  zpub: string
}

export function hexToSeed(hex: string): Buffer {
  // Interpret provided 32-byte hex as entropy to feed directly as BIP32 seed.
  // For production, you might want to use BIP39 to generate a 512-bit seed from a mnemonic.
  const b = Buffer.from(hex, 'hex')
  if (b.length < 16 || b.length > 64) throw new Error('seed hex must be 16..64 bytes')
  return b
}

export function masterFromSeed(seed: Buffer): BIP32Interface {
  return bip32fromSeed(seed, bitcoin.networks.bitcoin)
}

export function expandMaster(seedHex: string): ExpandedKeys {
  const seed = hexToSeed(seedHex)
  const node = masterFromSeed(seed)
  const xprv = node.toBase58()
  const xpub = node.neutered().toBase58()
  const yprv = toVersion(xprv, VERS.yprv)
  const ypub = toVersion(xpub, VERS.ypub)
  const zprv = toVersion(xprv, VERS.zprv)
  const zpub = toVersion(xpub, VERS.zpub)
  return { seedHex: seedHex.toLowerCase(), xprv, xpub, yprv, ypub, zprv, zpub }
}

export function rootFingerprintHex(seedHex: string): string {
  const seed = hexToSeed(seedHex)
  const node = masterFromSeed(seed)
  const fp = bitcoin.crypto.hash160(node.publicKey).slice(0, 4)
  return fp.toString('hex')
}

export type DerivationType = 'bip44'|'bip49'|'bip84'

export function deriveAccount(node: BIP32Interface, type: DerivationType, account = 0): BIP32Interface {
  const purpose = type === 'bip44' ? 44 : type === 'bip49' ? 49 : 84
  // Bitcoin mainnet coin type 0, external chain 0
  return node.deriveHardened(purpose).deriveHardened(0).deriveHardened(account)
}

export function deriveExternal(accountNode: BIP32Interface): BIP32Interface { return accountNode.derive(0) }
export function deriveChange(accountNode: BIP32Interface): BIP32Interface { return accountNode.derive(1) }

export function addressFromPubkey(type: DerivationType, pubkey: Buffer): string {
  const { payments, networks } = bitcoin
  if (type === 'bip44') {
    return payments.p2pkh({ pubkey, network: networks.bitcoin })!.address!
  }
  if (type === 'bip49') {
    const p2wpkh = payments.p2wpkh({ pubkey, network: networks.bitcoin })
    return payments.p2sh({ redeem: p2wpkh, network: networks.bitcoin })!.address!
  }
  // bip84 native segwit
  return payments.p2wpkh({ pubkey, network: networks.bitcoin })!.address!
}

export function xpubFromAccount(node: BIP32Interface, type: DerivationType): string {
  const base = node.neutered().toBase58()
  if (type === 'bip44') return toVersion(base, VERS.xpub)
  if (type === 'bip49') return toVersion(base, VERS.ypub)
  return toVersion(base, VERS.zpub)
}

export function convertYpubZpubToXpub(extended: string): string {
  // Detect by prefix
  if (extended.startsWith('ypub')) return toVersion(extended, VERS.xpub)
  if (extended.startsWith('zpub')) return toVersion(extended, VERS.xpub)
  return extended
}

export function deriveAddresses(seedHex: string, depth = 100) {
  const seed = hexToSeed(seedHex)
  const master = masterFromSeed(seed)
  const out: { type: DerivationType; xpub: string; addrs: string[]; change: string[] }[] = []
  ;(['bip44','bip49','bip84'] as DerivationType[]).forEach((t) => {
    const acct = deriveAccount(master, t, 0)
    const ext = deriveExternal(acct)
    const chg = deriveChange(acct)
    const xpub = xpubFromAccount(acct, t)
    const addrs: string[] = []
    const change: string[] = []
    for (let i = 0; i < depth; i++) {
      const child = ext.derive(i)
      const addr = addressFromPubkey(t, child.publicKey)
      addrs.push(addr)
      const cchild = chg.derive(i)
      change.push(addressFromPubkey(t, cchild.publicKey))
    }
    out.push({ type: t, xpub, addrs, change })
  })
  return out
}
