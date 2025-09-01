import ThemeToggle from './ThemeToggle'
import dynamic from 'next/dynamic'

const HealthBadge = dynamic(() => import('./HealthBadge'), { ssr: false })

export default function HeaderBar() {
  return (
    <div className="fixed top-0 inset-x-0 z-30 p-4 pointer-events-none">
      {/* Backend button: absolute, left: 20px (left-5) */}
      <div className="absolute left-5 top-4 pointer-events-auto">
        <HealthBadge />
      </div>
      {/* Right controls */}
      <div className="flex items-center justify-end gap-3 pointer-events-auto">
        <ThemeToggle />
      </div>
    </div>
  )
}
