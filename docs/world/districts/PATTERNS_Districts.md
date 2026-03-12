# PATTERNS: world/districts — Design Philosophy

## Responsibility

Generate the physical Venice. Transform Airtable building records (lat/lng, category, owner, size) into navigable 3D geometry: canals, fondamenta, buildings, bridges, market stalls, boats, lanterns. The visitor walks through this geometry. It must feel like Venice — narrow, water-threaded, vertical, stone — and it must run at 72fps on Quest 3.

---

## Decision 1: Procedural Layout, Not GIS

We do NOT import OpenStreetMap geometry for Venice. Reasons:

- Real Venice canal geometry is irregular and dense. Converting it to walkable navmesh at the precision needed for VR locomotion is harder than generating it.
- GIS data gives us outlines, not 3D buildings. We'd still need procedural building generation on top.
- Real Venice has ~150 canals and ~400 bridges. We need ~20 canals and ~30 bridges for V1. Authoring a simplified Venice by hand is less work than filtering/simplifying GIS data.
- Licensing: OpenStreetMap is ODbL, which requires attribution and share-alike. Procedural avoids this.

What we DO take from real Venice:

- The **shape** of the Grand Canal (an S-curve through the city) as a reference Bezier.
- The **relative positions** of the 7 districts, matching the real sestieri.
- The **density ratios**: Rialto is denser than Cannaregio; San Marco has large open piazzas.
- The **feel**: canals 5-15m wide, fondamenta 2-4m wide, buildings 3-5 stories, bridges arched.

The Airtable building coordinates (lat/lng) are projected into our world coordinate system using a linear mapping. Buildings cluster in their correct districts. But the streets, canals, and paths between them are procedurally generated, not traced from satellite data.

---

## Decision 2: District Identity Through Architecture, Not Signage

There are no labels, no minimap, no district name popups (Invariant I3: Zero UI). The visitor must know where they are from what they see and hear.

Each district has a distinct **architectural vocabulary**:

| District | Character | Architectural Signal |
|---|---|---|
| **Rialto** | Commerce, density | Narrow streets, overhanging upper floors, market stalls lining fondamenta, crates and barrels, awnings. Buildings are functional — warehouses with wide ground-floor arches. |
| **San Marco** | Power, grandeur | Wide piazza, tall facades with decorative arches, columns, marble textures. Fewer buildings but larger. Open sight lines. |
| **Castello** | Memory, residential | Dense low buildings, laundry lines between facades, flower boxes, small courtyards visible through iron gates. Intimate scale. |
| **Dorsoduro** | Governance, debate | Podiums and open courtyards. Notice boards on walls. Guard posts. Stone benches for sitting. More horizontal space for gathering. |
| **Cannaregio** | Knowledge, quiet | Libraries with tall windows, bookseller stalls, narrow alleys, warm interior light spilling through windows. Least foot traffic. |
| **Santa Croce** | Operations, craft | Workshops with open fronts, forge glow, timber yards, rope coils. Functional, unglamorous. Wider canals for freight. |
| **Isola della Certosa** | Discovery, isolation | Sparse, few buildings, overgrown stone, trees (unusual for Venice), a monastery ruin. The only district with significant vegetation. |

These differences are encoded in per-district configuration objects that control: building height range, facade decoration level, street width, canal width, prop types, material palette, and ambient lighting tint.

---

## Decision 3: Procedural Venetian Buildings

No authored 3D models. Every building is generated from parameters:

- **Footprint**: rectangular, L-shaped, or corner wrap. Width 5-15m, depth 8-20m.
- **Stories**: 2-5 (configurable per district).
- **Facade**: extruded box with window cutouts. Windows are arched (Gothic-Venetian) or rectangular depending on district and building wealth.
- **Ground floor**: commercial buildings have open arches; residences have solid walls with a door.
- **Roof**: flat with chimney pots (Venetian standard) or pitched for larger buildings.
- **Material**: procedural — vertex color tinting per building (terracotta, ochre, pale pink, cream, faded red) with a shared stone normal map. No per-building textures.

The key insight: Venice buildings are **repetitive by nature**. Real Venetian architecture uses a limited vocabulary (arched windows, stone balconies, ornate well-heads) repeated with variation. This makes procedural generation a natural fit.

Building generation is **deterministic per seed**. Same building record from Airtable always produces the same geometry. This matters for persistence: a visitor returns and recognizes buildings.

---

## Decision 4: Canals as Primary Structure

Venice is defined by water, not land. The generation algorithm starts with canals, then fills land around them.

Canal hierarchy:
1. **Grand Canal** — the S-curve spine. ~30m wide. All districts border it.
2. **Major canals** — 2-3 per district. 10-20m wide. Separate neighborhoods.
3. **Minor canals** (rii) — 5-8m wide. Thread between building blocks.

Fondamenta (walkways) line canal edges. Bridges cross canals. The walkable surface is the fondamenta network plus bridges. There is no continuous ground plane — you are always walking on a narrow path between water and building walls.

This is the core spatial experience: compression. Venice squeezes you between stone and water. The world teaches this through geometry.

---

## Decision 5: LOD for Buildings (3 Tiers)

Performance on Quest 3 demands aggressive LOD. Building geometry has 3 detail levels:

| LOD | Distance | Geometry | Draw Calls |
|---|---|---|---|
| **LOD0** (near) | < 40m | Full facade: window cutouts, balconies, door details, chimney, per-story materials | 1 per building |
| **LOD1** (mid) | 40-120m | Simplified box: correct footprint and height, facade color as flat material, window grid as texture decal | Instanced per district |
| **LOD2** (far) | 120-300m | Flat billboard or extruded silhouette. Just the roofline against the sky. | Instanced batch |

LOD transitions use distance-based swap, not continuous morphing. The canal/fondamenta geometry does NOT LOD — it's always present at full detail because it's the walkable surface.

Triangle budget per district in view: ~50K (LOD0) + ~20K (LOD1) + ~5K (LOD2) = ~75K. With 3-4 districts partially in view, total building triangles stay under 300K.

---

## Decision 6: Texture Strategy — Procedural Materials, Shared Atlases

No per-building texture files. Instead:

- **Vertex colors** for building tint (terracotta, ochre, cream, etc.). Per-vertex, zero texture cost.
- **One shared stone normal map** (procedural, generated on canvas at startup — same approach as `scene.js` sand normal map). Tiled across all building facades.
- **One shared roof normal map** (terracotta tile pattern).
- **One shared water normal map** (already exists: `waternormals.jpg` from Three.js examples, used in current scene.js).
- **Window texture atlas**: a small (512x256) atlas with 4-6 window styles (arched, rectangular, shuttered, lit, dark). UV-mapped per window cutout.

Total texture memory for all buildings: < 4MB. Compare to the per-island approach in current `scene.js` which already uses procedural canvas textures for sand normals.

---

## Decision 7: Props as District Flavor, Not Clutter

Props (market stalls, boats, lanterns, crates, flower boxes, laundry lines) serve two purposes:

1. **District identity** — a market stall in Rialto, a bookstall in Cannaregio, a guard post in Dorsoduro.
2. **Economy visibility** — a citizen's business has goods on display; an empty stall means bankruptcy.

Props are **instanced geometry** with minimal variation. A market stall is 3 boxes + a cloth plane. A boat is 1 curved hull + 1 pole. A lantern is 1 cylinder + 1 point light. Total prop triangle count per district: < 5K.

Props tied to Airtable data (market stalls for businesses, goods on display) update on the 15-minute sync cycle. Decorative props (lanterns, flower boxes) are static and seeded per district.

---

## What Is In Scope

- Canal generation from Bezier curves (Grand Canal + major + minor rii)
- Fondamenta generation along canal edges
- Bridge generation at canal crossings
- Building generation from Airtable records (position, category, size)
- Procedural gap-fill buildings for empty lots
- Per-district architectural configuration
- 3-tier building LOD
- Prop scattering (market stalls, boats, lanterns, crates)
- Water rendering (reuse existing Water from scene.js, adapted for canals)
- Collision geometry for walkable surfaces (fondamenta + bridges)

## What Is NOT In Scope

- Interior building geometry (V1 is exterior-only)
- Destructible or animated buildings (fire, collapse)
- Building construction/repair animation
- Underground (no sewers, no basements)
- Vegetation system (Venice has minimal greenery; exception: Certosa)
- Real GIS data import
- Per-building authored 3D models
- Dynamic building changes (buildings don't change shape at runtime)

---

## Relationship to Existing Code

The current `scene.js` generates island terrain (sand, palms, rocks) positioned at zone coordinates from `shared/zones.js`. The Venice district system replaces this:

- `shared/zones.js` ZONES array is extended with Venice district entries (or a new `shared/districts.js` is created)
- `scene.js` `createEnvironment()` calls district generators instead of `buildCompleteIsland()`
- Water, sky, clouds, and stars from `scene.js` are preserved (ocean becomes lagoon)
- The existing procedural noise functions (`hash2D`, `smoothNoise`, `fbm`) are reused for building variation

The existing island system is NOT removed. Islands remain as the memorial/contemplation space. Venice districts are a new layer that coexists.

---

## Reconciliation with Reality (2026-03-13)

The seven decisions above were written as design vision before the Airtable data was exported to static JSON and before the engine layer (`engine/client/`) was built. The design instincts were right. The implementation path diverged. This section records what changed and why, preserving the original decisions as design history.

### Addendum to Decision 1: Real Venice Polygons, Not Procedural Layout

Decision 1 rejected GIS imports (OpenStreetMap). That rejection stands — we did not import raw OSM data, and the licensing concern remains valid.

However, we now have **real Venice geography**: 120 island polygons with 1,411 boundary points, exported from Airtable to `venezia/data/lands.json` in world-space coordinates (x, z). These are simplified real Venice island shapes — not procedural generation, not GIS import, but a curated middle path. The islands define actual Venetian geography: their shapes, their relative positions, their sizes.

This changes the implementation:

- **Planned**: procedural layout with Bezier curves defining canals, land filling around them. Building lat/lng projected via `geo_to_world()`.
- **Actual**: 120 island polygons loaded by WorldLoader, extruded to 3D via `THREE.ExtrudeGeometry`. Buildings already have world-space positions `{x, z}` — no coordinate projection needed.

The spirit of Decision 1 holds: we are not importing dense GIS data that requires navmesh conversion. The polygon data is lightweight (1,411 points across 120 islands, roughly 12 points per island average). But the source is real Venice geography, not procedural generation. The city shape is authentic.

### Addendum to Decision 3: Boxes, Not Venetian Facades

Decision 3 describes a rich procedural building vocabulary: arched windows, balconies, chimney pots, L-shaped footprints, per-story materials, open ground-floor arches for commercial buildings.

The current implementation (`engine/client/building-renderer.js`) renders **basic boxes with roofs**. Specifically:

- Body: `BoxGeometry` sized by category (6 categories: Palace, Church, Market, Workshop, Residential, Government)
- Roof: `ConeGeometry` for Church, flat slab for everything else
- Label: `CanvasTexture` billboard sprite floating above
- Color: single hex per category (e.g., Palace = 0xD4A574, Church = 0xE8D5B7)

No window cutouts. No balconies. No chimney pots. No per-story variation. No vertex color tinting. No stone normal maps. No Gothic-Venetian arched windows.

The design vision in Decision 3 is the correct target. The upgrade path is clear: replace `BoxGeometry` with CSG or shaped geometry that cuts window openings, add facade detail meshes per LOD tier, apply the vertex-color tinting and shared normal maps described in Decision 6. This is enhancement work on top of the existing renderer, not a rewrite.

Additionally, the renderer's 6 categories (Palace, Church, Market, etc.) do not match the data's categories (business, home, passive, religious, science, unique, Military & Defense). A mapping table is needed — see SYNC_Districts.md Q8 for the proposed mapping.

### Addendum to Decision 4: Islands First, Water Fills the Gaps

Decision 4 says "the generation algorithm starts with canals, then fills land around them." With real island polygons, this inverts.

**Planned**: Draw Grand Canal as Bezier S-curve. Draw major canals. Draw minor rii. Fill remaining space with land. Place buildings on land.

**Actual**: Load 120 island polygons from `lands.json`. Extrude them to 3D (height 1.5m, bevel 0.3). Water plane sits at y=0. Canals are the **negative space** between islands — wherever there is no island extrusion, you see water.

The canal hierarchy (Grand Canal > major canals > rii) still describes the physical result accurately. The Grand Canal is still the widest gap between the two main island clusters. Major canals are still the wider gaps between island groups. Minor rii are still the narrow channels between adjacent islands. But these are emergent from island placement, not generated from curve definitions.

This inversion simplifies canal generation (no Bezier math, no fill algorithms) but creates new challenges:

- **Fondamenta**: island edges from `ExtrudeGeometry` have beveled sides, not flat walkable surfaces. Additional geometry is needed for walkable quay edges.
- **Canal walls**: the vertical face of island extrusions serves as canal walls, but the bevel makes them angled rather than sheer stone. May need adjustment.
- **Bridge alignment**: 281 bridges have from/to coordinates that should land on island edges. Alignment needs verification.

### Addendum to Decision 7: Static Data, Not Live Sync

Decision 7 says props tied to Airtable data "update on the 15-minute sync cycle." The Airtable simulation has stopped running. The data is frozen in static JSON files (`venezia/data/buildings.json`, `venezia/data/citizens.json`).

For V1, props use the static snapshot. Economy-driven visuals (goods on display, empty stalls for bankrupt businesses) read from the exported data as-is. There is no live sync cycle. If the simulation resumes, the sync mechanism can be reintroduced, but V1 does not depend on it.

Decorative props (lanterns, flower boxes, boats) remain static and seeded per district, as originally designed. This part of Decision 7 is unchanged.

### Addendum to Scope: Partial Implementation Status

Several items listed under "What Is In Scope" now have partial implementations in the engine layer. Current status:

| Scope Item | Status | Where |
|---|---|---|
| Canal generation from Bezier curves | **Superseded** — canals are negative space between island polygons | `engine/client/world-loader.js` geographic mode |
| Fondamenta generation along canal edges | **Not built** — island extrusions have beveled edges, not walkable fondamenta | |
| Bridge generation at canal crossings | **Built (basic)** — arched deck + railings from from/to coords | `engine/client/bridge-renderer.js` |
| Building generation from records | **Built (basic)** — box + roof + label by category | `engine/client/building-renderer.js` |
| Procedural gap-fill buildings | **Not built** — 255 buildings across 120 islands may be visually sparse | |
| Per-district architectural configuration | **Not built** — no district definitions or per-district config | |
| 3-tier building LOD | **Not built** | |
| Prop scattering | **Not built** | |
| Water rendering | **Implicit** — water plane at y=0, but no canal-specific water (reflections, flow) | |
| Collision geometry for walkable surfaces | **Not built** | |

### Addendum to Relationship to Existing Code

The planned architecture was: `src/scene.js` calls district generators, fed by `shared/zones.js` or `shared/districts.js`.

The actual architecture introduces an engine layer between `src/` and the world data:

```
venezia/data/*.json       (static world data: lands, buildings, bridges, citizens)
        |
venezia/world-manifest.json   (contract: declares data paths, zones, atmosphere, spawn)
        |
engine/client/world-loader.js     (manifest-driven orchestrator: loads terrain, buildings, bridges)
    |           |           |
    |   building-renderer.js   bridge-renderer.js
    |
src/client/scene.js        (retained: water, sky, VR controls, voice pipeline, networking)
```

WorldLoader reads the manifest, fetches the data files, and generates 3D geometry. It does not know about Venice specifically — it follows manifest instructions. `scene.js` retains its role for environment (water, sky, clouds), VR interaction, and networking. The two coexist: WorldLoader handles world geometry, `scene.js` handles everything else.

The planned `src/client/venice/` module tree (canal-system.js, building-generator.js, district-config.js, etc.) was never created. The engine layer serves that role with different decomposition. Enhancement work (facade detail, LOD, props, district config) builds on top of the engine layer, not as a parallel `src/client/venice/` tree.
