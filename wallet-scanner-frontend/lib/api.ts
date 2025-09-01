export type Health = { status: string }

export async function fetchHealth(signal?: AbortSignal): Promise<Health> {
  const r = await fetch('/api/health', { signal, headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(`Health check failed: ${r.status}`)
  return r.json()
}

export async function fetchHealthWithRetry(opts?: { signal?: AbortSignal; tries?: number; baseDelayMs?: number }): Promise<Health> {
  const tries = Math.max(1, opts?.tries ?? 5)
  const base = opts?.baseDelayMs ?? 500
  let attempt = 0
  let lastErr: unknown

  while (attempt < tries) {
    const ac = new AbortController()
    const onAbort = () => ac.abort()
    opts?.signal?.addEventListener('abort', onAbort)
    try {
      return await fetchHealth(ac.signal)
    } catch (e) {
      lastErr = e
      attempt++
      if (attempt >= tries) break
      const delay = base * Math.pow(2, attempt - 1)
      await new Promise<void>((res) => {
        const t = setTimeout(res, delay)
        opts?.signal?.addEventListener('abort', () => {
          clearTimeout(t)
          res()
        }, { once: true })
      })
    } finally {
      opts?.signal?.removeEventListener('abort', onAbort)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Health retry failed')
}
