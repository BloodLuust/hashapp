import Head from 'next/head'
import Layout from '@/components/Layout'
import ScanForm from '@/components/ScanForm'
import ProgressIndicator from '@/components/ProgressIndicator'
import BalanceChart from '@/components/Charts/BalanceChart'
import { useCallback, useEffect, useState } from 'react'
import { startScan, getScanStatus, getScanResults, type ScanRequest } from '@/lib/scan'
import { buildWsUrl } from '@/lib/ws'

export default function DashboardPage() {
  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [results, setResults] = useState<any | null>(null)

  const onStart = useCallback(async (req: ScanRequest) => {
    setResults(null)
    setProgress(0)
    setLogs([])
    setStatus('running')
    const { id } = await startScan(req)
    setJobId(id)
  }, [])

  useEffect(() => {
    if (!jobId) return
    let closed = false
    // Try WebSocket first
    const wsUrl = buildWsUrl(`/ws/scan/${jobId}`)
    let ws: WebSocket | null = null
    try {
      ws = new WebSocket(wsUrl)
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data)
        if (msg.error) return
        setProgress(msg.progress || 0)
        setLogs(msg.logs || [])
        if (msg.status === 'completed') setStatus('completed')
        else if (msg.status === 'error') setStatus('error')
        else setStatus('running')
      }
      ws.onclose = () => {
        if (closed) return
        // Fallback to polling on close
        startPolling()
      }
    } catch {
      startPolling()
    }

    function startPolling() {
      let active = true
      const tick = async () => {
        try {
          const s = await getScanStatus(jobId)
          if (!active) return
          setProgress(s.progress)
          setLogs(s.logs || [])
          if (s.status === 'completed') {
            setStatus('completed')
            const r = await getScanResults(jobId)
            if (!active) return
            setResults(r)
            return
          }
          if (s.status === 'error') {
            setStatus('error')
            return
          }
          setStatus('running')
        } catch {
          // ignore
        } finally {
          if (active && status !== 'completed' && status !== 'error') setTimeout(tick, 1500)
        }
      }
      tick()
      return () => { active = false }
    }

    return () => {
      closed = true
      if (ws) try { ws.close() } catch {}
    }
  }, [jobId, status])

  return (
    <Layout>
      <Head>
        <title>Dashboard — Wallet Scanner</title>
      </Head>
      <section className="container mx-auto px-6 py-10">
        <h1 className="mb-6 text-3xl font-bold">Dashboard</h1>
        <p className="mb-6 text-gray-600 dark:text-gray-300">Enter an address or extended public key to start a scan.</p>

        <ScanForm onStart={onStart} />

        {status !== 'idle' && (
          <>
            <ProgressIndicator progress={progress} status={status} logs={logs} />
            {jobId && (
              <div className="mt-3 text-sm">
                Job ID: <code className="rounded bg-gray-200 px-1 py-0.5 dark:bg-gray-800">{jobId}</code>
                {status !== 'running' && (
                  <a className="ml-3 text-brand underline" href={`/scans/${jobId}`}>View details</a>
                )}
              </div>
            )}
          </>
        )}

        {results && (
          <div className="mt-8 space-y-6">
            <div className="rounded-lg bg-white/80 p-4 shadow backdrop-blur dark:bg-gray-900/60">
              <div className="mb-2 text-sm font-medium">Summary</div>
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div><div className="text-gray-500">Addresses</div><div className="font-semibold">{results.summary?.addresses_scanned}</div></div>
                <div><div className="text-gray-500">Transactions</div><div className="font-semibold">{results.summary?.total_transactions}</div></div>
                <div><div className="text-gray-500">Balance</div><div className="font-semibold">{results.summary?.current_balance} {results.summary?.unit}</div></div>
                <div><div className="text-gray-500">Status</div><div className="font-semibold">Completed</div></div>
              </div>
            </div>

            {results.providers && (
              <div className="rounded-lg bg-white/80 p-4 shadow backdrop-blur dark:bg-gray-900/60">
                <div className="mb-2 text-sm font-medium">Provider Comparison</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-2 pr-4">Provider</th>
                        <th className="py-2 pr-4">Transactions</th>
                        <th className="py-2 pr-4">Received</th>
                        <th className="py-2 pr-4">Sent</th>
                        <th className="py-2 pr-4">Balance</th>
                        <th className="py-2 pr-4">Req Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(results.providers).filter(([k]) => !k.endsWith('_meta')).map(([name, data]: any) => (
                        <tr key={name} className="border-t border-gray-200 dark:border-gray-800">
                          <td className="py-2 pr-4 font-medium capitalize">{name}</td>
                          <td className="py-2 pr-4">{data?.total_transactions ?? data?.summary?.total_transactions ?? data?.transactions ?? '—'}</td>
                          <td className="py-2 pr-4">{data?.total_received ?? data?.summary?.total_received ?? '—'}</td>
                          <td className="py-2 pr-4">{data?.total_sent ?? data?.summary?.total_sent ?? '—'}</td>
                          <td className="py-2 pr-4">{(data?.current_balance ?? data?.summary?.current_balance ?? '—')}{typeof (data?.current_balance ?? data?.summary?.current_balance) === 'number' ? ` ${results.summary?.unit}` : ''}</td>
                          <td className="py-2 pr-4">{results.providers?.blockchair_meta?.request_cost ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {results.providers?.tatum?.addresses && Array.isArray(results.providers.tatum.addresses) && (
                  <div className="mt-4">
                    <div className="mb-1 text-sm text-gray-500">Tatum address checks: {results.providers.tatum.checked} — With unspent: {results.providers.tatum.addresses_with_unspent}</div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="py-2 pr-4">Address</th>
                            <th className="py-2 pr-4">Balance</th>
                            <th className="py-2 pr-4">UTXO Count</th>
                            <th className="py-2 pr-4">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.providers.tatum.addresses.map((a: any) => (
                            <tr key={a.address || Math.random()} className="border-t border-gray-200 dark:border-gray-800">
                              <td className="py-2 pr-4 font-mono text-xs">{a.address || '—'}</td>
                              <td className="py-2 pr-4">{typeof a.balance === 'number' ? `${a.balance} ${results.summary?.unit}` : '—'}</td>
                              <td className="py-2 pr-4">{a.utxo_count ?? '—'}</td>
                              <td className="py-2 pr-4">{a.error ? `Error: ${a.error}` : (a.utxo_count > 0 || (a.balance ?? 0) > 0 ? 'Has funds' : 'Empty')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <BalanceChart data={results.balance_over_time || []} />
          </div>
        )}
      </section>
    </Layout>
  )
}
