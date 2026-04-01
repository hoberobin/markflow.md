#!/bin/bash
# Markflow quick start — runs client + server without Docker
# Usage: ./start.sh

set -e

if [ ! -f .env ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
fi

echo "Installing server dependencies..."
cd server && npm install --silent && cd ..

echo "Installing client dependencies..."
cd client && npm install --silent && cd ..

echo ""
echo "Starting Markflow..."
echo "  Client → http://localhost:3000"
echo "  Server → http://localhost:4000"
echo ""

# Run both in parallel
(cd server && npm run dev) &
SERVER_PID=$!

(cd client && npm run dev) &
CLIENT_PID=$!

trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit" INT TERM

wait
