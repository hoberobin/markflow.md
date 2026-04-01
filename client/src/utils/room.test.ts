import { describe, expect, it } from 'vitest'
import { DEFAULT_ROOM, generateRoomId, sanitizeRoomId } from './room'

describe('room utils', () => {
  it('sanitizes room ids into shareable slugs', () => {
    expect(sanitizeRoomId(' Team A ')).toBe('team-a')
    expect(sanitizeRoomId('cool_room@2026')).toBe('cool-room-2026')
    expect(sanitizeRoomId('')).toBe(DEFAULT_ROOM)
  })

  it('generates stable room prefix', () => {
    const room = generateRoomId()
    expect(room.startsWith('room-')).toBe(true)
    expect(room.length).toBeLessThanOrEqual(48)
  })
})
