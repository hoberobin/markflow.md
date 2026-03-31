import React, { useState, useRef, useEffect } from 'react'
import { useClaude } from '../hooks/useClaude.js'

const MODES = [
  { id: 'chat', label: 'Chat', icon: '◎', placeholder: 'Ask anything about this doc...' },
  { id: 'generate', label: 'Generate', icon: '✦', placeholder: 'Describe what to add...' },
  { id: 'rewrite', label: 'Rewrite', icon: '↺', placeholder: 'How to rewrite the selection...' },
  { id: 'summarize', label: 'Critique', icon: '⊹', placeholder: 'Summarize & critique this doc' },
  { id: 'run', label: 'Run', icon: '▶', placeholder: 'Run this doc as a prompt template' },
]

export default function ClaudePanel({ content, selection, onInsert, visible, onClose }) {
  const [mode, setMode] = useState('chat')
  const [instruction, setInstruction] = useState('')
  const [messages, setMessages] = useState([])
  const [variables, setVariables] = useState({})
  const { ask, streaming } = useClaude()
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Detect {{variables}} in content for run mode
  const detectedVars = [...new Set((content || '').match(/\{\{(\w+)\}\}/g)?.map(m => m.slice(2, -2)) || [])]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (visible) inputRef.current?.focus()
  }, [visible, mode])

  async function handleSubmit(e) {
    e?.preventDefault()
    const text = instruction.trim()
    if (!text && mode !== 'summarize' && mode !== 'run') return

    const userMsg = text || (mode === 'summarize' ? 'Summarize & critique' : 'Run as prompt')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setInstruction('')

    let aiMsg = { role: 'ai', text: '' }
    setMessages(prev => [...prev, aiMsg])

    await ask({
      mode,
      content,
      selection,
      instruction: text,
      variables: mode === 'run' ? variables : undefined,
      onChunk: (_, full) => {
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'ai', text: full }
          return next
        })
      },
      onDone: (full) => {
        if ((mode === 'generate' || mode === 'rewrite') && onInsert) {
          onInsert(full, mode)
        }
      }
    })
  }

  if (!visible) return null

  return (
    <div style={{
      width: 320,
      minWidth: 320,
      borderLeft: '1px solid var(--border)',
      background: 'var(--bg2)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em' }}>
          CLAUDE
        </span>
        <button onClick={onClose} style={{ color: 'var(--text3)', fontSize: 16 }}>×</button>
      </div>

      {/* Mode tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        padding: '0 8px'
      }}>
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setMessages([]) }}
            style={{
              padding: '8px 10px',
              fontSize: 11,
              fontFamily: 'var(--mono)',
              color: mode === m.id ? 'var(--accent)' : 'var(--text3)',
              borderBottom: mode === m.id ? '1px solid var(--accent)' : '1px solid transparent',
              marginBottom: -1,
              whiteSpace: 'nowrap',
              letterSpacing: '0.04em'
            }}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* Context indicator */}
      {selection && (
        <div style={{
          margin: '10px 12px 0',
          padding: '8px 10px',
          background: 'var(--bg4)',
          borderRadius: 'var(--radius)',
          borderLeft: '2px solid var(--accent)',
          fontSize: 11,
          color: 'var(--text3)',
          fontFamily: 'var(--mono)'
        }}>
          {selection.length > 80 ? selection.slice(0, 80) + '…' : selection}
        </div>
      )}

      {/* Variable inputs for run mode */}
      {mode === 'run' && detectedVars.length > 0 && (
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, fontFamily: 'var(--mono)' }}>
            template variables
          </div>
          {detectedVars.map(v => (
            <div key={v} style={{ marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)', display: 'block', marginBottom: 3 }}>
                {`{{${v}}}`}
              </label>
              <input
                value={variables[v] || ''}
                onChange={e => setVariables(prev => ({ ...prev, [v]: e.target.value }))}
                placeholder={`value for ${v}`}
              />
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'var(--mono)', lineHeight: 1.7, padding: '8px 0' }}>
            {mode === 'chat' && 'Ask anything about this document.'}
            {mode === 'generate' && 'Describe a section to generate and insert.'}
            {mode === 'rewrite' && (selection ? 'Describe how to rewrite the selected text.' : 'Select text in the editor first, then describe the rewrite.')}
            {mode === 'summarize' && 'Click run to get a summary and critique of the document.'}
            {mode === 'run' && 'This document will be sent as a prompt to Claude. Fill any {{variables}} above.'}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            marginBottom: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
          }}>
            <div style={{
              maxWidth: '90%',
              padding: '8px 12px',
              borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
              background: msg.role === 'user' ? 'var(--bg4)' : 'var(--bg3)',
              fontSize: 13,
              lineHeight: 1.6,
              color: msg.role === 'user' ? 'var(--text2)' : 'var(--text)',
              fontFamily: msg.role === 'ai' ? 'var(--sans)' : 'var(--mono)',
              border: msg.role === 'ai' ? '1px solid var(--border)' : 'none',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {msg.text}
              {streaming && i === messages.length - 1 && msg.role === 'ai' && (
                <span style={{ opacity: 0.4, animation: 'pulse 1s infinite' }}>▌</span>
              )}
            </div>
            {msg.role === 'ai' && msg.text && !streaming && (mode === 'generate' || mode === 'rewrite') && (
              <button
                onClick={() => onInsert?.(msg.text, mode)}
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: 'var(--accent)',
                  fontFamily: 'var(--mono)',
                  padding: '3px 6px',
                  background: 'rgba(200,240,96,0.08)',
                  borderRadius: 4
                }}
              >
                ↓ insert into doc
              </button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{
        padding: '12px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: 8
      }}>
        {mode === 'summarize' || mode === 'run' ? (
          <button
            type="submit"
            disabled={streaming}
            style={{
              flex: 1,
              padding: '9px',
              background: streaming ? 'var(--bg4)' : 'var(--accent)',
              color: streaming ? 'var(--text3)' : '#0e0e0f',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--mono)',
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '0.05em'
            }}
          >
            {streaming ? '…' : mode === 'run' ? '▶ run' : '⊹ critique'}
          </button>
        ) : (
          <>
            <textarea
              ref={inputRef}
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              placeholder={MODES.find(m => m.id === mode)?.placeholder}
              rows={2}
              style={{ flex: 1, resize: 'none', fontSize: 12 }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
              }}
            />
            <button
              type="submit"
              disabled={streaming || !instruction.trim()}
              style={{
                padding: '0 12px',
                background: streaming ? 'var(--bg4)' : 'var(--accent)',
                color: '#0e0e0f',
                borderRadius: 'var(--radius)',
                fontFamily: 'var(--mono)',
                fontSize: 12,
                fontWeight: 500,
                alignSelf: 'flex-end',
                opacity: !instruction.trim() ? 0.4 : 1
              }}
            >
              {streaming ? '…' : '↑'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
