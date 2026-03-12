#!/bin/bash
# Cities of Light — Engine Launcher
#
# Usage:
#   ./engine/start.sh --world worlds/venezia/world-manifest.json
#
# Starts:
#   1. Engine server (port 8800) — loads manifest, serves entities
#   2. Vite dev server (port 3000) — serves engine client with hot reload

set -e

WORLD_ARG="${1:---world}"
WORLD_PATH="${2:-worlds/venezia/world-manifest.json}"

if [ "$WORLD_ARG" = "--world" ]; then
  MANIFEST="$WORLD_PATH"
else
  MANIFEST="$WORLD_ARG"
fi

echo ""
echo "  Cities of Light — Engine"
echo "  ────────────────────────"
echo ""
echo "  World: $MANIFEST"
echo ""

# Start engine server in background
echo "  Starting engine server (port 8800)..."
node engine/index.js --world "$MANIFEST" &
ENGINE_PID=$!

# Wait for server to be ready
sleep 2

# Start vite dev server
echo "  Starting client dev server (port 3000)..."
echo ""
echo "  Open: https://localhost:3000"
echo "  (Ctrl+C to stop)"
echo ""

npx vite --config engine/vite.config.js

# Cleanup
kill $ENGINE_PID 2>/dev/null
