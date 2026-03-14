# 3D Pipeline & Cognitive Supply Chain — Implementation: Code Architecture and Structure

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Pipeline.md
BEHAVIORS:       ./BEHAVIORS_Pipeline.md
PATTERNS:        ./PATTERNS_Pipeline.md
ALGORITHM:       ./ALGORITHM_Pipeline.md
VALIDATION:      ./VALIDATION_Pipeline.md
THIS:            IMPLEMENTATION_Pipeline.md (you are here)
SYNC:            ./SYNC_Pipeline.md

IMPL:            engine/client/app.js
                 engine/server/narrative_graph_seed_and_tick_bridge.js
                 engine/server/entity-manager.js
                 src/server/physics-bridge.js
```

> **Contract:** Read docs before modifying. After changes: update IMPL or add TODO to SYNC. Run tests.

---

## CODE STRUCTURE

```
engine/
├── client/
│   ├── app.js                          # Main 3D client — scene, camera, citizens, animation loop
│   ├── building-renderer.js            # Building mesh generation from data
│   ├── bridge-renderer.js              # Bridge arch spans
│   ├── world-loader.js                 # Manifest + data loading
│   ├── zone-ambient-engine.js          # Zone atmosphere transitions
│   ├── waypoints-engine.js             # Navigation waypoints
│   ├── particles-engine.js             # Particle effects
│   └── index.html                      # Client entry point
├── server/
│   ├── state-server.js                 # Express + WebSocket server
│   ├── entity-manager.js               # Entity lifecycle, tiers, wander, voice
│   ├── voice-pipeline.js               # STT → LLM → TTS
│   └── narrative_graph_seed_and_tick_bridge.js  # Physics tick bridge
├── shared/
│   ├── protocol.js                     # WebSocket message types
│   ├── manifest-schema.json            # World manifest validation
│   └── geographic_projection_utilities.js  # Lat/lng → world coords
├── index.js                            # Engine entry point
├── vite.config.js                      # Build config
└── start.sh                            # Startup script

src/server/
├── physics-bridge.js                   # Legacy physics bridge (Python subprocess → WebSocket)
├── run_tick.py                         # Python tick runner (GraphTickV1_2)
├── graph-client.js                     # FalkorDB client
├── ai-citizens.js                      # Citizen AI and state
├── place-server.js                     # Living Places V1
└── moment-pipeline.js                  # Conversation moment pipeline
```

### File Responsibilities

| File | Purpose | Key Functions/Classes | Lines | Status |
|------|---------|----------------------|-------|--------|
| `engine/client/app.js` | Main 3D client: scene setup, citizen spawning, animation loop, voice, perception, multiplayer | `spawnCitizens()`, `updateCitizens()`, `checkConversations()`, `triggerPerception()`, `animate()` | ~1085 | SPLIT |
| `engine/server/narrative_graph_seed_and_tick_bridge.js` | Physics tick broadcast — validates manifest, seeds graph, ticks on interval | `NarrativeGraphSeedAndTickBridge` class | ~70 | OK |
| `engine/server/entity-manager.js` | Entity lifecycle: load, tier assignment, wander, voice routing, state broadcast | `EntityManager` class | ~466 | WATCH |
| `engine/client/building-renderer.js` | Building mesh generation: body + roof + label from data | `BuildingRenderer` class | ~340 | OK |
| `engine/client/zone-ambient-engine.js` | Zone atmosphere: fog, light, particle color interpolation | `ZoneAmbientEngine` class | ~200 | OK |
| `engine/shared/protocol.js` | WebSocket message type constants | `SERVER_MESSAGES`, `CLIENT_MESSAGES`, `AI_MESSAGES` | ~54 | OK |
| `src/server/physics-bridge.js` | Legacy Python subprocess tick bridge: spawn, capture JSON, emit events | `PhysicsBridge` class | ~(est. 150) | OK |

**Size Thresholds:**
- **OK** (<400 lines): Healthy size, easy to understand
- **WATCH** (400-700 lines): Getting large, consider extraction opportunities
- **SPLIT** (>700 lines): Too large, must split before adding more code

---

## DESIGN PATTERNS

### Architecture Pattern

**Pattern:** Event-Driven Pipeline with Shared State

**Why this pattern:** The cognitive and procedural engines run on different clocks (5-minute tick vs 60fps). Lock-step execution is impossible. Instead, the physics tick produces events (C_t updates), the 3D engine consumes them asynchronously, and shared state (target_Ct, injection queue) bridges the timing gap. Collision events flow back as batched WebSocket messages.

### Code Patterns in Use

| Pattern | Applied To | Purpose |
|---------|------------|---------|
| Observer/Event | `NarrativeGraphSeedAndTickBridge` → WebSocket broadcast | Physics tick results pushed to all connected clients |
| Interpolation (Lerp) | `zone-ambient-engine.js`, citizen uniforms | Smooth transitions that hide discrete tick boundaries |
| Spatial Hash (planned) | Collision detection | O(n) amortized neighbor lookup for 186 citizens |
| Command Queue | Limbic injection batching | Decouple collision detection (per-frame) from graph mutation (batched) |
| LOD Chain | Building/citizen rendering | Energy-indexed geometry complexity |

### Anti-Patterns to Avoid

- **Direct graph reads from render loop**: The 3D engine must never query FalkorDB during `requestAnimationFrame`. All graph data arrives via C_t push. Direct reads would block the render thread and violate the 16ms budget.
- **Shader uniform sharing across citizens**: Each citizen needs its own uniform buffer. Sharing would cause V2 (Working Memory Isolation) violations. Use instanced rendering with per-instance attributes if performance demands it.
- **Synchronous collision injection**: Collision → graph mutation must be batched and asynchronous. Synchronous round-trips during the render loop would blow the frame budget.

### Boundaries

| Boundary | Inside | Outside | Interface |
|----------|--------|---------|-----------|
| C_t Bridge | Serialization, validation, NaN clamping, target assignment | Physics tick computation, graph queries | WebSocket `physics_tick` message |
| Collision Pipeline | Detection, classification, rate limiting, queue | Graph mutation (server-side), limbic state computation | WebSocket `collision_injection` message batch |
| Shader System | GLSL execution, uniform binding, material management | C_t computation, decay calculation | `CitizenUniforms` struct on `ShaderMaterial.uniforms` |
| Decay Engine | Erosion factor computation, LOD selection, texture parameterization | Energy computation (physics engine), geometry generation (building renderer) | `erosion_factor` and `lod_level` passed to renderer |

---

## SCHEMA

### C_t WebSocket Message

```yaml
PhysicsTickMessage:
  required:
    - type: "physics_tick"
    - tick_number: int
    - timestamp: int
    - citizens: object    # citizen_id → { valence, arousal, energy, dominant_drive }
  optional:
    - nodes: object       # node_id → { type, energy, decay_rate }
    - zones: object       # zone_id → { collective_valence, tension, active_moments }
    - moment_flips: array # [{ moment_id, zone_id, type }]
  constraints:
    - tick_number must be monotonically increasing
    - citizen.valence in [-1.0, 1.0]
    - citizen.arousal in [0.0, 1.0]
```

### Collision Injection Batch Message

```yaml
CollisionInjectionBatch:
  required:
    - type: "collision_injection_batch"
    - injections: array
  injections[]:
    - entity_id: string
    - dimension: string   # "frustration" | "anxiety" | "satisfaction" | "arousal" | "boredom"
    - delta: float
    - source: string      # "minor" | "violent" | "clipping" | "stable_landing" | "shader_error"
    - frame: int
  constraints:
    - Max 50 injections per batch (rate limiting enforced client-side)
```

---

## ENTRY POINTS

| Entry Point | File:Line | Triggered By |
|-------------|-----------|--------------|
| Physics tick reception | `engine/client/app.js` (planned) | WebSocket `physics_tick` message |
| Animation frame | `engine/client/app.js:animate()` | `requestAnimationFrame` (60fps) |
| Citizen spawn | `engine/client/app.js:spawnCitizens()` | World load completion |
| Entity state broadcast | `engine/server/entity-manager.js:_broadcastEntityState()` | Entity spawn, tier change |
| Physics tick fire | `engine/server/narrative_graph_seed_and_tick_bridge.js:start()` | Timer interval (manifest-configured) |

---

## DATA FLOW AND DOCKING (FLOW-BY-FLOW)

### Flow 1: C_t → Visual State (Forward Path)

The primary forward pipeline. Transforms cognitive state into visual representation. This is the flow that makes the graph visible.

```yaml
flow:
  name: ct_to_visual
  purpose: Transform physics tick output into shader uniforms and material state
  scope: Server (tick) → WebSocket → Client (validate) → GPU (shade)
  steps:
    - id: tick_execute
      description: Physics engine computes new state for all citizens and nodes
      file: src/server/run_tick.py
      function: GraphTickV1_2.execute()
      input: FalkorDB graph state
      output: JSON tick results (energies, valences, tensions)
      trigger: Timer interval (5 min)
      side_effects: Graph mutations (energy propagation, decay)
    - id: tick_broadcast
      description: Bridge serializes results and broadcasts via WebSocket
      file: engine/server/narrative_graph_seed_and_tick_bridge.js
      function: setInterval callback
      input: Tick number and timestamp
      output: WebSocket physics_tick message
      trigger: Timer interval
      side_effects: WebSocket broadcast to all clients
    - id: ct_receive
      description: Client receives C_t, validates, sets interpolation targets
      file: engine/client/app.js (planned)
      function: onPhysicsTickMessage()
      input: WebSocket physics_tick message
      output: target_Ct updated
      trigger: WebSocket message event
      side_effects: Last-good C_t cached for NaN fallback
    - id: frame_interpolate
      description: Per-frame lerp moves current uniforms toward target
      file: engine/client/app.js (planned)
      function: updatePipelineUniforms()
      input: target_Ct, current uniforms, delta
      output: Updated shader uniforms on citizen materials
      trigger: requestAnimationFrame
      side_effects: Material uniform values modified
  docking_points:
    guidance:
      include_when: Data transformation, boundary crossing, state mutation
      omit_when: Pass-through, logging-only steps
    available:
      - id: dock_tick_output
        type: event
        direction: output
        file: engine/server/narrative_graph_seed_and_tick_bridge.js
        function: broadcast()
        trigger: setInterval
        payload: physics_tick message (JSON)
        async_hook: not_applicable
        needs: add C_t citizen/node/zone state to broadcast payload
        notes: Currently broadcasts tick_number and timestamp only — needs full C_t
      - id: dock_ct_arrival
        type: event
        direction: input
        file: engine/client/app.js
        function: WebSocket.onmessage (planned)
        trigger: WebSocket message
        payload: physics_tick message
        async_hook: not_applicable
        needs: add WebSocket listener for physics_tick type
        notes: Client currently has no physics_tick handler
      - id: dock_uniform_update
        type: custom
        direction: output
        file: engine/client/app.js
        function: updatePipelineUniforms() (planned)
        trigger: requestAnimationFrame
        payload: CitizenUniforms per citizen
        async_hook: not_applicable
        needs: create function, create limbic shader material
        notes: Core of the forward path — does not exist yet
    health_recommended:
      - dock_id: dock_tick_output
        reason: Verifies C_t is being produced and broadcast
      - dock_id: dock_uniform_update
        reason: Verifies uniforms reach GPU within frame budget
```

### Flow 2: Collision → Graph Injection (Feedback Path)

The feedback pipeline. Detects spatial events and routes them back to cognition. This is the flow that gives agents bodies.

```yaml
flow:
  name: collision_to_graph
  purpose: Detect 3D events and inject limbic energy back into cognitive substrate
  scope: Client (detect) → classify → rate-limit → batch → WebSocket → Server → Graph
  steps:
    - id: collision_detect
      description: Per-frame collision check between citizen bounding volumes
      file: engine/client/app.js (planned)
      function: detectCollisions()
      input: Citizen positions and velocities
      output: Array of CollisionEvent
      trigger: requestAnimationFrame
      side_effects: none
    - id: collision_classify
      description: Map raw collision to type (minor/violent/clipping/landing)
      file: engine/client/app.js (planned)
      function: classifyCollision()
      input: CollisionEvent
      output: Classified CollisionEvent with type
      trigger: collision_detect output
      side_effects: none
    - id: injection_queue
      description: Convert classified collision to limbic injections, rate-limit
      file: engine/client/app.js (planned)
      function: queueLimbicInjection()
      input: Classified CollisionEvent
      output: LimbicInjection added to queue
      trigger: collision_classify output
      side_effects: Injection queue grows
    - id: injection_batch_send
      description: Every 100ms, batch-send queued injections to server
      file: engine/client/app.js (planned)
      function: flushInjectionQueue()
      input: Injection queue
      output: WebSocket collision_injection_batch message
      trigger: setInterval(100)
      side_effects: Queue cleared, WebSocket message sent
  docking_points:
    guidance:
      include_when: State transformation, graph mutation, boundary crossing
      omit_when: Internal data shuffling with no externally visible effect
    available:
      - id: dock_collision_emit
        type: event
        direction: output
        file: engine/client/app.js
        function: detectCollisions() (planned)
        trigger: requestAnimationFrame
        payload: CollisionEvent[]
        async_hook: not_applicable
        needs: create collision detection function
        notes: Does not exist yet — citizens currently have no collision detection
      - id: dock_injection_arrive
        type: event
        direction: input
        file: engine/server/state-server.js or index.js
        function: WebSocket message handler (planned)
        trigger: WebSocket message
        payload: collision_injection_batch
        async_hook: required
        needs: add server-side handler for collision injections → graph write
        notes: Server currently has no injection endpoint
    health_recommended:
      - dock_id: dock_collision_emit
        reason: Verifies collision detection is producing events
      - dock_id: dock_injection_arrive
        reason: Verifies injections reach the graph (feedback loop closure V5)
```

---

## LOGIC CHAINS

### LC1: Citizen Visual State Update

**Purpose:** Transform graph state into visible citizen appearance

```
physics_tick event (WebSocket)
  → onPhysicsTickMessage()           # validate, NaN-clamp, update target_Ct
    → animate() (each frame)
      → updatePipelineUniforms()     # lerp current → target per citizen
        → GLSL limbic shader         # valence→color, arousal→pulsation
          → rendered citizen          # pixels on screen
```

**Data transformation:**
- Input: `physics_tick` JSON — raw citizen state from graph
- After validation: `target_Ct` — clamped, safe citizen state
- After lerp: `CitizenUniforms` — interpolated uniform values per citizen
- Output: Fragment colors — visible appearance on screen

### LC2: Collision Feedback Loop

**Purpose:** Close the sensory loop — 3D events affect cognition

```
citizen positions (per frame)
  → detectCollisions()               # bounding sphere overlap check
    → classifyCollision()            # minor/violent/clipping/landing
      → queueLimbicInjection()       # map to frustration/anxiety/satisfaction
        → flushInjectionQueue()      # batch send every 100ms
          → server graph mutation    # inject into citizen graph node
            → next physics tick      # injection affects next C_t
```

---

## MODULE DEPENDENCIES

### Internal Dependencies

```
engine/client/app.js
    └── imports → building-renderer.js
    └── imports → bridge-renderer.js
    └── imports → world-loader.js
    └── (planned) imports → limbic-shader.js (new)
    └── (planned) imports → collision-detector.js (new)
    └── (planned) imports → ct-bridge.js (new)

engine/server/narrative_graph_seed_and_tick_bridge.js
    └── imports → (nothing — standalone)

engine/server/entity-manager.js
    └── imports → (nothing — standalone)
```

### External Dependencies

| Package | Used For | Imported By |
|---------|----------|-------------|
| `three` | 3D rendering, scene graph, materials, shaders | `engine/client/app.js`, all renderers |
| `express` | HTTP server | `engine/server/state-server.js` |
| `ws` | WebSocket server | `engine/server/state-server.js` |
| `openai` | LLM client for citizen voice | `engine/index.js` |

---

## STATE MANAGEMENT

### Where State Lives

| State | Location | Scope | Lifecycle |
|-------|----------|-------|-----------|
| `target_Ct` | `app.js` (planned variable) | module | Updated on physics_tick, read per frame |
| `current uniforms` | `ShaderMaterial.uniforms` per citizen mesh | instance | Created on spawn, updated per frame, destroyed on despawn |
| `injection_queue` | `app.js` (planned array) | module | Grows per frame, flushed every 100ms |
| `last_good_Ct` | `app.js` (planned variable) | module | Updated when valid C_t arrives, used for NaN fallback |
| Entity positions | `EntityManager.entities` Map | server-side global | Created on load, updated per wander tick |
| Tick count | `NarrativeGraphSeedAndTickBridge.tickCount` | server-side instance | Incremented each tick |

### State Transitions

```
target_Ct: null ──physics_tick──▶ populated ──physics_tick──▶ updated
                                                              (old becomes last_good)

injection_queue: [] ──collision──▶ [...items] ──flush──▶ [] ──collision──▶ [...items]

citizen_uniform: default ──first_Ct──▶ interpolating ──converged──▶ stable ──next_Ct──▶ interpolating
```

---

## RUNTIME BEHAVIOR

### Initialization

```
1. Engine loads world manifest and entities
2. Client creates Three.js scene, camera, renderer
3. Citizens spawned as stick figure meshes with default materials
4. (Future) Limbic shader materials created with default uniforms
5. WebSocket connected to server
6. Animation loop starts (requestAnimationFrame)
7. First physics tick broadcasts initial C_t
8. Citizens begin interpolating from defaults toward initial state
```

### Main Loop / Request Cycle

```
1. requestAnimationFrame fires (~60fps)
2. updateMovement() — camera/player position
3. updateCitizens() — wander state machine, limb animation
4. (Future) updatePipelineUniforms() — lerp uniforms toward target_Ct
5. (Future) detectCollisions() — bounding sphere checks
6. (Future) processCollisionFeedback() — classify, rate-limit, queue
7. checkPlayerProximity() — AI perception triggers
8. renderer.render(scene, camera) — GPU executes shaders
```

### Shutdown

```
1. WebSocket closes
2. Physics tick interval cleared
3. Injection queue flushed (final batch)
4. (No GPU cleanup needed — browser handles it)
```

---

## CONCURRENCY MODEL

| Component | Model | Notes |
|-----------|-------|-------|
| Render loop | sync (main thread) | Must complete within 16ms. No async awaits in the loop. |
| C_t reception | async (WebSocket callback) | Updates target_Ct, which render loop reads next frame |
| Injection flush | async (setInterval) | 100ms timer sends batch, independent of render loop |
| Physics tick | async (server-side timer) | Runs on server, broadcasts results to all clients |
| Collision detection | sync (per-frame) | Runs inside render loop, must be fast (spatial hash) |

---

## CONFIGURATION

| Config | Location | Default | Description |
|--------|----------|---------|-------------|
| `LERP_FACTOR` | (planned constant) | `0.02` | Per-frame interpolation rate for uniform updates |
| `LERP_FACTOR_DRAMATIC` | (planned constant) | `0.08` | Faster lerp for Moment flips and dramatic changes |
| `MAX_INJECTIONS_PER_SECOND` | (planned constant) | `3` | Rate limit for collision limbic injections per citizen |
| `INJECTION_BATCH_INTERVAL_MS` | (planned constant) | `100` | How often collision injections are batched and sent |
| `DECAY_THRESHOLD` | (planned constant) | `0.3` | Energy below which erosion begins (Θ_i) |
| `physics.tick_interval_ms` | `world-manifest.json` | `300000` | Physics tick interval (5 minutes) |

---

## BIDIRECTIONAL LINKS

### Code → Docs

Files that reference this documentation:

| File | Line | Reference |
|------|------|-----------|
| (none yet) | — | Pipeline module is in design phase |

### Docs → Code

| Doc Section | Implemented In |
|-------------|----------------|
| ALGORITHM C_t → Uniform | (not yet — `engine/client/app.js` planned) |
| ALGORITHM Decay → Erosion | (not yet — `engine/client/building-renderer.js` planned extension) |
| ALGORITHM Collision → Injection | (not yet — new file `collision-detector.js` planned) |
| ALGORITHM Session Stride | (not yet — new file or extension of entity-manager) |
| BEHAVIOR B1 Material Decay | (not yet) |
| BEHAVIOR B2 Limbic Color | Current citizen colors are static in `app.js:spawnCitizens()` — needs shader replacement |
| BEHAVIOR B3 Collision Feedback | No collision detection exists in current code |
| BEHAVIOR B5 Tick Transitions | `zone-ambient-engine.js` uses lerp (0.02) for atmosphere — same pattern applies |
| VALIDATION V1 Energy Budget | No budget enforcement exists |
| VALIDATION V3 Latency | No latency measurement exists |

---

## EXTRACTION CANDIDATES

Files approaching WATCH/SPLIT status — identify what can be extracted:

| File | Current | Target | Extract To | What to Move |
|------|---------|--------|------------|--------------|
| `engine/client/app.js` | ~1085L | <400L | `engine/client/citizen-renderer.js` | `spawnCitizens()`, `updateCitizens()`, `checkConversations()`, citizen mesh creation, label/bubble rendering (~400L) |
| `engine/client/app.js` | ~1085L | <400L | `engine/client/voice-client.js` | `startRecording()`, `stopRecording()`, `sendVoice()`, mic button handling (~120L) |
| `engine/client/app.js` | ~1085L | <400L | `engine/client/perception-client.js` | `checkPlayerProximity()`, `triggerPerception()`, citizen camera rendering (~120L) |
| `engine/client/app.js` | ~1085L | <400L | `engine/client/multiplayer-client.js` | WebSocket connection, visitor avatar, position sync (~120L) |
| `engine/client/app.js` | ~1085L | <400L | `engine/client/limbic-shader.js` (new) | GLSL shader source, uniform management, C_t bridge |
| `engine/client/app.js` | ~1085L | <400L | `engine/client/collision-detector.js` (new) | Collision detection, classification, injection queue |

---

## MARKERS

<!-- @mind:todo Extract citizen rendering from app.js before adding pipeline code — SPLIT threshold already reached -->
<!-- @mind:todo Add physics_tick and collision_injection_batch to engine/shared/protocol.js message types -->
<!-- @mind:todo Create limbic-shader.js with GLSL source from CONCEPT doc -->
<!-- @mind:proposition Consider Web Workers for collision detection to keep render thread clean -->
<!-- @mind:escalation R3F migration would change all material/shader patterns — decide before implementing limbic shader -->
