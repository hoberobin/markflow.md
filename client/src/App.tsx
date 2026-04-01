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
  const [workspaceEntered, setWorkspaceEntered] = useState(false)
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
  const { files, loading, error: filesError, createFile, deleteFile, refresh } = useFiles(room, workspaceEntered)

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

  const connectToRoom = (nextRoom: string) => {
    setRoom(sanitizeRoomId(nextRoom))
    setWorkspaceEntered(true)
  }

  if (!workspaceEntered) {
    return (
      <RoomConnectDialog
        initialRoom={room}
        onJoinRoom={nextRoom => connectToRoom(nextRoom)}
        onCreateRoom={() => connectToRoom(generateRoomId())}
      />
    )
  }

  return (
    <div className="app-shell">
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

      <div className="workspace-main">
        <header className="topbar">
          <button
            type="button"
            className="mobile-inline-toggle"
            onClick={() => setSidebarOpen(prev => !prev)}
            aria-expanded={sidebarOpen}
            aria-label="Toggle workspace sidebar"
          >
            ☰
          </button>
          <span className={`topbar-file ${activeFile ? 'is-active' : ''}`}>
            {activeFile || '—'}
          </span>

          <div className="topbar-avatars">
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
            >
              save .md
            </button>
            <button
              className="topbar-action"
              type="button"
              onClick={downloadWorkspace}
            >
              download zip
            </button>
          </div>
        </header>

        <div className="workspace-content">
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
function RoomConnectDialog({
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
    typeof window === 'undefined' ? `https://markflowmd.com/?room=${roomPreview}` : `${window.location.origin}/?room=${roomPreview}`

  return (
    <main className="connect-shell">
      <section className="connect-dialog" role="dialog" aria-modal="true" aria-labelledby="room-connect-title">
        <div className="connect-badge">MARKFLOW.MD</div>
        <h1 id="room-connect-title" className="connect-title">
          Connect to a room
        </h1>
        <p className="connect-subtitle">Join an existing room or create a new one before entering the workspace.</p>

        <form
          className="connect-form"
          onSubmit={e => {
            e.preventDefault()
            onJoinRoom(roomDraft || DEFAULT_ROOM)
          }}
        >
          <label htmlFor="room-connect-input" className="connect-label">
            Room name
          </label>
          <div className="connect-row">
            <input
              id="room-connect-input"
              value={roomDraft}
              onChange={e => setRoomDraft(e.target.value)}
              placeholder="design-review"
              className="connect-input"
              autoFocus
            />
            <button type="submit" className="connect-btn connect-btn-primary">
              Connect
            </button>
          </div>
          <button type="button" className="connect-btn connect-btn-secondary" onClick={onCreateRoom}>
            Create and connect
          </button>
        </form>

        <div className="connect-link-preview">
          Room link preview: <span>{sharePreview}</span>
        </div>
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
  const classes = ['icon-btn']
  if (className) classes.push(className)
  if (active) classes.push('icon-btn-active')

  return (
    <button
      className={classes.join(' ')}
      type="button"
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  )
}

function Empty({ onOpenCreateForm }: { onOpenCreateForm: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-state-title">
        markflow.md
      </div>
      <div className="empty-state-subtitle">
        Pick a file or{' '}
        <button
          type="button"
          onClick={onOpenCreateForm}
          className="empty-state-link"
        >
          create one
        </button>
      </div>
    </div>
  )
}
