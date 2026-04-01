function cleanUrl(value: unknown): string {
  return String(value || '').trim().replace(/\/$/, '')
}

function getServerEnvUrl(): string {
  return cleanUrl(import.meta.env.VITE_SERVER_URL)
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

/** API base: explicit env wins; otherwise same host as the page on port 4000 (works with Docker + LAN IP). */
export function getServerUrl(): string {
  const v = getServerEnvUrl()
  if (v) return v
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:4000`
  }
  return 'http://localhost:4000'
}

export function getWsUrl(): string {
  const explicitWs = cleanUrl(import.meta.env.VITE_WS_URL)
  if (explicitWs) return explicitWs

  const serverUrl = getServerEnvUrl()
  const wsFromServer = serverUrl ? toWebSocketUrl(serverUrl) : null
  if (wsFromServer) return wsFromServer

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    const wsProto = protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProto}//${hostname}:4000`
  }
  return 'ws://localhost:4000'
}
