import { useState, useEffect, useCallback } from 'react'

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'

export function useFiles() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER}/files`)
      const data = await res.json()
      setFiles(data)
    } catch (e) {
      console.error('Failed to load files', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const createFile = useCallback(async (name) => {
    const res = await fetch(`${SERVER}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error)
    }
    const file = await res.json()
    await refresh()
    return file
  }, [refresh])

  const deleteFile = useCallback(async (name) => {
    await fetch(`${SERVER}/files/${encodeURIComponent(name)}`, { method: 'DELETE' })
    await refresh()
  }, [refresh])

  return { files, loading, refresh, createFile, deleteFile }
}
