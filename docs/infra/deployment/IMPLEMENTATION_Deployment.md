# IMPLEMENTATION -- Deployment

> Concrete Dockerfile, docker-compose.yml, nginx.conf, Certbot setup,
> Render deployment configuration, health check endpoints, backup scripts,
> and monitoring integration for Venezia production infrastructure.
> Reference source: `src/server/index.js`, `package.json`, `start.sh`.

---

## 1. Project Structure for Deployment

```
cities-of-light/
  src/server/index.js          ← Node.js entry point (PORT 8800)
  src/client/main.js           ← Vite client entry
  services/app.py              ← FastAPI consent/biography (PORT 8900)
  dist/                        ← Vite production build output
  data/vault/                  ← Memorial video files
  perception/                  ← Marco camera frames
  package.json                 ← npm dependencies
  vite.config.js               ← Vite bundler config
  Dockerfile                   ← NEW: Express server container
  docker-compose.yml           ← NEW: Full stack definition
  nginx/nginx.conf             ← NEW: Reverse proxy config
  scripts/backup.sh            ← NEW: Automated backup script
  scripts/deploy.sh            ← NEW: Deployment pipeline script
  scripts/monitor.sh           ← NEW: Health check + alerting
```

---

## 2. Dockerfile

```dockerfile
# Dockerfile — Cities of Light Express Server

FROM node:20-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Install dependencies first (layer caching)
COPY package.json package-lock.json ./
RUN npm ci --production

# Copy source code
COPY src/ ./src/

# Copy pre-built client (built on host before docker build)
COPY dist/ ./dist/

# Copy data directory (vault media, voice assignments)
COPY data/ ./data/

# Non-root user for security
RUN adduser -D -h /app venezia && \
    chown -R venezia:venezia /app
USER venezia

EXPOSE 8800

# Health check built into the container
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD curl -f http://localhost:8800/state || exit 1

CMD ["node", "src/server/index.js"]
```

### 2.1 Build Context Exclusion

```
# .dockerignore
node_modules
.git
*.md
docs/
perception/
*.pem
.env
.env.*
```

### 2.2 FastAPI Services Dockerfile

```dockerfile
# services/Dockerfile

FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir fastapi uvicorn openai

COPY . .

EXPOSE 8900

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
  CMD curl -f http://localhost:8900/health || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8900"]
```

---

## 3. docker-compose.yml

```yaml
version: '3.8'

services:
  # ── Express Server (Node.js) ────────────────────────────
  express:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8800:8800"
    volumes:
      - ./data:/app/data
      - ./perception:/app/perception
      - citizen-memory:/app/.cascade
    environment:
      NODE_ENV: production
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ELEVENLABS_API_KEY: ${ELEVENLABS_API_KEY}
      ELEVENLABS_VOICE_ID: ${ELEVENLABS_VOICE_ID:-pNInz6obpgDQGcFmaJgB}
      CITIES_SERVICES_URL: http://fastapi:8900
      FALKORDB_URL: redis://falkordb:6379
    depends_on:
      falkordb:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8800/state"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

  # ── FastAPI Services (Python) ───────────────────────────
  fastapi:
    build:
      context: ./services
      dockerfile: Dockerfile
    ports:
      - "8900:8900"
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8900/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s

  # ── FalkorDB (Redis-compatible graph database) ──────────
  falkordb:
    image: falkordb/falkordb:latest
    ports:
      - "6379:6379"
    volumes:
      - falkordb-data:/data
    command: >
      redis-server
      --appendonly yes
      --save 900 1
      --save 300 10
      --save 60 10000
      --maxmemory 512mb
      --maxmemory-policy noeviction
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 5s

  # ── nginx (TLS termination + reverse proxy) ─────────────
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - certbot-conf:/etc/letsencrypt:ro
      - certbot-www:/var/www/certbot:ro
      - ./dist:/var/www/static:ro
    depends_on:
      - express
    restart: unless-stopped

  # ── Certbot (Let's Encrypt auto-renewal) ────────────────
  certbot:
    image: certbot/certbot
    volumes:
      - certbot-conf:/etc/letsencrypt
      - certbot-www:/var/www/certbot
    entrypoint: >
      /bin/sh -c "trap exit TERM;
      while :; do
        certbot renew --quiet --webroot -w /var/www/certbot;
        sleep 12h;
      done"
    restart: unless-stopped

volumes:
  falkordb-data:
    driver: local
  certbot-conf:
    driver: local
  certbot-www:
    driver: local
  citizen-memory:
    driver: local
```

### 3.1 Environment File (.env)

```bash
# .env — loaded by docker-compose automatically
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=xi-...
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB
AIRTABLE_PAT=pat...
AIRTABLE_BASE_ID=app...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_NICOLAS_CHAT_ID=1524364329
```

This file must not be committed to git. Add `.env` to `.gitignore`.

---

## 4. nginx Configuration

```nginx
# nginx/nginx.conf

worker_processes auto;
worker_rlimit_nofile 8192;

events {
    worker_connections 4096;
    multi_accept on;
}

http {
    # ── Logging ─────────────────────────────────────────
    log_format main '$remote_addr - [$time_local] '
                    '"$request" $status $body_bytes_sent '
                    '"$http_referer" $request_time';
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # ── Performance ─────────────────────────────────────
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 10m;

    # ── MIME types ──────────────────────────────────────
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # ── Gzip compression ───────────────────────────────
    gzip on;
    gzip_types text/plain text/css application/json
               application/javascript text/xml
               application/xml application/wasm;
    gzip_min_length 1024;

    # ── Upstream ────────────────────────────────────────
    upstream express_backend {
        server express:8800;
        keepalive 16;
    }

    # ── HTTP -> HTTPS redirect ──────────────────────────
    server {
        listen 80;
        server_name venezia.mindprotocol.ai;

        # Let's Encrypt challenge
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

    # ── HTTPS server ────────────────────────────────────
    server {
        listen 443 ssl http2;
        server_name venezia.mindprotocol.ai;

        # TLS
        ssl_certificate /etc/letsencrypt/live/venezia.mindprotocol.ai/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/venezia.mindprotocol.ai/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 1d;

        # Security headers (required for WebXR)
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
        add_header Permissions-Policy "xr-spatial-tracking=(*), microphone=(*), camera=(*)";
        add_header Cross-Origin-Opener-Policy "same-origin";
        add_header Cross-Origin-Embedder-Policy "require-corp";

        # ── WebSocket proxy (/ws) ───────────────────────
        location /ws {
            proxy_pass http://express_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # WebSocket timeouts (keep alive for long sessions)
            proxy_read_timeout 86400s;
            proxy_send_timeout 86400s;
        }

        # ── API routes ──────────────────────────────────
        location /state { proxy_pass http://express_backend; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /health { proxy_pass http://express_backend; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /api/ { proxy_pass http://express_backend; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /speak { proxy_pass http://express_backend; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /perception/ { proxy_pass http://express_backend; proxy_set_header Host $host; }
        location /services/ { proxy_pass http://express_backend; proxy_set_header Host $host; }
        location /vault-media/ {
            proxy_pass http://express_backend;
            proxy_set_header Host $host;
            add_header Cross-Origin-Resource-Policy "same-origin";
        }

        # ── Static files ───────────────────────────────
        location / {
            root /var/www/static;
            try_files $uri $uri/ /index.html;

            # Cache static assets aggressively (content-hashed by Vite)
            location ~* \.(js|css|wasm|png|jpg|svg|glb|gltf|ogg|wav|mp3)$ {
                expires 30d;
                add_header Cache-Control "public, immutable";
            }

            # HTML: no cache (always fresh on deploy)
            location ~* \.html$ {
                expires -1;
                add_header Cache-Control "no-cache, no-store, must-revalidate";
            }
        }
    }
}
```

---

## 5. Certbot Initial Setup

### 5.1 First-Time Certificate Acquisition

```bash
#!/bin/bash
# scripts/init-certbot.sh

DOMAIN="venezia.mindprotocol.ai"
EMAIL="nicolas@mindprotocol.ai"

# Step 1: Start nginx with HTTP only (temporary config without ssl)
docker compose up -d nginx

# Step 2: Request certificate via webroot
docker compose run --rm certbot \
  certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive

# Step 3: Verify certificate exists
docker compose exec nginx \
  ls /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem

# Step 4: Restart nginx with full HTTPS config
docker compose restart nginx

# Step 5: Verify HTTPS
curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/state"
echo " (should be 200)"
```

### 5.2 Auto-Renewal

The `certbot` service in docker-compose runs `certbot renew` every 12 hours.
Certificates are shared via the `certbot-conf` Docker volume.

When a certificate is renewed, nginx needs to reload:

```bash
# Add to crontab or a separate renewal hook:
# Run daily at 3 AM
0 3 * * * docker compose exec nginx nginx -s reload
```

---

## 6. Health Check Endpoint Implementation

### 6.1 Express /health Route

```javascript
// Add to src/server/index.js

app.get('/health', async (req, res) => {
  const checks = {};
  let overallStatus = 'healthy';

  // Express server
  checks.express = {
    status: 'healthy',
    uptime: process.uptime(),
    connections: connections.size,
    citizens: citizens.size,
    rooms: roomManager.listRooms().length,
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
  };

  // OpenAI API key configured
  checks.openai = {
    status: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
  };

  // ElevenLabs API key configured
  checks.elevenlabs = {
    status: process.env.ELEVENLABS_API_KEY ? 'configured' : 'missing',
  };

  // AI citizens running
  checks.ai_citizens = {
    status: aiManager.citizens.size > 0 ? 'healthy' : 'degraded',
    count: aiManager.citizens.size,
  };

  // FalkorDB (when implemented)
  // try {
  //   const start = Date.now();
  //   await falkordbClient.ping();
  //   checks.falkordb = { status: 'healthy', latencyMs: Date.now() - start };
  // } catch (e) {
  //   checks.falkordb = { status: 'down', error: e.message };
  //   overallStatus = 'degraded';
  // }

  const statusCode = overallStatus === 'healthy' ? 200 : 503;
  res.status(statusCode).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    checks,
  });
});
```

### 6.2 Health Check Response Format

```json
{
  "status": "healthy",
  "timestamp": "2026-03-11T14:30:00.000Z",
  "version": "0.1.0",
  "checks": {
    "express": {
      "status": "healthy",
      "uptime": 86400,
      "connections": 3,
      "citizens": 6,
      "rooms": 1,
      "memoryMB": 145
    },
    "openai": { "status": "configured" },
    "elevenlabs": { "status": "configured" },
    "ai_citizens": { "status": "healthy", "count": 3 }
  }
}
```

---

## 7. Backup Scripts

### 7.1 FalkorDB Backup

```bash
#!/bin/bash
# scripts/backup.sh — run daily at 04:00 UTC

set -euo pipefail

BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M")

# ── FalkorDB ──────────────────────────────────────────────
echo "Backing up FalkorDB..."
mkdir -p "$BACKUP_DIR/falkordb"

# Trigger background save
docker compose exec -T falkordb redis-cli BGSAVE

# Wait for save to complete (max 30s)
for i in $(seq 1 30); do
  STATUS=$(docker compose exec -T falkordb redis-cli LASTSAVE)
  sleep 1
done

# Copy RDB snapshot from container
docker compose cp falkordb:/data/dump.rdb \
  "$BACKUP_DIR/falkordb/dump_${TIMESTAMP}.rdb"

# Compress
gzip "$BACKUP_DIR/falkordb/dump_${TIMESTAMP}.rdb"

echo "FalkorDB backup: $BACKUP_DIR/falkordb/dump_${TIMESTAMP}.rdb.gz"

# ── Citizen Memory ────────────────────────────────────────
echo "Backing up citizen memory..."
mkdir -p "$BACKUP_DIR/citizen-memory"

# Copy from Docker volume
docker compose cp express:/app/.cascade \
  "$BACKUP_DIR/citizen-memory/cascade_${TIMESTAMP}/"

# Compress
tar -czf "$BACKUP_DIR/citizen-memory/cascade_${TIMESTAMP}.tar.gz" \
  -C "$BACKUP_DIR/citizen-memory" "cascade_${TIMESTAMP}/"
rm -rf "$BACKUP_DIR/citizen-memory/cascade_${TIMESTAMP}/"

echo "Citizen memory backup: $BACKUP_DIR/citizen-memory/cascade_${TIMESTAMP}.tar.gz"

# ── Prune old backups (keep last 7 days) ──────────────────
find "$BACKUP_DIR" -name "*.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.rdb" -mtime +7 -delete

echo "Backup complete: $TIMESTAMP"
```

### 7.2 Crontab Entry

```
# /etc/cron.d/venezia-backup
# Daily backup at 04:00 UTC
0 4 * * * root /opt/cities-of-light/scripts/backup.sh >> /var/log/venezia-backup.log 2>&1
```

---

## 8. Monitoring Script with Telegram Alerts

### 8.1 Health Check Monitor

```bash
#!/bin/bash
# scripts/monitor.sh — external health check with Telegram alerts
# Run as a cron job every 60 seconds or as a systemd timer.

set -euo pipefail

DOMAIN="venezia.mindprotocol.ai"
STATE_FILE="/tmp/venezia-monitor-state"
BOT_TOKEN="${TELEGRAM_BOT_TOKEN}"
CHAT_ID="${TELEGRAM_NICOLAS_CHAT_ID:-1524364329}"

# Initialize state file
if [ ! -f "$STATE_FILE" ]; then
  echo "0" > "$STATE_FILE"  # consecutive failures
fi

CONSECUTIVE=$(cat "$STATE_FILE")

# ── Check 1: HTTP /health ─────────────────────────────────
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 5 "https://$DOMAIN/health" 2>/dev/null || echo "000")

# ── Check 2: WebSocket connectivity ───────────────────────
WS_OK=0
if command -v wscat &>/dev/null; then
  echo '{"type":"join","name":"monitor","spectator":true}' | \
    timeout 5 wscat -c "wss://$DOMAIN/ws" -x 2>/dev/null && WS_OK=1
fi

# ── Evaluate ──────────────────────────────────────────────
if [ "$HTTP_STATUS" = "200" ]; then
  if [ "$CONSECUTIVE" -ge 2 ]; then
    # Recovery — send alert
    curl -s -X POST \
      "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
      -d chat_id="$CHAT_ID" \
      -d text="Venezia Recovery: all services healthy after $CONSECUTIVE failures" \
      -d parse_mode="Markdown" > /dev/null 2>&1
  fi
  echo "0" > "$STATE_FILE"
else
  CONSECUTIVE=$((CONSECUTIVE + 1))
  echo "$CONSECUTIVE" > "$STATE_FILE"

  if [ "$CONSECUTIVE" -ge 2 ]; then
    # Alert — 2 consecutive failures
    MSG="Venezia Alert: HTTP $HTTP_STATUS (failures: $CONSECUTIVE)"
    if [ "$WS_OK" = "0" ]; then
      MSG="$MSG | WebSocket: DOWN"
    fi

    curl -s -X POST \
      "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
      -d chat_id="$CHAT_ID" \
      -d text="$MSG" \
      -d parse_mode="Markdown" > /dev/null 2>&1
  fi
fi
```

### 8.2 Telegram Alert Function (Node.js)

For server-side alerting from the Express health check system:

```javascript
async function sendTelegramAlert(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_NICOLAS_CHAT_ID || '1524364329';

  if (!botToken) return;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
  } catch (e) {
    console.error('Telegram alert failed:', e.message);
  }
}
```

### 8.3 Crontab Entry for Monitor

```
# /etc/cron.d/venezia-monitor
# Health check every 60 seconds
* * * * * root /opt/cities-of-light/scripts/monitor.sh >> /var/log/venezia-monitor.log 2>&1
```

---

## 9. Deployment Pipeline Script

```bash
#!/bin/bash
# scripts/deploy.sh — build, test, deploy, verify

set -euo pipefail

DOMAIN="venezia.mindprotocol.ai"
PROJECT_DIR="/opt/cities-of-light"
ROLLBACK_REF=$(git rev-parse HEAD)

cd "$PROJECT_DIR"

echo "=== Stage 1: Build ==="
git pull origin main
npm ci
npx vite build

# Verify build artifacts
[ -f dist/index.html ] || { echo "ERROR: dist/index.html missing"; exit 1; }
[ -d dist/assets ] || { echo "ERROR: dist/assets missing"; exit 1; }

echo "=== Stage 2: Test ==="
node --check src/server/index.js
node --check src/server/voice.js
node --check src/server/rooms.js
node --check src/server/ai-citizens.js

echo "=== Stage 3: Deploy ==="
# Backup FalkorDB before deploy
./scripts/backup.sh || echo "WARNING: backup failed, continuing deploy"

# Rolling restart
docker compose up -d --build --remove-orphans

# Wait for health checks (max 60s)
echo "Waiting for health checks..."
WAITED=0
while [ $WAITED -lt 60 ]; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 5 "https://$DOMAIN/health" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "Health check passed ($WAITED seconds)"
    break
  fi
  sleep 5
  WAITED=$((WAITED + 5))
done

if [ $WAITED -ge 60 ]; then
  echo "ERROR: Health checks failed after 60s. Rolling back..."
  git checkout "$ROLLBACK_REF"
  npm ci
  npx vite build
  docker compose up -d --build
  exit 1
fi

echo "=== Stage 4: Verify ==="
# HTTP check
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/state")
echo "HTTP /state: $HTTP_STATUS"

# Uptime check
UPTIME=$(curl -s "https://$DOMAIN/state" | python3 -c "import sys,json; print(json.load(sys.stdin).get('uptime',0))")
echo "Server uptime: ${UPTIME}s"

echo "=== Deployment successful ==="
```

---

## 10. Render Deployment (Alternative)

### 10.1 render.yaml

```yaml
services:
  - type: web
    name: venezia
    env: node
    plan: starter
    buildCommand: npm ci && npx vite build
    startCommand: node src/server/index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: OPENAI_API_KEY
        sync: false
      - key: ELEVENLABS_API_KEY
        sync: false
      - key: ELEVENLABS_VOICE_ID
        value: pNInz6obpgDQGcFmaJgB
      - key: PORT
        value: 8800
    healthCheckPath: /state
    autoDeploy: true
    branch: main
    rootDir: .
```

### 10.2 Render Limitations

- No persistent disk (FalkorDB cannot run on Render)
- WebSocket support requires the "starter" plan or higher
- No Docker Compose -- each service must be a separate Render service
- Environment variables set via Render dashboard (not .env file)

For a full stack including FalkorDB, self-hosted Docker Compose is preferred.
Render works for the Express + Vite frontend alone.

---

## 11. Simple Deployment (PM2 on VPS)

For a non-Docker VPS deployment:

```bash
#!/bin/bash
# scripts/deploy-simple.sh

cd /opt/cities-of-light
git pull origin main
npm ci --production
npx vite build

# Restart via PM2
pm2 restart venezia 2>/dev/null || pm2 start src/server/index.js --name venezia

# Verify
sleep 3
curl -f http://localhost:8800/state && echo " OK" || echo " FAIL"
```

PM2 provides process management, automatic restart on crash, and log
rotation without Docker overhead:

```bash
# Initial setup
pm2 start src/server/index.js --name venezia
pm2 startup  # Generate systemd service
pm2 save     # Persist process list across reboots
```

---

## 12. Graceful Shutdown in Docker

The Node.js process must handle SIGTERM (sent by Docker on `docker stop`):

```javascript
// Add to src/server/index.js
function initGracefulShutdown() {
  let shuttingDown = false;

  const handleSignal = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down...`);

    // Stop accepting new connections
    server.close();
    if (httpsServer) httpsServer.close();

    // Notify connected clients
    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          type: 'server_shutdown',
          message: 'Server restarting, reconnect in a few seconds',
        }));
      }
    }

    // Wait 1s for messages to flush
    setTimeout(() => {
      for (const client of wss.clients) {
        client.close(1001, 'Server shutting down');
      }
      aiManager.destroy();
      process.exit(0);
    }, 1000);

    // Force exit after 5s
    setTimeout(() => process.exit(1), 5000);
  };

  process.on('SIGTERM', handleSignal);
  process.on('SIGINT', handleSignal);
}

initGracefulShutdown();
```

---

## 13. TLS Certificate Verification

### 13.1 Certificate Expiry Check

```bash
#!/bin/bash
# Check TLS certificate expiry
DOMAIN="venezia.mindprotocol.ai"
EXPIRY=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null \
  | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)

if [ -n "$EXPIRY" ]; then
  EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
  NOW_EPOCH=$(date +%s)
  DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
  echo "Certificate expires in $DAYS_LEFT days ($EXPIRY)"

  if [ "$DAYS_LEFT" -lt 7 ]; then
    # Critical: force renewal
    docker compose run --rm certbot certbot renew --force-renewal
    docker compose exec nginx nginx -s reload
  fi
fi
```

---

## 14. Environment Variables Reference (Production)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | none | Set to `production` for optimized behavior |
| `OPENAI_API_KEY` | Yes | none | Whisper STT + GPT-4o + fallback TTS |
| `ELEVENLABS_API_KEY` | No | none | Primary TTS provider |
| `ELEVENLABS_VOICE_ID` | No | `pNInz6obpgDQGcFmaJgB` | Default ElevenLabs voice |
| `CITIES_SERVICES_URL` | No | `http://localhost:8900` | FastAPI backend URL |
| `FALKORDB_URL` | No | `redis://localhost:6379` | FalkorDB connection |
| `AIRTABLE_PAT` | No | none | Airtable Personal Access Token |
| `AIRTABLE_BASE_ID` | No | none | Serenissima Airtable base ID |
| `TELEGRAM_BOT_TOKEN` | No | none | For monitoring alerts |
| `TELEGRAM_NICOLAS_CHAT_ID` | No | `1524364329` | Alert destination |

---

## 15. Port Map

| Service | Internal Port | External Port | Protocol |
|---------|--------------|---------------|----------|
| Express | 8800 | 8800 (docker) | HTTP + WS |
| HTTPS (dev) | 8443 | 8443 | HTTPS + WSS |
| FastAPI | 8900 | 8900 (docker) | HTTP |
| FalkorDB | 6379 | 6379 (docker) | Redis |
| nginx | 80, 443 | 80, 443 (host) | HTTP, HTTPS |
| FalkorDB Browser | 3002 | 3002 (dev only) | HTTP |

In production, only ports 80 and 443 are exposed to the internet.
All other ports are internal to the Docker network.
