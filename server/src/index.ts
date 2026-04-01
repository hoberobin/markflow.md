import express, { type Request, type Response } from 'express'
import { createServer } from 'http'
import { WebSocketServer, type WebSocket } from 'ws'
import cors from 'cors'
import fs from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import multer from 'multer'
import archiver from 'archiver'
import { buildClaudeRequest, type ClaudeMode } from './claudePrompts.js'
import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync.js'
import * as awarenessProtocol from 'y-protocols/awareness.js'
import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'

type MarkflowWebSocket = WebSocket & { markflowAwarenessIds?: Set<number> }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = path.resolve('/app/workspace')
const DEV_WORKSPACE = path.resolve(__dirname, '../../workspace')
const WS_DIR = existsSync('/app/workspace') ? WORKSPACE : DEV_WORKSPACE

if (!existsSync(WS_DIR)) mkdirSync(WS_DIR, { recursive: true })

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
})

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/health', (_req: Request, res: Response) => {
  const key = process.env.ANTHROPIC_API_KEY
  res.json({
    ok: true,
    claude: Boolean(key && String(key).trim().length > 0)
  })
})

// ─── Yjs document store ───────────────────────────────────────────────────────
const docs = new Map<string, Y.Doc>()
const awareness = new Map<string, awarenessProtocol.Awareness>()
const docClients = new Map<string, Set<MarkflowWebSocket>>()

const MSG_SYNC = 0
const MSG_AWARENESS = 1
const MSG_QUERY_AWARENESS = 3

/** y-websocket uses `wsUrl + '/' + roomName` — room is the path, not ?doc= */
function docNameFromWebsocketPath(pathname: string): string | null {
  let segment = pathname.replace(/^\/+/, '')
  if (!segment) return null
  try {
    segment = decodeURIComponent(segment)
  } catch {
    return null
  }
  if (segment.includes('..') || segment.includes('/') || segment.includes('\\')) return null
  if (!segment.endsWith('.md')) return null
  if (path.basename(segment) !== segment) return null
  return segment
}

function sanitizeMdFilename(name: unknown): string | null {
  const cleaned = String(name || '')
    .replace(/[^a-zA-Z0-9_\-. ]/g, '')
    .trim()
  if (!cleaned) return null
  return cleaned.endsWith('.md') ? cleaned : `${cleaned}.md`
}

/** Drop in-memory Yjs state and disconnect clients so they reload from disk */
function purgeDoc(docName: string): void {
  const clients = docClients.get(docName)
  if (clients && clients.size) {
    for (const ws of [...clients]) {
      try {
        if (ws.readyState === 1) ws.close(4001, 'Document reloaded')
      } catch {
        /* ignore */
      }
    }
  }
  docs.delete(docName)
  awareness.delete(docName)
  docClients.delete(docName)
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

function getDoc(docName: string): { doc: Y.Doc; aw: awarenessProtocol.Awareness } {
  if (!docs.has(docName)) {
    const doc = new Y.Doc()
    const aw = new awarenessProtocol.Awareness(doc)
    docs.set(docName, doc)
    awareness.set(docName, aw)
    docClients.set(docName, new Set())

    const filePath = path.join(WS_DIR, docName)
    if (existsSync(filePath)) {
      fs.readFile(filePath, 'utf8')
        .then(content => {
          const ytext = doc.getText('content')
          if (ytext.length === 0) {
            doc.transact(() => {
              ytext.insert(0, content)
            })
          }
        })
        .catch(() => {})
    }

    doc.on('update', () => {
      const content = doc.getText('content').toString()
      fs.writeFile(filePath, content).catch(console.error)
    })

    aw.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      const clients = docClients.get(docName) || new Set()
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
  return { doc: docs.get(docName)!, aw: awareness.get(docName)! }
}

// ─── WebSocket handler ────────────────────────────────────────────────────────
wss.on('connection', (ws: MarkflowWebSocket, req) => {
  const url = new URL(req.url || '/', 'http://localhost')
  const docName = docNameFromWebsocketPath(url.pathname)
  if (!docName) {
    ws.close(4000, 'Invalid document')
    return
  }

  const { doc, aw } = getDoc(docName)
  const clients = docClients.get(docName)!
  clients.add(ws)

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
    clients.delete(ws)
    const ids = ws.markflowAwarenessIds ? [...ws.markflowAwarenessIds] : []
    if (ids.length) awarenessProtocol.removeAwarenessStates(aw, ids, ws)
  })
})

// ─── REST: file listing ───────────────────────────────────────────────────────
app.get('/files', async (_req: Request, res: Response) => {
  try {
    const entries = await fs.readdir(WS_DIR, { withFileTypes: true })
    const files = entries
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => ({ name: e.name, path: e.name }))
    res.json(files)
  } catch {
    res.json([])
  }
})

app.post('/files', async (req: Request, res: Response) => {
  const { name } = req.body as { name?: string }
  if (!name) return res.status(400).json({ error: 'name required' })
  const safeName = sanitizeMdFilename(name)
  if (!safeName) return res.status(400).json({ error: 'Invalid name' })
  const filePath = path.join(WS_DIR, safeName)
  if (existsSync(filePath)) return res.status(409).json({ error: 'File already exists' })
  await fs.writeFile(filePath, `# ${safeName.replace('.md', '')}\n\n`)
  res.json({ name: safeName })
})

app.delete('/files/:name', async (req: Request, res: Response) => {
  const safeName = path.basename(req.params.name)
  const filePath = path.join(WS_DIR, safeName)
  if (!existsSync(filePath)) return res.status(404).json({ error: 'Not found' })
  await fs.unlink(filePath)
  if (docs.has(safeName)) {
    docs.delete(safeName)
    awareness.delete(safeName)
    docClients.delete(safeName)
  }
  res.json({ ok: true })
})

app.get('/files/:name/raw', async (req: Request, res: Response) => {
  const safeName = path.basename(req.params.name)
  if (!safeName.endsWith('.md') || safeName !== sanitizeMdFilename(safeName)) {
    return res.status(400).json({ error: 'Invalid file' })
  }
  const filePath = path.join(WS_DIR, safeName)
  if (!existsSync(filePath)) return res.status(404).json({ error: 'Not found' })
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeName)}"`)
  res.sendFile(path.resolve(filePath))
})

app.get('/export/workspace.zip', async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', 'attachment; filename="markflow-workspace.zip"')

  const archive = archiver('zip', { zlib: { level: 9 } })
  archive.on('error', err => {
    console.error('Zip error:', err)
    if (!res.headersSent) res.status(500).end()
  })
  archive.pipe(res)

  try {
    const entries = await fs.readdir(WS_DIR, { withFileTypes: true })
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith('.md')) {
        archive.file(path.join(WS_DIR, e.name), { name: e.name })
      }
    }
  } catch (err) {
    console.error('Zip read dir:', err)
  }
  await archive.finalize()
})

app.post('/files/import', upload.array('files', 50), async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[] | undefined
  if (!files?.length) return res.status(400).json({ error: 'No files uploaded' })

  const imported: string[] = []
  const skipped: string[] = []

  for (const f of files) {
    const safeName = sanitizeMdFilename(f.originalname)
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
    const filePath = path.join(WS_DIR, safeName)
    await fs.writeFile(filePath, text, 'utf8')
    purgeDoc(safeName)
    imported.push(safeName)
  }

  res.json({ imported, skipped })
})

// ─── REST: Claude proxy ───────────────────────────────────────────────────────
app.post('/claude', async (req: Request, res: Response) => {
  const { mode, content, selection, instruction, variables, history } = req.body as {
    mode?: string
    content?: string
    selection?: string
    instruction?: string
    variables?: Record<string, unknown>
    history?: unknown
  }

  const validModes = new Set<ClaudeMode>(['rewrite', 'generate', 'summarize', 'review', 'chat', 'run'])
  if (!mode || !validModes.has(mode as ClaudeMode)) {
    return res.status(400).json({ error: 'Invalid mode' })
  }

  if (mode === 'rewrite' && !selection) {
    return res.status(400).json({ error: 'Selection required for rewrite mode' })
  }

  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return res.status(503).json({ error: 'Claude is not configured (missing ANTHROPIC_API_KEY)' })
  }

  const model = process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514'
  const defaultMaxTokens = Math.min(
    8192,
    Math.max(256, parseInt(process.env.CLAUDE_MAX_TOKENS || '4096', 10) || 4096)
  )
  const maxDocChars = Math.max(
    4000,
    parseInt(process.env.CLAUDE_MAX_DOC_CHARS || '100000', 10) || 100000
  )

  let systemPrompt: string
  let messages: Anthropic.Messages.MessageParam[]
  let maxTokens = defaultMaxTokens

  try {
    const built = buildClaudeRequest({
      mode: mode as ClaudeMode,
      content,
      selection,
      instruction,
      variables,
      history,
      maxDocChars,
      defaultMaxTokens
    })
    systemPrompt = built.system
    messages = built.messages
    maxTokens = built.maxTokens
  } catch {
    return res.status(400).json({ error: 'Invalid mode' })
  }

  try {
    const stream = await anthropic.messages.stream({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages
    })

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
      }
    }
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err: unknown) {
    console.error('Claude error:', err)
    const message = err instanceof Error ? err.message : 'Claude request failed'
    if (!res.headersSent) {
      res.status(500).json({ error: message })
    } else {
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    }
  }
})

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000
server.listen(PORT, () => {
  console.log(`Markflow server running on port ${PORT}`)
  console.log(`Workspace: ${WS_DIR}`)
})
