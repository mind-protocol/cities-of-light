# SYNC -- Server

> Current state of the Express.js server infrastructure in Cities of Light.
> What exists, what needs extending, what must be built for Venezia.

---

## What Exists in Cities of Light

The server is a single Express.js + WebSocket process running on port 8800
(HTTP) and 8443 (HTTPS, self-signed). It handles visitor connections, position
sync, voice pipeline, AI citizen behavior, and room management.

### Server Core

| File                         | Status  | Function                                    |
|------------------------------|---------|---------------------------------------------|
| `src/server/index.js`        | Working | Express app + WebSocket server, message routing, room management, AI citizen tick |
| `src/server/rooms.js`        | Working | Room creation, join/leave, scoped broadcast, peer lists for WebRTC signaling |
| `src/server/voice.js`        | Working | STT (Whisper) + LLM (GPT-4o) + TTS (ElevenLabs streaming) with OpenAI fallback |
| `src/server/biography-voice.js` | Working | Biography archive voice query pipeline |
| `src/server/ai-citizens.js`  | Working | 3 AI citizens (VOX, LYRA, PITCH): personality, wander, proximity response |
| `src/server/perception.js`   | Working | Perception pipeline routes (frame data for AI processing) |

**`index.js` current capabilities:**
- Express middleware: JSON body parsing (10MB limit), COOP/COEP headers,
  Permissions-Policy for WebXR + mic + camera
- HTTP routes: `/state`, `/perception/:citizenId`, `/api/zones`, `/api/rooms`,
  `/speak`, `/services` proxy to FastAPI, `/vault-media` static serving
- WebSocket upgrade handler at `/ws` path (raw ws, not Socket.io)
- Full message switch: join, position, hands, voice, biography_voice, teleport,
  signaling, create_room, join_room, manemus_camera
- Room-scoped broadcast for all visitor messages
- Global broadcast for AI citizen state (shared across rooms)
- HTTPS server with self-signed certs from `/tmp/cities-cert.pem`
- Citizen state Map: id -> position, rotation, name, persona, zone, lastUpdate
- Zone detection on position updates (broadcasts zone_changed events)

**`rooms.js` current capabilities:**
- LOBBY0 default room, auto-created
- 6-character room codes, max player enforcement
- `broadcastToRoom()`, `broadcastFromCitizen()`, `sendToCitizen()`
- Peer list generation for WebRTC voice setup
- Room cleanup on citizen leave

**`ai-citizens.js` current capabilities:**
- 3 hardcoded citizens with personality system prompts and home positions
- 5-second behavior tick: random wander within zone radius
- `checkProximityAndRespond()`: 15m range, 10s cooldown, nearest-citizen
  selection, GPT-4o call, per-citizen 10-turn conversation history
- Broadcast movement and state to all connected clients

---

## What Needs Venice-Specific Work

### 1. Scaling AI Citizens from 3 to 186

The current `ai-citizens.js` holds 3 citizens in a hardcoded array, each with
a full system prompt in memory. For 186 citizens:

**Required:**
- Load citizen definitions from Airtable data (via serenissima-sync)
- On-demand system prompt assembly (load from `.cascade/` + Airtable state
  only when a citizen is activated by proximity)
- Tier-based activation: only FULL-tier citizens (closest ~20) get LLM calls;
  ACTIVE-tier get simplified responses; AMBIENT-tier only wander
- Conversation history: persist to disk, load on proximity trigger
- Behavior tick scaling: 186 citizens x 5s tick = 37 updates/s. Current
  broadcast-all-positions pattern will flood WebSocket at this scale

**Estimated effort:** 5-7 days

### 2. Venice State Manager

The server needs a centralized state manager that holds the in-memory cache
of all Venice data synced from Airtable.

**Required:**
- `venice-state.js`: stores citizen positions, moods, activities, buildings,
  contracts, relationships in memory
- Diff computation on sync: detect what changed, generate WebSocket events
- Queryable by other modules: citizen-router asks for citizen state,
  physics-bridge asks for tension data, embodiment system asks for appearance

**Estimated effort:** 3-4 days

### 3. Physics Bridge

The Blood Ledger physics tick needs to run on a server-side interval,
reading from FalkorDB and writing back.

**Required:**
- `physics-bridge.js`: connect to FalkorDB (localhost:6379), run physics_tick()
  every 5 minutes
- Seed graph from Airtable citizen data (Character nodes, Narrative nodes)
- Detect Moment flips -> emit world_event messages to connected clients
- Energy injection from economic activity data

**Estimated effort:** 5-7 days

### 4. Serenissima Sync

Bidirectional sync between Airtable and the server's in-memory cache.

**Required:**
- `serenissima-sync.js`: pull CITIZENS, BUILDINGS, CONTRACTS, ACTIVITIES,
  RELATIONSHIPS every 15 minutes
- Push citizen memory updates and trust scores back to Airtable
- Respect Airtable rate limits (5 requests/second)
- Generate change events for WebSocket broadcast

**Estimated effort:** 3-5 days

### 5. Citizen Conversation Router

Route visitor speech to the correct citizen's LLM context.

**Required:**
- `citizen-router.js`: identify target citizen (nearest FULL-tier facing
  visitor), assemble context (Airtable + .cascade/ + FalkorDB beliefs +
  recent events), call Claude API, write memory, update trust
- Different from current `ai-citizens.js` which uses GPT-4o for fast voice
  responses. The citizen router uses Claude for deep, personality-consistent
  conversation with full economic/social context

**Estimated effort:** 5-7 days

### 6. Throttled Position Broadcast

Current behavior: every position message is rebroadcast immediately.
At 72fps x 10 visitors = 720 messages/second broadcast to all peers.

**Required:**
- Buffer latest position per citizen
- Broadcast on 50ms interval (20Hz): for each citizen with a position update
  since last broadcast, send one message
- Reduces broadcast volume by ~70% at 72fps

**Estimated effort:** 1 day

### 7. Graceful Shutdown

No shutdown handling exists. Server kill leaves clients with broken WebSocket.

**Required:**
- SIGTERM/SIGINT handler
- Broadcast `server_shutdown` to all clients
- Close all WebSocket connections cleanly
- Flush pending Airtable writes
- process.exit(0)

**Estimated effort:** 0.5 day

---

## Architecture: Current vs Target

```
CURRENT                                TARGET (Venezia)
=======                                ==================

index.js                               index.js
  - Express + WS                         - Express + WS
  - 5 HTTP routes                        - 10+ HTTP routes (add citizen, event, sync)
  - 10 WS message types                  - 15+ WS message types (add citizen_update,
  - 3 AI citizens in memory                world_event, atmosphere_update, time_update)
  - No external data sources             - venice-state.js (Airtable cache)
  - No physics                           - physics-bridge.js (FalkorDB tick)
  - No sync                              - serenissima-sync.js (Airtable pull/push)
  - No rate limiting                     - citizen-router.js (Claude API conversation)
  - No shutdown handling                 - Rate limiting + throttled broadcast
                                         - Graceful shutdown
```

---

## Deployment Notes

- **Dev:** `node src/server/index.js` on localhost:8800, HTTPS on 8443
- **HTTPS cert:** Self-signed, generated to `/tmp/cities-cert.pem` and
  `/tmp/cities-key.pem`. Required for Quest mic access.
- **API keys:** Loaded from Manemus `.env` file at
  `/home/mind-protocol/manemus/.env` (OPENAI_API_KEY, ELEVENLABS_API_KEY,
  ELEVENLABS_VOICE_ID)
- **Services proxy:** `/services/*` proxied to FastAPI on port 8900
  (consent framework, media vault). Returns 503 if FastAPI is not running.
- **FalkorDB:** Not yet connected. Available via Docker on localhost:6379
  when running. The physics bridge will need connection config.

---

## Priority Roadmap

| Priority | Task                          | Blocks                          | Effort  |
|----------|-------------------------------|---------------------------------|---------|
| P0       | Venice state manager          | All Venice-specific rendering   | 3-4 days |
| P0       | Serenissima sync              | State manager has no data       | 3-5 days |
| P1       | Citizen conversation router   | Citizens cannot have deep conversations | 5-7 days |
| P1       | AI citizen scaling (186)      | World has only 3 citizens       | 5-7 days |
| P2       | Physics bridge                | No narrative emergence          | 5-7 days |
| P2       | Throttled position broadcast  | Bandwidth issues at 10+ visitors | 1 day   |
| P3       | Rate limiting                 | Vulnerable to abuse             | 1 day   |
| P3       | Graceful shutdown             | Dirty disconnects               | 0.5 day |
