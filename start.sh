#!/usr/bin/env bash
# Cities of Light — Single-command launcher
# Builds client, starts server, opens Cloudflare tunnel
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Kill previous instances
echo "🔄 Cleaning up old processes..."
lsof -ti :8800 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti :8900 2>/dev/null | xargs kill -9 2>/dev/null || true
pgrep -f "cloudflared.*8800" | xargs kill 2>/dev/null || true
sleep 1

# Build client (production bundle)
echo "📦 Building client..."
npx vite build 2>&1 | tail -3

# Start FastAPI services (consent, vault, biography on port 8900)
echo "🧠 Starting FastAPI services..."
nohup uvicorn services.app:app --host 0.0.0.0 --port 8900 > /tmp/cities-fastapi.log 2>&1 &
FASTAPI_PID=$!
sleep 1

if ! kill -0 $FASTAPI_PID 2>/dev/null; then
  echo "⚠️  FastAPI failed to start (non-critical). Check /tmp/cities-fastapi.log"
fi

# Start server (API + static + WebSocket on port 8800)
echo "🚀 Starting server..."
nohup node src/server/index.js > /tmp/cities-server.log 2>&1 &
SERVER_PID=$!
sleep 1

if ! kill -0 $SERVER_PID 2>/dev/null; then
  echo "❌ Server failed to start. Check /tmp/cities-server.log"
  cat /tmp/cities-server.log
  exit 1
fi

# Start Cloudflare tunnel (HTTP, not HTTPS — no TLS issues)
echo "🌐 Starting Cloudflare tunnel..."
nohup cloudflared tunnel --url http://localhost:8800 > /tmp/cities-tunnel.log 2>&1 &
TUNNEL_PID=$!

# Wait for tunnel URL
for i in $(seq 1 15); do
  TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cities-tunnel.log 2>/dev/null | head -1)
  if [ -n "$TUNNEL_URL" ]; then break; fi
  sleep 1
done

echo ""
echo "════════════════════════════════════════════════════"
echo "  Cities of Light"
echo "════════════════════════════════════════════════════"
echo "  Local:     http://localhost:8800"
echo "  Tunnel:    ${TUNNEL_URL:-'(waiting...check /tmp/cities-tunnel.log)'}"
echo "  VR:        ${TUNNEL_URL:-'...'}"
echo "  Stream:    ${TUNNEL_URL:+${TUNNEL_URL}/?view=manemus}"
echo ""
echo "  FastAPI:   PID ${FASTAPI_PID:-N/A}  (log: /tmp/cities-fastapi.log)"
echo "  Server:    PID $SERVER_PID  (log: /tmp/cities-server.log)"
echo "  Tunnel:    PID $TUNNEL_PID  (log: /tmp/cities-tunnel.log)"
echo "════════════════════════════════════════════════════"

# Save URL for other scripts
if [ -n "$TUNNEL_URL" ]; then
  echo "$TUNNEL_URL" > /tmp/cities-tunnel-url.txt
fi
