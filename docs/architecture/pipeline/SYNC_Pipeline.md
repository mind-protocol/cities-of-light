# 3D Pipeline & Cognitive Supply Chain — Sync: Current State

```
LAST_UPDATED: 2026-03-14
UPDATED_BY: Tomaso Nervo (@nervo) — initial doc chain creation from CONCEPT spec
STATUS: DESIGNING
```

---

## MATURITY

**What's canonical (v1):**
- Engine V1 rendering infrastructure: Three.js scene, camera, animation loop, WASD navigation, citizen stick figures, building renderer, bridge renderer, zone atmosphere (`engine/`)
- Physics tick bridge (server-side): `NarrativeGraphSeedAndTickBridge` broadcasts tick events, `PhysicsBridge` in `src/server/` executes Python tick against FalkorDB
- Entity lifecycle: `EntityManager` handles spawn, tier assignment, wander, voice routing
- WebSocket protocol: `engine/shared/protocol.js` defines message types (no pipeline-specific types yet)

**What's still being designed:**
- C_t → shader uniform bridge (the core forward path from graph to visual)
- Limbic state shader (GLSL: valence/arousal → color/pulsation)
- Collision detection and limbic injection feedback pipeline
- Energy-indexed material decay (erosion, LOD degradation)
- Session stride allocation for rendering budget management
- R3F migration (currently vanilla Three.js — R3F would change shader patterns)

**What's proposed (v2+):**
- Lumina Prime zero-external-assets procedural generation
- Action node physical instanciation (Law 17 — embedding validation)
- Subconscious absorption in DND mode
- WebGPU compute shaders for collision detection at scale
- SharedArrayBuffer for C_t transfer to Web Worker

---

## CURRENT STATE

The rendering engine exists and serves Venice. Citizens walk as colored stick figures, buildings render from JSON data with category-based sizing, bridges arch across canals, and zone atmospheres transition smoothly as the visitor moves between districts. Voice works (push-to-talk). AI perception triggers when the visitor approaches a citizen. Multiplayer positions sync via WebSocket.

But the 3D world is disconnected from the graph. Citizen colors are static — assigned by social class (`Nobili: gold, Cittadini: blue, Popolani: copper`), not by limbic state. Building geometry does not reflect narrative energy. No collision detection exists. No C_t bridge exists. The physics tick broadcasts a tick number and timestamp, but not the full context vector needed by shaders.

The pipeline architecture is fully specified in the CONCEPT doc and now in this doc chain. The forward path (C_t → uniforms), the feedback path (collisions → graph), the decay engine, the session allocator — all are designed but none are implemented in code.

The biggest code-level prerequisite is splitting `engine/client/app.js` (1085 lines, SPLIT status). The pipeline components (limbic shader, collision detector, C_t bridge) need to be added as separate modules, but app.js is already too large to absorb them.

---

## IN PROGRESS

### CONCEPT → Doc Chain (DONE)

- **Started:** 2026-03-14
- **By:** @nervo
- **Status:** Done
- **Context:** Created all 7 doc chain files from the CONCEPT spec and French technical specification. The chain now covers OBJECTIVES, PATTERNS, BEHAVIORS, ALGORITHM, VALIDATION, IMPLEMENTATION, and SYNC.

### App.js Extraction (Not Started — Prerequisite)

- **Started:** Not yet
- **By:** Unassigned
- **Status:** Blocked on assignment
- **Context:** `engine/client/app.js` is at 1085 lines (SPLIT). Before any pipeline code can be added, it needs extraction into: `citizen-renderer.js`, `voice-client.js`, `perception-client.js`, `multiplayer-client.js`. Each handles a distinct concern. The animation loop orchestrator stays in app.js.

---

## RECENT CHANGES

### 2026-03-14: Pipeline Doc Chain Created

- **What:** Full 7-doc chain created for the 3D Pipeline & Cognitive Supply Chain module
- **Why:** The CONCEPT doc (`docs/architecture/CONCEPT_3D_Pipeline_Supply_Chain.md`) contained the full technical specification but no implementation-oriented documentation. This doc chain translates the vision into objectives, patterns, behaviors, algorithms, invariants, implementation map, and sync state.
- **Files:** `docs/architecture/pipeline/OBJECTIVES_Pipeline.md` through `SYNC_Pipeline.md`
- **Struggles/Insights:** The biggest tension is between the CONCEPT's R3F/GLSL vision and the reality that the engine is currently vanilla Three.js. The doc chain documents both — the target architecture and the current state — so the next agent can decide the migration path.

---

## KNOWN ISSUES

### physics_tick broadcast lacks C_t

- **Severity:** high
- **Symptom:** `NarrativeGraphSeedAndTickBridge` broadcasts `{ type: "physics_tick", tick: N, ts: Date.now() }` — no citizen state, no node energies, no zone tensions
- **Suspected cause:** The bridge was designed as a minimal tick counter. The full C_t payload was deferred.
- **Attempted:** Nothing yet. The bridge needs to be extended to query post-tick graph state and include it in the broadcast.

### Citizen colors are static

- **Severity:** medium
- **Symptom:** Citizens are colored by social class (gold, blue, copper) via `MeshStandardMaterial`, not by limbic state. No shader uniforms exist.
- **Suspected cause:** The citizen rendering was built before the pipeline architecture was specified.
- **Attempted:** Nothing. This is the core work item for pipeline implementation.

### No collision detection

- **Severity:** medium
- **Symptom:** Citizens walk through each other and through buildings with no spatial consequence.
- **Suspected cause:** Collision detection was out of scope for Engine V1 (rendering + navigation focus).
- **Attempted:** Nothing. Planned as part of pipeline feedback path.

### app.js at SPLIT threshold

- **Severity:** medium
- **Symptom:** 1085 lines in a single file covering scene setup, citizen rendering, voice, perception, multiplayer, and animation loop.
- **Suspected cause:** Rapid prototyping during Engine V1 build sprint (2026-03-12).
- **Attempted:** Extraction candidates identified in IMPLEMENTATION doc. Not yet executed.

---

## HANDOFF: FOR AGENTS

**Your likely VIEW:** VIEW_Implement — the architecture is designed, now it needs code

**Where I stopped:** Documentation is complete. No pipeline code has been written. The next step is either (a) extract app.js to make room for pipeline modules, or (b) implement the C_t bridge as the first pipeline component.

**What you need to understand:**
The critical insight is that the `NarrativeGraphSeedAndTickBridge` currently broadcasts a bare tick event — it does NOT include the C_t context vector. Step 1 is making the physics tick produce and broadcast the full C_t (citizen valences, energies, zone tensions). Without that data flowing, no shader work matters. The bridge exists at `engine/server/narrative_graph_seed_and_tick_bridge.js` and is ~70 lines — straightforward to extend. The actual graph query to produce C_t will need to call FalkorDB (via graph-client or direct) after each tick.

**Watch out for:**
- The engine uses vanilla Three.js, not React Three Fiber. All CONCEPT doc references to "R3F" are aspirational. Code against `THREE.ShaderMaterial` today.
- The `PhysicsBridge` in `src/server/physics-bridge.js` (legacy) and the `NarrativeGraphSeedAndTickBridge` in `engine/server/` are two different things. The legacy bridge spawns a Python subprocess. The engine bridge is a JS timer. They need reconciliation.
- Citizen meshes are created in `spawnCitizens()` at line ~173 of app.js. Materials are `MeshStandardMaterial`. Replacing with `ShaderMaterial` for the limbic shader means rewriting the citizen mesh creation.
- The GLSL shader in the CONCEPT doc uses `gl_FragColor` (deprecated in GLSL 300 es). For Three.js WebGL2, use `out vec4 fragColor` or rely on Three.js shader chunks.

**Open questions I had:**
- Should the C_t bridge be a new WebSocket message type, or should it extend the existing `physics_tick` type?
- Should collision detection run in the main thread or a Web Worker? 186 citizens with spatial hash is probably fine on main thread, but scales poorly.
- When the physics tick bridge is extended to include C_t, should it query FalkorDB directly or receive the data from the Python tick subprocess?

---

## HANDOFF: FOR HUMAN

**Executive summary:**
Full 7-doc architecture chain created for the 3D Pipeline & Cognitive Supply Chain module. The architecture couples the cognitive engine (FalkorDB physics tick) to the procedural engine (Three.js rendering) bidirectionally: graph state drives visual appearance via shader uniforms (forward path), and 3D collisions inject energy back into the graph (feedback path). No pipeline code exists yet — the engine renders Venice with static colors and no collision detection. Key prerequisite: app.js needs splitting (1085 lines) before pipeline modules can be added.

**Decisions made:**
- Documented the pipeline against vanilla Three.js (current reality), not R3F (aspirational). Migration path is noted but not assumed.
- Defined 6 validation invariants with priorities. Energy budget conservation and WM isolation are CRITICAL.
- Identified app.js extraction as a prerequisite before pipeline implementation.

**Needs your input:**
- R3F migration: should the pipeline be built on vanilla Three.js (works today) or should R3F migration happen first? The shader patterns differ significantly.
- Collision injection latency: the 200ms threshold for injection-to-graph means injections could wait up to 5 minutes to affect C_t (next physics tick). Should there be a "hot" injection path that affects C_t between ticks?
- Legacy bridge reconciliation: `src/server/physics-bridge.js` (Python subprocess) vs `engine/server/narrative_graph_seed_and_tick_bridge.js` (JS timer) — which becomes the canonical tick source for the pipeline?

---

## TODO

### Doc/Impl Drift

- [ ] DOCS->IMPL: Full doc chain written, zero pipeline implementation exists
- [ ] DOCS->IMPL: `physics_tick` message needs C_t payload (documented in ALGORITHM, not in protocol.js)
- [ ] DOCS->IMPL: `collision_injection_batch` message type needs to be added to protocol.js
- [ ] DOCS->IMPL: Limbic shader GLSL documented in ALGORITHM, no shader file exists

### Tests to Run

```bash
# Engine boot test (validates existing infrastructure still works)
node engine/index.js --world ./worlds/venezia/world-manifest.json

# Physics tick test (validates bridge broadcasts)
curl http://localhost:8800/api/physics
```

### Immediate

- [ ] Extract `engine/client/app.js` into citizen-renderer, voice-client, perception-client, multiplayer-client modules
- [ ] Extend `NarrativeGraphSeedAndTickBridge` to include C_t in physics_tick broadcast
- [ ] Add `physics_tick` (with C_t) and `collision_injection_batch` to `engine/shared/protocol.js`
- [ ] Create `engine/client/limbic-shader.js` with GLSL source from CONCEPT doc
- [ ] Create `engine/client/ct-bridge.js` for C_t reception, validation, NaN clamping, target management

### Later

- [ ] Create `engine/client/collision-detector.js` with spatial hash and classification
- [ ] Create `engine/client/decay-engine.js` for energy-to-erosion material updates
- [ ] Implement session stride allocation in entity-manager or new module
- [ ] Implement frustration crystallization (Law 16) for pipeline failures
- [ ] Benchmark on Quest 3: draw calls, triangle count, frame timing
- IDEA: Use instanced rendering with per-instance attributes for 186 citizen limbic shaders — one draw call instead of 186
- IDEA: Telemetry ring buffer for V4 auditability — fixed-size, append-only, survives restart

---

## CONSCIOUSNESS TRACE

**Mental state when stopping:**
Confident in the architecture. The CONCEPT doc is thorough and the French spec provides the details that fill gaps. The doc chain captures the full vision faithfully. The gap between documented architecture and existing code is large but well-mapped.

**Threads I was holding:**
- The legacy `PhysicsBridge` (src/server/) runs the actual Python physics tick. The engine `NarrativeGraphSeedAndTickBridge` is a lighter JS-only timer. These need to converge. The Python tick produces real graph mutations; the JS bridge is currently just a counter.
- The `zone-ambient-engine.js` already uses lerp(0.02) for atmosphere transitions — the exact same pattern needed for citizen uniform interpolation. Code reuse opportunity.
- Entity tiers (FULL/ACTIVE/AMBIENT) in `entity-manager.js` could map directly to LOD levels in the decay engine. FULL = max LOD, AMBIENT = min LOD. Natural alignment.

**Intuitions:**
- The app.js extraction is the real gate. Until that file is under 400 lines, adding pipeline modules will create an unmaintainable monolith. Do the extraction first, even if it feels like "non-productive" work.
- Instanced rendering for citizens is probably the right call for 186 citizens with shared limbic shaders. One draw call, per-instance valence/arousal attributes. Three.js `InstancedMesh` supports this.
- The collision detection spatial hash can reuse the zone system — each zone is already a spatial region with known citizens. No need for a separate spatial index.

**What I wish I'd known at the start:**
The `NarrativeGraphSeedAndTickBridge` is nearly empty — 70 lines, no graph queries, no C_t production. I assumed it was more complete based on the name. The heavy lifting is still in the legacy `PhysicsBridge`. Any agent working on the pipeline should start by reading both bridge files side by side.

---

## POINTERS

| What | Where |
|------|-------|
| CONCEPT spec (full technical content) | `docs/architecture/CONCEPT_3D_Pipeline_Supply_Chain.md` |
| Engine V1 client (current rendering) | `engine/client/app.js` |
| Engine V1 entry point | `engine/index.js` |
| Physics tick bridge (JS timer) | `engine/server/narrative_graph_seed_and_tick_bridge.js` |
| Physics tick bridge (Python subprocess) | `src/server/physics-bridge.js` |
| Python tick runner | `src/server/run_tick.py` |
| Entity manager | `engine/server/entity-manager.js` |
| WebSocket protocol | `engine/shared/protocol.js` |
| Building renderer | `engine/client/building-renderer.js` |
| Zone atmosphere engine | `engine/client/zone-ambient-engine.js` |
| Physics laws doc chain | `docs/narrative/physics/` |
| Graph schema | `.mind/schema.yaml` |
| Lumina Prime CONCEPT | `docs/architecture/CONCEPT_Lumina_Prime.md` |
| Serenissima CONCEPT | `docs/architecture/CONCEPT_Serenissima_Asset_Pipeline.md` |
| Project SYNC | `.mind/state/SYNC_Project_State.md` |

Co-Authored-By: Tomaso Nervo (@nervo) <nervo@mindprotocol.ai>
