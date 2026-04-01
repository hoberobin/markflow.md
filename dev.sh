#!/bin/bash
# Run markflow.md locally (no Docker needed)

set -euo pipefail

if [ ! -f .env ]; then
  echo "Missing .env — run ./setup.sh first"
  exit 1
fi

# Export all values defined in .env while keeping shell parsing behavior.
set -a
source .env
set +a

echo "▸ Starting markflow.md..."
echo "  Server → http://localhost:4000"
echo "  Client → http://localhost:3000"
echo ""

# Kill on exit
trap 'kill $(jobs -p) 2>/dev/null' EXIT

cd server && npm run dev &
cd client && npm run dev &

wait
