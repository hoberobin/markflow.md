import { describe, expect, it } from 'vitest'
import { SHARED_DOC_KEY } from './collab'

describe('collab utils', () => {
  it('uses a stable shared document key', () => {
    expect(SHARED_DOC_KEY).toBe('shared')
  })
})
