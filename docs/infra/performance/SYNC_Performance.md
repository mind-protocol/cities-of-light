# SYNC -- Performance

> Current state of performance infrastructure in Cities of Light.
> What exists, what is missing, and the gap to 152-citizen Venice on Quest 3.

---

## What Exists in Cities of Light

The codebase has no formal performance management system. It runs on Quest 3
with a basic scene (5 island zones, terrain, particles, fog, 3 AI citizens)
and maintains 72fps. But this baseline is far below the target complexity of
152 citizens, hundreds of buildings, canals, and spatial audio.

### Rendering

| File                         | Status  | Performance-Relevant Features              |
|------------------------------|---------|---------------------------------------------|
| `src/client/scene.js`        | Working | Procedural terrain (5 islands), particle systems, fog, hemisphere light |
| `src/client/main.js`         | Working | XR session management, render loop, camera rig |
| `src/client/avatar.js`       | Working | Visitor avatar (simple body, hands if tracked) |
| `src/client/camera-body.js`  | Working | Camera rig with body representation |

**Current render profile (estimated from code inspection):**
- Islands: 5 circular terrain meshes, ~2K tris each = ~10K tris total
- Particles: one Points system (~5000 particles), negligible GPU cost
- Fog: exponential FogExp2, trivial
- AI citizens: no 3D representation yet (positions tracked server-side, not rendered as meshes)
- Draw calls: ~15-20 (terrain + particles + fog + avatar + lights)
- Visible triangles: ~15K

This is well within Quest 3 budgets. The challenge is what happens when Venice
geometry and 152 citizen avatars are added.

### Scene Graph

Three.js frustum culling is enabled by default on all meshes (`frustumCulled = true`).
No custom distance culling. No LOD system. No instancing. No texture atlas.
No geometry batching.

### Audio Performance

| File                         | Status  | Performance Impact                         |
|------------------------------|---------|---------------------------------------------|
| `src/client/voice.js`        | Working | 1 shared PannerNode (HRTF) for TTS playback |
| `src/client/voice-chat.js`   | Working | 1 PannerNode per WebRTC peer (capped by peer count) |
| `src/client/zone-ambient.js` | Working | No audio sources (visual only) |

Current audio source count: 1 (TTS) + N peers (typically 0-3). Well within
the 32-source budget. No priority system exists because it is not yet needed.

### Memory

No memory monitoring. No disposal strategy for off-screen objects. The current
scene is small enough (~50MB estimated heap) that memory is not a concern. At
Venice scale (texture atlases, citizen data, conversation histories), the
512MB heap budget will require active management.

---

## What Is Missing

### 1. Citizen LOD System

No citizen rendering exists. When citizens are added, they need the three-tier
LOD system from PATTERNS_Performance.md:
- FULL: ~2000 tris, skeletal animation
- ACTIVE: ~500 tris, instanced mesh, pose-based
- AMBIENT: ~50 tris, billboard/capsule, fully instanced

**Current state:** `ai-citizens.js` tracks 3 citizen positions server-side.
No client-side mesh generation or rendering. The citizen-manager.js (planned)
will own tier assignment and mesh lifecycle.

**Gap:** Everything. From avatar generation to tier assignment to LOD transitions.

**Estimated effort:** 7-10 days (core citizen rendering pipeline)

### 2. Building LOD System

No building generation exists. Venice needs procedural Venetian architecture
with 4 LOD levels (LOD0 at 20m to LOD3 skyline silhouette at 100m+).

**Current state:** Scene generates 5 flat island terrains. No buildings,
no canals, no bridges.

**Gap:** Building generation, LOD pipeline, cross-fade transitions.

**Estimated effort:** 10-15 days (procedural building system with LOD)

### 3. Instancing Infrastructure

No instanced rendering anywhere in the codebase. All meshes are individual
Mesh objects. For 100+ ambient citizens and repeated building elements,
InstancedMesh is mandatory.

**Required:**
- InstancedMesh for ambient citizens (one capsule, 100+ instances)
- InstancedMesh for ACTIVE citizens (one body, ~60 instances in groups of 20)
- InstancedMesh for props (stalls, lanterns, boats)
- InstancedBufferGeometry for building windows

**Estimated effort:** 3-4 days (infrastructure), applied per object type as
objects are built

### 4. Geometry Batching

No static geometry merging. When Venice canals, fondamenta, and bridge surfaces
are generated, they should be merged per district into single draw calls.

**Current state:** 5 individual terrain meshes. Merging would save 4 draw
calls (trivial). At Venice scale with dozens of static elements per district,
batching saves 50-100 draw calls.

**Estimated effort:** 1-2 days (utility, applied during district generation)

### 5. Texture Atlas

No texture atlas system. Each material currently uses its own texture (or none,
for procedural geometry). When building facades are added with varied textures,
an atlas system prevents per-building texture binds.

**Required:**
- Atlas packing tool (offline, during build step)
- UV coordinate remapping for atlased geometry
- One 2048x2048 atlas per district (buildings + props)

**Estimated effort:** 2-3 days

### 6. Distance Culling

No custom distance culling. Three.js frustum culling is active but distance-based
visibility (hiding objects beyond a threshold) is not implemented.

**Required:**
- Per-object maxRenderDistance property
- Per-frame distance check (or per-500ms for tier-based objects)
- Tier transition smoothing (opacity fade over 300ms, not instant pop)

**Estimated effort:** 1-2 days

### 7. Adaptive Quality System

No frame time monitoring. No automatic quality degradation. If the frame budget
is exceeded, the experience simply drops frames.

**Required:**
- Frame time moving average (last 60 frames)
- Thresholds: 14ms (normal), 18ms (reduce citizens), 22ms (emergency)
- Quality levels: normal, reduced, minimal
- Hysteresis: 5 consecutive seconds below threshold before upgrading
- Actions per level: adjust FULL citizen count, device pixel ratio, prop visibility

**Estimated effort:** 2-3 days

### 8. Performance Overlay

No built-in profiling display. Developers must use browser DevTools or the
Quest system overlay.

**Required:**
- Togglable HUD (Shift+P desktop, double-tap-left-controller VR)
- Display: FPS, frame time, JS time, draw calls, triangle count, texture
  memory, heap size, citizen tier counts, audio source count
- Data source: `renderer.info` + `performance.now()` timing

**Estimated effort:** 1-2 days

---

## Performance Estimate: Current vs Target

```
CURRENT (5 islands, 3 AI citizens, no meshes)
==============================================
Draw calls:     ~20
Triangles:      ~15K
Textures:       ~10MB
JS heap:        ~50MB
Audio sources:  1-4
Frame time:     ~5ms (estimated)
Status:         WELL WITHIN BUDGET


TARGET (Venice districts, 152 citizens, full scene)
====================================================
Draw calls:     ~150-200
Triangles:      ~300-500K
Textures:       ~150-250MB
JS heap:        ~300-500MB
Audio sources:  20-32
Frame time:     ~10-14ms (target)
Status:         REQUIRES ALL SYSTEMS IN PATTERNS_Performance.md
```

The gap is roughly 10x in geometric complexity and 5x in memory usage. This
is achievable on Quest 3 with proper LOD, instancing, culling, and tier
management. Without those systems, the target scene will not run at 72fps.

---

## Risk Areas

### Memory

152 citizen conversation histories (10 turns each, ~2KB per turn) = ~4MB.
Citizen textures (if unique per citizen) could be catastrophic. Mitigation:
shared texture atlas with per-citizen color tinting, not unique textures.

### Garbage Collection

JavaScript GC pauses are the most unpredictable performance cost. Mitigations:
- Pre-allocate vectors, quaternions, matrices (no per-frame `new THREE.Vector3()`)
- Object pools for citizen meshes (reuse on tier transitions, don't destroy/recreate)
- Avoid string concatenation in hot paths (use template literals or pre-built strings)

The existing `voice-chat.js` already uses pre-allocated temporaries (`_fwd`, `_up`)
for zero per-frame allocation. This pattern must be followed everywhere.

### Thermal Throttling

Quest 3 reduces GPU clock speeds when the chip overheats. A scene that runs at
72fps cold may drop to 60fps after 15 minutes of sustained load. Mitigations:
- Target 12ms frame time, not 14ms (leave thermal headroom)
- Monitor frame time trend over 5-minute windows
- Adaptive quality triggers at 13ms, not 14ms

---

## File Map (Planned)

```
src/client/
  performance/
    frame-budget.js            # NEW: frame time monitor, adaptive quality
    perf-overlay.js            # NEW: debug HUD overlay
    distance-culler.js         # NEW: per-object max render distance
    instance-pool.js           # NEW: InstancedMesh management + object pooling
  citizens/
    citizen-manager.js         # NEW: tier assignment, LOD transitions
  venice/
    building-generator.js      # NEW: procedural buildings with LOD
    district-generator.js      # NEW: static geometry batching per district
```

---

## Priority Roadmap

| Priority | Task                          | Blocks                          | Effort  |
|----------|-------------------------------|---------------------------------|---------|
| P0       | Citizen tier + LOD system     | Cannot add 152 citizens         | 7-10 days |
| P0       | InstancedMesh for citizens    | Ambient citizens blow draw budget | 3-4 days |
| P1       | Building LOD pipeline         | Venice geometry unmanageable    | 10-15 days |
| P1       | Distance culling              | Objects rendered beyond useful range | 1-2 days |
| P1       | Frame time monitor            | No visibility into performance  | 1-2 days |
| P2       | Geometry batching             | Static geometry wastes draw calls | 1-2 days |
| P2       | Texture atlas                 | Per-building texture binds      | 2-3 days |
| P2       | Adaptive quality              | No degradation on overload      | 2-3 days |
| P3       | Performance overlay           | Developer convenience           | 1-2 days |
| P3       | Memory monitoring             | No early warning for heap       | 1 day    |
