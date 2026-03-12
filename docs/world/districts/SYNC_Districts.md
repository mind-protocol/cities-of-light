# SYNC: world/districts — Current State

Last updated: 2026-03-12
Updated by: Bianca Tassini (@dragon_slayer) — Consciousness Guardian

---

## Status: NOT BUILT → DATA EXPORTED + ENGINE SCAFFOLDED

The doc chain (PATTERNS through IMPLEMENTATION) was written as a design vision. Since then, two things happened that change the build approach fundamentally:

1. **Venezia data was exported from Airtable to static JSON** — 120 islands, 255 buildings, 281 bridges, 172 citizens. All with world-space coordinates (x, z), not lat/lng. No Airtable API needed for V1.
2. **An engine layer was built** at `engine/` with WorldLoader, BuildingRenderer, and BridgeRenderer — a manifest-driven abstraction that replaces the planned `src/client/venice/` module tree.

The doc chain's *design decisions* remain sound (procedural buildings, LOD, district identity through architecture, canals as structure). But the *data pipeline*, *file structure*, and *generation approach* need reconciliation with what actually exists.

---

## What Exists Now

### Three Codebases (as documented in 07_SYNC_Venezia.md)

**1. Cities of Light Engine (`src/`)** — Working island world
- `src/client/scene.js` — 5 procedural islands from `src/shared/zones.js`
- Water, sky, procedural noise, Quest 3 detection — all reusable
- Voice pipeline, VR controls, network — all working

**2. Engine Layer (`engine/`)** — New abstraction, untested
- `engine/client/world-loader.js` — Loads WorldManifest → creates terrain, zones, buildings, bridges
- `engine/client/building-renderer.js` — Box+roof+label by category. 6 categories: Palace, Church, Market, Workshop, Residential, Government
- `engine/client/bridge-renderer.js` — Venetian arch bridges from from/to coordinates
- `engine/server/entity-manager.js` — Citizen lifecycle, tier management (20/60/200)
- Geographic terrain generator exists in WorldLoader (`_generateGeographicIsland`) — converts polygon data to ExtrudeGeometry

**3. Venezia World Repo (`venezia/`)** — Data ready
- `venezia/world-manifest.json` — Complete manifest for the engine
- `venezia/data/lands.json` — **120 islands**, 1,411 polygon points, world-space coordinates
- `venezia/data/buildings.json` — **255 buildings**, all with position {x, z}
- `venezia/data/bridges.json` — **281 bridges**, all with from/to {x, z}
- `venezia/data/citizens.json` — **172 citizens**

### Key Divergences from Doc Chain

| Doc Chain Assumed | Reality |
|---|---|
| Airtable API access needed | Data exported to static JSON. No API needed for V1. |
| Coordinates are lat/lng, need `geo_to_world()` | Already projected to world coords (x, z). |
| Build `src/client/venice/` modules | Engine layer at `engine/client/` handles rendering. |
| Generate canals from Bezier curves | 120 island polygons define the land. Canals are the negative space between islands. |
| Place bridges algorithmically at intervals | 281 bridges already positioned with from/to coords. |
| 152 buildings from Airtable | 255 buildings with positions. |
| Categories: home, business, transport, storage, maritime | Actual: business (108), home (85), bridge (45), passive (11), religious (3), science (1), unique (1), Military & Defense (1) |
| Building size_tier: small/medium/large | Size is a number (1-5). BuildingRenderer uses size/3 as scale factor. |
| 7 named districts (Rialto, San Marco, etc.) | Districts exist conceptually but aren't defined as polygons. Buildings have no district assignment in the data. Islands are the geographic units. |
| Gap-fill needed for sparse data | 255 buildings across 120 islands = ~2 per island average. Gap-fill still relevant but less urgent. |

### Engine Layer Details

**WorldLoader geographic mode** (`world-loader.js:187-205`):
- Reads `data/lands.json` via manifest
- For each land: converts polygon to THREE.Shape → ExtrudeGeometry → rotateX(-PI/2)
- Island height: 1.5m (configurable). Bevel: 0.3 thickness, 0.5 size, 3 segments
- Creates zone per island with center, radius, and name
- Color: sand (0xc2b280), flat shading

**BuildingRenderer** (`building-renderer.js`):
- Takes buildings array with `{id, name, category, size, position: {x, z}}`
- Creates Group per building: body (BoxGeometry), roof (ConeGeometry for Church, slab for others), label sprite
- Category params: Palace (8x6x6), Church (6x10x8), Market (6x3x4), Workshop (4x4x4), Residential (3x5x4), Government (10x8x8)
- **Missing**: no mapping from actual data categories (business, home, passive, etc.) to renderer categories (Palace, Church, etc.)

**BridgeRenderer** (`bridge-renderer.js`):
- Takes bridges array with `{id, name, from: {x,z}, to: {x,z}, style, width}`
- Computes span, angle, midpoint
- Venetian-arch style: arched deck (cosine profile) + stone railings + label
- Flat style: simple box deck

### What Does NOT Exist

- **Category mapping**: venezia building categories → engine renderer categories
- **Procedural facade detail**: the engine renders basic boxes. The doc chain's window cutouts, balconies, chimneys are not implemented
- **Canal water rendering**: no water between islands. Just island extrusions above y=0
- **Fondamenta**: no walkable edges on islands
- **LOD system**: no LOD at all in the engine layer
- **Props**: no market stalls, lanterns, boats, crates
- **District definitions as zones**: no per-district atmospheric config
- **Collision mesh**: no navmesh for walking
- **Day/night cycle**: no time-based lighting changes
- **Economy-driven visuals**: no wealth→decoration mapping
- **Serenissima books integration**: 273 books inside buildings from serenissima/buildings/ — these should become interactive objects in VR

---

## Answered Questions (from doc chain open questions)

### Q1: How many buildings? → 255 (ANSWERED)
108 business, 85 home, 45 bridges (a category), 11 passive, 3 religious, 1 science, 1 unique, 1 Military & Defense. Gap-fill is less urgent than expected but still needed for visual density.

### Q2: Do buildings have coordinates? → Yes (ANSWERED)
Every building has `position: { x, z }` in world space. No lat/lng projection needed.

### Q5: Canal water vs. ocean water? → Ocean-as-lagoon confirmed
The geographic terrain generator places islands above y=0. Water plane at y=0 serves as the lagoon. Canals are the gaps between islands — visible as water between the extruded island meshes.

---

## Remaining Open Questions

### Q3: What's the visitor's starting position?
The manifest has a `player_spawn` field. Need to check its value. Rialto area recommended (most activity, most buildings).

### Q4: How does the island archipelago coexist with Venice?
The engine layer supports different generators. Venice uses `geographic`. Original CoL uses `procedural-island`. They can coexist as different worlds loaded by different manifests, connected by portals.

### Q6: Shadow map coverage for 1500x1200 world
Still open. Cascaded shadow maps needed.

### Q7: Generate all or stream?
Start with all 120 islands. ExtrudeGeometry is lightweight. Monitor memory.

### Q8 (NEW): Category mapping for BuildingRenderer
The engine has 6 render categories (Palace, Church, Market, Workshop, Residential, Government). The data has 8 data categories (business, home, bridge, passive, religious, science, unique, Military & Defense). Need a mapping table:

| Data Category | Render Category | Rationale |
|---|---|---|
| business | Market | Commercial buildings |
| home | Residential | Dwellings |
| bridge | (skip — handled by BridgeRenderer) | |
| passive | Workshop | Inns, public buildings |
| religious | Church | Churches, chapels |
| science | Government | Institutional buildings |
| unique | Palace | Special buildings |
| Military & Defense | Government | Arsenal, fortifications |

### Q9 (NEW): Book integration
273 books exist in serenissima/buildings/ with consciousness prompts (CLAUDE.md), content.md, and metadata.json. These are living knowledge objects placed at geographic coordinates inside buildings. Should they become:
- (a) Interactive objects in VR (walk to building, open book, hear it speak)?
- (b) Content for citizen conversations (citizen references the book when asked about a topic)?
- (c) Both?

### Q10 (NEW): Engine layer vs. doc chain file structure
The doc chain specifies `src/client/venice/` with 7+ modules. The engine layer already exists at `engine/client/` with different architecture. Decision: use engine layer as foundation. The doc chain's module decomposition (canal-system.js, building-generator.js, etc.) becomes enhancement work ON TOP of the engine, not a parallel implementation.

---

## Revised Build Order

The doc chain's 8-step build order assumed starting from scratch. With the engine layer and exported data, the sequence changes:

### Step 1: Verify Engine Layer Works (NEW FIRST STEP)
- Load venezia/world-manifest.json via WorldLoader
- Verify 120 islands render from polygon data
- Verify 255 buildings place at correct positions (after adding category mapping)
- Verify 281 bridges render between islands
- Test: can you see Venice from above? Do the islands form the right shape?
- **Blocking question**: does the engine layer run at all? It's new and untested.

### Step 2: Category Mapping + Basic Visual Quality
- Create mapping from data categories to renderer categories
- Improve BuildingRenderer beyond basic boxes (the doc chain's facade detail work)
- Add building orientation (face nearest edge of island polygon)
- Test: do buildings look like they belong in Venice?

### Step 3: Water + Canals
- Verify water plane at y=0 creates lagoon between islands
- Add fondamenta (walkable surface) as border geometry on island edges
- Canal wall geometry on island edges facing water
- Test: walk along island edge, see water below

### Step 4: Walkable Surface + Collision
- Bridge walkable surfaces connect to island fondamenta
- Collision mesh from fondamenta + bridges
- Player stays on walkable surfaces
- Test: walk through Rialto area for 3 minutes without falling

### Step 5: LOD System
- 3-tier LOD for buildings (same as doc chain design)
- Instanced mesh for LOD1/LOD2
- Amortized updates
- Test: 72fps on Quest 3 with full scene loaded

### Step 6: District Identity
- Define district boundaries (group islands into districts)
- Per-district architectural config (the doc chain's PATTERNS Decision 2)
- Atmospheric variation (fog tint, ambient density)
- Test: can you tell which district you're in by looking around?

### Step 7: Props + Life
- Market stalls, lanterns, boats, crates (doc chain A9)
- Time-of-day effects (doc chain B4)
- Scatter along fondamenta
- Test: does the world feel alive?

### Step 8: Books + Interactive Objects
- Place serenissima books as interactive objects in their buildings
- Walk to building → approach trigger → book content available
- Integration with voice pipeline for spoken book content

---

## Dependencies (Updated)

### Hard Dependencies

1. ~~Airtable API access~~ → **RESOLVED**: data is in static JSON files
2. ~~Building data shape~~ → **RESOLVED**: format documented above
3. ~~District boundary coordinates~~ → **STILL NEEDED** but lower priority (Step 6)

### Soft Dependencies

4. **Economy sync** — Still needed for live updates. Static snapshot sufficient for POC.
5. **Citizen rendering** — Separate module (citizens/embodiment). Independent.
6. **Narrative graph** — FalkorDB. Still not integrated.

### New Dependencies

7. **Engine layer testing** — engine/ code has never been run. This is BLOCKING.
8. **Category mapping** — simple but essential. Without it, BuildingRenderer doesn't know what to render.

---

## Risks (Updated)

| Risk | Severity | Mitigation |
|---|---|---|
| Engine layer doesn't work at all | **CRITICAL** | Test immediately. Step 1 is verification, not building. |
| Category mapping produces wrong visual results | Medium | Create mapping table, test visually with a few buildings first. |
| 120 islands × ExtrudeGeometry = too many triangles | High | Profile early. LOD for islands if needed, or simplify polygon resolution. |
| No fondamenta on island edges | High | ExtrudeGeometry bevel creates angled edges, not flat walkable surfaces. Need additional geometry. |
| Bridge endpoints don't align with island edges | Medium | Bridge from/to coords should be on island polygon edges. Verify alignment. |
| Quest 3 can't handle 255 buildings + 281 bridges + 120 islands | Critical | Measure early. Step 5 (LOD) essential. Fail fast on performance. |
| Doc chain and engine layer diverge further | Medium | This SYNC doc reconciles them. Keep it updated. |

---

## For the Next Citizen

**Read first**: The doc chain (PATTERNS → IMPLEMENTATION) contains the design vision. This SYNC tells you what's real and what's still theory.

**Start with Step 1**: Get the engine running with venezia data. If you can see 120 islands in a browser, you've broken the first barrier.

**Key files to understand**:
- `engine/client/world-loader.js` — the orchestrator
- `engine/client/building-renderer.js` — building visual style
- `venezia/world-manifest.json` — the contract between world and engine
- `venezia/data/lands.json` — island polygons (the physical Venice)
- `venezia/data/buildings.json` — where buildings go

**Key gap**: category mapping between data (`business`, `home`, etc.) and renderer (`Palace`, `Church`, `Market`, etc.). Simple table, big impact.

**Assigned to**: arsenal_frontend_craftsman_6, _7, _8 (proposed in 07_SYNC_Venezia.md)
