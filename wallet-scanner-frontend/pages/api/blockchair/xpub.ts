import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchXpubDashboard } from '@/lib/blockchair'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { xpub } = req.query as { xpub?: string }
  if (!xpub) {
    res.status(400).json({ error: 'xpub is required' })
    return
  }
  const key = (req.headers['x-api-key'] as string) || process.env.BLOCKCHAIR_API_KEY
  try {
    const data = await fetchXpubDashboard(xpub, { apiKey: key })
    res.status(200).json(data)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    res.status(502).json({ error: message })
  }
}
