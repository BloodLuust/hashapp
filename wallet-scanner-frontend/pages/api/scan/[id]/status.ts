import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string }
  const base = process.env.BACKEND_INTERNAL_URL || 'http://localhost:8000'
  const url = `${base}/scan/${id}/status`
  const init: RequestInit = {
    method: req.method,
    headers: { 'content-type': 'application/json', accept: 'application/json', cookie: req.headers.cookie || '' },
  }
  try {
    const r = await fetch(url, init)
    const text = await r.text()
    res.status(r.status).send(text)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    res.status(502).json({ error: message })
  }
}
