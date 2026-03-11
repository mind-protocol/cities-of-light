# ALGORITHM -- Server

> Pseudocode and data structures for the Express server that orchestrates Venezia.
> Reference implementations: `src/server/index.js`, `src/server/rooms.js`,
> `src/server/voice.js`, `src/server/ai-citizens.js`.

---

## 1. Data Structures

```
ServerState:
    citizens:     Map<citizenId, CitizenState>    // all connected citizens
    connections:  Map<WebSocket, citizenId>        // ws -> identity
    roomManager:  RoomManager
    aiManager:    AICitizenManager
    wss:          WebSocketServer

CitizenState:
    name:         string
    persona:      string | null      // null = human, "ai" = AI citizen
    spectator:    bool
    position:     { x: float, y: float, z: float }
    rotation:     { x: float, y: float, z: float, w: float }
    zone:         string             // current zone id
    lastUpdate:   timestamp          // last position message received
    aiShape:      string | null      // geometry type for AI citizens
    aiColor:      int | null         // hex color for AI citizens

Room:
    code:         string             // 6-char alphanumeric (no I/O/0/1)
    name:         string
    citizens:     Map<citizenId, RoomMember>
    maxPlayers:   int                // capacity cap
    createdAt:    timestamp

RoomMember:
    ws:           WebSocket
    name:         string
    persona:      string | null
    spectator:    bool

RoomManager:
    rooms:        Map<code, Room>
    citizenRoom:  Map<citizenId, code>    // reverse lookup

RateLimitState:
    voiceCalls:       Map<citizenId, { count: int, windowStart: timestamp }>
    llmConcurrent:    int                 // currently active LLM calls
    positionTimers:   Map<citizenId, timestamp>  // last position broadcast time

GracefulShutdownState:
    shuttingDown:     bool
    shutdownStarted:  timestamp
```

---

## 2. Express Server Setup

```
INIT_SERVER():
    app = express()
    app.use(express.json({ limit: "10mb" }))

    // ── Security headers (WebXR + mic + SharedArrayBuffer) ──
    app.use((req, res, next):
        res.setHeader("Permissions-Policy",
            "xr-spatial-tracking=(*), microphone=(*), camera=(*)")
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin")
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp")
        next()
    )

    // ── Route registration ──────────────────────────────────
    REGISTER_ROUTES(app)

    // ── HTTP server ─────────────────────────────────────────
    httpServer = createServer(app)

    // ── HTTPS server (self-signed certs for local Quest dev) ─
    httpsServer = null
    if file_exists("/tmp/cities-cert.pem"):
        sslOpts = {
            key: readFile("/tmp/cities-key.pem"),
            cert: readFile("/tmp/cities-cert.pem"),
        }
        httpsServer = createHttpsServer(sslOpts, app)

    // ── WebSocket (noServer mode, /ws path only) ────────────
    wss = new WebSocketServer({ noServer: true })

    handleUpgrade = (request, socket, head):
        if request.url == "/ws" or request.url.startsWith("/ws?"):
            wss.handleUpgrade(request, socket, head, (ws):
                wss.emit("connection", ws, request)
            )
        else:
            socket.destroy()

    httpServer.on("upgrade", handleUpgrade)
    if httpsServer: httpsServer.on("upgrade", handleUpgrade)

    // ── Listen ──────────────────────────────────────────────
    httpServer.listen(8800, "0.0.0.0")
    if httpsServer: httpsServer.listen(8443, "0.0.0.0")

    // ── Initialize subsystems ───────────────────────────────
    roomManager = new RoomManager()
    aiManager = new AICitizenManager(broadcast, openai)

    // ── WebSocket connection handler ────────────────────────
    wss.on("connection", (ws) => HANDLE_CONNECTION(ws))

    return { httpServer, httpsServer, wss, roomManager, aiManager }


REGISTER_ROUTES(app):
    // State snapshot
    app.get("/state", (req, res):
        res.json({
            citizens: Object.fromEntries(citizens),
            connections: connections.size,
            uptime: process.uptime(),
        })
    )

    // Perception endpoint (what a citizen sees)
    app.get("/perception/:citizenId", (req, res):
        citizen = citizens.get(req.params.citizenId)
        if not citizen:
            return res.status(404).json({ error: "Citizen not found" })

        visible = []
        for (id, c) in citizens:
            if id == req.params.citizenId: continue
            dist = euclidean_distance(c.position, citizen.position)
            visible.append({ id, name: c.name, position: c.position, distance: dist })

        res.json({ self: citizen, visible, timestamp: now() })
    )

    // Zone definitions
    app.get("/api/zones", (req, res):
        res.json({ zones: ZONES })
    )

    // Room management (HTTP)
    app.get("/api/rooms", (req, res):
        res.json({ rooms: roomManager.listRooms() })
    )
    app.post("/api/rooms", (req, res):
        room = roomManager.createRoom(req.body.name, req.body)
        res.json({ code: room.code, name: room.name })
    )

    // Voice injection (external sessions speak into the world)
    app.post("/speak", HANDLE_SPEAK_ENDPOINT)

    // Services proxy (FastAPI consent/vault/biography on port 8900)
    app.use("/services", PROXY_TO_FASTAPI)

    // Vault media (video files for memorial playback)
    if dir_exists("data/vault"):
        app.use("/vault-media", express.static("data/vault"))

    // Static files (production client build)
    if dir_exists("dist"):
        app.use(express.static("dist"))
```

---

## 3. WebSocket Connection Lifecycle

### 3.1 Handshake and Join

```
HANDLE_CONNECTION(ws):
    citizenId = null

    ws.on("message", (data):
        msg = JSON.parse(data)
        DISPATCH_MESSAGE(ws, msg, citizenId)
    )

    ws.on("close", ():
        HANDLE_DISCONNECT(ws, citizenId)
    )


HANDLE_JOIN(ws, msg):
    citizenId = msg.citizenId or "citizen_" + timestamp()
    isSpectator = msg.spectator or false
    roomCode = msg.roomCode or null

    // Create citizen state
    citizens.set(citizenId, {
        name: msg.name or "Unknown",
        persona: msg.persona or null,
        spectator: isSpectator,
        position: { x: 0, y: 1.7, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        zone: "island",
        lastUpdate: now(),
    })
    connections.set(ws, citizenId)

    // ── Room assignment ─────────────────────────────────────
    room = RESOLVE_ROOM(roomCode, citizenId, ws, msg)

    // ── Initial state burst ─────────────────────────────────
    // Send all existing citizens in this room to the new client
    for (id, c) in citizens:
        if id == citizenId: continue
        if c.spectator: continue
        if roomManager.getRoomForCitizen(id)?.code != room.code: continue

        ws.send(JSON.stringify({
            type: "citizen_joined",
            citizenId: id,
            name: c.name,
            persona: c.persona,
            aiShape: c.aiShape,
            aiColor: c.aiColor,
        }))
        ws.send(JSON.stringify({
            type: "citizen_moved",
            citizenId: id,
            position: c.position,
            rotation: c.rotation,
        }))

    // Send welcome acknowledgment
    ws.send(JSON.stringify({
        type: "welcome",
        citizenId: citizenId,
        roomCode: room.code,
        roomName: room.name,
    }))

    // Send AI citizens (shared across all rooms)
    for aiState in aiManager.getAllStates():
        ws.send(JSON.stringify({ type: "citizen_joined", ...aiState }))
        ws.send(JSON.stringify({
            type: "citizen_moved",
            citizenId: aiState.citizenId,
            position: aiState.position,
            rotation: aiState.rotation,
        }))

    // Send WebRTC peer list for voice chat setup
    peers = roomManager.getPeers(citizenId)
    if peers.length > 0:
        ws.send(JSON.stringify({ type: "voice_peers", peers }))

    // Notify room members (non-spectators create avatars)
    if not isSpectator:
        roomManager.broadcastToRoom(room, {
            type: "citizen_joined",
            citizenId: citizenId,
            name: msg.name,
            persona: msg.persona,
        }, exclude=ws)

    return citizenId


RESOLVE_ROOM(roomCode, citizenId, ws, msg):
    if roomCode and roomCode != "LOBBY0":
        result = roomManager.joinRoom(roomCode, citizenId, ws, {
            name: msg.name,
            persona: msg.persona,
            spectator: msg.spectator,
        })
        if result.error:
            // Room not found or full: fall back to lobby
            room = roomManager.getOrCreateLobby()
            roomManager.joinRoom("LOBBY0", citizenId, ws, {
                name: msg.name,
                persona: msg.persona,
                spectator: msg.spectator,
            })
            return room
        return result.room
    else:
        room = roomManager.getOrCreateLobby()
        roomManager.joinRoom("LOBBY0", citizenId, ws, {
            name: msg.name,
            persona: msg.persona,
            spectator: msg.spectator,
        })
        return room
```

### 3.2 Heartbeat and Connection Health

```
HEARTBEAT_INTERVAL = 30000    // 30 seconds

INIT_HEARTBEAT(wss):
    setInterval(():
        for ws in wss.clients:
            if ws._isAlive == false:
                // No pong received since last ping
                ws.terminate()
                continue

            ws._isAlive = false
            ws.ping()
    , HEARTBEAT_INTERVAL)

    // On each connection:
    wss.on("connection", (ws):
        ws._isAlive = true
        ws.on("pong", ():
            ws._isAlive = true
        )
    )
```

### 3.3 Reconnection

```
// Client-side reconnection (src/client/network.js):
//
// ws.onclose = ():
//     setTimeout(() => connect(name, persona), 3000)
//
// On reconnect:
// 1. Client sends 'join' with same citizenId (stored from previous welcome)
// 2. Server creates fresh state (position resets to origin)
// 3. Server sends full state burst (all current citizens)
// 4. Client resumes rendering from current state
//
// No session persistence across reconnect in V1. Position resets.
// Citizen conversation memory persists (stored in AI citizen objects,
// which survive across client connections).
```

---

## 4. Message Routing

### 4.1 Client-to-Server Dispatch

```
DISPATCH_MESSAGE(ws, msg, citizenId_ref):
    switch msg.type:

        case "join":
            citizenId_ref = HANDLE_JOIN(ws, msg)

        case "position":
            HANDLE_POSITION(ws, citizenId_ref, msg)

        case "hands":
            HANDLE_HANDS(ws, citizenId_ref, msg)

        case "voice":
            HANDLE_VOICE(ws, citizenId_ref, msg)

        case "biography_voice":
            HANDLE_BIOGRAPHY_VOICE(ws, citizenId_ref, msg)

        case "teleport":
            HANDLE_TELEPORT(ws, citizenId_ref, msg)

        case "manemus_camera":
            HANDLE_MANEMUS_CAMERA(ws, citizenId_ref, msg)

        case "signaling":
            HANDLE_SIGNALING(ws, citizenId_ref, msg)

        case "create_room":
            HANDLE_CREATE_ROOM(ws, citizenId_ref, msg)

        case "join_room":
            HANDLE_JOIN_ROOM(ws, citizenId_ref, msg)


HANDLE_POSITION(ws, citizenId, msg):
    if not citizenId: return

    citizen = citizens.get(citizenId)
    if not citizen: return

    citizen.position = msg.position
    if msg.rotation: citizen.rotation = msg.rotation
    citizen.lastUpdate = now()

    // Zone detection
    nearest = detectNearestZone(msg.position)
    if nearest.zone.id != citizen.zone:
        oldZone = citizen.zone
        citizen.zone = nearest.zone.id
        roomManager.broadcastFromCitizen(citizenId, {
            type: "citizen_zone_changed",
            citizenId: citizenId,
            oldZone: oldZone,
            newZone: nearest.zone.id,
        })

    // Broadcast position to room (exclude sender)
    roomManager.broadcastFromCitizen(citizenId, {
        type: "citizen_moved",
        citizenId: citizenId,
        position: msg.position,
        rotation: msg.rotation,
    }, exclude=ws)


HANDLE_VOICE(ws, citizenId, msg):
    if not msg.audio: return

    audioBuffer = Buffer.from(msg.audio, "base64")
    citizen = citizens.get(citizenId)

    // Step 1: Broadcast raw voice to room (other visitors hear you speak)
    roomManager.broadcastFromCitizen(citizenId, {
        type: "citizen_voice",
        citizenId: citizenId,
        name: citizen?.name or "Unknown",
        audio: msg.audio,
    }, exclude=ws)

    // Step 2: Process through STT -> LLM -> TTS pipeline (async)
    send = (obj) => roomManager.broadcastFromCitizen(citizenId, obj)

    processVoiceStreaming(audioBuffer, send).then(async (result):
        if not result?.transcription or not citizen: return

        // Step 3: Check if any AI citizen should also respond
        aiResult = await aiManager.checkProximityAndRespond(
            result.transcription,
            citizen.position,
            citizen.name or "Someone",
        )
        if aiResult:
            speakAsAICitizen(
                aiResult.citizenId,
                aiResult.citizenName,
                aiResult.text,
                aiResult.position,
                send,
            )
    )


HANDLE_SIGNALING(ws, citizenId, msg):
    // Relay WebRTC signaling to target citizen (same room only)
    if not citizenId or not msg.targetCitizenId: return

    roomManager.sendToCitizen(msg.targetCitizenId, {
        type: "signaling",
        sigType: msg.sigType,
        fromCitizenId: citizenId,
        sdp: msg.sdp,
        candidate: msg.candidate,
    })


HANDLE_TELEPORT(ws, citizenId, msg):
    if not citizenId or not msg.targetZone: return

    citizen = citizens.get(citizenId)
    targetZone = ZONES.find(z => z.id == msg.targetZone)

    if citizen and targetZone:
        citizen.position = {
            x: targetZone.position.x,
            y: 1.7,
            z: targetZone.position.z,
        }
        citizen.zone = targetZone.id
        roomManager.broadcastFromCitizen(citizenId, {
            type: "citizen_moved",
            citizenId: citizenId,
            position: citizen.position,
            rotation: citizen.rotation,
        })
```

### 4.2 Server-to-Client Broadcast

```
// Global broadcast: sends to ALL connected clients across ALL rooms
// Used only for AI citizens (shared presence)
BROADCAST(msg, exclude=null):
    data = JSON.stringify(msg)
    for client in wss.clients:
        if client != exclude and client.readyState == OPEN:
            client.send(data)


// Room-scoped broadcast: sends to citizens in the same room
BROADCAST_TO_ROOM(room, msg, excludeWs=null):
    data = JSON.stringify(msg)
    for (citizenId, member) in room.citizens:
        if member.ws != excludeWs and member.ws.readyState == OPEN:
            member.ws.send(data)


// Citizen-scoped broadcast: finds the citizen's room, broadcasts within it
BROADCAST_FROM_CITIZEN(citizenId, msg, excludeWs=null):
    room = roomManager.getRoomForCitizen(citizenId)
    if room:
        BROADCAST_TO_ROOM(room, msg, excludeWs)


// Direct send to a specific citizen by ID
SEND_TO_CITIZEN(citizenId, msg):
    code = citizenRoom.get(citizenId)
    if not code: return false
    room = rooms.get(code)
    if not room: return false
    member = room.citizens.get(citizenId)
    if member and member.ws.readyState == OPEN:
        member.ws.send(JSON.stringify(msg))
        return true
    return false
```

---

## 5. Room and Session Management

### 5.1 Room Lifecycle

```
ROOM_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
// No I/O/0/1 to avoid visual confusion

GENERATE_ROOM_CODE():
    code = ""
    for i in range(6):
        code += ROOM_CODE_CHARSET[random_int(0, len(ROOM_CODE_CHARSET))]
    return code


CREATE_ROOM(name, options):
    code = GENERATE_ROOM_CODE()
    room = {
        code: code,
        name: name or "Room " + code,
        citizens: Map(),
        maxPlayers: options.maxPlayers or 8,
        createdAt: now(),
    }
    rooms.set(code, room)
    return room


GET_OR_CREATE_LOBBY():
    if not rooms.has("LOBBY0"):
        lobby = {
            code: "LOBBY0",
            name: "Lobby",
            citizens: Map(),
            maxPlayers: 32,
            createdAt: now(),
        }
        rooms.set("LOBBY0", lobby)
    return rooms.get("LOBBY0")


JOIN_ROOM(code, citizenId, ws, citizenData):
    room = rooms.get(code)
    if not room: return { error: "room_not_found" }
    if room.citizens.size >= room.maxPlayers: return { error: "room_full" }

    // Leave current room first (clean transition)
    LEAVE_ROOM(citizenId)

    room.citizens.set(citizenId, { ws: ws, ...citizenData })
    citizenRoom.set(citizenId, code)
    return { ok: true, room: room }


LEAVE_ROOM(citizenId):
    code = citizenRoom.get(citizenId)
    if not code: return null

    room = rooms.get(code)
    if room:
        room.citizens.delete(citizenId)

        // Auto-destroy non-lobby rooms after 30s if empty
        if room.citizens.size == 0 and code != "LOBBY0":
            setTimeout(():
                r = rooms.get(code)
                if r and r.citizens.size == 0:
                    rooms.delete(code)
            , 30000)

    citizenRoom.delete(citizenId)
    return { code, room }


GET_PEERS(citizenId):
    // Returns list of non-spectator citizens in same room (for WebRTC)
    room = getRoomForCitizen(citizenId)
    if not room: return []

    peers = []
    for (id, member) in room.citizens:
        if id != citizenId and not member.spectator:
            peers.append({ citizenId: id, name: member.name })
    return peers
```

### 5.2 Disconnect Handling

```
HANDLE_DISCONNECT(ws, citizenId):
    if not citizenId: return

    // Notify room before removing
    room = roomManager.getRoomForCitizen(citizenId)
    if room:
        BROADCAST_TO_ROOM(room, {
            type: "citizen_left",
            citizenId: citizenId,
        }, exclude=ws)

    roomManager.leaveRoom(citizenId)
    citizens.delete(citizenId)
    connections.delete(ws)
```

---

## 6. Process Orchestration

### 6.1 Recurring Process Scheduler

```
INIT_PROCESSES(aiManager):
    // AI citizen behavior tick: wander, pick targets, broadcast movement
    // Every 5 seconds
    setInterval(() => aiManager.tick(), 5000)

    // Physics tick: Blood Ledger graph queries via FalkorDB
    // Every 5 minutes (not yet implemented)
    // setInterval(() => physicsBridge.tick(), 300000)

    // Airtable sync: pull citizen data, economic state, building ownership
    // Every 15 minutes (not yet implemented)
    // setInterval(() => serenissimaSync.sync(), 900000)

    // Stale citizen cleanup: remove citizens who disconnected without close
    // Every 60 seconds
    setInterval(() => CLEANUP_STALE_CITIZENS(), 60000)


AI_CITIZEN_TICK(aiManager):
    for (id, citizen) in aiManager.citizens:
        homeZone = getZoneById(citizen.homeZone)
        if not homeZone: continue

        // Pick new wander target if idle or reached current target
        if not citizen.targetPosition or REACHED_TARGET(citizen):
            angle = random() * PI * 2
            dist = random() * citizen.wanderRadius
            citizen.targetPosition = {
                x: homeZone.position.x + cos(angle) * dist,
                z: homeZone.position.z + sin(angle) * dist,
            }
            citizen.action = "wandering"

        // Move toward target
        dx = citizen.targetPosition.x - citizen.position.x
        dz = citizen.targetPosition.z - citizen.position.z
        dist = sqrt(dx*dx + dz*dz)

        if dist > 0.5:
            step = citizen.moveSpeed * 0.1    // 0.1 per tick
            factor = min(step / dist, 1.0)
            citizen.position.x += dx * factor
            citizen.position.z += dz * factor

            // Face movement direction (quaternion from yaw)
            yaw = atan2(dx, dz)
            citizen.rotation = {
                x: 0,
                y: sin(yaw / 2),
                z: 0,
                w: cos(yaw / 2),
            }

        // Gentle float bob (AI citizens hover)
        citizen.position.y = 1.2 + sin(now() * 0.001 + id.charCodeAt(3) * 0.5) * 0.3

        // Broadcast movement to all rooms (AI citizens are shared)
        BROADCAST({
            type: "citizen_moved",
            citizenId: id,
            position: citizen.position,
            rotation: citizen.rotation,
        })


REACHED_TARGET(citizen):
    if not citizen.targetPosition: return true
    dx = citizen.targetPosition.x - citizen.position.x
    dz = citizen.targetPosition.z - citizen.position.z
    return sqrt(dx*dx + dz*dz) < 1.0


CLEANUP_STALE_CITIZENS():
    staleThreshold = now() - 120000    // 2 minutes without position update
    for (id, citizen) in citizens:
        if citizen.persona == "ai": continue    // AI citizens are server-managed
        if citizen.lastUpdate < staleThreshold:
            // Find and close the WebSocket
            for (ws, wsId) in connections:
                if wsId == id:
                    ws.terminate()
                    break
            HANDLE_DISCONNECT(null, id)
```

### 6.2 Position Broadcast Throttling

```
// Target: 20Hz per citizen (50ms interval)
// Current: broadcasts every received position (acceptable for 2-3 visitors)
// Future implementation for 10+ visitors:

POSITION_THROTTLE_INTERVAL = 50    // milliseconds

INIT_POSITION_THROTTLE():
    latestPositions = Map()    // citizenId -> { position, rotation, dirty }

    setInterval(():
        for (citizenId, state) in latestPositions:
            if not state.dirty: continue
            state.dirty = false
            roomManager.broadcastFromCitizen(citizenId, {
                type: "citizen_moved",
                citizenId: citizenId,
                position: state.position,
                rotation: state.rotation,
            })
    , POSITION_THROTTLE_INTERVAL)

    return latestPositions


// In HANDLE_POSITION, replace direct broadcast with:
HANDLE_POSITION_THROTTLED(citizenId, msg):
    citizen = citizens.get(citizenId)
    citizen.position = msg.position
    citizen.rotation = msg.rotation
    citizen.lastUpdate = now()

    // Zone detection still runs immediately
    // ...

    // Store for throttled broadcast
    latestPositions.set(citizenId, {
        position: msg.position,
        rotation: msg.rotation,
        dirty: true,
    })
```

---

## 7. Rate Limiting

### 7.1 Per-Visitor Voice Rate Limiting

```
VOICE_RATE_LIMIT = {
    maxPerWindow: 1,       // max 1 voice message per window
    windowMs: 2000,        // 2-second window
    maxConcurrentLLM: 3,   // global max concurrent LLM calls
}

voiceRateState = Map()     // citizenId -> { lastVoiceTime }
globalLLMConcurrent = 0

CHECK_VOICE_RATE(citizenId):
    state = voiceRateState.get(citizenId)
    if not state:
        state = { lastVoiceTime: 0 }
        voiceRateState.set(citizenId, state)

    // Per-visitor rate check
    elapsed = now() - state.lastVoiceTime
    if elapsed < VOICE_RATE_LIMIT.windowMs:
        return { allowed: false, reason: "rate_limited" }

    // Global LLM concurrency check
    if globalLLMConcurrent >= VOICE_RATE_LIMIT.maxConcurrentLLM:
        return { allowed: false, reason: "llm_busy" }

    state.lastVoiceTime = now()
    return { allowed: true }


// Applied in HANDLE_VOICE:
HANDLE_VOICE_WITH_RATE_LIMIT(ws, citizenId, msg):
    check = CHECK_VOICE_RATE(citizenId)
    if not check.allowed:
        // Silently drop. No error message to client.
        // The citizen cooldown (10s) provides natural rate limiting
        // from the visitor's perspective.
        return

    globalLLMConcurrent += 1
    try:
        HANDLE_VOICE(ws, citizenId, msg)
    finally:
        globalLLMConcurrent -= 1
```

### 7.2 Per-Endpoint HTTP Rate Limiting

```
// Using express-rate-limit middleware (not yet implemented)
// Target configuration:

HTTP_RATE_LIMITS = {
    "/speak":    { windowMs: 5000, max: 1 },     // 1 per 5s per IP
    "/state":    { windowMs: 1000, max: 1 },     // 1 per second per IP
    "/api/*":    { windowMs: 1000, max: 10 },    // 10 per second per IP
}

APPLY_HTTP_RATE_LIMITS(app):
    for path, config in HTTP_RATE_LIMITS:
        limiter = rateLimit({
            windowMs: config.windowMs,
            max: config.max,
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res):
                res.status(429).json({
                    error: "rate_limited",
                    retryAfter: ceil(config.windowMs / 1000),
                })
        })
        app.use(path, limiter)
```

### 7.3 WebSocket Message Rate Limiting

```
WS_RATE_LIMITS = {
    "position": { minIntervalMs: 16 },    // max 60Hz per client
    "voice":    { minIntervalMs: 2000 },   // max 1 per 2 seconds
    "hands":    { minIntervalMs: 50 },     // max 20Hz per client
}

wsRateState = Map()    // ws -> Map<type, lastTime>

CHECK_WS_RATE(ws, msgType):
    typeState = wsRateState.get(ws)
    if not typeState:
        typeState = Map()
        wsRateState.set(ws, typeState)

    limit = WS_RATE_LIMITS.get(msgType)
    if not limit: return true    // no limit for this type

    lastTime = typeState.get(msgType) or 0
    if now() - lastTime < limit.minIntervalMs:
        return false    // drop silently

    typeState.set(msgType, now())
    return true
```

---

## 8. Speak Endpoint (External Voice Injection)

```
HANDLE_SPEAK_ENDPOINT(req, res):
    text = req.body.text
    speaker = req.body.speaker
    session_id = req.body.session_id

    if not text:
        return res.status(400).json({ error: "text required" })

    send = (obj) => BROADCAST(obj)

    // Phase 1: Send text immediately (clients display as subtitle)
    send({
        type: "voice_stream_start",
        transcription: "[Session " + (session_id or speaker or "") + "]",
        response: text,
        sttMs: 0,
        llmMs: 0,
        fromSession: true,
    })

    // Phase 2: Generate TTS and stream chunks
    chunksStreamed = 0
    streamedOk = false

    // Try ElevenLabs streaming TTS first
    if ELEVENLABS_API_KEY:
        ttsRes = await fetch(ELEVENLABS_STREAM_URL, {
            method: "POST",
            headers: { "xi-api-key": ELEVENLABS_API_KEY, ... },
            body: JSON.stringify({ text, model_id: "eleven_turbo_v2_5", ... }),
        })
        if ttsRes.ok:
            reader = ttsRes.body.getReader()
            while true:
                { done, value } = await reader.read()
                if done: break
                chunksStreamed += 1
                send({
                    type: "voice_stream_data",
                    chunk: Buffer.from(value).toString("base64"),
                    index: chunksStreamed,
                })
            streamedOk = chunksStreamed > 0

    // Fallback: OpenAI TTS (non-streaming)
    if not streamedOk:
        audioBuffer = await openai.audio.speech.create({
            model: "tts-1", voice: "onyx", input: text,
        })
        send({
            type: "voice_stream_data",
            chunk: audioBuffer.toString("base64"),
            index: 1,
        })
        chunksStreamed = 1

    // Phase 3: Signal stream end
    send({
        type: "voice_stream_end",
        chunks: chunksStreamed,
        latency: now() - startTime,
    })

    res.json({ ok: true, text: text.substring(0, 100) })
```

---

## 9. Graceful Shutdown Sequence

```
INIT_GRACEFUL_SHUTDOWN(httpServer, httpsServer, wss, aiManager):
    shutdownState = { shuttingDown: false, shutdownStarted: null }

    handleSignal = (signal):
        if shutdownState.shuttingDown: return
        shutdownState.shuttingDown = true
        shutdownState.shutdownStarted = now()

        // ── Step 1: Stop accepting new connections ──────────
        httpServer.close()
        if httpsServer: httpsServer.close()

        // ── Step 2: Notify all connected clients ────────────
        for client in wss.clients:
            if client.readyState == OPEN:
                client.send(JSON.stringify({
                    type: "server_shutdown",
                    message: "Server restarting, reconnect in a few seconds",
                }))

        // ── Step 3: Wait 1 second for messages to flush ─────
        setTimeout(():
            // ── Step 4: Close all WebSocket connections ──────
            for client in wss.clients:
                client.close(1001, "Server shutting down")

            // ── Step 5: Stop AI citizen tick ─────────────────
            aiManager.destroy()

            // ── Step 6: Flush pending writes ────────────────
            // (Future: flush Airtable write queue)

            // ── Step 7: Exit ────────────────────────────────
            process.exit(0)
        , 1000)

        // ── Step 8: Force exit after 5 seconds ──────────────
        setTimeout(() => process.exit(1), 5000)

    process.on("SIGTERM", handleSignal)
    process.on("SIGINT", handleSignal)
```

---

## 10. Services Proxy

```
PROXY_TO_FASTAPI(req, res):
    SERVICES_URL = process.env.CITIES_SERVICES_URL or "http://localhost:8900"

    try:
        url = SERVICES_URL + req.url
        fetchOpts = {
            method: req.method,
            headers: { "Content-Type": "application/json" },
        }

        if req.method not in ("GET", "HEAD"):
            fetchOpts.body = JSON.stringify(req.body)

        resp = await fetch(url, fetchOpts)
        data = await resp.json()
        res.status(resp.status).json(data)

    catch:
        res.status(503).json({
            error: "services_unavailable",
            message: "FastAPI services not running",
        })
```
