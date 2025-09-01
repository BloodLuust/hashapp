import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const base = process.env.BACKEND_INTERNAL_URL || 'http://localhost:8000'
  try {
    const r = await fetch(`${base}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(req.body),
    })
    const setCookie = r.headers.get('set-cookie')
    if (setCookie) res.setHeader('set-cookie', setCookie)
    const text = await r.text()
    res.status(r.status).send(text)
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message || e) })
  }
}

