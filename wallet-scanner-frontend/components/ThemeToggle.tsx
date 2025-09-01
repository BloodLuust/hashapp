import { useEffect, useState } from 'react'

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme())

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    try { localStorage.setItem('theme', theme) } catch {}
  }, [theme])

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      className="fixed right-4 top-4 z-20 inline-flex items-center rounded-md border border-gray-300 bg-white/80 px-3 py-2 text-sm shadow backdrop-blur transition hover:bg-white dark:border-gray-600 dark:bg-gray-800/80 dark:text-gray-100"
      onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
    >
      <span className="hidden dark:inline">🌙 Night</span>
      <span className="inline dark:hidden">☀️ Day</span>
    </button>
  )
}

