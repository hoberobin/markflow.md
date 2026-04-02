# markflow.md

Shared real-time markdown in the browser: one document per deployment, Yjs over WebSockets, no accounts or database.

## Stack

| Part | Tech |
|------|------|
| Client | React, Vite, CodeMirror, Yjs (`client/`, dev port **3000**) |
| Server | Node, Express, `ws`, in-memory Y.Doc (`server/`, port **4000**) |

Collaboration uses **`wss://<page-host>/shared`** (same origin). Override with **`VITE_SERVER_URL`** only for split UI/API deploys or Docker Compose (see below).

## Run locally

**Both processes** (Vite proxies `/shared`, `/health`, `/document` to `:4000`):

```bash
./start.sh
```

Open **http://localhost:3000**. Or manually: `cd server && npm run dev` then `cd client && npm run dev`.

**Docker Compose** (UI :3000, API :4000):

```bash
docker compose up --build
```

**Single container** (one port): build the repo-root [`Dockerfile`](./Dockerfile).

## Environment

Copy [`.env.example`](./.env.example) to `.env` if you use local env files.

| Variable | Role |
|----------|------|
| `PORT` | API port (default `4000`) |
| `CLIENT_DIST` | Path to Vite `dist` when the Node app serves the SPA (e.g. Render) |
| `VITE_SERVER_URL` | Optional. Page origin is used by default; set for split deploy or Compose client build |
| `VITE_WS_URL` | Rare override for WebSocket URL |

## Deploy (Render)

Build from **repo root** (do **not** set Render “Root Directory” to `server` only—the `client/` folder must exist at build time).

**Blueprint:** [Render Dashboard](https://dashboard.render.com) → **New +** → **Blueprint** → connect this repo ([`render.yaml`](./render.yaml)).

**Manual Web Service:** root directory **blank**; build  
`cd server && npm ci && npm run build && cd ../client && npm ci && npm run build`  
start  
`cd server && CLIENT_DIST=../client/dist npm start`  
health check **`/health`**.

## Split static host (e.g. Netlify)

Static hosts do not run this WebSocket server. Either ship **one** Node service that serves `CLIENT_DIST`, or host the API separately and build the client with **`VITE_SERVER_URL=https://<your-api>`**.

## Troubleshooting

- **`curl http://127.0.0.1:4000/health`** → should return `"ok":true`.
- **`vite preview`:** needs API on `:4000`; preview proxies like dev (default port **4173**).
- **Production:** use the **same HTTPS URL** for the app that serves both static assets and upgrades to `wss`.

## Repo commands

```bash
npm run test      # server + client tests
npm run build     # server + client production build
```

## Community

| Doc | Purpose |
|-----|---------|
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Setup, PR expectations |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | Community standards |
| [SECURITY.md](./SECURITY.md) | Vulnerability reporting |
| [CHANGELOG.md](./CHANGELOG.md) | Release notes |
| [DESIGN.md](./DESIGN.md) | UI tokens and layout |
| [LICENSE](./LICENSE) | MIT |

[![CI](https://github.com/hoberobin/markflow/actions/workflows/ci.yml/badge.svg)](https://github.com/hoberobin/markflow/actions/workflows/ci.yml)
