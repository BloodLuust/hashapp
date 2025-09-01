type Props = {
  progress: number
  status: string
  logs?: string[]
}

export default function ProgressIndicator({ progress, status, logs = [] }: Props) {
  const pct = Math.min(100, Math.max(0, Math.round(progress || 0)))
  return (
    <div className="w-full max-w-2xl mt-6">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">Status: {status}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-gray-200 dark:bg-gray-800">
        <div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
      {logs.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-300">
          {logs.map((l, i) => (
            <li key={i}>• {l}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

