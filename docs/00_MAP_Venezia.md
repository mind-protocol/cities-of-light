# MAP: Venezia — Areas, Modules & Documentation Plan

## Architecture Overview

```
venezia/
├── world/           3D Venice environment
│   ├── districts        Procedural canals, buildings, bridges, props
│   ├── atmosphere       Day/night, weather, fog, mood-driven ambiance
│   └── navigation       Locomotion (desktop + VR), district transitions
│
├── citizens/        186 AI citizen system
│   ├── embodiment       3D rendering: avatars, tiers, LOD, animation
│   ├── mind             Conversation: context assembly, KinOS, memory
│   └── population       Spawn/despawn, tier assignment, crowd simulation
│
├── narrative/       Blood Ledger physics + events
│   ├── graph            FalkorDB schema, seeding from Serenissima
│   ├── physics          Energy/decay/tension tick, Moment flips
│   └── events           World events: generation, propagation, 3D effects
│
├── economy/         Serenissima economic layer
│   ├── simulation       Activity processor, production, trade, stratagems
│   ├── sync             Airtable ↔ server bidirectional data sync
│   └── governance       Grievances, councils, political emergence
│
├── voice/           Full speech pipeline
│   ├── pipeline         STT (Whisper) → routing → TTS (ElevenLabs)
│   └── spatial          HRTF, attenuation, ambient layers, voice diversity
│
└── infra/           Server, deployment, performance
    ├── server           Express.js, WebSocket, API routing
    ├── performance      LOD, culling, memory management, Quest 3 budget
    └── deployment       Render, SSL, domain, monitoring
```

**6 areas, 17 modules.**

---

## Module Detail

### WORLD — 3D Venice Environment

#### world/districts
**Responsibility:** Generate the physical Venice — canals, fondamenta, buildings, bridges, market stalls, boats, lanterns. Transform Serenissima geo coordinates + building data into navigable 3D geometry.
**Key decisions:** Procedural vs. GIS-based layout. Venetian architectural style. LOD strategy for buildings. Water rendering.
**Depends on:** economy/sync (building data from Airtable), infra/performance (triangle budgets)
**Entry points:** `src/client/venice/district-generator.js`, `src/client/venice/canal-system.js`, `src/client/venice/building-generator.js`

#### world/atmosphere
**Responsibility:** Make Venice feel alive through non-citizen environmental systems. Time of day (light, shadows), weather (fog, rain), district mood (ambient shifts driven by citizen mood aggregate), ambient particles.
**Key decisions:** Real-time vs. accelerated day/night cycle. Biometric integration (Garmin stress → world tint). Season system.
**Depends on:** citizens/population (mood aggregate), narrative/events (tension → atmosphere shift)
**Entry points:** `src/client/atmosphere/day-night.js`, `src/client/atmosphere/weather.js`, `src/client/atmosphere/district-mood.js`

#### world/navigation
**Responsibility:** How the visitor moves through Venice. Desktop (WASD + mouse), VR (hand teleport, continuous thumbstick). District transitions (audio crossfade, fog gates). Gondola transport (scenic, non-interactive V1).
**Key decisions:** Movement speed (walking only vs. run option). Teleport vs. continuous locomotion in VR. Comfort settings (vignette, snap turn).
**Depends on:** world/districts (walkable surfaces, bridge colliders)
**Entry points:** `src/client/vr-controls.js` (extend existing), `src/client/venice/transitions.js`

---

### CITIZENS — 186 AI Citizen System

#### citizens/embodiment
**Responsibility:** Visual representation of citizens in 3D. Avatar generation from personality/class. 3-tier LOD system (FULL: detailed + lip sync, ACTIVE: simplified + posture, AMBIENT: silhouette + drift). Mood expression through animation and posture. Social class visual markers (clothing, accessories).
**Key decisions:** Avatar generation method (procedural, parametric, or AI-generated textures). Number of base models × customization parameters. Animation system (skeletal vs. morph targets). Memory budget per citizen.
**Depends on:** citizens/population (tier assignment), economy/sync (citizen appearance data)
**Entry points:** `src/client/citizens/citizen-avatar.js`, `src/client/citizens/citizen-manager.js`

#### citizens/mind
**Responsibility:** The inner life of a citizen during conversation. Context assembly (Airtable state + .cascade/ memory + FalkorDB beliefs + recent events). LLM call (Claude API with citizen's CLAUDE.md prompt). Response processing. Memory persistence (write encounter to .cascade/). Trust score update. Personality-consistent behavior.
**Key decisions:** Context window budget (how much history per conversation). Memory pruning strategy. Voice persona consistency. Lie/omission logic (citizens don't always tell truth). Emotional escalation model.
**Depends on:** economy/sync (citizen state), narrative/graph (beliefs), voice/pipeline (input/output)
**Entry points:** `src/server/citizen-router.js`, citizen `.cascade/` directories

#### citizens/population
**Responsibility:** Managing 186 citizens at scale. Tier assignment algorithm (distance × relationship × activity importance). Spawn/despawn lifecycle as visitor moves through districts. Daily rhythm scheduling (which citizens are where, when). Ambient crowd behavior (random walk, murmur audio contribution). Population density per district per time of day.
**Key decisions:** Max FULL-tier citizens simultaneously (performance constraint). Tier transition smoothness (no pop-in). Crowd density targets. Off-screen citizen simulation granularity.
**Depends on:** economy/sync (citizen positions, activities), infra/performance (render budget)
**Entry points:** `src/client/citizens/citizen-manager.js`, `src/server/venice-state.js`

---

### NARRATIVE — Blood Ledger Physics + Events

#### narrative/graph
**Responsibility:** The FalkorDB graph that stores the narrative state of Venice. Schema definition (Character, Narrative, Moment, Place nodes + BELIEVES, TENSION, SUPPORTS edges). Seeding pipeline: transform 186 Serenissima citizens into Character nodes, grievances into Narrative/Tension nodes, districts into Place nodes. Graph queries for citizen context assembly.
**Key decisions:** Graph schema extensions for Serenissima-specific data. Node creation/deletion policy (append-only? pruning?). Query patterns for conversation context. Graph size limits.
**Depends on:** economy/sync (source data from Airtable)
**Entry points:** `src/server/physics-bridge.js`, Blood Ledger `engine/physics/graph/`

#### narrative/physics
**Responsibility:** The core emergence engine. Energy pumping (citizens → beliefs), energy routing (supports/contradicts), decay (DECAY_RATE = 0.02), tension accumulation, Moment flip detection (salience > threshold). Runs on a 5-minute tick. The physics IS the scheduling — no cron jobs, no event queues.
**Key decisions:** Tick interval (5min? configurable?). Decay rate tuning for Venice scale. Tension threshold calibration. Anti-runaway-optimization (homeostasis). Energy injection from real economy data.
**Depends on:** narrative/graph (reads/writes FalkorDB)
**Entry points:** Blood Ledger `engine/physics/`, `src/server/physics-bridge.js`

#### narrative/events
**Responsibility:** When a Moment flips, translate it into observable world effects. Event classification (economic_crisis, political_uprising, personal_tragedy, celebration). 3D effects: citizen behavior changes, atmosphere shifts, crowd gathering, spatial audio events. News propagation: events spread through social graph over time (hours/days). Forestiere news injection (real-world RSS → 15th century translation).
**Key decisions:** Event severity scale. Visual/audio effect mapping per event type. Propagation speed model. Maximum concurrent active events.
**Depends on:** narrative/physics (Moment flips), world/atmosphere (visual effects), citizens/population (behavior changes)
**Entry points:** `src/server/physics-bridge.js` (event emission), `src/client/atmosphere/` (event rendering)

---

### ECONOMY — Serenissima Economic Layer

#### economy/simulation
**Responsibility:** Keep the economic simulation running 24/7. Activity processing (production, trade, movement). Stratagem execution (undercut, coordinate_pricing, hoard, lockout). Resource flows (goods produced → transported → consumed). Income/expense computation. Market price dynamics.
**Key decisions:** Simulation tick rate. Which parts run server-side vs. Airtable-side. Activity processor restart strategy. Economic balance tuning.
**Depends on:** economy/sync (Airtable data), economy/governance (political decisions affect economy)
**Entry points:** Serenissima `backend/engine/`, activity processors

#### economy/sync
**Responsibility:** Bidirectional sync between Airtable (source of truth) and the Express server (in-memory cache for real-time rendering). Pull cycle: every 15 minutes, fetch CITIZENS, BUILDINGS, CONTRACTS, ACTIVITIES, RELATIONSHIPS. Push cycle: write citizen memory updates, trust scores, new events back to Airtable. Diff computation: detect what changed → generate WebSocket events for connected clients.
**Key decisions:** Sync interval (15min? shorter?). Conflict resolution (server vs. Airtable wins?). Cache invalidation. Airtable rate limits (5 req/sec).
**Depends on:** infra/server (WebSocket broadcast)
**Entry points:** `src/server/serenissima-sync.js`

#### economy/governance
**Responsibility:** The political layer of Venice. Grievance filing and support (citizens with genuine complaints → KinOS-driven decisions). Council formation. Political movements. Governance outcomes that affect the economy and narrative (tax changes, building permits, trade restrictions). Observable in the world: crowds at Dorsoduro, posted notices, guard enforcement.
**Key decisions:** Governance cycle timing. Support threshold for action. How political outcomes feed into narrative graph. Doge/Council system.
**Depends on:** citizens/mind (KinOS decisions), narrative/graph (political narratives as graph nodes)
**Entry points:** Serenissima `backend/engine/handlers/governance_kinos.py`

---

### VOICE — Full Speech Pipeline

#### voice/pipeline
**Responsibility:** End-to-end speech flow. Visitor speaks → microphone capture → STT (Whisper) → text → route to target citizen → LLM response → TTS (ElevenLabs) → audio buffer → WebSocket → client playback. Latency budget: < 3 seconds from end-of-speech to first audio. Error handling: fallback responses if LLM/TTS fails.
**Key decisions:** STT model (local Whisper vs. API). TTS voice selection per citizen (unique vs. archetype pool). Streaming TTS (start playing before full response generated). Language handling (visitor speaks English/French → citizen responds in same language?).
**Depends on:** citizens/mind (LLM context + response), voice/spatial (playback positioning)
**Entry points:** `src/server/index.js` (voice routes, extend existing), `src/client/voice-chat.js` (extend)

#### voice/spatial
**Responsibility:** Audio spatialization. HRTF panning (sound comes from the correct 3D direction). Distance attenuation (far = quiet, near = loud). Ambient layers (water, wind, bells, crowd murmur — per district). Audio priority system (max 32 sources: FULL citizens > ACTIVE > ambient). Reverb per district (open piazza vs. narrow alley). Occlusion (sound blocked by buildings).
**Key decisions:** Web Audio API vs. Resonance Audio. Audio priority queue depth. Reverb presets per district. Occlusion model complexity (raycast vs. zone-based).
**Depends on:** world/districts (geometry for occlusion), citizens/population (source positions)
**Entry points:** `src/client/voice-chat.js`, `src/client/zone-ambient.js`

---

### INFRA — Server, Deployment, Performance

#### infra/server
**Responsibility:** The Express.js server that orchestrates everything. WebSocket management (visitor connections, state broadcast). HTTP routes (citizen data, voice, events). Process management (physics tick runner, sync scheduler, activity processor). Session management (visitor identity, reconnection).
**Key decisions:** Single process vs. worker threads. WebSocket protocol (custom vs. Socket.io). Auth model (do visitors need accounts?). Rate limiting.
**Depends on:** all other modules (server is the hub)
**Entry points:** `src/server/index.js`

#### infra/performance
**Responsibility:** Keeping the experience smooth on Quest 3 hardware. Frame budget (14ms for 72fps). Tier-based culling strategy. LOD system for buildings and citizens. Geometry instancing and batching. Texture atlas management. Memory monitoring and cleanup. Draw call budget (< 200). Triangle budget (< 500K visible).
**Key decisions:** Culling algorithm (frustum + distance + occlusion). LOD transition distances. Geometry pooling strategy. When to drop quality (adaptive DPR). Profiling tools and alerts.
**Depends on:** world/districts (geometry complexity), citizens/embodiment (citizen render cost)
**Entry points:** cross-cutting (affects all client modules)

#### infra/deployment
**Responsibility:** Getting Venezia running in production. HTTPS requirement (WebXR mandates it). Hosting (Render, self-hosted, or hybrid). Domain (citiesoflight.ai / mindprotocol.ai sub). FalkorDB containerization. Monitoring (uptime, latency, error rates). Backup strategy (Airtable exports, graph snapshots).
**Key decisions:** Single host vs. distributed. CDN for static assets. Database backup frequency. Cost optimization.
**Depends on:** infra/server (what needs hosting)
**Entry points:** deployment configs, Docker files

---

## Documentation Plan Per Module

Each module gets AT MINIMUM:

| Document | Content | Priority |
|---|---|---|
| `PATTERNS_{module}.md` | Design philosophy, key decisions, what's in/out scope | **Must have** |
| `SYNC_{module}.md` | Current state, what's built, what's not, open questions | **Must have** |
| `BEHAVIORS_{module}.md` | Observable effects, user-facing specification | High |
| `ALGORITHM_{module}.md` | Pseudocode, data flows, procedures | High |
| `VALIDATION_{module}.md` | Invariants, tests, acceptance criteria | Medium |
| `IMPLEMENTATION_{module}.md` | File paths, interfaces, data structures | When building |

### Recommended documentation order (matches build order):

```
Phase 1 — Foundation
  1. world/districts          ← First thing visible
  2. citizens/embodiment      ← First thing you see moving
  3. citizens/mind            ← First thing you talk to
  4. voice/pipeline           ← How you talk

Phase 2 — Liveness
  5. economy/sync             ← Real data flowing in
  6. citizens/population      ← All 186 citizens managed
  7. narrative/graph          ← Graph seeded
  8. narrative/physics        ← World starts evolving

Phase 3 — Depth
  9. world/atmosphere         ← World feels alive
 10. narrative/events         ← Dramatic moments emerge
 11. voice/spatial            ← Audio immersion
 12. economy/simulation       ← Economy runs 24/7

Phase 4 — Polish
 13. economy/governance       ← Political layer
 14. world/navigation         ← Movement polish
 15. infra/performance        ← Quest 3 optimization
 16. infra/deployment         ← Production launch
 17. infra/server             ← Hardening
```

---

## Dependency Graph

```
                    infra/server
                    ╱    │    ╲
                   ╱     │     ╲
          economy/sync   │   voice/pipeline
            │    │       │       │
            │    │       │       │
   economy/ │  narrative/│    voice/
  simulation│   graph    │    spatial
      │     │     │      │       │
      │     ╰─────┤      │       │
      │           │      │       │
  economy/   narrative/  │   world/
  governance  physics    │  atmosphere
                 │       │      │
            narrative/   │      │
             events      │      │
                 │       │      │
                 ╰───────┤      │
                         │      │
                    citizens/   │
                    population  │
                      │    │    │
                      │    │    │
                citizens/ citizens/
                embodiment  mind
                      │
                      │
                 world/districts
                      │
                 world/navigation
```

Bottom-up: `world/districts` → `citizens/embodiment` → `citizens/mind` → everything else builds on top.
