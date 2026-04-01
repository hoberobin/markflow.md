# Markflow

Real-time collaborative markdown editor with Claude AI integration.

## Setup

```bash
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
docker-compose up --build
```

Open http://localhost:3000 (API and WebSocket default to **the same hostname** on port 4000, so this works from another device on your LAN if you use the host’s IP in the browser).

## What it does

- Create and edit markdown files together in real time (shared cursors via Yjs)
- Files live in `./workspace/` on your machine (mounted in Docker)
- Ask Claude to rewrite, generate, critique, or chat about any doc
- Run a doc as a prompt template with `{{variable}}` substitution

## Stack

- **Client**: React + Vite (port 3000)
- **Server**: Node.js + WebSocket + REST (port 4000)
- **Sync**: Yjs CRDT
- **AI**: Anthropic API proxied through the server (`GET /health` reports whether a key is configured)

## Development (without Docker)

```bash
./start.sh
```

Or manually:

```bash
# Terminal 1 — server
cd server && npm install && npm run dev

# Terminal 2 — client
cd client && npm install && npm run dev
```

Optional: set `VITE_SERVER_URL` and `VITE_WS_URL` in `.env` at the repo root if the API is not on `hostname:4000`.
