import React, { useState, useEffect, useRef } from 'react'
import { marked } from 'marked'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { yCollab } from 'y-codemirror.next'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { basicSetup } from 'codemirror'
import Sidebar from './components/Sidebar.jsx'
import ClaudePanel from './components/ClaudePanel.jsx'
import { useFiles } from './hooks/useFiles.js'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000'
const COLORS = ['#c8f060','#60c8f0','#f060c8','#f0c860','#60f0c8','#f06060','#c860f0']

function getColor(name) {
  let h = 0
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h)
  return COLORS[Math.abs(h) % COLORS.length]
}

const NAMES = ['Ash','River','Quinn','Sage','Scout','Blake','Avery','Finley']
function randomName() {
  return NAMES[Math.floor(Math.random() * NAMES.length)] + Math.floor(Math.random() * 99)
}

// ── Collaborative Editor ──────────────────────────────────────────────────────
function CollabEditor({ fileName, userName, onContentChange, onSelectionChange, onPresenceChange, insertSignal }) {
  const containerRef = useRef(null)
  const viewRef = useRef(null)
  const lastSignalRef = useRef(null)

  // Handle insert signals from Claude panel
  useEffect(() => {
    if (!insertSignal || insertSignal.ts === lastSignalRef.current) return
    lastSignalRef.current = insertSignal.ts
    const view = viewRef.current
    if (!view) return
    const sel = view.state.selection.main
    const pos = sel.empty ? sel.from : sel.to
    const toInsert = '\n\n' + insertSignal.text.trim()
    view.dispatch({
      changes: { from: pos, insert: toInsert },
      selection: { anchor: pos + toInsert.length }
    })
    view.focus()
  }, [insertSignal])

  useEffect(() => {
    if (!fileName || !containerRef.current) return

    const ydoc = new Y.Doc()
    const ytext = ydoc.getText('content')
    const provider = new WebsocketProvider(WS_URL, encodeURIComponent(fileName), ydoc)

    provider.awareness.setLocalStateField('user', { name: userName, color: getColor(userName) })
    provider.awareness.setLocalStateField('file', fileName)

    provider.awareness.on('change', () => {
      const states = []
      provider.awareness.getStates().forEach((state, clientId) => {
        if (clientId !== ydoc.clientID && state.user) {
          states.push({ clientId, name: state.user.name, color: state.user.color, file: state.file })
        }
      })
      onPresenceChange?.(states)
    })

    ytext.observe(() => onContentChange?.(ytext.toString()))

    const customTheme = EditorView.theme({
      '&': { background: 'transparent !important', height: '100%' },
      '.cm-content': { fontFamily: "'DM Mono', monospace", fontSize: '14px', lineHeight: '1.85', padding: '32px 40px' },
      '.cm-scroller': { overflow: 'auto' },
      '.cm-gutters': { display: 'none !important' },
      '.cm-activeLine': { background: 'rgba(255,255,255,0.018) !important' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent) !important' },
      '.cm-selectionBackground': { background: 'rgba(200,240,96,0.12) !important' },
      '&.cm-focused .cm-selectionBackground': { background: 'rgba(200,240,96,0.15) !important' },
      '.cm-focused': { outline: 'none !important' },
      '.cm-line': { padding: '0' },
    })

    const state = EditorState.create({
      extensions: [
        basicSetup,
        markdown(),
        oneDark,
        customTheme,
        yCollab(ytext, provider.awareness),
        EditorView.lineWrapping,
        EditorView.updateListener.of(u => {
          if (u.selectionSet) {
            const sel = u.state.selection.main
            onSelectionChange?.(sel.empty ? '' : u.state.doc.sliceString(sel.from, sel.to))
          }
        })
      ]
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    return () => {
      view.destroy()
      provider.destroy()
      ydoc.destroy()
      viewRef.current = null
    }
  }, [fileName, userName])

  return <div ref={containerRef} style={{ height: '100%', overflow: 'hidden' }} />
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [userName] = useState(() => {
    const saved = localStorage.getItem('mf_name')
    if (saved) return saved
    const n = randomName()
    localStorage.setItem('mf_name', n)
    return n
  })

  const [activeFile, setActiveFile] = useState(null)
  const [content, setContent] = useState('')
  const [selection, setSelection] = useState('')
  const [preview, setPreview] = useState(false)
  const [claudeOpen, setClaudeOpen] = useState(false)
  const [presence, setPresence] = useState([])
  const [insertSignal, setInsertSignal] = useState(null)
  const { files, loading, createFile, deleteFile, refresh } = useFiles()

  useEffect(() => {
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [refresh])

  function handleInsert(text) {
    setInsertSignal({ text, ts: Date.now() })
  }

  const activePresence = presence.filter(p => p.file === activeFile)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <Sidebar
        files={files}
        activeFile={activeFile}
        onSelect={name => { setActiveFile(name); setContent(''); setSelection('') }}
        onCreate={createFile}
        onDelete={async name => {
          await deleteFile(name)
          if (activeFile === name) { setActiveFile(null); setContent('') }
        }}
        presence={presence}
      />

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Toolbar */}
        <header style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 8,
          background: 'var(--bg2)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: activeFile ? 'var(--text2)' : 'var(--text3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeFile || '—'}
          </span>

          {/* Presence */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {activePresence.map(p => (
              <Avatar key={p.clientId} name={p.name} color={p.color} />
            ))}
            <Avatar name={userName} color={getColor(userName)} self />
          </div>

          <Sep />

          <IconBtn active={!preview} onClick={() => setPreview(false)} title="Edit">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 2h4v9h-4zM7.5 2h4v9h-4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
          </IconBtn>
          <IconBtn active={preview} onClick={() => setPreview(true)} title="Preview">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 6.5S3 2 6.5 2 12 6.5 12 6.5 10 11 6.5 11 1 6.5 1 6.5z" stroke="currentColor" strokeWidth="1.2"/><circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/></svg>
          </IconBtn>

          <Sep />

          <button
            onClick={() => setClaudeOpen(o => !o)}
            style={{
              height: 28,
              padding: '0 10px',
              background: claudeOpen ? 'rgba(200,240,96,0.1)' : 'var(--bg4)',
              border: `1px solid ${claudeOpen ? 'rgba(200,240,96,0.25)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              fontSize: 11,
              fontFamily: 'var(--mono)',
              color: claudeOpen ? 'var(--accent)' : 'var(--text2)',
              letterSpacing: '0.06em',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 5
            }}
          >
            <span style={{ fontSize: 10 }}>✦</span> claude
          </button>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {!activeFile ? (
            <Empty onNew={async () => { const f = await createFile('untitled'); setActiveFile(f.name) }} />
          ) : preview ? (
            <div className="preview" dangerouslySetInnerHTML={{ __html: marked.parse(content || '') }} />
          ) : (
            <CollabEditor
              key={activeFile}
              fileName={activeFile}
              userName={userName}
              onContentChange={setContent}
              onSelectionChange={setSelection}
              onPresenceChange={setPresence}
              insertSignal={insertSignal}
            />
          )}
        </div>
      </div>

      {/* Claude panel */}
      <ClaudePanel
        content={content}
        selection={selection}
        onInsert={handleInsert}
        visible={claudeOpen}
        onClose={() => setClaudeOpen(false)}
      />
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Avatar({ name, color, self }) {
  return (
    <div title={name} style={{
      width: 24, height: 24,
      borderRadius: '50%',
      background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontWeight: 700, color: '#0e0e0f',
      fontFamily: 'var(--sans)',
      border: self ? '1.5px solid rgba(0,0,0,0.25)' : '1.5px solid transparent',
      flexShrink: 0
    }}>
      {name[0].toUpperCase()}
    </div>
  )
}

function Sep() {
  return <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />
}

function IconBtn({ active, onClick, title, children }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 28, height: 28,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 'var(--radius)',
      background: active ? 'var(--bg4)' : 'transparent',
      border: active ? '1px solid var(--border)' : '1px solid transparent',
      color: active ? 'var(--text)' : 'var(--text3)',
      transition: 'all 0.1s'
    }}>
      {children}
    </button>
  )
}

function Empty({ onNew }) {
  return (
    <div style={{
      height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 12, color: 'var(--text3)'
    }}>
      <div style={{ fontFamily: 'var(--serif)', fontSize: '2.4rem', fontStyle: 'italic', opacity: 0.3 }}>
        markflow
      </div>
      <div style={{ fontSize: 13 }}>
        Pick a file or{' '}
        <button onClick={onNew} style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', fontSize: 13, textDecoration: 'underline' }}>
          create one
        </button>
      </div>
    </div>
  )
}
