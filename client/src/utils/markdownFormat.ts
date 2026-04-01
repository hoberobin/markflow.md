import type { EditorView } from '@codemirror/view'

export interface MarkdownEdit {
  from: number
  to: number
  insert: string
  selectionFrom: number
  selectionTo: number
}

export function wrapSelection(
  text: string,
  from: number,
  to: number,
  prefix: string,
  suffix: string,
  placeholder: string
): MarkdownEdit {
  const selected = text.slice(from, to) || placeholder
  const insert = `${prefix}${selected}${suffix}`
  const selectionFrom = from + prefix.length
  const selectionTo = selectionFrom + selected.length
  return { from, to, insert, selectionFrom, selectionTo }
}

export function prefixSelectedLines(text: string, from: number, to: number, prefix: string): MarkdownEdit {
  const lineStart = text.lastIndexOf('\n', Math.max(0, from - 1)) + 1
  const nextLineBreak = text.indexOf('\n', to)
  const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak
  const block = text.slice(lineStart, lineEnd)
  const insert = block
    .split('\n')
    .map(line => `${prefix}${line}`)
    .join('\n')

  const touchedLinesBeforeTo = block.slice(0, Math.max(0, to - lineStart)).split('\n').length
  const selectionFrom = from + prefix.length
  const selectionTo = to + prefix.length * touchedLinesBeforeTo
  return { from: lineStart, to: lineEnd, insert, selectionFrom, selectionTo }
}

function applyEdit(view: EditorView, edit: MarkdownEdit): void {
  view.dispatch({
    changes: { from: edit.from, to: edit.to, insert: edit.insert },
    selection: { anchor: edit.selectionFrom, head: edit.selectionTo },
    scrollIntoView: true
  })
}

export function applyMarkdownWrapper(
  view: EditorView,
  prefix: string,
  suffix: string,
  placeholder = 'text'
): void {
  const selection = view.state.selection.main
  const doc = view.state.doc.toString()
  applyEdit(view, wrapSelection(doc, selection.from, selection.to, prefix, suffix, placeholder))
}

export function applyMarkdownPrefix(view: EditorView, prefix: string): void {
  const selection = view.state.selection.main
  const doc = view.state.doc.toString()
  applyEdit(view, prefixSelectedLines(doc, selection.from, selection.to, prefix))
}

export function applyMarkdownLink(view: EditorView): void {
  applyMarkdownWrapper(view, '[', '](https://example.com)', 'link text')
}
