#!/bin/bash
set -e

echo "▸ markflow.md setup"

# Check for .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ Created .env"
fi

# Install deps
echo "▸ Installing server dependencies..."
cd server && npm install --silent
cd ..

echo "▸ Installing client dependencies..."
cd client && npm install --silent
cd ..

echo ""
echo "✓ Ready. Run one of:"
echo ""
echo "  Docker:  docker compose up"
echo "  Local:   ./dev.sh"
echo ""
