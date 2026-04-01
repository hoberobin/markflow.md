import { useEffect, useMemo, useRef, useState } from 'react'
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

const COLORS = ['#c8f060', '#60c8f0', '#f060c8', '#f0c860', '#60f0c8', '#f06060', '#c860f0']

function getColor(name: string): string {
  let h = 0
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h)
  return COLORS[Math.abs(h) % COLORS.length]!
}

function CollabEditor({
  userName,
  onContentChange,
  onPresenceChange
}: {
  userName: string
  onContentChange: (text: string) => void
  onPresenceChange: (states: PresencePeer[]) => void
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

    return () => {
      providerRef.current = null
      docRef.current = null
      view.destroy()
      provider.destroy()
      ydoc.destroy()
    }
  }, [onContentChange, onPresenceChange])

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
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

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
        </div>
        <div className="topbar-actions">
          <button className="topbar-action" type="button" onClick={() => setPreview(false)}>
            Edit
          </button>
          <button className="topbar-action" type="button" onClick={() => setPreview(true)}>
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

      <div className="workspace-content">
        {preview ? (
          <div className="preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        ) : (
          <CollabEditor userName={userName} onContentChange={setContent} onPresenceChange={setPresence} />
        )}
      </div>
    </div>
  )
}
