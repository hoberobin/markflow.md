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
- **Storage:** In-memory only (resets when server restarts)

## Quick start

### Docker

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:3000`.

### Local development

```bash
./start.sh
```

This installs dependencies and starts both services.

## Environment configuration

Copy `.env.example` to `.env` and adjust as needed:

- `PORT`: server port (default `4000`)
- `VITE_SERVER_URL`: explicit API base URL for the client
- `VITE_WS_URL`: explicit WebSocket base URL (optional)

If `VITE_WS_URL` is not set, the client derives it from `VITE_SERVER_URL` (or from the current host + `:4000`).

## Deployment notes

- Any host that supports Node + WebSockets will work.
- Use persistent storage only if you later decide to add it back; current mode is intentionally ephemeral.

### Render quick path (server)

1. Push this repo to GitHub.
2. Create a Render Web Service from this repo.
3. Use:
   - Root directory: `server`
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
4. Deploy and copy the HTTPS URL (example: `https://markflow-api.onrender.com`).

### Netlify quick path (client)

1. Import this repo in Netlify.
2. Use:
   - Base directory: `client`
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Add:
   - `VITE_SERVER_URL=https://<your-render-service>.onrender.com`
4. Deploy.

## Development commands

```bash
# Server
cd server && npm run dev

# Client
cd client && npm run dev
```

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
