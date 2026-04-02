# markflow.md

**markflow.md** is a single shared real-time markdown room.

Open the URL and start collaborating instantly. No accounts, no setup flow, no database.

## Features

- One shared markdown document for everyone on the same deployment
- Real-time collaborative editing over WebSocket (Yjs CRDT sync)
- Live markdown preview
- Copyable URL for quick sharing
- Download current shared document as `.md`
- Zero database dependencies (in-memory server state only)

## Project status

[![CI](https://github.com/hoberobin/markflow/actions/workflows/ci.yml/badge.svg)](https://github.com/hoberobin/markflow/actions/workflows/ci.yml)

## Architecture

- **Client:** React + Vite (`client/`, default port `3000`)
- **Server:** Node.js + Express + WebSocket (`server/`, default port `4000`)
- **Collaboration engine:** Yjs + awareness protocol
- **Collab URL rule:** the browser uses **the page origin** for WebSockets (`wss://<same-host>/shared`), except when `VITE_SERVER_URL` overrides it for split hosting or Docker Compose.
- **Storage:** In-memory only (resets when server restarts)

## Quick start

### Docker

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:3000`. Compose builds the client with `VITE_SERVER_URL=http://localhost:4000` so the UI (port 3000) still talks to the API (port 4000).

For **one port** locally or in production, use the repo-root [`Dockerfile`](./Dockerfile) instead.

### Local development

```bash
./start.sh
```

This installs dependencies and starts both services. The Vite dev server proxies `/shared`, `/health`, and `/document` to `http://127.0.0.1:4000`, so the client always uses **same-origin** URLs while the API runs on port 4000.

To run the client alone: start the server first (`cd server && npm run dev`), then `cd client && npm run dev`.

## Environment configuration

Copy `.env.example` to `.env` and adjust as needed:

- `PORT`: server port (default `4000`)
- `VITE_SERVER_URL`: optional; only for **split** deploys (static site on host A, API on host B) or the Docker Compose client image. Otherwise the client uses `window.location.origin`.
- `VITE_WS_URL`: optional explicit WebSocket URL (rare)

If `VITE_WS_URL` is not set, WebSockets use `ws:` / `wss:` derived from the collab HTTP base (`VITE_SERVER_URL` or page origin).

## Deployment notes

- Any host that supports Node + WebSockets will work.
- Use persistent storage only if you later decide to add it back; current mode is intentionally ephemeral.

### Render quick path (recommended: one URL)

Use the included [`render.yaml`](./render.yaml) blueprint, or configure manually:

1. Push this repo to GitHub.
2. Create a Render **Web Service** from the repo.
3. Use:
   - Root directory: `server`
   - Build command: `npm ci && npm run build && cd ../client && npm ci && npm run build`
   - Start command: `CLIENT_DIST=../client/dist npm start`
4. Open the service HTTPS URL in two browsers — collaboration uses **the same host** for the page and `wss://`, so no `VITE_*` env vars are required.

### Netlify + separate API (advanced)

If the static site and API are on different domains, set at **client build time**:

- `VITE_SERVER_URL=https://<your-api-host>`

Otherwise the browser will try to open WebSockets on the Netlify origin and sync will not work.

## Development commands

```bash
# Server (required for real-time editing when using Vite dev)
cd server && npm run dev

# Client (proxies Yjs /shared to :4000)
cd client && npm run dev
```

Smoke test: open the dev URL in two browser tabs; both should show **2 online** and shared typing after a moment.

Or run both checks from repo root:

```bash
npm run test
npm run build
```

## Testing

```bash
# Server tests
cd server && npm test

# Client tests
cd client && npm test
```

## Open-source docs

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [SECURITY.md](./SECURITY.md)
- [LICENSE](./LICENSE)
- [CHANGELOG.md](./CHANGELOG.md)
- [ROADMAP.md](./ROADMAP.md)
