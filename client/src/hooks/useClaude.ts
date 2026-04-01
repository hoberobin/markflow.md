import { useState, useCallback } from 'react'
import { getServerUrl } from '../config'

export type ClaudePanelMode = 'rewrite' | 'generate' | 'summarize' | 'review' | 'chat' | 'run'

export interface AskOptions {
  mode: ClaudePanelMode
  content: string
  selection: string
  instruction: string
  variables?: Record<string, string>
  onChunk?: (chunk: string, full: string) => void
  onDone?: (full: string) => void
  onError?: (msg: string) => void
}

export function useClaude() {
  const [streaming, setStreaming] = useState(false)
  const [response, setResponse] = useState('')

  const ask = useCallback(async (opts: AskOptions) => {
    const { mode, content, selection, instruction, variables, onChunk, onDone, onError } = opts
    setStreaming(true)
    setResponse('')
    let full = ''
    let lineBuffer = ''
    let doneEmitted = false
    let hadError = false
    const finish = () => {
      if (!doneEmitted) {
        doneEmitted = true
        if (!hadError) onDone?.(full)
      }
    }

    try {
      const res = await fetch(`${getServerUrl()}/claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, content, selection, instruction, variables })
      })

      if (!res.ok) {
        let msg = `Request failed (${res.status})`
        try {
          const j = (await res.json()) as { error?: string }
          if (j.error) msg = j.error
        } catch {
          /* ignore */
        }
        hadError = true
        onError?.(msg)
        return full
      }

      const ct = res.headers.get('content-type') || ''
      if (!ct.includes('text/event-stream')) {
        let msg = 'Unexpected response from server'
        try {
          const j = (await res.json()) as { error?: string }
          if (j.error) msg = j.error
        } catch {
          /* ignore */
        }
        hadError = true
        onError?.(msg)
        return full
      }

      const reader = res.body?.getReader()
      if (!reader) {
        hadError = true
        onError?.('No response body')
        return full
      }
      const decoder = new TextDecoder()

      const processLine = (raw: string) => {
        const line = raw.replace(/\r$/, '')
        if (!line.startsWith('data: ')) return
        const data = line.slice(6).trim()
        if (data === '[DONE]') {
          finish()
          return
        }
        try {
          const parsed = JSON.parse(data) as { error?: string; text?: string }
          if (parsed.error) {
            hadError = true
            onError?.(parsed.error)
            return
          }
          if (typeof parsed.text === 'string') {
            full += parsed.text
            setResponse(full)
            onChunk?.(parsed.text, full)
          }
        } catch {
          /* ignore malformed JSON line */
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        lineBuffer += decoder.decode(value, { stream: true })
        const lines = lineBuffer.split('\n')
        lineBuffer = lines.pop() ?? ''
        for (const line of lines) {
          processLine(line)
        }
      }

      if (lineBuffer.trim()) {
        for (const line of lineBuffer.split('\n')) {
          processLine(line)
        }
      }

      finish()
    } catch (err) {
      console.error('Claude error:', err)
      hadError = true
      onError?.(err instanceof Error ? err.message : 'Network error')
    } finally {
      setStreaming(false)
    }

    return full
  }, [])

  return { ask, streaming, response }
}
