export const DEFAULT_ROOM = 'lobby'

export function sanitizeRoomId(value: string): string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  return (normalized || DEFAULT_ROOM).slice(0, 48)
}

export function readRoomFromLocation(): string {
  if (typeof window === 'undefined') return DEFAULT_ROOM
  const params = new URLSearchParams(window.location.search)
  return sanitizeRoomId(params.get('room') || DEFAULT_ROOM)
}

export function writeRoomToLocation(room: string): void {
  if (typeof window === 'undefined') return
  const next = sanitizeRoomId(room)
  const url = new URL(window.location.href)
  url.searchParams.set('room', next)
  window.history.replaceState(null, '', url.toString())
}
