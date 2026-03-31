# Markflow

Real-time collaborative markdown editor with Claude AI integration.

## Setup

```bash
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
docker-compose up
```

Open http://localhost:3000

## What it does

- Create and edit markdown files together in real time (Google Docs-style cursors)
- Files live in `./workspace/` on your machine
- Ask Claude to rewrite, generate, summarize, or chat about any doc
- Run a doc as a prompt template with `{{variable}}` substitution

## Stack

- **Client**: React + Vite (port 3000)
- **Server**: Node.js + WebSocket + REST (port 4000)
- **Sync**: Yjs CRDT — conflict-free real-time collaboration
- **AI**: Anthropic API proxied through server

## Development (without Docker)

```bash
# Terminal 1 — server
cd server && npm install && npm run dev

# Terminal 2 — client  
cd client && npm install && npm run dev
```
