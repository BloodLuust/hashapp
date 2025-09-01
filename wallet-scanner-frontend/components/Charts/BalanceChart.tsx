// Placeholder chart using simple SVG so we avoid adding deps now.
// Replace later with Chart.js or Recharts as needed.
type Point = { t: string; balance: number }

export default function BalanceChart({ data }: { data: Point[] }) {
  if (!data || data.length === 0) return null
  const w = 560
  const h = 180
  const pad = 24
  const xs = data.map((d) => new Date(d.t).getTime())
  const ys = data.map((d) => d.balance)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const sx = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * (w - pad * 2)
  const sy = (y: number) => h - pad - ((y - minY) / (maxY - minY || 1)) * (h - pad * 2)
  const path = data.map((d, i) => `${i ? 'L' : 'M'} ${sx(new Date(d.t).getTime()).toFixed(1)} ${sy(d.balance).toFixed(1)}`).join(' ')

  return (
    <div className="w-full max-w-2xl rounded-lg bg-white/80 p-4 shadow backdrop-blur dark:bg-gray-900/60">
      <div className="mb-2 text-sm font-medium">Balance over time</div>
      <svg width={w} height={h} role="img" aria-label="Balance over time">
        <defs>
          <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--c0, #FF3EA5)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--c1, #A8D8FF)" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={w} height={h} fill="transparent" />
        <path d={path} fill="none" stroke="url(#grad)" strokeWidth={2.5} />
      </svg>
    </div>
  )
}

