import { useEffect, useState } from 'react'

export type User = { id: string; email: string }

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const fetchMe = async () => {
      try {
        const r = await fetch('/api/auth/me', { headers: { accept: 'application/json' } })
        if (!active) return
        if (r.ok) setUser(await r.json())
        else setUser(null)
      } catch {
        if (!active) return
        setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchMe()
    return () => { active = false }
  }, [])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }

  return { user, loading, logout, setUser }
}

