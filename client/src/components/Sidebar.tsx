import { useState, useEffect, type FormEvent } from 'react'
import type { WorkspaceFile } from '../hooks/useFiles'
import type { PresencePeer } from '../types'

export interface SidebarProps {
  files: WorkspaceFile[]
  loading: boolean
  filesError: string | null
  activeFile: string | null
  room: string
  userName: string
  onChangeRoom: (room: string) => void
  onGenerateRoom: () => void
  onCopyShareLink: () => void | Promise<void>
  mobileOpen: boolean
  onCloseMobile: () => void
  onRenameUser: (name: string) => void
  onSelect: (name: string) => void
  onCreate: (name: string) => Promise<WorkspaceFile>
  onDelete: (name: string) => void | Promise<void>
  presence: PresencePeer[]
  /** Increment to open the new-file form (same as clicking +). */
  createFormSignal?: number
}

export default function Sidebar({
  files,
  loading,
  filesError,
  activeFile,
  room,
  userName,
  onChangeRoom,
  onGenerateRoom,
  onCopyShareLink,
  mobileOpen,
  onCloseMobile,
  onRenameUser,
  onSelect,
  onCreate,
  onDelete,
  presence,
  createFormSignal = 0
}: SidebarProps) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(userName)
  const [roomDraft, setRoomDraft] = useState(room)
  const [copied, setCopied] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceFile | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    setRoomDraft(room)
  }, [room])

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1200)
    return () => window.clearTimeout(id)
  }, [copied])

  useEffect(() => {
    if (!deleteTarget) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !deleteBusy) {
        setDeleteTarget(null)
        setDeleteError('')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deleteTarget, deleteBusy])

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

  useEffect(() => {
    if (createFormSignal === 0) return
    setCreating(true)
    setNewName('')
    setError('')
  }, [createFormSignal])

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleteBusy(true)
    setDeleteError('')
    try {
      await onDelete(deleteTarget.name)
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleteBusy(false)
    }
  }

  const filePresence: Record<string, PresencePeer[]> = {}
  presence.forEach(p => {
    if (p.file) {
      if (!filePresence[p.file]) filePresence[p.file] = []
      filePresence[p.file]!.push(p)
    }
  })

  return (
    <>
      <aside
        className={`sidebar workspace-sidebar ${mobileOpen ? 'sidebar-open' : ''}`}
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
        className="sidebar-header"
        style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span
          className="sidebar-header-title"
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
          className="sidebar-new-file-btn"
          type="button"
          onClick={() => {
            setCreating(true)
            setNewName('')
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

      <form
        className="sidebar-room-form"
        onSubmit={e => {
          e.preventDefault()
          onChangeRoom(roomDraft)
        }}
        style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}
      >
        <label
          className="sidebar-room-label"
          style={{
            display: 'block',
            fontFamily: 'var(--mono)',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text3)',
            marginBottom: 6
          }}
        >
          Room link
        </label>
        <input
          className="sidebar-room-input"
          value={roomDraft}
          onChange={e => setRoomDraft(e.target.value)}
          placeholder="lobby"
          aria-label="Room"
          style={{ marginBottom: 6, fontSize: 12, padding: '6px 8px' }}
        />
        <div className="sidebar-room-actions" style={{ display: 'flex', gap: 6 }}>
          <button
            className="sidebar-room-btn"
            type="submit"
            style={{
              flex: 1,
              height: 26,
              background: 'var(--bg4)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: 'var(--text2)'
            }}
          >
            join
          </button>
          <button
            className="sidebar-room-btn sidebar-copy-btn"
            type="button"
            onClick={async () => {
              try {
                await onCopyShareLink()
                setCopied(true)
              } catch {
                setCopied(false)
              }
            }}
            style={{
              flex: 1,
              height: 26,
              background: 'var(--bg4)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: copied ? 'var(--accent)' : 'var(--text2)'
            }}
          >
            {copied ? 'copied' : 'copy link'}
          </button>
        </div>
        <button
          className="sidebar-room-btn sidebar-new-room-btn"
          type="button"
          onClick={() => {
            onGenerateRoom()
          }}
          style={{
            marginTop: 6,
            width: '100%',
            height: 26,
            background: 'transparent',
            border: '1px dashed var(--border2)',
            borderRadius: 'var(--radius)',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--text2)'
          }}
        >
          new room
        </button>
      </form>

      {filesError && (
        <div
          className="sidebar-files-error"
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
        <form
          className="sidebar-create-form"
          onSubmit={handleCreate}
          style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}
        >
          <input
            className="sidebar-create-input"
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
          {error && (
            <div className="sidebar-create-error" style={{ fontSize: 11, color: 'var(--coral)', marginTop: 4 }}>
              {error}
            </div>
          )}
        </form>
      )}

      <div className="sidebar-files-list" style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {loading && files.length === 0 && !filesError && (
          <div className="sidebar-files-loading" style={{ padding: '24px 16px', color: 'var(--text3)', fontSize: 12, fontFamily: 'var(--mono)' }}>
            Loading…
          </div>
        )}
        {!loading && files.length === 0 && !creating && !filesError && (
          <div className="sidebar-files-empty" style={{ padding: '24px 16px', color: 'var(--text3)', fontSize: 13, lineHeight: 1.6 }}>
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
            onRequestDelete={() => {
              setDeleteTarget(f)
              setDeleteError('')
            }}
            users={filePresence[f.name] || []}
          />
        ))}
      </div>

      <div
        className="sidebar-footer"
        style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--border)'
        }}
      >
        {editingName ? (
          <form
            className="sidebar-name-form"
            onSubmit={e => {
              e.preventDefault()
              onRenameUser(nameDraft)
              setEditingName(false)
            }}
            style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: presence.length ? 8 : 0 }}
          >
            <input
              className="sidebar-name-input"
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
            className="sidebar-name-button"
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
          <div className="sidebar-presence" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {presence.map(p => (
              <div
                className="sidebar-presence-dot"
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
            <span className="sidebar-presence-count" style={{ fontSize: 11, color: 'var(--text3)' }}>
              {presence.length} online
            </span>
          </div>
        )}
      </div>
      {deleteTarget && (
        <DeleteDialog
          fileName={deleteTarget.name}
          busy={deleteBusy}
          error={deleteError}
          onCancel={() => {
            if (deleteBusy) return
            setDeleteTarget(null)
            setDeleteError('')
          }}
          onConfirm={() => void confirmDelete()}
        />
      )}
      </aside>
      {mobileOpen && <button className="sidebar-backdrop" type="button" onClick={onCloseMobile} aria-label="Close sidebar" />}
    </>
  )
}

function FileRow({
  file,
  active,
  onSelect,
  onRequestDelete,
  users
}: {
  file: WorkspaceFile
  active: boolean
  onSelect: () => void
  onRequestDelete: () => void
  users: PresencePeer[]
}) {
  return (
    <div
      className={`sidebar-file-row ${active ? 'is-active' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px 4px 10px',
        background: active ? 'var(--bg3)' : 'transparent',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'all 0.1s'
      }}
    >
      <button
        className="sidebar-file-select"
        type="button"
        onClick={onSelect}
        aria-current={active ? 'page' : undefined}
        style={{
          flex: 1,
          textAlign: 'left',
          background: 'transparent',
          borderRadius: 4,
          padding: '2px 0',
          fontFamily: 'var(--mono)',
          fontSize: 12,
          color: active ? 'var(--text)' : 'var(--text2)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minHeight: 24
        }}
      >
        {file.name}
      </button>

      {users.length > 0 && (
        <div className="sidebar-file-users" style={{ display: 'flex', gap: 2, marginRight: 4 }}>
          {users.slice(0, 3).map(u => (
            <div
              className="sidebar-file-user-dot"
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

      <button
        className="sidebar-file-delete"
        type="button"
        onClick={onRequestDelete}
        style={{
          color: 'var(--text3)',
          fontSize: 14,
          lineHeight: 1,
          width: 22,
          height: 22,
          borderRadius: 4,
          border: '1px solid transparent'
        }}
        aria-label={`Delete ${file.name}`}
        title={`Delete ${file.name}`}
      >
        ×
      </button>
    </div>
  )
}

function DeleteDialog({
  fileName,
  busy,
  error,
  onCancel,
  onConfirm
}: {
  fileName: string
  busy: boolean
  error: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="delete-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Delete ${fileName}`}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 30
      }}
    >
      <div
        className="delete-dialog-panel"
        style={{
          width: '100%',
          maxWidth: 320,
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-lg)',
          padding: 14
        }}
      >
        <div className="delete-dialog-title" style={{ fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>
          Delete this file?
        </div>
        <div
          className="delete-dialog-filename"
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 12,
            color: 'var(--text2)',
            wordBreak: 'break-word',
            marginBottom: 12
          }}
        >
          {fileName}
        </div>
        {error && (
          <div className="delete-dialog-error" style={{ marginBottom: 10, color: 'var(--coral)', fontFamily: 'var(--mono)', fontSize: 11 }}>
            {error}
          </div>
        )}
        <div className="delete-dialog-actions" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            className="delete-dialog-btn delete-dialog-cancel"
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              height: 28,
              padding: '0 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text2)'
            }}
          >
            Cancel
          </button>
          <button
            className="delete-dialog-btn delete-dialog-confirm"
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              height: 28,
              padding: '0 10px',
              border: '1px solid rgba(255,107,91,0.35)',
              borderRadius: 'var(--radius)',
              background: 'rgba(255,107,91,0.12)',
              color: 'var(--coral)'
            }}
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
