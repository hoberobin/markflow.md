import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import express, { type Request, type Response } from 'express'
import { createServer } from 'http'
import { WebSocketServer, type WebSocket } from 'ws'
import cors from 'cors'
import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync.js'
import * as awarenessProtocol from 'y-protocols/awareness.js'
import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import { DEFAULT_MARKDOWN, SHARED_DOC_KEY, parseDocPath } from './utils/collab.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** When set (or when ../client/dist exists), the API also serves the Vite build so WS + HTTP share one origin. */
function resolveClientDist(): string | null {
  const fromEnv = process.env.CLIENT_DIST?.trim()
  const candidates: string[] = []
  if (fromEnv) candidates.push(path.resolve(process.cwd(), fromEnv))
  candidates.push(path.resolve(process.cwd(), '../client/dist'))
  candidates.push(path.resolve(__dirname, '../../client/dist'))
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir
  }
  return null
}

type MarkflowWebSocket = WebSocket & { markflowAwarenessIds?: Set<number> }

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })

app.set('trust proxy', 1)
app.use(cors())
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  next()
})

const doc = new Y.Doc()
const ytext = doc.getText('content')
if (ytext.length === 0) {
  ytext.insert(0, DEFAULT_MARKDOWN)
}
const awareness = new awarenessProtocol.Awareness(doc)
const clients = new Set<MarkflowWebSocket>()

const MSG_SYNC = 0
const MSG_AWARENESS = 1
const MSG_QUERY_AWARENESS = 3

function toUint8ArrayMessage(data: Buffer | ArrayBuffer | Buffer[]): Uint8Array | null {
  if (Buffer.isBuffer(data)) return new Uint8Array(data)
  if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data))
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  return null
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

awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
  const changedClients = [...added, ...updated, ...removed]
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, MSG_AWARENESS)
  encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients))
  const msg = encoding.toUint8Array(encoder)
  for (const client of clients) {
    if (client.readyState === 1) client.send(msg)
  }
})

app.get('/health', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json({ ok: true, storage: 'memory', mode: 'single-shared-doc' })
})

app.get('/document/raw', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${SHARED_DOC_KEY}.md"`)
  res.send(ytext.toString())
})

const clientDist = resolveClientDist()
if (clientDist) {
  app.use(express.static(clientDist))
  app.get('*', (req, res, next) => {
    if (req.method !== 'GET') return next()
    if (String(req.headers.upgrade || '').toLowerCase() === 'websocket') return next()
    res.sendFile(path.join(clientDist, 'index.html'), err => {
      if (err) next(err)
    })
  })
}

wss.on('connection', (ws: MarkflowWebSocket, req) => {
  const url = new URL(req.url || '/', 'http://localhost')
  if (!parseDocPath(url.pathname)) {
    ws.close(4000, 'Invalid document path')
    return
  }

  clients.add(ws)

  const syncEncoder = encoding.createEncoder()
  encoding.writeVarUint(syncEncoder, MSG_SYNC)
  syncProtocol.writeSyncStep1(syncEncoder, doc)
  ws.send(encoding.toUint8Array(syncEncoder))

  const awarenessStates = awareness.getStates()
  if (awarenessStates.size > 0) {
    const awEncoder = encoding.createEncoder()
    encoding.writeVarUint(awEncoder, MSG_AWARENESS)
    encoding.writeVarUint8Array(
      awEncoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, [...awarenessStates.keys()])
    )
    ws.send(encoding.toUint8Array(awEncoder))
  }

  ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
    const raw = toUint8ArrayMessage(data)
    if (!raw) return
    const decoder = decoding.createDecoder(raw)
    const msgType = decoding.readVarUint(decoder)

    if (msgType === MSG_SYNC) {
      const outEncoder = encoding.createEncoder()
      encoding.writeVarUint(outEncoder, MSG_SYNC)
      const syncMsgType = syncProtocol.readSyncMessage(decoder, outEncoder, doc, ws)
      if (encoding.length(outEncoder) > 1) ws.send(encoding.toUint8Array(outEncoder))

      if (syncMsgType === syncProtocol.messageYjsSyncStep2 || syncMsgType === syncProtocol.messageYjsUpdate) {
        for (const client of clients) {
          if (client !== ws && client.readyState === 1) client.send(raw)
        }
      }
      return
    }

    if (msgType === MSG_AWARENESS) {
      const update = decoding.readVarUint8Array(decoder)
      for (const id of peekAwarenessClientIds(update)) {
        if (!ws.markflowAwarenessIds) ws.markflowAwarenessIds = new Set()
        ws.markflowAwarenessIds.add(id)
      }
      awarenessProtocol.applyAwarenessUpdate(awareness, update, ws)
      return
    }

    if (msgType === MSG_QUERY_AWARENESS) {
      const qEncoder = encoding.createEncoder()
      encoding.writeVarUint(qEncoder, MSG_AWARENESS)
      encoding.writeVarUint8Array(
        qEncoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, [...awareness.getStates().keys()])
      )
      ws.send(encoding.toUint8Array(qEncoder))
    }
  })

  ws.on('close', () => {
    clients.delete(ws)
    const ids = ws.markflowAwarenessIds ? [...ws.markflowAwarenessIds] : []
    if (ids.length) awarenessProtocol.removeAwarenessStates(awareness, ids, ws)
  })
})

const PORT = Number(process.env.PORT || 4000)
const httpServer = server.listen(PORT, () => {
  console.log(`markflow.md server running on port ${PORT}`)
  console.log('Running in single shared document mode (in-memory only)')
  if (clientDist) {
    console.log(`Serving web UI from ${clientDist}`)
  } else {
    console.log('Client SPA not found (set CLIENT_DIST or build client to ../client/dist for same-origin collab)')
  }
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
  httpServer.close(() => process.exit(0))
  setTimeout(() => {
    process.exit(0)
  }, 5000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
