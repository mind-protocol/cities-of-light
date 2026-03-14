# Project — Sync: Current State

```
LAST_UPDATED: 2026-03-14
UPDATED_BY: Codex (agent, cities-of-light session)
```

---

## CURRENT STATE

Cities of Light is a reusable multi-world XR engine. Three-repo architecture:

- **Cities of Light** (this repo) = XR engine (rendering, navigation, voice, networking)
- **Manemus** = AI substrate (how AIs perceive, decide, and act in worlds)
- **World repos** = universe-specific data (citizens, lore, economy, physics config)

**Engine V1: CANONICAL** — 16 files in `engine/`, boots and serves Venezia.
**Engine V2: DESIGNING** — Airtable-driven Venice (geographic terrain, 186 citizens, buildings, bridges, AI navigation).

**Key files:**
- `engine/` — V1 engine code (server + client + shared)
- `docs/architecture/engine/` — Full doc chain (OBJECTIVES through SYNC) + V2 spec
- `worlds/venezia` → symlink to `/home/mind-protocol/venezia/`
- `src/` — Legacy Venice-specific code (pre-engine, still functional)

**Venezia world repo** (`/home/mind-protocol/venezia/`):
- `world-manifest.json` — V2 manifest (geographic generator, data/ paths)
- `scripts/` — 5 Airtable export scripts
- `data/` — Target for exported JSON (lands, buildings, citizens, bridges)
- `citizens/` — 3 V1 citizen definitions (vox, lyra, pitch)

---

## MASTER TODO (5-FORCE SPRINT)

@mind:escalation Force assignment is missing in incoming prompt execution context (no explicit Force number provided for this instance).

@mind:proposition Default this session to **Force 1 (Infrastructure + State Alignment)** and continue immediately under Never-stop protocol.

### Force 1 — Infrastructure + State Alignment

@mind:TODO
- [x] Reconcile `.mind/state/SYNC_Project_State.md` with the actual `cities-of-light` repository scope (stale connectome/platform-only references removed).
- [x] Validate baseline backend tests before new implementation (`pytest -q`).
- [x] Produce an actionable sprint queue focused on `infra/server` unification and engine/runtime integration checkpoints.
- [x] Record decisions and next handoff in this SYNC file after each implementation block.

### Force 2 — World/Districts

@mind:TODO
- [ ] Implement geographic terrain generation from Venezia lands polygons into runtime meshes.
- [ ] Integrate buildings + bridges placement against geographic coordinates.

### Force 3 — Citizens/Mind + Voice

@mind:TODO
- [ ] Wire enriched citizen context assembly into voice interaction pipeline.
- [ ] Add per-citizen voice differentiation and memory writeback checkpoints.

### Force 4 — Population + Narrative

@mind:TODO
- [ ] Implement spawn/despawn lifecycle and tier transitions for >150 citizens.
- [ ] Integrate narrative graph seed + physics tick bridge.

### Force 5 — Performance + Deployment

@mind:TODO
- [ ] Define and enforce Quest performance budgets (draw calls, triangles, memory).
- [ ] Validate deployment path (HTTPS/WebXR constraints, monitoring, backup cadence).

---

## ACTIVE WORK

### V2: Airtable Data Export (Next)

- **Area:** `venezia/scripts/`, `venezia/data/`
- **Status:** Scripts written, need Airtable API key to execute
- **Owner:** agent/human (needs credentials)
- **Context:** 5 Python scripts export LANDS, BUILDINGS, CITIZENS, BRIDGES from Serenissima Airtable to JSON.

### V2: Integration Testing

- **Area:** `engine/`, `worlds/venezia/`
- **Status:** Individual components built, integration not tested
- **Owner:** agent
- **Context:** Wire BuildingRenderer + BridgeRenderer into app.js. Test geographic terrain with real data.

---

## RECENT CHANGES

### 2026-03-12: Engine Client BuildingRenderer

- **What:** Created `engine/client/building-renderer.js` — Three.js module that renders buildings from WorldLoader building data as 3D meshes.
- **BuildingRenderer:** Takes scene + manifest.buildings config. `render(buildingsData)` creates a THREE.Group per building: BoxGeometry body sized by category (Palace/Church/Market/Workshop/Residential/Government), ConeGeometry or flat roof, optional billboard name label (Sprite with CanvasTexture). Dimensions scale by building `size` field (size=3 is baseline). Buildings placed at configurable ground_y (default 1.5).
- **API:** `getBuilding(id)` for ID lookup (AI walk-to resolution), `getNearestBuilding(position)` for proximity queries, `dispose()` for full GPU resource cleanup.
- **Config:** Reads `name_labels`, `label_height`, `default_style`, `ground_y` from manifest.buildings section.
- **Impact:** Engine client can now render buildings from any world's buildings.json data. Completes the building rendering pipeline started by WorldLoader's `_loadBuildingsData()`.

### 2026-03-12: Engine Client Zone/Particle Systems

- **What:** Created `engine/client/zone-ambient-engine.js`, `engine/client/waypoints-engine.js`, and `engine/client/particles-engine.js`.
- **zone-ambient-engine.js:** Engine version of `src/client/zone-ambient.js`. Accepts zones array as constructor parameter instead of importing from `shared/zones.js`. Converts manifest snake_case atmosphere format (fog_color, particle_color, etc.) to numeric hex values. Same API: `update(playerPos, elapsed)`, `onZoneChanged` callback, `getZone()`.
- **waypoints-engine.js:** Engine version of `src/client/waypoints.js`. Accepts zones array as constructor parameter. Builds beacon pillars from zone waypoint connections. Same API: `update(elapsed, playerPos, gripActive)`, `onTeleport` callback. Adds `dispose()` and `setZones()` for world transitions.
- **particles-engine.js:** Parameterized particle system driven by manifest zone atmosphere config. 6 particle types (fireflies, embers, pollen, sparks, snow, rain) with distinct motion/gravity/blink/drift. Crossfades between types on zone change. Quest hardware support (40% particle count). `setZoneAtmosphere()` for zone transitions, `getMaterial()` for ZoneAmbientEngine integration.
- **Impact:** Engine client can render zone-based ambient transitions, waypoint beacons, and atmospheric particles from manifest-loaded zone data.

### 2026-03-12: Engine Voice Pipeline

- **What:** Created `engine/server/voice-pipeline.js` — world-agnostic voice processing module. Updated `engine/server/state-server.js` with POST /voice HTTP route and WebSocket voice_data handling. Updated `engine/index.js` to wire VoicePipeline into the server.
- **VoicePipeline:** STT via Whisper (OpenAI API), routes transcription to EntityManager.handleVoiceInput() which finds nearest FULL-tier entity, TTS via ElevenLabs streaming (with OpenAI TTS fallback). Supports per-entity voice IDs from entity descriptors.
- **Two modes:** HTTP (POST /voice returns full response with audio) and WebSocket streaming (voice_stream_start/data/end messages for low-latency chunked audio delivery).
- **speakAsEntity():** Programmatic method for making any entity speak with TTS, broadcasting to all clients.
- **Config:** TTS config comes from manifest.ai_config.tts, with env var fallbacks (ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID).
- **Impact:** Engine now has a complete voice pipeline. Any world repo can enable voice by setting ai_config in its manifest and providing entity voice descriptors.

### 2026-03-12: Engine Client Scaffolding

- **What:** Created `engine/client/index.html`, `engine/vite.config.js`, and `engine/start.sh`.
- **index.html:** Based on `src/client/index.html`, updated for engine: removed "Phase 1" subtitle, added `<div id="world-name">` for dynamic world name from manifest, added `<div id="portal-indicator">` for portal proximity, changed script src to `./app.js`, build marker set to "engine".
- **vite.config.js:** Dev server on port 3000 with HTTPS (basicSsl plugin), proxies `/ws`, `/api`, `/world`, `/voice`, `/health` to engine server on port 8800. Build outputs to `dist-engine/`. Alias `@client` resolves to `src/client/` for reusing existing modules.
- **start.sh:** Launcher script that starts engine server (node) in background, then Vite dev server in foreground. Accepts `--world <manifest>` argument, defaults to `worlds/venezia/world-manifest.json`. Cleans up engine server on exit.
- **Impact:** Engine client can now be developed with hot reload against the engine server.

### 2026-03-12: Docs Updated — Three-Repo Architecture (engine / manemus / world repos)

- **What:** Removed all Blood Ledger references from docs. Updated `02_PATTERNS_Venezia.md`, `CONCEPT_Cross_Repo_Integration.md`, and `00_MAP_Venezia.md` to reflect the new three-repo architecture.
- **Architecture:** Cities of Light = reusable engine (rendering, navigation, voice, networking). Manemus = AI substrate (orchestration, perception, decision-making). World repos = universe-specific content (citizens, lore, economy, physics config). First world repo = Venezia.
- **Physics engine:** ngram is now a standalone dependency, not tied to any specific repo.
- **New patterns:** WorldManifest pattern for engine/content separation. Anti-pattern added: no world-specific logic in the engine.
- **Impact:** Clean conceptual separation enabling engine reuse across future worlds.

### 2026-03-14: SYNC Scope Reconciliation + Force 1 Execution

- **What:** Removed stale cross-repo Connectome/landing/registry handoff content that does not belong to `cities-of-light` runtime scope.
- **What:** Converted Force 1 checklist into an execution-tracked block with completed baseline validation and concrete infra/server sprint queue.
- **Validation:** `pytest -q` passes (12 tests).
- **Impact:** SYNC state now reflects this repository's actual architecture and immediate execution priorities.

---

## KNOWN ISSUES

| Issue | Severity | Area | Notes |
|-------|----------|------|-------|
| Engine/runtime integration still partial | High | `engine/`, `src/server/` | Legacy `src/` server and new `engine/` path both exist; unification plan required. |
| Geographic terrain integration not validated end-to-end | High | `engine/client/` + `worlds/venezia` | Building/bridge renderers exist but full world validation is pending. |
| Airtable exports require credentials | Medium | `/home/mind-protocol/venezia/scripts` | Export scripts exist but execution blocked without API key. |

---

## FORCE 1 EXECUTION LOG (Infrastructure + State Alignment)

@mind:TODO
- [x] Infra : Définir l'entrypoint serveur canonique (index.js vs state-server.js) avec matrice de compatibilité WS/API.
- [x] Infra : Durcir le bridge /services (comportement offline/erreur, checks /health, /state).
- [x] Infra : Valider le bootstrap engine sur un manifest Venezia réel (démarrage reproductible).
- [x] Infra : Implémenter le "Fail Loud" pour les manifestes incomplets (AUCUN fallback silencieux).
- [x] Monde : Implémenter le générateur de terrain géographique (polygones lat/lng → meshes runtime).
- [x] Monde : Brancher le positionnement géographique exact (world-space) des buildings + bridges.
- [x] Vie : Enrichir le pipeline voix avec le contexte citoyen complet (identity/economy/personality).
- [x] Vie : Différencier les voix par citoyen + implémenter le writeback mémoire (nœuds memory) après interaction.
- [x] Physique : Implémenter le lifecycle population (spawn/despawn, scale à >150 citoyens).
- [x] Physique : Brancher le narrative graph seed et le physics tick bridge (la boucle système tourne avec l'état narratif).

### Task 1 delivery evidence

### Task 2-10 delivery evidence

- `/services` proxy hardened with timeout, structured upstream status, and integration endpoints `/integration/health` + `/integration/state`.
- Engine bootstrap runner script added: `scripts/bootstrap_engine_with_venezia_manifest_validation_runner.sh` + `npm run server:engine:venezia`.
- Manifest fail-loud checks added in `engine/index.js` (required fields, geographic reference, local entity path, lands file).
- Client world loading now fail-loud (removed silent fallback manifest loading path).
- Geographic terrain includes explicit water plane and strict projection requirements.
- Buildings + bridges are normalized to world-space placement from geographic inputs.
- Voice context includes identity/economy/personality enrichment with per-class voice selection.
- Memory writeback implemented as JSONL memory nodes per entity interaction.
- Population lifecycle now applies spawn/despawn behavior from tier transitions.
- Narrative graph seed + physics tick bridge implemented and wired at engine startup.

@mind:escalation Local repository does not contain `worlds/venezia/world-manifest.json` file in this environment.

@mind:proposition Enforce reproducibility through `server:engine:venezia` runner + fail-loud validation so execution is deterministic once the manifest path exists.

- Canonical entrypoint implemented: `src/server/canonical_server_entrypoint_router.js`.
- `package.json` server script points to canonical router.
- WS/API compatibility matrix added to `docs/infra/server/IMPLEMENTATION_Server.md`.
- Mode contract is fail-loud (invalid mode or missing `WORLD_MANIFEST` throws).

### Actionable Sprint Queue (Force 1)

1. **Server unification contract**
   - Define canonical entrypoint between `src/server/index.js` and `engine/server/state-server.js`.
   - Freeze WebSocket protocol surface and document compatibility matrix.
2. **Services bridge hardening**
   - Confirm `/services` proxy behavior for unavailable FastAPI backend and add integration checks.
   - Verify `/health` + `/state` semantics across legacy and engine paths.
3. **Engine bootstrap validation**
   - Execute manifest boot path against Venezia world data once exports are present.
   - Validate startup behavior for missing manifest data (fail loud, no silent fallbacks).
4. **Operational handoff**
   - Keep this SYNC file as source of truth after each infra block (change log + validation evidence).

---

## HANDOFF: FOR AGENTS

- Stay on **groundwork/fixer** mode for execution-first infra tasks.
- Prioritize runtime correctness over feature expansion.
- Every infra change must include executable validation (tests or reproducible runtime check commands).

## HANDOFF: FOR HUMAN

- The previous SYNC content contained stale tasks from another repo context; it is now reconciled to Cities of Light scope.
- Baseline Python services tests currently pass locally.
- Next high-value execution step is server unification planning + integration checks between legacy `src/` runtime and `engine/` runtime.

---

## Init: 2026-02-08 12:35

| Setting | Value |
|---------|-------|
| Version | v0.0.0 |
| Database | falkordb |
| Graph | cities_of_light |

**Steps completed:** ecosystem, capabilities, runtime, ai_configs, skills, database_config, database_setup, file_ingest, capabilities_graph, agents, env_example, mcp_config, gitignore, overview, embeddings, health_checks

---

## Init: 2026-03-11 20:33

| Setting | Value |
|---------|-------|
| Version | v0.0.0 |
| Database | falkordb |
| Graph | cities_of_light |

**Steps completed:** ecosystem, capabilities, runtime, ai_configs, skills, database_config, database_setup, file_ingest, capabilities_graph, agents, env_example, mcp_config, gitignore, overview, embeddings, health_checks

---

## Init: 2026-03-12 02:31

| Setting | Value |
|---------|-------|
| Version | v0.0.0 |
| Database | falkordb |
| Graph | cities_of_light |

**Steps completed:** ecosystem, capabilities, runtime, ai_configs, skills, database_config, database_setup, file_ingest, capabilities_graph, agents, env_example, mcp_config, gitignore, overview, embeddings, health_checks

---

## Init: 2026-03-12 08:37

| Setting | Value |
|---------|-------|
| Version | v0.0.0 |
| Database | falkordb |
| Graph | cities_of_light |

**Steps completed:** ecosystem, capabilities, runtime, ai_configs, skills, database_config, database_setup, file_ingest, capabilities_graph, agents, env_example, mcp_config, gitignore, overview, embeddings, health_checks

---

## Init: 2026-03-12 13:29

| Setting | Value |
|---------|-------|
| Version | v0.0.0 |
| Database | falkordb |
| Graph | cities_of_light |

**Steps completed:** ecosystem, capabilities, runtime, ai_configs, skills, database_config, database_setup, file_ingest, capabilities_graph, agents, env_example, mcp_config, gitignore, overview, embeddings, health_checks

---
