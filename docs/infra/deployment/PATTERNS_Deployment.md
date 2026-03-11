# PATTERNS -- Deployment

> Design philosophy for production deployment of Venezia.
> The goal: a URL that works on Quest 3. No app store, no sideloading, no friction.

---

## Core Principle: One URL, It Works

The visitor types a URL into Quest 3's browser, puts on the headset, and
enters Venice. No download. No install. No account creation. No app store
approval. The web is the distribution channel.

This requires:
1. HTTPS (WebXR and getUserMedia mandate secure context)
2. Low enough latency for voice and position sync
3. Enough bandwidth for TTS streaming
4. Available 24/7 (the world does not sleep)

---

## HTTPS Is Non-Negotiable

WebXR will not initialize without a secure context. `navigator.mediaDevices.getUserMedia`
(microphone access for voice) will not work without HTTPS. These are browser
security requirements, not preferences.

### Development

Self-signed certificates generated to `/tmp/cities-cert.pem` and `/tmp/cities-key.pem`.
Quest 3 browser shows a security warning but allows proceeding. Acceptable for
dev, not for anyone outside the development machine's local network.

### Production

Proper TLS certificate from Let's Encrypt (free, auto-renewing). Terminate
TLS at the reverse proxy (nginx, Caddy, or Render's built-in). The Express
server runs plain HTTP behind the proxy.

```
Quest 3 browser  -->  HTTPS  -->  Reverse proxy (TLS termination)  -->  HTTP  -->  Express:8800
                                       |
                                  WebSocket upgrade (/ws)
```

### Certificate Automation

Let's Encrypt certificates expire every 90 days. Use Certbot with auto-renewal
cron, or a hosting provider that handles this (Render, Vercel edge, Caddy
auto-HTTPS). Manual cert management is a ticking bomb.

---

## Hosting Architecture

### Single Host (Recommended for V1)

All components on one machine:

```
┌─────────────────────────────────────┐
│           Production Host           │
│                                     │
│  ┌───────────┐  ┌───────────────┐  │
│  │  nginx    │  │  Express:8800 │  │
│  │  (TLS +   │->│  (WS + HTTP)  │  │
│  │  proxy)   │  └───────┬───────┘  │
│  └───────────┘          │          │
│                         │          │
│  ┌───────────────┐  ┌──┴────────┐ │
│  │  FalkorDB     │  │  FastAPI   │ │
│  │  (Docker)     │  │  :8900     │ │
│  │  :6379        │  │  (services)│ │
│  └───────────────┘  └───────────┘ │
│                                     │
│  External APIs:                     │
│  - Airtable (Serenissima data)     │
│  - Claude API (citizen conversation)│
│  - OpenAI (Whisper STT, GPT-4o)   │
│  - ElevenLabs (TTS streaming)      │
└─────────────────────────────────────┘
```

**Why single host:**
- FalkorDB latency: the physics tick queries the graph database hundreds of
  times per tick. Network round-trips between hosts would add seconds. On the
  same machine, queries take microseconds via localhost.
- Simplicity: one machine to monitor, one machine to restart, one machine
  to back up. Distributed systems fail in distributed ways.
- Cost: one machine is cheaper than three.

**When to split:**
- If CPU usage exceeds 80% sustained (unlikely for V1 -- the heavy work is
  in external APIs, not local compute)
- If multiple simultaneous visitors cause WebSocket throughput issues (10+
  visitors broadcasting at 20Hz)
- If FalkorDB graph grows beyond available RAM (unlikely for 186 citizens)

### Hosting Options

| Option          | Pro                              | Con                          | Cost       |
|-----------------|----------------------------------|------------------------------|------------|
| Render          | Zero-ops, auto-deploy from git, built-in TLS | WebSocket support requires paid plan, no persistent disk by default | $25-50/mo |
| Fly.io          | Edge deployment, persistent volumes, WebSocket native | More complex config, credit card required | $15-30/mo |
| Self-hosted VPS | Full control, persistent disk, no WebSocket limits | Must manage TLS, updates, monitoring | $20-40/mo |
| Home server     | Free, lowest latency for local dev | No public IP without tunnel, power/uptime risk | $0 (+ electricity) |

**Recommendation:** Render for initial production (matches existing Serenissima
deployment), with self-hosted VPS as fallback if Render's WebSocket limitations
prove restrictive.

---

## Domain

Two candidates:
- `citiesoflight.ai` -- brand-specific, memorable
- `venezia.mindprotocol.ai` -- under the Mind Protocol umbrella

Use `venezia.mindprotocol.ai` for V1 (no additional domain purchase, DNS
managed centrally). Acquire `citiesoflight.ai` when the project goes public.

DNS records:
- `venezia.mindprotocol.ai` A/CNAME -> hosting provider
- `wss://venezia.mindprotocol.ai/ws` for WebSocket (same domain, same cert)

---

## FalkorDB Containerization

FalkorDB runs in Docker. It is a Redis-compatible graph database with no
external dependencies. The container is lightweight (~200MB image, ~50MB RAM
for a 186-citizen graph).

### Docker Compose

```yaml
services:
  falkordb:
    image: falkordb/falkordb:latest
    ports:
      - "6379:6379"
    volumes:
      - falkordb-data:/data
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes"]

volumes:
  falkordb-data:
```

`--appendonly yes` enables append-only file persistence. The graph survives
container restarts. Without this flag, FalkorDB is purely in-memory and loses
all data on restart.

### Backup

FalkorDB's AOF (append-only file) and RDB snapshots live in the Docker volume.
Backup strategy:
- **Daily:** Copy the Docker volume to a backup location (or S3)
- **Before deployment:** Snapshot the volume
- **On graph corruption:** Restore from latest backup, re-run Airtable seed

The graph can be fully reconstructed from Airtable data. Backup is a
time-saver, not a data-loss prevention. The authoritative data is in Airtable.

---

## Airtable as External Dependency

Airtable is the primary data store for Serenissima (citizens, buildings,
contracts, activities, relationships). It is a cloud service outside our
control.

### Airtable Failure Modes

| Failure                | Impact                              | Mitigation                     |
|------------------------|-------------------------------------|--------------------------------|
| Rate limited (5 req/s) | Sync cycle takes longer             | Batch requests, respect limits |
| API down (rare)        | No new data; server uses stale cache | Cache lasts until restart; alert on sync failure |
| Schema change          | Sync breaks silently                | Validate field names on each sync, alert on missing fields |
| Data corruption        | Bad data flows into Venice          | Sanity checks on sync (e.g., citizen position within Venice bounds) |

The server must never crash because Airtable is unavailable. Stale cached data
is acceptable for hours. The world continues with its last known state.

---

## Monitoring

### Health Checks

- **HTTP:** `GET /state` returns JSON with uptime, connection count, citizen
  count. If this returns 200, the server is alive.
- **WebSocket:** A synthetic client connects every 60 seconds, sends a `join`,
  confirms `welcome` response, disconnects. If this fails twice, alert.
- **FalkorDB:** `PING` command via Redis client. If it fails, the physics
  bridge is dead but the rest of the server is unaffected.

### Metrics to Track

| Metric                  | Source                | Alert Threshold              |
|-------------------------|-----------------------|------------------------------|
| Server uptime           | Process monitor       | Restart count > 3 in 1 hour |
| WebSocket connections   | `connections.size`    | Unexpected drop to 0         |
| Airtable sync success   | sync.js logs          | 2 consecutive failures       |
| Physics tick duration   | physics-bridge timer  | > 5 seconds (blocks event loop) |
| Voice pipeline latency  | voice.js timers       | > 5 seconds end-to-end       |
| Memory usage            | `process.memoryUsage()` | RSS > 1GB                 |
| FalkorDB connectivity   | PING                  | 3 consecutive failures       |

### Alerting

For V1, alerts go to Nicolas via Telegram (the Manemus telegram bridge already
exists). A simple health check script running on cron that POSTs to the
Telegram bot on failure is sufficient. No Datadog, no PagerDuty, no complexity.

---

## Backup Strategy

| Data                  | Location              | Backup Method           | Frequency |
|-----------------------|-----------------------|-------------------------|-----------|
| Citizen data          | Airtable              | Airtable API export     | Weekly    |
| Citizen memory        | `.cascade/` filesystem | rsync to backup host    | Daily     |
| FalkorDB graph        | Docker volume         | Volume snapshot to S3   | Daily     |
| Server code           | Git (GitHub)          | Already backed up       | On push   |
| TLS certificates      | Let's Encrypt         | Auto-renewed            | N/A       |
| Voice assignments     | `data/voice_assignments.json` | Git-tracked    | On change |

The most valuable data is citizen `.cascade/` memory (6+ months of accumulated
interaction). This lives on the filesystem and must be backed up independently
of the application.

---

## Cost Estimate

| Service              | Monthly Cost | Notes                            |
|----------------------|-------------|-----------------------------------|
| Hosting (Render/VPS) | $25-50      | 2 vCPU, 4GB RAM, 40GB disk       |
| Airtable             | $0          | Free tier (already in use)        |
| Claude API           | $50-200     | Depends on conversation volume    |
| OpenAI (Whisper+GPT) | $20-50      | STT + voice LLM calls            |
| ElevenLabs           | $22-99      | Starter plan (30K-100K chars/mo)  |
| Domain               | $0          | Subdomain of existing domain      |
| **Total**            | **$117-399**| **Per month**                     |

The largest variable cost is LLM API calls. A single visitor having 50
conversations per session (generous) at ~$0.01 per conversation = $0.50 per
session. 100 sessions per month = $50. Ambient citizen conversations add
overhead but use the cheaper GPT-4o model.

---

## Deployment Pipeline

### Development

```
Local dev  -->  localhost:8800 (HTTP)
               localhost:8443 (HTTPS, self-signed)
               FalkorDB: Docker on localhost:6379
```

### Staging (Future)

```
Git push to staging branch  -->  Render auto-deploy
                                  staging.mindprotocol.ai
```

### Production

```
Git push to main  -->  Render auto-deploy (or manual deploy to VPS)
                        venezia.mindprotocol.ai
                        FalkorDB Docker on same host
```

No CI/CD pipeline for V1. Push to main, Render deploys. If self-hosted, a
simple `git pull && npm install && pm2 restart venezia` script suffices.

PM2 (process manager) is recommended for self-hosted deployment:
- Auto-restart on crash
- Log rotation
- Cluster mode (if needed later, but single process for V1)
- Startup script (survives server reboot)

---

## The Non-Negotiables

1. **HTTPS everywhere.** No HTTP in production. No mixed content. No exceptions.
   WebXR and microphone access require it. The experience does not work without it.

2. **FalkorDB on the same host.** Network latency to the graph database kills
   the physics tick. Localhost or bust.

3. **Airtable failure does not crash the server.** The sync module handles
   errors gracefully. The server continues with stale data. The world does
   not go dark because Airtable returned a 429.

4. **Daily backups of citizen memory.** The `.cascade/` directories contain
   irreplaceable interaction history. Losing them means losing 6+ months of
   citizen personality development.

5. **One URL, zero installation.** The visitor never downloads anything, never
   installs anything, never creates an account. Type URL, enter world.
