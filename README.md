# markflow.md

**markflow.md** is a real-time collaborative markdown workspace with shareable room links.

Use it for fast writing sessions, docs jams, and lightweight team note-taking without complex project setup.

## Features

- Real-time collaborative markdown editing (Yjs-based CRDT sync)
- Shareable room links (`?room=<id>`) so collaborators join instantly
- Room isolation for files, editor state, and exports
- Live markdown preview
- Download the active `.md` file
- Export all room files as a `.zip`
- Import multiple markdown files into a room

## Project status

[![CI](https://github.com/hoberobin/markflow/actions/workflows/ci.yml/badge.svg)](https://github.com/hoberobin/markflow/actions/workflows/ci.yml)

## Architecture

- **Client:** React + Vite (`client/`, default port `3000`)
- **Server:** Node.js + Express + WebSocket (`server/`, default port `4000`)
- **Collaboration engine:** Yjs + awareness protocol
- **Database:** SQLite (`better-sqlite3`) for lightweight persistence

## Storage model (fast + lightweight)

- Markflow now stores room/file content in a single SQLite file (`data/markflow.db` by default).
- On first boot, legacy markdown files from `workspace/` are auto-imported into SQLite.
- SQLite is ideal for low-ops hosting and Raspberry Pi (single-file DB, no external DB service).
- You can override the DB location with `DATABASE_PATH`.

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

This script installs dependencies and starts both services.

## Environment configuration

Copy `.env.example` to `.env` and adjust as needed:

- `PORT`: server port (default `4000`)
- `VITE_SERVER_URL`: explicit API base URL for the client
- `VITE_WS_URL`: explicit WebSocket base URL (optional)

If `VITE_WS_URL` is not set, the client derives it from `VITE_SERVER_URL` (or from the current host + `:4000`).

Optional server env var:

- `DATABASE_PATH=./data/markflow.db`

## Collaboration model (rooms)

- Default room: `lobby`
- Room comes from URL query parameter: `?room=my-team`
- Anyone with the same room link sees the same markdown file set

Examples:

- `https://your-domain/?room=design-review`
- `https://your-domain/?room=docs-sprint`

## Deploying publicly

The easiest public setup:

- **Frontend:** Netlify
- **Backend:** Render (or any host supporting HTTPS + WebSocket)

### Deploy server (Render quick path)

1. Push this repo to GitHub.
2. Create a Render Web Service from this repo.
3. Use:
   - Root directory: `server`
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Add a Disk (recommended): mount path `/opt/render/project/data`
   - Env var: `DATABASE_PATH=/opt/render/project/data/markflow.db`
4. Deploy and copy the HTTPS URL (example: `https://markflow-api.onrender.com`).

### Deploy client (Netlify)

1. Import this repo in Netlify.
2. Use:
   - Base directory: `client`
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Add:
   - `VITE_SERVER_URL=https://<your-render-service>.onrender.com`
4. Deploy.

Share links like:

- `https://your-netlify-site.netlify.app/?room=team-alpha`

## Development commands

```bash
# Server
cd server && npm run dev

# Client
cd client && npm run dev
```

Or run both quality checks from the repo root:

```bash
npm run test
npm run build
```

## Raspberry Pi quick deploy (recommended for fastest self-hosting)

Markflow is now SQLite-based, so Pi deployment stays simple:

```bash
git clone <your-repo-url>
cd markflow
cp .env.example .env
docker-compose up --build -d
```

Then open:

- `http://<pi-ip>:3000` (client)
- server runs at `http://<pi-ip>:4000`

Persistent data:

- SQLite DB is stored at `./data/markflow.db` (mounted to `/app/data/markflow.db` in Docker).

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
