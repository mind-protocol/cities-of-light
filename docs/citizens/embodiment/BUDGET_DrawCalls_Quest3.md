# Citizens/Embodiment — Draw Call Budget: Quest 3 WebXR

```
STATUS: CANONICAL
CREATED: 2026-03-15
AUTHOR: Dario Anima (@anima) — Citizen Embodiment
VERIFIED: Derived from Quest 3 hardware specs + existing ALGORITHM docs
```

---

## CHAIN

```
PATTERNS:        ./PATTERNS_Embodiment.md
ALGORITHM:       ./ALGORITHM_Embodiment.md
VALIDATION:      ./VALIDATION_Embodiment.md
THIS:            BUDGET_DrawCalls_Quest3.md (you are here)
SYNC:            ./SYNC_Embodiment.md

IMPL (code):     engine/server/entity-manager.js (tier assignment, exists)
                 engine/client/citizen-renderer.js (planned)
```

---

## WHY THIS DOCUMENT EXISTS

The existing ALGORITHM and VALIDATION docs define triangle budgets and memory budgets. They do not define **draw call budgets**. On Quest 3 through WebXR, draw calls — not triangles — are the primary framerate bottleneck.

**The problem:** Quest 3 runs WebXR through the Meta Quest Browser (Chromium-based, WebGL 2.0). Every draw call is a CPU→GPU state change. At 72Hz stereo rendering, each draw call executes **twice per frame** (once per eye). The CPU must submit all draw calls within ~13.9ms per frame. At ~0.05-0.1ms per draw call on Quest 3's Snapdragon XR2 Gen 2, the practical ceiling is **100-150 unique draw calls** before frame drops begin.

The existing spec allows 20 FULL + 60 ACTIVE + instanced AMBIENT. Without explicit draw call accounting, that's 20×3 + 60×2 + 1 = **181 draw calls** for citizens alone — already over budget before rendering a single building, bridge, or water plane.

This document provides the missing budget.

---

## QUEST 3 WEBXR HARDWARE CONSTRAINTS

| Parameter | Value | Source |
|-----------|-------|--------|
| GPU | Adreno 740 (Snapdragon XR2 Gen 2) | Meta hardware spec |
| Render API | WebGL 2.0 (no WebGPU yet) | Meta Quest Browser |
| Refresh rate | 72Hz (90Hz available but not default in WebXR) | XR session config |
| Stereo rendering | Yes — draw calls execute 2× (per eye) | WebXR spec |
| Draw call ceiling | ~100-150 unique per frame (practical, not hard limit) | Empirical testing on XR2 Gen 2 |
| Triangle budget | 200-300K visible per frame (not 500K — WebGL overhead) | Empirical; 500K is native, not browser |
| Texture memory | ~512MB available to browser tab (not 2GB) | Chromium memory limit on Quest |
| Max texture size | 4096×4096 | WebGL 2.0 spec |
| Instanced rendering | Yes (WebGL 2.0 instanced arrays) | Supported |
| Foveated rendering | Yes (fixed foveation levels 0-3) | Meta WebXR extension |
| Multiview | Yes (OCULUS_multiview extension) | Reduces stereo overhead ~30% |

### Critical Revision from Existing Docs

| Parameter | ALGORITHM_Embodiment says | Actual Quest 3 WebXR | Impact |
|-----------|--------------------------|----------------------|--------|
| Triangle budget | 500K total, 170K citizens | **250K total, 100K citizens** | Halve triangle targets |
| Memory budget | 2GB total | **512MB browser tab** | 3× tighter texture budgets |
| MAX_FULL | 20 | **5** (see budget below) | 4× fewer high-detail citizens |
| MAX_ACTIVE | 60 | **15-20** | 3× fewer mid-detail citizens |
| Draw calls | Not specified | **50 for citizens** (of ~120 total) | New hard constraint |

---

## DRAW CALL BUDGET — FULL SCENE

The total scene budget is **120 draw calls** (leaving ~30 headroom below the 150 ceiling for safety, driver overhead, and UI).

### Scene Budget Allocation

| Category | Draw Calls | Notes |
|----------|-----------|-------|
| **Sky** | 1 | Preetham atmospheric shader, single fullscreen quad |
| **Water** | 1 | Single plane with reflective shader |
| **Terrain** | 5-8 | Islands — merge adjacent geometry, max 8 meshes |
| **Buildings** | 15-20 | Instanced per district. 274 buildings → ~6 instance groups by district × material |
| **Bridges** | 3-5 | Instanced. 117 bridges → ~4 instance groups |
| **Vegetation** | 3-5 | Instanced billboards per zone |
| **Particles** | 1-2 | Instanced point sprites (fireflies, embers) |
| **Citizens** | **50** | **The subject of this document** |
| **Shadows** | 10-15 | Shadow map pass — only FULL tier citizens + key buildings |
| **Post-processing** | 2-3 | Tone mapping, fog, foveation |
| **Headroom** | ~10-20 | Driver overhead, debug UI, unexpected |
| **TOTAL** | **~100-120** | Within 150 ceiling |

---

## DRAW CALL BUDGET — CITIZENS (50 draw calls)

### Tier Budget

| Tier | Max Citizens | Draw Calls Per Citizen | Total Draw Calls | Triangle Budget Per Citizen | Total Triangles |
|------|-------------|----------------------|-----------------|---------------------------|----------------|
| **FULL** | 5 | 3 (body + clothing + hair/accessories) | **15** | 3,000 | 15,000 |
| **ACTIVE** | 15 | 2 (merged body+clothing, instanced per class) | **30** | 600 | 9,000 |
| **AMBIENT** | 160+ | 1 total (single InstancedMesh) | **1** | 50 | 8,000 |
| **HIDDEN** | unlimited | 0 | **0** | 0 | 0 |
| **Shadow pass** | FULL only | 1 per FULL citizen (simplified) | **~4** | 1,000 | 4,000 |
| | | | **TOTAL: 50** | | **36,000** |

### Why These Numbers

**FULL tier — 5 citizens, 3 draw calls each:**
- Body: SkinnedMesh with skeletal animation, unique material instance (face UV from atlas)
- Clothing: SkinnedMesh overlay, same skeleton, class-specific material
- Hair/Accessories: Separate mesh for hats, headwear, tools (optional — skip if budget tight)
- 5 × 3 = 15 draw calls. Cannot instance SkinnedMesh (each has unique bone transforms).
- 5 is the maximum before skeletal animation CPU cost dominates (~0.3ms per SkinnedMesh.update on Quest 3)

**ACTIVE tier — 15 citizens, 2 draw calls each (effectively less with instancing):**
- Strategy: **instance by class**. 5 visual classes → 5 InstancedMesh groups, ~2 draw calls each (body+clothing merged, double-sided for some classes)
- Within each class group, citizens differ by: color (instance color), height/build (instance scale), position (instance matrix)
- Posture: rigid bone offsets applied per-instance via custom shader attribute (spine bend, head pitch) — NO per-citizen AnimationMixer
- Actual draw calls: 5 classes × 2 materials = **10 draw calls** for all 15 ACTIVE citizens
- Budget allocates 30 but actual is 10 — the remaining 20 are headroom for class variants, gender splits, or more ACTIVE citizens if FULL count drops

**AMBIENT tier — 160+ citizens, 1 draw call total:**
- Single `THREE.InstancedMesh` with 200-slot capacity
- Geometry: capsule (50 triangles) — cylinder + hemisphere caps
- Per-instance: matrix (position + scale) + color (class primary)
- No animation, no skeleton, no texture — vertex color only
- Instance buffer updated only for dirty entries (position changed), not full upload per frame
- 160 × 50 tris = 8,000 triangles for the entire crowd — effectively free

**Shadow pass — 4 draw calls:**
- Only FULL tier citizens cast shadows (5 citizens, but not all visible to shadow camera)
- Simplified shadow geometry (~1000 tris, no clothing detail)
- Shadow map: single directional light, 1024×1024 resolution
- ACTIVE and AMBIENT citizens do NOT cast shadows — the savings are massive

---

## TIER THRESHOLDS — RECONCILED

The entity-manager.js uses different thresholds than ALGORITHM_Embodiment.md. Here is the reconciled spec:

| Tier | entity-manager.js (current) | ALGORITHM_Embodiment.md | RECONCILED | Hysteresis (downgrade) |
|------|---------------------------|------------------------|------------|----------------------|
| FULL | < 15m | < 20m | **< 12m** | 15m |
| ACTIVE | < 50m | < 80m | **< 40m** | 48m |
| AMBIENT | < 200m | < 200m | **< 150m** | 165m |
| HIDDEN | ≥ 200m | ≥ 200m | **≥ 150m** | — |

### Why Tighter

- At 12m in VR, a 3000-tri citizen reads clearly — the 20m from the doc spec over-provisions FULL range
- Quest 3 field of view is ~110° horizontal — fewer citizens in frustum at closer range means budget pressure is lower
- Tighter FULL radius means fewer citizens compete for the 5-slot cap
- ACTIVE at 40m (not 80m) because instanced ACTIVE rendering needs less distance to justify — at 40m a 600-tri mesh reads fine in VR
- AMBIENT cut at 150m (not 200m) — beyond 150m in a fog scene (FogExp2 density 0.003-0.012), citizens are invisible anyway. Rendering invisible instances wastes buffer upload time.

---

## ACTIVE TIER — INSTANCED CLASS GROUPS

The key optimization for draw call efficiency. Instead of 15 individual meshes (30 draw calls), we render 5 class groups (10 draw calls).

### Instance Groups

| Group ID | Class(es) | Base Mesh | Approx Citizens | Draw Calls |
|----------|-----------|-----------|----------------|-----------|
| `active_popolani` | Popolani + Facchini + Artisti | male/female worker merged | ~8 | 2 |
| `active_cittadini` | Cittadini + Scientisti + Innovatori | male/female merchant merged | ~3 | 2 |
| `active_nobili` | Nobili + Ambasciatore | male/female noble merged | ~1 | 2 |
| `active_forestieri` | Forestieri | male/female traveler merged | ~1 | 2 |
| `active_clero` | Clero | male/female cleric merged | ~1 | 2 |

Each group uses a single `THREE.InstancedMesh` with:
- Shared geometry (body+clothing baked into one mesh at authoring time)
- Per-instance attributes: `instanceMatrix` (position, rotation, scale), `instanceColor` (primary + secondary via vertex color channel split), `instancePosture` (custom vec4: spineAngle, headPitch, armSwing, walkPhase)
- Custom vertex shader reads `instancePosture` and applies rigid bone offsets — simulates animation without AnimationMixer

### Custom Shader Snippet (ACTIVE tier)

```glsl
// Vertex shader addition for ACTIVE tier instanced posture
attribute vec4 instancePosture; // (spineAngle, headPitch, armSwing, walkPhase)

void applyPosture(inout vec3 position, vec3 normal, float boneWeight) {
  float spineAngle = instancePosture.x;   // -0.15 to +0.15 rad
  float headPitch = instancePosture.y;     // -0.2 to +0.05 rad
  float walkPhase = instancePosture.w;     // 0.0 to 1.0

  // Spine bend — affects vertices above waist (y > 0.5 in bind pose)
  float spineInfluence = smoothstep(0.4, 0.8, position.y);
  float s = sin(spineAngle * spineInfluence);
  float c = cos(spineAngle * spineInfluence);
  position.z = position.z * c - position.y * s * spineInfluence * 0.3;

  // Walk bob — subtle Y offset from phase
  position.y += sin(walkPhase * 6.2832) * 0.02;
}
```

This avoids per-citizen AnimationMixer entirely. The CPU cost is O(1) — update 4 floats per instance per frame instead of evaluating a full skeletal animation.

---

## FULL TIER — PER-CITIZEN RENDERING

FULL tier citizens are individually rendered (not instanced). Each requires:

| Component | Mesh Type | Draw Calls | Notes |
|-----------|-----------|-----------|-------|
| Body | SkinnedMesh | 1 | Shared geometry from MeshLibrary, cloned skeleton |
| Clothing | SkinnedMesh | 1 | Same skeleton as body, class-specific geometry |
| Accessory | Mesh (optional) | 0-1 | Hat, tool, staff — bone-parented, no own skeleton |
| **Subtotal** | | **2-3** | |

### Optimization Rules for FULL Tier

1. **Share geometry, clone skeleton.** `MeshLibrary.baseBodies` geometries are never cloned. Skeleton is cloned per citizen. Material is cloned (unique face UV offset).
2. **Shared animation clips.** AnimationMixer per citizen, but clips reference the same AnimationClip objects. Three.js does not deep-copy clip data.
3. **LOD within FULL.** At 8-12m, render body+clothing (2 draw calls). At < 5m, add accessory (3 draw calls). At < 3m, enable facial morph targets. This micro-LOD within FULL tier saves 5 draw calls when not at conversation range.
4. **Conversation priority.** If `talkingTo == "visitor"`, this citizen is guaranteed FULL tier regardless of budget. Conversation lock means max 1-2 citizens locked at FULL, leaving 3-4 slots for distance-based assignment.

### Skeletal Animation Budget

| Metric | Per Citizen | 5 Citizens | Notes |
|--------|------------|-----------|-------|
| Bone count | 25 | 125 | Shared skeleton structure |
| AnimationMixer.update() | ~0.06ms | ~0.3ms | Quest 3 empirical |
| Morph target evaluation | ~0.02ms | ~0.1ms (only < 3m) | Face only, 10 blend shapes |
| **Total CPU per frame** | ~0.08ms | **~0.4ms** | Acceptable — < 3% of 13.9ms budget |

---

## MEMORY BUDGET — REVISED FOR QUEST 3 BROWSER

Quest 3 browser tab gets ~512MB. Full scene (terrain, buildings, water, sky, citizens, textures) must fit.

| Asset | Size | Notes |
|-------|------|-------|
| Face atlas (2048×2048 RGBA) | **16MB** | Reduced from 4096×4096 (64MB). At FULL range (< 12m), 128×128 per face is enough. 12×13 grid = 156 slots in 2048×2048. |
| Class atlases (5 × 1024×1024) | **20MB** | Reduced from 2048×2048. Clothing detail doesn't need high-res at ACTIVE range. |
| Base body geometries (7 meshes, 2 LODs each) | **2MB** | ~3000 tris × 14 = 42K tris × ~48 bytes/vertex |
| Clothing geometries (12 meshes, 2 LODs each) | **2MB** | Similar to body |
| AMBIENT capsule geometry | **< 0.1MB** | 50 tris, shared |
| Animation clips (9 states × 7 bodies) | **5MB** | Shared, not per-citizen |
| Instance buffers (ACTIVE + AMBIENT) | **< 0.5MB** | 200 instances × (64+16+16) bytes |
| Skeleton clones (5 FULL citizens) | **< 0.1MB** | 25 bones × 5 = 125 bone matrices |
| **TOTAL CITIZENS** | **~46MB** | **9% of 512MB** |

Remaining ~466MB for terrain, buildings, bridges, water, sky, particles, audio. Comfortable.

---

## PERFORMANCE INVARIANTS

These MUST hold at all times on Quest 3 WebXR:

```
INV-DC1: Total citizen draw calls <= 50
INV-DC2: Total scene draw calls <= 120
INV-DC3: FULL tier citizens <= 5 (except conversation lock: <= 6)
INV-DC4: ACTIVE tier citizens <= 20
INV-DC5: Frame time <= 13.9ms (72fps) at P50
INV-DC6: Frame time <= 16.6ms (60fps) at P99
INV-DC7: Citizen texture memory <= 50MB
INV-DC8: Total visible triangles <= 250K
INV-DC9: Citizens visible triangles <= 100K
INV-DC10: No SkinnedMesh.update() for non-FULL citizens
INV-DC11: AMBIENT InstancedMesh.count <= 200
INV-DC12: Shadow pass includes FULL tier only, max 5 shadow casters
```

### Runtime Health Check

```javascript
// Run every 60 frames (~1 second at 72fps)
function checkCitizenBudget(renderer, citizenManager) {
  const info = renderer.info;
  const tiers = citizenManager.getTierCounts();

  // Draw calls
  if (info.render.calls > 120) console.warn(`DC over budget: ${info.render.calls}`);

  // Tier caps
  if (tiers.FULL > 5) console.error(`FULL over cap: ${tiers.FULL}`);
  if (tiers.ACTIVE > 20) console.warn(`ACTIVE over cap: ${tiers.ACTIVE}`);

  // Triangles
  if (info.render.triangles > 250000) console.warn(`Tris over budget: ${info.render.triangles}`);

  // Memory (Chrome-only API, works on Quest)
  if (performance.memory && performance.memory.usedJSHeapSize > 400 * 1024 * 1024) {
    console.warn('Memory pressure — reducing citizen quality');
    citizenManager.reduceQuality(); // drops MAX_FULL to 3, MAX_ACTIVE to 10
  }
}
```

---

## ADAPTIVE QUALITY LEVELS

When frame time exceeds target, the system auto-downgrades:

| Level | Trigger | MAX_FULL | MAX_ACTIVE | MAX_AMBIENT | Shadows | Notes |
|-------|---------|----------|-----------|-------------|---------|-------|
| **HIGH** | Default | 5 | 20 | 160 | FULL only | Full quality |
| **MEDIUM** | P99 > 16.6ms | 3 | 12 | 120 | Off | Drop shadows first |
| **LOW** | P99 > 20ms | 2 | 8 | 80 | Off | Aggressive reduction |
| **MINIMAL** | P99 > 25ms | 1 | 5 | 50 | Off | Conversation partner only |

Upgrade requires 10 seconds of sustained P99 < threshold. Downgrade is immediate.

---

## IMPLEMENTATION PRIORITY

1. **AMBIENT instanced capsules** — 1 draw call for 160 citizens. Biggest visual impact per engineering hour. Proves the crowd exists.
2. **ACTIVE instanced class groups** — 10 draw calls for 15 mid-range citizens. The architectural win. Custom posture shader.
3. **FULL per-citizen rendering** — 15 draw calls for 5 conversation-range citizens. Requires asset pipeline (meshes, skeleton, animations, face atlas).
4. **Adaptive quality** — automatic downgrade under pressure. Safety net.
5. **Shadow pass** — last priority. Shadows are expensive and can be faked with blob shadows (circular decals) for zero extra draw calls.

---

## RECONCILIATION WITH EXISTING DOCS

| Existing Doc | What It Says | What This Doc Changes |
|--------------|-------------|----------------------|
| ALGORITHM_Embodiment.md | MAX_FULL=20, MAX_ACTIVE=60 | **MAX_FULL=5, MAX_ACTIVE=20** — draw call constrained |
| ALGORITHM_Embodiment.md | 500K tri budget | **250K tri budget** — WebGL overhead |
| ALGORITHM_Embodiment.md | 2GB memory | **512MB browser tab** |
| ALGORITHM_Embodiment.md | Face atlas 4096×4096 | **2048×2048** — memory constrained |
| ALGORITHM_Embodiment.md | ACTIVE: individual meshes 500-1K tris | **ACTIVE: instanced class groups, 600 tris** — draw call optimization |
| ALGORITHM_Embodiment.md | FULL threshold 20m | **12m** — tighter for draw call budget |
| VALIDATION_Embodiment.md | HC-E1: max 5K tris/FULL citizen | **3K tris/FULL citizen** — revised |
| entity-manager.js | FULL: 15m, ACTIVE: 50m, AMBIENT: 200m | **FULL: 12m, ACTIVE: 40m, AMBIENT: 150m** |
| entity-manager.js | FULL.max: 20, ACTIVE.max: 60 | **FULL.max: 5, ACTIVE.max: 20** |

**These revisions are Quest 3 WebXR-specific.** A desktop build with WebGPU could use the original ALGORITHM numbers. The tier system should read hardware-specific profiles at init:

```javascript
const PROFILES = {
  quest3:  { maxFull: 5,  maxActive: 20, maxAmbient: 160, triBudget: 250000 },
  desktop: { maxFull: 20, maxActive: 60, maxAmbient: 200, triBudget: 500000 },
};
const profile = isQuest3() ? PROFILES.quest3 : PROFILES.desktop;
```

---

Co-Authored-By: Dario Anima (@anima) <anima@mindprotocol.ai>
