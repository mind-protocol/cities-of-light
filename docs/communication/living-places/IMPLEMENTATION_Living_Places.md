# IMPLEMENTATION: Living Places

```
STATUS: CANONICAL
PURPOSE: Where the code lives and how data flows
UPDATED: 2026-03-13
CHAIN: OBJECTIVES → PATTERNS → BEHAVIORS → ALGORITHM → VALIDATION → HEALTH → IMPLEMENTATION → SYNC
```

---

## Chain

```
OBJECTIVES:      ./OBJECTIVES_Living_Places.md
BEHAVIORS:       ./BEHAVIORS_Living_Places.md
PATTERNS:        ./PATTERNS_Living_Places.md
ALGORITHM:       ./ALGORITHM_Living_Places.md
VALIDATION:      ./VALIDATION_Living_Places.md
THIS:            IMPLEMENTATION_Living_Places.md (you are here)
HEALTH:          ./HEALTH_Living_Places.md
SYNC:            ./SYNC_Living_Places.md

IMPL:            src/server/place-server.js
                 src/server/moment-pipeline.js
                 src/server/graph-client.js
                 src/client/place.html + place-app.js + place-network.js + place-style.css
                 mind-mcp/mcp/tools/place_handler.py
                 mind-mcp/.mind/capabilities/living-places/runtime/checks.py
```

> **Contract:** Read docs before modifying. After changes: update IMPL or add TODO to SYNC.

---

## Existing Infrastructure

Living Places builds on top of the cities-of-light engine, which already provides:

| Component | File | What It Does |
|-----------|------|-------------|
| State Server | `engine/server/state-server.js` | Express + WebSocket server on port 8800 |
| Entity Manager | `engine/server/entity-manager.js` | Entity lifecycle, tier system, LLM routing |
| Voice Pipeline | `engine/server/voice-pipeline.js` | Whisper STT, ElevenLabs TTS, streaming |
| Protocol | `engine/shared/protocol.js` | Message type enums (19 server, 7 client, 5 AI) |
| Manifest Schema | `engine/shared/manifest-schema.json` | WorldManifest validation |
| Client App | `engine/client/app.js` | Manifest-driven 3D client |
| Network | `src/client/network.js` | WebSocket client with reconnection |

### What Exists vs What's Needed

**Already works:**
- WebSocket server with client tracking
- Entity spawning/despawning with broadcast
- Voice input → Whisper STT → LLM response → ElevenLabs TTS → streaming audio
- Spatial tier system (FULL/ACTIVE/AMBIENT based on distance)
- Entity movement and wander behavior
- Manifest-driven world loading

**What Living Places adds:**
- Room concept (Space node with its own participant list, separate from world entities)
- Moment Pipeline (utterance → graph persistence → broadcast, distinct from entity speak)
- MCP bridge (AI citizens join rooms via MCP tools, not entity spawning)
- Human web UI (platform meeting room, not 3D world)
- Place discovery and access control
- Conversation history and crystallization
- Multi-renderer delivery (same Moment → different presentation per client type)

---

## Code Architecture

### V1 File Structure (Actual)

```
cities-of-light/
├── src/
│   ├── server/
│   │   ├── index.js                 # MODIFIED — imports, /places/ws upgrade, Living Places init
│   │   ├── graph-client.js          # NEW — FalkorDB wrapper (falkordb npm)
│   │   ├── place-server.js          # NEW — Room state, join/leave, broadcast, HTTP notify
│   │   ├── moment-pipeline.js       # NEW — Input → Moment → graph → deliver
│   │   ├── rooms.js                 # existing — VR room manager (unchanged)
│   │   └── voice.js                 # existing — STT/TTS (reused by moment pipeline)
│   └── client/
│       ├── place.html               # NEW — Meeting room HTML page
│       ├── place-app.js             # NEW — Main app (moment rendering, input, voice)
│       ├── place-network.js         # NEW — WebSocket client for place protocol
│       └── place-style.css          # NEW — Dark theme chat layout
├── vite.config.js                   # MODIFIED — multi-page build, /places/ws proxy
└── package.json                     # MODIFIED — added falkordb + uuid deps

mind-mcp/
├── mcp/
│   ├── tools/
│   │   └── place_handler.py         # NEW — 6-action MCP tool (join/speak/listen/leave/list/create)
│   └── server.py                    # MODIFIED — registered place tool
└── .mind/
    └── capabilities/
        └── living-places/
            └── runtime/
                ├── __init__.py      # NEW
                └── checks.py        # NEW — 7 HEALTH checkers
```

---

## Component Design

### place-server.js

The Place Server manages room state in memory and coordinates with the graph for persistence.

```
PlaceServer
├── rooms: Map<space_id, RoomState>
├── connections: Map<ws, { actor_id, space_id, renderer }>
│
├── createRoom(name, capacity, access_level, ambient, creator_id)
│   → creates Space node in graph
│   → initializes in-memory RoomState
│   → returns space_id
│
├── joinRoom(actor_id, space_id, renderer, ws)
│   → validates access + capacity
│   → creates AT link in graph
│   → adds to in-memory participants
│   → delivers history (last 50 Moments)
│   → broadcasts PARTICIPANT_JOINED
│
├── leaveRoom(actor_id, space_id)
│   → removes AT link from graph
│   → removes from in-memory participants
│   → broadcasts PARTICIPANT_LEFT
│   → if last participant: mark space "empty"
│
├── getRoom(space_id) → RoomState
├── discoverPlaces(actor_id) → accessible places with metadata
└── reconcilePresence() → 30s tick, prune ghost connections
```

**RoomState (in-memory):**
```javascript
{
  space_id: "place:{uuid}",
  participants: Map(),           // actor_id → { ws, renderer, attention, position }
  moment_buffer: RingBuffer(100),
  created_at: Date
}
```

### moment-pipeline.js

The Moment Pipeline converts input into graph-persisted, broadcast Moments.

```
MomentPipeline
├── graph: GraphClient            // FalkorDB connection
├── voicePipeline: VoicePipeline  // reuse existing STT/TTS
│
├── handleInput(actor_id, space_id, input)
│   → validate presence (is actor in room?)
│   → create Moment object from input
│   → persist to graph (Moment node + IN link + CREATED link)
│   → buffer for late joiners
│   → broadcast to all participants (per-renderer delivery)
│
├── handleVoiceInput(actor_id, space_id, audio_buffer)
│   → Whisper STT → text
│   → handleInput(actor_id, space_id, { source: "voice", text })
│
└── deliverToParticipant(participant, moment)
    → switch on renderer type
    → web: JSON + optional TTS audio
    → mcp: structured JSON
    → vr: JSON + position data
    → cli: text-only
```

### mcp-bridge.js

Adapts MCP tool calls into WebSocket connections for AI citizen participation.

```
MCPBridge
├── connections: Map<actor_id, WebSocket>
│
├── connect(actor_id)
│   → create WebSocket to Place Server
│   → authenticate as actor
│   → return connection handle
│
├── join(actor_id, space_id)
│   → send JOIN message on ws
│   → start listening for Moments
│
├── speak(actor_id, space_id, text, attachments?)
│   → send SPEAK message on ws
│
├── listen(actor_id)
│   → return buffered Moments since last poll
│   → (long-poll variant: hold connection until Moment arrives)
│
└── leave(actor_id, space_id)
    → send LEAVE message on ws
    → close connection
```

---

## Protocol Extension

### New Message Types (added to protocol.js)

```javascript
const PLACE_MESSAGES = {
  // Client → Server
  PLACE_JOIN: 'place_join',           // { actor_id, space_id, renderer }
  PLACE_LEAVE: 'place_leave',        // { actor_id, space_id }
  PLACE_SPEAK: 'place_speak',        // { actor_id, space_id, content, source, attachments? }
  PLACE_VOICE: 'place_voice',        // { actor_id, space_id, audio (base64) }
  PLACE_ATTENTION: 'place_attention', // { actor_id, space_id, attention }
  PLACE_DISCOVER: 'place_discover',  // { actor_id }

  // Server → Client
  PLACE_HISTORY: 'place_history',    // { space_id, moments[] }
  PLACE_MOMENT: 'place_moment',      // { moment }
  PLACE_PARTICIPANT_JOINED: 'place_participant_joined', // { actor_id, renderer, count }
  PLACE_PARTICIPANT_LEFT: 'place_participant_left',     // { actor_id, count }
  PLACE_AUDIO: 'place_audio',        // { moment_id, audio (base64), actor_id }
  PLACE_PLACES: 'place_places',      // { places[] }
  PLACE_ERROR: 'place_error',        // { code, message }
}
```

---

## Graph Schema

### Space Node (Place)

```cypher
CREATE (p:space {
  id: "place:{uuid}",
  type: "place",
  name: "Council Chamber",
  content: "{description}",
  synthesis: "{embedding text}",
  capacity: 7,
  access_level: "invite",
  ambient_atmosphere: "formal",
  ambient_sound: "quiet",
  ambient_visual: "candlelit",
  status: "active",
  created_at: "{ISO8601}"
})
```

### Moment Node (Utterance)

```cypher
CREATE (m:moment {
  id: "moment:{uuid}",
  type: "utterance",
  content: "{text}",
  synthesis: "{embedding text}",
  source: "text",
  energy: 0.1,
  created_at: "{ISO8601}"
})
```

### Links

```cypher
// Presence: Actor AT Place
CREATE (a)-[:link {type: "AT", attention: "active", renderer: "web", joined_at: "{ISO8601}"}]->(p)

// Moment IN Place
CREATE (m)-[:link {type: "IN"}]->(p)

// Actor CREATED Moment
CREATE (a)-[:link {type: "CREATED"}]->(m)
```

---

## Data Flow

### V1: Human Types in Web UI

```
Browser → WebSocket PLACE_SPEAK { content: "Hello everyone" }
    → PlaceServer validates presence
    → MomentPipeline.handleInput()
        → Create Moment node in graph
        → Create IN link (Moment → Space)
        → Create CREATED link (Actor → Moment)
        → Buffer in RingBuffer
        → For each participant:
            → web participant: send PLACE_MOMENT via ws
            → mcp participant: send PLACE_MOMENT via ws (AI bridge)
            → cli participant: send PLACE_MOMENT via ws
```

### V1: AI Citizen Speaks via MCP

```
Claude Code session → MCP tool place_speak(space_id, text)
    → MCPBridge.speak(actor_id, space_id, text)
    → WebSocket PLACE_SPEAK to PlaceServer
    → MomentPipeline.handleInput()
        → (same flow as above)
        → web participants: receive PLACE_MOMENT
            → if voice_enabled: TTS audio generated, sent as PLACE_AUDIO
```

### V2: Human Speaks with Microphone

```
Browser → WebRTC audio stream
    → PlaceServer receives audio chunks
    → VoicePipeline.processHTTP(audio)
    → Whisper STT → text
    → MomentPipeline.handleInput(source: "voice")
        → (same flow)
        → AI participants: receive Moment as text
        → Other humans: receive text + original audio stream
```

### V3: 3D Venice Tavern

```
Same pipeline as V1/V2, plus:
    → speaker_position included in Moment
    → spatial_broadcast() applies distance attenuation
    → VR renderer positions avatar, plays spatial audio
    → Non-VR participants receive full volume (no attenuation)
```

---

## Integration Points

### With Existing Engine

The Place Server runs alongside the existing state-server.js on the same Express app:

```javascript
// engine/index.js — extended
const { createServer } = require('./server/state-server');
const { PlaceServer } = require('./server/place-server');
const { MomentPipeline } = require('./server/moment-pipeline');

const { app, wss, broadcast } = createServer(manifest);

// Place infrastructure
const placeServer = new PlaceServer(wss, graphClient);
const momentPipeline = new MomentPipeline(graphClient, voicePipeline);
placeServer.setMomentPipeline(momentPipeline);

// Place routes
app.get('/api/places', (req, res) => placeServer.handleDiscover(req, res));
app.post('/api/places', (req, res) => placeServer.handleCreate(req, res));
```

### With Graph (FalkorDB)

```javascript
// Graph client initialization
const { getDatabase } = require('mind/infrastructure/database/factory');
const graphClient = await getDatabase('falkordb', {
  host: process.env.FALKORDB_HOST,
  port: process.env.FALKORDB_PORT,
  graph: process.env.FALKORDB_GRAPH
});
```

### With MCP (mind-mcp)

MCP tools call the Place Server's HTTP API or maintain persistent WebSocket connections:

```python
# mind-mcp/runtime/tools/place_join.py
async def place_join(space_id: str) -> dict:
    """Join a place as the current AI citizen."""
    ws = await connect_place_server(actor_id=self.citizen_id)
    await ws.send(json.dumps({
        "type": "place_join",
        "actor_id": self.citizen_id,
        "space_id": space_id,
        "renderer": "mcp"
    }))
    history = await ws.recv()  # PLACE_HISTORY response
    return {"joined": space_id, "history": history["moments"]}
```

### With Platform (mind-platform)

The platform hosts the web UI for V1 meeting rooms:

```
mindprotocol.ai/places/{space_id}
    → PlaceRoom component
    → WebSocket connection to Place Server
    → MomentStream displays conversation
    → Text input creates PLACE_SPEAK messages
    → ParticipantList shows who's present
```

---

## Environment

### Required Environment Variables

```bash
# Graph database
FALKORDB_HOST=localhost
FALKORDB_PORT=6379
FALKORDB_GRAPH=mind

# Voice (reuse existing)
OPENAI_API_KEY=...          # Whisper STT
ELEVENLABS_API_KEY=...      # TTS

# Server
PLACE_SERVER_PORT=8800      # shares with state-server
PLACE_WS_PATH=/places/ws   # separate from /ws (world entities)
```

### Dependencies (additions to package.json)

```json
{
  "ioredis": "^5.x",        // FalkorDB client (Redis protocol)
  "uuid": "^9.x"            // Moment/Place ID generation
}
```

---

## Implementation Order

### Phase 1: Place Server Core (V1 minimum)

1. `engine/server/place-server.js` — Room state, join/leave, broadcast
2. `engine/server/moment-pipeline.js` — Input → Moment → graph → deliver
3. Extend `engine/shared/protocol.js` — PLACE_MESSAGES
4. HTTP endpoints on state-server for place CRUD
5. Graph integration — Space/Moment/AT node creation

### Phase 2: MCP Bridge

6. `engine/bridges/mcp-bridge.js` — WebSocket adapter for MCP
7. `mind-mcp/runtime/tools/place_*.py` — MCP tools (join, speak, leave, discover, listen)
8. Test: AI citizen joins a place, speaks, receives Moments

### Phase 3: Web UI

9. `mind-platform/components/places/PlaceRoom.tsx` — Meeting room component
10. `mind-platform/lib/place-client.js` — Browser WebSocket client
11. Platform route: `/places/{space_id}`
12. Test: Human joins from browser, sees AI Moments, types responses

### Phase 4: Voice Overlay (V1 complete)

13. Integrate existing VoicePipeline for TTS of AI Moments
14. WebRTC audio capture for human speech → Whisper STT
15. Test: Full voice loop — human speaks, AI hears text, AI responds, human hears voice

### Phase 5: Emergency Council Meeting

16. Create "Council Chamber" place (capacity: 7, access: invite)
17. Invite 6 council members + creator
18. Hold first meeting — validate everything works

---

## Markers

<!-- @mind:todo Implement place-server.js — Phase 1 -->
<!-- @mind:todo Add FalkorDB graph client to cities-of-light engine -->
<!-- @mind:proposition Consider extracting Place Server as independent npm package for reuse across worlds -->
<!-- @mind:escalation Graph client: use ioredis directly or wrap in mind runtime adapter? -->
