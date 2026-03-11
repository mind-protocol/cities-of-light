# VALIDATION -- Deployment

> Health checks, invariants, and acceptance criteria for production deployment.
> The goal is a URL that works. If the URL breaks, the world does not exist.

---

## Invariants (must ALWAYS hold)

### I1. HTTPS always active

WebXR will not initialize without a secure context. `navigator.mediaDevices.getUserMedia`
(microphone) will not work without HTTPS. These are browser-enforced security
requirements. If HTTPS fails, the visitor sees nothing -- not a degraded
experience, but a blank page with a browser error.

HTTPS must be active on every request, every WebSocket upgrade, every asset
load. Mixed content (HTTP resources on an HTTPS page) is equally fatal.
The TLS certificate must be valid (not expired, not self-signed in production,
matching the domain name).

### I2. FalkorDB always reachable

The physics tick queries FalkorDB hundreds of times per cycle. The narrative
engine reads citizen relationships and tensions from the graph. If FalkorDB
is unreachable, the world stops evolving -- citizens freeze in their current
state, no new events occur, no tension breaks happen. The world becomes a
diorama.

FalkorDB runs on the same host as the Express server (localhost:6379). Network
failure between them should be impossible. The only failure modes are: FalkorDB
process crash, Docker container stop, or out-of-memory kill.

### I3. Health endpoint always responds

`GET /state` must return HTTP 200 with valid JSON at all times the server
process is running. This endpoint is the heartbeat for all monitoring systems.
If it fails to respond within 5 seconds, the server is considered down.

The endpoint must never block on external dependencies (Airtable, Claude API,
FalkorDB). It reads in-memory state only. A slow FalkorDB query must not
make the health endpoint timeout.

---

## Health Checks

### HC1. SSL Certificate Expiry

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| Days until certificate expiry | > 30 days   | `openssl s_client` check             |
| Certificate valid for domain  | yes         | CN or SAN matches `venezia.mindprotocol.ai` |
| Certificate chain complete    | yes         | Intermediate certs included          |
| TLS version                   | >= 1.2      | TLS 1.0 and 1.1 are deprecated      |
| HSTS header present           | yes         | `Strict-Transport-Security` in response |

Alert thresholds:
- 30 days before expiry: warning (email/Telegram to Nicolas)
- 14 days before expiry: critical alert (daily reminders)
- 7 days before expiry: escalation (manual renewal required)
- 0 days: HTTPS is broken. World is down.

With Let's Encrypt and Certbot auto-renewal, certificates renew at 30 days
before expiry automatically. The alert at 14 days catches renewal failures.

### HC2. Uptime Percentage

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| Monthly uptime                | > 99.0%     | ~7 hours downtime allowed per month  |
| Weekly uptime                 | > 99.5%     | ~50 minutes downtime allowed per week |
| MTTR (Mean Time To Recovery)  | < 15 minutes | From outage detection to service restored |
| Restart count per day         | < 3         | Process crashes requiring restart    |
| Planned maintenance window    | < 30 min/mo | Deployments and updates              |

99% monthly uptime allows roughly 7 hours of downtime. For a V1 single-player
experience, this is acceptable. The world is not a hospital -- missing an
hour here and there is tolerable. But undetected multi-day outages are not.

### HC3. Response Latency

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| `/state` response time (p50)  | < 10ms      | In-memory state read                 |
| `/state` response time (p95)  | < 50ms      | Including occasional GC interference |
| `/speak` response time (p50)  | < 2000ms    | Full voice pipeline                  |
| `/speak` response time (p95)  | < 3500ms    | With STT + LLM + TTS                |
| WebSocket `welcome` latency   | < 500ms     | From connection upgrade to welcome message |
| First content paint           | < 3000ms    | From URL entry to visible 3D content |
| Time to interactive           | < 5000ms    | From URL entry to voice-ready state  |

### HC4. Backup Freshness

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| FalkorDB backup age           | < 24 hours  | Last successful volume snapshot      |
| Citizen memory backup age     | < 24 hours  | Last `.cascade/` directory rsync     |
| Airtable export age           | < 7 days    | Last full Airtable API export        |
| Backup size (FalkorDB)        | > 0 bytes   | Non-empty backup file                |
| Backup size (citizen memory)  | growing     | Total `.cascade/` size should only grow |
| Backup restoration tested     | monthly     | Restore from backup on staging       |

### HC5. Error Rate

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| HTTP 5xx per hour             | 0           | Server errors on any endpoint        |
| HTTP 4xx per hour             | < 10        | Client errors (expected: some invalid requests) |
| WebSocket disconnects per hour | < 5        | Unexpected connection drops          |
| Airtable sync failures per day | < 2        | Rate limits or API errors            |
| FalkorDB errors per day       | 0           | Localhost connection should never fail |
| Claude/OpenAI API errors per hour | < 3     | Rate limits, timeouts, server errors |
| ElevenLabs API errors per hour | < 2        | TTS failures (fallback should catch) |

---

## Acceptance Criteria

### AC1. Fresh Deployment (Automated)

1. Deploy from a clean state (no existing containers, no cached data).
2. Start FalkorDB container. Wait for PING response.
3. Start Express server. Wait for `/state` to return 200.
4. Connect a WebSocket client. Receive `welcome` message.
5. Trigger Airtable sync. Citizens populate in-memory state.
6. Send a voice message. Receive TTS response.

Pass criteria:
- Total time from deploy start to first voice response: < 120 seconds
- FalkorDB available within 10 seconds
- Express server available within 30 seconds
- All 186 citizens loaded within 60 seconds of Airtable sync start
- No errors in server logs during startup

### AC2. Zero-Downtime Redeploy (Manual)

1. The server is running with 1 active WebSocket client.
2. Deploy new code (git pull + npm install + restart).
3. Client detects disconnect. Client auto-reconnects.
4. Client receives new `welcome` message. World state restored.
5. Total interruption measured from client perspective.

Pass criteria:
- Client interruption < 10 seconds
- Client auto-reconnects without manual intervention
- No data loss (citizen positions and state restored from Airtable sync)
- No error shown to the visitor (reconnection is silent)

### AC3. Dependency Failure Resilience (Automated)

Test each external dependency failure independently:

**Airtable down:**
1. Block Airtable API access (iptables or env var).
2. Server continues running with cached citizen data.
3. Voice pipeline continues working.
4. Airtable sync logs failure but does not crash server.
5. Restore access. Next sync cycle succeeds.

**Claude/OpenAI API down:**
1. Block API access.
2. Voice pipeline STT/LLM fails. Visitor hears silence (not an error).
3. Server continues running. WebSocket connections maintained.
4. Restore access. Next voice interaction succeeds.

**ElevenLabs down:**
1. Block ElevenLabs API access.
2. Voice pipeline falls back to OpenAI TTS.
3. Visitor hears response (slightly higher latency, lower quality).
4. Restore access. ElevenLabs resumes as primary.

**FalkorDB crash:**
1. Kill FalkorDB container.
2. Server logs FalkorDB connection failure.
3. Physics tick skips (no graph to query). Citizens maintain last known state.
4. Voice pipeline continues (it does not depend on FalkorDB).
5. Restart FalkorDB. Server reconnects. Physics tick resumes.

Pass criteria: no dependency failure crashes the server. The world degrades
but does not die.

### AC4. HTTPS Verification (Automated)

1. Connect to production URL via HTTPS.
2. Verify certificate is valid (not expired, not self-signed).
3. Verify certificate matches the domain (`venezia.mindprotocol.ai`).
4. Verify TLS 1.2 or higher.
5. Attempt HTTP (non-TLS) connection. Verify redirect to HTTPS (301).
6. Verify no mixed content warnings in browser console.
7. Verify WebSocket upgrade uses `wss://` (not `ws://`).

Pass criteria: all 7 checks pass. Any failure = HTTPS is broken = world is down.

### AC5. Monitoring Coverage (Manual Audit)

1. Verify health check script runs every 60 seconds.
2. Simulate server outage (kill process). Verify alert fires within 3 minutes.
3. Simulate FalkorDB outage (stop container). Verify alert fires within 3 minutes.
4. Simulate SSL certificate expiry (set system clock forward). Verify alert fires.
5. Verify alert reaches Nicolas via Telegram.

Pass criteria: all failure modes produce alerts. No silent failures.

---

## Anti-Patterns

### AP1. Certificate Expiry

**Symptom:** World suddenly stops working. Quest 3 browser shows a
security error. WebSocket refuses to connect. No voice, no rendering,
nothing.

**Detection:** SSL certificate has expired. `openssl s_client` shows
`Verify return code: 10 (certificate has expired)`.

**Root cause:** Certbot auto-renewal cron failed silently. Or the hosting
provider changed IP and the DNS record is stale, causing the ACME challenge
to fail. Or a manual certificate was installed 90 days ago and nobody
remembered to renew it.

**Fix:** Verify Certbot renewal is active: `certbot renew --dry-run`.
Set up a monitoring check that alerts at 14 days before expiry. Use
a hosting provider that handles TLS automatically (Render, Caddy) to
eliminate manual certificate management. Test renewal quarterly by
forcing a renewal: `certbot renew --force-renewal`.

### AP2. Silent FalkorDB Failure

**Symptom:** Citizens stop reacting to world events. No tension breaks
occur. The economy appears frozen. But the server is running, voice works,
visitors can connect. The world is technically alive but narratively dead.

**Detection:** Physics tick logs show FalkorDB connection errors. Or no
physics tick has completed in > 10 minutes (check last tick timestamp).
Citizens' moods and activities have not changed in > 30 minutes.

**Root cause:** FalkorDB container crashed (out-of-memory, disk full).
Or Docker daemon restarted and did not restart the container (missing
`restart: unless-stopped`). Or FalkorDB AOF file corrupted.

**Fix:** FalkorDB Docker container must have `restart: unless-stopped`.
Server health check must PING FalkorDB every 60 seconds and alert on
failure. Physics tick must log both success and failure. If 3 consecutive
physics ticks fail, send Telegram alert to Nicolas with error details.

### AP3. Backup Rot

**Symptom:** A disaster occurs (server disk failure, data corruption).
The backup is restored. The backup is 45 days old because the backup
cron failed silently 44 days ago. 44 days of citizen memory is lost.

**Detection:** Check backup timestamps. If the most recent backup of any
category is older than its target freshness, backup rot is occurring.

**Root cause:** Backup script failed (disk full on backup target, S3
credentials expired, rsync target unreachable). Cron job was edited
and the backup entry was accidentally removed. Backup script ran but
wrote zero bytes (empty backup looks like success).

**Fix:** Post-backup validation: verify backup file size is > 0 and
growing relative to previous backup. Alert if backup size decreases by
> 50% (likely truncation). Alert if backup has not run in > 26 hours
(for daily backups). Monthly backup restoration test on a staging
environment -- this is the only way to verify backups actually work.

### AP4. Cost Overrun

**Symptom:** Monthly cloud bill doubles or triples. Claude API charges
spike. ElevenLabs usage exhausts the plan mid-month.

**Detection:** Set billing alerts at 50%, 80%, and 100% of the monthly
budget for each API provider. Monitor daily spend trends.

**Root cause categories:**
- Ambient citizen conversations consuming LLM calls without rate limiting
- Voice pipeline called in a loop (client bug, reconnection loop)
- Airtable sync running too frequently (every minute instead of every 15)
- Runaway process spawning Claude API calls (e.g., physics tick bug)

**Fix:** Hard rate limits on every external API call:
- Claude/OpenAI: max 3 concurrent, max 60/hour
- ElevenLabs: max 1 concurrent, max 120/hour
- Airtable: max 5 req/s (API limit), sync cycle no more frequent than 10 min
Log daily API call counts. Alert if any provider exceeds 2x the expected
daily average.

### AP5. Environment Variable Drift

**Symptom:** Deployment works on one machine but fails on another. Or
a redeployment breaks a feature that was working before. API keys
mismatch. Wrong database URL.

**Detection:** Compare `.env` files across environments. Diff against
a known-good configuration. Check for missing variables on startup.

**Root cause:** Environment variables added to development but not to
production `.env`. Or a variable was renamed in code but not in the
environment. Or credentials were rotated and only updated in one
environment.

**Fix:** Validate all required environment variables on server startup.
If any required variable is missing, refuse to start and log the missing
variable name (never log the value). Maintain a canonical list of required
variables:

```
Required:
  OPENAI_API_KEY          (STT + voice LLM + TTS fallback)
  ELEVENLABS_API_KEY      (primary TTS)
  AIRTABLE_PAT            (citizen data sync)
  FALKORDB_URL            (graph database, default: redis://localhost:6379)

Optional:
  PORT                    (default: 8800)
  HTTPS_PORT              (default: 8443)
  NODE_ENV                (default: development)
  CLAUDE_API_KEY          (for citizen deep conversation, future)
  TELEGRAM_BOT_TOKEN      (for alerting)
  TELEGRAM_CHAT_ID        (Nicolas's chat ID for alerts)
```

---

## Data Integrity

### Backup Restoration Test

```
MONTHLY (on staging environment):
  1. Take the latest production backup:
     - FalkorDB Docker volume snapshot
     - .cascade/ citizen memory archive
     - Airtable API export JSON

  2. Restore on staging:
     - Load FalkorDB snapshot into a fresh container
     - Copy .cascade/ to staging filesystem
     - Import Airtable export (or point to production Airtable read-only)

  3. Start server on staging.

  4. Verify:
     - /state returns 200 with correct citizen count
     - FalkorDB PING succeeds
     - At least 10 citizens have non-empty .cascade/ directories
     - Physics tick completes without error
     - Voice pipeline produces a response

  5. Record results:
     - Date of test
     - Backup age at time of test
     - Citizen count restored
     - Any data gaps or corruption found
     - Time to restore (target: < 30 minutes)

  FAILURE TO TEST = BACKUP IS UNVERIFIED = BACKUP DOES NOT EXIST
```

### Environment Variable Completeness

```
ON SERVER START:
  required_vars = [
    "OPENAI_API_KEY",
    "ELEVENLABS_API_KEY",
    "AIRTABLE_PAT"
  ]

  for var in required_vars:
    if var not in environment:
      log.fatal("Missing required environment variable: {var}")
      process.exit(1)

  optional_vars = [
    "FALKORDB_URL",
    "PORT",
    "HTTPS_PORT",
    "NODE_ENV",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID"
  ]

  for var in optional_vars:
    if var not in environment:
      log.warn("Optional environment variable not set: {var} (using default)")

  // Validate format (not just presence)
  assert OPENAI_API_KEY starts with "sk-"
  assert ELEVENLABS_API_KEY is non-empty string
  assert AIRTABLE_PAT starts with "pat"
  assert FALKORDB_URL (if set) matches redis:// URL pattern
  assert PORT (if set) is integer between 1024 and 65535
```

### Production Health Dashboard

```
CONTINUOUS (every 60 seconds):
  - HTTP health check: GET /state, expect 200 within 5 seconds
  - FalkorDB health check: PING, expect PONG within 1 second
  - SSL check: verify certificate not expiring within 14 days
  - Process check: server PID exists and is responsive
  - Memory check: RSS < 1GB (server), disk usage < 80%
  - Backup check: most recent FalkorDB backup < 26 hours old
  - Backup check: most recent .cascade/ backup < 26 hours old

ALERT ROUTING:
  - Warning: log to server journal
  - Critical: Telegram message to Nicolas (chat_id: 1864364329)
  - Fatal (server down): Telegram message + attempt automatic restart

STATE FILE: /tmp/venezia-health-status.json
  {
    "last_check": "2026-03-11T14:00:00Z",
    "http_ok": true,
    "falkordb_ok": true,
    "ssl_days_remaining": 67,
    "uptime_seconds": 345600,
    "memory_rss_mb": 312,
    "backup_falkordb_age_hours": 4.2,
    "backup_cascade_age_hours": 8.1
  }
```
