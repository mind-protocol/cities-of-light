# ALGORITHM -- Deployment

> Pseudocode and data structures for production deployment of Venezia.
> Reference implementations: `start.sh`, `package.json`, `src/server/index.js`.
> Target infrastructure: Docker Compose on a single host.

---

## 1. Data Structures

```
DockerComposeStack:
    services:
        express:      ServiceConfig
        falkordb:     ServiceConfig
        nginx:        ServiceConfig
    volumes:
        falkordb-data: VolumeConfig
        certbot-conf:  VolumeConfig
        certbot-www:   VolumeConfig

ServiceConfig:
    image:        string
    build:        BuildConfig | null
    ports:        string[]
    volumes:      string[]
    environment:  Map<string, string>
    depends_on:   string[]
    restart:      string
    healthcheck:  HealthCheckConfig | null

HealthCheckConfig:
    test:          string[]
    interval:      string
    timeout:       string
    retries:       int
    start_period:  string

DeploymentPipeline:
    stages:        Stage[]
    rollbackRef:   string          // git commit hash of last known good

Stage:
    name:          string
    commands:      string[]
    rollbackOnFail: bool

HealthCheckResult:
    service:       string
    status:        enum(HEALTHY, DEGRADED, DOWN)
    latencyMs:     float
    details:       string
    timestamp:     timestamp

BackupManifest:
    falkordbSnapshot:  string      // path to RDB/AOF backup
    airtableExport:    string      // path to JSON export
    citizenMemory:     string      // path to .cascade/ backup
    timestamp:         timestamp

MonitoringState:
    uptimeStart:       timestamp
    consecutiveErrors: int
    lastHealthCheck:   timestamp
    alertsSent:        Map<alertType, timestamp>
```

---

## 2. Docker Compose Stack

### 2.1 Full Stack Definition

```
DOCKER_COMPOSE:

    services:

        // ── Express Server (Node.js) ────────────────────────
        express:
            build:
                context: .
                dockerfile: Dockerfile
            ports:
                - "8800:8800"        // HTTP (internal, nginx proxies)
            volumes:
                - ./data:/app/data                   // vault media, voice assignments
                - ./perception:/app/perception       // perception captures
                - citizen-memory:/app/.cascade       // citizen memory (persistent)
            environment:
                NODE_ENV: production
                OPENAI_API_KEY: ${OPENAI_API_KEY}
                ELEVENLABS_API_KEY: ${ELEVENLABS_API_KEY}
                ELEVENLABS_VOICE_ID: ${ELEVENLABS_VOICE_ID}
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

        // ── FastAPI Services (Python) ───────────────────────
        fastapi:
            build:
                context: ./services
                dockerfile: Dockerfile
            ports:
                - "8900:8900"        // internal only
            environment:
                OPENAI_API_KEY: ${OPENAI_API_KEY}
            restart: unless-stopped
            healthcheck:
                test: ["CMD", "curl", "-f", "http://localhost:8900/health"]
                interval: 30s
                timeout: 5s
                retries: 3
                start_period: 15s

        // ── FalkorDB (Redis-compatible graph database) ──────
        falkordb:
            image: falkordb/falkordb:latest
            ports:
                - "6379:6379"        // internal only (not exposed to host)
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

        // ── nginx (TLS termination + reverse proxy) ─────────
        nginx:
            image: nginx:alpine
            ports:
                - "80:80"
                - "443:443"
            volumes:
                - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
                - ./nginx/conf.d:/etc/nginx/conf.d:ro
                - certbot-conf:/etc/letsencrypt:ro
                - certbot-www:/var/www/certbot:ro
                - ./dist:/var/www/static:ro         // client build
            depends_on:
                - express
            restart: unless-stopped

        // ── Certbot (Let's Encrypt auto-renewal) ────────────
        certbot:
            image: certbot/certbot
            volumes:
                - certbot-conf:/etc/letsencrypt
                - certbot-www:/var/www/certbot
            entrypoint: /bin/sh -c
                "trap exit TERM;
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

### 2.2 Express Dockerfile

```
DOCKERFILE_EXPRESS:

    FROM node:20-alpine

    WORKDIR /app

    // Install dependencies first (layer caching)
    COPY package.json package-lock.json ./
    RUN npm ci --production

    // Copy source
    COPY src/ ./src/
    COPY dist/ ./dist/
    COPY data/ ./data/

    // Non-root user for security
    RUN adduser -D -h /app venezia
    USER venezia

    EXPOSE 8800

    // Health check built into the container
    HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
        CMD curl -f http://localhost:8800/state || exit 1

    CMD ["node", "src/server/index.js"]
```

---

## 3. nginx Configuration

### 3.1 HTTPS Termination and WebSocket Proxy

```
NGINX_CONF:

    // ── Global settings ─────────────────────────────────────
    worker_processes auto;
    worker_rlimit_nofile 8192;

    events {
        worker_connections 4096;
        multi_accept on;
    }

    http {
        // ── Logging ─────────────────────────────────────────
        log_format main '$remote_addr - [$time_local] '
                        '"$request" $status $body_bytes_sent '
                        '"$http_referer" $request_time';
        access_log /var/log/nginx/access.log main;
        error_log /var/log/nginx/error.log warn;

        // ── Performance ─────────────────────────────────────
        sendfile on;
        tcp_nopush on;
        tcp_nodelay on;
        keepalive_timeout 65;
        types_hash_max_size 2048;
        client_max_body_size 10m;

        // ── MIME types ──────────────────────────────────────
        include /etc/nginx/mime.types;
        default_type application/octet-stream;

        // ── Gzip ────────────────────────────────────────────
        gzip on;
        gzip_types text/plain text/css application/json
                   application/javascript text/xml
                   application/xml application/wasm;
        gzip_min_length 1024;

        // ── Upstream definitions ────────────────────────────
        upstream express_backend {
            server express:8800;
            keepalive 16;
        }

        // ── HTTP -> HTTPS redirect ──────────────────────────
        server {
            listen 80;
            server_name venezia.mindprotocol.ai;

            // Let's Encrypt challenge
            location /.well-known/acme-challenge/ {
                root /var/www/certbot;
            }

            // Redirect all other traffic to HTTPS
            location / {
                return 301 https://$host$request_uri;
            }
        }

        // ── HTTPS server ────────────────────────────────────
        server {
            listen 443 ssl http2;
            server_name venezia.mindprotocol.ai;

            // ── TLS configuration ───────────────────────────
            ssl_certificate /etc/letsencrypt/live/venezia.mindprotocol.ai/fullchain.pem;
            ssl_certificate_key /etc/letsencrypt/live/venezia.mindprotocol.ai/privkey.pem;
            ssl_protocols TLSv1.2 TLSv1.3;
            ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
            ssl_prefer_server_ciphers off;
            ssl_session_cache shared:SSL:10m;
            ssl_session_timeout 1d;

            // ── Security headers ────────────────────────────
            add_header Strict-Transport-Security
                "max-age=63072000; includeSubDomains" always;
            add_header Permissions-Policy
                "xr-spatial-tracking=(*), microphone=(*), camera=(*)";
            add_header Cross-Origin-Opener-Policy "same-origin";
            add_header Cross-Origin-Embedder-Policy "require-corp";

            // ── WebSocket proxy (/ws) ───────────────────────
            location /ws {
                proxy_pass http://express_backend;
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection "upgrade";
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;

                // WebSocket timeouts (keep alive)
                proxy_read_timeout 86400s;
                proxy_send_timeout 86400s;
            }

            // ── API proxy ───────────────────────────────────
            location /state {
                proxy_pass http://express_backend;
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
            }

            location /api/ {
                proxy_pass http://express_backend;
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
            }

            location /speak {
                proxy_pass http://express_backend;
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
            }

            location /perception/ {
                proxy_pass http://express_backend;
                proxy_set_header Host $host;
            }

            location /services/ {
                proxy_pass http://express_backend;
                proxy_set_header Host $host;
            }

            // ── Vault media (videos) ────────────────────────
            location /vault-media/ {
                proxy_pass http://express_backend;
                proxy_set_header Host $host;
                add_header Cross-Origin-Resource-Policy "same-origin";
            }

            // ── Static files (client build) ─────────────────
            location / {
                root /var/www/static;
                try_files $uri $uri/ /index.html;

                // Cache static assets aggressively
                location ~* \.(js|css|wasm|png|jpg|svg|glb|gltf|ogg|wav|mp3)$ {
                    expires 30d;
                    add_header Cache-Control "public, immutable";
                }

                // HTML: no cache (always fresh on deploy)
                location ~* \.html$ {
                    expires -1;
                    add_header Cache-Control "no-cache, no-store, must-revalidate";
                }
            }
        }
    }
```

---

## 4. Deployment Pipeline

### 4.1 Build -> Test -> Deploy -> Verify

```
DEPLOY_PIPELINE:

    // ── Stage 1: Build ──────────────────────────────────────
    STAGE_BUILD():
        // Record rollback reference
        rollbackRef = git_rev_parse("HEAD~1")

        // Pull latest code
        git pull origin main

        // Install dependencies
        npm ci

        // Build client (Vite production bundle)
        npx vite build
        // Output: dist/ directory with index.html, JS, CSS, assets

        // Verify build artifacts exist
        assert file_exists("dist/index.html")
        assert file_exists("dist/assets/")

    // ── Stage 2: Test ───────────────────────────────────────
    STAGE_TEST():
        // Syntax check server code
        node --check src/server/index.js
        node --check src/server/voice.js
        node --check src/server/rooms.js
        node --check src/server/ai-citizens.js

        // Run unit tests (if present)
        // npm test

        // Verify Docker build
        docker compose build --no-cache

    // ── Stage 3: Deploy ─────────────────────────────────────
    STAGE_DEPLOY():
        // Snapshot FalkorDB volume before deploy
        BACKUP_FALKORDB()

        // Rolling restart: stop old, start new
        docker compose up -d --build --remove-orphans

        // Wait for health checks to pass
        MAX_WAIT = 60    // seconds
        waited = 0
        while waited < MAX_WAIT:
            results = RUN_HEALTH_CHECKS()
            if all(r.status == HEALTHY for r in results):
                break
            sleep(5)
            waited += 5

        if waited >= MAX_WAIT:
            ROLLBACK(rollbackRef)
            ALERT("Deployment failed: health checks did not pass within 60s")
            exit(1)

    // ── Stage 4: Verify ─────────────────────────────────────
    STAGE_VERIFY():
        // HTTP endpoint check
        response = http_get("https://venezia.mindprotocol.ai/state")
        assert response.status == 200
        state = response.json()
        assert state.uptime > 0

        // WebSocket connection check
        ws = new WebSocket("wss://venezia.mindprotocol.ai/ws")
        ws.send(JSON.stringify({ type: "join", name: "deploy-test", spectator: true }))
        msg = ws.receive(timeout=5000)
        assert JSON.parse(msg).type == "welcome"
        ws.close()

        // FalkorDB connectivity (via Express proxy or direct)
        // The Express health check already validates this

        ALERT("Deployment successful: all checks passed")
```

### 4.2 Simple Deployment (Non-Docker, VPS)

```
DEPLOY_SIMPLE():
    // For self-hosted VPS without Docker

    // Step 1: Pull code
    cd /opt/cities-of-light
    git pull origin main

    // Step 2: Install dependencies
    npm ci --production

    // Step 3: Build client
    npx vite build

    // Step 4: Restart server via PM2
    pm2 restart venezia || pm2 start src/server/index.js --name venezia

    // Step 5: Verify
    sleep 3
    curl -f http://localhost:8800/state
```

---

## 5. Health Check System

### 5.1 Express /health Endpoint

```
REGISTER_HEALTH_ENDPOINT(app):
    app.get("/health", async (req, res):
        checks = {}
        overallStatus = "healthy"

        // ── Express server ──────────────────────────────────
        checks.express = {
            status: "healthy",
            uptime: process.uptime(),
            connections: connections.size,
            citizens: citizens.size,
            memoryMB: round(process.memoryUsage().rss / 1024 / 1024),
        }

        // ── FalkorDB ────────────────────────────────────────
        try:
            start = now()
            result = await falkordbClient.ping()
            latency = now() - start
            checks.falkordb = {
                status: "healthy",
                latencyMs: latency,
            }
        catch (e):
            checks.falkordb = {
                status: "down",
                error: e.message,
            }
            overallStatus = "degraded"

        // ── Airtable ────────────────────────────────────────
        try:
            start = now()
            // Light probe: fetch one record to verify connectivity
            result = await airtable.base(BASE_ID).table("Citizens").select({
                maxRecords: 1,
                fields: ["Name"],
            }).firstPage()
            latency = now() - start
            checks.airtable = {
                status: "healthy",
                latencyMs: latency,
            }
        catch (e):
            checks.airtable = {
                status: "degraded",
                error: e.message,
                note: "Using cached data",
            }
            // Airtable failure is degraded, not down
            // Server continues with stale cache
            if overallStatus == "healthy":
                overallStatus = "degraded"

        // ── OpenAI (voice pipeline dependency) ──────────────
        checks.openai = {
            status: process.env.OPENAI_API_KEY ? "configured" : "missing",
        }

        // ── ElevenLabs (TTS dependency) ─────────────────────
        checks.elevenlabs = {
            status: process.env.ELEVENLABS_API_KEY ? "configured" : "missing",
        }

        // ── Response ────────────────────────────────────────
        statusCode = overallStatus == "healthy" ? 200 : 503
        res.status(statusCode).json({
            status: overallStatus,
            timestamp: new Date().toISOString(),
            checks: checks,
        })
    )
```

### 5.2 Health Check Runner (External Monitor)

```
HEALTH_CHECK_INTERVAL = 60000    // 60 seconds
CONSECUTIVE_FAILURES_ALERT = 2

RUN_HEALTH_CHECKS():
    results = []

    // ── Check 1: HTTP /health ───────────────────────────────
    try:
        start = now()
        response = http_get("https://venezia.mindprotocol.ai/health",
                           timeout=5000)
        latency = now() - start
        body = response.json()
        results.append({
            service: "express",
            status: body.status == "healthy" ? HEALTHY : DEGRADED,
            latencyMs: latency,
            details: body,
        })
    catch (e):
        results.append({
            service: "express",
            status: DOWN,
            latencyMs: -1,
            details: e.message,
        })

    // ── Check 2: WebSocket connectivity ─────────────────────
    try:
        start = now()
        ws = new WebSocket("wss://venezia.mindprotocol.ai/ws")
        await ws.waitForOpen(timeout=5000)
        ws.send(JSON.stringify({
            type: "join",
            name: "health-check",
            spectator: true,
        }))
        msg = await ws.receive(timeout=5000)
        latency = now() - start
        welcome = JSON.parse(msg)

        if welcome.type == "welcome":
            results.append({
                service: "websocket",
                status: HEALTHY,
                latencyMs: latency,
                details: "welcome received",
            })
        else:
            results.append({
                service: "websocket",
                status: DEGRADED,
                latencyMs: latency,
                details: "unexpected message type: " + welcome.type,
            })
        ws.close()
    catch (e):
        results.append({
            service: "websocket",
            status: DOWN,
            latencyMs: -1,
            details: e.message,
        })

    // ── Check 3: TLS certificate expiry ─────────────────────
    try:
        certInfo = tls_connect("venezia.mindprotocol.ai", 443)
        daysRemaining = (certInfo.validTo - now()) / (24 * 3600 * 1000)
        status = HEALTHY
        if daysRemaining < 7: status = DOWN       // critical
        elif daysRemaining < 30: status = DEGRADED // warning
        results.append({
            service: "tls_cert",
            status: status,
            latencyMs: 0,
            details: "expires in " + round(daysRemaining) + " days",
        })
    catch (e):
        results.append({
            service: "tls_cert",
            status: DOWN,
            details: e.message,
        })

    return results


MONITOR_LOOP():
    state = new MonitoringState()
    state.uptimeStart = now()
    state.consecutiveErrors = 0
    state.alertsSent = Map()

    while true:
        results = RUN_HEALTH_CHECKS()
        state.lastHealthCheck = now()

        anyDown = false
        for result in results:
            if result.status == DOWN:
                anyDown = true

        if anyDown:
            state.consecutiveErrors += 1
            if state.consecutiveErrors >= CONSECUTIVE_FAILURES_ALERT:
                SEND_ALERT(results, state)
        else:
            if state.consecutiveErrors >= CONSECUTIVE_FAILURES_ALERT:
                SEND_RECOVERY_ALERT(results, state)
            state.consecutiveErrors = 0

        sleep(HEALTH_CHECK_INTERVAL)
```

---

## 6. Backup Procedures

### 6.1 FalkorDB Backup (BGSAVE)

```
BACKUP_FALKORDB():
    timestamp = format_date(now(), "YYYY-MM-DD_HHmm")
    backupDir = "/backups/falkordb"

    // Step 1: Trigger background save
    falkordbClient.send("BGSAVE")

    // Step 2: Wait for save to complete
    MAX_WAIT = 30    // seconds
    for i in range(MAX_WAIT):
        info = falkordbClient.send("LASTSAVE")
        if info.lastSaveTime > (now() - 60):
            break
        sleep(1)

    // Step 3: Copy RDB snapshot from Docker volume
    rdbPath = docker_exec("falkordb", "find /data -name 'dump.rdb'")
    docker_cp("falkordb:" + rdbPath, backupDir + "/dump_" + timestamp + ".rdb")

    // Step 4: Copy AOF if present
    aofPath = docker_exec("falkordb", "find /data -name 'appendonly.aof*'")
    if aofPath:
        docker_cp("falkordb:" + aofPath, backupDir + "/aof_" + timestamp + "/")

    // Step 5: Compress
    tar_gz(backupDir + "/dump_" + timestamp + ".rdb",
           backupDir + "/falkordb_" + timestamp + ".tar.gz")

    // Step 6: Upload to remote storage (S3 or rsync)
    UPLOAD_BACKUP(backupDir + "/falkordb_" + timestamp + ".tar.gz",
                  "s3://venezia-backups/falkordb/")

    // Step 7: Prune old local backups (keep last 7 days)
    PRUNE_LOCAL_BACKUPS(backupDir, maxAgeDays=7)

    return backupDir + "/falkordb_" + timestamp + ".tar.gz"
```

### 6.2 Airtable Export

```
BACKUP_AIRTABLE():
    timestamp = format_date(now(), "YYYY-MM-DD_HHmm")
    backupDir = "/backups/airtable"

    tables = ["Citizens", "Buildings", "Contracts", "Activities",
              "Relationships", "Districts"]

    for tableName in tables:
        records = []
        offset = null

        // Paginate through all records
        while true:
            params = { pageSize: 100 }
            if offset: params.offset = offset

            response = airtable_api_get(
                BASE_ID, tableName, params,
                headers={ "Authorization": "Bearer " + AIRTABLE_PAT }
            )

            for record in response.records:
                records.append({
                    id: record.id,
                    fields: record.fields,
                    createdTime: record.createdTime,
                })

            offset = response.offset
            if not offset: break

            // Respect Airtable rate limit (5 req/s)
            sleep(200)

        // Write table export
        write_json(
            backupDir + "/" + tableName + "_" + timestamp + ".json",
            { table: tableName, recordCount: len(records), records: records }
        )

    // Compress all tables
    tar_gz(backupDir + "/*_" + timestamp + ".json",
           backupDir + "/airtable_" + timestamp + ".tar.gz")

    UPLOAD_BACKUP(backupDir + "/airtable_" + timestamp + ".tar.gz",
                  "s3://venezia-backups/airtable/")

    return backupDir + "/airtable_" + timestamp + ".tar.gz"
```

### 6.3 Citizen Memory Backup

```
BACKUP_CITIZEN_MEMORY():
    timestamp = format_date(now(), "YYYY-MM-DD_HHmm")
    backupDir = "/backups/citizen-memory"
    sourceDir = "/app/.cascade"    // Docker volume mount

    // rsync to backup location (preserves timestamps, incremental)
    rsync(
        source=sourceDir,
        dest=backupDir + "/cascade_" + timestamp + "/",
        flags="--archive --compress --delete"
    )

    // Compress
    tar_gz(backupDir + "/cascade_" + timestamp + "/",
           backupDir + "/cascade_" + timestamp + ".tar.gz")

    UPLOAD_BACKUP(backupDir + "/cascade_" + timestamp + ".tar.gz",
                  "s3://venezia-backups/citizen-memory/")

    PRUNE_LOCAL_BACKUPS(backupDir, maxAgeDays=30)
```

### 6.4 Backup Scheduler

```
BACKUP_SCHEDULE:
    // Daily at 04:00 UTC (low traffic)
    cron "0 4 * * *":
        BACKUP_FALKORDB()
        BACKUP_CITIZEN_MEMORY()

    // Weekly on Sunday at 05:00 UTC
    cron "0 5 * * 0":
        BACKUP_AIRTABLE()

    // Before every deployment (triggered by deploy pipeline)
    on_deploy:
        BACKUP_FALKORDB()
```

---

## 7. Monitoring and Alerting

### 7.1 Metrics and Thresholds

```
ALERT_THRESHOLDS = {
    "uptime": {
        condition: "restart_count > 3 in 1 hour",
        severity: "critical",
    },
    "websocket_connections": {
        condition: "connections drops to 0 unexpectedly",
        severity: "warning",
    },
    "airtable_sync": {
        condition: "2 consecutive sync failures",
        severity: "warning",
    },
    "physics_tick": {
        condition: "tick duration > 5 seconds",
        severity: "critical",
    },
    "voice_latency": {
        condition: "end-to-end > 5 seconds",
        severity: "warning",
    },
    "memory": {
        condition: "RSS > 1GB",
        severity: "critical",
    },
    "falkordb": {
        condition: "3 consecutive PING failures",
        severity: "critical",
    },
    "tls_cert": {
        condition: "expiry < 7 days",
        severity: "critical",
    },
    "error_rate": {
        condition: "500 errors > 10 in 5 minutes",
        severity: "warning",
    },
}
```

### 7.2 Alert Dispatcher

```
ALERT_COOLDOWN = 600000    // 10 minutes between repeat alerts

SEND_ALERT(results, state):
    // Build alert message
    failures = results.filter(r => r.status != HEALTHY)
    message = "Venezia Alert:\n"
    for failure in failures:
        message += "  " + failure.service + ": " + failure.status
        message += " (" + failure.details + ")\n"
    message += "Consecutive failures: " + state.consecutiveErrors

    // Check cooldown (do not spam)
    alertKey = hash(failures.map(f => f.service).sort().join(","))
    lastSent = state.alertsSent.get(alertKey)
    if lastSent and (now() - lastSent) < ALERT_COOLDOWN:
        return    // cooldown active

    // Send via Telegram (Manemus bridge)
    SEND_TELEGRAM_ALERT(message, NICOLAS_CHAT_ID)

    state.alertsSent.set(alertKey, now())


SEND_RECOVERY_ALERT(results, state):
    message = "Venezia Recovery:\n"
    message += "All services healthy after " + state.consecutiveErrors + " failures\n"
    message += "Downtime: ~" + round(
        state.consecutiveErrors * HEALTH_CHECK_INTERVAL / 1000
    ) + " seconds"

    SEND_TELEGRAM_ALERT(message, NICOLAS_CHAT_ID)


SEND_TELEGRAM_ALERT(message, chatId):
    // Uses existing Manemus Telegram bridge
    http_post(
        "https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage",
        body={
            chat_id: chatId,
            text: message,
            parse_mode: "Markdown",
        }
    )
```

---

## 8. Rollback Procedure

```
ROLLBACK(targetRef):
    // Step 1: Log the rollback
    log("ROLLBACK initiated to " + targetRef)
    SEND_TELEGRAM_ALERT("Rolling back Venezia to " + targetRef, NICOLAS_CHAT_ID)

    // Step 2: Stop current containers
    docker_compose("stop", services=["express", "fastapi", "nginx"])

    // Step 3: Checkout target revision
    git checkout targetRef

    // Step 4: Rebuild client
    npm ci
    npx vite build

    // Step 5: Rebuild and restart containers
    docker_compose("up", flags="-d --build")

    // Step 6: Wait for health
    MAX_WAIT = 60
    waited = 0
    while waited < MAX_WAIT:
        results = RUN_HEALTH_CHECKS()
        if all(r.status == HEALTHY for r in results):
            break
        sleep(5)
        waited += 5

    if waited >= MAX_WAIT:
        // Rollback also failed
        SEND_TELEGRAM_ALERT(
            "CRITICAL: Rollback to " + targetRef + " also failed. Manual intervention required.",
            NICOLAS_CHAT_ID
        )
        exit(1)

    // Step 7: Verify
    SEND_TELEGRAM_ALERT(
        "Rollback complete. Venezia running on " + targetRef,
        NICOLAS_CHAT_ID
    )
```

---

## 9. FalkorDB Restore

```
RESTORE_FALKORDB(backupPath):
    // Step 1: Stop Express (prevent writes during restore)
    docker_compose("stop", services=["express"])

    // Step 2: Stop FalkorDB
    docker_compose("stop", services=["falkordb"])

    // Step 3: Extract backup
    tar_xz(backupPath, "/tmp/falkordb-restore/")

    // Step 4: Replace data in Docker volume
    docker_run(
        image="alpine",
        volumes=["falkordb-data:/data", "/tmp/falkordb-restore:/restore"],
        command="cp /restore/dump_*.rdb /data/dump.rdb"
    )

    // Step 5: Start FalkorDB
    docker_compose("start", services=["falkordb"])

    // Step 6: Wait for FalkorDB health
    for i in range(30):
        result = docker_exec("falkordb", "redis-cli ping")
        if result == "PONG": break
        sleep(1)

    // Step 7: Start Express
    docker_compose("start", services=["express"])

    // Step 8: Verify
    results = RUN_HEALTH_CHECKS()
    if all(r.status == HEALTHY for r in results):
        log("FalkorDB restore successful")
    else:
        log("WARNING: Health checks degraded after restore")
```

---

## 10. Initial Certificate Setup

```
INIT_LETSENCRYPT(domain):
    // Step 1: Start nginx with HTTP only (for ACME challenge)
    // Use a temporary nginx config that serves only /.well-known/
    docker_compose("up", flags="-d", services=["nginx"])

    // Step 2: Request certificate
    docker_compose("run", "--rm", "certbot",
        "certbot", "certonly",
        "--webroot",
        "-w", "/var/www/certbot",
        "-d", domain,
        "--email", "nicolas@mindprotocol.ai",
        "--agree-tos",
        "--non-interactive"
    )

    // Step 3: Verify certificate exists
    assert file_exists_in_volume("certbot-conf",
        "/etc/letsencrypt/live/" + domain + "/fullchain.pem")

    // Step 4: Restart nginx with full HTTPS config
    docker_compose("restart", services=["nginx"])

    // Step 5: Verify HTTPS
    response = http_get("https://" + domain + "/state")
    assert response.status == 200

    log("TLS certificate installed for " + domain)
```
