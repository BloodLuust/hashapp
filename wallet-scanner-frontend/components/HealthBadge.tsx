import { useCallback, useEffect, useState } from 'react'
import { fetchHealthWithRetry } from '@/lib/api'

type Status = 'loading' | 'ok' | 'error'

export default function HealthBadge() {
  const [status, setStatus] = useState<Status>('loading')
  const [seq, setSeq] = useState(0)

  const run = useCallback(() => {
    setStatus('loading')
    const ctrl = new AbortController()
    fetchHealthWithRetry({ signal: ctrl.signal, tries: 5, baseDelayMs: 400 })
      .then((d) => setStatus(d.status === 'ok' ? 'ok' : 'error'))
      .catch(() => setStatus('error'))
    return () => ctrl.abort()
  }, [])

  useEffect(() => {
    const cleanup = run()
    return cleanup
    // rerun on seq changes (manual retry)
  }, [run, seq])

  const base = 'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium shadow pointer-events-auto'
  const cls =
    status === 'ok'
      ? `${base} bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200`
      : status === 'error'
      ? `${base} bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200`
      : `${base} bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-200`

  const Dot = (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        status === 'ok' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-gray-400 animate-pulse'
      }`}
    />
  )

  const label = status === 'ok' ? 'Backend: ok' : status === 'error' ? 'Backend: error' : 'Backend: loading'

  return (
    <button
      type="button"
      aria-label={`${label}. Click to retry.`}
      title={`${label}. Click to retry.`}
      className={cls}
      onClick={() => setSeq((n) => n + 1)}
    >
      {Dot}
      <span>{label}</span>
    </button>
  )
}

