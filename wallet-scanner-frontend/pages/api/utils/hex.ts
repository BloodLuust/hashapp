import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const base = process.env.BACKEND_INTERNAL_URL || 'http://localhost:8000'
  const url = `${base}/utils/hex/generate`
  const init: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', cookie: req.headers.cookie || '' },
    body: JSON.stringify(req.body || {}),
  }
  try {
    const r = await fetch(url, init)
    const text = await r.text()
    res.status(r.status).send(text)
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message || e) })
  }
}

