import { useState } from 'react'
import type { ScanRequest } from '@/lib/scan'
import { startModeScan } from '@/lib/scan'
import { generateHex, deriveFromHex } from '@/lib/utils'

type Props = {
  onStart: (req: ScanRequest) => Promise<void>
}

type Mode = 'direct' | 'random' | 'range'

export default function ScanForm({ onStart }: Props) {
  const [mode, setMode] = useState<Mode>('direct')
  const [kind, setKind] = useState<ScanRequest['kind']>('address')
  const [input, setInput] = useState('')
  const [chain, setChain] = useState('auto')
  const [compare, setCompare] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Random/range params
  const [count, setCount] = useState(10)
  const [minHex, setMinHex] = useState('')
  const [maxHex, setMaxHex] = useState('')
  const [randomize, setRandomize] = useState(true)
  const [useJob, setUseJob] = useState(true)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      if (mode === 'direct') {
        await onStart({ kind, input: input.trim(), chain: chain === 'auto' ? undefined : chain, compare_providers: compare })
      } else if (mode === 'random') {
        if (useJob) {
          await startModeScan({ mode: 'random', chains: chain==='auto'? undefined : [chain] })
          return
        }
        // Generate N random seeds and start a scan for the first derived xpub (MVP)
        const resp = await generateHex({ count: Math.max(1, Math.min(count, 2048)), length: 64, unique: true })
        const first = resp.items[0]
        if (!first) throw new Error('No hex generated')
        const d = await deriveFromHex(first)
        await onStart({ kind: 'xpub', input: d.xpub, chain: chain === 'auto' ? undefined : chain, compare_providers: compare })
      } else if (mode === 'range') {
        if (!minHex || !maxHex) throw new Error('Provide both start and end hex')
        if (useJob) {
          await startModeScan({ mode: 'range', min_hex: minHex, max_hex: maxHex, randomize, chains: chain==='auto'? undefined : [chain] })
          return
        }
        const resp = await generateHex({ min_hex: minHex, max_hex: maxHex, count: Math.max(1, Math.min(count, 2048)), randomize })
        const first = resp.items[0]
        if (!first) throw new Error('No hex generated from range')
        const d = await deriveFromHex(first)
        await onStart({ kind: 'xpub', input: d.xpub, chain: chain === 'auto' ? undefined : chain, compare_providers: compare })
      }
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-2xl rounded-lg bg-white/80 p-6 shadow backdrop-blur dark:bg-gray-900/60">
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Mode</label>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="mode" value="direct" checked={mode==='direct'} onChange={() => setMode('direct')} />
            Direct (Address / xpub)
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="mode" value="random" checked={mode==='random'} onChange={() => setMode('random')} />
            Random Keys
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="mode" value="range" checked={mode==='range'} onChange={() => setMode('range')} />
            Hex Range
          </label>
        </div>
      </div>

      {mode === 'direct' && (
      <>
        <label className="block text-sm font-medium mb-1">Input Type</label>
        <div className="flex gap-4">
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="kind" value="address" checked={kind === 'address'} onChange={() => setKind('address')} />
            Address
          </label>
          <label className="inline-flex items-center gap-2" title={chain === 'ethereum' ? 'Ethereum does not support xpub' : ''}>
            <input
              type="radio"
              name="kind"
              value="xpub"
              checked={kind === 'xpub'}
              onChange={() => setKind('xpub')}
              disabled={chain === 'ethereum'}
            />
            Extended Public Key (xpub/ypub/zpub/tpub)
          </label>
        </div>
      </>
      )}

      <div className="mb-6">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
          Compare providers (if available)
        </label>
      </div>

      {mode === 'direct' && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">{kind === 'address' ? 'Address' : 'Extended Public Key'}</label>
          <input
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            placeholder={kind === 'address' ? '0x... or bc1...' : 'xpub... / ypub... / zpub...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            required={mode==='direct'}
          />
        </div>
      )}

      {mode === 'random' && (
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Count</label>
            <input type="number" min={1} max={2048} value={count} onChange={(e) => setCount(parseInt(e.target.value||'1',10))}
                   className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Generates N random 256‑bit hex keys; starts scan with first derived xpub (MVP).</p>
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useJob} onChange={(e)=>setUseJob(e.target.checked)} /> Use continuous job (beta)
            </label>
          </div>
        </div>
      )}

      {mode === 'range' && (
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start (hex)</label>
            <input value={minHex} onChange={(e)=>setMinHex(e.target.value)} placeholder="e.g. 0000..." className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End (hex)</label>
            <input value={maxHex} onChange={(e)=>setMaxHex(e.target.value)} placeholder="e.g. 00ff..." className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Batch Count</label>
            <input type="number" min={1} max={2048} value={count} onChange={(e) => setCount(parseInt(e.target.value||'1',10))}
                   className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={randomize} onChange={(e)=>setRandomize(e.target.checked)} /> Randomize within range
            </label>
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useJob} onChange={(e)=>setUseJob(e.target.checked)} /> Use continuous job (beta)
            </label>
          </div>
          <p className="col-span-2 mt-1 text-xs text-gray-500 dark:text-gray-400">Generates a batch from the range; starts scan with first derived xpub (MVP). Full continuous range scanning comes with /scan/start.</p>
        </div>
      )}

      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Chain</label>
        <select
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          value={chain}
          onChange={(e) => setChain(e.target.value)}
        >
          <option value="auto">Autodetect</option>
          <option value="bitcoin">Bitcoin</option>
          <option value="ethereum">Ethereum</option>
          {/* Disabled until backends are implemented */}
          <option value="litecoin" disabled>Litecoin (coming soon)</option>
          <option value="dogecoin" disabled>Dogecoin (coming soon)</option>
        </select>
        {chain === 'ethereum' && kind === 'xpub' && (
          <p className="mt-2 text-sm text-orange-700 dark:text-orange-300">Ethereum does not support xpub. Switch to Address.</p>
        )}
      </div>

      {err && <div className="mb-4 rounded bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-900/40 dark:text-red-200">{err}</div>}

      <button
        type="submit"
        disabled={busy || (mode==='direct' && !input.trim())}
        className="inline-flex items-center rounded-md bg-brand px-4 py-2 font-semibold text-white shadow hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Starting…' : (mode==='direct' ? 'Start Scan' : 'Generate & Scan (MVP)')}
      </button>
    </form>
  )
}
