#!/bin/bash
# Cities of Light — Render startup script
# Generates .env from Render env vars and patches .mcp.json paths before launch.
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

echo "[render-start] Starting Cities of Light on Render..."

# ── 1. Generate .env from Render environment ─────────────────────────────
# Render injects env vars into the process, but MCP servers, Python scripts,
# and citizen tools may read from .env files. Generate one from current env.
ENV_FILE="$APP_DIR/.env"
echo "# Auto-generated from Render env vars at $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$ENV_FILE"
for var in ANTHROPIC_API_KEY OPENAI_API_KEY GEMINI_API_KEY ELEVENLABS_API_KEY \
    ELEVENLABS_VOICE_ID DISCORD_BOT_TOKEN DISCORD_CLIENT_ID AIRTABLE_API_KEY \
    X_BEARER_TOKEN X_CONSUMER_KEY X_CONSUMER_SECRET X_ACCESS_TOKEN X_ACCESS_TOKEN_SECRET \
    X_CLIENT_ID X_CLIENT_SECRET RESEND_API_KEY RENDER_API_KEY ADMIN_API_KEY \
    IDEOGRAM_API_KEY HELIUS_API_KEY GENIUS_TOKEN STRIPE_API_KEY STRIPE_WEBHOOK_SECRET \
    TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_PHONE_NUMBER \
    WAHA_URL WAHA_API_KEY WAHA_DOCKER_KEY WAHA_DASHBOARD_PASSWORD \
    LINKEDIN_CLIENT_ID LINKEDIN_CLIENT_SECRET LINKEDIN_ORG_ID \
    RUNWAYML_API_SECRET MIND_PUBLIC_URL CLAUDE_MASTER_SECRET \
    DATABASE_BACKEND FALKORDB_HOST FALKORDB_PORT FALKORDB_GRAPH \
    EMBEDDING_PROVIDER OPENAI_EMBEDDING_MODEL SELECTED_MODEL \
    CITIES_SERVICES_URL MANEMUS_SCREENSHOTS; do
    val=$(printenv "$var" 2>/dev/null || true)
    if [ -n "$val" ]; then
        echo "${var}=${val}" >> "$ENV_FILE"
    fi
done
echo "[render-start] Generated .env with $(grep -c '=' "$ENV_FILE") vars"

# ── 2. Generate .mcp.json with correct paths ─────────────────────────────
# .mcp.json is gitignored (contains local paths). Generate from template
# with paths resolved to the current app directory.
MCP_JSON="$APP_DIR/.mcp.json"
MCP_TEMPLATE="$APP_DIR/.mcp.json.template"
if [ -f "$MCP_TEMPLATE" ]; then
    sed "s|__APP_DIR__|$APP_DIR|g" "$MCP_TEMPLATE" > "$MCP_JSON"
    echo "[render-start] Generated .mcp.json from template (APP_DIR=$APP_DIR)"
elif [ -f "$MCP_JSON" ]; then
    # Fallback: patch existing .mcp.json if it somehow exists
    sed -i 's|/home/mind-protocol/[^"]*/\.mind/runtime|'"$APP_DIR"'/.mind/runtime|g' "$MCP_JSON"
    sed -i 's|/home/mind-protocol/[^"]*/|'"$APP_DIR"'/|g' "$MCP_JSON"
    echo "[render-start] Patched existing .mcp.json paths for Render"
else
    echo "[render-start] No .mcp.json template or file found — skipping"
fi

# ── 3. Install dependencies if needed ────────────────────────────────────
if [ ! -d "$APP_DIR/node_modules" ]; then
    echo "[render-start] Installing Node dependencies..."
    npm install
fi

# ── 4. Build client ──────────────────────────────────────────────────────
echo "[render-start] Building client..."
npx vite build 2>&1 | tail -5

# ── 5. Start FastAPI services ────────────────────────────────────────────
echo "[render-start] Starting FastAPI services on port 8900..."
uvicorn services.app:app --host 0.0.0.0 --port 8900 &
FASTAPI_PID=$!
sleep 1

if ! kill -0 $FASTAPI_PID 2>/dev/null; then
    echo "[render-start] WARNING: FastAPI failed to start (non-critical)"
fi

# ── 6. Start Node server ────────────────────────────────────────────────
# Use PORT from Render (defaults to 8800 for local)
export PORT="${PORT:-8800}"
echo "[render-start] Starting Node server on port $PORT..."
exec node src/server/index.js
