import Head from 'next/head'
import Layout from '@/components/Layout'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/hooks/useAuth'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()
  const { setUser } = useAuth()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (r.ok) {
      const me = await fetch('/api/auth/me')
      if (me.ok) setUser(await me.json())
      router.push('/dashboard')
    } else {
      const msg = await r.text()
      setErr(msg || 'Registration failed')
    }
  }

  return (
    <Layout>
      <Head><title>Register — Wallet Scanner</title></Head>
      <section className="container mx-auto px-6 py-10">
        <h1 className="mb-4 text-2xl font-bold">Register</h1>
        <form onSubmit={submit} className="max-w-md space-y-4">
          {err && <div className="rounded bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-900/40 dark:text-red-200">{err}</div>}
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input className="w-full rounded border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input type="password" className="w-full rounded border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="rounded bg-brand px-4 py-2 font-semibold text-white">Create account</button>
        </form>
      </section>
    </Layout>
  )
}
