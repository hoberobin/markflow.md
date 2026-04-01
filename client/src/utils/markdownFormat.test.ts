import { describe, expect, it } from 'vitest'
import { prefixSelectedLines, wrapSelection } from './markdownFormat'

describe('markdown formatter helpers', () => {
  it('wraps selected text for inline marks', () => {
    const text = 'hello world'
    const edit = wrapSelection(text, 6, 11, '**', '**', 'text')
    const updated = text.slice(0, edit.from) + edit.insert + text.slice(edit.to)
    expect(updated).toBe('hello **world**')
    expect(edit.selectionFrom).toBe(8)
    expect(edit.selectionTo).toBe(13)
  })

  it('prefixes selected lines for list style', () => {
    const text = 'one\ntwo'
    const edit = prefixSelectedLines(text, 0, text.length, '- ')
    const updated = text.slice(0, edit.from) + edit.insert + text.slice(edit.to)
    expect(updated).toBe('- one\n- two')
  })
})
