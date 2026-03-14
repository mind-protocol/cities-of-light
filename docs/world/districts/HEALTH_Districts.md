# HEALTH: world/districts — Runtime Verification

STATUS: DRAFT
CREATED: 2026-03-14

---

## CHAIN

[OBJECTIVES](./OBJECTIVES_Districts.md) → [PATTERNS](./PATTERNS_Districts.md) → [BEHAVIORS](./BEHAVIORS_Districts.md) → [ALGORITHM](./ALGORITHM_Districts.md) → [VALIDATION](./VALIDATION_Districts.md) → [IMPLEMENTATION](./IMPLEMENTATION_Districts.md) → HEALTH (you are here) → [SYNC](./SYNC_Districts.md)

---

## PURPOSE

Runtime verification that Venice renders correctly and performantly. These checks run during and after world generation to catch rendering failures, performance degradation, and data integrity issues before the visitor experiences them.

---

## HEALTH INDICATORS

### HI1. World Generation Success

**Value:** Confirms that all geographic data loaded and produced valid geometry.

**Check:**
- 120 islands produced non-empty ExtrudeGeometry meshes
- 255 buildings (minus bridge-category) produced building groups with >0 children
- 281 bridges produced bridge groups with deck + railing meshes
- Total scene children count matches expected: islands + buildings + bridges + water plane

**Signals:**
- Healthy: all counts match, no generation errors
- Degraded: some items failed (logged warnings), >90% rendered
- Critical: <50% of expected items rendered, or generation threw exception

**How to verify:**
```
console.log('Islands:', world.group.children.filter(c => c.userData.type === 'island').length);
console.log('Buildings:', buildingRenderer.buildings.size);
console.log('Bridges:', bridgeRenderer.bridges.size);
```

### HI2. Frame Rate

**Value:** Confirms the world runs at target framerate.

**Check:**
- Sample `renderer.info.render.frame` delta every second
- Compute rolling average over 5 seconds

**Signals:**
- Healthy: ≥60fps desktop, ≥72fps Quest 3
- Degraded: 45-60fps desktop, 60-72fps Quest 3
- Critical: <45fps desktop, <60fps Quest 3 sustained >5s

**Throttle:** Check every 1000ms, not every frame.

### HI3. Memory Budget

**Value:** Confirms rendering stays within memory budget.

**Check:**
- `renderer.info.memory.geometries` count
- `renderer.info.memory.textures` count
- `performance.memory.usedJSHeapSize` (Chrome only)

**Signals:**
- Healthy: geometries <3000, textures <100, heap <1GB
- Degraded: geometries 3000-5000, heap 1-2GB
- Critical: geometries >5000, heap >2GB

**Throttle:** Check every 30000ms.

### HI4. Geographic Projection Sanity

**Value:** Confirms coordinate projection produces valid positions.

**Check (at load time only):**
- All building positions are within world bounds (not at origin, not at infinity)
- Building positions cluster in expected regions (not all at same point)
- Bridge endpoints are near island edges (within 50 world units of an island centroid)

**Signals:**
- Healthy: all positions valid and distributed
- Critical: >10% of buildings at origin or out of bounds

### HI5. Walkability

**Value:** Confirms the world has navigable surfaces.

**Check (at load time):**
- At least one mesh has `userData.walkable = true`
- Player spawn position has solid ground within 5m (raycast down hits something)

**Signals:**
- Healthy: spawn point has ground, walkable meshes exist
- Critical: no walkable surfaces, player would fall through

---

## KNOWN GAPS

- LOD health checks not applicable yet (LOD not implemented)
- Canal-specific water checks not applicable (using global water plane)
- Prop distribution checks not applicable (props not implemented)
- Day/night cycle checks not applicable (not implemented)
- District identity verification requires human evaluation (cannot be automated)

---

## HOW TO RUN

```bash
# Start engine server + client
cd /home/mind-protocol/cities-of-light
npm run dev:engine

# Open browser console, check:
# - renderer.info.render (frame count, draw calls)
# - renderer.info.memory (geometries, textures)
# - world object (island count, building count)
```

---

## MARKERS

@mind:todo Add automated health check endpoint at /health/rendering
@mind:todo Add FPS overlay toggle for development testing
