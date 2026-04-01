import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ROOM,
  getDocKey,
  normalizeMdFilename,
  parseDocPath,
  parseRoom,
  sanitizeRoomId,
  validateExistingMdFilename
} from './workspace.js'

describe('workspace utils', () => {
  it('normalizes markdown filenames', () => {
    expect(normalizeMdFilename('notes')).toBe('notes.md')
    expect(normalizeMdFilename('notes.md')).toBe('notes.md')
    expect(normalizeMdFilename('')).toBeNull()
  })

  it('validates existing markdown names exactly', () => {
    expect(validateExistingMdFilename('draft.md')).toBe('draft.md')
    expect(validateExistingMdFilename('draft')).toBeNull()
    expect(validateExistingMdFilename('../draft.md')).toBeNull()
    expect(validateExistingMdFilename('nested/draft.md')).toBeNull()
  })

  it('sanitizes and parses rooms', () => {
    expect(sanitizeRoomId(' Team Alpha ')).toBe('team-alpha')
    expect(parseRoom(undefined)).toBe(DEFAULT_ROOM)
    expect(parseRoom('')).toBe(DEFAULT_ROOM)
    expect(parseRoom('my-room')).toBe('my-room')
  })

  it('builds doc keys and parses websocket paths', () => {
    expect(getDocKey('room-a', 'doc.md')).toBe('room-a/doc.md')
    expect(parseDocPath('/doc.md')).toEqual({ room: DEFAULT_ROOM, fileName: 'doc.md' })
    expect(parseDocPath('/room-a/doc.md')).toEqual({ room: 'room-a', fileName: 'doc.md' })
    expect(parseDocPath('/room-a/not-md')).toBeNull()
    expect(parseDocPath('/a/b/c.md')).toBeNull()
  })
})
