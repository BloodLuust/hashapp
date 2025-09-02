import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type ItemEvent = {
  ts: number
  hex: string
  base64: string
  sha256: string
  check?: { ok: boolean; status?: number; error?: string }
}

type Props = {
  open: boolean
  onClose: () => void
}

export default function RandomModeConsole({ open, onClose }: Props) {
  const [running, setRunning] = useState(false)
  const [ips, setIps] = useState(50)
  const [doCheck, setDoCheck] = useState(false)
  const [lines, setLines] = useState<string[]>([])
  const [detail, setDetail] = useState<any | null>(null)
  const [lps, setLps] = useState(0)
  const [connected, setConnected] = useState(false)
  const evRef = useRef<EventSource | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const countRef = useRef({ total: 0, window: 0, t0: Date.now() })

  const start = useCallback(() => setRunning(true), [])
  const stop = useCallback(() => setRunning(false), [])

  useEffect(() => {
    if (!open) {
      // Clean up
      setRunning(false)
      if (evRef.current) { evRef.current.close(); evRef.current = null }
      setConnected(false)
      return
    }
  }, [open])

  useEffect(() => {
    if (!open || !running) return
    if (evRef.current) evRef.current.close()
    const url = new URL('/api/random/stream', window.location.origin)
    url.searchParams.set('ips', String(ips))
    if (doCheck) url.searchParams.set('check', '1')
    if (doCheck) url.searchParams.set('mode', 'internal')
    const ev = new EventSource(url.toString())
    evRef.current = ev
    setConnected(true)
    setLines((prev) => [
      `▶️ connected ips=${ips} check=${doCheck}`,
      ...prev,
    ].slice(0, 2000))

    ev.addEventListener('item', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as ItemEvent
        const line = renderLine(data)
        setLines((prev) => [...prev, line].slice(-1000))
        if ((data as any).check?.body) {
          setDetail((data as any).check.body)
        }
        // metrics
        const now = Date.now()
        const c = countRef.current
        c.total += 1; c.window += 1
        if (now - c.t0 >= 1000) {
          setLps(c.window)
          c.window = 0
          c.t0 = now
        }
      } catch {}
    })
    ev.addEventListener('debug', (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data)
        const s = `[debug] ${d.msg}${d.ms ? ` (${d.ms}ms)` : ''}${d.status ? ` status=${d.status}` : ''}`
        setLines((prev) => [...prev, s].slice(-1000))
      } catch {}
    })
    ev.onerror = () => {
      setConnected(false)
      setLines((prev) => [...prev, '⛔ connection error'].slice(-1000))
    }
    return () => { ev.close(); setConnected(false) }
  }, [open, running, ips, doCheck])

  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.scrollTop = containerRef.current.scrollHeight
  }, [lines])

  const renderLine = (it: ItemEvent) => {
    const t = new Date(it.ts).toISOString().split('T')[1]?.replace('Z', '')
    const chk = it.check ? (it.check.ok ? 'ok' : (it.check.error ? `err:${it.check.error}` : `!${it.check.status}`)) : ''
    return `${t} hex=${it.hex} sha256=${it.sha256.slice(0,16)}… ${chk}`
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 w-[96vw] max-w-6xl h-[85vh] rounded shadow-xl flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="font-semibold">Random Mode</div>
          <div className="text-sm text-gray-500">{connected ? 'connected' : 'disconnected'} · {lps} lps</div>
          <button onClick={onClose} className="text-gray-600 hover:text-black">✖</button>
        </div>
        <div className="px-4 py-2 flex gap-3 items-center border-b border-gray-200 dark:border-gray-800">
          <button onClick={running ? stop : start} className="px-3 py-1 rounded bg-gray-900 text-white hover:bg-black">{running ? 'Stop' : 'Start'}</button>
          <label className="text-sm">IPS
            <input type="range" min={1} max={500} value={ips} onChange={e => setIps(parseInt(e.target.value,10))} className="ml-2 align-middle"/>
            <span className="ml-1 text-xs">{ips}</span>
          </label>
          <label className="text-sm inline-flex items-center gap-2">
            <input type="checkbox" checked={doCheck} onChange={e => setDoCheck(e.target.checked)} /> external check
          </label>
          {doCheck && (
            <span className="text-xs text-gray-500">Uses Blockchair HD xpub discovery (20-address gap) or manual address scan.</span>
          )}
        </div>
        <div className="flex-1 grid grid-cols-2 gap-0 min-h-0">
          <div ref={containerRef} className="overflow-auto font-mono text-xs p-3 bg-black text-green-400">
            {lines.map((l, i) => <div key={i}>{l}</div>)}
          </div>
          <div className="overflow-auto p-3 border-l border-gray-200 dark:border-gray-800 text-sm">
            {detail ? (
              <DetailsView data={detail} />
            ) : (
              <div className="text-gray-500">Waiting for live data… enable external check to fetch real results.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailsView({ data }: { data: any }) {
  // Support both legacy summary shape and new structured schema
  const ek = data?.extended_keys || data || {}
  const xprv = ek.xprv
  const yprv = ek.yprv
  const zprv = ek.zprv
  const xpub = ek.xpub
  const ypub = ek.ypub
  const zpub = ek.zpub
  const totals = data?.totals
  const positives = data?.positives
  return (
    <div className="space-y-3">
      <div>
        <div className="font-semibold mb-1">Keys</div>
        <div className="text-xs break-all">
          <div><span className="font-mono">xprv</span>: {xprv}</div>
          <div><span className="font-mono">yprv</span>: {yprv}</div>
          <div><span className="font-mono">zprv</span>: {zprv}</div>
          <div><span className="font-mono">xpub</span>: {xpub}</div>
          <div><span className="font-mono">ypub</span>: {ypub}</div>
          <div><span className="font-mono">zpub</span>: {zpub}</div>
        </div>
      </div>
      <div>
        <div className="font-semibold mb-1">Summary</div>
        <div className="text-sm">Scanned: {totals?.addresses_scanned} · Active: {totals?.with_activity} · Balance (sats): {totals?.balance_sats}</div>
      </div>
      <div>
        <div className="font-semibold mb-1">Active Addresses</div>
        <div className="space-y-2">
          {(positives || []).slice(0,20).map((a: any) => (
            <div key={a.address} className="border rounded p-2">
              <div className="font-mono text-xs break-all">{a.address}</div>
              <div className="text-xs">tx_count: {a.transaction_count} · balance: {a.balance}</div>
              {a.utxo && a.utxo.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs">UTXO ({a.utxo.length})</summary>
                  <pre className="overflow-auto text-[10px] bg-gray-50 dark:bg-gray-800 p-2 rounded">{JSON.stringify(a.utxo.slice(0,5), null, 2)}{a.utxo.length>5?'\n…':''}</pre>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
