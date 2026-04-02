# Contributing

Thanks for helping improve markflow.md. Small, focused PRs are easiest to review.

## Setup

```bash
./start.sh
```

Or two terminals: `cd server && npm ci && npm run dev` and `cd client && npm ci && npm run dev`. The API must be on **port 4000** while using Vite dev (proxy).

See [README.md](./README.md) for Docker, Render, and environment variables.

## Before you open a PR

```bash
npm run test
npm run build
```

Use **`npm ci`** in CI-like checks; **`npm install`** is fine for local iteration.

## PRs

- Describe **user-visible** changes.
- Update docs when behavior or deploy steps change.
- Add or adjust tests for non-trivial logic.
- Note anything sensitive in **SECURITY.md** instead of a public issue.

## Style

- TypeScript in `client/` and `server/`.
- Prefer small functions and explicit names.
- Comment only where the “why” is not obvious.

## Changelog

Add a line under **[Unreleased]** in [CHANGELOG.md](./CHANGELOG.md) for meaningful user-facing changes.
