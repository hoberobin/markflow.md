import React, { useEffect, useRef, useCallback } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { yCollab } from 'y-codemirror.next'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000'

const COLORS = ['#c8f060', '#60c8f0', '#f060c8', '#f0c860', '#60f0c8', '#f06060', '#c860f0']

function getColor(name) {
  let hash = 0
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

export default function Editor({ fileName, userName, onContentChange, onSelectionChange, onPresenceChange }) {
  const containerRef = useRef(null)
  const viewRef = useRef(null)
  const providerRef = useRef(null)
  const docRef = useRef(null)

  const cleanup = useCallback(() => {
    viewRef.current?.destroy()
    providerRef.current?.destroy()
    docRef.current?.destroy()
    viewRef.current = null
    providerRef.current = null
    docRef.current = null
  }, [])

  useEffect(() => {
    if (!fileName || !containerRef.current) return
    cleanup()

    const ydoc = new Y.Doc()
    const ytext = ydoc.getText('content')
    docRef.current = ydoc

    const provider = new WebsocketProvider(WS_URL, encodeURIComponent(fileName), ydoc)
    providerRef.current = provider

    const color = getColor(userName)
    provider.awareness.setLocalStateField('user', { name: userName, color })
    provider.awareness.setLocalStateField('file', fileName)

    // Track presence
    const updatePresence = () => {
      const states = []
      provider.awareness.getStates().forEach((state, clientId) => {
        if (clientId !== ydoc.clientID && state.user) {
          states.push({ clientId, name: state.user.name, color: state.user.color, file: state.file })
        }
      })
      onPresenceChange?.(states)
    }
    provider.awareness.on('change', updatePresence)

    // Track content changes
    const observer = () => {
      onContentChange?.(ytext.toString())
    }
    ytext.observe(observer)

    const updateTheme = EditorView.theme({
      '&': { background: 'transparent', height: '100%' },
      '.cm-content': { caretColor: 'var(--accent)', fontFamily: "'DM Mono', monospace" },
      '.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent)' },
    })

    const state = EditorState.create({
      extensions: [
        basicSetup,
        markdown(),
        oneDark,
        updateTheme,
        yCollab(ytext, provider.awareness),
        EditorView.updateListener.of(update => {
          if (update.selectionSet) {
            const sel = update.state.selection.main
            if (!sel.empty) {
              const text = update.state.doc.sliceString(sel.from, sel.to)
              onSelectionChange?.(text)
            } else {
              onSelectionChange?.('')
            }
          }
        }),
        EditorView.lineWrapping,
      ]
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    // Handle insert from Claude panel
    function handleInsert(e) {
      const { text, mode } = e.detail
      const v = viewRef.current
      if (!v) return
      const sel = v.state.selection.main
      if (mode === 'rewrite' && !sel.empty) {
        v.dispatch({ changes: { from: sel.from, to: sel.to, insert: text } })
      } else {
        // Insert at cursor or end
        const pos = sel.head
        const insert = '\n\n' + text.trim() + '\n'
        v.dispatch({ changes: { from: pos, insert } })
      }
      v.focus()
    }
    window.addEventListener('markflow:insert', handleInsert)

    return () => {
      window.removeEventListener('markflow:insert', handleInsert)
      cleanup()
    }
  }, [fileName, userName])

  return (
    <div ref={containerRef} style={{ height: '100%', overflow: 'hidden' }} />
  )
}
