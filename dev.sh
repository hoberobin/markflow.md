#!/bin/bash
# Run markflow locally (no Docker needed)

if [ ! -f .env ]; then
  echo "Missing .env — run ./setup.sh first"
  exit 1
fi

export $(grep -v '^#' .env | xargs)

echo "▸ Starting Markflow..."
echo "  Server → http://localhost:4000"
echo "  Client → http://localhost:3000"
echo ""

# Kill on exit
trap 'kill $(jobs -p) 2>/dev/null' EXIT

cd server && npm run dev &
cd client && npm run dev &

wait
