import { useState } from 'react'
import type { ScanRequest } from '@/lib/scan'

type Props = {
  onStart: (req: ScanRequest) => Promise<void>
}

export default function ScanForm({ onStart }: Props) {
  const [kind, setKind] = useState<ScanRequest['kind']>('address')
  const [input, setInput] = useState('')
  const [chain, setChain] = useState('auto')
  const [compare, setCompare] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      await onStart({ kind, input: input.trim(), chain: chain === 'auto' ? undefined : chain, compare_providers: compare })
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-2xl rounded-lg bg-white/80 p-6 shadow backdrop-blur dark:bg-gray-900/60">
      <div className="mb-4">
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
      </div>

      <div className="mb-6">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
          Compare providers (if available)
        </label>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">{kind === 'address' ? 'Address' : 'Extended Public Key'}</label>
        <input
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          placeholder={kind === 'address' ? '0x... or bc1...' : 'xpub... / ypub... / zpub... / tpub...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          required
        />
      </div>

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
        disabled={busy || !input.trim()}
        className="inline-flex items-center rounded-md bg-brand px-4 py-2 font-semibold text-white shadow hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Starting…' : 'Start Scan'}
      </button>
    </form>
  )
}
