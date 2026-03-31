import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import cors from 'cors'
import fs from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import chokidar from 'chokidar'
import Anthropic from '@anthropic-ai/sdk'
import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync.js'
import * as awarenessProtocol from 'y-protocols/awareness.js'
import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = path.resolve('/app/workspace')
const DEV_WORKSPACE = path.resolve(__dirname, '../../workspace')
const WS_DIR = existsSync('/app/workspace') ? WORKSPACE : DEV_WORKSPACE

if (!existsSync(WS_DIR)) mkdirSync(WS_DIR, { recursive: true })

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// ─── Yjs document store ───────────────────────────────────────────────────────
const docs = new Map()      // docName → Y.Doc
const awareness = new Map() // docName → awarenessProtocol.Awareness
const docClients = new Map() // docName → Set<ws>

const MSG_SYNC = 0
const MSG_AWARENESS = 1

function getDoc(docName) {
  if (!docs.has(docName)) {
    const doc = new Y.Doc()
    const aw = new awarenessProtocol.Awareness(doc)
    docs.set(docName, doc)
    awareness.set(docName, aw)
    docClients.set(docName, new Set())

    // Load existing file content into Yjs text
    const filePath = path.join(WS_DIR, docName)
    if (existsSync(filePath)) {
      fs.readFile(filePath, 'utf8').then(content => {
        const ytext = doc.getText('content')
        if (ytext.length === 0) {
          doc.transact(() => { ytext.insert(0, content) })
        }
      }).catch(() => {})
    }

    // Persist to disk on change
    doc.on('update', () => {
      const content = doc.getText('content').toString()
      fs.writeFile(filePath, content).catch(console.error)
    })

    // Broadcast awareness changes
    aw.on('update', ({ added, updated, removed }) => {
      const clients = docClients.get(docName) || new Set()
      const changedClients = [...added, ...updated, ...removed]
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MSG_AWARENESS)
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(aw, changedClients))
      const msg = encoding.toUint8Array(encoder)
      clients.forEach(c => { if (c.readyState === 1) c.send(msg) })
    })
  }
  return { doc: docs.get(docName), aw: awareness.get(docName) }
}

// ─── WebSocket handler ────────────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost')
  const docName = decodeURIComponent(url.searchParams.get('doc') || 'untitled.md')

  const { doc, aw } = getDoc(docName)
  const clients = docClients.get(docName)
  clients.add(ws)

  // Send sync step 1
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, MSG_SYNC)
  syncProtocol.writeSyncStep1(encoder, doc)
  ws.send(encoding.toUint8Array(encoder))

  // Send current awareness
  const awarenessStates = aw.getStates()
  if (awarenessStates.size > 0) {
    const awEncoder = encoding.createEncoder()
    encoding.writeVarUint(awEncoder, MSG_AWARENESS)
    encoding.writeVarUint8Array(awEncoder, awarenessProtocol.encodeAwarenessUpdate(aw, [...awarenessStates.keys()]))
    ws.send(encoding.toUint8Array(awEncoder))
  }

  ws.on('message', (data) => {
    const decoder = decoding.createDecoder(new Uint8Array(data))
    const msgType = decoding.readVarUint(decoder)

    if (msgType === MSG_SYNC) {
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MSG_SYNC)
      const syncMsgType = syncProtocol.readSyncMessage(decoder, encoder, doc, ws)
      if (encoding.length(encoder) > 1) {
        ws.send(encoding.toUint8Array(encoder))
      }
      // Broadcast update to other clients
      if (syncMsgType === syncProtocol.messageYjsSyncStep2 || syncMsgType === syncProtocol.messageYjsUpdate) {
        clients.forEach(c => { if (c !== ws && c.readyState === 1) c.send(data) })
      }
    } else if (msgType === MSG_AWARENESS) {
      const update = decoding.readVarUint8Array(decoder)
      awarenessProtocol.applyAwarenessUpdate(aw, update, ws)
    }
  })

  ws.on('close', () => {
    clients.delete(ws)
    awarenessProtocol.removeAwarenessStates(aw, [doc.clientID], ws)
  })
})

// ─── REST: file listing ───────────────────────────────────────────────────────
app.get('/files', async (req, res) => {
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

app.post('/files', async (req, res) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  const safeName = name.replace(/[^a-zA-Z0-9_\-. ]/g, '').trim() + (name.endsWith('.md') ? '' : '.md')
  const filePath = path.join(WS_DIR, safeName)
  if (existsSync(filePath)) return res.status(409).json({ error: 'File already exists' })
  await fs.writeFile(filePath, `# ${safeName.replace('.md', '')}\n\n`)
  res.json({ name: safeName })
})

app.delete('/files/:name', async (req, res) => {
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

// ─── REST: Claude proxy ───────────────────────────────────────────────────────
app.post('/claude', async (req, res) => {
  const { mode, content, selection, instruction, variables } = req.body

  let systemPrompt = 'You are a helpful writing assistant embedded in a collaborative markdown editor. Respond only with the requested content — no preamble, no explanation unless asked.'
  let userMessage = ''

  if (mode === 'rewrite' && selection) {
    userMessage = `Rewrite the following selected text. Return only the rewritten text, nothing else.\n\nInstruction: ${instruction || 'Improve clarity and conciseness'}\n\nText to rewrite:\n${selection}`
  } else if (mode === 'generate') {
    userMessage = `Add a new section to this markdown document. Return only the new markdown content to insert, nothing else.\n\nInstruction: ${instruction}\n\nExisting document:\n${content}`
  } else if (mode === 'summarize') {
    userMessage = `Summarize and critique this markdown document. Be direct and specific.\n\n${content}`
  } else if (mode === 'chat') {
    userMessage = `${instruction}\n\nDocument context:\n${content}`
  } else if (mode === 'run') {
    let processed = content
    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        processed = processed.replaceAll(`{{${k}}}`, v)
      })
    }
    userMessage = processed
    systemPrompt = 'You are an AI assistant. Execute the following prompt faithfully.'
  } else {
    return res.status(400).json({ error: 'Invalid mode' })
  }

  try {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
      }
    }
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('Claude error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000
server.listen(PORT, () => {
  console.log(`Markflow server running on port ${PORT}`)
  console.log(`Workspace: ${WS_DIR}`)
})
