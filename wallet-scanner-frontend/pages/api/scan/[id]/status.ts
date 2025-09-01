import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  const base = process.env.BACKEND_INTERNAL_URL || 'http://localhost:8000'
  const url = `${base}/scan/${id}/status`
  try {
    const r = await fetch(url, { headers: { accept: 'application/json', cookie: req.headers.cookie || '' } })
    const text = await r.text()
    res.status(r.status).send(text)
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message || e) })
  }
}
