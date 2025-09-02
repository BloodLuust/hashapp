import type { NextApiRequest, NextApiResponse } from 'next'
import { expandHexStructured } from '@/lib/expand'
import type { ResultDoc } from '@/lib/types'
import { getCollection } from '@/lib/mongo'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const hex = String(req.query.hex || req.body?.hex || '')
    if (!hex || !/^[0-9a-fA-F]{32,128}$/.test(hex)) {
      res.status(400).json({ error: 'invalid hex' }); return
    }
    const depth = Math.max(1, Math.min(1000, parseInt(String(req.query.depth ?? '100'), 10) || 100))
    const mode = String(req.query.mode || '') === 'xpub' ? 'xpub' : 'address'
    const bcKey = process.env.BLOCKCHAIR_API_KEY
    const doc: ResultDoc = await expandHexStructured(hex, depth, bcKey, mode as any)
    const src = String(req.query.source || '').toLowerCase()
    if (src === 'range' || src === 'specific' || src === 'random') {
      doc.source = src as any
    }

    // Persist if Mongo configured
    try {
      const col = await getCollection<any>('random_scans')
      await col.insertOne({ createdAt: new Date(), ...doc })
    } catch {}

    res.status(200).json(doc)
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) })
  }
}
