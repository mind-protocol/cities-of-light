# Quest 3 Performance Warden — Cities of Light

**Target**: 90 fps on Quest 3 (Snapdragon XR2 Gen 2, Adreno 740)
**Headroom rule**: Budget to 72 fps. If you hit 72 fps under load, you ship at 90 fps with thermal margin.

---

## 0. Current State — The Problem

Audit date: 2026-03-05

| Metric | Current | Quest 3 Budget | Verdict |
|--------|---------|----------------|---------|
| Draw calls | ~850 | <100 | FAIL (8.5x over) |
| Triangles | ~80K | <100K | OK (barely) |
| Point lights | ~30 | <8 | FAIL (3.7x over) |
| Shadow maps | 1 directional (512²) | 1 max | OK |
| Shadow type | PCFSoftShadowMap | PCFShadowMap or none | WARN |
| Instancing | 0 uses | everything repeating | FAIL |
| Per-frame allocs | 15-25 Vector3/Quat | 0 | FAIL |
| Water reflection | full mirror pass | baked or fake | FAIL |
| Tone mapping | ACESFilmic | Linear or none | WARN |
| LOD | none | 2-3 levels | FAIL |
| dispose() calls | 0 | on every swap | FAIL |
| Post-processing | none | none | OK |
| Pixel ratio | 1.0 | 1.0 | OK |
| Foveation | 1.0 (max) | 1.0 | OK |

**Bottom line**: Draw calls are the #1 killer. Everything else is secondary until draw calls drop below 100.

---

## 1. Performance Budget by Subsystem

Total frame budget at 90 fps: **11.1 ms** (GPU + CPU combined).
At 72 fps: **13.9 ms**. We budget to 13.9 ms and let foveation + reprojection cover the gap.

### GPU Budget (8 ms target)

| Subsystem | Draw Calls | Triangles | Lights | GPU ms | Notes |
|-----------|-----------|-----------|--------|--------|-------|
| Sky dome | 1 | 2 (quad) | 0 | 0.3 | Preetham shader on a hemisphere |
| Water plane | 1 | 2 | 0 | 0.5 | NO reflection pass. Scrolling normal + fake fresnel |
| Current island terrain | 1 | 8K | 0 | 0.8 | Vertex-colored, merged geometry |
| Current island vegetation | 1-3 | 5K | 0 | 0.5 | InstancedMesh per type (palms/crystals/columns/flowers) |
| Current island rocks | 1 | 2K | 0 | 0.2 | InstancedMesh, all 25+5 merged |
| Distant islands (x4) | 4 | 800 | 0 | 0.3 | LOD2: flat disc + silhouette only |
| Waypoint beacons (near) | 2-4 | 200 | 0 | 0.2 | InstancedMesh, emissive (no light) |
| AI citizens (x3) | 3 | 300 | 0 | 0.2 | Emissive material, no PointLight |
| Human avatars (x5) | 5 | 500 | 0 | 0.3 | Head+body merged per avatar |
| Memorials (x2 near) | 2-4 | 400 | 0 | 0.3 | Only active ones rendered |
| Video texture (x1) | 1 | 2 | 0 | 0.5 | One video playing at a time |
| Stars | 1 | points | 0 | 0.1 | Points, 400 max |
| Fireflies | 1 | points | 0 | 0.1 | Points, 30 max |
| Clouds | 1 | 2 | 0 | 0.1 | Single merged plane |
| Shadow pass | ~8 | - | 1 dir | 1.5 | Only current island casters |
| Labels (sprites) | 5-8 | quads | 0 | 0.2 | Merged into texture atlas |
| Hands (VR) | 2 | 300 | 0 | 0.2 | InstancedMesh for joints |
| **TOTAL** | **~35-50** | **~18K** | **1** | **~6.3** | 1.7 ms headroom |

### CPU Budget (5 ms target)

| Subsystem | CPU ms | Notes |
|-----------|--------|-------|
| WebXR pose query | 0.3 | Fixed cost |
| VR locomotion + grab | 0.3 | Pre-allocate all vectors |
| Zone ambient lerp | 0.1 | 5 distance checks + color lerps |
| Waypoint proximity | 0.2 | 14 distance checks |
| Memorial proximity | 0.1 | 2-3 distance checks |
| Firefly animation | 0.1 | 30 sin/cos on typed array |
| Network send (position) | 0.1 | 10 Hz, not per-frame |
| AI citizen anim | 0.1 | 3 rotations + emissive pulse |
| JS overhead + GC | 0.5 | ZERO per-frame allocs target |
| scene.updateMatrixWorld | 0.5 | ~50 objects max |
| **TOTAL** | **~2.3** | 2.7 ms headroom |

### Memory Budget (Quest 3: 8 GB shared, ~3 GB for app)

| Asset | Memory | Notes |
|-------|--------|-------|
| Three.js + app code | 15 MB | JS heap |
| Geometry buffers | 8 MB | All islands, all LOD |
| Textures (compressed) | 20 MB | ETC2/ASTC, not PNG |
| Shadow map (512²) | 1 MB | Single depth buffer |
| Video texture (1 active) | 8 MB | 720p decoded frame |
| Audio buffers | 5 MB | TTS streaming chunks |
| WebSocket state | 1 MB | Citizen positions |
| Canvas textures (labels) | 2 MB | Atlas, not individual |
| **TOTAL** | **~60 MB** | Well within budget |

---

## 2. Profiling Checklist

Run these **before every merge** that touches rendering code.

### On-Device (Quest 3)

```
[ ] OVR Metrics Tool overlay enabled (fps, GPU util, CPU util, thermal)
[ ] Sustained 72 fps for 5 minutes (thermal test)
[ ] No frame drops below 60 fps during zone transitions
[ ] No frame drops during video playback start
[ ] No GC pauses >2 ms (Chrome DevTools → Performance → Memory)
[ ] GPU utilization <80% steady state
[ ] No thermal throttling warning after 10 min session
```

### Chrome DevTools (via `chrome://inspect` on Quest)

```
[ ] Performance tab → Record 10s in each zone
[ ] Confirm <11.1 ms per frame (90 fps) or <13.9 ms (72 fps)
[ ] renderer.info.render.calls < 100
[ ] renderer.info.render.triangles < 50K
[ ] renderer.info.memory.geometries < 80
[ ] renderer.info.memory.textures < 30
[ ] No "Forced reflow" or "Long task" warnings
[ ] Memory tab → Heap snapshot: no growing geometry/material count
```

### Automated (add to render loop behind `?perf` query flag)

```javascript
// Add this to main.js — only active with ?perf in URL
if (location.search.includes('perf')) {
  const info = renderer.info;
  console.log(
    `DC:${info.render.calls}`,
    `Tri:${info.render.triangles}`,
    `Geo:${info.memory.geometries}`,
    `Tex:${info.memory.textures}`,
    `Prog:${info.programs.length}`
  );
}
```

### Kill Switches for Profiling

```javascript
// Bisect performance problems by disabling subsystems
const PERF_FLAGS = {
  shadows: true,      // set false → skip shadow pass
  water: true,        // set false → flat blue plane
  vegetation: true,   // set false → bare islands
  particles: true,    // set false → no stars/fireflies
  distantIslands: true, // set false → only current island
  videoTexture: true, // set false → static screen
};
```

---

## 3. Rendering Rules

### R1: Draw Call Ceiling

**HARD LIMIT: 100 draw calls on Quest.**

Every new feature must declare its draw call cost. If adding a feature pushes past 100, something else must be removed or merged.

Current path from 850 → 50:

| Fix | Saves | How |
|-----|-------|-----|
| Instance all rocks (125 meshes → 1) | ~124 | `InstancedMesh` with 3 geometry variants |
| Instance palm trunks (8 segs × ~20 → 1) | ~155 | Merge trunk into single geometry, instance across trees |
| Instance palm fronds (~140 → 1) | ~139 | Single frond geometry, instance with transform matrix |
| Instance flowers (~210 → 3) | ~207 | Stem=1, petal=1, center=1 InstancedMesh |
| Instance columns (36 → 3) | ~33 | Shaft=1, capital=1, base=1 |
| Instance crystals (10 → 1) | ~9 | Single icosahedron, instance with scale matrix |
| Merge coconuts into palm | ~60 | Part of palm instance |
| Kill all PointLights (~28) | ~0 DC but huge GPU | Emissive materials only, no real-time lights except sun |
| Merge shore ring into terrain | ~5 | Extend terrain mesh to include shore verts |
| Merge cloud planes (2 → 1) | ~1 | Single plane, two UV layers |
| LOD distant islands | ~varies | Don't render vegetation/rocks for islands >30m away |
| **Total saved** | **~733** | |

### R2: Material Sharing

**RULE: Never create a material per-instance.**

Current violations:
- 25 unique rock materials per island (125 total) → **1 shared material with vertex colors**
- 7 unique frond materials per palm → **1 shared material, color via vertex attribute**
- 8 trunk segment materials per palm → **1 shared material with vertex color gradient**
- New material on every memorial approach/depart → **reuse, swap `.map` property only**

### R3: No Per-Frame Allocations

**RULE: Zero `new THREE.Vector3/Quaternion/Matrix4/Color` inside the render loop.**

Pre-allocate at module scope:

```javascript
// TOP OF FILE — reusable temporaries
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _mat4 = new THREE.Matrix4();
```

Current violations (fix all):
- `main.js` render loop: 6-10 Vector3 per frame
- `vr-controls.js`: 8-12 Vector3/Quaternion per frame
- `memorial.js` update: 1 Vector3 per frame per memorial
- `main.js` stream camera: Vector3 in loop body

### R4: Frustum Culling

Three.js frustum culling is **ON by default** — do not disable it (`frustumCulled = false`) unless the object is always visible (e.g., hand joints attached to camera).

Current: hand joints have `frustumCulled = false` — **acceptable**.
Ensure no future code disables it for scene objects.

### R5: No Alpha-Blended Large Surfaces

Transparent surfaces cause overdraw (pixels drawn multiple times). On Quest's tile-based GPU, this is poison.

**Rules:**
- Water: opaque with fake transparency via color
- Shore ring: remove transparency → vertex-blend into terrain
- Cloud planes: `depthWrite: false`, `renderOrder: 999`, keep both thin
- Vegetation: use `alphaTest: 0.5` (alpha cutout), NOT `transparent: true`

### R6: Geometry Budget Per New Feature

Before adding any geometry:

```
Feature: [name]
Draw calls: [N]
Triangles: [N]
Materials: [N unique / N shared]
Lights: [N]  ← should be 0
Textures: [NxN, format]
Per-frame cost: [description]
Memory: [N MB]
Quest OK: [yes/no]
```

---

## 4. Lighting Rules

### L1: One Directional Light. Period.

The sun. That's it. No other real-time shadow-casting lights.

**Kill list** (replace with emissive materials):
- 10 crystal PointLights → emissive material (already has emissiveIntensity=0.4)
- 14 waypoint PointLights → emissive material (already has emissiveIntensity=0.5+)
- 2 camera body PointLights → emissive
- Human avatar PointLights → emissive
- AI citizen PointLights → emissive
- Memorial PointLights → emissive

**GPU cost saved**: Each PointLight forces an additional lighting pass per affected fragment. 30 lights × ~1000 affected fragments = 30K extra fragment shader invocations per frame. Removing them saves ~1-2 ms GPU.

### L2: Shadow Map Rules

- **One shadow map**: directional sun, 512×512 on Quest
- **Shadow type**: `PCFShadowMap` (not `PCFSoftShadowMap` — saves ~0.3 ms)
- **Shadow casters**: Only terrain + large rocks + palm trunks on current island
- **Shadow receivers**: Only terrain on current island
- **Shadow camera frustum**: Tight-fit to current island (50m box), not 100m
- **No shadow on distant islands**: Set `castShadow = false` when island is not current zone
- **Consider**: Baked shadow texture (render once on island load) instead of real-time

### L3: Hemisphere Light is Fine

Keep the single `HemisphereLight(sky, ground, 0.4)` — it's a single uniform, zero GPU cost beyond the base fragment shader.

### L4: Environment Map

- **PMREM generation is expensive** (~50 ms). Do it ONCE at startup, cache the result.
- If zone transitions change the sky, pre-generate one PMREM per zone, swap on transition.
- Or: skip PMREM entirely. Vertex-colored terrain doesn't need env reflections. Only metallic objects (crystals, camera body) benefit. Use a fixed low-res cubemap instead.

### L5: No Dynamic Lights for Ambiance

If you want a crystal to "glow", use:
```javascript
material.emissive.set(0x4488ff);
material.emissiveIntensity = 0.6;
```
NOT a PointLight. The visual difference on Quest is negligible. The performance difference is massive.

---

## 5. Shader Rules

### S1: Prefer MeshBasicMaterial

If an object doesn't need lighting response (labels, glow rings, particles, sky), use `MeshBasicMaterial`. It skips the entire PBR lighting calculation.

Current candidates for downgrade:
- Cloud planes: already `MeshBasicMaterial` — good
- Glow rings (waypoints, memorials, AI citizens): switch to `MeshBasicMaterial`
- Labels/sprites: already using `SpriteMaterial` — fine

### S2: MeshStandardMaterial is the Max

**Never use MeshPhysicalMaterial.** It adds clearcoat, sheen, transmission calculations that Quest cannot afford.

`MeshStandardMaterial` is already expensive. Use it only for objects that need:
- Roughness/metalness variation (terrain, rocks, columns)
- Shadow receiving (terrain)

### S3: No Custom ShaderMaterial Unless Justified

The Water addon uses a custom `ShaderMaterial` with a mirror render pass. This is the single most expensive rendering operation in the scene (doubles draw calls).

**Replace with**: Simple scrolling-normal water:

```javascript
// Quest water: fake reflections, no mirror pass
const waterMat = new THREE.MeshStandardMaterial({
  color: 0x001e4d,
  roughness: 0.3,
  metalness: 0.6,
  normalMap: waterNormalTexture,  // pre-loaded, 256x256
  normalScale: new THREE.Vector2(0.3, 0.3),
  envMap: skyEnvMap,  // from PMREM, static
});
// Animate by offsetting UV in render loop:
// waterNormalTexture.offset.x = elapsed * 0.01;
```

**Cost**: From ~3 ms (mirror pass) → ~0.3 ms (single draw, normal offset).

### S4: Tone Mapping

`ACESFilmicToneMapping` adds a per-pixel computation to every fragment. On Quest:

- **Use `THREE.LinearToneMapping`** (cheapest, just exposure multiply)
- Or `THREE.NoToneMapping` if exposure is baked into materials

### S5: No Blending Stacking

Never stack multiple transparent objects at the same depth. Adreno's tile-based renderer handles one layer of transparency efficiently but tanks on 2+.

Violations:
- Glow ring (transparent) over pillar (transparent) at waypoints — make pillar opaque
- Fireflies (additive) over water (transparent) — water should be opaque

### S6: Vertex Count Per Material Switch

Every unique material = 1 draw call. Optimize by:
- Sharing materials across similar objects (all rocks = 1 material + vertex colors)
- Using vertex colors instead of texture variations
- Using `onBeforeCompile` to add small variations instead of separate materials

---

## 6. Asset Import Rules

### A1: No Runtime Procedural Generation on Quest

Current: all island terrain is generated procedurally (FBM noise, 4 octaves, per-vertex).

**Problem**: 5 islands × 4225 vertices × 4 octave noise = ~85K noise evaluations at startup. This takes 200-500 ms and blocks the main thread.

**Fix**: Pre-generate terrain geometry at build time. Ship as compressed `.glb` files. Load with `GLTFLoader`.

Or: accept the startup cost (one-time) but **never regenerate during session**.

### A2: Texture Compression

Quest 3 supports **ASTC** and **ETC2** natively. Uncompressed textures waste 4-8x VRAM.

| Texture | Current | Target | Savings |
|---------|---------|--------|---------|
| Sand normal map | 256² RGBA (256 KB) | 256² ASTC 4x4 (32 KB) | 8x |
| Cloud texture | 512² RGBA (1 MB) | 512² ASTC 4x4 (128 KB) | 8x |
| Water normals | External JPG → decoded RGBA | Pre-compressed ASTC, bundled | No CDN fetch |
| Label atlas | Multiple canvases | Single 1024² ASTC atlas | 10x fewer textures |

Use `@gltf-transform/cli` or `basisu` to compress textures at build time.

### A3: Bundle All Assets

**NEVER fetch textures from CDN at runtime** (current: water normals from `threejs.org`).

Bundle everything in the Vite build:
```javascript
import waterNormalsUrl from './textures/waternormals.jpg?url';
```

This ensures:
- Service worker caches it
- No external dependency
- Predictable load time

### A4: Video Constraints

- **Max resolution**: 720p (1280×720) for memorial videos
- **Codec**: H.264 Baseline (Quest hardware decoder) or VP9
- **Max simultaneous decodes**: 1 on Quest, 2 on desktop
- **Preload**: `none` (only decode on approach)
- **Format**: `.mp4` container (not `.webm` — Quest H.264 HW decoder is faster)
- **Bitrate**: 2 Mbps max (bandwidth + decode cost)

### A5: Audio Constraints

- **Format**: Opus in WebM container (native decode on Quest)
- **Sample rate**: 24 kHz (voice is fine at 24k, saves 50% vs 48k)
- **Spatial audio**: Use Web Audio API `PannerNode`, not Three.js `PositionalAudio` (lighter)
- **Max simultaneous**: 3 audio sources (1 TTS + 1 user voice + 1 ambient)

### A6: GLTF Import Rules (future assets)

If external 3D models are ever imported:
- **Max triangles per model**: 5K
- **Max textures per model**: 2 (diffuse + normal)
- **Max texture size**: 512×512
- **Format**: `.glb` (binary GLTF, single file)
- **Compression**: Draco or Meshopt
- **No animations baked in** — animate via JS (cheaper to control)

---

## 7. Island Streaming Plan

### The Problem

5 islands × ~850 draw calls = catastrophic. But even with instancing (target ~50 DC per island), rendering all 5 at full detail = 250 DC + all vegetation in memory.

### The Solution: 3-Tier LOD

```
┌─────────────────────────────────────────────┐
│  TIER 0: Current Island (full detail)       │
│  ─ Full terrain mesh (64×64)                │
│  ─ All vegetation (instanced)               │
│  ─ Rocks, beacons, memorials                │
│  ─ Shadow casting ON                        │
│  ─ Budget: 30-40 draw calls, 15K tris       │
├─────────────────────────────────────────────┤
│  TIER 1: Adjacent Islands (silhouette)      │
│  ─ Low-poly terrain (8×8 grid)              │
│  ─ 3-5 billboard vegetation sprites         │
│  ─ No rocks, no beacons, no memorials       │
│  ─ Shadow OFF                               │
│  ─ MeshBasicMaterial (no lighting calc)      │
│  ─ Budget: 2-3 draw calls, 200 tris each    │
├─────────────────────────────────────────────┤
│  TIER 2: Distant Islands (dot)              │
│  ─ Single flat disc with baked color         │
│  ─ Sprite label only                        │
│  ─ Budget: 1 draw call, 12 tris each        │
└─────────────────────────────────────────────┘
```

### Tier Classification

```javascript
function classifyIslands(playerPos, zones) {
  const current = detectNearestZone(playerPos);
  return zones.map(zone => {
    if (zone.id === current.zone.id) return { zone, tier: 0 };
    const dist = Math.hypot(
      zone.position.x - playerPos.x,
      zone.position.z - playerPos.z
    );
    if (dist < 50) return { zone, tier: 1 };
    return { zone, tier: 2 };
  });
}
```

### Streaming Lifecycle

```
Player at Island A:
  A = Tier 0 (full)
  B, C = Tier 1 (silhouette)  ← adjacent
  D, E = Tier 2 (dot)

Player teleports to Island C:
  1. Fade out A vegetation (200ms)
  2. Swap A → Tier 1 (dispose vegetation instances)
  3. Start loading C full assets
  4. Swap C → Tier 0 (create vegetation instances)
  5. Fade in C vegetation (200ms)
  6. Reclassify B, D, E by distance

Budget during transition: Tier 0 (loading) + Tier 1×2 + Tier 2×2
  = 40 + 6 + 2 = 48 draw calls ← still under budget
```

### Geometry Pool

Pre-build shared geometry at startup. Swap per zone:

```javascript
const GEOMETRY_POOL = {
  palmTrunk: new CylinderGeometry(0.12, 0.15, 4, 6),
  palmFrond: buildFrondGeometry(),  // single canonical frond
  rock: new IcosahedronGeometry(0.25, 1),
  crystal: new IcosahedronGeometry(0.4, 0),
  columnShaft: new CylinderGeometry(0.3, 0.33, 4, 6),
  flower: new SphereGeometry(0.04, 4, 4),
};

// Per island: one InstancedMesh per geometry type
// Swap instance count + matrices on zone change
```

### Memory Management on Transition

```javascript
function transitionToTier(island, newTier) {
  if (island.currentTier === newTier) return;

  // Dispose current tier assets
  if (island.currentTier === 0) {
    island.vegetationInstances.forEach(im => {
      im.dispose();  // InstancedMesh
      island.group.remove(im);
    });
    island.vegetationInstances = [];
  }

  // Build new tier
  if (newTier === 0) {
    island.vegetationInstances = buildVegetation(island.zone);
    island.vegetationInstances.forEach(im => island.group.add(im));
  }

  island.currentTier = newTier;
}
```

### Pre-Warm

On startup, build Tier 0 for spawn island, Tier 1 for adjacent, Tier 2 for rest.
When player approaches a Tier 1 island (within 30m), begin upgrading to Tier 0 in the background (spread geometry creation across 3 frames using a coroutine pattern).

---

## 8. Implementation Priority

Ordered by fps-per-hour-of-work:

| # | Fix | Estimated FPS Gain | Effort |
|---|-----|-------------------|--------|
| 1 | Kill all PointLights → emissive | +8-12 fps | 1 hour |
| 2 | Replace Water mirror → fake water | +5-8 fps | 2 hours |
| 3 | Instance rocks (125 meshes → 1) | +3-5 fps | 2 hours |
| 4 | Instance palms (360 meshes → 2) | +5-8 fps | 3 hours |
| 5 | Instance flowers (210 → 3) | +3-4 fps | 1 hour |
| 6 | Instance columns (36 → 3) | +1-2 fps | 1 hour |
| 7 | LOD distant islands | +3-5 fps | 3 hours |
| 8 | Kill per-frame allocations | +2-3 fps (stability) | 2 hours |
| 9 | Share materials (125 unique → 5) | +2-3 fps | 2 hours |
| 10 | PCFSoftShadow → PCFShadow | +1-2 fps | 5 min |
| 11 | ACES → Linear tone mapping | +0.5-1 fps | 5 min |
| 12 | Bundle water texture (kill CDN) | startup time | 10 min |
| 13 | Texture compression (ASTC) | memory | 2 hours |
| 14 | Label texture atlas | -10 textures | 2 hours |

**Phase 1 (day 1)**: Items 1, 2, 10, 11, 12 → from ~25 fps to ~45 fps
**Phase 2 (day 2)**: Items 3, 4, 5, 6, 9 → from ~45 fps to ~70 fps
**Phase 3 (day 3)**: Items 7, 8 → from ~70 fps to ~80 fps
**Phase 4 (polish)**: Items 13, 14 → stability + memory

---

## 9. Hard Rules (Enforce on Every PR)

```
1. renderer.info.render.calls < 100    — or PR is rejected
2. renderer.info.render.triangles < 50K — or PR is rejected
3. Zero new PointLight/SpotLight        — emissive only
4. Zero new THREE.* in render loop      — pre-allocate
5. Zero new Material per instance        — share or vertex-color
6. Every InstancedMesh over Mesh         — for >3 identical objects
7. dispose() on every remove             — geometry + material + texture
8. No transparent large surfaces         — alphaTest or opaque
9. No external texture URLs              — bundle everything
10. Video: 720p max, 1 decode at a time  — Quest HW decoder limit
```

---

## Appendix: renderer.info Snapshot Template

Paste this in the console on Quest to check current state:

```javascript
const i = renderer.info;
console.table({
  'Draw calls': i.render.calls,
  'Triangles': i.render.triangles,
  'Points': i.render.points,
  'Lines': i.render.lines,
  'Geometries': i.memory.geometries,
  'Textures': i.memory.textures,
  'Programs': i.programs?.length || '?',
});
```

Target output:
```
Draw calls:  < 100
Triangles:   < 50K
Geometries:  < 80
Textures:    < 30
Programs:    < 15
```
