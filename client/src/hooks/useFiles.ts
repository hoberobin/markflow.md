import { useState, useEffect, useCallback } from 'react'
import { getServerUrl } from '../config'

export interface WorkspaceFile {
  name: string
  path: string
  room?: string
}

export function useFiles(room: string, enabled = true) {
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      const res = await fetch(`${getServerUrl()}/files?room=${encodeURIComponent(room)}`)
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const data: unknown = await res.json()
      setFiles(Array.isArray(data) ? (data as WorkspaceFile[]) : [])
      setError(null)
    } catch (e) {
      console.error('Failed to load files', e)
      setError(e instanceof Error ? e.message : 'Cannot reach server')
    } finally {
      setLoading(false)
    }
  }, [enabled, room])

  useEffect(() => {
    if (!enabled) {
      setFiles([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    void refresh()
  }, [enabled, refresh])

  const createFile = useCallback(
    async (name: string) => {
      if (!enabled) throw new Error('Not connected to a room')
      const res = await fetch(`${getServerUrl()}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, room })
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Create failed')
      }
      const file = (await res.json()) as WorkspaceFile
      await refresh()
      return file
    },
    [enabled, refresh, room]
  )

  const deleteFile = useCallback(
    async (name: string) => {
      if (!enabled) throw new Error('Not connected to a room')
      const res = await fetch(`${getServerUrl()}/files/${encodeURIComponent(name)}?room=${encodeURIComponent(room)}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Delete failed')
      }
      await refresh()
    },
    [enabled, refresh, room]
  )

  return { files, loading, error, refresh, createFile, deleteFile }
}
