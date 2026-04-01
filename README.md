# Markflow

Real-time collaborative markdown editor.

## Setup

```bash
cp .env.example .env
docker-compose up --build
```

Open http://localhost:3000 (API and WebSocket default to **the same hostname** on port 4000, so this works from another device on your LAN if you use the host’s IP in the browser).

## What it does

- Create and edit markdown files together in real time (shared cursors via Yjs)
- Files live in `./workspace/` on your machine (mounted in Docker)
- Live markdown preview while editing
- Download the active markdown file or export the full workspace as a zip

## Stack

- **Client**: React + Vite (port 3000)
- **Server**: Node.js + WebSocket + REST (port 4000)
- **Sync**: Yjs CRDT

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
