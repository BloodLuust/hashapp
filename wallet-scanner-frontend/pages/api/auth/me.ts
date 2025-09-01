import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const base = process.env.BACKEND_INTERNAL_URL || 'http://localhost:8000'
  try {
    const r = await fetch(`${base}/auth/me`, {
      headers: { accept: 'application/json', cookie: req.headers.cookie || '' },
    })
    const text = await r.text()
    // Forward 401 etc
    res.status(r.status).send(text)
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message || e) })
  }
}

