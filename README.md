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

## Fastest way to go live (no domain required)

This is the lightest public setup for team sharing:

- **Frontend:** Netlify (serves React app)
- **Backend:** any host with HTTPS + WebSocket support (Render is easiest)

You will end up with links like:

- App: `https://your-netlify-site.netlify.app`
- Room: `https://your-netlify-site.netlify.app/?room=team-alpha`

### 1) Deploy server (Render quick path)

1. Push this repo to GitHub.
2. In Render, create a new **Web Service** from this repo.
3. Use these settings:
   - Root directory: `server`
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
4. Deploy and copy the HTTPS URL (example: `https://markflow-api.onrender.com`).

> Markflow uses WebSockets for real-time sync; Render supports this out of the box.

### 2) Deploy client (Netlify)

1. In Netlify, import the same GitHub repo.
2. Use these settings:
   - Base directory: `client`
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Add environment variable:
   - `VITE_SERVER_URL=https://<your-render-service>.onrender.com`
4. Deploy.

`VITE_WS_URL` is optional; if omitted, Markflow automatically derives `ws://`/`wss://` from `VITE_SERVER_URL`.

### 3) Share a room

Open your Netlify URL and share:

- `https://your-netlify-site.netlify.app/?room=design-review`
- `https://your-netlify-site.netlify.app/?room=docs-sprint`

Anyone with the link joins the same room and collaborates in real time.

### Reverse proxy essentials (Nginx/Caddy/etc., if self-hosting)

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
