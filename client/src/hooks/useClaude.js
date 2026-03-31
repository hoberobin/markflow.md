import { useState, useCallback } from 'react'

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'

export function useClaude() {
  const [streaming, setStreaming] = useState(false)
  const [response, setResponse] = useState('')

  const ask = useCallback(async ({ mode, content, selection, instruction, variables, onChunk, onDone }) => {
    setStreaming(true)
    setResponse('')
    let full = ''

    try {
      const res = await fetch(`${SERVER}/claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, content, selection, instruction, variables })
      })

      if (!res.ok) throw new Error('Claude request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        const lines = text.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') { onDone?.(full); break }
            try {
              const { text: chunk } = JSON.parse(data)
              full += chunk
              setResponse(full)
              onChunk?.(chunk, full)
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error('Claude error:', err)
    } finally {
      setStreaming(false)
    }

    return full
  }, [])

  return { ask, streaming, response }
}
