# VALIDATION: world/districts — What Must Be True

Health checks, invariants, acceptance criteria, and data integrity rules for the district generation system. Every check is testable. Every threshold is a number.

---

## Invariants (must ALWAYS hold)

### DI1. Geometry Consistency

- Every building mesh has a non-zero bounding box. No degenerate geometry (zero-width, zero-height, or inside-out normals).
- Every building position is within its assigned district boundary polygon. No building placed outside all districts.
- Every building footprint is non-overlapping with other buildings at the same Y plane. Overlap tolerance: < 0.1m.
- Every canal segment has left edge, right edge, and center. Left and right edges are always on opposite sides of center. No self-intersecting canal ribbons.
- Every fondamenta strip has `userData.walkable = TRUE`. No walkable surface exists without this flag. No non-walkable surface has this flag.
- The Grand Canal S-curve has exactly 4 control points and produces a continuous path with no cusps or self-intersections.

### DI2. Building Placement Integrity

- Every Airtable building record with valid lat/lng inside Venice bounds produces exactly one placed building mesh. No record is silently skipped without logging.
- Buildings snapped away from canals (via `snap_to_fondamenta`) must land on a fondamenta strip, not in open water or inside another building.
- Building facing direction always points toward the nearest canal or street. No building faces a wall or faces away from all walkable surfaces.
- Procedural gap-fill buildings never overlap Airtable-sourced buildings. Gap-fill buildings are always category "home" with decoration factor <= 0.5x district base.

### DI3. LOD Correctness

- Every building has exactly 3 LOD levels (LOD0, LOD1, LOD2) plus a hidden state. No building is missing any LOD level.
- LOD0 (< 40m) contains full facade detail: window cutouts, doors, balconies, chimney pots. Triangle count per building: 200-2000.
- LOD1 (40-120m) is a simplified box with correct footprint dimensions and height. Triangle count per building: 12-24.
- LOD2 (120-300m) is a billboard or silhouette. Triangle count per building: 2-4.
- Beyond 300m, the building is hidden (mesh.visible = FALSE). No building renders beyond 300m.
- LOD transitions never produce a frame where both the old and new LOD mesh are visible simultaneously.
- LOD is deterministic: same visitor position always produces same LOD assignment for the same building.
- Fondamenta and bridge geometry never LOD. They are always at full detail regardless of distance.

### DI4. Water Boundary

- Water is always at y=0. No water surface above or below y=0.
- Canal walls extend from y=0 (water level) to y=0.8 (fondamenta height). No gaps between water surface and canal wall top.
- No walkable surface mesh exists at or below y=0. Fondamenta height is always FONDAMENTA_HEIGHT (0.8m) above water.

### DI5. Deterministic Generation

- Given the same Airtable data and the same district definitions, `generate_venice()` produces byte-identical geometry. Seed-based randomness only. No calls to `Math.random()` in the generation pipeline.
- A building's appearance is determined solely by its Airtable record ID, district config, and owner wealth. Reloading the world produces the same buildings in the same positions with the same facades.

---

## Health Checks (runtime monitoring)

### HC1. Triangle Budget

| Metric | Threshold | Action if exceeded |
|---|---|---|
| LOD0 triangles in view | < 60K | Reduce LOD0 radius from 40m to 30m |
| LOD1 triangles in view | < 25K | Reduce LOD1 radius from 120m to 80m |
| LOD2 triangles in view | < 8K | Reduce LOD2 radius from 300m to 200m |
| Total building triangles in view | < 100K | Trigger aggressive LOD cull |
| Total scene triangles (buildings + canals + bridges + props) | < 350K | Disable props beyond 20m |
| Per-building LOD0 triangles | < 2000 | Simplify facade: reduce window cutouts, remove balconies |

Log triangle counts once per second. Alert if any threshold exceeded for > 5 consecutive seconds.

### HC2. Draw Calls

| Metric | Threshold | Action if exceeded |
|---|---|---|
| Draw calls per frame | < 200 | Merge more geometry into instanced batches |
| LOD1 draw calls | < 7 (one instanced batch per district) | Verify instancing is active |
| LOD2 draw calls | < 7 (one batch per district) | Verify instancing is active |
| Prop draw calls | < 30 | Increase instancing for repeated prop types |

### HC3. Frame Rate

| Metric | Threshold | Platform |
|---|---|---|
| Sustained FPS | >= 72 | Quest 3 (VR minimum) |
| Sustained FPS | >= 60 | Desktop (minimum) |
| Frame time spike | < 20ms | Any single frame on Quest 3 |
| 1% low FPS | >= 65 | Quest 3 |

FPS monitoring is continuous. If sustained FPS drops below threshold for > 3 seconds, log the visitor's district, position, LOD distribution, and draw call count.

### HC4. Navmesh Connectivity

- Every fondamenta strip is connected to at least one other fondamenta strip or bridge. No orphaned walkable surfaces.
- Every district has at least one path to every other district via fondamenta + bridges. Run a graph reachability check at world load.
- Bridge walkable surfaces connect to fondamenta on both sides with overlap >= 0.5m. No gap between bridge edge and fondamenta.

### HC5. Water Rendering

- Water material uniform `time` advances every frame. If `time` value is unchanged for > 2 consecutive frames, water animation is stalled.
- Water surface is a single contiguous mesh per canal (no gaps, no z-fighting between adjacent canal water segments).
- Water reflections (if enabled) update every frame. Reflection camera is positioned correctly at y-mirror of main camera.

### HC6. LOD Transition Performance

- LOD transitions process at most 20 buildings per frame (amortized). No frame processes > 50 LOD transitions.
- LOD cache hit rate > 90% after the first 60 seconds of a session. Low cache hit rate indicates excessive geometry creation.
- Geometry disposal: when a building's LOD cache entry is evicted, its Three.js geometry and material are disposed. Monitor `renderer.info.memory.geometries` -- it must not grow unboundedly over a session.

### HC7. Memory

| Metric | Threshold | Platform |
|---|---|---|
| JS heap size | < 2GB | Quest 3 |
| JS heap size | < 4GB | Desktop |
| Geometry count (renderer.info.memory.geometries) | < 5000 | Any |
| Texture memory | < 50MB | Quest 3 |
| Heap growth rate after initial load | < 1MB/minute | Any (leak detection) |

---

## Acceptance Criteria (gate conditions per POC milestone)

### POC-1 Gate: One District Renders

- [ ] Rialto district generates from Airtable data in < 5 seconds
- [ ] At least 20 buildings placed from Airtable records with correct district assignment
- [ ] Grand Canal renders as an S-curve with water, canal walls, and fondamenta on both sides
- [ ] At least 2 minor canals (rii) generate within Rialto
- [ ] At least 1 bridge connects fondamenta across a canal, and the visitor can walk across it
- [ ] Building LOD0 shows windows, doors, and per-story detail at < 40m
- [ ] Building LOD1 shows simplified box with correct color at 40-120m
- [ ] Gap-fill buildings cover > 80% of empty lots between Airtable buildings and canals
- [ ] Props scatter along fondamenta: at least 5 market stalls near business buildings
- [ ] Walk through Rialto for 3 minutes without falling through geometry
- [ ] Total triangle count in Rialto view < 100K
- [ ] No visible z-fighting on canal walls or fondamenta edges

### POC-2 Gate: All Districts

- [ ] All 7 districts generate without error
- [ ] Each district has visually distinct architecture matching its config (height range, decoration level, palette)
- [ ] District transitions are smooth (no pop-in, no loading stall)
- [ ] Walk from Rialto to San Marco to Castello continuously without gaps in walkable surface
- [ ] Every district is reachable from every other district via fondamenta + bridges (connectivity verified)
- [ ] Total scene triangle count with 3-4 districts in view < 350K
- [ ] Frame rate >= 72fps on Quest 3 with all districts loaded

### POC-3 Gate: Performance at Scale

- [ ] 152 Airtable buildings + gap-fill buildings loaded simultaneously
- [ ] LOD system keeps in-view triangle count under budget across all districts
- [ ] Memory stays under 2GB on Quest 3 after 30 minutes of exploration
- [ ] No geometry leak: heap growth < 1MB/minute after initial stabilization
- [ ] Draw calls < 200 per frame in the densest area (Rialto market)
- [ ] Building generation is fully deterministic: two loads produce identical geometry

---

## Anti-Patterns to Detect

### AP1. Geometry Leak

**Symptom:** Frame rate degrades over time. Memory grows continuously. `renderer.info.memory.geometries` increases without bound.
**Detection:** Monitor geometry count every 60 seconds. If count increases by > 100 over 5 minutes with no new districts loaded, a leak exists.
**Fix:** Verify `transition_building_lod()` disposes old LOD meshes when evicting from cache. Verify gap-fill buildings are not regenerated on each sync cycle. Check that `BufferGeometry.dispose()` and `Material.dispose()` are called.

### AP2. Invisible Buildings

**Symptom:** Empty lots where buildings should exist. Visitor sees water or sky where a building facade should be.
**Detection:** After generation, iterate all placed buildings. For each, verify `mesh.visible` is TRUE at LOD0 distance and that the mesh has > 0 vertices. Cross-reference Airtable building count against placed building count -- delta should be 0 for records inside Venice bounds.
**Fix:** Check `geo_to_world()` mapping. Verify building position is not inside a canal (snap logic failed). Check that `generate_venetian_building()` returns a non-empty mesh for the given parameters.

### AP3. Walk-Through Walls

**Symptom:** Visitor clips through building facades or walks into canal walls.
**Detection:** Log visitor position every frame. If position is inside a building bounding box (XZ projection) or below fondamenta height while not on a bridge arch, the collision system failed.
**Fix:** Buildings do not have collision geometry. Collision is fondamenta-only. If the visitor reaches a building wall, the fondamenta mesh should end before the wall. Check fondamenta width: if fondamenta extends into building footprint, the visitor can approach the wall and clip through. Reduce fondamenta width or add canal-wall collision planes.

### AP4. Floating Buildings

**Symptom:** Buildings hover above fondamenta level. Gap visible between building base and ground.
**Detection:** After placement, verify every building's `position.y` equals `FONDAMENTA_HEIGHT` (0.8m). Tolerance: < 0.05m.
**Fix:** Check that `generate_venetian_building()` generates geometry with y=0 at the base. Check that position.y is set after mesh creation, not before (avoiding double-offset).

### AP5. Canal Discontinuity

**Symptom:** Canal water has visible gaps. Fondamenta strips do not connect at canal junctions. Bridges do not reach both fondamenta.
**Detection:** At generation time, verify every canal segment's start/end connects to either another canal or a district boundary. Verify bridge span >= canal width + 2.0m (overhang). Verify fondamenta strips on both sides of every canal segment.
**Fix:** Check Bezier sampling resolution. Increase `N` (sample count) for canals with sharp curves. Check bridge placement: `t` parameter must not place bridges at the very start/end of a canal where fondamenta may not exist.

### AP6. LOD Pop-In

**Symptom:** Buildings visibly "pop" between detail levels. Visitor notices a building suddenly gaining or losing windows.
**Detection:** User feedback. Automated: log LOD transitions and check if any building transitions more than 3 times in 10 seconds (oscillation at boundary distance).
**Fix:** Add hysteresis to LOD distances. Use different thresholds for transitioning "up" vs "down" (e.g., LOD0->LOD1 at 42m, LOD1->LOD0 at 38m). The 2m buffer prevents oscillation when the visitor stands near a threshold distance.

### AP7. Prop Clustering

**Symptom:** All props cluster in one area. Most of the fondamenta is empty while one section is overloaded with crates, stalls, and lanterns.
**Detection:** After scatter, compute prop density per 20m fondamenta segment. Flag if any segment has > 5 props or any 60m stretch has 0 props.
**Fix:** Check `spacing` calculation in `scatter_props()`. Verify hash function distributes evenly. Check that `pick_weighted()` does not always select the same prop type.

---

## Data Integrity Checks

### Source Data (Airtable -> Generation)

```
ON WORLD LOAD:
  - Assert: building_records.length > 0 (Airtable returned data)
  - Assert: every building_record has non-null lat AND non-null lng
  - Assert: every building_record.lat is within [45.4250, 45.4480]
  - Assert: every building_record.lng is within [12.3080, 12.3680]
  - Assert: every building_record has a valid category in {home, business, transport, storage, maritime}
  - Assert: every building_record has a valid size_tier in {small, medium, large}
  - Assert: no two building_records share the same (lat, lng) pair (tolerance: 0.0001 degrees)
  - Warn: if building_record.owner is not null, that owner exists in citizen_records
  - Warn: if > 10% of building_records fall outside all district boundaries

ON AIRTABLE SYNC (every 15 minutes):
  - Compare new building_records against last sync
  - If a building_record was deleted, log warning (buildings should not disappear mid-session)
  - If a building_record.owner changed, update facade decoration level and prop display
  - If building_record count changed by > 20% since last sync, log alert (possible data corruption)
```

### Geometry -> Collision Consistency

```
AFTER GENERATION:
  - For every fondamenta mesh: verify mesh.geometry.attributes.position has > 0 vertices
  - For every bridge mesh: verify bridge.userData.walkable == TRUE
  - Verify collision mesh total vertex count < 50K (keep collision geometry simple)
  - Raycast from 20 random fondamenta surface points downward: all must hit collision mesh within 0.1m
  - Raycast from 20 random canal center points downward: none should hit collision mesh (water is not walkable)
```

### Cross-System Consistency

```
DAILY (automated):
  - Count placed buildings. Compare against Airtable record count for records inside Venice bounds. Delta should be 0.
  - Count districts with > 0 buildings. Should equal 7 (all districts populated).
  - Count bridges. Should be >= number of canals (every canal must be crossable somewhere).
  - Verify district.config values match PATTERNS_Districts.md specifications:
    - Rialto: building_height_range [8, 16], street_width 2.5
    - San Marco: building_height_range [12, 22], building_decoration 0.9
    - (all 7 districts checked)
  - Verify prop distribution: Rialto has market_stalls, Cannaregio has lanterns, Santa Croce has forge props.
  - Verify water level is uniform at y=0 across all canals (no district has water at a different height).
```
