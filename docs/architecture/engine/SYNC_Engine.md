# SYNC: architecture/engine — Current State

```
LAST_UPDATED: 2026-03-12
UPDATED_BY: Claude (agent)
```

---

## CURRENT STATE

STATUS: V1 CANONICAL, V2 DESIGNING

### V1 — Engine Core (CANONICAL)

The engine exists as a working codebase in `engine/`. 16 files, fully functional.

**Server-side (3 files):**
- `engine/index.js` — Entry point, manifest loading, entity descriptor loading, HTTP routes
- `engine/server/state-server.js` — Express + WebSocket, client management, AI action routing
- `engine/server/entity-manager.js` — Entity lifecycle, tier assignment, wander, voice routing
- `engine/server/voice-pipeline.js` — STT → EntityManager → TTS pipeline

**Client-side (7 files):**
- `engine/client/app.js` — Browser entry point, Three.js scene, VR, networking
- `engine/client/world-loader.js` — Manifest → terrain → zones → entities → portals
- `engine/client/building-renderer.js` — Building mesh placement with name labels
- `engine/client/bridge-renderer.js` — Arch bridge meshes between points
- `engine/client/zone-ambient-engine.js` — Per-zone atmosphere effects
- `engine/client/waypoints-engine.js` — Inter-zone teleportation
- `engine/client/particles-engine.js` — Zone particle systems
- `engine/client/index.html` — HTML shell

**Shared (2 files):**
- `engine/shared/protocol.js` — 30 WebSocket message type constants
- `engine/shared/manifest-schema.json` — JSON Schema (draft 2020-12) for WorldManifest

**Config (2 files):**
- `engine/vite.config.js` — Dev server config
- `engine/start.sh` — Launcher script

**Verified:** Engine boots with `node engine/index.js --world worlds/venezia/world-manifest.json`, serves /health, /api/manifest, /api/entities correctly.

### V2 — Airtable-Driven Venice (DESIGNING)

Specified in `V2_SPEC_Airtable_Venice.md`. Six features:
1. **F1: Geographic terrain** — Islands from WGS84 polygon data (generator: "geographic")
2. **F2: Buildings at positions** — Named 3D buildings from Airtable BUILDINGS
3. **F3: 3D assets** — Replace procedural buildings with GLTF models
4. **F4: 152 citizens** — All Serenissima citizens with social-class avatars
5. **F5: Bridges** — Arch bridges between islands
6. **F6: Aerial view + AI walk-to** — AI spatial navigation commands

**What's built for V2:**
- WorldManifest V2 schema extended (lands, buildings, bridges sections)
- Protocol extended (AI_WALK_TO, AI_REQUEST_VIEW, AERIAL_VIEW)
- Geographic terrain generator in WorldLoader
- BuildingRenderer client module
- BridgeRenderer client module
- Venezia manifest updated to V2 (geographic generator, data/ paths)
- 5 Airtable export scripts in venezia/scripts/

**What's needed to complete V2:**
- Run export scripts with Airtable API key to generate data/ JSON files
- Test geographic terrain with real polygon data
- Implement aerial view capture (server-side headless render)
- Implement ai_walk_to pathfinding in EntityManager
- Integration test full V2 pipeline

### Canonical decisions

- Three-repo pattern (engine / Manemus / world repos)
- WorldManifest JSON Schema as the contract
- Entity abstraction (not "citizen")
- Physics as plugin (ngram / custom / none)
- Blood Ledger dependency removed
- Manemus as AI substrate, not embedded in engine
- Hub world (Lumina Prime) with portal transitions
- Venezia = separate repo at /home/mind-protocol/venezia/
- V2: Airtable data exported to static JSON (not live API calls)

---

## RECENT CHANGES

### 2026-03-12: V1 Engine + V2 Specification

- **What:** Complete engine V1 (16 files) + V2 spec + V2 schema/protocol/renderers
- **Why:** Nicolas requested reusable XR engine with Airtable-driven Venice as first world
- **Impact:** Engine boots and serves Venezia. V2 components ready for data pipeline.

### 2026-03-12: Architecture Doc Chain Created

- **What:** Full doc chain for architecture/engine module (OBJECTIVES through SYNC)
- **Decision:** Blood Ledger agents are NOT engine components.

---

## HANDOFF: FOR AGENTS

**Likely agent:** groundwork (to run export scripts and test V2 pipeline)

**Current focus:** V2 implementation requires:
1. Airtable API key to run export scripts
2. Test geographic terrain with exported polygon data
3. Wire BuildingRenderer + BridgeRenderer into app.js
4. Implement aerial view + ai_walk_to in EntityManager + StateServer

**Key context:**
- Venezia repo is at /home/mind-protocol/venezia/ (symlinked to worlds/venezia)
- Export scripts need `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID` env vars
- Geographic terrain generator is in WorldLoader, tested structurally but not with real data
- Building/bridge renderers are standalone modules, not yet wired into app.js

---

## HANDOFF: FOR HUMAN

**Executive summary:**
V1 engine complete (16 files, boots and serves Venezia). V2 fully specified: geographic Venice from Airtable data, 152 citizens, buildings, bridges, AI navigation. Schema/protocol/renderers/export scripts all created. Next step: provide Airtable API key to run data export and test the full V2 pipeline.

**To run V2 export:**
```bash
cd /home/mind-protocol/venezia
export AIRTABLE_API_KEY=your_key
export AIRTABLE_BASE_ID=your_base_id
pip install pyairtable python-dotenv
python scripts/export_all.py
```

---

## TODO

### Immediate
- [ ] Run export scripts with Airtable credentials → generate data/*.json
- [ ] Wire BuildingRenderer + BridgeRenderer into engine/client/app.js
- [ ] Test geographic terrain with real polygon data

### High Priority
- [ ] Implement aerial_view capture (headless Three.js render on server)
- [ ] Implement ai_walk_to pathfinding in EntityManager
- [ ] Add building_id lookup to EntityManager.handleExternalAction()

### Backlog
- [ ] 3D building assets (GLTF models replacing procedural)
- [ ] Interior navigation for buildings
- [ ] Live Airtable sync for citizen positions
- [ ] Unity client protocol spec
- [ ] Mobile PWA client

---

@mind:TODO Run Airtable export scripts and test V2 geographic pipeline
@mind:TODO Wire renderers into app.js client
