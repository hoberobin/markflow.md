import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react'
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
import Sidebar from './components/Sidebar'
import { useFiles } from './hooks/useFiles'
import { getWsUrl, getServerUrl } from './config'
import type { PresencePeer } from './types'
import { DEFAULT_ROOM, generateRoomId, readRoomFromLocation, sanitizeRoomId, writeRoomToLocation } from './utils/room'

const COLORS = ['#c8f060', '#60c8f0', '#f060c8', '#f0c860', '#60f0c8', '#f06060', '#c860f0']

function getColor(name: string): string {
  let h = 0
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h)
  return COLORS[Math.abs(h) % COLORS.length]!
}

const NAMES = ['Ash', 'River', 'Quinn', 'Sage', 'Scout', 'Blake', 'Avery', 'Finley']
function randomName(): string {
  return NAMES[Math.floor(Math.random() * NAMES.length)]! + Math.floor(Math.random() * 99)
}

function hasRoomQueryParam(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has('room')
}

interface CollabEditorProps {
  room: string
  fileName: string
  userName: string
  onContentChange?: (text: string) => void
  onPresenceChange?: (states: PresencePeer[]) => void
}

// ── Collaborative Editor ──────────────────────────────────────────────────────
function CollabEditor({
  room,
  fileName,
  userName,
  onContentChange,
  onPresenceChange
}: CollabEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!fileName || !containerRef.current) return

    const ydoc = new Y.Doc()
    const ytext = ydoc.getText('content')
    const roomPath = `${encodeURIComponent(room)}/${encodeURIComponent(fileName)}`
    const provider = new WebsocketProvider(getWsUrl(), roomPath, ydoc)

    provider.awareness.setLocalStateField('user', { name: userName, color: getColor(userName) })
    provider.awareness.setLocalStateField('file', fileName)

    provider.awareness.on('change', () => {
      const states: PresencePeer[] = []
      provider.awareness.getStates().forEach((state, clientId) => {
        if (clientId !== ydoc.clientID && state.user) {
          const u = state.user as { name: string; color: string }
          states.push({ clientId, name: u.name, color: u.color, file: state.file as string | undefined })
        }
      })
      onPresenceChange?.(states)
    })

    ytext.observe(() => onContentChange?.(ytext.toString()))

    const customTheme = EditorView.theme({
      '&': { background: 'transparent !important', height: '100%' },
      '.cm-content': {
        fontFamily: "'DM Mono', monospace",
        fontSize: '14px',
        lineHeight: '1.85',
        padding: '32px 40px'
      },
      '.cm-scroller': { overflow: 'auto' },
      '.cm-gutters': { display: 'none !important' },
      '.cm-activeLine': { background: 'rgba(255,255,255,0.018) !important' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent) !important' },
      '.cm-selectionBackground': { background: 'rgba(200,240,96,0.12) !important' },
      '&.cm-focused .cm-selectionBackground': { background: 'rgba(200,240,96,0.15) !important' },
      '.cm-focused': { outline: 'none !important' },
      '.cm-line': { padding: '0' }
    })

    const state = EditorState.create({
      extensions: [
        basicSetup,
        markdown(),
        oneDark,
        customTheme,
        yCollab(ytext, provider.awareness),
        EditorView.lineWrapping
      ]
    })

    const view = new EditorView({ state, parent: containerRef.current })

    return () => {
      view.destroy()
      provider.destroy()
      ydoc.destroy()
    }
  }, [room, fileName, userName])

  return <div ref={containerRef} style={{ height: '100%', overflow: 'hidden' }} />
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [room, setRoom] = useState(() => readRoomFromLocation())
  const [workspaceEntered, setWorkspaceEntered] = useState(() => hasRoomQueryParam())
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [userName, setUserName] = useState(() => {
    const saved = localStorage.getItem('mf_name')
    if (saved) return saved
    const n = randomName()
    localStorage.setItem('mf_name', n)
    return n
  })
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState(false)
  const [presence, setPresence] = useState<PresencePeer[]>([])
  const [createFormSignal, setCreateFormSignal] = useState(0)
  const { files, loading, error: filesError, createFile, deleteFile, refresh } = useFiles(room)

  useEffect(() => {
    const id = setInterval(() => void refresh(), 5000)
    return () => clearInterval(id)
  }, [refresh])

  useEffect(() => {
    if (!workspaceEntered) return
    writeRoomToLocation(room)
  }, [room, workspaceEntered])

  useEffect(() => {
    if (!workspaceEntered) return
    setActiveFile(null)
    setContent('')
    setPresence([])
  }, [room, workspaceEntered])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(max-width: 900px)')
    const apply = () => setSidebarOpen(!media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  function saveUserName(next: string) {
    const t = (next || '').trim() || randomName()
    localStorage.setItem('mf_name', t)
    setUserName(t)
  }

  function downloadActiveFile() {
    if (!activeFile) return
    const url = `${getServerUrl()}/files/${encodeURIComponent(activeFile)}/raw?room=${encodeURIComponent(room)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function downloadWorkspace() {
    const url = `${getServerUrl()}/export/workspace.zip?room=${encodeURIComponent(room)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function copyShareLink() {
    const url = new URL(window.location.href)
    url.searchParams.set('room', room)
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url.toString())
      return
    }
    window.prompt('Copy this room link:', url.toString())
  }

  const activePresence = presence.filter(p => p.file === activeFile)

  const previewHtml = useMemo(() => {
    const parsed = marked.parse(content || '', { async: false }) as string
    return DOMPurify.sanitize(parsed)
  }, [content])

  const openWorkspaceWithRoom = (nextRoom: string) => {
    setRoom(sanitizeRoomId(nextRoom))
    setWorkspaceEntered(true)
  }

  if (!workspaceEntered) {
    return (
      <Landing
        initialRoom={room}
        onJoinRoom={nextRoom => openWorkspaceWithRoom(nextRoom)}
        onCreateRoom={() => openWorkspaceWithRoom(generateRoomId())}
      />
    )
  }

  return (
    <div className="app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <button
        type="button"
        className="mobile-sidebar-toggle"
        onClick={() => setSidebarOpen(prev => !prev)}
        aria-expanded={sidebarOpen}
        aria-label={sidebarOpen ? 'Close workspace sidebar' : 'Open workspace sidebar'}
      >
        {sidebarOpen ? 'Close' : 'Files'}
      </button>
      <Sidebar
        mobileOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        files={files}
        loading={loading}
        filesError={filesError}
        activeFile={activeFile}
        room={room}
        userName={userName}
        onChangeRoom={next => setRoom(sanitizeRoomId(next))}
        onGenerateRoom={() => setRoom(generateRoomId())}
        onCopyShareLink={copyShareLink}
        onRenameUser={saveUserName}
        onSelect={name => {
          setActiveFile(name)
          setContent('')
          if (window.matchMedia('(max-width: 900px)').matches) setSidebarOpen(false)
        }}
        onCreate={createFile}
        onDelete={async name => {
          await deleteFile(name)
          if (activeFile === name) {
            setActiveFile(null)
            setContent('')
          }
        }}
        presence={presence}
        createFormSignal={createFormSignal}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header
          className="topbar"
          style={{
            height: 44,
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: 8,
            background: 'var(--bg2)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0
          }}
        >
          <button
            type="button"
            className="mobile-inline-toggle"
            onClick={() => setSidebarOpen(prev => !prev)}
            aria-expanded={sidebarOpen}
            aria-label="Toggle workspace sidebar"
          >
            ☰
          </button>
          <span
            className="topbar-file"
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 12,
              color: activeFile ? 'var(--text2)' : 'var(--text3)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {activeFile || '—'}
          </span>

          <div className="topbar-avatars" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {activePresence.map(p => (
              <Avatar key={p.clientId} name={p.name} color={p.color} />
            ))}
            <Avatar name={userName} color={getColor(userName)} self />
          </div>

          <Sep className="topbar-sep" />

          <IconBtn active={!preview} onClick={() => setPreview(false)} title="Edit" className="topbar-icon">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path
                d="M1.5 2h4v9h-4zM7.5 2h4v9h-4z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          </IconBtn>
          <IconBtn active={preview} onClick={() => setPreview(true)} title="Preview" className="topbar-icon">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path
                d="M1 6.5S3 2 6.5 2 12 6.5 12 6.5 10 11 6.5 11 1 6.5 1 6.5z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </IconBtn>

          <Sep className="topbar-sep" />

          <div className="topbar-actions">
            <button
              className="topbar-action"
              type="button"
              onClick={downloadActiveFile}
              disabled={!activeFile}
              style={{
                height: 28,
                padding: '0 10px',
                background: 'var(--bg4)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: 11,
                fontFamily: 'var(--mono)',
                color: activeFile ? 'var(--text2)' : 'var(--text3)',
                letterSpacing: '0.06em',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                opacity: activeFile ? 1 : 0.65
              }}
            >
              save .md
            </button>
            <button
              className="topbar-action"
              type="button"
              onClick={downloadWorkspace}
              style={{
                height: 28,
                padding: '0 10px',
                background: 'var(--bg4)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: 11,
                fontFamily: 'var(--mono)',
                color: 'var(--text2)',
                letterSpacing: '0.06em',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              download zip
            </button>
          </div>
        </header>

        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {!activeFile ? (
            <Empty onOpenCreateForm={() => setCreateFormSignal(n => n + 1)} />
          ) : preview ? (
            <div className="preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          ) : (
            <CollabEditor
              key={activeFile}
              room={room}
              fileName={activeFile}
              userName={userName}
              onContentChange={setContent}
              onPresenceChange={setPresence}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Landing({
  initialRoom,
  onJoinRoom,
  onCreateRoom
}: {
  initialRoom: string
  onJoinRoom: (room: string) => void
  onCreateRoom: () => void
}) {
  const [roomDraft, setRoomDraft] = useState(initialRoom === DEFAULT_ROOM ? '' : initialRoom)

  useEffect(() => {
    if (initialRoom === DEFAULT_ROOM) return
    setRoomDraft(initialRoom)
  }, [initialRoom])

  const roomPreview = sanitizeRoomId(roomDraft || DEFAULT_ROOM)
  const sharePreview =
    typeof window === 'undefined' ? `https://app.markflow.dev/?room=${roomPreview}` : `${window.location.origin}/?room=${roomPreview}`

  return (
    <main className="landing-shell">
      <section className="landing-card">
        <div className="landing-badge">MARKFLOW</div>
        <h1 className="landing-title">Collaborative markdown rooms for teams that move fast.</h1>
        <p className="landing-subtitle">
          Spin up a room in seconds, share one link, and edit docs together in real-time from your phone or computer.
        </p>

        <form
          className="landing-join-form"
          onSubmit={e => {
            e.preventDefault()
            onJoinRoom(roomDraft || DEFAULT_ROOM)
          }}
        >
          <label htmlFor="landing-room-input" className="landing-label">
            Room name
          </label>
          <div className="landing-join-row">
            <input
              id="landing-room-input"
              value={roomDraft}
              onChange={e => setRoomDraft(e.target.value)}
              placeholder="design-review"
              className="landing-input"
              autoFocus
            />
            <button type="submit" className="landing-btn landing-btn-primary">
              Join room
            </button>
          </div>
          <button type="button" className="landing-btn landing-btn-secondary" onClick={onCreateRoom}>
            Create a new room
          </button>
        </form>

        <div className="landing-link-preview">
          Share link preview: <span>{sharePreview}</span>
        </div>
      </section>

      <section className="landing-features">
        <article className="landing-feature">
          <h2>Live collaboration</h2>
          <p>Work in the same markdown file with shared presence and instant updates.</p>
        </article>
        <article className="landing-feature">
          <h2>Room-based workspaces</h2>
          <p>Each room stays isolated, so teams can split docs by project or sprint.</p>
        </article>
        <article className="landing-feature">
          <h2>Mobile-first access</h2>
          <p>Join from a phone, continue on desktop, and keep the same room link.</p>
        </article>
      </section>
    </main>
  )
}

function Avatar({ name, color, self }: { name: string; color: string; self?: boolean }) {
  return (
    <div
      title={name}
      style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 700,
        color: '#0e0e0f',
        fontFamily: 'var(--sans)',
        border: self ? '1.5px solid rgba(0,0,0,0.25)' : '1.5px solid transparent',
        flexShrink: 0
      }}
    >
      {name[0]!.toUpperCase()}
    </div>
  )
}

function Sep({ className }: { className?: string }) {
  return <div className={className} style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />
}

function IconBtn({
  active,
  onClick,
  title,
  children,
  className
}: {
  active: boolean
  onClick: () => void
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <button
      className={className}
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius)',
        background: active ? 'var(--bg4)' : 'transparent',
        border: active ? '1px solid var(--border)' : '1px solid transparent',
        color: active ? 'var(--text)' : 'var(--text3)',
        transition: 'all 0.1s'
      }}
    >
      {children}
    </button>
  )
}

function Empty({ onOpenCreateForm }: { onOpenCreateForm: () => void }) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: 'var(--text3)'
      }}
    >
      <div style={{ fontFamily: 'var(--serif)', fontSize: '2.4rem', fontStyle: 'italic', opacity: 0.3 }}>
        markflow
      </div>
      <div style={{ fontSize: 13 }}>
        Pick a file or{' '}
        <button
          type="button"
          onClick={onOpenCreateForm}
          style={{
            color: 'var(--accent)',
            fontFamily: 'var(--mono)',
            fontSize: 13,
            textDecoration: 'underline',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            padding: 0
          }}
        >
          create one
        </button>
      </div>
    </div>
  )
}
