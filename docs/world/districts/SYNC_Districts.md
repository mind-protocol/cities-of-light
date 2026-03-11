# SYNC: world/districts — Current State

Last updated: 2026-03-11

---

## Status: NOT BUILT

No Venice district code exists. The current Cities of Light codebase has an island archipelago system (5 island zones), not Venice. The transition from islands to Venice districts is the first major build task for Venezia.

---

## What Exists Now

### Island System (current, working)

- `src/client/scene.js` — generates 5 procedural islands positioned from `src/shared/zones.js`
- Each island has: terrain (PlaneGeometry + fbm noise), vegetation (palms/crystals/columns/flowers), rocks, shore ring
- Water: Three.js `Water` addon with animated normals, full-screen ocean plane
- Sky: Preetham atmospheric scattering model
- Procedural noise: `hash2D()`, `smoothNoise()`, `fbm()` — deterministic, seeded, reusable
- LOD: Quest 3 flag (`_isQuest`) reduces water size, shadow resolution, star count
- Zones: `ZONES` array in `shared/zones.js` — 5 entries with position, seed, palette, vegetation, ambient config

### Relevant Patterns (reusable for Venice)

| Existing | Reuse For |
|---|---|
| `hash2D()`, `smoothNoise()`, `fbm()` | Building variation, prop scattering seeds |
| `Water` material + animation loop | Canal water surfaces |
| `Sky` + PMREM environment map | Venice sky (same golden hour atmosphere) |
| Vertex color materials | Building facade tinting |
| Canvas-based normal map generation (`generateSandNormalMap()`) | Stone/terracotta normal maps |
| Island label sprites | District name markers (if accessibility mode is on) |
| Quest 3 detection (`_isQuest`) | Adaptive quality for buildings/props |

### What Does NOT Exist

- Canal generation (Bezier curves, canal walls, fondamenta)
- Building generation (Venetian architecture from parameters)
- Bridge generation
- District boundary definitions (polygons in world space)
- Airtable building data fetch (`serenissima-sync.js`)
- `geo_to_world()` coordinate projection
- Building LOD system (3-tier)
- Prop generation (market stalls, boats, lanterns)
- Collision/navmesh for fondamenta + bridges
- District-specific atmospheric configuration
- `src/client/venice/` directory (planned, empty)
- `src/shared/districts.js` (planned, does not exist)

---

## Dependencies (What Must Exist Before Districts Can Work)

### Hard Dependencies (blocks district rendering)

1. **Airtable API access** — Need the Serenissima Airtable base ID and PAT to fetch BUILDINGS table. Base: `appkLmnbsEFAZM5rB`. Fields needed: `name`, `position` (lat/lng), `category`, `size_tier`, `owner` (linked citizen record).

2. **Building data shape** — Need to confirm the exact Airtable BUILDINGS table schema. The doc chain assumes fields like `lat`, `lng`, `category`, `size_tier`, `owner`. Verify against actual Airtable.

3. **District boundary coordinates** — The 7 district polygons need to be defined in real Venice lat/lng, then projected. This is a manual authoring task (draw 7 polygons on a Venice map). Not in Airtable.

### Soft Dependencies (district works without these, but is incomplete)

4. **Economy sync** (`serenissima-sync.js`) — Without it, buildings render but don't reflect live economic state (goods on stalls, lit/dark windows). Can use static snapshot for POC.

5. **Citizen positions** — Districts look empty without citizens walking. Citizen rendering is a separate module (`citizens/embodiment`). District generation is independent of citizen rendering.

6. **Blood Ledger graph** — District atmosphere (fog, lighting) responds to narrative tension. Without it, atmosphere is static per district. Fine for POC.

---

## Build Order

### Step 1: Coordinate System + District Definitions
- Implement `geo_to_world()` and `world_to_geo()`
- Author 7 district boundary polygons
- Create `src/shared/districts.js` with district config objects
- Test: plot Airtable building positions in world space, verify they land in correct districts

### Step 2: Canal Generation
- Grand Canal as cubic Bezier (4 control points from Venice reference)
- 2-3 major canals per district (quadratic Bezier)
- 4-8 minor rii per district (straight segments)
- Canal geometry: water surface mesh + canal wall mesh + fondamenta mesh
- Water material: reuse existing `Water` from scene.js
- Test: walk along fondamenta, verify no gaps, verify water renders in canal channels

### Step 3: Building Placement
- Fetch Airtable BUILDINGS
- Place each building at projected world position
- Orient to face nearest canal
- Generate LOD0 mesh (full Venetian facade) for each
- Test: verify buildings cluster correctly per district, no overlap with canals

### Step 4: Gap Fill + Props
- Occupancy grid per district
- Fill empty lots with procedural residential buildings
- Scatter props along fondamenta (market stalls near businesses, lanterns, crates)
- Test: no visible empty ground between buildings and canals

### Step 5: Bridges
- Place bridges at regular intervals along each canal
- Generate arched bridge mesh with steps
- Mark bridge surfaces as walkable
- Test: verify bridges connect fondamenta segments, visitor can walk across

### Step 6: LOD System
- Implement 3-tier LOD for buildings
- LOD1: simplified box with flat color + window grid texture
- LOD2: billboard/silhouette
- Amortize LOD updates across frames (20 buildings/frame)
- Test: frame rate on Quest 3 with all districts loaded. Target: 72fps with 3 districts in view.

### Step 7: Collision / Navmesh
- Extract walkable surfaces (fondamenta + bridges)
- Generate collision geometry for VR locomotion
- Test: visitor cannot walk through buildings or fall into canals

### Step 8: Integration
- Replace island generation in `scene.js` with Venice district generation
- Preserve island system as separate mode (memorial zones, coexist)
- Wire district config into atmosphere system (when it exists)
- Wire building data updates to economy sync (when it exists)

---

## Open Questions

### Q1: How many buildings does Airtable actually have?
The Serenissima BUILDINGS table may have 50 buildings or 500. The gap-fill system depends on knowing actual density. Need to query Airtable and count. If < 100 buildings total across all districts, gap-fill does most of the work. If > 300, gap-fill is minimal.

### Q2: Do buildings in Airtable have lat/lng or district assignment?
The doc chain assumes lat/lng. If buildings only have a district name (e.g., "Rialto") without precise coordinates, we need a different placement strategy: distribute buildings within the district polygon using a Poisson disc scatter.

### Q3: What's the visitor's starting position?
The island system spawns the visitor at (0, 0, 0). For Venice, the visitor should arrive at a dock. Which dock? Rialto makes sense (most activity). But the SYNC doc for the full Venezia project says "random dock." Need to decide.

### Q4: How does the island archipelago coexist with Venice?
Current design says islands are preserved as memorial/contemplation spaces, separate from Venice. Are they at a distance (visitor sails/teleports to Venice from the island)? Or does Venice replace the islands entirely for the Venezia mode? The zone/waypoint teleport system in `waypoints.js` might need to bridge between the two.

### Q5: Canal water vs. ocean water — same material?
The current `scene.js` uses a single large `Water` plane for the ocean. Venice canals are channels between buildings. Options:
- (a) Keep the ocean plane at y=0 and build canal walls that rise above it. Canals are just exposed sections of the ocean. Simple, but canal water color can't vary per canal.
- (b) Separate water meshes per canal. More control (color, reflectivity per canal) but more draw calls.
- Recommendation: option (a) for V1. The ocean plane serves as the lagoon. Canal walls and fondamenta sit above it. Canal "water" is just the ocean visible between walls.

### Q6: Shadow map coverage for a 1500x1200 world
The current sun shadow camera covers a 100x100 area (50 units in each direction). Venice at 1500x1200 is far larger. Cascaded shadow maps (CSM) or a follow-the-visitor shadow that covers only the nearby area (~100m radius) is needed. Three.js has CSMShadowMap as an addon.

### Q7: Can we generate all district geometry up front, or do we need streaming?
At 1500x1200 world units with ~500 buildings (placed + gap-fill), total geometry might be 2-5M triangles before LOD. On Quest 3, we cannot keep all of this in GPU memory. Options:
- (a) Generate all, rely on LOD + frustum culling to keep rendered triangle count low.
- (b) Stream: only generate districts within 300m of visitor. Dispose distant districts.
- Recommendation: start with (a). If memory exceeds 512MB, switch to (b).

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Airtable building data is sparse or missing coordinates | High | Design gap-fill system to be the primary building source, Airtable as enrichment |
| Canal generation produces overlapping or non-manifold geometry | Medium | Validate canal paths against each other. No two canals within 10m unless intentional intersection |
| Quest 3 can't handle the scene | Critical | Measure early. Step 6 (LOD) must be done before Step 8 (integration). Fail fast on performance. |
| Procedural buildings all look the same | Medium | Per-building seed from Airtable record ID ensures variation. Per-district palette ensures district identity. Test visually early. |
| Walkable surface has gaps | High | Collision mesh must be verified with a walking test. Any gap = visitor falls into the void. |
| Building generation is slow (blocks load) | Medium | Generate asynchronously. Show water + canals first, buildings pop in over 2-3 seconds. Or use web workers. |
