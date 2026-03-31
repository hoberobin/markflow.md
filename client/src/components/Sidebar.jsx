import React, { useState } from 'react'

export default function Sidebar({ files, activeFile, onSelect, onCreate, onDelete, presence }) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const file = await onCreate(newName.trim())
      onSelect(file.name)
      setNewName('')
      setCreating(false)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  // Who is on which file
  const filePresence = {}
  presence.forEach(p => {
    if (p.file) {
      if (!filePresence[p.file]) filePresence[p.file] = []
      filePresence[p.file].push(p)
    }
  })

  return (
    <aside style={{
      width: 220,
      minWidth: 220,
      background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          workspace
        </span>
        <button
          onClick={() => { setCreating(true); setError('') }}
          title="New file"
          style={{
            width: 22, height: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg4)',
            borderRadius: 4,
            color: 'var(--text2)',
            fontSize: 16,
            lineHeight: 1
          }}
        >+</button>
      </div>

      {/* New file form */}
      {creating && (
        <form onSubmit={handleCreate} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="filename.md"
            onKeyDown={e => { if (e.key === 'Escape') { setCreating(false); setNewName('') } }}
            style={{ marginBottom: error ? 6 : 0 }}
          />
          {error && <div style={{ fontSize: 11, color: 'var(--coral)', marginTop: 4 }}>{error}</div>}
        </form>
      )}

      {/* File list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {files.length === 0 && !creating && (
          <div style={{ padding: '24px 16px', color: 'var(--text3)', fontSize: 13, lineHeight: 1.6 }}>
            No files yet.<br />Click + to create one.
          </div>
        )}
        {files.map(f => (
          <FileRow
            key={f.name}
            file={f}
            active={activeFile === f.name}
            onSelect={() => onSelect(f.name)}
            onDelete={() => onDelete(f.name)}
            users={filePresence[f.name] || []}
          />
        ))}
      </div>

      {/* Online indicator */}
      {presence.length > 0 && (
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap'
        }}>
          {presence.map(p => (
            <div key={p.clientId} title={p.name} style={{
              width: 8, height: 8,
              borderRadius: '50%',
              background: p.color,
              opacity: 0.8
            }} />
          ))}
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{presence.length} online</span>
        </div>
      )}
    </aside>
  )
}

function FileRow({ file, active, onSelect, onDelete, users }) {
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

      {/* Presence dots */}
      {users.length > 0 && (
        <div style={{ display: 'flex', gap: 2, marginRight: 4 }}>
          {users.slice(0, 3).map(u => (
            <div key={u.clientId} style={{
              width: 5, height: 5,
              borderRadius: '50%',
              background: u.color
            }} />
          ))}
        </div>
      )}

      {hovered && (
        <button
          onClick={e => { e.stopPropagation(); if (confirm(`Delete ${file.name}?`)) onDelete() }}
          style={{ color: 'var(--text3)', fontSize: 14, padding: '0 2px', lineHeight: 1 }}
          title="Delete"
        >×</button>
      )}
    </div>
  )
}
