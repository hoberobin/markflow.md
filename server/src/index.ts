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

type MarkflowWebSocket = WebSocket & { markflowAwarenessIds?: Set<number> }

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })

app.use(cors())

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
  res.json({ ok: true, storage: 'memory', mode: 'single-shared-doc' })
})

app.get('/document/raw', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${SHARED_DOC_KEY}.md"`)
  res.send(ytext.toString())
})

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
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
    const decoder = decoding.createDecoder(new Uint8Array(buf))
    const msgType = decoding.readVarUint(decoder)

    if (msgType === MSG_SYNC) {
      const outEncoder = encoding.createEncoder()
      encoding.writeVarUint(outEncoder, MSG_SYNC)
      const syncMsgType = syncProtocol.readSyncMessage(decoder, outEncoder, doc, ws)
      if (encoding.length(outEncoder) > 1) ws.send(encoding.toUint8Array(outEncoder))

      if (syncMsgType === syncProtocol.messageYjsSyncStep2 || syncMsgType === syncProtocol.messageYjsUpdate) {
        for (const client of clients) {
          if (client !== ws && client.readyState === 1) client.send(buf)
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
