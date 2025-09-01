import Head from 'next/head'
import Layout from '@/components/Layout'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { getScanStatus, getScanResults } from '@/lib/scan'
import ProgressIndicator from '@/components/ProgressIndicator'
import BalanceChart from '@/components/Charts/BalanceChart'

export default function ScanDetailsPage() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const [status, setStatus] = useState<'loading' | 'running' | 'completed' | 'error'>('loading')
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [results, setResults] = useState<any | null>(null)

  useEffect(() => {
    if (!id) return
    let active = true
    const poll = async () => {
      try {
        const s = await getScanStatus(id)
        if (!active) return
        setProgress(s.progress)
        setLogs(s.logs || [])
        if (s.status === 'completed') {
          setStatus('completed')
          const r = await getScanResults(id)
          if (!active) return
          setResults(r)
          return
        }
        setStatus('running')
      } catch {
        if (!active) return
        setStatus('error')
      } finally {
        if (active && status !== 'completed' && status !== 'error') setTimeout(poll, 1500)
      }
    }
    poll()
    return () => { active = false }
  }, [id, status])

  return (
    <Layout>
      <Head><title>Scan {id} — Wallet Scanner</title></Head>
      <section className="container mx-auto px-6 py-10">
        <h1 className="mb-6 text-2xl font-bold">Scan Details</h1>
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">ID: {id}</div>
        <ProgressIndicator progress={progress} status={status} logs={logs} />
        {results && (
          <div className="mt-8 space-y-6">
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
                        <tr key={name} className="border-top border-gray-200 dark:border-gray-800">
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
