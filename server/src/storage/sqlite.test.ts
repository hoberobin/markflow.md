import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_ROOM } from '../utils/workspace.js'
import { SqliteWorkspaceStore } from './sqlite.js'

const tempPaths: string[] = []

async function createTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
  tempPaths.push(dir)
  return dir
}

afterEach(async () => {
  for (const target of tempPaths.splice(0)) {
    await fs.rm(target, { recursive: true, force: true })
  }
})

describe('sqlite workspace store', () => {
  it('creates, reads, updates and deletes files', async () => {
    const dir = await createTempDir('markflow-db-')
    const dbPath = path.join(dir, 'markflow.db')
    const store = new SqliteWorkspaceStore(dbPath)

    expect(store.createFile(DEFAULT_ROOM, 'notes.md', '# Notes\n')).toBe(true)
    expect(store.createFile(DEFAULT_ROOM, 'notes.md', '# Notes\n')).toBe(false)
    expect(store.listFiles(DEFAULT_ROOM)).toEqual([{ name: 'notes.md', path: 'notes.md', room: DEFAULT_ROOM }])
    expect(store.getFileContent(DEFAULT_ROOM, 'notes.md')).toBe('# Notes\n')

    store.upsertFile(DEFAULT_ROOM, 'notes.md', '# Updated\n')
    expect(store.getFileContent(DEFAULT_ROOM, 'notes.md')).toBe('# Updated\n')

    expect(store.deleteFile(DEFAULT_ROOM, 'notes.md')).toBe(true)
    expect(store.deleteFile(DEFAULT_ROOM, 'notes.md')).toBe(false)
    expect(store.getFileContent(DEFAULT_ROOM, 'notes.md')).toBeNull()

    store.close()
  })

  it('migrates legacy markdown files into sqlite', async () => {
    const dir = await createTempDir('markflow-migrate-')
    const workspaceDir = path.join(dir, 'workspace')
    await fs.mkdir(path.join(workspaceDir, 'team-alpha'), { recursive: true })
    await fs.writeFile(path.join(workspaceDir, 'home.md'), '# Home\n', 'utf8')
    await fs.writeFile(path.join(workspaceDir, 'team-alpha', 'spec.md'), '# Spec\n', 'utf8')

    const dbPath = path.join(dir, 'markflow.db')
    const store = new SqliteWorkspaceStore(dbPath)
    const result = await store.migrateFromWorkspace(workspaceDir)

    expect(result.imported).toBe(2)
    expect(result.skipped).toBe(0)
    expect(store.getFileContent(DEFAULT_ROOM, 'home.md')).toBe('# Home\n')
    expect(store.getFileContent('team-alpha', 'spec.md')).toBe('# Spec\n')
    expect(store.countDocuments()).toBe(2)

    store.close()
  })
})
