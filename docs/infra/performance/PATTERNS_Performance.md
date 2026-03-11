# PATTERNS -- Performance

> Design philosophy for Quest 3 optimization in Venezia.
> 14 milliseconds per frame. Every decision serves the frame budget.

---

## Core Principle: Performance Is Not Polish

Performance is not something you add at the end. It is a constraint that shapes
every architectural decision from the start. A Venice that runs at 72fps with
10 citizens but drops to 30fps with 50 citizens is architecturally broken, not
just unoptimized.

The Quest 3 is a mobile GPU with a fixed thermal envelope. It does not get
faster. The world must fit inside its constraints or it does not exist.

---

## The Frame Budget

Quest 3 runs at 72fps (optional 90fps, but 72 is the safe target). That gives
**14 milliseconds** per frame for everything: JavaScript, GPU rendering, audio
processing, garbage collection.

Budget allocation:

| Phase               | Budget  | Notes                                    |
|---------------------|---------|------------------------------------------|
| JavaScript (game logic, network, audio) | 4ms | Includes position updates, tier checks, priority queue |
| Three.js scene graph traversal | 2ms | Frustum culling, matrix updates |
| GPU draw calls      | 6ms     | Geometry, shaders, compositing            |
| GC + overhead       | 2ms     | Budget for JS garbage collection spikes   |
| **Total**           | **14ms**| Hard ceiling                              |

If any single frame exceeds 14ms, the Quest drops a frame. Consecutive drops
cause visible judder and nausea in VR. Two consecutive dropped frames is a bug.
Five is a showstopper.

---

## Hard Budgets

These are absolute ceilings, not targets. Exceeding any one of them causes
visible degradation on Quest 3.

| Resource         | Budget      | Rationale                                  |
|------------------|-------------|---------------------------------------------|
| Draw calls       | < 200       | Quest GPU batches poorly beyond ~200        |
| Triangles (visible) | < 500K  | XR2 Gen 2 vertex throughput limit           |
| Textures (VRAM)  | < 256MB    | Quest 3 has 8GB shared; OS + browser take ~4GB |
| JS heap          | < 512MB    | Beyond this, GC pauses become multi-ms      |
| Audio sources    | < 32       | Web Audio API spatial processing limit      |
| WebSocket bandwidth | < 50KB/s | Quest Wi-Fi is shared with tracking         |
| LLM calls        | < 1/second | Cost + latency; queue, don't batch          |

---

## Tier-Based Rendering

The citizen tier system is not just a narrative concept -- it is the primary
performance management mechanism. Each tier has a strict render budget:

### FULL Tier (~20 citizens)

- **Who:** Closest citizens with highest relationship + activity importance
- **Render cost per citizen:** ~2000 triangles, 1 draw call (instanced body),
  1 draw call (face/expression), skeletal animation (8 bones)
- **Total budget:** 40K triangles, 40 draw calls
- **Features:** Lip sync, mood expression, clothing detail, shadow casting

### ACTIVE Tier (~60 citizens)

- **Who:** Visible citizens within 30m, above minimum importance threshold
- **Render cost per citizen:** ~500 triangles, shared instanced mesh (1 draw
  call per batch of ~20), no skeletal animation (pose-based morph)
- **Total budget:** 30K triangles, 3-4 draw calls (batched)
- **Features:** Posture, basic clothing color, no facial expression, no shadow

### AMBIENT Tier (~100+ citizens)

- **Who:** All remaining citizens, including off-screen but nearby
- **Render cost per citizen:** ~50 triangles (billboard or capsule), fully
  instanced (1 draw call for all)
- **Total budget:** 5K triangles, 1 draw call
- **Features:** Silhouette only, drift animation (shader-based), no individual
  identity visible

### Budget Summary

| Tier    | Citizens | Tris/citizen | Draw calls | Total tris |
|---------|----------|-------------|------------|------------|
| FULL    | 20       | 2000        | 40         | 40K        |
| ACTIVE  | 60       | 500         | 4          | 30K        |
| AMBIENT | 100      | 50          | 1          | 5K         |
| **Total** | **180** |            | **45**     | **75K**    |

Citizens consume 75K of the 500K triangle budget and 45 of the 200 draw calls.
The remaining budget is for Venice geometry (buildings, canals, props).

---

## LOD Strategy

### Buildings

Venice buildings are the largest geometry consumers. LOD strategy:

| Distance    | LOD Level | Geometry                                    |
|-------------|-----------|---------------------------------------------|
| < 20m       | LOD0      | Full Venetian facade: windows, balconies, doorways, cornices |
| 20-50m      | LOD1      | Simplified facade: flat with bump-mapped detail |
| 50-100m     | LOD2      | Box with textured sides                     |
| > 100m      | LOD3      | Merged silhouette skyline (single mesh per district) |

LOD transitions use cross-fade (alpha blend over 3 frames) to avoid pop-in.
Each LOD level should be 4x fewer triangles than the previous.

### Water

Canal water is a single large plane with vertex-animated waves (shader-based,
no CPU cost). Reflection uses a pre-baked environment map, not real-time
planar reflection (which would double draw calls).

### Props

Market stalls, boats, lanterns, and other props use instanced rendering.
One geometry + one material per prop type, drawn in a single call regardless
of instance count. Props beyond 30m are culled entirely (they are small enough
to be invisible at that distance).

---

## Culling Pipeline

Every frame, the rendering pipeline culls objects in three passes:

### Pass 1: Frustum Culling (Automatic)

Three.js performs frustum culling automatically on all objects with
`frustumCulled = true`. Objects outside the camera's view pyramid are skipped.
Cost: ~0.1ms for 1000 objects.

### Pass 2: Distance Culling (Custom)

Objects beyond a maximum render distance are hidden. Distance thresholds vary
by object type:

| Object Type     | Max Render Distance | Reason                          |
|-----------------|---------------------|---------------------------------|
| FULL citizens   | 50m                 | Detail wasted beyond this       |
| ACTIVE citizens | 80m                 | Still recognizable at distance  |
| AMBIENT citizens| 150m                | Silhouettes visible far away    |
| Building LOD0   | 20m                 | Facade detail range             |
| Building LOD3   | 200m                | Skyline visible from anywhere   |
| Props           | 30m                 | Too small to see further        |

Distance culling runs every frame, but only recomputes tier assignments every
500ms (not every frame). Tier transitions are smooth (fade over 300ms).

### Pass 3: Occlusion Culling (Deferred)

True occlusion culling (skipping objects behind buildings) is a Phase 4
optimization. For V1, frustum + distance culling is sufficient because:
- Venice streets are narrow, so the frustum catches most occlusion naturally
- The camera's field of view in VR is ~100 degrees, further limiting visible objects
- LOD3 buildings at distance are cheap enough to render even if occluded

If needed later, the approach is hierarchical Z-buffer occlusion:
- Render a low-resolution depth-only pass of major building outlines
- Test each object's bounding box against this depth buffer
- Skip objects that are fully behind others
- Cost: ~1ms, saves ~2ms on complex scenes. Net win only in dense areas.

---

## Geometry Instancing and Batching

### Instancing

Same geometry rendered multiple times with different transforms in a single
draw call. Used for:

- **Ambient citizens:** all ~100 share one capsule/billboard geometry
- **ACTIVE citizens:** groups of ~20 share one simplified body geometry
- **Building windows:** one window geometry, instanced across all facades
- **Props:** one stall geometry for all market stalls, one lantern for all lanterns

Three.js `InstancedMesh` is the implementation. Each instance gets a unique
transform matrix and optional color attribute.

### Batching

Different geometries merged into a single draw call via `BufferGeometryUtils.mergeGeometries()`. Used for:

- **Static environment:** ground planes, canal walls, bridge surfaces merged
  per district into one draw call
- **LOD3 skyline:** all distant buildings merged into one silhouette mesh

Batched geometry cannot be individually culled. Only batch at distances where
all components would be rendered together anyway.

---

## Texture Management

### Texture Atlas

All building facade textures packed into one 2048x2048 atlas. UV coordinates
reference sub-regions. One texture bind for all buildings in a district.

### Procedural Materials

Where possible, materials are computed in the shader rather than sampled from
textures:
- **Water:** Fully procedural (noise function for waves, gradient for color)
- **Stone walls:** Tiling procedural pattern (saves a texture slot)
- **Glass windows:** Transparent material with environment reflection

### Memory Monitoring

The client tracks approximate VRAM usage:
```
textureMemory = sum(texture.image.width * height * 4)  // RGBA
geometryMemory = sum(geometry.attributes.position.count * stride)
```

If total exceeds 200MB, trigger aggressive LOD (force all buildings to LOD2+,
reduce ACTIVE citizen count). This is a safety valve, not normal operation.

---

## Adaptive Quality

When the frame time exceeds budget, the client should degrade gracefully:

| Frame Time | Action                                      |
|------------|---------------------------------------------|
| < 14ms     | Normal operation                             |
| 14-18ms    | Reduce FULL citizen count from 20 to 10     |
| 18-22ms    | Drop device pixel ratio from 1.0 to 0.75    |
| > 22ms     | Force all citizens to AMBIENT, disable props |

Adaptive quality checks run every 60 frames (once per second). The system
never oscillates (hysteresis: only upgrade quality after 5 consecutive seconds
below threshold).

---

## Profiling

### Built-in Metrics

The client exposes a performance overlay (toggled via double-tap on left
controller or Shift+P on desktop):

```
FPS: 72 | Frame: 11.2ms | JS: 3.1ms | GPU: 6.8ms
Draw: 147 | Tris: 312K | Tex: 178MB | Heap: 289MB
Citizens: 18F / 52A / 96B | Audio: 24/32
```

### Three.js Renderer Info

`renderer.info` provides draw call count, triangle count, and texture count
per frame. Log these every 5 seconds to a rolling buffer for trend analysis.

### Quest Performance Overlay

The Quest system performance overlay (accessible via developer settings) shows
GPU utilization, thermal state, and clock speeds. Use this for hardware-level
profiling. The app cannot access this data programmatically.

---

## The Non-Negotiables

1. **72fps or the feature is cut.** No visual feature justifies dropping below
   72fps on Quest 3. If a feature causes frame drops, it is disabled or
   simplified until it fits the budget. No exceptions.

2. **Tier system is the performance system.** Every rendering decision flows
   through the tier assignment. If a citizen is AMBIENT, they get the AMBIENT
   budget. Period. No "but this citizen is important" overrides outside the
   tier algorithm.

3. **Instancing is mandatory for repeated geometry.** Any geometry that appears
   more than 3 times must use InstancedMesh. Individual draw calls for repeated
   objects are a bug, not a TODO.

4. **No real-time reflections.** Venice has water everywhere. Real-time planar
   reflections would double the scene render cost. Pre-baked environment maps
   only. This is a hard constraint, not a quality tradeoff.

5. **Measure, then optimize.** No speculative optimization. Profile on Quest 3
   hardware (not desktop). Fix the actual bottleneck, not the assumed one.
   The performance overlay exists for this purpose.
