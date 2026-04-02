function cleanUrl(value: unknown): string {
  return String(value || '').trim().replace(/\/$/, '')
}

function getServerEnvUrl(): string {
  return cleanUrl(import.meta.env.VITE_SERVER_URL)
}

function isLikelyLocalDevPort(port: string): boolean {
  return port === '3000' || port === '5173' || port === '4173'
}

function toWebSocketUrl(serverUrl: string): string | null {
  try {
    const url = new URL(serverUrl)
    if (url.protocol === 'https:') url.protocol = 'wss:'
    else if (url.protocol === 'http:') url.protocol = 'ws:'
    else return null
    return cleanUrl(url.toString())
  } catch {
    return null
  }
}

function getDefaultServerUrl(): string {
  if (typeof window !== 'undefined') {
    const { protocol, hostname, origin, port } = window.location
    if (!isLikelyLocalDevPort(port)) return cleanUrl(origin)
    return `${protocol}//${hostname}:4000`
  }
  return 'http://localhost:4000'
}

function getServerCandidates(): string[] {
  const out: string[] = []
  const push = (value: string): void => {
    const cleaned = cleanUrl(value)
    if (cleaned && !out.includes(cleaned)) out.push(cleaned)
  }

  push(getServerEnvUrl())

  if (typeof window !== 'undefined') {
    const { origin, protocol, hostname, port } = window.location
    if (isLikelyLocalDevPort(port)) {
      push(`${protocol}//${hostname}:4000`)
    }
    push(origin)
    push(`${cleanUrl(origin)}/api`)
  }
  return out
}

export function getServerCandidatesForClient(): string[] {
  return getServerCandidates()
}

/** API base: env/runtime override wins, then best-effort auto detection, then fallback. */
export function getServerUrl(): string {
  return getServerEnvUrl() || getDefaultServerUrl()
}

export function getWsUrlForServer(serverUrl: string): string {
  return toWebSocketUrl(serverUrl) || 'ws://localhost:4000'
}

export function getWsUrl(): string {
  const explicitWs = cleanUrl(import.meta.env.VITE_WS_URL)
  if (explicitWs) return explicitWs

  return getWsUrlForServer(getServerUrl())
}
