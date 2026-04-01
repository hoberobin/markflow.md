import { useState, useRef, useEffect, type FormEvent } from 'react'
import { useClaude, type ClaudePanelMode } from '../hooks/useClaude'

const MODES: { id: ClaudePanelMode; label: string; icon: string; placeholder: string }[] = [
  { id: 'chat', label: 'Chat', icon: '◎', placeholder: 'Ask anything about this doc...' },
  { id: 'generate', label: 'Generate', icon: '✦', placeholder: 'Describe what to add...' },
  { id: 'rewrite', label: 'Rewrite', icon: '↺', placeholder: 'How to rewrite the selection...' },
  { id: 'summarize', label: 'Critique', icon: '⊹', placeholder: 'Critique of the whole document' },
  { id: 'run', label: 'Run', icon: '▶', placeholder: 'Run this doc as a prompt template' }
]

interface ChatMessage {
  role: 'user' | 'ai'
  text: string
  isError?: boolean
}

export interface ClaudePanelProps {
  content: string
  selection: string
  onInsert?: (text: string, mode: ClaudePanelMode) => void
  visible: boolean
  onClose: () => void
  claudeReady: boolean | null
}

export default function ClaudePanel({
  content,
  selection,
  onInsert,
  visible,
  onClose,
  claudeReady
}: ClaudePanelProps) {
  const [mode, setMode] = useState<ClaudePanelMode>('chat')
  const [instruction, setInstruction] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [variables, setVariables] = useState<Record<string, string>>({})
  const { ask, streaming } = useClaude()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const detectedVars = [
    ...new Set((content || '').match(/\{\{(\w+)\}\}/g)?.map(m => m.slice(2, -2)) || [])
  ]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (visible) inputRef.current?.focus()
  }, [visible, mode])

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    const text = instruction.trim()
    if (!text && mode !== 'summarize' && mode !== 'run') return

    const userMsg = text || (mode === 'summarize' ? 'Critique document' : 'Run as prompt')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setInstruction('')

    setMessages(prev => [...prev, { role: 'ai', text: '' }])

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
      onDone: full => {
        if ((mode === 'generate' || mode === 'rewrite') && full.trim() && onInsert) {
          onInsert(full, mode)
        }
      },
      onError: msg => {
        setMessages(prev => {
          const next = [...prev]
          const i = next.length - 1
          if (i >= 0 && next[i]!.role === 'ai') {
            const prevText = next[i]!.text
            next[i] = {
              role: 'ai',
              text: prevText ? `${prevText}\n\n— ${msg}` : msg,
              isError: true
            }
          }
          return next
        })
      }
    })
  }

  if (!visible) return null

  return (
    <div
      style={{
        width: 320,
        minWidth: 320,
        borderLeft: '1px solid var(--border)',
        background: 'var(--bg2)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          padding: '12px 16px',
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
            color: 'var(--accent)',
            letterSpacing: '0.1em'
          }}
        >
          CLAUDE
        </span>
        <button type="button" onClick={onClose} style={{ color: 'var(--text3)', fontSize: 16 }}>
          ×
        </button>
      </div>

      {claudeReady === false && (
        <div
          style={{
            margin: '0 12px 10px',
            padding: '8px 10px',
            background: 'rgba(255,107,91,0.1)',
            border: '1px solid rgba(255,107,91,0.22)',
            borderRadius: 'var(--radius)',
            fontSize: 11,
            color: 'var(--coral)',
            fontFamily: 'var(--mono)',
            lineHeight: 1.45
          }}
        >
          Claude is off — set ANTHROPIC_API_KEY for the Markflow server and restart.
        </div>
      )}

      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          overflowX: 'auto',
          padding: '0 8px'
        }}
      >
        {MODES.map(m => (
          <button
            type="button"
            key={m.id}
            onClick={() => {
              setMode(m.id)
              setMessages([])
              setInstruction('')
            }}
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

      {selection && (
        <div
          style={{
            margin: '10px 12px 0',
            padding: '8px 10px',
            background: 'var(--bg4)',
            borderRadius: 'var(--radius)',
            borderLeft: '2px solid var(--accent)',
            fontSize: 11,
            color: 'var(--text3)',
            fontFamily: 'var(--mono)'
          }}
        >
          {selection.length > 80 ? selection.slice(0, 80) + '…' : selection}
        </div>
      )}

      {mode === 'run' && detectedVars.length > 0 && (
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, fontFamily: 'var(--mono)' }}>
            template variables
          </div>
          {detectedVars.map(v => (
            <div key={v} style={{ marginBottom: 6 }}>
              <label
                style={{
                  fontSize: 11,
                  color: 'var(--text2)',
                  fontFamily: 'var(--mono)',
                  display: 'block',
                  marginBottom: 3
                }}
              >
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

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {messages.length === 0 && (
          <div
            style={{
              color: 'var(--text3)',
              fontSize: 12,
              fontFamily: 'var(--mono)',
              lineHeight: 1.7,
              padding: '8px 0'
            }}
          >
            {mode === 'chat' && 'Ask anything about this document.'}
            {mode === 'generate' && 'Describe a section to generate and insert.'}
            {mode === 'rewrite' &&
              (selection
                ? 'Describe how to rewrite the selected text.'
                : 'Select text in the editor first, then describe the rewrite.')}
            {mode === 'summarize' && 'Run a critique of the full document (summary + feedback).'}
            {mode === 'run' && 'This document will be sent as a prompt to Claude. Fill any {{variables}} above.'}
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              marginBottom: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            <div
              style={{
                maxWidth: '90%',
                padding: '8px 12px',
                borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                background:
                  msg.role === 'user' ? 'var(--bg4)' : msg.isError ? 'rgba(255,107,91,0.08)' : 'var(--bg3)',
                fontSize: 13,
                lineHeight: 1.6,
                color:
                  msg.role === 'user' ? 'var(--text2)' : msg.isError ? 'var(--coral)' : 'var(--text)',
                fontFamily: msg.role === 'ai' ? 'var(--sans)' : 'var(--mono)',
                border:
                  msg.role === 'ai'
                    ? `1px solid ${msg.isError ? 'rgba(255,107,91,0.35)' : 'var(--border)'}`
                    : 'none',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {msg.text}
              {streaming && i === messages.length - 1 && msg.role === 'ai' && (
                <span style={{ opacity: 0.4, animation: 'pulse 1s infinite' }}>▌</span>
              )}
            </div>
            {msg.role === 'ai' && msg.text && !streaming && !msg.isError && (mode === 'generate' || mode === 'rewrite') && (
              <button
                type="button"
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

      <form
        onSubmit={handleSubmit}
        style={{
          padding: '12px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 8
        }}
      >
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
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSubmit()
                }
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
