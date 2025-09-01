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
          <div className="mt-8">
            <BalanceChart data={results.balance_over_time || []} />
          </div>
        )}
      </section>
    </Layout>
  )
}

