# PATTERNS -- Server

> Design philosophy for the Express.js server that orchestrates Venezia.
> The server is the nervous system. Every signal passes through it.

---

## Core Principle: Hub, Not Brain

The server does not think. It routes. Citizens think (Claude API). The world
evolves (Blood Ledger physics). The economy runs (Serenissima activity
processors). The server connects these systems and manages the real-time state
that clients need to render the world.

```
Airtable (economy)  ──┐
FalkorDB (narrative) ──┼──>  Express Server  ──>  WebSocket  ──>  Quest 3
Claude API (voice)   ──┘       (hub)                               (client)
```

The server's responsibilities are:

1. **WebSocket management** -- visitor connections, room-scoped broadcast,
   signaling relay for WebRTC peer voice.
2. **HTTP API** -- citizen data, voice endpoints, perception, room management.
3. **Process orchestration** -- physics tick runner, Airtable sync scheduler,
   AI citizen behavior ticks.
4. **State cache** -- in-memory representation of all citizen positions, tiers,
   moods, activities. Authoritative for rendering. Derived from Airtable sync.
5. **Session management** -- visitor identity, reconnection, room assignment.

The server does NOT:
- Run the economic simulation (that is Serenissima backend)
- Store persistent data (Airtable and FalkorDB are the stores)
- Generate narrative (Blood Ledger agents do that)
- Render anything (the client handles all 3D)

---

## Single Process Architecture

Venezia runs as a single Node.js process. No worker threads. No cluster mode.
No microservices.

### Why Single Process

- **Shared state is the product.** The server's primary value is the in-memory
  citizen state map that all WebSocket connections read from. Worker threads
  would require SharedArrayBuffer or message passing to synchronize this state.
  The complexity is not justified for the expected load.

- **Expected load is small.** V1 is single-player (one visitor). Even with
  future multiplayer, the target is 5-10 simultaneous visitors, not 10,000.
  A single Node.js process handles 10,000+ WebSocket connections trivially.
  The bottleneck will be Claude API calls, not server compute.

- **Debugging is simpler.** One process, one log stream, one stack trace. The
  orchestration of physics ticks, sync cycles, and AI behavior ticks is complex
  enough without adding inter-process communication.

### When to Reconsider

Move to worker threads or a separate process if:
- Physics tick computation exceeds 100ms (blocks the event loop)
- Airtable sync processing blocks WebSocket message handling
- CPU profiling shows the event loop is saturated

The likely first bottleneck is the physics tick. If FalkorDB graph queries
take too long, the physics bridge should move to a child process communicating
via IPC. But measure first.

---

## WebSocket Protocol

All real-time communication uses a single WebSocket endpoint at `/ws` on the
same port as HTTP (8800 for HTTP, 8443 for HTTPS). No separate voice server.
No Socket.io.

### Why Raw WebSocket, Not Socket.io

- **Bundle size.** Socket.io adds ~40KB to the client. On Quest 3, every KB
  of JavaScript is parse time.
- **No fallback needed.** WebSocket is supported on every target platform
  (Quest browser, Chrome, Firefox, Safari). Socket.io's long-polling fallback
  is dead weight.
- **Transparency.** Raw WebSocket messages are JSON strings. Easy to log, debug,
  replay. Socket.io's event abstraction hides the wire format.
- **Room scoping** is implemented in `rooms.js` already. Socket.io's room
  feature is not needed.

### Message Format

Every WebSocket message is a JSON object with a `type` field:

```json
{ "type": "message_type", ...payload }
```

No binary framing. No message IDs. No acknowledgments. This is a broadcast
medium, not a reliable channel. If a message is lost, the next state update
will correct it.

### Message Categories

**Client -> Server:**

| Type               | Payload                              | Purpose                    |
|--------------------|--------------------------------------|----------------------------|
| `join`             | citizenId, name, persona, roomCode   | Enter the world            |
| `position`         | position, rotation                   | Per-frame movement sync    |
| `hands`            | hands (joint data)                   | VR hand tracking           |
| `voice`            | audio (base64 webm)                  | Push-to-talk speech        |
| `biography_voice`  | audio, donorId                       | Biography archive query    |
| `teleport`         | targetZone                           | Waypoint teleport          |
| `signaling`        | sigType, targetCitizenId, sdp/candidate | WebRTC negotiation      |
| `create_room`      | name, maxPlayers                     | Create a private room      |
| `join_room`        | roomCode                             | Switch rooms               |

**Server -> Client:**

| Type                  | Payload                                      | Purpose                    |
|-----------------------|----------------------------------------------|----------------------------|
| `welcome`             | citizenId, roomCode, roomName                | Connection confirmed       |
| `citizen_joined`      | citizenId, name, persona                     | New avatar to render       |
| `citizen_moved`       | citizenId, position, rotation                | Position update            |
| `citizen_left`        | citizenId                                    | Remove avatar              |
| `citizen_zone_changed`| citizenId, oldZone, newZone                  | District transition        |
| `citizen_hands`       | citizenId, hands                             | Hand tracking data         |
| `citizen_voice`       | citizenId, name, audio                       | Raw mic broadcast          |
| `voice_stream_start`  | transcription, response, sttMs, llmMs        | TTS stream beginning       |
| `voice_stream_data`   | chunk, index                                 | TTS audio chunk            |
| `voice_stream_end`    | chunks, latency                              | TTS stream complete        |
| `ai_citizen_speak`    | citizenId, citizenName, text, position       | AI citizen text (for spatial TTS) |
| `voice_peers`         | peers[]                                      | WebRTC peer list           |
| `signaling`           | sigType, fromCitizenId, sdp/candidate        | WebRTC relay               |
| `room_joined`         | roomCode, roomName                           | Room switch confirmed      |
| `room_error`          | error                                        | Room join failure          |

### Position Sync Rate

Clients send `position` messages at render framerate (72fps on Quest). This is
too frequent for broadcast. The server should throttle broadcast to 20Hz (every
50ms) per citizen. Store the latest position, broadcast on a 50ms interval.

Not yet implemented. Current behavior broadcasts every received position to
all room members. Acceptable for 2-3 visitors. Will cause bandwidth issues
at 10+ visitors.

---

## Room System

Rooms scope all broadcast. A visitor in Room A does not receive position
updates for visitors in Room B. AI citizens are the exception -- they broadcast
to all rooms (shared presence).

### Room Model

- **LOBBY0**: default room, auto-created on server start
- **Named rooms**: created via `create_room`, identified by 6-character code
- **Room membership**: one visitor per room at a time, switching is instant
- **Peer voice**: WebRTC signaling is relayed only within the same room

### Scaling Concern

The current room system holds all rooms in memory in a single Map. This is fine
for V1 (single-player, one room). For multiplayer, rooms need:
- Max capacity enforcement (already present in RoomManager)
- Idle room cleanup (rooms with no visitors for 30 minutes)
- Room list pagination for the `/api/rooms` endpoint

---

## Auth Model: None (V1)

V1 has no authentication. Anyone who connects gets a visitor identity. The
`citizenId` is generated client-side or assigned on join. There are no accounts,
no passwords, no tokens.

### Why No Auth

- **Friction kills immersion.** The visitor puts on a headset and enters Venice.
  A login screen in VR is hostile.
- **No persistent visitor state (V1).** The visitor has no inventory, no
  progression, no saved data. There is nothing to protect.
- **Single-player.** With one visitor at a time, impersonation is irrelevant.

### When Auth Becomes Necessary

- **Multiplayer.** When multiple visitors exist, identity must be persistent
  (so citizens remember you across sessions) and verifiable (so visitor A
  cannot impersonate visitor B).
- **Persistent relationships.** When citizen trust scores are keyed to visitor
  identity, that identity must survive across browser sessions.
- **Proposed approach:** Anonymous keypair generated on first visit, stored in
  localStorage. No email, no password. The keypair IS the identity. Server
  validates signatures on sensitive operations. This is the Web3-native approach
  and aligns with the eventual Solana integration.

---

## Rate Limiting

### LLM Calls

The most expensive operation the server performs is routing speech to the Claude
API (or GPT-4o for voice). Each call costs money and takes ~1 second.

Rate limits:
- **Per-visitor:** max 1 concurrent LLM call. Queue subsequent requests.
- **Global:** max 3 concurrent LLM calls (1 visitor + 2 ambient citizen
  conversations). Beyond this, ambient conversations are skipped.
- **Citizen cooldown:** 10 seconds between responses from the same citizen
  (already implemented in `ai-citizens.js`).

### WebSocket Messages

No rate limiting on WebSocket messages currently. For multiplayer:
- **Position messages:** accept at most 1 per 16ms (60Hz) per client.
  Drop excess silently.
- **Voice messages:** accept at most 1 per 2 seconds per client.
  Reject excess with a `rate_limited` message.

### HTTP Endpoints

No rate limiting on HTTP endpoints currently. For production:
- `/speak`: 1 request per 5 seconds per IP
- `/state`: 1 request per second per IP
- `/api/*`: 10 requests per second per IP

Use `express-rate-limit` middleware. Not yet added.

---

## Process Management

The server orchestrates several recurring processes:

| Process            | Interval | Current State | Venezia Addition           |
|--------------------|----------|---------------|----------------------------|
| AI citizen tick    | 5s       | Working       | Scale from 3 to 152 citizens |
| Physics tick       | 5min     | Not built     | Blood Ledger physics_tick()  |
| Airtable sync      | 15min    | Not built     | serenissima-sync.js          |
| State broadcast    | 50ms     | Not built     | Throttled position relay     |
| Stale cleanup      | 60s      | Not built     | Remove disconnected citizens |

All processes run as `setInterval` timers in the main event loop. No external
schedulers, no cron. The server process is the scheduler.

### Graceful Shutdown

On SIGTERM/SIGINT:
1. Stop accepting new WebSocket connections
2. Broadcast `server_shutdown` to all connected clients
3. Close all WebSocket connections
4. Flush any pending Airtable writes
5. Exit

Not yet implemented. Current behavior: process dies, clients see WebSocket
close, no cleanup.

---

## The Non-Negotiables

1. **Single WebSocket endpoint.** No fragmented transport. Everything flows
   through `/ws` on port 8800/8443. Adding a second WebSocket server for voice
   or state is architectural debt that compounds.

2. **JSON messages, always.** No binary protocol, no Protobuf, no MessagePack.
   JSON is debuggable. The performance cost is negligible at this scale.

3. **Room-scoped broadcast.** Every message goes to room members only, never
   globally. The `broadcast()` function is for AI citizens only (shared
   presence). All visitor-originated messages route through `broadcastFromCitizen`
   or `broadcastToRoom`.

4. **No database in the server.** The server is a cache. Airtable is the
   database. FalkorDB is the graph. If the server crashes and restarts, it
   re-syncs from Airtable and FalkorDB. Zero data loss.

5. **HTTPS is mandatory for production.** WebXR requires secure context.
   `getUserMedia` (microphone) requires secure context. The entire experience
   breaks on plain HTTP in production. Self-signed certs are acceptable for
   local development; production uses proper TLS.
