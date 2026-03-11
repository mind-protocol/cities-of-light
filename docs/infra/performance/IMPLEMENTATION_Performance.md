# IMPLEMENTATION -- Performance

> Concrete Three.js APIs, renderer configuration, frustum culling setup,
> InstancedMesh usage, LOD implementation, profiler integration, adaptive
> quality system, and memory monitoring for Quest 3 optimization in Venezia.
> Reference source: `src/client/main.js`, `src/client/scene.js`,
> `src/client/avatar.js`, `src/client/zone-ambient.js`.

---

## 1. Current Renderer Configuration

```javascript
// src/client/main.js

const isQuest = /OculusBrowser|Quest/.test(navigator.userAgent);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(isQuest ? 1 : Math.min(window.devicePixelRatio, 2));
renderer.xr.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

### 1.1 Quest 3 Specifics

- `setPixelRatio(1)`: Native resolution on Quest 3 (1832x1920 per eye).
  Higher values cause GPU-bound frame drops.
- `antialias: true`: MSAA. Disable if frame budget exceeded.
- `shadowMap.enabled = true`: PCF soft shadows. Most expensive GPU feature.
  First candidate for adaptive quality reduction.
- `toneMapping = ACESFilmicToneMapping`: Standard cinematic tone mapping.
  Negligible performance cost.

### 1.2 Foveated Rendering

```javascript
// In animation loop, after XR session starts:
if (renderer.xr.isPresenting && renderer.xr.setFoveation && !renderer._foveationSet) {
  renderer.xr.setFoveation(1.0);  // Maximum foveation
  renderer._foveationSet = true;
}
```

Quest 3 supports fixed foveated rendering via the WebXR API.
`setFoveation(1.0)` renders the peripheral vision at lower resolution,
saving ~30% GPU cost. Only set once per XR session.

---

## 2. renderer.info — Draw Call and Triangle Monitoring

### 2.1 Accessing Render Statistics

```javascript
// Available after every renderer.render() call:
const info = renderer.info;

// Per-frame render stats:
info.render.calls      // Number of draw calls this frame
info.render.triangles  // Triangles rendered this frame
info.render.points     // Points rendered (particles)
info.render.lines      // Lines rendered

// Cumulative memory tracking:
info.memory.textures   // Total textures in GPU memory
info.memory.geometries // Total geometries in GPU memory
```

### 2.2 Current Draw Call Sources

| Source | Draw Calls | Triangles | Notes |
|--------|-----------|-----------|-------|
| Sky dome | 1 | ~100 | frustumCulled = false |
| Water plane | 1 | 2 | Custom shader with animation |
| Island terrain | 1-3 | ~5K | Per zone |
| Firefly particles | 1 | 30-60 points | AdditiveBlending |
| Nicolas avatar | 2 | ~200 | Head sphere + body capsule |
| Marco camera body | 3 | ~400 | Octahedron + lens + ring |
| Manemus camera body | 3 | ~400 | Same as Marco |
| Remote citizen avatars | 2 per citizen | ~200 each | Head + body |
| AI citizen avatars | 3 per citizen | ~300 each | Shape + ring + glow |
| Waypoint beacons | 2 per beacon | ~100 each | Ring + label |
| Sculptures | 2 per sculpture | varies | Geometry + glow |
| Memorials | 2-3 per memorial | varies | Obelisk + video plane |
| **Current total (3 citizens)** | **~35** | **~8K** | Well under budget |

Budget for Venezia: 200 draw calls, 500K triangles.

---

## 3. Frustum Culling

### 3.1 Three.js Automatic Frustum Culling

Three.js performs frustum culling automatically for all meshes where
`object.frustumCulled = true` (the default). The algorithm:

1. Compute bounding sphere from geometry
2. Transform bounding sphere to world space
3. Test sphere against 6 frustum planes
4. Skip render if fully outside any plane

Cost: ~0.1ms for 1000 objects. No custom code required.

### 3.2 Verifying Frustum Culling

```javascript
// Ensure all meshes are frustum-cullable
function initFrustumCulling(scene) {
  scene.traverse((object) => {
    if (object.isMesh) {
      object.frustumCulled = true;
    }
  });
}
```

### 3.3 Exceptions

The sky dome must always render regardless of camera direction:

```javascript
skyMesh.frustumCulled = false;
```

### 3.4 Manual Frustum Check for Audio/Logic

For distance culling and audio source activation, a manual frustum check
using Three.js `Frustum` class:

```javascript
const _frustum = new THREE.Frustum();
const _projScreenMatrix = new THREE.Matrix4();

function isInFrustum(camera, boundingSphere) {
  _projScreenMatrix.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  _frustum.setFromProjectionMatrix(_projScreenMatrix);
  return _frustum.intersectsSphere(boundingSphere);
}
```

---

## 4. Distance Culling (Custom)

### 4.1 Distance Thresholds

```javascript
const DISTANCE_THRESHOLDS = {
  citizen_full:    50,
  citizen_active:  80,
  citizen_ambient: 150,
  building_lod0:   20,
  building_lod1:   50,
  building_lod2:  100,
  building_lod3:  200,
  prop:            30,
};
```

### 4.2 Per-Frame Distance Cull

```javascript
const _cameraPos = new THREE.Vector3();

function distanceCull(scene, camera, elapsed) {
  camera.getWorldPosition(_cameraPos);

  for (const object of scene.distanceCullable) {
    const dist = object.position.distanceTo(_cameraPos);
    const threshold = DISTANCE_THRESHOLDS[object.userData.cullType];

    if (dist > threshold) {
      if (object.visible) object.visible = false;
    } else {
      if (!object.visible) {
        object.visible = true;
        // Fade in over 300ms
        object.userData.fadeIn = { start: elapsed, duration: 0.3 };
      }
    }
  }
}
```

### 4.3 Fade-In on Reveal

When an object transitions from invisible to visible, a 300ms opacity
ramp prevents pop-in:

```javascript
function updateFadeIns(scene, elapsed) {
  for (const object of scene.distanceCullable) {
    if (object.userData.fadeIn) {
      const t = (elapsed - object.userData.fadeIn.start) / object.userData.fadeIn.duration;
      if (t >= 1.0) {
        object.material.opacity = 1.0;
        object.material.transparent = false;
        delete object.userData.fadeIn;
      } else {
        object.material.opacity = t;
        object.material.transparent = true;
      }
    }
  }
}
```

---

## 5. Citizen Tier System

### 5.1 Tier Definitions

```javascript
const CITIZEN_TIERS = {
  FULL: {
    maxCitizens: 20,
    trisPerCitizen: 2000,
    drawCallsPerCitizen: 2,
    distanceMax: 15,
    features: ['skeleton', 'lipSync', 'moodExpression', 'clothing', 'shadow'],
  },
  ACTIVE: {
    maxCitizens: 60,
    trisPerCitizen: 500,
    drawCallsPerCitizen: 0,  // Instanced (shared draw call)
    distanceMax: 30,
    features: ['poseMorph', 'basicColor'],
  },
  AMBIENT: {
    maxCitizens: 100,
    trisPerCitizen: 50,
    drawCallsPerCitizen: 0,  // Instanced (1 draw call for all)
    distanceMax: 150,
    features: ['capsuleBillboard', 'shaderDrift'],
  },
};
```

### 5.2 Tier Assignment

```javascript
function reassignCitizenTiers(allCitizens, cameraPos) {
  // Sort by distance (nearest first)
  const sorted = allCitizens
    .map(c => ({ citizen: c, dist: c.position.distanceTo(cameraPos) }))
    .sort((a, b) => a.dist - b.dist);

  let fullCount = 0, activeCount = 0;

  for (const { citizen, dist } of sorted) {
    let newTier;
    if (dist < CITIZEN_TIERS.FULL.distanceMax &&
        fullCount < CITIZEN_TIERS.FULL.maxCitizens) {
      newTier = 'FULL';
      fullCount++;
    } else if (dist < CITIZEN_TIERS.ACTIVE.distanceMax &&
               activeCount < CITIZEN_TIERS.ACTIVE.maxCitizens) {
      newTier = 'ACTIVE';
      activeCount++;
    } else {
      newTier = 'AMBIENT';
    }

    if (citizen.currentTier !== newTier) {
      beginTierTransition(citizen, newTier);
    }
  }
}
```

### 5.3 Tier Transition Cross-Fade

```javascript
function updateTierTransition(citizen, deltaTime) {
  if (!citizen.transitionTarget) return;

  citizen.transitionProgress += deltaTime / 0.3;  // 300ms
  citizen.transitionProgress = Math.min(citizen.transitionProgress, 1.0);

  const t = citizen.transitionProgress;
  const currentMesh = citizen.meshes[citizen.currentTier];
  const targetMesh = citizen.meshes[citizen.transitionTarget];

  currentMesh.material.opacity = 1.0 - t;
  currentMesh.material.transparent = true;
  targetMesh.visible = true;
  targetMesh.material.opacity = t;
  targetMesh.material.transparent = true;

  if (citizen.transitionProgress >= 1.0) {
    currentMesh.visible = false;
    currentMesh.material.opacity = 1.0;
    currentMesh.material.transparent = false;
    targetMesh.material.opacity = 1.0;
    targetMesh.material.transparent = false;
    citizen.currentTier = citizen.transitionTarget;
    citizen.transitionTarget = null;
  }
}
```

---

## 6. InstancedMesh Usage

### 6.1 AMBIENT Citizen Instances

```javascript
function createAmbientInstances() {
  const geometry = new THREE.CapsuleGeometry(0.15, 0.5, 4, 8);  // ~50 tris
  const material = new THREE.MeshStandardMaterial({
    color: 0x888888,
    roughness: 0.8,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, 120);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;  // Active count starts at 0
  mesh.frustumCulled = false;  // Manage visibility manually
  return mesh;
}
```

### 6.2 Updating Instance Matrices

```javascript
const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();

function updateAmbientInstances(instancedMesh, ambientCitizens, elapsed) {
  instancedMesh.count = ambientCitizens.length;

  for (let i = 0; i < ambientCitizens.length; i++) {
    const citizen = ambientCitizens[i];

    // Position with gentle drift animation
    const x = citizen.position.x + Math.sin(elapsed * 0.3 + i * 1.7) * 0.2;
    const y = citizen.position.y;
    const z = citizen.position.z + Math.cos(elapsed * 0.3 + i * 2.3) * 0.2;

    _matrix.makeTranslation(x, y, z);
    instancedMesh.setMatrixAt(i, _matrix);

    // Per-instance color for variety
    const hue = (i * 0.07) % 1.0;
    _color.setHSL(hue, 0.2, 0.5);
    instancedMesh.setColorAt(i, _color);
  }

  instancedMesh.instanceMatrix.needsUpdate = true;
  if (instancedMesh.instanceColor) {
    instancedMesh.instanceColor.needsUpdate = true;
  }
}
```

### 6.3 ACTIVE Citizen Batches

```javascript
function createActiveBatches(batchCount = 4, batchSize = 20) {
  const geometry = new THREE.CapsuleGeometry(0.2, 0.8, 6, 12);  // ~500 tris
  const material = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  const batches = [];

  for (let i = 0; i < batchCount; i++) {
    const mesh = new THREE.InstancedMesh(geometry, material, batchSize);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    batches.push(mesh);
  }
  return batches;
}
```

### 6.4 Building Window Instances

```javascript
function createWindowInstances() {
  const geometry = new THREE.PlaneGeometry(0.4, 0.6);
  const material = new THREE.MeshStandardMaterial({
    color: 0x1a1a3a,
    transparent: true,
    opacity: 0.7,
    metalness: 0.5,
  });
  return new THREE.InstancedMesh(geometry, material, 500);
}
```

### 6.5 Prop Instances

```javascript
function createPropInstances(propType, geometry, material, maxCount = 50) {
  const mesh = new THREE.InstancedMesh(geometry, material, maxCount);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  return mesh;
}
```

---

## 7. LOD System for Buildings

### 7.1 LOD Level Specification

| Level | Distance | Triangles | Description |
|-------|----------|-----------|-------------|
| LOD0 | 0-20m | ~5000 | Full Venetian facade: windows, balconies, cornices |
| LOD1 | 20-50m | ~1250 | Simplified: flat geometry with bump-mapped texture |
| LOD2 | 50-100m | ~300 | Textured box |
| LOD3 | 100-200m | ~75 | Part of merged district skyline |

### 7.2 Three.js LOD Object

Three.js provides a built-in `THREE.LOD` class:

```javascript
function createBuildingLOD(meshes) {
  const lod = new THREE.LOD();

  lod.addLevel(meshes.lod0, 0);    // 0m: full detail
  lod.addLevel(meshes.lod1, 20);   // 20m: simplified
  lod.addLevel(meshes.lod2, 50);   // 50m: box
  lod.addLevel(meshes.lod3, 100);  // 100m: skyline

  return lod;
}
```

`THREE.LOD.update(camera)` automatically selects the correct level based
on distance. Call once per frame:

```javascript
// In animation loop:
scene.traverse((object) => {
  if (object.isLOD) {
    object.update(camera);
  }
});
```

### 7.3 Custom Cross-Fade LOD

The built-in `THREE.LOD` does hard switches. For smoother transitions,
use a custom implementation with opacity cross-fade over 3 frames (~42ms):

```javascript
function updateBuildingLODTransition(building, deltaTime) {
  if (building.targetLOD === null) return;

  building.transitionAlpha += deltaTime / 0.042;
  building.transitionAlpha = Math.min(building.transitionAlpha, 1.0);

  const currentMesh = building.lodMeshes[building.currentLOD];
  const targetMesh = building.lodMeshes[building.targetLOD];

  currentMesh.material.opacity = 1.0 - building.transitionAlpha;
  currentMesh.material.transparent = true;
  targetMesh.visible = true;
  targetMesh.material.opacity = building.transitionAlpha;
  targetMesh.material.transparent = true;

  if (building.transitionAlpha >= 1.0) {
    currentMesh.visible = false;
    currentMesh.material.opacity = 1.0;
    currentMesh.material.transparent = false;
    targetMesh.material.opacity = 1.0;
    targetMesh.material.transparent = false;
    building.currentLOD = building.targetLOD;
    building.targetLOD = null;
  }
}
```

---

## 8. Frame Budget Monitor

### 8.1 performance.now() Timing

```javascript
class FrameBudgetMonitor {
  constructor() {
    this.targetFrameMs = 14.0;   // 72fps
    this.warningMs = 18.0;
    this.criticalMs = 22.0;
    this.samples = [];           // Ring buffer of last 60 frames
    this.maxSamples = 60;
    this.systemTimings = {};
    this._frameStart = 0;
    this._systemStarts = {};
  }

  frameBegin() {
    this._frameStart = performance.now();
    this._systemStarts = {};
  }

  systemBegin(name) {
    this._systemStarts[name] = performance.now();
  }

  systemEnd(name) {
    const start = this._systemStarts[name];
    if (start !== undefined) {
      this.systemTimings[name] = performance.now() - start;
    }
  }

  frameEnd() {
    const totalMs = performance.now() - this._frameStart;
    let jsMs = 0;
    for (const ms of Object.values(this.systemTimings)) jsMs += ms;

    const sample = { totalMs, jsMs, gpuMs: Math.max(0, totalMs - jsMs) };
    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) this.samples.shift();
    return sample;
  }

  getAverageFrameTime(windowSize = 30) {
    const count = Math.min(windowSize, this.samples.length);
    if (count === 0) return 0;
    let sum = 0;
    for (let i = this.samples.length - count; i < this.samples.length; i++) {
      sum += this.samples[i].totalMs;
    }
    return sum / count;
  }

  getCategory() {
    const avg = this.getAverageFrameTime();
    if (avg <= this.targetFrameMs) return 'NORMAL';
    if (avg <= this.warningMs) return 'WARNING';
    if (avg <= this.criticalMs) return 'CRITICAL';
    return 'EMERGENCY';
  }
}
```

### 8.2 Integration in Animation Loop

```javascript
const monitor = new FrameBudgetMonitor();
let frameCount = 0;

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();
  frameCount++;

  monitor.frameBegin();

  // -- JS logic phase --
  monitor.systemBegin('js_logic');
  updateDesktopMovement(delta);
  vrControls.update(delta);
  monitor.systemEnd('js_logic');

  // -- Culling phase --
  monitor.systemBegin('culling');
  distanceCull(scene, camera, elapsed);
  // tier transitions, LOD updates...
  monitor.systemEnd('culling');

  // -- Instancing update --
  monitor.systemBegin('instancing');
  updateAmbientInstances(instancedMesh, ambientCitizens, elapsed);
  updateActiveInstances(activeBatches, activeCitizens);
  monitor.systemEnd('instancing');

  // -- Render --
  renderer.render(scene, camera);

  // -- Post-frame --
  const sample = monitor.frameEnd();

  // Adaptive quality (every ~1s)
  if (frameCount % 72 === 0) {
    adaptiveQualityCheck(monitor, renderer, scene);
  }

  // Memory monitor (every ~5s)
  if (frameCount % 360 === 0) {
    checkMemoryThresholds(renderer, scene);
  }
});
```

---

## 9. Adaptive Quality Controller

### 9.1 Quality Levels

```javascript
const QUALITY_LEVELS = [
  { name: 'NORMAL',    fullCitizens: 20, pixelRatio: 1.0,  shadows: true,  propsVisible: true,  maxLOD: 0 },
  { name: 'REDUCED',   fullCitizens: 10, pixelRatio: 1.0,  shadows: true,  propsVisible: true,  maxLOD: 0 },
  { name: 'LOW',       fullCitizens: 10, pixelRatio: 0.75, shadows: false, propsVisible: true,  maxLOD: 1 },
  { name: 'EMERGENCY', fullCitizens: 0,  pixelRatio: 0.5,  shadows: false, propsVisible: false, maxLOD: 2 },
];
```

### 9.2 renderer.setPixelRatio for Resolution Scaling

```javascript
function applyQualityLevel(level, renderer, scene) {
  const config = QUALITY_LEVELS[level];

  // Render resolution
  renderer.setPixelRatio(config.pixelRatio);

  // Shadows
  renderer.shadowMap.enabled = config.shadows;

  // Citizen budget
  CITIZEN_TIERS.FULL.maxCitizens = config.fullCitizens;

  // Props
  for (const prop of scene.userData.props || []) {
    prop.visible = config.propsVisible;
  }

  // Building LOD floor
  for (const building of scene.userData.buildings || []) {
    if (building.currentLOD < config.maxLOD) {
      building.targetLOD = config.maxLOD;
      building.transitionAlpha = 0.0;
    }
  }

  // EMERGENCY: force all citizens to AMBIENT
  if (level === 3) {
    for (const citizen of scene.userData.citizens || []) {
      if (citizen.currentTier !== 'AMBIENT') {
        beginTierTransition(citizen, 'AMBIENT');
      }
    }
  }
}
```

### 9.3 Hysteresis for Upgrade

Downgrades are immediate (prevent frame drops).
Upgrades require 5 seconds of stable performance to prevent oscillation:

```javascript
const HYSTERESIS_UPGRADE_FRAMES = 360;  // 5s at 72fps

let _currentLevel = 0;
let _stableFrameCount = 0;

function adaptiveQualityCheck(monitor, renderer, scene) {
  const category = monitor.getCategory();

  if (category === 'EMERGENCY' && _currentLevel < 3) {
    applyQualityLevel(3, renderer, scene);
    _currentLevel = 3;
    _stableFrameCount = 0;
  } else if (category === 'CRITICAL' && _currentLevel < 2) {
    applyQualityLevel(_currentLevel + 1, renderer, scene);
    _currentLevel++;
    _stableFrameCount = 0;
  } else if (category === 'WARNING' && _currentLevel < 1) {
    applyQualityLevel(1, renderer, scene);
    _currentLevel = 1;
    _stableFrameCount = 0;
  } else if (category === 'NORMAL' && _currentLevel > 0) {
    _stableFrameCount += 72;  // Checked every 72 frames
    if (_stableFrameCount >= HYSTERESIS_UPGRADE_FRAMES) {
      _currentLevel--;
      applyQualityLevel(_currentLevel, renderer, scene);
      _stableFrameCount = 0;
    }
  }

  if (category !== 'NORMAL') {
    _stableFrameCount = 0;
  }
}
```

---

## 10. Memory Monitoring

### 10.1 performance.memory (Chrome/Quest Only)

```javascript
function getMemoryInfo() {
  if (performance.memory) {
    return {
      usedJSHeapMB: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
      totalJSHeapMB: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
      limitMB: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
    };
  }
  return null;
}
```

`performance.memory` is non-standard and only available in Chrome-based
browsers (including OculusBrowser on Quest 3). Returns null on Firefox/Safari.

### 10.2 renderer.info Memory Tracking

```javascript
function getRendererMemory(renderer) {
  const info = renderer.info;
  return {
    textures: info.memory.textures,
    geometries: info.memory.geometries,
  };
}
```

Note: `renderer.info.memory.textures` and `geometries` are counts, not
byte sizes. To estimate VRAM usage, multiply by average size per texture/geometry.

### 10.3 Emergency Disposal

```javascript
function emergencyMemoryDispose(scene, renderer) {
  // Dispose high-detail LOD meshes
  for (const building of scene.userData.buildings || []) {
    if (building.lod0) {
      building.lod0.geometry.dispose();
      if (building.lod0.material.map) building.lod0.material.map.dispose();
      building.lod0.material.dispose();
      building.lod0 = null;
    }
    if (building.lod1) {
      building.lod1.geometry.dispose();
      building.lod1.material.dispose();
      building.lod1 = null;
    }
  }

  // Force all citizens to AMBIENT (dispose FULL/ACTIVE meshes)
  applyQualityLevel(3, renderer, scene);

  // Reset Three.js internal state tracking
  renderer.info.reset();
}
```

---

## 11. Profiling Overlay

### 11.1 Toggle Mechanism

```javascript
// Desktop: Shift+P
// VR: Double-tap left controller thumbstick

let overlayVisible = false;

document.addEventListener('keydown', (e) => {
  if (e.shiftKey && e.code === 'KeyP') {
    overlayVisible = !overlayVisible;
    overlayEl.style.display = overlayVisible ? 'block' : 'none';
  }
});
```

### 11.2 Overlay DOM Structure

```javascript
function createOverlayDOM() {
  const el = document.createElement('div');
  el.id = 'perf-overlay';
  el.style.cssText = `
    position: fixed; top: 10px; left: 10px; z-index: 9999;
    background: rgba(0,0,0,0.85); color: #0f0; padding: 8px 12px;
    font-family: 'Courier New', monospace; font-size: 11px;
    line-height: 1.5; pointer-events: none; white-space: pre;
    border: 1px solid rgba(0,255,0,0.3); border-radius: 4px;
    display: none;
  `;
  document.body.appendChild(el);
  return el;
}
```

### 11.3 Data Collection

```javascript
function updateOverlay(el, monitor, renderer, audioActiveCount) {
  const latest = monitor.samples[monitor.samples.length - 1];
  if (!latest) return;

  const fps = Math.round(1000 / Math.max(latest.totalMs, 0.001));
  const info = renderer.info.render;
  const mem = getMemoryInfo();

  el.textContent =
    `FPS: ${fps} | Frame: ${latest.totalMs.toFixed(1)}ms` +
    ` | JS: ${latest.jsMs.toFixed(1)}ms` +
    ` | GPU: ${(latest.totalMs - latest.jsMs).toFixed(1)}ms\n` +
    `Draw: ${info.calls} | Tris: ${Math.round(info.triangles / 1000)}K` +
    (mem ? ` | Heap: ${mem.usedJSHeapMB}MB` : '') + '\n' +
    `Quality: ${QUALITY_LEVELS[_currentLevel].name}` +
    ` | Audio: ${audioActiveCount}/32`;
}
```

### 11.4 Stats.js Alternative

For development, Stats.js provides a simpler FPS counter:

```javascript
import Stats from 'three/addons/libs/stats.module.js';

const stats = new Stats();
stats.showPanel(0);  // 0: fps, 1: ms, 2: memory
document.body.appendChild(stats.dom);

// In animation loop:
stats.begin();
// ... render ...
stats.end();
```

Stats.js is lighter than the custom profiler but lacks per-system timing,
draw call counts, and adaptive quality integration.

---

## 12. Texture Atlas System

### 12.1 Atlas Creation

```javascript
const ATLAS_SIZE = 2048;

function createTextureAtlas() {
  const data = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE * 4);
  const texture = new THREE.DataTexture(data, ATLAS_SIZE, ATLAS_SIZE);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return {
    texture,
    uvRegions: new Map(),      // facadeId -> { u0, v0, u1, v1 }
    nextX: 0,                  // Simple row packing (upgrade to bin-packing for production)
    nextY: 0,
    rowHeight: 0,
  };
}
```

### 12.2 Memory Budget

One 2048x2048 RGBA atlas: ~16MB VRAM.
With 5 district atlases: ~80MB VRAM.
Total texture budget (atlas + other): 256MB.

---

## 13. Per-Frame Allocation Discipline

The existing `main.js` demonstrates zero-allocation patterns using
module-level pre-allocated objects:

```javascript
// Pre-allocated temporaries (module level, zero per-frame allocs)
const _voiceFwd = new THREE.Vector3();
const _voiceCitizenPositions = new Map();
const _waypointPlayerPos = new THREE.Vector3();
```

For Venezia, all per-frame math must follow this pattern:
- Pre-allocate `THREE.Vector3`, `THREE.Matrix4`, `THREE.Color` at module level
- Reuse via `.copy()`, `.set()`, `.makeTranslation()` instead of `new`
- Use `Map.clear()` + `Map.set()` instead of creating new Maps
- Avoid array `.map()`, `.filter()` in hot paths (use indexed loops)

This prevents GC pressure which causes frame spikes on Quest 3.

---

## 14. Performance Budget Summary

| Resource | Budget | Strategy |
|----------|--------|----------|
| Draw calls | <200 per frame | Instance AMBIENT/ACTIVE citizens, atlas textures |
| Triangles | <500K visible | LOD on buildings, tier-based citizen geometry |
| Textures | <256MB VRAM | Atlas per district, procedural materials |
| JS heap | <512MB | Dispose off-screen, pool geometries |
| Frame time | <14ms (72fps) | Adaptive quality with hysteresis |
| Network | <50KB/s | Delta sync only, compress positions |
| Audio sources | <32 simultaneous | Priority queue with tier budgets |
| LLM calls | <1/second | Queue conversations, 10s cooldown |
