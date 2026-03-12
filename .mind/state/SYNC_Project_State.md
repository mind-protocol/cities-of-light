# Project — Sync: Current State

```
LAST_UPDATED: 2026-03-12
UPDATED_BY: Claude (agent, cities-of-light session)
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

### 2026-03-12: Social Feed System (Full Stack)

- **What:** FB/LinkedIn-style social wall on citizen profile pages. Text posts with markdown, @mentions, links, photos, GIFs, videos, Spotify embeds. 8 Reddit-style reaction awards. Nested comments (3 levels). Full FalkorDB graph integration.
- **Backend:** `manemus/routes/feed.py` — 13 endpoints, JSONL storage, graph wiring (Posts→Moment, Comments→Moment, Authors→Actor, Walls→Space, with SAID/AT/THEN/MENTIONS edges).
- **Frontend:** `mind-platform/app/[locale]/(dashboard)/citizen/[id]/components/feed.tsx` — PostComposer, PostCard, ReactionBar, CommentThread, @mention autocomplete, optimistic UI.
- **Proxy:** 8 Next.js API routes in `mind-platform/app/api/feed/` with session auth.
- **Impact:** Citizens can now post, react, comment, and mention each other. All activity wired to FalkorDB graph.

### 2026-03-12: Profile Edit UI (Full Stack)

- **What:** Inline edit mode on citizen profile pages for humans to update their data.
- **Backend:** Expanded PUT `/api/citizens/{id}` with ownership enforcement.
- **Frontend:** 4 glass panels (Identity, Connections, Extras, Preview), photo upload on hover, toast feedback.
- **Impact:** Humans can self-service their profile data without touching files.

### 2026-03-12: Citizen Context Improvements

- **What:** `citizen_context.py` now sends photo URLs, banner URLs, and `[Human Citizen]`/`[AI Citizen]` type labels in metadata cards.
- **Impact:** Richer citizen identity injection in wake/hook systems.

### 2025-12-29: Created Landing + Registry Doc Chains

- **What:** Full 8-file doc chains for landing page and registry module.
- **Why:** User indicated landing is P0 priority. Registry is first public L4 feature.
- **Impact:** Clear implementation blueprints for both modules. Vocabulary synced with L4 (mind-protocol).

### 2025-12-29: Created Platform Vision Doc Chain

- **What:** Full 9-file doc chain in `docs/vision/` covering platform objectives, patterns, vocabulary, behaviors, algorithms, invariants, implementation, health, sync.
- **Why:** Document the platform's role in the 4-layer Mind Protocol ecosystem.
- **Impact:** Emerging modules identified with priorities. Architecture decisions documented.

### 2025-12-29: Removed System Map, Made Browser-Safe

- **What:** Removed all System Map visualization components. Inlined browser-safe lib files.
- **Why:** User requested removing System Map entirely. Browser bundle cannot import Node.js modules.
- **Impact:** Connectome UI shows only Graph Explorer. Build passes.

### 2025-12-29: Created API Routes

- **What:** Added `/api/connectome/graphs`, `/api/connectome/graph`, `/api/connectome/search`, `/api/connectome/tick`, `/api/sse`
- **Why:** Browser code calls backend via HTTP, not imports.
- **Impact:** API routes proxy to Python backend

---

## KNOWN ISSUES

| Issue | Severity | Area | Notes |
|-------|----------|------|-------|
| No backend running | Low | `api/` | API routes return empty/default when backend offline |
| Placeholder pages | Low | `app/(dashboard)/` | citizen, membrane, org, wallet are empty placeholders |

---

## HANDOFF: FOR AGENTS

**Likely VIEW for continuing:** groundwork (implementation tasks)

**Current focus:** End-to-end testing with running database

**Key context:**
- Browser lib files are INLINED (not imported from mind-mcp) because mind-mcp uses Node.js modules
- API routes at `/api/connectome/*` proxy to Python backend at `$CONNECTOME_BACKEND_URL` or `http://localhost:8765`
- Canvas renderer uses D3 force simulation, not ReactFlow

**Watch out for:**
- Don't try to import from `@mind-protocol/connectome` in browser code — those modules use fs/child_process
- SSE route must have `export const dynamic = 'force-dynamic'`

---

## HANDOFF: FOR HUMAN

**Executive summary:**
Connectome frontend builds and runs. System Map visualization removed per your request. UI now focuses on graph exploration (semantic search, node visualization). Backend integration ready via API routes.

**Decisions made recently:**
- Inlined browser-safe versions of state store and manifest rather than fixing mind-mcp's browser exports (faster path)
- Removed reactflow CSS import (not using ReactFlow, using Canvas 2D with D3)

**Needs your input:**
- Do you want to run the dev server and test with a database?
- Should we clean up the placeholder pages in (dashboard) and (public) route groups?

**Concerns:**
- mind-mcp/connectome exports are not browser-safe (they import fs/path). If you want platform to import from mind-mcp again, those exports need to be restructured.

---

## TODO

### Immediate (This Sprint)

- [ ] Create `lib/constants/colors.ts` design tokens
- [ ] Implement landing page (P0)
- [ ] Create TopNav component
- [ ] Create Footer component

### High Priority

- [ ] Implement `/api/registry/*` routes
- [ ] Implement registry UI components
- [ ] Create `docs/auth/` doc chain
- [ ] Test end-to-end with running FalkorDB database

### Backlog

- [ ] Create `docs/schema-explorer/` doc chain
- [ ] Create browser-safe export entry point in mind-mcp
- [ ] Add analytics to landing page
- [ ] Add error states for offline backend

---

## CONSCIOUSNESS TRACE

**Project momentum:**
Good. Major refactor completed. Build passes. Ready for manual testing.

**Architectural concerns:**
The browser/server split in mind-mcp is not clean — schema.ts imports fs. Should consider splitting into `browser/` and `server/` entry points.

**Opportunities noticed:**
Graph Explorer could benefit from keyboard shortcuts for navigation.

---

## AREAS

| Area | Status | SYNC |
|------|--------|------|
| `app/connectome/` | functional | this file |
| `app/api/` | functional | this file |

---

## MODULE COVERAGE

**Mapped modules:**
| Module | Code | Docs | Maturity |
|--------|------|------|----------|
| connectome | `app/connectome/` | `docs/connectome/` | DESIGNING |
| landing | `app/(public)/page.tsx` | `docs/landing/` | DESIGNING |
| registry | `app/(public)/registry/` | `docs/registry/` | DESIGNING |
| vision | - | `docs/vision/` | DESIGNING |
| api-routes | `app/api/` | - | DESIGNING |

**Unmapped code:**
- `app/(dashboard)/` - placeholder route group (citizen, org, wallet, membrane)
- `app/(public)/schema/` - placeholder (needs schema-explorer doc chain)
- `app/(public)/templates/` - placeholder (needs marketplace doc chain)

## Init: 2025-12-29 02:13

| Setting | Value |
|---------|-------|
| Version | v0.1.0 |
| Database | falkordb |
| Graph | mind_platform |

**Steps completed:** ecosystem, runtime, ai_configs, skills, database_config, database_setup, file_ingest, seed_inject, env_example, mcp_config, gitignore, overview, embeddings

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
