import Database from 'better-sqlite3'
import fs from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { DEFAULT_ROOM, sanitizeRoomId } from '../utils/workspace.js'

export type WorkspaceFile = { name: string; path: string; room: string }
export type RoomDocument = { name: string; content: string }

type MigrationResult = { imported: number; skipped: number }

export class SqliteWorkspaceStore {
  private readonly db: Database.Database
  private readonly ensureRoomStmt: Database.Statement<[string]>
  private readonly listFilesStmt: Database.Statement<[string], { name: string }>
  private readonly getFileContentStmt: Database.Statement<[string, string], { content: string }>
  private readonly createFileStmt: Database.Statement<[string, string, string]>
  private readonly upsertFileStmt: Database.Statement<[string, string, string]>
  private readonly deleteFileStmt: Database.Statement<[string, string]>
  private readonly listRoomDocumentsStmt: Database.Statement<[string], { name: string; content: string }>
  private readonly insertIfMissingStmt: Database.Statement<[string, string, string]>
  private readonly countDocsStmt: Database.Statement<[], { total: number }>

  constructor(public readonly dbPath: string) {
    const dbDir = path.dirname(dbPath)
    if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true })

    this.db = new Database(dbPath)
    this.db.pragma('foreign_keys = ON')
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    this.db.pragma('busy_timeout = 5000')

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room TEXT NOT NULL,
        name TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(room, name),
        FOREIGN KEY(room) REFERENCES rooms(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_documents_room ON documents(room);
      CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at);
    `)

    this.ensureRoomStmt = this.db.prepare(`
      INSERT INTO rooms (id)
      VALUES (?)
      ON CONFLICT(id) DO NOTHING
    `)
    this.listFilesStmt = this.db.prepare(`
      SELECT name
      FROM documents
      WHERE room = ?
      ORDER BY lower(name) ASC
    `)
    this.getFileContentStmt = this.db.prepare(`
      SELECT content
      FROM documents
      WHERE room = ? AND name = ?
      LIMIT 1
    `)
    this.createFileStmt = this.db.prepare(`
      INSERT INTO documents (room, name, content)
      VALUES (?, ?, ?)
      ON CONFLICT(room, name) DO NOTHING
    `)
    this.upsertFileStmt = this.db.prepare(`
      INSERT INTO documents (room, name, content, updated_at)
      VALUES (?, ?, ?, unixepoch())
      ON CONFLICT(room, name)
      DO UPDATE SET content = excluded.content, updated_at = unixepoch()
    `)
    this.deleteFileStmt = this.db.prepare(`
      DELETE FROM documents
      WHERE room = ? AND name = ?
    `)
    this.listRoomDocumentsStmt = this.db.prepare(`
      SELECT name, content
      FROM documents
      WHERE room = ?
      ORDER BY lower(name) ASC
    `)
    this.insertIfMissingStmt = this.db.prepare(`
      INSERT INTO documents (room, name, content)
      VALUES (?, ?, ?)
      ON CONFLICT(room, name) DO NOTHING
    `)
    this.countDocsStmt = this.db.prepare('SELECT count(*) as total FROM documents')
  }

  private ensureRoom(room: string): void {
    this.ensureRoomStmt.run(room)
  }

  listFiles(room: string): WorkspaceFile[] {
    this.ensureRoom(room)
    return this.listFilesStmt.all(room).map(({ name }) => ({ name, path: name, room }))
  }

  getFileContent(room: string, name: string): string | null {
    const row = this.getFileContentStmt.get(room, name)
    return row?.content ?? null
  }

  createFile(room: string, name: string, content: string): boolean {
    this.ensureRoom(room)
    const result = this.createFileStmt.run(room, name, content)
    return result.changes > 0
  }

  upsertFile(room: string, name: string, content: string): void {
    this.ensureRoom(room)
    this.upsertFileStmt.run(room, name, content)
  }

  deleteFile(room: string, name: string): boolean {
    const result = this.deleteFileStmt.run(room, name)
    return result.changes > 0
  }

  listRoomDocuments(room: string): RoomDocument[] {
    this.ensureRoom(room)
    return this.listRoomDocumentsStmt.all(room)
  }

  countDocuments(): number {
    const row = this.countDocsStmt.get()
    return row?.total ?? 0
  }

  async migrateFromWorkspace(workspaceDir: string): Promise<MigrationResult> {
    if (!existsSync(workspaceDir)) return { imported: 0, skipped: 0 }

    const candidates: Array<{ room: string; name: string; fullPath: string }> = []
    const rootEntries = await fs.readdir(workspaceDir, { withFileTypes: true })

    for (const entry of rootEntries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        candidates.push({
          room: DEFAULT_ROOM,
          name: entry.name,
          fullPath: path.join(workspaceDir, entry.name)
        })
      } else if (entry.isDirectory()) {
        const room = sanitizeRoomId(entry.name)
        if (!room) continue
        const roomDir = path.join(workspaceDir, entry.name)
        const roomEntries = await fs.readdir(roomDir, { withFileTypes: true })
        for (const fileEntry of roomEntries) {
          if (!fileEntry.isFile() || !fileEntry.name.endsWith('.md')) continue
          candidates.push({
            room,
            name: fileEntry.name,
            fullPath: path.join(roomDir, fileEntry.name)
          })
        }
      }
    }

    const insertMany = this.db.transaction((items: Array<{ room: string; name: string; content: string }>) => {
      for (const item of items) {
        this.ensureRoom(item.room)
        this.insertIfMissingStmt.run(item.room, item.name, item.content)
      }
    })

    const payload: Array<{ room: string; name: string; content: string }> = []
    let skipped = 0
    for (const candidate of candidates) {
      try {
        const content = await fs.readFile(candidate.fullPath, 'utf8')
        payload.push({ room: candidate.room, name: candidate.name, content })
      } catch {
        skipped++
      }
    }
    if (payload.length) insertMany(payload)

    return { imported: payload.length, skipped }
  }

  close(): void {
    this.db.close()
  }
}
