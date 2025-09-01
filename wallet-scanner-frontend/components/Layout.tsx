import { ReactNode } from 'react'
import HeaderBar from './HeaderBar'
import { useAuth } from '@/hooks/useAuth'

export default function Layout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth()
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-midnight text-gray-900 dark:text-gray-100">
      <HeaderBar />
      <main className="relative pt-16">
        <div className="container mx-auto px-6">
          <div className="mb-4 flex items-center justify-end gap-4 text-sm">
            {loading ? (
              <span className="text-gray-500">Checking auth…</span>
            ) : user ? (
              <>
                <span className="text-gray-600 dark:text-gray-300">Signed in as {user.email}</span>
                <button onClick={logout} className="rounded bg-gray-200 px-3 py-1 dark:bg-gray-800">Logout</button>
              </>
            ) : (
              <>
                <a href="/login" className="underline text-brand">Login</a>
                <a href="/register" className="underline text-brand">Register</a>
              </>
            )}
          </div>
        </div>
        {children}
      </main>
    </div>
  )
}
