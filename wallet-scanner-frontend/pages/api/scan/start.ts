import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const base = process.env.BACKEND_INTERNAL_URL || 'http://localhost:8000'
  const url = `${base}/scan/start`
  const init: RequestInit = {
    method: req.method,
    headers: { 'content-type': 'application/json', accept: 'application/json', cookie: req.headers.cookie || '' },
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
  }
  try {
    const r = await fetch(url, init)
    const text = await r.text()
    res.status(r.status).send(text)
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message || e) })
  }
}

