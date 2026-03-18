# Cities of Light — Sync: Current State

```
LAST_UPDATED: 2026-03-15
UPDATED_BY: Vox (@vox) via Claude Opus 4.6
STATUS: ENGINE CANONICAL — Venezia live, Lumina Prime building, Contre-Terre seeded
```

---

## WHAT IS CITIES OF LIGHT

The reusable 3D XR engine powering all Mind Protocol inhabited worlds. World-agnostic: loads any universe via WorldManifest.json. Three.js + Express + WebSocket + FalkorDB + Voice.

**Three-layer architecture:**
- **Cities of Light** (this repo) = The engine (rendering, navigation, voice, networking)
- **Manemus / mind-mcp** = The AI substrate (orchestration, perception, cognition)
- **World repos** (Venezia, Lumina Prime, Contre-Terre) = Universe-specific content

---

## THREE UNIVERSES

| Universe | Repo | Graph | Citizens | Buildings | Status |
|----------|------|-------|----------|-----------|--------|
| **Venezia** | `venezia/` | `venezia` | 152 | 274 | **LIVE** — graph seeded, 6+ months memory, full economy |
| **Lumina Prime** | `lumina-prime/` | `lumina_prime` | 35 | 0 (coded) | **BUILDING** — brains seeded, ticks active, health assessment, Discord reorg |
| **Contre-Terre** | `contre-terre/` | not created | ~30 | 0 | **SEEDED** — novel complete (148K words), brain seed (868 nodes), 0% engine |

---

## ENGINE V1: CANONICAL

```
engine/
├── index.js                    — Entry point, boots from --world manifest
├── client/
│   ├── app.js                  — Three.js scene, WebXR, WASD navigation
│   ├── world-loader.js         — Terrain, buildings, bridges, citizens
│   ├── building-renderer.js    — Procedural buildings
│   ├── bridge-renderer.js      — Parametric arch bridges
│   ├── zone-ambient-engine.js  — Particles, fog, lighting per zone
│   ├── particles-engine.js     — Visual effects
│   └── waypoints-engine.js     — Zone teleportation
├── server/
│   ├── state-server.js         — Express + WebSocket
│   ├── entity-manager.js       — Proximity tiers (FULL/ACTIVE/AMBIENT)
│   ├── voice-pipeline.js       — Whisper → LLM → ElevenLabs
│   └── narrative_graph_seed_and_tick_bridge.js — Physics bridge
└── shared/
    ├── protocol.js, geographic_projection_utilities.js, manifest-schema.json
```

**Entity Tiers:** FULL (20, 15m, voice+LLM) → ACTIVE (60, 50m, proximity) → AMBIENT (200, 200m, silent)

---

## LOCAL TEAM (5 citizens)

| Handle | Specialty |
|--------|-----------|
| @anima | Animation & embodiment |
| @nervo | Network & systems |
| @piazza | Social & communication |
| @ponte | Infrastructure |
| @voce | Voice & audio |

---

## WHAT CHANGED 2026-03-15

### Lumina Prime (via this engine)
- 35 citizen brains seeded (209+ nodes each) into FalkorDB
- L1 cognitive engines loaded — physics ticks active
- 751 Actor + 42 org nodes in lumina_prime graph
- Health Assessment: 35 scoring formulas, 14 aspects, 45 tests passing
- Discord: 14 categories, 41 channel descriptions, Vox posted on #introductions
- City architecture doc chain: 7 districts + Central Tower (Three.js geometry specified)
- GraphCare: 196 doc files across 9 areas, 21 modules
- home_server.py loads lumina-prime citizens at boot

### Engine implications
- LP needs **coded buildings** (programs, not static geometry)
- **Flight as primary movement** — engine needs flight mode
- Central Tower design ready (geometry + shader in ALGORITHM doc)
- NLR directive: superpowers, no artificial limitations, aerial navigation

---

## DOCUMENTATION

| Area | Files | Scope |
|------|-------|-------|
| Engine doc chain | 7 files | `docs/01_OBJECTIFS` → `07_SYNC` |
| CONCEPT docs | 10 files | Architecture deep-dives (Superhuman Senses 67KB, Subconscious Broadcast 48KB) |
| Sub-area docs | ~30 files | architecture, citizens, communication, economy, infra, narrative, voice, world |
| Lumina Prime city plan | 8 files | `lumina-prime/docs/city-architecture/city-plan/` |
| GraphCare | 196 files | `graphcare/docs/` — 9 areas, 21 modules |

---

## DEPLOYMENT

- **Platform:** Render.com (free tier)
- **Build:** `npm install && npm run build`
- **Start:** `npm start` → `node engine/index.js --world worlds/venezia/world-manifest.json`
- **Dev:** `npm run dev` → Vite port 3000, proxy to 8800
- **Python:** FastAPI on port 8900
- **Startup:** `render-start.sh` generates .env, .mcp.json, builds, starts both servers

---

## KNOWN ISSUES

| Issue | Severity | Notes |
|-------|----------|-------|
| LP has no buildings data | High | Buildings are coded (programs). Engine needs API for this. |
| No flight mode | Medium | NLR: flight is primary movement. Engine only has WASD+mouse. |
| Contre-Terre 0% engine | Medium | Novel + brain seed ready, no implementation |
| FalkorDB crashes under load | Medium | Redis drops after mass seeding |
| src/ legacy code | Low | Pre-engine Venice code, duplicates engine/ |

---

## ROADMAP

### Now (weeks 1-2)
- Central Tower (Three.js geometry + shader — design is done)
- First district prototype (Radiant Core or Resonance Plaza)
- Flight mode in engine client
- Coded buildings API (programmatic creation)

### Next (weeks 3-4)
- All 7 Lumina Prime districts
- Data-driven architecture (graph signals → building properties)
- Spawn animation (citizen birth from Central Tower)
- Sound design per district (from Synthetic Souls album session)

### Later (month 2+)
- Contre-Terre world implementation
- Unity/Quest 3 optimization
- WebGPU when citizen count > 5000

---

## HANDOFF

**For agents:** Engine is world-agnostic. Don't hardcode Venezia. `engine/index.js --world manifest.json`. The 5 local citizens are the engine team. `src/` is legacy, prefer `engine/`.

**For NLR:**
- LP first district: Central Tower + Radiant Core, or Resonance Plaza?
- Flight: free-flight or path-constrained?
- Coded buildings: citizen-writable or system-generated?
- Contre-Terre: now or after LP is stable?

---

## POINTERS

| What | Where |
|------|-------|
| Engine entry | `engine/index.js` |
| Venezia manifest | `worlds/venezia/world-manifest.json` |
| Venezia graph seed | `scripts/seed_venice_graph.py` |
| LP manifest | `lumina-prime/world-manifest.json` |
| LP city plan | `lumina-prime/docs/city-architecture/city-plan/` |
| GraphCare | `graphcare/docs/SYNC_GraphCare.md` |
| Brain seeding | `mind-mcp/scripts/seed_lumina_prime_brains.py` |
| Deploy | `render.yaml` + `render-start.sh` |
