import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const base = process.env.BACKEND_INTERNAL_URL || 'http://localhost:8000'
  try {
    const r = await fetch(`${base}/auth/logout`, { method: 'POST' })
    const setCookie = r.headers.get('set-cookie')
    if (setCookie) res.setHeader('set-cookie', setCookie)
    const text = await r.text()
    res.status(r.status).send(text)
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message || e) })
  }
}

