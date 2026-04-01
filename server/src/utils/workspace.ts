import path from 'path'

export const DEFAULT_ROOM = 'lobby'

function cleanFilename(value: unknown): string {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_\-. ]/g, '')
    .trim()
}

/**
 * Normalizes user input into a markdown filename.
 * Used for file creation/import where adding `.md` is helpful.
 */
export function normalizeMdFilename(name: unknown): string | null {
  const cleaned = cleanFilename(name)
  if (!cleaned) return null
  return cleaned.endsWith('.md') ? cleaned : `${cleaned}.md`
}

/**
 * Validates an existing markdown filename exactly as provided.
 * Used for routes that should not mutate/guess a filename.
 */
export function validateExistingMdFilename(name: unknown): string | null {
  const raw = String(name || '').trim()
  const normalized = normalizeMdFilename(raw)
  if (!normalized || normalized !== raw) return null
  if (normalized.includes('/') || normalized.includes('\\')) return null
  if (path.basename(normalized) !== normalized) return null
  return normalized
}

export function sanitizeRoomId(value: unknown): string | null {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
  if (!raw) return null
  const cleaned = raw
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!cleaned) return null
  if (cleaned.length > 48) return cleaned.slice(0, 48)
  return cleaned
}

export function parseRoom(value: unknown): string | null {
  if (value === undefined || value === null || String(value).trim() === '') return DEFAULT_ROOM
  return sanitizeRoomId(value)
}

export function getDocKey(room: string, fileName: string): string {
  return `${room}/${fileName}`
}

/**
 * Accepts either:
 * - /<filename>.md             => default room
 * - /<room>/<filename>.md      => room-scoped document
 */
export function parseDocPath(pathname: string): { room: string; fileName: string } | null {
  const trimmed = pathname.replace(/^\/+|\/+$/g, '')
  if (!trimmed) return null

  const segments = trimmed.split('/')
  if (segments.length > 2) return null

  const decode = (segment: string): string | null => {
    try {
      return decodeURIComponent(segment)
    } catch {
      return null
    }
  }

  if (segments.length === 1) {
    const fileNameRaw = decode(segments[0] || '')
    const fileName = validateExistingMdFilename(fileNameRaw)
    if (!fileName) return null
    return { room: DEFAULT_ROOM, fileName }
  }

  const roomRaw = decode(segments[0] || '')
  const fileNameRaw = decode(segments[1] || '')
  const room = sanitizeRoomId(roomRaw)
  const fileName = validateExistingMdFilename(fileNameRaw)
  if (!room || !fileName) return null
  return { room, fileName }
}
