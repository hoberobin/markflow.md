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
import { getServerCandidatesForClient, getWsUrlForServer } from './config'
import type { PresencePeer } from './types'
import { SHARED_DOC_KEY } from './utils/collab'
import { copyCurrentUrl } from './utils/presence'
import { applyMarkdownWrapper, applyMarkdownPrefix, applyMarkdownLink } from './utils/markdownFormat'

const SESSION_NAME = 'Teammate'
const SESSION_COLOR = '#c8f060'

function CollabEditor({
  serverUrl,
  onContentChange,
  onPresenceChange,
  editorViewRef,
  onConnectionChange
}: {
  serverUrl: string
  onContentChange: (text: string) => void
  onPresenceChange: (states: PresencePeer[]) => void
  editorViewRef: { current: EditorView | null }
  onConnectionChange: (connected: boolean) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const ydoc = new Y.Doc()
    const ytext = ydoc.getText('content')
    const provider = new WebsocketProvider(getWsUrlForServer(serverUrl), SHARED_DOC_KEY, ydoc)
    provider.awareness.setLocalStateField('user', { name: SESSION_NAME, color: SESSION_COLOR })

    const applyPresence = () => {
      const states: PresencePeer[] = []
      provider.awareness.getStates().forEach((state, clientId) => {
        if (clientId === ydoc.clientID || !state.user) return
        const u = state.user as { name?: string; color?: string }
        states.push({ clientId, name: u.name || SESSION_NAME, color: u.color || SESSION_COLOR })
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
      editorViewRef.current = null
      view.destroy()
      provider.destroy()
      ydoc.destroy()
      onConnectionChange(false)
    }
  }, [editorViewRef, onConnectionChange, onContentChange, onPresenceChange, serverUrl])

  return <div ref={containerRef} style={{ height: '100%', overflow: 'hidden' }} />
}

export default function App() {
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState(false)
  const [presence, setPresence] = useState<PresencePeer[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading' | 'failed'>('idle')
  const [serverCandidates] = useState<string[]>(() => getServerCandidatesForClient())
  const [serverIndex, setServerIndex] = useState(0)
  const editorViewRef = useRef<EditorView | null>(null)

  const serverUrl = serverCandidates[serverIndex] || serverCandidates[0] || window.location.origin

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'markflow.md'
    }
  }, [])

  useEffect(() => {
    if (isConnected) return
    if (serverIndex >= serverCandidates.length - 1) return
    const timer = setTimeout(() => {
      setServerIndex(index => Math.min(index + 1, serverCandidates.length - 1))
    }, 1000)
    return () => clearTimeout(timer)
  }, [isConnected, serverCandidates.length, serverIndex])

  const previewHtml = useMemo(() => {
    const parsed = marked.parse(content || '', { async: false }) as string
    return DOMPurify.sanitize(parsed)
  }, [content])

  const documentStats = useMemo(() => {
    const trimmed = content.trim()
    return {
      words: trimmed ? trimmed.split(/\s+/).length : 0,
      lines: content.length ? content.split('\n').length : 1,
      chars: content.length
    }
  }, [content])

  const saveDocument = useCallback(() => {
    setDownloadState('downloading')
    try {
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
      const downloadUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = downloadUrl
      anchor.download = `${SHARED_DOC_KEY}.md`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(downloadUrl)
      setDownloadState('idle')
    } catch {
      setDownloadState('failed')
      window.setTimeout(() => setDownloadState('idle'), 1500)
    }
  }, [content])

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
    if (preview) return
    const rafId = window.requestAnimationFrame(() => {
      focusEditor()
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [focusEditor, preview])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      if (mod && event.shiftKey && key === 'p') {
        event.preventDefault()
        setPreview(v => !v)
        return
      }
      if (!mod || preview) return
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
        <div className="presence-badges">
          <span>{presence.length + 1} online</span>
          <span className={`topbar-status ${isConnected ? 'is-connected' : 'is-connecting'}`} aria-live="polite">
            {isConnected ? 'Connected' : 'Connecting'}
          </span>
        </div>
        <div className="topbar-actions">
          <div className="mode-switch" role="tablist" aria-label="Editor mode">
            <button
              id="editor-tab"
              role="tab"
              aria-controls="editor-panel"
              aria-selected={!preview}
              className={`mode-switch-btn ${!preview ? 'is-active' : ''}`}
              type="button"
              onClick={() => setPreview(false)}
            >
              Edit
            </button>
            <button
              id="preview-tab"
              role="tab"
              aria-controls="preview-panel"
              aria-selected={preview}
              className={`mode-switch-btn ${preview ? 'is-active' : ''}`}
              type="button"
              onClick={() => setPreview(true)}
            >
              Preview
            </button>
          </div>
          <div className="topbar-utility-actions">
            <button className="topbar-action" type="button" onClick={shareLink}>
              {copyState === 'copied' ? 'Copied URL' : copyState === 'failed' ? 'Copy failed' : 'Copy URL'}
            </button>
            <button className="topbar-action" type="button" onClick={saveDocument} disabled={downloadState === 'downloading'}>
              {downloadState === 'downloading' ? 'Downloading...' : downloadState === 'failed' ? 'Download failed' : 'Download .md'}
            </button>
          </div>
        </div>
      </header>

      <div className="toolbar" role="toolbar" aria-label="Markdown formatting tools">
        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => formatSelection('bold')}
            title="Bold (Ctrl/Cmd+B)"
            disabled={preview}
          >
            B
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => formatSelection('italic')}
            title="Italic (Ctrl/Cmd+I)"
            disabled={preview}
          >
            I
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => formatSelection('code')}
            title="Inline code"
            disabled={preview}
          >
            {'</>'}
          </button>
          <button type="button" className="toolbar-btn" onClick={() => formatPrefix('# ')} title="Heading" disabled={preview}>
            H1
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => formatPrefix('- ')}
            title="Bulleted list"
            disabled={preview}
          >
            • List
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => formatPrefix('1. ')}
            title="Numbered list"
            disabled={preview}
          >
            1. List
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => formatPrefix('> ')}
            title="Blockquote"
            disabled={preview}
          >
            Quote
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={insertLink}
            title="Insert link (Ctrl/Cmd+K)"
            disabled={preview}
          >
            Link
          </button>
        </div>
        <div className="toolbar-sep" aria-hidden="true" />
        <div className="toolbar-hint">Markdown helper toolbar</div>
        <div className="toolbar-meta" aria-live="polite">
          {documentStats.words} words · {documentStats.lines} lines · {documentStats.chars} chars
        </div>
      </div>

      <div className="workspace-content">
        <div
          id="editor-panel"
          role="tabpanel"
          aria-labelledby="editor-tab"
          className={`workspace-panel workspace-panel-editor ${preview ? 'is-hidden' : 'is-active'}`}
        >
          <CollabEditor
            key={serverUrl}
            serverUrl={serverUrl}
            onContentChange={setContent}
            onPresenceChange={setPresence}
            editorViewRef={editorViewRef}
            onConnectionChange={setIsConnected}
          />
        </div>
        <div
          id="preview-panel"
          role="tabpanel"
          aria-labelledby="preview-tab"
          className={`workspace-panel preview workspace-panel-preview ${preview ? 'is-active' : 'is-hidden'}`}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>
    </div>
  )
}
