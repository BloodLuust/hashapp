import type { NextApiRequest, NextApiResponse } from 'next'

type Health = { status: string }

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<Health | { status: 'error'; error: string }>
) {
  const base = process.env.BACKEND_INTERNAL_URL || 'http://localhost:8000'
  try {
    const r = await fetch(`${base}/health`, { headers: { accept: 'application/json' } })
    const data = (await r.json()) as Health
    res.status(r.ok ? 200 : r.status).json(data)
  } catch (e: any) {
    res.status(502).json({ status: 'error', error: String(e?.message || e) })
  }
}

