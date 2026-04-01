function cleanUrl(value: unknown): string {
  return String(value || '').trim().replace(/\/$/, '')
}

const RUNTIME_SERVER_KEY = 'mf_server_url'
const HEALTH_TIMEOUT_MS = 1200

function getServerEnvUrl(): string {
  return cleanUrl(import.meta.env.VITE_SERVER_URL)
}

function isLikelyLocalDevPort(port: string): boolean {
  return port === '3000' || port === '5173'
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

function getRuntimeServerUrl(): string {
  if (typeof window !== 'undefined') {
    const fromQuery = cleanUrl(new URLSearchParams(window.location.search || '').get('server'))
    if (fromQuery) return fromQuery
    const fromStorage = cleanUrl(window.localStorage?.getItem?.(RUNTIME_SERVER_KEY))
    if (fromStorage) return fromStorage
  }
  return ''
}

export function setRuntimeServerUrl(serverUrl: string | null): void {
  if (typeof window === 'undefined') return
  const cleaned = cleanUrl(serverUrl)
  if (!cleaned) {
    window.localStorage?.removeItem?.(RUNTIME_SERVER_KEY)
    return
  }
  window.localStorage?.setItem?.(RUNTIME_SERVER_KEY, cleaned)
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
  push(getRuntimeServerUrl())

  if (typeof window !== 'undefined') {
    const { origin, protocol, hostname, port } = window.location
    push(origin)
    push(`${cleanUrl(origin)}/api`)
    if (isLikelyLocalDevPort(port)) {
      push(`${protocol}//${hostname}:4000`)
    }
  }
  return out
}

export function getServerCandidatesForClient(): string[] {
  return getServerCandidates()
}

async function hasHealthEndpoint(serverUrl: string): Promise<boolean> {
  const url = `${cleanUrl(serverUrl)}/health`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}

/** API base: env/runtime override wins, then best-effort auto detection, then fallback. */
export function getServerUrl(): string {
  return getServerEnvUrl() || getRuntimeServerUrl() || getDefaultServerUrl()
}

export async function detectServerUrl(): Promise<string> {
  const explicit = getServerEnvUrl()
  if (explicit) return explicit
  const runtime = getRuntimeServerUrl()
  if (runtime) return runtime

  for (const candidate of getServerCandidates()) {
    if (await hasHealthEndpoint(candidate)) return candidate
  }
  return getDefaultServerUrl()
}

export async function detectServerUrlParallel(): Promise<string> {
  const explicit = getServerEnvUrl()
  if (explicit) return explicit
  const runtime = getRuntimeServerUrl()
  if (runtime) return runtime

  const candidates = getServerCandidates()
  if (candidates.length === 0) return getDefaultServerUrl()

  return new Promise(resolve => {
    let remaining = candidates.length
    let resolved = false

    for (const candidate of candidates) {
      void hasHealthEndpoint(candidate).then(ok => {
        if (resolved) return
        if (ok) {
          resolved = true
          resolve(candidate)
          return
        }
        remaining -= 1
        if (remaining <= 0 && !resolved) {
          resolved = true
          resolve(getDefaultServerUrl())
        }
      })
    }
  })
}

export async function checkServerHealth(serverUrl: string): Promise<boolean> {
  return hasHealthEndpoint(serverUrl)
}

export function getWsUrlForServer(serverUrl: string): string {
  return toWebSocketUrl(serverUrl) || 'ws://localhost:4000'
}

export function getWsUrl(): string {
  const explicitWs = cleanUrl(import.meta.env.VITE_WS_URL)
  if (explicitWs) return explicitWs

  return getWsUrlForServer(getServerUrl())
}
