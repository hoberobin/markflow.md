import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { yCollab } from 'y-codemirror.next'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { basicSetup } from 'codemirror'
import { getServerUrl, getWsUrl } from './config'
import type { PresencePeer } from './types'
import { SHARED_DOC_KEY } from './utils/collab'
import { copyCurrentUrl, randomName, readNameFromStorage, saveNameToStorage } from './utils/presence'
import { applyMarkdownWrapper, applyMarkdownPrefix, applyMarkdownLink } from './utils/markdownFormat'

const COLORS = ['#c8f060', '#60c8f0', '#f060c8', '#f0c860', '#60f0c8', '#f06060', '#c860f0']

function getColor(name: string): string {
  let h = 0
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h)
  return COLORS[Math.abs(h) % COLORS.length]!
}

function CollabEditor({
  userName,
  onContentChange,
  onPresenceChange,
  editorViewRef,
  onConnectionChange
}: {
  userName: string
  onContentChange: (text: string) => void
  onPresenceChange: (states: PresencePeer[]) => void
  editorViewRef: { current: EditorView | null }
  onConnectionChange: (connected: boolean) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const docRef = useRef<Y.Doc | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const ydoc = new Y.Doc()
    const ytext = ydoc.getText('content')
    const provider = new WebsocketProvider(getWsUrl(), SHARED_DOC_KEY, ydoc)
    providerRef.current = provider
    docRef.current = ydoc

    const applyPresence = () => {
      const states: PresencePeer[] = []
      provider.awareness.getStates().forEach((state, clientId) => {
        if (clientId === ydoc.clientID || !state.user) return
        const u = state.user as { name: string; color: string }
        states.push({ clientId, name: u.name, color: u.color })
      })
      onPresenceChange(states)
    }

    provider.awareness.on('change', applyPresence)
    provider.on('status', event => {
      onConnectionChange(event.status === 'connected')
    })
    ytext.observe(() => onContentChange(ytext.toString()))
    onContentChange(ytext.toString())
    applyPresence()

    const state = EditorState.create({
      extensions: [
        basicSetup,
        markdown(),
        oneDark,
        EditorView.theme({
          '&': { background: 'transparent !important', height: '100%' },
          '.cm-content': {
            fontFamily: "'DM Mono', monospace",
            fontSize: '14px',
            lineHeight: '1.85',
            padding: '32px 40px'
          },
          '.cm-scroller': { overflow: 'auto' },
          '.cm-gutters': { display: 'none !important' },
          '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent) !important' }
        }),
        yCollab(ytext, provider.awareness),
        EditorView.lineWrapping
      ]
    })

    const view = new EditorView({ state, parent: containerRef.current })
    editorViewRef.current = view

    return () => {
      providerRef.current = null
      docRef.current = null
      editorViewRef.current = null
      view.destroy()
      provider.destroy()
      ydoc.destroy()
      onConnectionChange(false)
    }
  }, [editorViewRef, onConnectionChange, onContentChange, onPresenceChange])

  useEffect(() => {
    const provider = providerRef.current
    const ydoc = docRef.current
    if (!provider || !ydoc) return
    provider.awareness.setLocalStateField('user', { name: userName, color: getColor(userName) })
  }, [userName])

  return <div ref={containerRef} style={{ height: '100%', overflow: 'hidden' }} />
}

export default function App() {
  const [userName, setUserName] = useState(() => readNameFromStorage() || randomName())
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState(false)
  const [presence, setPresence] = useState<PresencePeer[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const editorViewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    saveNameToStorage(userName)
  }, [userName])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'markflow.md'
    }
  }, [])

  const previewHtml = useMemo(() => {
    const parsed = marked.parse(content || '', { async: false }) as string
    return DOMPurify.sanitize(parsed)
  }, [content])

  const saveDocument = () => {
    window.open(`${getServerUrl()}/document/raw`, '_blank', 'noopener,noreferrer')
  }

  const shareLink = async () => {
    const ok = await copyCurrentUrl()
    setCopyState(ok ? 'copied' : 'failed')
    window.setTimeout(() => setCopyState('idle'), 1400)
  }

  const focusEditor = useCallback(() => {
    editorViewRef.current?.focus()
  }, [])

  const formatSelection = useCallback((kind: 'bold' | 'italic' | 'code') => {
    const view = editorViewRef.current
    if (!view) return
    if (kind === 'bold') applyMarkdownWrapper(view, '**', '**')
    if (kind === 'italic') applyMarkdownWrapper(view, '*', '*')
    if (kind === 'code') applyMarkdownWrapper(view, '`', '`')
    focusEditor()
  }, [focusEditor])

  const formatPrefix = useCallback((prefix: string) => {
    const view = editorViewRef.current
    if (!view) return
    applyMarkdownPrefix(view, prefix)
    focusEditor()
  }, [focusEditor])

  const insertLink = useCallback(() => {
    const view = editorViewRef.current
    if (!view) return
    applyMarkdownLink(view)
    focusEditor()
  }, [focusEditor])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey
      if (!mod || preview) return
      const key = event.key.toLowerCase()
      if (key === 'b') {
        event.preventDefault()
        formatSelection('bold')
      } else if (key === 'i') {
        event.preventDefault()
        formatSelection('italic')
      } else if (key === 'k') {
        event.preventDefault()
        insertLink()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [formatSelection, insertLink, preview])

  return (
    <div className="single-app">
      <header className="single-topbar">
        <div className="brand">markflow.md</div>
        <input
          className="name-input"
          value={userName}
          onChange={e => setUserName(e.target.value || randomName())}
          aria-label="Your name"
        />
        <div className="presence-badges">
          <span>{presence.length + 1} online</span>
          <span className="topbar-status" aria-live="polite">
            {isConnected ? 'Connected' : 'Connecting'}
          </span>
        </div>
        <div className="topbar-actions">
          <button
            className={`topbar-action ${!preview ? 'is-active' : ''}`}
            type="button"
            onClick={() => setPreview(false)}
          >
            Edit
          </button>
          <button
            className={`topbar-action ${preview ? 'is-active' : ''}`}
            type="button"
            onClick={() => setPreview(true)}
          >
            Preview
          </button>
          <button className="topbar-action" type="button" onClick={shareLink}>
            {copyState === 'copied' ? 'Copied URL' : copyState === 'failed' ? 'Copy failed' : 'Copy URL'}
          </button>
          <button className="topbar-action" type="button" onClick={saveDocument}>
            Download .md
          </button>
        </div>
      </header>

      <div className="toolbar" role="toolbar" aria-label="Markdown formatting tools">
        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => formatSelection('bold')}
            title="Bold (Ctrl/Cmd+B)"
          >
            B
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => formatSelection('italic')}
            title="Italic (Ctrl/Cmd+I)"
          >
            I
          </button>
          <button type="button" className="toolbar-btn" onClick={() => formatSelection('code')} title="Inline code">
            {'</>'}
          </button>
          <button type="button" className="toolbar-btn" onClick={() => formatPrefix('# ')} title="Heading">
            H1
          </button>
          <button type="button" className="toolbar-btn" onClick={() => formatPrefix('- ')} title="Bulleted list">
            • List
          </button>
          <button type="button" className="toolbar-btn" onClick={() => formatPrefix('1. ')} title="Numbered list">
            1. List
          </button>
          <button type="button" className="toolbar-btn" onClick={() => formatPrefix('> ')} title="Blockquote">
            Quote
          </button>
          <button type="button" className="toolbar-btn" onClick={insertLink} title="Insert link (Ctrl/Cmd+K)">
            Link
          </button>
        </div>
        <div className="toolbar-sep" aria-hidden="true" />
        <div className="toolbar-hint">Markdown helper toolbar</div>
      </div>

      <div className="workspace-content">
        {preview ? (
          <div className="preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        ) : (
          <CollabEditor
            userName={userName}
            onContentChange={setContent}
            onPresenceChange={setPresence}
            editorViewRef={editorViewRef}
            onConnectionChange={setIsConnected}
          />
        )}
      </div>
    </div>
  )
}
