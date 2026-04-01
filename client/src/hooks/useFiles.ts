import { useState, useEffect, useCallback } from 'react'
import { getServerUrl } from '../config'

export interface WorkspaceFile {
  name: string
  path: string
}

export function useFiles() {
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${getServerUrl()}/files`)
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
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createFile = useCallback(
    async (name: string) => {
      const res = await fetch(`${getServerUrl()}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Create failed')
      }
      const file = (await res.json()) as WorkspaceFile
      await refresh()
      return file
    },
    [refresh]
  )

  const deleteFile = useCallback(
    async (name: string) => {
      await fetch(`${getServerUrl()}/files/${encodeURIComponent(name)}`, { method: 'DELETE' })
      await refresh()
    },
    [refresh]
  )

  return { files, loading, error, refresh, createFile, deleteFile }
}
