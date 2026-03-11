# VALIDATION -- Server

> Health checks, invariants, and acceptance criteria for the Express.js server.
> The server is the nervous system. If it fails, the world goes dark.

---

## Invariants (must ALWAYS hold)

### I1. WebSocket always available

The WebSocket endpoint at `/ws` on port 8800 (HTTP) or 8443 (HTTPS) must
accept connections at all times the server process is running. A visitor
who types the URL and presses Enter must receive a WebSocket upgrade
within 3 seconds. If the WebSocket handshake fails, the entire experience
is dead -- no rendering, no voice, no presence.

The server must never enter a state where HTTP works but WebSocket does not.
Both share the same Express process and the same port. If one is alive,
both are alive.

### I2. State broadcast within 100ms

When a citizen's position, tier, or activity changes, all room members
must receive the update within 100ms. This is the threshold for
perceptible synchronization lag in a shared 3D world. A visitor who sees
a citizen at position A while another visitor sees them at position B
(for more than 100ms) is a sync failure.

Position broadcast is throttled to 20Hz (50ms intervals) per citizen.
The 100ms invariant accounts for one full broadcast cycle plus network
transit.

### I3. Graceful shutdown completes

On SIGTERM or SIGINT, the server must:
1. Stop accepting new WebSocket connections (< 10ms)
2. Broadcast `server_shutdown` to all connected clients (< 50ms)
3. Close all existing WebSocket connections (< 100ms)
4. Flush any pending Airtable writes (< 5000ms)
5. Exit process

Total shutdown time: < 6 seconds. No client must be left with a silently
dead connection (connected but receiving no messages). Every client receives
the shutdown signal or has their connection explicitly closed.

### I4. Room-scoped broadcast

A visitor in Room A never receives position updates, voice data, or state
changes from visitors in Room B. The only exception is AI citizens, who
broadcast to all rooms (shared presence across the world). Leaking a
visitor's audio to another room is a privacy violation and a bug.

### I5. No database in the server

The server holds citizen state in memory, derived from Airtable sync and
FalkorDB queries. If the server process crashes and restarts, it must
re-sync from these external stores and reach a consistent state within
60 seconds. Zero permanent data loss. The server is a cache, not a database.

---

## Health Checks

### HC1. Connection Count

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| Active WebSocket connections  | >= 0        | `connections.size` in server state   |
| Peak connections per hour     | < 50        | V1 target; alert if unexpectedly high |
| Connection establishment time | < 1000ms    | Time from TCP handshake to `welcome` message sent |
| Connections per room          | tracked     | Room occupancy for capacity enforcement |
| Stale connections             | 0           | Connected sockets with no messages in > 5 minutes |

### HC2. Message Throughput

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| Messages received per second  | < 500       | All client-to-server messages combined |
| Messages broadcast per second | < 2000      | All server-to-client messages combined |
| Position messages per second  | < 72 per client | One per frame, throttled to 20Hz on broadcast |
| Voice messages per second     | < 0.5 per client | Push-to-talk cadence, max 1 per 2 seconds |
| Message processing latency (p50) | < 1ms    | Time from message receipt to broadcast dispatch |
| Message processing latency (p99) | < 10ms   | Spikes during voice pipeline processing |

### HC3. Memory Usage

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| RSS (Resident Set Size)       | < 512MB     | `process.memoryUsage().rss`          |
| Heap used                     | < 256MB     | `process.memoryUsage().heapUsed`     |
| Heap total                    | < 384MB     | `process.memoryUsage().heapTotal`    |
| External memory               | < 64MB      | Buffer allocations for audio/websocket |
| Memory growth rate            | < 1MB/hour  | Sustained growth indicates a leak    |
| GC pause duration (p95)       | < 5ms       | V8 garbage collection pauses         |

### HC4. Error Rate

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| Unhandled exceptions per hour | 0           | Process should never crash from unhandled error |
| WebSocket error events per hour | < 5       | Connection drops, protocol errors    |
| HTTP 5xx responses per hour   | 0           | Server errors on API endpoints       |
| Voice pipeline errors per hour | < 3        | STT/LLM/TTS failures combined       |
| Airtable sync errors per cycle | 0          | Each sync cycle should complete cleanly |
| FalkorDB query errors per hour | < 2        | Graph query failures                 |

### HC5. Reconnection Success Rate

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| Reconnection attempts per hour | tracked    | Clients reconnecting after drop      |
| Reconnection success rate     | > 95%       | Reconnections that reach `welcome` state |
| Time to reconnect (p50)       | < 2000ms    | From connection drop to new `welcome` |
| Time to reconnect (p95)       | < 5000ms    | Including backoff delay              |
| State recovery on reconnect   | 100%        | Citizen position and room membership restored |

---

## Acceptance Criteria

### AC1. Cold Start (Automated)

1. Start the server from a stopped state.
2. Measure time from process start to first successful WebSocket connection.
3. Verify `/state` HTTP endpoint returns valid JSON with citizen data.
4. Verify FalkorDB PING succeeds.
5. Verify Airtable sync completes (or gracefully degrades if Airtable is unreachable).

Pass criteria:
- WebSocket accepting connections within 5 seconds of process start
- `/state` returns 200 with `uptime > 0` within 10 seconds
- FalkorDB connected within 3 seconds (or server logs clear fallback message)
- Server is fully operational within 30 seconds

### AC2. Visitor Lifecycle (Manual)

1. Open the URL on Quest 3 browser. WebSocket connects.
2. Receive `welcome` message with assigned citizenId and roomCode.
3. Walk around. Position updates flow both ways (client -> server -> room).
4. Speak to a citizen. Voice pipeline completes. Citizen responds.
5. Close the browser tab. Server detects disconnect within 5 seconds.
6. Server broadcasts `citizen_left` for the departed visitor.
7. Re-open the URL. New connection. New `welcome`. No stale state from previous session.

Pass criteria: all 7 steps complete without error. No orphaned state from
the first session leaks into the second.

### AC3. Graceful Shutdown (Automated)

1. Connect 5 synthetic WebSocket clients.
2. Send SIGTERM to the server process.
3. All 5 clients receive `server_shutdown` message.
4. All 5 connections are closed by the server within 1 second of the signal.
5. Server process exits with code 0.

Pass criteria: all clients notified, all connections closed, clean exit.
No client left with a half-open connection that times out 30 seconds later.

### AC4. Sustained Operation (24-Hour Soak Test)

1. Run the server for 24 hours with 1 synthetic client maintaining a
   connection, sending position updates at 20Hz, and voice messages
   every 60 seconds.
2. Monitor memory, connection count, error rate, and message throughput
   continuously.

Pass criteria:
- Memory growth < 24MB over 24 hours (< 1MB/hour)
- Zero unhandled exceptions
- Zero dropped connections (excluding intentional reconnect tests)
- Message throughput stable (no degradation over time)
- CPU usage < 30% sustained (single client should not tax the server)

### AC5. Room Isolation (Automated)

1. Connect Client A to Room "ALPHA". Connect Client B to Room "BETA".
2. Client A sends a position update. Verify Client B does NOT receive it.
3. Client A sends a voice message. Verify Client B does NOT receive the
   `citizen_voice` broadcast.
4. Both clients should receive AI citizen broadcasts (shared presence).

Pass criteria: zero cross-room message leaks for visitor-originated messages.
AI citizen messages correctly broadcast to all rooms.

---

## Anti-Patterns

### AP1. Connection Leak

**Symptom:** `connections.size` grows over hours without corresponding
active visitors. Memory usage climbs. Eventually the server becomes
unresponsive.

**Detection:** Monitor `connections.size` versus active heartbeat count.
If connections exceeds heartbeat-active clients by more than 5, leaking.

**Root cause:** WebSocket `close` event not firing on certain disconnect
types (network failure without TCP FIN). Or the `close` handler not
removing the connection from the room and the global connections map.

**Fix:** Implement a heartbeat ping every 30 seconds. If a client does
not respond to 3 consecutive pings (90 seconds), force-close the connection
and clean up. Ensure the `close` handler removes the connection from all
data structures: `connections`, room membership, peer voice maps.

### AP2. Message Queue Overflow

**Symptom:** Voice responses arrive late. Position updates lag. The world
feels like it is running in slow motion.

**Detection:** Monitor the per-connection send buffer. If `ws.bufferedAmount`
exceeds 1MB for any connection, the queue is backing up.

**Root cause:** Client on a slow network cannot receive messages as fast
as the server sends them. Or the server is broadcasting too frequently
(position updates at 72Hz instead of throttled 20Hz).

**Fix:** Throttle position broadcast to 20Hz per citizen. Monitor
`bufferedAmount` per connection. If it exceeds 512KB, skip non-critical
messages (position updates) for that connection until the buffer drains.
Never skip voice or room-management messages.

### AP3. Zombie Sessions

**Symptom:** The server reports 10 connected visitors but the world
shows 0 moving avatars. Citizens are "connected" but not sending any data.

**Detection:** Connections with no received messages for > 60 seconds.
These are zombies: the TCP connection is alive but the client is gone
(tab backgrounded, browser frozen, network half-open).

**Root cause:** Quest 3 browser suspends JavaScript when the headset
goes to sleep. The WebSocket connection remains open at the TCP level
but no messages flow. When the headset wakes, the client may or may not
resume.

**Fix:** Server-side heartbeat ping (30-second interval). Three missed
pongs = connection termination. Client-side reconnection logic on wake.
Clean up all server-side state for zombie connections: remove from room,
broadcast `citizen_left`, dispose peer voice sessions.

### AP4. Broadcast Storm

**Symptom:** Network bandwidth spikes. Clients receive hundreds of
messages per second. Quest 3 browser drops frames processing incoming
WebSocket messages.

**Detection:** Measure outgoing message rate per connection. If it
exceeds 100 messages/second sustained, a storm is occurring.

**Root cause:** Position throttling disabled or broken. Or a code
change introduced a loop that broadcasts on every frame (72Hz) for
every citizen (186 citizens x 72fps = 13,392 messages/second per client).

**Fix:** Position broadcast must be throttled by the server, not the
client. Store latest position per citizen, broadcast on a 50ms timer
(20Hz). Batch citizen updates into a single message when possible
(one `citizens_moved` message with an array instead of 186 individual
`citizen_moved` messages). Maximum outgoing rate: 200 messages/second
per connection.

### AP5. Airtable Sync Cascade

**Symptom:** Server becomes unresponsive for 5-10 seconds every 15 minutes.
Voice pipeline calls time out. Position updates freeze.

**Detection:** Correlate unresponsive windows with Airtable sync timestamps.
If the freeze always coincides with the sync cycle, the sync is blocking
the event loop.

**Root cause:** Airtable sync processes hundreds of records synchronously,
blocking the Node.js event loop. `JSON.parse` of a large response, or
synchronous file writes of cached data, can block for seconds.

**Fix:** Airtable sync must be fully async. Fetch records in batches of 100.
Process each batch in a `setImmediate` callback to yield the event loop
between batches. Never use synchronous file I/O during sync. If sync takes
> 3 seconds total, log a warning. If > 10 seconds, the sync implementation
needs refactoring.

---

## Data Integrity

### Visitor State Consistency

```
AT ALL TIMES:
  - Every entry in `connections` map has a corresponding room membership
  - Every room member has an entry in `connections` map
  - No citizenId appears in two rooms simultaneously (visitor cannot be in two rooms)
  - No citizenId appears twice in the same room
  - Every connected visitor has: citizenId, name, position, roomCode

ON DISCONNECT:
  - citizenId removed from connections map
  - citizenId removed from room membership
  - `citizen_left` broadcast to room members
  - WebRTC signaling state for this citizen cleaned up
  - Voice pipeline state for this citizen cleared (no orphaned STT/LLM/TTS calls)

ON RECONNECT:
  - New citizenId assigned (or previous restored if identity persistence is implemented)
  - New room membership created
  - `citizen_joined` broadcast to room members
  - No duplicate entries from the previous connection remain
```

### Room Membership

```
PER ROOM:
  - members.size <= room.maxPlayers (capacity enforced on join)
  - All members are in the global connections map (no ghost members)
  - Room broadcast reaches exactly members.size clients (no extra, no missing)
  - AI citizens are not counted as room members (shared presence via global broadcast)

ON ROOM SWITCH:
  - Visitor removed from old room BEFORE added to new room
  - `citizen_left` sent to old room members
  - `citizen_joined` sent to new room members
  - Visitor receives `room_joined` confirmation
  - Peer voice sessions torn down for old room, established for new room

IDLE ROOM CLEANUP:
  - Rooms with 0 members for > 30 minutes are deleted
  - LOBBY0 (default room) is never deleted
  - Deleted rooms cannot be joined (return `room_error`)
```

### Process Orchestration Integrity

```
SCHEDULED PROCESSES:
  - AI citizen tick: runs every 5 seconds, completes in < 2 seconds
  - Physics tick: runs every 5 minutes, completes in < 30 seconds
  - Airtable sync: runs every 15 minutes, completes in < 60 seconds
  - State broadcast: runs every 50ms, completes in < 5ms
  - Stale cleanup: runs every 60 seconds, completes in < 100ms

FOR EACH SCHEDULED PROCESS:
  - Log start time, end time, and duration
  - If duration exceeds 2x the expected maximum, log a warning
  - If a process fails, log the error and continue (never crash the server)
  - Processes must not overlap: if a physics tick is still running when the
    next one fires, skip the new tick and log a warning
  - No process may block the event loop for > 50ms (use async I/O throughout)

ON SERVER RESTART:
  - All setInterval timers are re-created
  - Airtable sync runs immediately (do not wait 15 minutes for first sync)
  - FalkorDB connection re-established
  - In-memory citizen state rebuilt from sync data within 30 seconds
  - Server does not serve WebSocket connections until initial sync completes
```

### HTTP API Response Validation

```
GET /state:
  - Always returns 200
  - JSON body includes: uptime (number), connections (number), citizens (array)
  - citizens array length matches expected count (186 after initial sync)
  - Response time < 50ms (it is reading in-memory state, not querying anything)

GET /api/rooms:
  - Returns array of active rooms with member counts
  - LOBBY0 always present
  - No rooms with negative member counts

POST /speak:
  - Returns 200 on success, 429 on rate limit, 500 on pipeline failure
  - Response includes latency breakdown (stt_ms, llm_ms, tts_ms)
  - Rate limit: 1 request per 5 seconds per IP

ALL ENDPOINTS:
  - CORS headers present (Access-Control-Allow-Origin for Quest browser)
  - Content-Type: application/json on all JSON responses
  - No stack traces leaked in error responses (production mode)
```
