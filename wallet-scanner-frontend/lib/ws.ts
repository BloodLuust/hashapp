export function buildWsUrl(path: string) {
  // Prefer NEXT_PUBLIC_BACKEND_URL if provided, else same origin but ws scheme
  const base = process.env.NEXT_PUBLIC_BACKEND_URL
  if (base) {
    const url = new URL(base)
    url.protocol = url.protocol.replace('http', 'ws')
    url.pathname = path
    return url.toString()
  }
  const loc = typeof window !== 'undefined' ? window.location : { protocol: 'http:', host: '' }
  const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${(window as any).location.host}${path}`
}

