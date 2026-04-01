import { describe, expect, it } from 'vitest'
import { DEFAULT_MARKDOWN, SHARED_DOC_KEY, parseDocPath } from './collab.js'

describe('collab utils', () => {
  it('provides a stable shared doc key and starter content', () => {
    expect(SHARED_DOC_KEY).toBe('shared')
    expect(DEFAULT_MARKDOWN.startsWith('# markflow.md')).toBe(true)
  })

  it('accepts root and shared doc websocket paths', () => {
    expect(parseDocPath('/')).toBe(SHARED_DOC_KEY)
    expect(parseDocPath('/shared')).toBe(SHARED_DOC_KEY)
    expect(parseDocPath('/shared.md')).toBe(SHARED_DOC_KEY)
    expect(parseDocPath('/api/shared')).toBe(SHARED_DOC_KEY)
    expect(parseDocPath('/api/v1/shared.md')).toBe(SHARED_DOC_KEY)
  })

  it('rejects non-shared paths', () => {
    expect(parseDocPath('/room-a/file.md')).toBeNull()
    expect(parseDocPath('/random')).toBeNull()
  })
})
