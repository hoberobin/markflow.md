import { useState, useEffect, type FormEvent } from 'react'
import type { WorkspaceFile } from '../hooks/useFiles'
import type { PresencePeer } from '../types'

export interface SidebarProps {
  files: WorkspaceFile[]
  loading: boolean
  filesError: string | null
  activeFile: string | null
  userName: string
  onRenameUser: (name: string) => void
  onSelect: (name: string) => void
  onCreate: (name: string) => Promise<WorkspaceFile>
  onDelete: (name: string) => void | Promise<void>
  presence: PresencePeer[]
}

export default function Sidebar({
  files,
  loading,
  filesError,
  activeFile,
  userName,
  onRenameUser,
  onSelect,
  onCreate,
  onDelete,
  presence
}: SidebarProps) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(userName)

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const file = await onCreate(newName.trim())
      onSelect(file.name)
      setNewName('')
      setCreating(false)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  useEffect(() => {
    if (!editingName) setNameDraft(userName)
  }, [userName, editingName])

  const filePresence: Record<string, PresencePeer[]> = {}
  presence.forEach(p => {
    if (p.file) {
      if (!filePresence[p.file]) filePresence[p.file] = []
      filePresence[p.file]!.push(p)
    }
  })

  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        background: 'var(--bg2)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--text3)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase'
          }}
        >
          workspace
        </span>
        <button
          type="button"
          onClick={() => {
            setCreating(true)
            setError('')
          }}
          title="New file"
          style={{
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg4)',
            borderRadius: 4,
            color: 'var(--text2)',
            fontSize: 16,
            lineHeight: 1
          }}
        >
          +
        </button>
      </div>

      {filesError && (
        <div
          style={{
            margin: '8px 12px 0',
            padding: '8px 10px',
            background: 'rgba(255,107,91,0.12)',
            border: '1px solid rgba(255,107,91,0.25)',
            borderRadius: 'var(--radius)',
            fontSize: 11,
            color: 'var(--coral)',
            fontFamily: 'var(--mono)',
            lineHeight: 1.45
          }}
        >
          Can’t reach server — is it running on port 4000?
        </div>
      )}

      {creating && (
        <form onSubmit={handleCreate} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="filename.md"
            onKeyDown={e => {
              if (e.key === 'Escape') {
                setCreating(false)
                setNewName('')
              }
            }}
            style={{ marginBottom: error ? 6 : 0 }}
          />
          {error && <div style={{ fontSize: 11, color: 'var(--coral)', marginTop: 4 }}>{error}</div>}
        </form>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {loading && files.length === 0 && !filesError && (
          <div style={{ padding: '24px 16px', color: 'var(--text3)', fontSize: 12, fontFamily: 'var(--mono)' }}>
            Loading…
          </div>
        )}
        {!loading && files.length === 0 && !creating && !filesError && (
          <div style={{ padding: '24px 16px', color: 'var(--text3)', fontSize: 13, lineHeight: 1.6 }}>
            No files yet.
            <br />
            Click + to create one.
          </div>
        )}
        {files.map(f => (
          <FileRow
            key={f.name}
            file={f}
            active={activeFile === f.name}
            onSelect={() => onSelect(f.name)}
            onDelete={() => void onDelete(f.name)}
            users={filePresence[f.name] || []}
          />
        ))}
      </div>

      <div
        style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--border)'
        }}
      >
        {editingName ? (
          <form
            onSubmit={e => {
              e.preventDefault()
              onRenameUser(nameDraft)
              setEditingName(false)
            }}
            style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: presence.length ? 8 : 0 }}
          >
            <input
              autoFocus
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={() => {
                onRenameUser(nameDraft)
                setEditingName(false)
              }}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setNameDraft(userName)
                  setEditingName(false)
                }
              }}
              style={{ flex: 1, fontSize: 11, padding: '6px 8px' }}
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            title="Click to change your name"
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              fontSize: 11,
              color: 'var(--text2)',
              fontFamily: 'var(--mono)',
              marginBottom: presence.length ? 8 : 0,
              padding: '2px 0'
            }}
          >
            You: <span style={{ color: 'var(--accent)' }}>{userName}</span>
          </button>
        )}
        {presence.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {presence.map(p => (
              <div
                key={p.clientId}
                title={p.name}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: p.color,
                  opacity: 0.8
                }}
              />
            ))}
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{presence.length} online</span>
          </div>
        )}
      </div>
    </aside>
  )
}

function FileRow({
  file,
  active,
  onSelect,
  onDelete,
  users
}: {
  file: WorkspaceFile
  active: boolean
  onSelect: () => void
  onDelete: () => void
  users: PresencePeer[]
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 12px',
        cursor: 'pointer',
        background: active ? 'var(--bg3)' : hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'all 0.1s'
      }}
    >
      <span
        onClick={onSelect}
        style={{
          flex: 1,
          fontFamily: 'var(--mono)',
          fontSize: 12,
          color: active ? 'var(--text)' : 'var(--text2)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {file.name}
      </span>

      {users.length > 0 && (
        <div style={{ display: 'flex', gap: 2, marginRight: 4 }}>
          {users.slice(0, 3).map(u => (
            <div
              key={u.clientId}
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: u.color
              }}
            />
          ))}
        </div>
      )}

      {hovered && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            if (confirm(`Delete ${file.name}?`)) onDelete()
          }}
          style={{ color: 'var(--text3)', fontSize: 14, padding: '0 2px', lineHeight: 1 }}
          title="Delete"
        >
          ×
        </button>
      )}
    </div>
  )
}
