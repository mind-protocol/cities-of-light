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
