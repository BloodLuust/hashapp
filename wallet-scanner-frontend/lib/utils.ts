export type HexGenRequest = {
  count?: number
  length?: number
  min_hex?: string
  max_hex?: string
  randomize?: boolean
  unique?: boolean
  prefix_0x?: boolean
}

export type HexGenResponse = {
  count: number
  items: string[]
  truncated: boolean
}

export async function generateHex(req: HexGenRequest): Promise<HexGenResponse> {
  const r = await fetch('/api/utils/hex', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(req),
  })
  if (!r.ok) throw new Error(`hex generate failed: ${r.status}`)
  return r.json()
}

export async function deriveFromHex(hex: string): Promise<{ xpub: string; xprv: string; ypub: string; zpub: string; btc_address: string; eth_address: string }>{
  const r = await fetch('/api/utils/derive', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ hex }),
  })
  if (!r.ok) throw new Error(`derive failed: ${r.status}`)
  return r.json()
}

