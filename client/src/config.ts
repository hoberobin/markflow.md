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

/**
 * HTTP(S) base for Yjs / REST: optional split-deploy override, else the page origin.
 * Local dev: run the API on :4000 and use Vite `server.proxy` so origin (e.g. :3000) forwards to it.
 */
export function getCollabHttpBase(): string {
  const envUrl = getServerEnvUrl()
  if (envUrl) return envUrl
  if (typeof window !== 'undefined') {
    return cleanUrl(window.location.origin)
  }
  return 'http://localhost:4000'
}

/** @deprecated Prefer getCollabHttpBase(); kept for callers that expect this name. */
export function getServerUrl(): string {
  return getCollabHttpBase()
}

export function getWsUrlForServer(serverUrl: string): string {
  return toWebSocketUrl(serverUrl) || 'ws://localhost:4000'
}

export function getWsUrl(): string {
  const explicitWs = cleanUrl(import.meta.env.VITE_WS_URL)
  if (explicitWs) return explicitWs

  return getWsUrlForServer(getCollabHttpBase())
}
