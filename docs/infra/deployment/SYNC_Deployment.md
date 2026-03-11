# SYNC -- Deployment

> Current state of deployment infrastructure for Cities of Light.
> What exists, what is missing, and the path to production.

---

## What Exists

### Development Server

The project runs locally with:

```
node src/server/index.js
  HTTP:  localhost:8800
  HTTPS: localhost:8443 (self-signed cert)
  WS:    localhost:8800/ws (or 8443/ws over TLS)
```

The Express server serves both the API and the static client bundle (from
`dist/` if built, otherwise runs in dev mode).

### HTTPS (Self-Signed)

Self-signed certificates are generated to `/tmp/cities-cert.pem` and
`/tmp/cities-key.pem`. The server detects these files at startup and creates
an HTTPS server on port 8443 alongside the HTTP server on 8800.

Quest 3 requires HTTPS for:
- `navigator.xr.requestSession()` (WebXR)
- `navigator.mediaDevices.getUserMedia()` (microphone)

With self-signed certs, the Quest browser shows a security warning. The visitor
must tap "Advanced" and "Proceed" to accept. Acceptable for development,
hostile for anyone else.

### Network Discovery

On HTTPS startup, the server logs all local IPv4 addresses:
```
Quest URL: https://192.168.1.x:8443
```
This allows the developer to type the URL into Quest browser for local testing.

### FalkorDB

FalkorDB is available via Docker but is **not currently connected** to the
server. The Docker image (`falkordb/falkordb:latest`) has been tested locally
on port 6379 with the built-in browser UI on port 3002.

No Docker Compose file exists. FalkorDB is started manually:
```
docker run -p 6379:6379 -p 3002:3002 falkordb/falkordb:latest
```

No persistence volume is configured. Data is lost on container restart.

### FastAPI Services

A FastAPI backend exists at `services/app.py` for consent framework and media
vault features. The Express server proxies `/services/*` to `http://localhost:8900`.
If FastAPI is not running, the proxy returns 503. The core experience (voice,
citizens, spatial) does not depend on these services.

### Static Assets

The `dist/` directory (Vite build output) is served as static files. The
`data/vault/` directory is served at `/vault-media` for memorial video
playback. CORP headers are set for COEP compatibility.

### API Keys

All API keys are loaded from the Manemus `.env` file:
```
/home/mind-protocol/manemus/.env
  OPENAI_API_KEY      (Whisper STT + GPT-4o + OpenAI TTS)
  ELEVENLABS_API_KEY  (primary TTS)
  ELEVENLABS_VOICE_ID (default voice)
```

These are not committed to the repo. The Cities of Light server reads them via
`process.env` (loaded by the Manemus environment).

---

## What Is Missing

### 1. Production Hosting

No production deployment exists. The project runs only on the development
machine. There is no public URL, no cloud hosting, no CI/CD.

**Required:**
- Hosting provider account (Render, Fly.io, or VPS)
- Production domain: `venezia.mindprotocol.ai`
- DNS configuration: A/CNAME record pointing to host
- TLS certificate: Let's Encrypt via Certbot or hosting provider
- Process manager: PM2 or hosting provider's built-in (Render manages this)
- Environment variables configured on the host (API keys)

**Estimated effort:** 1-2 days (initial setup)

### 2. Docker Compose for Full Stack

No Docker Compose file exists. Running the full stack requires starting
multiple processes manually (Express server, FalkorDB, optionally FastAPI).

**Required:**
```yaml
services:
  venezia:
    build: .
    ports: ["8800:8800", "8443:8443"]
    env_file: .env
    depends_on: [falkordb]

  falkordb:
    image: falkordb/falkordb:latest
    ports: ["6379:6379"]
    volumes: [falkordb-data:/data]
    command: ["redis-server", "--appendonly", "yes"]

  services:
    build: ./services
    ports: ["8900:8900"]
    env_file: .env

volumes:
  falkordb-data:
```

**Estimated effort:** 0.5 day

### 3. Proper TLS Certificate

Self-signed certs work for local dev but are unacceptable for production.

**Required:**
- Let's Encrypt certificate for `venezia.mindprotocol.ai`
- Auto-renewal (Certbot cron or Caddy auto-HTTPS)
- Reverse proxy (nginx or Caddy) terminating TLS, forwarding to Express

If using Render: TLS is handled automatically. No additional work.
If self-hosted: nginx + Certbot, ~2 hours to configure.

**Estimated effort:** 0.5-1 day (self-hosted) or 0 (Render)

### 4. FalkorDB Persistence

Current Docker usage has no volume mount. Data is lost on container restart.

**Required:**
- Named Docker volume mapped to `/data` in the container
- `--appendonly yes` Redis flag for write-ahead logging
- Backup script: daily volume export to S3 or backup host

**Estimated effort:** 0.5 day

### 5. Monitoring and Health Checks

No monitoring exists. If the server crashes at 3am, nobody knows until
someone tries to connect.

**Required:**
- Health check endpoint: already exists (`GET /state` returns 200)
- External ping service: UptimeRobot (free) or similar, checks `/state` every
  60 seconds, alerts via Telegram on failure
- Process restart: PM2 auto-restart on crash (self-hosted) or Render's built-in
  restart policy
- Log persistence: PM2 log rotation or Render's log viewer

**Estimated effort:** 1 day (setup + Telegram alert integration)

### 6. Backup System

No backup system exists for any data.

**Required:**
- **Citizen `.cascade/` memory:** Daily rsync from Serenissima citizen
  directories to backup location (S3 bucket or secondary host)
- **FalkorDB graph:** Daily Docker volume snapshot
- **Airtable export:** Weekly full export via Airtable API (insurance against
  Airtable outage or accidental deletion)
- **Backup verification:** Monthly restore test to confirm backups are valid

**Estimated effort:** 1-2 days (scripts + cron setup)

### 7. Environment Variable Management

API keys currently live in the Manemus `.env` file, not in the Cities of Light
repo. For production, each deployment environment needs its own config.

**Required:**
- `.env.example` file in the repo documenting all required variables
- Production env vars set on hosting provider (Render dashboard or VPS env)
- No secrets in git, ever

Variables needed:
```
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
AIRTABLE_PAT=
AIRTABLE_BASE_ID=
FALKORDB_HOST=localhost
FALKORDB_PORT=6379
CLAUDE_API_KEY=
NODE_ENV=production
PORT=8800
```

**Estimated effort:** 0.5 day

### 8. CDN for Static Assets

The Express server currently serves static files directly. For production,
static assets (JS bundle, textures, audio, impulse responses) should be served
from a CDN for faster loading on Quest 3.

**Required:**
- Upload `dist/` to CDN (Cloudflare, BunnyCDN, or Render's built-in CDN)
- Set `Cache-Control` headers for immutable assets (hashed filenames)
- Audio assets (ambient loops, impulse responses) hosted on CDN, not served
  by Express

**Estimated effort:** 0.5-1 day

---

## Architecture: Current vs Target

```
CURRENT (Development)
=====================

Developer machine
  ├── node src/server/index.js (HTTP:8800, HTTPS:8443)
  ├── docker run falkordb (manual, no persistence)
  └── .env from ~/manemus/.env

Access: https://192.168.1.x:8443 (local network only, self-signed)


TARGET (Production)
===================

Cloud host (Render / VPS)
  ├── nginx (TLS termination, Let's Encrypt)
  │     ├── / -> Express:8800
  │     └── /ws -> WebSocket upgrade -> Express:8800
  ├── Express server (PM2 managed)
  ├── FalkorDB (Docker, persistent volume)
  ├── FastAPI services (Docker)
  └── .env on host

CDN (Cloudflare / BunnyCDN)
  └── Static assets (JS, textures, audio)

Monitoring
  ├── UptimeRobot -> /state every 60s
  └── Telegram alerts on failure

Backups
  ├── .cascade/ rsync daily
  ├── FalkorDB volume snapshot daily
  └── Airtable export weekly

Access: https://venezia.mindprotocol.ai (public, proper TLS)
```

---

## Deployment Checklist (When Ready)

```
[ ] Choose hosting provider
[ ] Create venezia.mindprotocol.ai DNS record
[ ] Write Dockerfile for Express server
[ ] Write docker-compose.yml for full stack
[ ] Create .env.example with all required variables
[ ] Configure production env vars on host
[ ] Set up TLS (Certbot or provider-managed)
[ ] Configure nginx reverse proxy (if self-hosted)
[ ] Enable FalkorDB persistence (volume + appendonly)
[ ] Set up PM2 (if self-hosted) or confirm Render restart policy
[ ] Configure UptimeRobot health check
[ ] Set up Telegram alert on downtime
[ ] Write backup scripts (cascade, FalkorDB, Airtable)
[ ] Add backup cron jobs
[ ] Test full stack from Quest 3 on public URL
[ ] Verify WebXR session starts over HTTPS
[ ] Verify microphone access works
[ ] Verify WebSocket connects and stays alive
[ ] Load test: confirm 72fps on Quest with target scene complexity
```

---

## Priority Roadmap

| Priority | Task                          | Blocks                          | Effort  |
|----------|-------------------------------|---------------------------------|---------|
| P0       | Docker Compose (full stack)   | Cannot run full Venezia locally | 0.5 day |
| P0       | FalkorDB persistence          | Graph data lost on restart      | 0.5 day |
| P1       | Production hosting + domain   | No public URL                   | 1-2 days |
| P1       | TLS certificate               | WebXR/mic broken without HTTPS  | 0.5-1 day |
| P1       | .env.example + env management | Cannot deploy to new host       | 0.5 day |
| P2       | Monitoring + alerts           | Downtime goes unnoticed         | 1 day   |
| P2       | Backup system                 | Data loss risk                  | 1-2 days |
| P3       | CDN for static assets         | Slower initial load on Quest    | 0.5-1 day |
| P3       | CI/CD pipeline                | Manual deploy is fine for V1    | 1 day   |
