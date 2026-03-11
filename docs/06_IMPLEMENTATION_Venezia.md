# IMPLEMENTATION: Venezia — Code Architecture

Where code lives. How data flows. What connects to what.

---

## Repository Map

```
cities-of-light/                     ← THIS REPO (spatial substrate)
├── src/
│   ├── client/                      ← Three.js + WebXR frontend
│   │   ├── main.js                  ← Entry point, scene setup, XR session
│   │   ├── scene.js                 ← District/island generation, terrain
│   │   ├── venice/                  ← NEW: Venice-specific world generation
│   │   │   ├── district-generator.js    ← Procedural Venice district meshes
│   │   │   ├── canal-system.js          ← Water, bridges, fondamenta
│   │   │   ├── building-generator.js    ← Venetian architecture from Airtable data
│   │   │   └── props.js                 ← Market stalls, boats, lanterns, etc.
│   │   ├── citizens/                ← NEW: Citizen rendering and behavior
│   │   │   ├── citizen-manager.js       ← Tier assignment, spawn/despawn, LOD
│   │   │   ├── citizen-avatar.js        ← 3D body, animation, mood expression
│   │   │   ├── citizen-voice.js         ← Spatial TTS playback per citizen
│   │   │   └── citizen-awareness.js     ← Proximity detection, gaze tracking
│   │   ├── atmosphere/              ← NEW: World mood rendering
│   │   │   ├── day-night.js             ← Time-of-day lighting cycle
│   │   │   ├── weather.js               ← Fog, rain, particle effects
│   │   │   └── district-mood.js         ← Atmosphere from citizen mood aggregate
│   │   ├── avatar.js                ← Visitor avatar (hand tracking, body)
│   │   ├── camera-body.js           ← EXISTING: camera rig
│   │   ├── vr-controls.js           ← EXISTING: locomotion (extend for Venice)
│   │   ├── voice-chat.js            ← EXISTING: STT/TTS (extend for citizens)
│   │   └── zone-ambient.js          ← EXISTING: ambient sound (extend for districts)
│   ├── server/
│   │   ├── index.js                 ← EXISTING: Express + WS server
│   │   ├── venice-state.js          ← NEW: Venice world state manager
│   │   ├── citizen-router.js        ← NEW: Citizen conversation routing
│   │   ├── physics-bridge.js        ← NEW: Blood Ledger physics tick runner
│   │   └── serenissima-sync.js      ← NEW: Airtable data sync
│   └── shared/
│       ├── zones.js                 ← EXISTING: zone definitions (extend for Venice)
│       └── districts.js             ← NEW: Venice district definitions
├── services/                        ← EXISTING: FastAPI backend
│   ├── app.py                       ← EXISTING: main FastAPI app
│   ├── consent/                     ← EXISTING: consent framework
│   └── vault/                       ← EXISTING: media vault
├── docs/                            ← THIS DOCUMENTATION
└── data/                            ← World data, citizen exports

serenissima/                         ← EXTERNAL: citizen simulation
├── backend/
│   ├── engine/                      ← Activity processors, stratagems
│   └── the-code/                    ← KinOS consciousness integration
├── citizens/                        ← 186 citizen directories with .cascade/ memory
└── (Airtable)                       ← Primary data store (CITIZENS, BUILDINGS, etc.)

the-blood-ledger/                    ← EXTERNAL: narrative physics
├── engine/
│   ├── physics/                     ← Graph operations, embeddings
│   └── infrastructure/              ← API server, services
├── agents/
│   ├── narrator/                    ← Scene/dialogue generation
│   ├── world-builder/               ← JIT content creation
│   └── world_runner/                ← Background world advancement
└── data/world/                      ← Graph seed data (characters, narratives, places)
```

---

## Data Flow Architecture

```
                    ┌──────────────────┐
                    │   VISITOR (VR)   │
                    │  Quest 3 / Web   │
                    └────────┬─────────┘
                             │ WebSocket + HTTP
                             ▼
                    ┌──────────────────┐
                    │  EXPRESS SERVER   │
                    │  (cities-of-light│
                    │   /src/server/)  │
                    ├──────────────────┤
                    │ venice-state.js  │ ← World state in memory
                    │ citizen-router.js│ ← Routes speech to correct citizen
                    │ physics-bridge.js│ ← Runs Blood Ledger tick
                    │ serenissima-     │ ← Syncs Airtable every 15min
                    │   sync.js        │
                    └──┬─────┬─────┬───┘
                       │     │     │
          ┌────────────┘     │     └────────────┐
          ▼                  ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
│  AIRTABLE    │   │  FALKORDB    │   │  CLAUDE API      │
│  (Serenissima│   │  (Blood      │   │  (Citizen voice)  │
│   data)      │   │   Ledger     │   │                   │
│              │   │   graph)     │   │  KinOS context    │
│ CITIZENS     │   │              │   │  → response       │
│ BUILDINGS    │   │ Characters   │   │  → TTS            │
│ CONTRACTS    │   │ Narratives   │   │                   │
│ ACTIVITIES   │   │ Tensions     │   │  Narrator agent   │
│ RELATIONSHIPS│   │ Moments      │   │  → event text     │
│ GRIEVANCES   │   │ Places       │   │                   │
└──────────────┘   └──────────────┘   └──────────────────┘
```

---

## Sync Strategy

### Airtable → Express Server (every 15 minutes)
```
serenissima-sync.js:
  1. Fetch all CITIZENS (position, ducats, mood, activity, class)
  2. Fetch all BUILDINGS (position, type, category, owner)
  3. Fetch all active CONTRACTS (buyer, seller, resource, price)
  4. Fetch recent ACTIVITIES (last 30 min, for movement paths)
  5. Fetch RELATIONSHIPS (trust scores for conversation context)
  6. Store in venice-state.js memory cache
  7. Diff with previous state → generate change events
  8. Broadcast changes to connected clients via WebSocket
```

### Blood Ledger Graph ← Serenissima Data (on sync)
```
physics-bridge.js:
  1. For each citizen in Airtable:
     - Ensure Character node exists in FalkorDB
     - Update energy based on recent activity (active citizens pump more)
     - Update weight based on wealth + social class
  2. For each active tension/grievance:
     - Ensure Narrative nodes and TENSION edges exist
     - Update energy based on support count
  3. Run physics_tick()
  4. Check for Moment flips → generate world events
```

### Citizen Memory (filesystem-based, on conversation)
```
citizen-router.js:
  1. Visitor speaks → STT → text
  2. Identify target citizen (nearest FULL-tier citizen facing visitor)
  3. Load citizen context:
     a. From Airtable: economic state, mood, activity
     b. From .cascade/: last 10 memories involving this visitor
     c. From FalkorDB: active beliefs (BELIEVES edges)
     d. From venice-state.js: recent district events
  4. Send to Claude API with citizen's CLAUDE.md system prompt
  5. Receive response
  6. Write to citizen's .cascade/memories/ (append-only)
  7. Update trust score in Airtable RELATIONSHIPS
  8. Send response audio to client (TTS → WebSocket binary)
```

---

## Performance Budget (Quest 3)

| Resource | Budget | Strategy |
|---|---|---|
| Draw calls | < 200 per frame | Instance buildings, batch ambient citizens |
| Triangles | < 500K visible | LOD on buildings, simple citizen geometry |
| Textures | < 256MB VRAM | Atlas textures, procedural materials |
| JS heap | < 512MB | Dispose off-screen, pool geometries |
| Frame time | < 14ms (72fps) | Tier culling, frustum culling, occlusion |
| Network | < 50KB/s | Delta sync only, compress positions |
| Audio sources | < 32 simultaneous | Priority queue: FULL > ACTIVE > ambient |
| LLM calls | < 1/second | Queue conversations, debounce STT |

---

## Key Interfaces

### Client ← Server WebSocket Messages
```typescript
// Server → Client
{ type: "citizen_update", data: { id, position, tier, mood, activity } }
{ type: "citizen_speak", data: { id, audioBuffer, duration, text? } }
{ type: "world_event", data: { type, location, severity, description } }
{ type: "atmosphere_update", data: { district, fog, light, particles } }
{ type: "time_update", data: { hour, dayPhase, weather } }

// Client → Server
{ type: "visitor_position", data: { position, rotation } }
{ type: "visitor_speech", data: { audioBlob, targetCitizenId? } }
{ type: "visitor_entered_district", data: { districtId } }
```

### Server → Claude API (Citizen Conversation)
```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 300,
  "system": "<citizen CLAUDE.md system prompt>",
  "messages": [
    { "role": "user", "content": "<assembled context + visitor speech>" }
  ]
}
```

---

## Deployment

### Development
```
cities-of-light server:  localhost:8800  (Express + WS)
FalkorDB:                localhost:6379  (Docker)
FalkorDB browser:        localhost:3002  (built-in)
Serenissima backend:     Airtable API    (cloud, already running)
```

### Production
```
cities-of-light:  Render (or self-hosted for GPU/VR perf)
FalkorDB:         Docker on same host (low latency for physics tick)
Domain:           citiesoflight.ai or sub of mindprotocol.ai
SSL:              Required for WebXR (browsers require HTTPS for XR)
```
