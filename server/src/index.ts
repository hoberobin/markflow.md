import express, { type Request, type Response } from 'express'
import { createServer } from 'http'
import { WebSocketServer, type WebSocket } from 'ws'
import cors from 'cors'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'
import archiver from 'archiver'
import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync.js'
import * as awarenessProtocol from 'y-protocols/awareness.js'
import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import {
  DEFAULT_ROOM,
  getDocKey,
  normalizeMdFilename,
  parseDocPath,
  parseRoom,
  validateExistingMdFilename
} from './utils/workspace.js'
import { SqliteWorkspaceStore } from './storage/sqlite.js'

type MarkflowWebSocket = WebSocket & { markflowAwarenessIds?: Set<number>; markflowDocKey?: string }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LEGACY_WORKSPACE = path.resolve('/app/workspace')
const LEGACY_DEV_WORKSPACE = path.resolve(__dirname, '../../workspace')
const LEGACY_WS_DIR = existsSync('/app/workspace') ? LEGACY_WORKSPACE : LEGACY_DEV_WORKSPACE
const DATA_DIR = existsSync('/app/data') ? path.resolve('/app/data') : path.resolve(process.cwd(), '../data')
const DATABASE_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'markflow.db')
const store = new SqliteWorkspaceStore(DATABASE_PATH)

if (!existsSync(LEGACY_WS_DIR)) mkdirSync(LEGACY_WS_DIR, { recursive: true })

const migration = await store.migrateFromWorkspace(LEGACY_WS_DIR)
if (migration.imported || migration.skipped) {
  console.log(`SQLite migration complete: imported=${migration.imported}, skipped=${migration.skipped}`)
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
})

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, storage: 'sqlite' })
})

// ─── Yjs document store ───────────────────────────────────────────────────────
const docs = new Map<string, Y.Doc>()
const awareness = new Map<string, awarenessProtocol.Awareness>()
const docClients = new Map<string, Set<MarkflowWebSocket>>()
const docReady = new Map<string, Promise<void>>()

const MSG_SYNC = 0
const MSG_AWARENESS = 1
const MSG_QUERY_AWARENESS = 3

/** Drop in-memory Yjs state and disconnect clients so they reload from disk */
function purgeDoc(docKey: string): void {
  const clients = docClients.get(docKey)
  if (clients && clients.size) {
    for (const ws of [...clients]) {
      try {
        if (ws.readyState === 1) ws.close(4001, 'Document reloaded')
      } catch {
        /* ignore */
      }
    }
  }
  docs.delete(docKey)
  awareness.delete(docKey)
  docClients.delete(docKey)
  docReady.delete(docKey)
}

function peekAwarenessClientIds(update: Uint8Array): number[] {
  try {
    const decoder = decoding.createDecoder(update)
    const len = decoding.readVarUint(decoder)
    const ids: number[] = []
    for (let i = 0; i < len; i++) {
      ids.push(decoding.readVarUint(decoder))
      decoding.readVarUint(decoder)
      decoding.readVarString(decoder)
    }
    return ids
  } catch {
    return []
  }
}

async function getDoc(room: string, fileName: string): Promise<{ doc: Y.Doc; aw: awarenessProtocol.Awareness }> {
  const docKey = getDocKey(room, fileName)
  if (!docs.has(docKey)) {
    const doc = new Y.Doc()
    const aw = new awarenessProtocol.Awareness(doc)
    docs.set(docKey, doc)
    awareness.set(docKey, aw)
    docClients.set(docKey, new Set())

    const ready = (async () => {
      const content = store.getFileContent(room, fileName)
      if (content === null) return
      const ytext = doc.getText('content')
      if (ytext.length > 0) return
      doc.transact(() => {
        ytext.insert(0, content)
      })
    })().catch(err => {
      console.error('Failed to hydrate document:', docKey, err)
    })
    docReady.set(docKey, ready)

    doc.on('update', () => {
      const content = doc.getText('content').toString()
      try {
        store.upsertFile(room, fileName, content)
      } catch (err) {
        console.error('Failed to persist document update:', docKey, err)
      }
    })

    aw.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      const clients = docClients.get(docKey) || new Set()
      const changedClients = [...added, ...updated, ...removed]
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MSG_AWARENESS)
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(aw, changedClients))
      const msg = encoding.toUint8Array(encoder)
      clients.forEach(c => {
        if (c.readyState === 1) c.send(msg)
      })
    })
  }
  await (docReady.get(docKey) || Promise.resolve())
  return { doc: docs.get(docKey)!, aw: awareness.get(docKey)! }
}

// ─── WebSocket handler ────────────────────────────────────────────────────────
wss.on('connection', async (ws: MarkflowWebSocket, req) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost')
    const docPath = parseDocPath(url.pathname)
    if (!docPath) {
      ws.close(4000, 'Invalid document')
      return
    }
    const { room, fileName } = docPath
    const docKey = getDocKey(room, fileName)

    const { doc, aw } = await getDoc(room, fileName)
    const clients = docClients.get(docKey)!
    clients.add(ws)
    ws.markflowDocKey = docKey

    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MSG_SYNC)
    syncProtocol.writeSyncStep1(encoder, doc)
    ws.send(encoding.toUint8Array(encoder))

    const awarenessStates = aw.getStates()
    if (awarenessStates.size > 0) {
      const awEncoder = encoding.createEncoder()
      encoding.writeVarUint(awEncoder, MSG_AWARENESS)
      encoding.writeVarUint8Array(
        awEncoder,
        awarenessProtocol.encodeAwarenessUpdate(aw, [...awarenessStates.keys()])
      )
      ws.send(encoding.toUint8Array(awEncoder))
    }

    ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
      const decoder = decoding.createDecoder(new Uint8Array(buf))
      const msgType = decoding.readVarUint(decoder)

      if (msgType === MSG_SYNC) {
        const outEncoder = encoding.createEncoder()
        encoding.writeVarUint(outEncoder, MSG_SYNC)
        const syncMsgType = syncProtocol.readSyncMessage(decoder, outEncoder, doc, ws)
        if (encoding.length(outEncoder) > 1) {
          ws.send(encoding.toUint8Array(outEncoder))
        }
        if (syncMsgType === syncProtocol.messageYjsSyncStep2 || syncMsgType === syncProtocol.messageYjsUpdate) {
          clients.forEach(c => {
            if (c !== ws && c.readyState === 1) c.send(buf)
          })
        }
      } else if (msgType === MSG_AWARENESS) {
        const update = decoding.readVarUint8Array(decoder)
        for (const id of peekAwarenessClientIds(update)) {
          if (!ws.markflowAwarenessIds) ws.markflowAwarenessIds = new Set()
          ws.markflowAwarenessIds.add(id)
        }
        awarenessProtocol.applyAwarenessUpdate(aw, update, ws)
      } else if (msgType === MSG_QUERY_AWARENESS) {
        const qEncoder = encoding.createEncoder()
        encoding.writeVarUint(qEncoder, MSG_AWARENESS)
        encoding.writeVarUint8Array(
          qEncoder,
          awarenessProtocol.encodeAwarenessUpdate(aw, [...aw.getStates().keys()])
        )
        ws.send(encoding.toUint8Array(qEncoder))
      }
    })

    ws.on('close', () => {
      const connected = ws.markflowDocKey ? docClients.get(ws.markflowDocKey) : clients
      connected?.delete(ws)
      const ids = ws.markflowAwarenessIds ? [...ws.markflowAwarenessIds] : []
      if (ids.length) awarenessProtocol.removeAwarenessStates(aw, ids, ws)
    })
  } catch (err) {
    console.error('WebSocket setup failed:', err)
    ws.close(1011, 'Server error')
  }
})

// ─── REST: file listing ───────────────────────────────────────────────────────
app.get('/files', async (req: Request, res: Response) => {
  const room = parseRoom(req.query.room)
  if (!room) return res.status(400).json({ error: 'Invalid room id' })
  try {
    res.json(store.listFiles(room))
  } catch (err) {
    console.error('Failed to list files:', err)
    res.status(500).json({ error: 'Failed to list files' })
  }
})

app.post('/files', async (req: Request, res: Response) => {
  const { name, room: roomInput } = req.body as { name?: string; room?: string }
  const room = parseRoom(roomInput)
  if (!room) return res.status(400).json({ error: 'Invalid room id' })
  if (!name) return res.status(400).json({ error: 'name required' })
  const safeName = normalizeMdFilename(name)
  if (!safeName) return res.status(400).json({ error: 'Invalid name' })
  const created = store.createFile(room, safeName, `# ${safeName.replace('.md', '')}\n\n`)
  if (!created) return res.status(409).json({ error: 'File already exists' })
  res.json({ name: safeName, room })
})

app.delete('/files/:name', async (req: Request, res: Response) => {
  const room = parseRoom(req.query.room)
  if (!room) return res.status(400).json({ error: 'Invalid room id' })
  const safeName = validateExistingMdFilename(req.params.name)
  if (!safeName) return res.status(400).json({ error: 'Invalid file' })
  const removed = store.deleteFile(room, safeName)
  if (!removed) return res.status(404).json({ error: 'Not found' })
  purgeDoc(getDocKey(room, safeName))
  res.json({ ok: true })
})

app.get('/files/:name/raw', async (req: Request, res: Response) => {
  const room = parseRoom(req.query.room)
  if (!room) return res.status(400).json({ error: 'Invalid room id' })
  const safeName = validateExistingMdFilename(req.params.name)
  if (!safeName) return res.status(400).json({ error: 'Invalid file' })
  const content = store.getFileContent(room, safeName)
  if (content === null) return res.status(404).json({ error: 'Not found' })
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeName)}"`)
  res.send(content)
})

app.get('/export/workspace.zip', async (req: Request, res: Response) => {
  const room = parseRoom(req.query.room)
  if (!room) return res.status(400).json({ error: 'Invalid room id' })
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="markflow-${room}-workspace.zip"`)

  const archive = archiver('zip', { zlib: { level: 9 } })
  archive.on('error', err => {
    console.error('Zip error:', err)
    if (!res.headersSent) res.status(500).end()
  })
  archive.pipe(res)

  try {
    const documents = store.listRoomDocuments(room)
    for (const document of documents) {
      archive.append(document.content, { name: document.name })
    }
  } catch (err) {
    console.error('Zip read error:', err)
  }
  await archive.finalize()
})

app.post('/files/import', upload.array('files', 50), async (req: Request, res: Response) => {
  const room = parseRoom(req.query.room)
  if (!room) return res.status(400).json({ error: 'Invalid room id' })
  const files = req.files as Express.Multer.File[] | undefined
  if (!files?.length) return res.status(400).json({ error: 'No files uploaded' })

  const imported: string[] = []
  const skipped: string[] = []

  for (const f of files) {
    const safeName = normalizeMdFilename(f.originalname)
    if (!safeName) {
      skipped.push(f.originalname || '(unnamed)')
      continue
    }
    const body = f.buffer
    if (!Buffer.isBuffer(body)) {
      skipped.push(safeName)
      continue
    }
    const text = body.toString('utf8')
    store.upsertFile(room, safeName, text)
    purgeDoc(getDocKey(room, safeName))
    imported.push(safeName)
  }

  res.json({ imported, skipped, room })
})

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT || 4000)
const httpServer = server.listen(PORT, () => {
  console.log(`Markflow server running on port ${PORT}`)
  console.log(`SQLite database: ${DATABASE_PATH}`)
  console.log(`Legacy migration workspace: ${LEGACY_WS_DIR}`)
})

let isShuttingDown = false
function shutdown(signal: string): void {
  if (isShuttingDown) return
  isShuttingDown = true
  console.log(`Received ${signal}, shutting down...`)
  try {
    for (const client of wss.clients) {
      if (client.readyState === 1 || client.readyState === 0) client.close()
    }
  } catch {
    /* ignore close errors */
  }
  httpServer.close(() => {
    store.close()
    process.exit(0)
  })
  setTimeout(() => {
    process.exit(0)
  }, 5000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
