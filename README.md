# Markflow

Real-time collaborative markdown editor with shareable room links.

## What it does

- Create and edit markdown files together in real time (shared cursors via Yjs)
- Share a room instantly via URL (`?room=<id>`) so collaborators land in the same workspace
- Keep each room isolated (separate file list, websocket docs, exports)
- Live markdown preview while editing
- Download the active markdown file or export the full room as a zip

## Stack

- **Client**: React + Vite (port 3000)
- **Server**: Node.js + WebSocket + REST (port 4000)
- **Sync**: Yjs CRDT

## Quick start (Docker)

```bash
cp .env.example .env
docker-compose up --build
```

Open `http://localhost:3000`.

By default, API and WebSocket use the same hostname on port `4000`, so sharing from another device on your LAN works by replacing `localhost` with your machine IP.

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

## Collaboration model (rooms)

- Default room is `lobby`.
- A room is selected by URL query param: `?room=my-team`.
- The UI has:
  - room input + Join
  - Copy link
  - New room (generates an instant shareable slug)

Examples:

- `https://your-domain/?room=design-review`
- `https://your-domain/?room=docs-sprint`

Anyone with the link joins the same room and sees the same markdown file set for that room.

## Deploy for instant online sharing

To make Markflow internet-accessible:

1. Deploy the **server** on a public host/container and expose port `4000`.
2. Deploy the **client** on a public host (or static hosting) and point it at the server:
   - `VITE_SERVER_URL=https://api.your-domain.com`
   - `VITE_WS_URL=wss://api.your-domain.com`
3. Ensure reverse proxy supports WebSocket upgrades.
4. Share links like `https://app.your-domain.com/?room=team-alpha`.

### Reverse proxy essentials (Nginx/Caddy/etc.)

- Route HTTP API traffic to server `:4000`
- Forward `Upgrade` + `Connection` headers for websocket paths
- Use TLS in production (`https`/`wss`)

## Testing

```bash
# server
cd server && npm test

# client
cd client && npm test
```
