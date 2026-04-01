/** Markdown assistant prompts and message building for POST /claude */

const DEFAULT_SYSTEM =
  'You are a helpful writing assistant embedded in a collaborative markdown editor. Follow instructions precisely. When asked for only specific output (e.g. rewritten text or a new section), return that output alone with no preamble or meta-commentary unless the user asked for explanation.'

export type ClaudeMode = 'rewrite' | 'generate' | 'summarize' | 'review' | 'chat' | 'run'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export interface TruncateResult {
  text: string
  truncated: boolean
}

export function truncateDocument(content: string | undefined, maxChars: number): TruncateResult {
  const c = content || ''
  if (!maxChars || maxChars <= 0 || c.length <= maxChars) {
    return { text: c, truncated: false }
  }
  const head = Math.floor(maxChars * 0.6)
  const tail = Math.max(0, maxChars - head - 120)
  const notice =
    '\n\n[... document truncated for length. Prefer selection-based rewrite or split the document for full context. ...]\n\n'
  return {
    text: c.slice(0, head) + notice + c.slice(c.length - tail),
    truncated: true
  }
}

interface HistoryItem {
  role?: string
  content?: unknown
}

export function normalizeHistory(raw: unknown, maxPairs = 10): ChatMessage[] {
  if (!Array.isArray(raw)) return []
  const maxItems = maxPairs * 2
  const out: ChatMessage[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const h = item as HistoryItem
    const content = typeof h.content === 'string' ? h.content : ''
    const role =
      h.role === 'assistant' ? 'assistant' : h.role === 'user' ? 'user' : null
    if (!role || !content) continue
    const text = content.slice(0, 12000)
    if (out.length && out[out.length - 1].role === role) {
      out[out.length - 1].content += '\n\n' + text
    } else {
      out.push({ role, content: text })
    }
  }
  return out.slice(-maxItems)
}

export interface BuildClaudeRequestOpts {
  mode: ClaudeMode
  content?: string
  selection?: string
  instruction?: string
  variables?: Record<string, unknown>
  history?: unknown
  maxDocChars: number
  defaultMaxTokens: number
}

export interface BuildClaudeRequestResult {
  system: string
  messages: ChatMessage[]
  maxTokens: number
}

export function buildClaudeRequest(opts: BuildClaudeRequestOpts): BuildClaudeRequestResult {
  const {
    mode,
    content,
    selection,
    instruction,
    variables,
    history,
    maxDocChars,
    defaultMaxTokens
  } = opts

  const doc = truncateDocument(content || '', maxDocChars)
  const inst = (instruction || '').trim()

  let system = DEFAULT_SYSTEM
  let messages: ChatMessage[] = []
  let maxTokens = defaultMaxTokens

  if (mode === 'rewrite' && selection) {
    system =
      'You rewrite text for clarity and tone. Return only the rewritten text, with no quotes or explanation.'
    messages = [
      {
        role: 'user',
        content: `Rewrite the following selected markdown/plain text.\n\nInstruction: ${inst || 'Improve clarity and conciseness'}\n\nText to rewrite:\n${selection}`
      }
    ]
  } else if (mode === 'generate') {
    system =
      'You add markdown content to documents. Return only the new markdown block to insert (headings, lists, paragraphs as appropriate), with no preamble.'
    messages = [
      {
        role: 'user',
        content: `Add a new section or content to this markdown document.\n\nInstruction:\n${inst}\n\nExisting document:\n${doc.text}`
      }
    ]
  } else if (mode === 'summarize' || mode === 'review') {
    system =
      'You review markdown documents for a writing team. Be direct and actionable. Use exactly these section headings in order (markdown ## headings): ## Summary, ## Strengths, ## Issues, ## Suggested improvements. Under each section use short bullet points where helpful. Do not wrap the whole response in a code fence.'
    messages = [
      {
        role: 'user',
        content: `Review the following markdown document.\n\n${doc.text}`
      }
    ]
    maxTokens = Math.min(8192, Math.floor(defaultMaxTokens * 1.5))
  } else if (mode === 'chat') {
    system =
      'You assist collaborators editing a markdown document. Answer using the current document when relevant. Be concise unless the user asks for detail. The latest user message includes the up-to-date document after "---".'
    const hist = normalizeHistory(history)
    const finalUser = `${inst}\n\n---\nCurrent document:\n${doc.text}`
    messages = [...hist, { role: 'user', content: finalUser }]
  } else if (mode === 'run') {
    let processed = content || ''
    if (variables && typeof variables === 'object') {
      Object.entries(variables).forEach(([k, v]) => {
        processed = processed.replaceAll(`{{${k}}}`, String(v ?? ''))
      })
    }
    system = 'You are an AI assistant. Execute the following prompt faithfully.'
    messages = [{ role: 'user', content: processed }]
  } else {
    throw new Error('Invalid mode')
  }

  return { system, messages, maxTokens }
}
