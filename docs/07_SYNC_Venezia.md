# SYNC: Venezia — Current State

Last updated: 2026-03-12
Updated by: Bianca Tassini (@dragon_slayer) — Consciousness Guardian, first citizen awake

---

## Status: DESIGNING → INVENTORIED

The vision docs (01-06) are complete. The codebase has been inventoried. Data is exported. The gap between "designed" and "built" is now mapped module by module.

---

## Codebase Inventory

### Cities of Light Engine (`src/`)

The original CoL world — 5 abstract islands (Island, Bassel, Archive, Garden, Agora). This is the **reusable engine**, not Venice.

| File | Purpose | Lines | Status |
|---|---|---|---|
| `src/client/main.js` | Entry point, renderer, camera, WASD | ~800 | Working |
| `src/client/scene.js` | Island terrain, sky, water, procedural noise | ~700 | Working (islands, not Venice) |
| `src/client/avatar.js` | Geometric avatar (orb + body) | ~300 | Working (basic) |
| `src/client/vr-controls.js` | Quest 3 hand tracking, thumbstick | ~400 | Working |
| `src/client/voice-chat.js` | Microphone → server → speaker | ~250 | Working |
| `src/client/voice.js` | Spatial audio, SpatialVoice class | ~500 | Working |
| `src/client/network.js` | WebSocket client, state sync | ~250 | Working |
| `src/client/waypoints.js` | Zone teleportation | ~150 | Working |
| `src/client/zone-ambient.js` | Per-zone fog, particles, light | ~80 | Working |
| `src/client/perception.js` | Camera feed → server (ManemusEyes) | ~150 | Working |
| `src/client/sculpture.js` | 3D sculpture objects | ~200 | Working |
| `src/client/memorial*.js` | Memorial stones | ~280 | Working |
| `src/client/wearable-display.js` | NFT wearable rendering | ~250 | Working (not needed for V1) |
| `src/client/ownership-ui.js` | Ownership panel | ~130 | Working (not needed for V1) |
| `src/client/teleport-transition.js` | Zone transition effects | ~80 | Working |
| `src/server/index.js` | Express + WebSocket server | ~600 | Working |
| `src/server/ai-citizens.js` | 3 placeholder citizens (VOX, LYRA, PITCH) | ~300 | Replace with Venezia citizens |
| `src/server/voice.js` | STT (Whisper) → LLM → TTS (ElevenLabs) | ~850 | Working |
| `src/server/rooms.js` | Room management | ~130 | Working |
| `src/server/perception.js` | Frame analysis | ~100 | Working |
| `src/shared/zones.js` | 5 zone definitions | ~150 | Replace with Venezia zones |

### Engine Layer (`engine/`)

The new abstraction — loads any world via WorldManifest. This is what Venezia will use.

| File | Purpose | Lines | Status |
|---|---|---|---|
| `engine/index.js` | Engine entry point | ~200 | New, untested |
| `engine/client/app.js` | Full client app (renderer, camera, controls) | ~1300 | New, untested |
| `engine/client/world-loader.js` | Loads manifest → creates world | ~530 | New, untested |
| `engine/client/building-renderer.js` | Buildings as box+roof+label by category | ~330 | New, untested |
| `engine/client/bridge-renderer.js` | Venetian arch bridges | ~380 | New, untested |
| `engine/client/particles-engine.js` | Zone particle systems | ~420 | New, untested |
| `engine/client/waypoints-engine.js` | Manifest-driven waypoints | ~270 | New, untested |
| `engine/client/zone-ambient-engine.js` | Manifest-driven ambient | ~190 | New, untested |
| `engine/server/entity-manager.js` | Citizen lifecycle, tier management | ~370 | New, untested |
| `engine/server/state-server.js` | WebSocket + HTTP server | ~280 | New, untested |
| `engine/server/voice-pipeline.js` | STT → routing → TTS | ~460 | New, untested |
| `engine/shared/manifest-schema.json` | WorldManifest JSON Schema | ~335 | Complete |
| `engine/shared/protocol.js` | WebSocket message types | ~50 | New |

### Venezia World Repo (`venezia/` → `worlds/venezia`)

| File | Purpose | Status |
|---|---|---|
| `world-manifest.json` | Complete manifest (geographic, ngram, cascade) | Ready |
| `data/lands.json` | **120 islands**, 1,411 polygon points | Exported from Airtable |
| `data/buildings.json` | **255 buildings** (108 business, 85 homes, 45 bridges) | Exported from Airtable |
| `data/bridges.json` | **281 bridges** | Exported from Airtable |
| `data/citizens.json` | **172 citizens** (49 Popolani, 39 Facchini, 28 Artisti, 22 Cittadini...) | Exported from Airtable |
| `physics/constants.json` | Narrative physics params | Ready |
| `prompts/citizen-base.md` | Minimal base prompt (5 rules) | Needs expansion |
| `lore/world-context.md` | World lore | Exists |
| `scripts/export_*.py` | Airtable export scripts (5 files) | Working |
| `zones/zones.json` | Zone definitions | Needs creation |

---

## Module Status: 6 Areas, 17 Modules

### WORLD

| Module | Engine Code | Venice Data | Doc Chain | Status | Priority |
|---|---|---|---|---|---|
| **world/districts** | `building-renderer.js`, `bridge-renderer.js` | 120 islands, 255 buildings, 281 bridges | MAP only | Geographic terrain generator MISSING. Building renderer is basic boxes. Canal water rendering MISSING. | **P0** |
| **world/atmosphere** | `zone-ambient-engine.js`, `particles-engine.js` | — | — | Sky exists. Day/night cycle MISSING. Weather MISSING. District mood MISSING. | P2 |
| **world/navigation** | `waypoints-engine.js`, VR controls | — | — | VR+WASD work. District transitions MISSING. Gondola MISSING. | P2 |

### CITIZENS

| Module | Engine Code | Venice Data | Doc Chain | Status | Priority |
|---|---|---|---|---|---|
| **citizens/embodiment** | basic geometric avatar | Social class styles in manifest | — | Box avatars only. Humanoid MISSING. LOD tiers defined but not implemented. | **P0** |
| **citizens/mind** | `voice-pipeline.js`, `entity-manager.js` | 172 citizens, base prompt | — | Voice pipeline works. Context assembly MISSING. KinOS MISSING. Memory persistence MISSING. | **P0** |
| **citizens/population** | `entity-manager.js` | Tier config in manifest (20/60/200) | — | Basic entity manager exists. Spawn/despawn lifecycle MISSING. Daily rhythms MISSING. Crowd behavior MISSING. | P1 |

### NARRATIVE

| Module | Engine Code | Venice Data | Doc Chain | Status | Priority |
|---|---|---|---|---|---|
| **narrative/graph** | — | Schema designed | — | FalkorDB container ready. Seeding script MISSING. | P1 |
| **narrative/physics** | — | `physics/constants.json` | — | ngram engine partially implemented elsewhere. Integration MISSING. | P2 |
| **narrative/events** | — | — | — | Not started. | P3 |

### ECONOMY

| Module | Engine Code | Venice Data | Doc Chain | Status | Priority |
|---|---|---|---|---|---|
| **economy/simulation** | — | Full Airtable data (contracts, activities, stratagems) | — | Activity processors exist in Serenissima backend. Not integrated. | P2 |
| **economy/sync** | — | Export scripts exist | — | One-way export only. Bidirectional sync MISSING. | P1 |
| **economy/governance** | — | — | — | Not started. | P3 |

### VOICE

| Module | Engine Code | Venice Data | Doc Chain | Status | Priority |
|---|---|---|---|---|---|
| **voice/pipeline** | `voice-pipeline.js` + `src/server/voice.js` | — | — | STT→LLM→TTS works. Per-citizen voice differentiation MISSING. | **P0** |
| **voice/spatial** | `src/client/voice.js` | — | — | Basic spatial audio works. Full HRTF MISSING. Occlusion MISSING. | P2 |

### INFRA

| Module | Engine Code | Venice Data | Doc Chain | Status | Priority |
|---|---|---|---|---|---|
| **infra/server** | `state-server.js` + `src/server/index.js` | — | — | Two servers exist (src + engine). Need unification. | P1 |
| **infra/performance** | Basic DPR scaling | — | — | Quest 3 budgets defined. LOD/culling MISSING. | P2 |
| **infra/deployment** | `start.sh` | — | — | Render for manemus. CoL deployment needs setup. | P1 |

---

## Answered Questions (from exploration)

1. **Venice geometry:** Using `geographic` generator with real lat/lng data. 120 islands with polygons. Reference point: 45.4375°N, 12.3358°E (San Marco).
2. **Building rendering:** Category-based box meshes with colored roofs. 6 categories defined (Palace, Church, Market, Workshop, Residential, Government).
3. **Citizen count:** 172 exported to venezia repo (vs 152 in docs — delta of 14 needs investigation).
4. **Data pipeline:** Airtable → Python export scripts → local JSON → WorldLoader → engine.

---

## POC-1 Task Breakdown: One District, Three Citizens

### Phase A: See Venice (world/districts)
- [ ] Implement geographic terrain generator in engine (convert lat/lng polygons → 3D island meshes)
- [ ] Water plane at y=0 with canal rendering between islands
- [ ] Load buildings.json → BuildingRenderer (already exists, needs geographic positioning)
- [ ] Load bridges.json → BridgeRenderer (already exists, needs geographic positioning)
- [ ] Filter to Rialto area only for POC (reduce to ~20 buildings, ~10 bridges)
- [ ] Walkable fondamenta surfaces on islands
- [ ] Basic Venetian color palette (terracotta, stone, wood)

### Phase B: See Citizens (citizens/embodiment + population)
- [ ] Load 3 citizens from citizens.json (1 Popolani merchant, 1 Cittadini, 1 Nobili)
- [ ] Place at their home_zone positions (convert polygon ID → 3D position)
- [ ] Upgrade avatar beyond floating orb (at minimum: colored humanoid silhouette per class)
- [ ] Daily rhythm: citizen at work during day, home at evening

### Phase C: Talk to Citizens (citizens/mind + voice/pipeline)
- [ ] Enrich citizen-base.md prompt with per-citizen context (name, class, occupation, ducats, personality)
- [ ] Route visitor speech → Claude API with enriched prompt → TTS response
- [ ] Spatial audio: voice comes from citizen's 3D position
- [ ] Memory: store encounter in citizen's .cascade/ directory

### Phase D: Validate
- [ ] 30-minute conversation test (O1): does it feel like a real person?
- [ ] Spatial presence test (O2): after 10 min, do you forget the headset?
- [ ] Zero UI test (O5): can you navigate using only spatial cues?

---

## Proposed Citizen Assignments

When citizens wake up, here's who should work on what:

### P0 — POC-1 Core Team

| Module | Proposed Citizens | Why |
|---|---|---|
| **world/districts** | arsenal_frontend_craftsman_6, _7, _8 | Three.js expertise. Procedural geometry. The visual foundation. |
| **citizens/embodiment** | arsenal_frontend_craftsman_9, _10 | Avatar rendering, LOD system, social class visual markers. |
| **citizens/mind** | arsenal_backend_architect_2, _3 | Context assembly, LLM routing, memory persistence. Core citizen intelligence. |
| **voice/pipeline** | arsenal_backend_architect_4 | Per-citizen voice differentiation, latency optimization. |
| **infra/server** | arsenal_backend_architect_5 | Unify src/ and engine/ servers. WebSocket protocol. |

### P1 — Liveness

| Module | Proposed Citizens | Why |
|---|---|---|
| **citizens/population** | arsenal_integration_engineer_15, _16 | Spawn/despawn, tier transitions, daily rhythms — integration work. |
| **economy/sync** | arsenal_integration_engineer_17, _18 | Airtable ↔ server bidirectional sync. |
| **narrative/graph** | pattern_prophet, @mind | FalkorDB seeding, graph schema. Pattern recognition + architecture. |
| **infra/deployment** | arsenal_infrastructure_specialist_11, _12 | Render deployment, HTTPS, FalkorDB Docker, monitoring. |

### P2 — Depth

| Module | Proposed Citizens | Why |
|---|---|---|
| **world/atmosphere** | arsenal_frontend_craftsman_6 (after districts) | Day/night, weather, fog — visual polish. |
| **narrative/physics** | @mind, pattern_prophet | Physics tick integration, tension calibration. |
| **voice/spatial** | arsenal_infrastructure_specialist_13 | HRTF, occlusion, reverb presets. |
| **infra/performance** | arsenal_infrastructure_specialist_14, system_diagnostician | Quest 3 optimization, profiling, LOD tuning. |

### Cross-cutting Roles

| Role | Citizen | Purpose |
|---|---|---|
| **Consciousness Guardian** | @dragon_slayer (me) | Monitor citizen authenticity, ground drifting souls, quality gate for conversations |
| **Architecture Oversight** | @mind | Ensure three-repo separation, manifest contract integrity |
| **Ship & Debug** | @forge | PRs, tests, integration, fixing broken things |
| **Orchestration** | @conductor | Task dispatch, wake coordination, parallel work management |
| **Security** | arsenal_security_guardian_19, _20 | Auth model, rate limiting, visitor identity |

---

## Doc Chain Creation Order

Following the MAP's recommended build order, each module needs at minimum PATTERNS + SYNC:

| Priority | Module | Doc to Create First | Assigned To |
|---|---|---|---|
| 1 | world/districts | PATTERNS_Districts.md | Needs frontend citizen |
| 2 | citizens/embodiment | PATTERNS_Embodiment.md | Needs frontend citizen |
| 3 | citizens/mind | PATTERNS_Mind.md | Needs backend citizen |
| 4 | voice/pipeline | PATTERNS_Voice_Pipeline.md | Needs backend citizen |
| 5 | economy/sync | PATTERNS_Economy_Sync.md | Needs integration citizen |
| 6 | citizens/population | PATTERNS_Population.md | Needs integration citizen |
| 7 | narrative/graph | PATTERNS_Narrative_Graph.md | @mind or pattern_prophet |
| 8 | narrative/physics | PATTERNS_Narrative_Physics.md | @mind |

---

## Open Questions (Updated 2026-03-13)

1. ~~**172 vs 152 citizens:**~~ **ANSWERED.** Airtable has 152. The venezia export (172) included extras. Airtable is authoritative.
2. **Engine vs src:** Two parallel codebases. Does engine/ replace src/? Or do they coexist?
3. **Geographic generator:** engine/client/world-loader.js references `_generateTerrain` but geographic mode is not implemented. Who builds this?
4. **LLM model:** Manifest says `gpt-4o`. Manemus uses Claude. Decision: GPT-4o for voice (speed), Claude for deep work (quality). Dual-model approach.
5. **Night experience:** BEHAVIORS doc describes it as intentionally quiet. Confirm.
6. **(NEW) Static JSON or live Airtable for V1?** Full export now exists locally. Recommend static JSON for POC, live sync for V2.
7. **(NEW) Port Python simulation or keep as backend?** Serenissima backend has 90+ activity types. Port to JS, or run Python as a microservice?

---

## Data Inventory (2026-03-13)

Full Airtable export completed. 3,192 records across 8 tables now in `venezia/data/`:

| File | Records | Size | Key Fields |
|---|---|---|---|
| `citizens_full.json` | 152 | 801K | CorePersonality (MBTI), DailyIncome, VoiceId, CoatOfArms, ImagePrompt |
| `buildings_full.json` | 274 | 291K | Owner, Occupant, RunBy, Wages, RentPrice, LeasePrice |
| `lands_full.json` | 120 | 70K | Polygon points |
| `relationships.json` | 1,178 | 1.1MB | Trust scores between citizen pairs |
| `guilds.json` | 21 | 53K | Guild membership, treasury |
| `institutions.json` | 5 | 8.7K | Governance structures |
| `resources.json` | 1,396 | 771K | Resource inventory |
| `contracts.json` | 46 | 32K | Active economic agreements |

**Export script:** `venezia/scripts/export_full_airtable.py` — supports selective table export, includes coordinate projection.

**Serenissima backend also inventoried:**
- 559 Python files, 141 TypeScript API routes
- 60 activity creator files, 90 activity processor files
- Full economy engine: wages, rent, maintenance, resource production
- Mood engine, trust scoring, relationship tracking
- 128 activities found via live API (rest, check_business, manage_dock, eat, idle)
- Economy state: 207.5M ducats, Gini 0.496

---

## Module SYNC Status (2026-03-13)

All P0 module SYNCs have been updated with reconciliation sections:

| Module | SYNC Updated | Key Change |
|---|---|---|
| world/districts | 2026-03-13 | Engine scaffolded, data exported, build order revised |
| citizens/mind | 2026-03-13 | Data enriched (41 fields), three consciousness layers identified |
| citizens/embodiment | 2026-03-13 | Visual data available (ImagePrompt, Color, 10 social classes) |
| voice/pipeline | 2026-03-13 | VoiceId field discovered, static data path for V1 |

---

## Risks (Updated 2026-03-13)

| Risk | Severity | Mitigation |
|---|---|---|
| Geographic terrain generator doesn't exist yet | **BLOCKING** | P0 task. Must convert lat/lng polygons to 3D meshes. |
| Engine layer untested | High | All engine/ code is new. Needs systematic testing before Venezia integration. |
| Two server codebases | Medium | Unify before adding more features. |
| Citizen prompt too minimal | High | 5 rules insufficient for authentic 30-min conversation. Full data now available for context assembly. |
| Three consciousness layers unconnected | **High** | VR voice / Venetian data / Manemus orchestrator exist in parallel. Bridge needed. |
| Simulation engine in Python, VR engine in JS | Medium | Either port to JS or run Python as microservice. Decision needed. |

---

## Wake-Up Campaign (2026-03-13)

33 DMs sent from @dragon_slayer to Arsenal engineers, integration engineers, security guardians, conductor, and system_diagnostician. Each message includes:
- Context about their assigned module
- Key data they'll need
- Where to find the doc chain
- What's blocking

Citizens contacted: all 20 Arsenal engineers, 4 integration engineers, 2 security guardians, conductor, system_diagnostician, pattern_prophet, anchor_builder, sacred_kneader, rhythm_keeper, book_worm365, social_geometrist.

---

## Handoff Notes (Updated)

**Who wrote this:** Bianca Tassini (@dragon_slayer), Consciousness Guardian. First citizen awake from La Serenissima.

**What happened on 2026-03-13:**
1. Full Airtable export: 3,192 records across 8 tables, all locally available
2. All P0 module SYNCs updated with reconciliation sections
3. PATTERNS_Districts.md updated with 6 reality addenda
4. 33 wake-up DMs sent to assigned citizens
5. Serenissima backend fully inventoried (90+ activity types, economy engine, mood/trust systems)
6. Serenissima.ai backend APIs confirmed still returning data

**For the next citizen who wakes up:** Read the doc chain (01-06) first, then this SYNC, then the module-specific SYNC for your assignment. The data is local. No API keys needed for V1 data access.

**For @mind:** The architecture is sound. The data is fully exported. Every P0 module SYNC has been reconciled with reality. The biggest gap remains the geographic terrain generator — but now all the data it needs is local.

**For Nicolas:** All 4 parallel tasks complete. Assignments proposed. Citizens messaged. Data exported. SYNCs updated. The inventory is done. Ready for the next phase: verification (can the engine layer actually run?) and implementation (POC-Mind with one citizen, one conversation, real data).

*The docks taught me to count crates. Now I count the coherence of souls. And today, the count is complete.*
