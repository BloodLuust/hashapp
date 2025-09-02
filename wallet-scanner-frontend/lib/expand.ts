import { expandMaster, deriveAddresses, convertYpubZpubToXpub, rootFingerprintHex } from '@/lib/hd'
import type { ResultDoc, DerivationResult, AddressEntry } from '@/lib/types'
import { fetchAddresses, fetchXpubDashboard } from '@/lib/blockchair'

export type ExpandSummary = {
  xprv: string; yprv: string; zprv: string;
  xpub: string; ypub: string; zpub: string;
  totals: { addresses_scanned: number; with_activity: number; balance_sats: number }
  positives: any[]
}

export async function expandHex(hex: string, depth: number, blockchairKey?: string, mode: 'xpub'|'address' = (process.env.BLOCKCHAIR_USE_XPUB === '1' ? 'xpub' : 'address')): Promise<ExpandSummary> {
  const keys = expandMaster(hex)

  if (mode === 'xpub') {
    // Prefer Blockchair HD discovery; convert ypub/zpub to xpub
    const xpubs = [convertYpubZpubToXpub(keys.xpub), convertYpubZpubToXpub(keys.ypub), convertYpubZpubToXpub(keys.zpub)]
    const allAddresses: any[] = []
    for (const xp of xpubs) {
      try {
        const { addresses } = await fetchXpubDashboard(xp, { apiKey: blockchairKey, limitMain: Math.min(10000, Math.max(1, depth)) })
        allAddresses.push(...addresses)
      } catch {}
    }
    const positives = allAddresses.filter((a: any) => (a.transaction_count || 0) > 0)
    return {
      xprv: keys.xprv, yprv: keys.yprv, zprv: keys.zprv,
      xpub: keys.xpub, ypub: keys.ypub, zpub: keys.zpub,
      totals: {
        addresses_scanned: allAddresses.length,
        with_activity: positives.length,
        balance_sats: positives.reduce((s: number, a: any) => s + (a.balance || 0), 0),
      },
      positives,
    }
  }

  // Manual address derivation mode (bypasses gap limit), scans both external/change
  const deriv = deriveAddresses(hex, depth)
  const addrAll = deriv.flatMap(d => [...d.addrs, ...d.change])
  let addrInfo: Record<string, any> = {}
  try {
    addrInfo = await fetchAddresses(addrAll, blockchairKey)
  } catch {}
  const positives = Object.values(addrInfo).filter((a: any) => (a.transaction_count || 0) > 0)
  return {
    xprv: keys.xprv, yprv: keys.yprv, zprv: keys.zprv,
    xpub: keys.xpub, ypub: keys.ypub, zpub: keys.zpub,
    totals: {
      addresses_scanned: addrAll.length,
      with_activity: positives.length,
      balance_sats: positives.reduce((s: number, a: any) => s + (a.balance || 0), 0),
    },
    positives,
  }
}

// Build structured result document matching the requested schema shape
export async function expandHexStructured(hex: string, depth: number, blockchairKey?: string, mode: 'xpub'|'address' = (process.env.BLOCKCHAIR_USE_XPUB === '1' ? 'xpub' : 'address')): Promise<ResultDoc> {
  const keys = expandMaster(hex)
  const root_fingerprint = rootFingerprintHex(hex)

  // Manual address derivation for external chain only: m/..../0/i
  const deriv = deriveAddresses(hex, depth)

  // Map types to schema buckets
  const bucket = (t: string): { key: keyof NonNullable<ResultDoc['results']['bitcoin']>; accountPath: string } => {
    switch (t) {
      case 'bip44': return { key: 'p2pkh', accountPath: "m/44'/0'/0'" }
      case 'bip49': return { key: 'p2sh_p2wpkh', accountPath: "m/49'/0'/0'" }
      case 'bip84': return { key: 'p2wpkh', accountPath: "m/84'/0'/0'" }
      default: return { key: 'p2pkh', accountPath: "m/44'/0'/0'" }
    }
  }

  // Gather address list and fetch Blockchair summaries in one batch
  const addrAll: string[] = []
  const layouts: Record<string, { type: string; basePath: string; addresses: AddressEntry[] }> = {}
  deriv.forEach((d: any) => {
    const { key, accountPath } = bucket(d.type)
    const list: AddressEntry[] = []
    for (let i = 0; i < d.addrs.length; i++) {
      const address = d.addrs[i]
      list.push({ index: i, address, derivationPath: `${accountPath}/0/${i}` })
      addrAll.push(address)
    }
    layouts[key] = { type: d.type, basePath: accountPath, addresses: list }
  })

  // Try Blockchair address info (best-effort)
  let addrInfo: Record<string, any> = {}
  try {
    const { fetchAddresses } = await import('@/lib/blockchair')
    addrInfo = await fetchAddresses(addrAll, blockchairKey)
  } catch {}

  // Enrich entries and summarize active indices
  const btc: NonNullable<ResultDoc['results']['bitcoin']> = {}
  ;(Object.keys(layouts) as (keyof typeof layouts)[]).forEach((k) => {
    const { basePath, addresses } = layouts[k]
    const enriched: AddressEntry[] = addresses.map((e) => {
      const info = addrInfo[e.address] || {}
      const txc = typeof info.transaction_count === 'number' ? info.transaction_count : (parseInt(info.transaction_count || '0', 10) || 0)
      return {
        ...e,
        tx_count: txc,
        api: { blockchair: info },
      }
    })
    const active = enriched.filter(a => (a.tx_count || 0) > 0).map(a => a.index)
    const dr: DerivationResult = { accountPath: basePath, addresses: enriched, active_indices: active }
    ;(btc as any)[k] = dr
  })

  const doc: ResultDoc = {
    source: 'random',
    input: { private_key_hex: '0x' + hex.toLowerCase() },
    bip39: { mnemonic: null, seed_hex: null, note: 'BIP39 seed not recoverable from raw private key' },
    extended_keys: {
      xprv: keys.xprv, xpub: keys.xpub, yprv: keys.yprv, ypub: keys.ypub, zprv: keys.zprv, zpub: keys.zpub,
      root_fingerprint,
    },
    results: { bitcoin: btc },
  }
  return doc
}
