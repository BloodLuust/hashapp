export type ScanRequest = { kind: 'address' | 'xpub'; input: string; chain?: string; compare_providers?: boolean }
export type ScanCreated = { id: string; status: string }
export type ScanStatus = { id: string; status: string; progress: number; logs: string[] }

export async function startScan(body: ScanRequest): Promise<ScanCreated> {
  const r = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`Failed to start scan: ${r.status}`)
  return r.json()
}

export async function getScanStatus(id: string): Promise<ScanStatus> {
  const r = await fetch(`/api/scan/${id}/status`, { headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(`Failed to get status: ${r.status}`)
  return r.json()
}

export async function getScanResults<T = any>(id: string): Promise<T> {
  const r = await fetch(`/api/scan/${id}/results`, { headers: { accept: 'application/json' } })
  if (r.status === 202) throw new Error('Scan not completed')
  if (!r.ok) throw new Error(`Failed to get results: ${r.status}`)
  return r.json()
}
