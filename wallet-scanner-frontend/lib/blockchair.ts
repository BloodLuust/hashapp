export type AddressInfo = {
  address: string
  balance: number
  transaction_count: number
  received?: number
  spent?: number
  utxo?: any[]
  path?: string
  chain?: 'external'|'change'
}

const BASE = 'https://api.blockchair.com/bitcoin'

export async function fetchAddresses(addrs: string[], apiKey?: string): Promise<Record<string, AddressInfo>> {
  const maxChunk = 100
  const acc: Record<string, AddressInfo> = {}
  for (let i = 0; i < addrs.length; i += maxChunk) {
    const chunk = addrs.slice(i, i + maxChunk)
    const url = new URL(`${BASE}/dashboards/addresses/${chunk.join(',')}`)
    if (apiKey) url.searchParams.set('key', apiKey)
    url.searchParams.set('limit', '0')
    const r = await fetch(url.toString())
    if (!r.ok) throw new Error(`blockchair ${r.status}`)
    const j = await r.json()
    const data = j?.data || {}
    for (const k of Object.keys(data)) {
      const ai = data[k]
      const s = ai?.address || {}
      const utxo = ai?.utxo || []
      acc[k] = {
        address: k,
        balance: Number(s.balance || 0),
        transaction_count: Number(s.transaction_count || 0),
        received: Number(s.received || 0),
        spent: Number(s.spent || 0),
        utxo,
      }
    }
  }
  return acc
}

// Prefer using Blockchair's HD xpub dashboard which performs discovery with a 20-address gap
// and supports up to 250 main + 250 change addresses on free tier.
export async function fetchXpubDashboard(xpub: string, opts?: { apiKey?: string; limitMain?: number; limitChange?: number }): Promise<{ addresses: AddressInfo[]; meta?: any }> {
  const apiKey = opts?.apiKey
  const limitMain = Math.max(1, Math.min(10000, opts?.limitMain ?? 250))
  // Blockchair uses the same limit for both main/change; expose limitChange for future use
  const url = new URL(`${BASE}/dashboards/xpub/${xpub}`)
  if (apiKey) url.searchParams.set('key', apiKey)
  url.searchParams.set('limit', String(limitMain))
  const r = await fetch(url.toString())
  if (!r.ok) throw new Error(`blockchair xpub ${r.status}`)
  const j = await r.json()
  // Response shape: { data: { [xpub]: { addresses: [...], ... } }, context: {...} }
  const entry = j?.data?.[xpub] || j?.data || {}
  const list: any[] = entry.addresses || []
  const out: AddressInfo[] = list.map((it: any) => {
    const address = it.address || it?.address?.address || ''
    const balance = Number(it.balance ?? it?.address?.balance ?? 0)
    const transaction_count = Number(it.transaction_count ?? it?.address?.transaction_count ?? 0)
    const path = String(it.path ?? it?.address?.path ?? '')
    const chain = path.startsWith('0/') ? 'external' : path.startsWith('1/') ? 'change' : undefined
    return { address, balance, transaction_count, received: Number(it.received || 0), spent: Number(it.spent || 0), utxo: it.utxo || [], path, chain: chain as any }
  })
  return { addresses: out, meta: j?.context }
}
