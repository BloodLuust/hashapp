import type { NextApiRequest, NextApiResponse } from 'next'

export const config = {
  api: {
    bodyParser: false,
  },
}

// Utility: async sleep
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Generate a random 32-byte hex string
function randomHex32(): string {
  const bytes = new Uint8Array(32)
  // Node crypto
  require('crypto').randomFillSync(bytes)
  return Buffer.from(bytes).toString('hex')
}

function sha256Hex(hex: string): string {
  const buf = Buffer.from(hex, 'hex')
  return require('crypto').createHash('sha256').update(buf).digest('hex')
}

function base64OfHex(hex: string): string {
  return Buffer.from(hex, 'hex').toString('base64')
}

async function checkExternal(hex: string, timeoutMs: number): Promise<{ ok: boolean; status?: number; body?: any; error?: string }>{
  const url = process.env.RANDOM_CHECK_URL
  if (!url) return { ok: false, error: 'no_check_url' }

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const u = new URL(url)
    u.searchParams.set('hex', hex)
    const r = await fetch(u.toString(), { signal: ctrl.signal })
    const text = await r.text()
    let body: any = undefined
    try { body = JSON.parse(text) } catch { body = text }
    return { ok: r.ok, status: r.status, body }
  } catch (e: any) {
    return { ok: false, error: String(e?.name || e?.message || e) }
  } finally {
    clearTimeout(t)
  }
}

// Internal expand using HD + Blockchair for richer info
async function internalExpand(hex: string, mode?: 'xpub'|'address') {
  const { expandHex } = await import('@/lib/expand')
  const depth = Math.max(1, Math.min(100, parseInt(String(process.env.RANDOM_DEPTH || '100'), 10) || 100))
  const key = process.env.BLOCKCHAIR_API_KEY
  try {
    const summary = await expandHex(hex, depth, key, mode)
    return { ok: true, body: summary }
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Server-Sent Events setup
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // for proxies like nginx
  })

  const q = req.query
  // items per second; default 50, cap 500
  const ips = Math.max(1, Math.min(500, parseInt(String(q.ips ?? '50'), 10) || 50))
  const doCheck = String(q.check ?? '0') === '1'
  const mode = String(q.mode ?? '') // 'external'|'internal'
  const hdMode = String(q.hd ?? '') === 'xpub' ? 'xpub' : 'address'
  const timeoutMs = Math.max(50, Math.min(2000, parseInt(String(q.timeout ?? '200'), 10) || 200))

  const intervalMs = Math.max(1, Math.floor(1000 / ips))

  let running = true
  req.on('close', () => { running = false })

  // Send hello event
  const send = (event: string, data: any) => {
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }
  send('hello', { ips, check: doCheck, timeoutMs, ts: Date.now() })

  // Main loop
  while (running) {
    const hex = randomHex32()
    const payload: any = {
      ts: Date.now(),
      hex,
      base64: base64OfHex(hex),
      sha256: sha256Hex(hex),
    }
    if (doCheck) {
      if (mode === 'internal' || !process.env.RANDOM_CHECK_URL) {
        send('debug', { msg: 'internalExpand start', hdMode, depth: process.env.RANDOM_DEPTH || '100' })
        const t0 = Date.now()
        payload.check = await internalExpand(hex, hdMode)
        send('debug', { msg: 'internalExpand done', ms: Date.now() - t0, ok: payload.check.ok })
      } else {
        send('debug', { msg: 'external check start', url: process.env.RANDOM_CHECK_URL, timeoutMs })
        const t0 = Date.now()
        const result = await checkExternal(hex, timeoutMs)
        payload.check = result
        send('debug', { msg: 'external check done', ms: Date.now() - t0, ok: result.ok, status: result.status })
      }
    }
    send('item', payload)
    await sleep(intervalMs)
  }

  res.end()
}
