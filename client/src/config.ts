/** API base: explicit env wins; otherwise same host as the page on port 4000 (works with Docker + LAN IP). */
export function getServerUrl(): string {
  const v = import.meta.env.VITE_SERVER_URL
  if (v && String(v).trim()) return String(v).replace(/\/$/, '')
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:4000`
  }
  return 'http://localhost:4000'
}

export function getWsUrl(): string {
  const v = import.meta.env.VITE_WS_URL
  if (v && String(v).trim()) return String(v).replace(/\/$/, '')
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    const wsProto = protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProto}//${hostname}:4000`
  }
  return 'ws://localhost:4000'
}
