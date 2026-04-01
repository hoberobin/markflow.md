# Contributing to markflow.md

Thanks for helping improve markflow.md. This guide keeps contributions fast to review and easy to merge.

## Development setup

### Option 1: One-command local startup

```bash
./start.sh
```

This installs dependencies for both packages and starts:

- client on `http://localhost:3000`
- server on `http://localhost:4000`

### Option 2: Manual startup

```bash
# terminal 1
cd server && npm install && npm run dev

# terminal 2
cd client && npm install && npm run dev
```

## Environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Common variables:

- `PORT` (server port, default `4000`)
- `VITE_SERVER_URL` (client API base URL)
- `VITE_WS_URL` (optional explicit WebSocket URL)

## Tests

Run tests before opening a PR:

```bash
cd server && npm test
cd client && npm test
```

## Build verification

```bash
cd server && npm run build
cd client && npm run build
```

## Pull request expectations

- Keep PRs focused and scoped.
- Describe user-visible behavior changes clearly.
- Include test/build evidence in the PR description.
- Update docs when adding or changing features.

## Code style

- TypeScript throughout both packages.
- Prefer small, composable functions.
- Keep naming explicit and avoid hidden side effects.
- Add comments only when logic is non-obvious.
