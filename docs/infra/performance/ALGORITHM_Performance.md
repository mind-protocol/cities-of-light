# ALGORITHM -- Performance

> Pseudocode and data structures for Quest 3 optimization in Venezia.
> Reference implementations: `src/client/main.js`, `src/client/scene.js`,
> `src/client/avatar.js`, `src/client/zone-ambient.js`.

---

## 1. Data Structures

```
FrameBudgetMonitor:
    targetFrameMs:     float        // 14ms (72fps)
    warningThreshold:  float        // 18ms
    criticalThreshold: float        // 22ms
    samples:           RingBuffer<FrameSample>(60)   // last 60 frames
    systemTimings:     Map<systemName, float>         // per-system ms

FrameSample:
    totalMs:       float
    jsMs:          float
    gpuMs:         float    // estimated from total - js
    timestamp:     float

CullingPipeline:
    frustum:           Frustum       // camera frustum for Pass 1
    cameraPosition:    Vector3
    distanceThresholds: Map<objectType, float>
    occlusionBuffer:   DepthBuffer | null    // Phase 4

LODSystem:
    buildings:         Map<buildingId, BuildingLOD>
    distanceBands:     LODDistanceBand[]

BuildingLOD:
    lod0:              Mesh          // full facade: windows, balconies, cornices
    lod1:              Mesh          // simplified: flat with bump map
    lod2:              Mesh          // box with textured sides
    lod3:              Mesh | null   // part of merged skyline (per-district)
    currentLOD:        int           // 0-3
    targetLOD:         int           // transition target
    transitionAlpha:   float         // 0.0 to 1.0 for cross-fade

LODDistanceBand:
    minDistance:    float
    maxDistance:    float
    lodLevel:      int

CitizenTierState:
    tier:              enum(FULL, ACTIVE, AMBIENT)
    transitionProgress: float       // 0.0 to 1.0
    transitionTarget:   enum | null

InstanceManager:
    ambientMesh:       InstancedMesh       // all AMBIENT citizens share one
    activeBatches:     Map<batchId, InstancedMesh>  // groups of ~20 ACTIVE
    buildingWindows:   InstancedMesh
    propInstances:     Map<propType, InstancedMesh>
    maxInstances:      Map<meshType, int>

TextureAtlas:
    atlas:             Texture       // 2048x2048 packed facade textures
    uvRegions:         Map<facadeId, { u0, v0, u1, v1 }>
    totalMemory:       int           // bytes

AdaptiveQualityState:
    currentLevel:      int           // 0=normal, 1=reduced, 2=low, 3=emergency
    stableFrameCount:  int           // consecutive frames below target
    lastChangeTime:    float         // prevent oscillation
    hysteresisFrames:  int           // frames needed to upgrade (default 360 = 5s)

MemoryMonitor:
    textureMemory:     int           // bytes
    geometryMemory:    int           // bytes
    heapUsed:          int           // JS heap bytes
    warningThreshold:  int           // 200MB
    criticalThreshold: int           // 400MB

ProfilingOverlay:
    visible:           bool
    fps:               float
    frameMs:           float
    jsMs:              float
    drawCalls:         int
    triangles:         int
    textureMemMB:      int
    heapMB:            int
    citizenCounts:     { full: int, active: int, ambient: int }
    audioSources:      int
```

---

## 2. Frame Budget Monitor

```
TARGET_FRAME_MS = 14.0     // 72fps
WARNING_MS = 18.0
CRITICAL_MS = 22.0

SYSTEM_BUDGET = {
    "js_logic":      4.0,    // game logic, network, audio
    "scene_graph":   2.0,    // Three.js traversal, frustum culling, matrix updates
    "gpu_render":    6.0,    // geometry, shaders, compositing
    "gc_overhead":   2.0,    // garbage collection + JS overhead
}

INIT_FRAME_MONITOR():
    monitor = new FrameBudgetMonitor()
    monitor.targetFrameMs = TARGET_FRAME_MS
    monitor.warningThreshold = WARNING_MS
    monitor.criticalThreshold = CRITICAL_MS
    monitor.samples = RingBuffer(60)
    monitor.systemTimings = Map()
    return monitor


FRAME_BEGIN(monitor):
    monitor._frameStart = performance.now()
    monitor._systemStarts = Map()


SYSTEM_BEGIN(monitor, systemName):
    monitor._systemStarts.set(systemName, performance.now())


SYSTEM_END(monitor, systemName):
    start = monitor._systemStarts.get(systemName)
    if start is not null:
        elapsed = performance.now() - start
        monitor.systemTimings.set(systemName, elapsed)


FRAME_END(monitor):
    totalMs = performance.now() - monitor._frameStart

    // Estimate JS vs GPU time
    jsMs = 0
    for (name, ms) in monitor.systemTimings:
        jsMs += ms
    gpuMs = max(0, totalMs - jsMs)

    sample = {
        totalMs: totalMs,
        jsMs: jsMs,
        gpuMs: gpuMs,
        timestamp: performance.now(),
    }
    monitor.samples.push(sample)

    return sample


GET_AVERAGE_FRAME_TIME(monitor, windowSize=30):
    count = min(windowSize, monitor.samples.length)
    if count == 0: return 0

    total = 0
    for i in range(count):
        total += monitor.samples.peek(i).totalMs
    return total / count


GET_FRAME_CATEGORY(monitor):
    avgMs = GET_AVERAGE_FRAME_TIME(monitor)
    if avgMs <= TARGET_FRAME_MS: return "NORMAL"
    if avgMs <= WARNING_MS: return "WARNING"
    if avgMs <= CRITICAL_MS: return "CRITICAL"
    return "EMERGENCY"
```

---

## 3. Three-Pass Culling Pipeline

### 3.1 Pass 1: Frustum Culling (Automatic)

```
// Three.js performs frustum culling automatically when
// object.frustumCulled = true (default).
//
// For every object in the scene graph:
//   1. Compute object bounding sphere from geometry
//   2. Transform bounding sphere to world space
//   3. Test sphere against 6 frustum planes
//   4. If fully outside any plane: skip render
//
// Cost: ~0.1ms for 1000 objects.
// No custom code required. Three.js handles this internally.
//
// Ensure: every mesh has frustumCulled = true (the default).
// Exception: sky dome (frustumCulled = false, always visible).

INIT_FRUSTUM_CULLING(scene):
    // Verify all meshes are frustum-cullable
    scene.traverse((object):
        if object.isMesh:
            object.frustumCulled = true
        if object.isSky:
            object.frustumCulled = false
    )
```

### 3.2 Pass 2: Distance Culling (Custom)

```
DISTANCE_THRESHOLDS = {
    "citizen_full":    50,     // FULL-tier citizens
    "citizen_active":  80,     // ACTIVE-tier citizens
    "citizen_ambient": 150,    // AMBIENT-tier silhouettes
    "building_lod0":   20,     // full facade detail
    "building_lod1":   50,     // simplified facade
    "building_lod2":  100,     // box with texture
    "building_lod3":  200,     // merged skyline
    "prop":            30,     // market stalls, boats, lanterns
}

// Runs every frame but only recomputes tier assignments every 500ms

_lastTierUpdate = 0
TIER_UPDATE_INTERVAL = 500    // ms

DISTANCE_CULL(scene, cameraPosition, currentTime):
    // Quick visibility check every frame
    for object in scene.distanceCullable:
        dist = object.position.distanceTo(cameraPosition)
        threshold = DISTANCE_THRESHOLDS[object.userData.cullType]

        if dist > threshold:
            if object.visible:
                object.visible = false
        else:
            if not object.visible:
                object.visible = true
                // Fade in over 300ms (set opacity from 0, ramp to 1)
                object.userData.fadeIn = { start: currentTime, duration: 0.3 }

    // Tier reassignment at lower frequency
    if currentTime - _lastTierUpdate > TIER_UPDATE_INTERVAL:
        _lastTierUpdate = currentTime
        REASSIGN_CITIZEN_TIERS(scene, cameraPosition)
```

### 3.3 Pass 3: Occlusion Culling (Deferred to Phase 4)

```
// Hierarchical Z-buffer occlusion culling.
// Not implemented in V1. Venice streets are narrow enough that
// frustum + distance culling catches most occlusion naturally.
//
// Algorithm (for future implementation):
//
// OCCLUSION_CULL(scene, camera, depthBuffer):
//     // Step 1: Render low-resolution depth-only pass
//     //   - Major building outlines only (simplified geometry)
//     //   - Resolution: 256x256 (enough for occlusion testing)
//     //   - Cost: ~0.5ms
//     depthBuffer = renderDepthOnly(scene.occluders, camera, 256, 256)
//
//     // Step 2: Test each object's bounding box against depth buffer
//     for object in scene.occludees:
//         screenBounds = projectBoundsToScreen(object.boundingBox, camera)
//         maxDepth = sampleDepthBuffer(depthBuffer, screenBounds)
//         objectDepth = projectDepth(object.boundingBox.nearCorner, camera)
//
//         if objectDepth > maxDepth:
//             // Object is fully behind other geometry
//             object.visible = false
//         else:
//             object.visible = true
//
//     // Cost: ~1ms total. Saves ~2ms on dense scenes. Net win only in
//     // crowded piazzas where buildings block each other significantly.
```

---

## 4. LOD System

### 4.1 Building LOD Selection

```
LOD_BANDS = [
    { minDistance: 0,    maxDistance: 20,   lodLevel: 0 },    // full detail
    { minDistance: 20,   maxDistance: 50,   lodLevel: 1 },    // simplified
    { minDistance: 50,   maxDistance: 100,  lodLevel: 2 },    // box
    { minDistance: 100,  maxDistance: 200,  lodLevel: 3 },    // skyline
]

// Each LOD level is 4x fewer triangles than the previous:
//   LOD0: ~5000 tris (full Venetian facade)
//   LOD1: ~1250 tris (flat with bump map)
//   LOD2:  ~300 tris (textured box)
//   LOD3:   ~75 tris (merged skyline segment)

SELECT_BUILDING_LOD(building, cameraPosition):
    dist = building.position.distanceTo(cameraPosition)

    targetLOD = 3    // default: farthest
    for band in LOD_BANDS:
        if dist >= band.minDistance and dist < band.maxDistance:
            targetLOD = band.lodLevel
            break

    if targetLOD == building.currentLOD:
        return    // no change

    // Begin cross-fade transition
    building.targetLOD = targetLOD
    building.transitionAlpha = 0.0


UPDATE_BUILDING_LOD_TRANSITION(building, deltaTime):
    if building.targetLOD is null:
        return

    // Cross-fade over 3 frames (~42ms at 72fps)
    building.transitionAlpha += deltaTime / 0.042
    building.transitionAlpha = min(building.transitionAlpha, 1.0)

    // Alpha blend between current and target LOD
    currentMesh = building["lod" + building.currentLOD]
    targetMesh = building["lod" + building.targetLOD]

    currentMesh.material.opacity = 1.0 - building.transitionAlpha
    currentMesh.material.transparent = true
    targetMesh.visible = true
    targetMesh.material.opacity = building.transitionAlpha
    targetMesh.material.transparent = true

    if building.transitionAlpha >= 1.0:
        // Transition complete
        currentMesh.visible = false
        currentMesh.material.opacity = 1.0
        currentMesh.material.transparent = false
        targetMesh.material.opacity = 1.0
        targetMesh.material.transparent = false
        building.currentLOD = building.targetLOD
        building.targetLOD = null
```

### 4.2 Citizen Tier Rendering

```
TIER_BUDGETS = {
    FULL:    { maxCitizens: 20, trisPerCitizen: 2000, drawCalls: 40 },
    ACTIVE:  { maxCitizens: 60, trisPerCitizen: 500,  drawCalls: 4 },
    AMBIENT: { maxCitizens: 100, trisPerCitizen: 50,  drawCalls: 1 },
}
// Total: 180 citizens, 75K triangles, 45 draw calls

REASSIGN_CITIZEN_TIERS(scene, cameraPosition):
    // Collect all citizens with distance
    citizenDistances = []
    for citizen in allCitizens:
        dist = citizen.position.distanceTo(cameraPosition)
        citizenDistances.append({ citizen, dist })

    // Sort by distance (nearest first)
    citizenDistances.sort_by(c => c.dist)

    fullCount = 0
    activeCount = 0
    ambientCount = 0

    for entry in citizenDistances:
        citizen = entry.citizen
        dist = entry.dist

        // Assign tier based on distance and budget
        if dist < 15 and fullCount < TIER_BUDGETS.FULL.maxCitizens:
            newTier = FULL
            fullCount += 1
        elif dist < 30 and activeCount < TIER_BUDGETS.ACTIVE.maxCitizens:
            newTier = ACTIVE
            activeCount += 1
        else:
            newTier = AMBIENT
            ambientCount += 1

        if citizen.tier != newTier:
            BEGIN_TIER_TRANSITION(citizen, newTier)


BEGIN_TIER_TRANSITION(citizen, newTier):
    citizen.tierState.transitionTarget = newTier
    citizen.tierState.transitionProgress = 0.0


UPDATE_TIER_TRANSITION(citizen, deltaTime):
    if citizen.tierState.transitionTarget is null:
        return

    // Transition over 300ms
    citizen.tierState.transitionProgress += deltaTime / 0.3
    citizen.tierState.transitionProgress = min(citizen.tierState.transitionProgress, 1.0)

    t = citizen.tierState.transitionProgress
    currentMesh = citizen.meshes[citizen.tier]
    targetMesh = citizen.meshes[citizen.tierState.transitionTarget]

    // Cross-fade
    currentMesh.material.opacity = 1.0 - t
    targetMesh.visible = true
    targetMesh.material.opacity = t

    if citizen.tierState.transitionProgress >= 1.0:
        currentMesh.visible = false
        currentMesh.material.opacity = 1.0
        targetMesh.material.opacity = 1.0
        citizen.tier = citizen.tierState.transitionTarget
        citizen.tierState.transitionTarget = null


// FULL tier features:
//   - Skeletal animation (8 bones)
//   - Lip sync during speech
//   - Mood expression on face
//   - Clothing detail
//   - Shadow casting
//   - 1 draw call per citizen (body) + 1 (face)

// ACTIVE tier features:
//   - Instanced mesh (shared geometry, ~20 per batch)
//   - Pose-based morph (standing, walking, sitting)
//   - Basic clothing color
//   - No facial expression
//   - No shadow

// AMBIENT tier features:
//   - Fully instanced (1 draw call for all ~100)
//   - Capsule or billboard geometry
//   - Shader-based drift animation
//   - No individual identity visible
```

---

## 5. Instancing Manager

```
INIT_INSTANCE_MANAGER():
    manager = new InstanceManager()

    // AMBIENT citizens: one capsule geometry for all
    capsuleGeom = new CapsuleGeometry(0.15, 0.5, 4, 8)    // ~50 tris
    capsuleMat = new MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.8,
    })
    manager.ambientMesh = new InstancedMesh(
        capsuleGeom, capsuleMat, 120    // max 120 instances
    )
    manager.ambientMesh.instanceMatrix.setUsage(DynamicDrawUsage)
    manager.ambientMesh.count = 0     // active count starts at 0

    // ACTIVE citizens: batches of ~20 sharing simplified body geometry
    bodyGeom = new CapsuleGeometry(0.2, 0.8, 6, 12)    // ~500 tris
    bodyMat = new MeshStandardMaterial({ roughness: 0.7 })
    for batchId in range(4):    // 4 batches x 20 = 80 max
        batch = new InstancedMesh(bodyGeom, bodyMat, 20)
        batch.instanceMatrix.setUsage(DynamicDrawUsage)
        batch.count = 0
        manager.activeBatches.set(batchId, batch)

    // Building windows: one window geometry, instanced across all facades
    windowGeom = new PlaneGeometry(0.4, 0.6)
    windowMat = new MeshStandardMaterial({
        color: 0x1a1a3a,
        transparent: true,
        opacity: 0.7,
        metalness: 0.5,
    })
    manager.buildingWindows = new InstancedMesh(windowGeom, windowMat, 500)

    // Props: one geometry per type, instanced
    for propType in ["stall", "lantern", "boat", "barrel"]:
        geom = LOAD_PROP_GEOMETRY(propType)
        mat = LOAD_PROP_MATERIAL(propType)
        mesh = new InstancedMesh(geom, mat, 50)
        mesh.instanceMatrix.setUsage(DynamicDrawUsage)
        manager.propInstances.set(propType, mesh)

    return manager


UPDATE_AMBIENT_INSTANCES(manager, ambientCitizens, elapsed):
    manager.ambientMesh.count = ambientCitizens.length
    matrix = new Matrix4()
    color = new Color()

    for i, citizen in enumerate(ambientCitizens):
        // Position with shader-based drift (vertex displacement)
        x = citizen.position.x + sin(elapsed * 0.3 + i * 1.7) * 0.2
        y = citizen.position.y
        z = citizen.position.z + cos(elapsed * 0.3 + i * 2.3) * 0.2

        matrix.makeTranslation(x, y, z)
        manager.ambientMesh.setMatrixAt(i, matrix)

        // Optional: per-instance color for variety
        hue = (i * 0.07) % 1.0
        color.setHSL(hue, 0.2, 0.5)
        manager.ambientMesh.setColorAt(i, color)

    manager.ambientMesh.instanceMatrix.needsUpdate = true
    if manager.ambientMesh.instanceColor:
        manager.ambientMesh.instanceColor.needsUpdate = true


UPDATE_ACTIVE_INSTANCES(manager, activeCitizens):
    batchSize = 20
    batchIndex = 0
    indexInBatch = 0
    matrix = new Matrix4()

    for citizen in activeCitizens:
        batch = manager.activeBatches.get(batchIndex)

        matrix.makeTranslation(
            citizen.position.x,
            citizen.position.y,
            citizen.position.z
        )
        // Apply rotation
        rotMatrix = new Matrix4().makeRotationFromQuaternion(citizen.quaternion)
        matrix.multiply(rotMatrix)

        batch.setMatrixAt(indexInBatch, matrix)
        indexInBatch += 1

        if indexInBatch >= batchSize:
            batch.count = indexInBatch
            batch.instanceMatrix.needsUpdate = true
            batchIndex += 1
            indexInBatch = 0

    // Finalize last partial batch
    if indexInBatch > 0:
        batch = manager.activeBatches.get(batchIndex)
        batch.count = indexInBatch
        batch.instanceMatrix.needsUpdate = true

    // Zero out unused batches
    for i in range(batchIndex + 1, manager.activeBatches.size):
        manager.activeBatches.get(i).count = 0
```

---

## 6. Texture Atlas Management

```
ATLAS_SIZE = 2048    // 2048x2048 pixels
ATLAS_FORMAT = RGBA  // 4 bytes per pixel
ATLAS_MEMORY = ATLAS_SIZE * ATLAS_SIZE * 4    // ~16MB

INIT_TEXTURE_ATLAS():
    atlas = new TextureAtlas()
    atlas.atlas = new DataTexture(
        new Uint8Array(ATLAS_SIZE * ATLAS_SIZE * 4),
        ATLAS_SIZE, ATLAS_SIZE
    )
    atlas.atlas.wrapS = ClampToEdgeWrapping
    atlas.atlas.wrapT = ClampToEdgeWrapping
    atlas.atlas.needsUpdate = true
    atlas.uvRegions = Map()
    atlas.packer = new RectanglePacker(ATLAS_SIZE, ATLAS_SIZE)
    atlas.totalMemory = ATLAS_MEMORY
    return atlas


PACK_FACADE_TEXTURE(atlas, facadeId, imageData, width, height):
    // Find space in atlas using rectangle packing
    region = atlas.packer.pack(width, height)
    if region is null:
        // Atlas full: log warning, use default texture
        return false

    // Copy pixel data into atlas at packed position
    for y in range(height):
        for x in range(width):
            srcIdx = (y * width + x) * 4
            dstIdx = ((region.y + y) * ATLAS_SIZE + (region.x + x)) * 4
            atlas.atlas.image.data[dstIdx]     = imageData[srcIdx]
            atlas.atlas.image.data[dstIdx + 1] = imageData[srcIdx + 1]
            atlas.atlas.image.data[dstIdx + 2] = imageData[srcIdx + 2]
            atlas.atlas.image.data[dstIdx + 3] = imageData[srcIdx + 3]

    atlas.atlas.needsUpdate = true

    // Store UV coordinates for this facade
    atlas.uvRegions.set(facadeId, {
        u0: region.x / ATLAS_SIZE,
        v0: region.y / ATLAS_SIZE,
        u1: (region.x + width) / ATLAS_SIZE,
        v1: (region.y + height) / ATLAS_SIZE,
    })
    return true


// All building facades in a district share one atlas texture bind.
// UV coordinates in the geometry reference sub-regions of the atlas.
// One texture bind per district instead of one per building.
```

---

## 7. Adaptive Quality Controller

### 7.1 Measure -> Decide -> Apply Loop

```
QUALITY_LEVELS = [
    { name: "NORMAL",    fullCitizens: 20, pixelRatio: 1.0,  propsEnabled: true,  maxLOD: 0 },
    { name: "REDUCED",   fullCitizens: 10, pixelRatio: 1.0,  propsEnabled: true,  maxLOD: 0 },
    { name: "LOW",       fullCitizens: 10, pixelRatio: 0.75, propsEnabled: true,  maxLOD: 1 },
    { name: "EMERGENCY", fullCitizens: 0,  pixelRatio: 0.5,  propsEnabled: false, maxLOD: 2 },
]

HYSTERESIS_UPGRADE_FRAMES = 360    // 5 seconds at 72fps before upgrading
CHECK_INTERVAL_FRAMES = 72         // check every second (72 frames)

_adaptiveState = {
    currentLevel: 0,
    stableFrameCount: 0,
    lastCheckFrame: 0,
}


ADAPTIVE_QUALITY_CHECK(frameMonitor, frameCount, renderer, scene):
    // Only check every ~1 second
    if frameCount - _adaptiveState.lastCheckFrame < CHECK_INTERVAL_FRAMES:
        return
    _adaptiveState.lastCheckFrame = frameCount

    avgMs = GET_AVERAGE_FRAME_TIME(frameMonitor, windowSize=72)

    // ── MEASURE ─────────────────────────────────────────────
    category = GET_FRAME_CATEGORY(frameMonitor)

    // ── DECIDE ──────────────────────────────────────────────
    targetLevel = _adaptiveState.currentLevel

    if category == "EMERGENCY" and _adaptiveState.currentLevel < 3:
        // Immediate degradation (no hysteresis on downgrades)
        targetLevel = 3
    elif category == "CRITICAL" and _adaptiveState.currentLevel < 2:
        targetLevel = _adaptiveState.currentLevel + 1
    elif category == "WARNING" and _adaptiveState.currentLevel < 1:
        targetLevel = 1
    elif category == "NORMAL" and _adaptiveState.currentLevel > 0:
        // Upgrade requires sustained stability (hysteresis)
        _adaptiveState.stableFrameCount += CHECK_INTERVAL_FRAMES
        if _adaptiveState.stableFrameCount >= HYSTERESIS_UPGRADE_FRAMES:
            targetLevel = _adaptiveState.currentLevel - 1
            _adaptiveState.stableFrameCount = 0
        return    // do not apply yet, wait for stability

    if category != "NORMAL":
        _adaptiveState.stableFrameCount = 0    // reset upgrade counter

    if targetLevel == _adaptiveState.currentLevel:
        return    // no change

    // ── APPLY ───────────────────────────────────────────────
    APPLY_QUALITY_LEVEL(targetLevel, renderer, scene)
    _adaptiveState.currentLevel = targetLevel


APPLY_QUALITY_LEVEL(level, renderer, scene):
    config = QUALITY_LEVELS[level]

    // Adjust pixel ratio (affects render resolution)
    renderer.setPixelRatio(config.pixelRatio)

    // Adjust FULL citizen budget
    TIER_BUDGETS.FULL.maxCitizens = config.fullCitizens

    // Toggle props visibility
    for prop in scene.props:
        prop.visible = config.propsEnabled

    // Force minimum LOD level on buildings
    for building in scene.buildings:
        if building.currentLOD < config.maxLOD:
            building.targetLOD = config.maxLOD
            building.transitionAlpha = 0.0

    // If EMERGENCY: force all citizens to AMBIENT
    if level == 3:
        for citizen in allCitizens:
            if citizen.tier != AMBIENT:
                BEGIN_TIER_TRANSITION(citizen, AMBIENT)
```

---

## 8. Memory Monitor

```
MEMORY_WARNING_MB = 200     // warn at 200MB texture+geometry
MEMORY_CRITICAL_MB = 400    // emergency at 400MB
HEAP_WARNING_MB = 512       // JS heap limit

INIT_MEMORY_MONITOR():
    monitor = new MemoryMonitor()
    monitor.textureMemory = 0
    monitor.geometryMemory = 0
    monitor.heapUsed = 0
    monitor.warningThreshold = MEMORY_WARNING_MB * 1024 * 1024
    monitor.criticalThreshold = MEMORY_CRITICAL_MB * 1024 * 1024
    return monitor


UPDATE_MEMORY_MONITOR(monitor, renderer):
    // Estimate texture VRAM from renderer info
    info = renderer.info
    monitor.textureMemory = 0
    // Sum all texture sizes: width * height * 4 (RGBA)
    for texture in info.memory.textures:
        if texture.image:
            monitor.textureMemory += texture.image.width * texture.image.height * 4

    // Estimate geometry memory from buffer attributes
    monitor.geometryMemory = 0
    for geometry in info.memory.geometries:
        for attr in geometry.attributes:
            monitor.geometryMemory += attr.count * attr.itemSize * 4

    // JS heap (if available via performance.memory)
    if performance.memory:
        monitor.heapUsed = performance.memory.usedJSHeapSize

    totalGPU = monitor.textureMemory + monitor.geometryMemory
    return totalGPU


CHECK_MEMORY_THRESHOLDS(monitor, renderer, scene):
    totalGPU = UPDATE_MEMORY_MONITOR(monitor, renderer)

    if totalGPU > monitor.criticalThreshold:
        // Emergency disposal: force aggressive LOD, dispose distant textures
        EMERGENCY_MEMORY_DISPOSE(scene, renderer)
    elif totalGPU > monitor.warningThreshold:
        // Soft warning: force LOD2+ on all buildings, reduce ACTIVE count
        APPLY_QUALITY_LEVEL(2, renderer, scene)

    if monitor.heapUsed > HEAP_WARNING_MB * 1024 * 1024:
        // JS heap pressure: reduce cached data
        TRIM_CACHES()


EMERGENCY_MEMORY_DISPOSE(scene, renderer):
    // Dispose LOD0 and LOD1 meshes (keep LOD2 minimum)
    for building in scene.buildings:
        if building.lod0:
            building.lod0.geometry.dispose()
            building.lod0.material.dispose()
            building.lod0 = null
        if building.lod1:
            building.lod1.geometry.dispose()
            building.lod1.material.dispose()
            building.lod1 = null

    // Dispose distant prop instances
    for (type, mesh) in instanceManager.propInstances:
        mesh.geometry.dispose()
        mesh.material.dispose()

    // Force all citizens to AMBIENT
    for citizen in allCitizens:
        if citizen.tier != AMBIENT:
            BEGIN_TIER_TRANSITION(citizen, AMBIENT)

    // Clear Three.js internal texture cache
    renderer.info.reset()


TRIM_CACHES():
    // Clear conversation history beyond minimum
    // Clear stale position interpolation buffers
    // Trigger manual GC hint (cannot force, but reducing references helps)
    pass
```

---

## 9. Profiling Overlay Data Collection

```
// Toggled via: double-tap left controller (VR) or Shift+P (desktop)
// Display format:
//   FPS: 72 | Frame: 11.2ms | JS: 3.1ms | GPU: 6.8ms
//   Draw: 147 | Tris: 312K | Tex: 178MB | Heap: 289MB
//   Citizens: 18F / 52A / 96B | Audio: 24/32

INIT_PROFILING_OVERLAY():
    overlay = new ProfilingOverlay()
    overlay.visible = false
    overlay.element = CREATE_OVERLAY_DOM()
    return overlay


COLLECT_PROFILING_DATA(overlay, frameMonitor, renderer, instanceManager, audioManager):
    if not overlay.visible:
        return

    // Frame timing
    latestSample = frameMonitor.samples.peek(0)
    overlay.fps = 1000.0 / max(latestSample.totalMs, 0.001)
    overlay.frameMs = latestSample.totalMs
    overlay.jsMs = latestSample.jsMs

    // Renderer stats (from Three.js renderer.info)
    info = renderer.info.render
    overlay.drawCalls = info.calls
    overlay.triangles = info.triangles

    // Memory
    overlay.textureMemMB = memoryMonitor.textureMemory / (1024 * 1024)
    overlay.heapMB = memoryMonitor.heapUsed / (1024 * 1024)

    // Citizen tier counts
    fullCount = 0
    activeCount = 0
    ambientCount = 0
    for citizen in allCitizens:
        switch citizen.tier:
            case FULL: fullCount += 1
            case ACTIVE: activeCount += 1
            case AMBIENT: ambientCount += 1
    overlay.citizenCounts = { full: fullCount, active: activeCount, ambient: ambientCount }

    // Audio sources
    overlay.audioSources = audioManager.activeCount

    UPDATE_OVERLAY_DOM(overlay)


UPDATE_OVERLAY_DOM(overlay):
    overlay.element.innerHTML =
        "FPS: " + round(overlay.fps) +
        " | Frame: " + overlay.frameMs.toFixed(1) + "ms" +
        " | JS: " + overlay.jsMs.toFixed(1) + "ms" +
        " | GPU: " + (overlay.frameMs - overlay.jsMs).toFixed(1) + "ms\n" +
        "Draw: " + overlay.drawCalls +
        " | Tris: " + round(overlay.triangles / 1000) + "K" +
        " | Tex: " + round(overlay.textureMemMB) + "MB" +
        " | Heap: " + round(overlay.heapMB) + "MB\n" +
        "Citizens: " + overlay.citizenCounts.full + "F / " +
        overlay.citizenCounts.active + "A / " +
        overlay.citizenCounts.ambient + "B" +
        " | Audio: " + overlay.audioSources + "/32"


// Log to rolling buffer every 5 seconds for trend analysis
_lastLogTime = 0
LOG_PERFORMANCE_TREND(overlay, currentTime):
    if currentTime - _lastLogTime < 5.0:
        return
    _lastLogTime = currentTime

    trendBuffer.push({
        timestamp: currentTime,
        fps: overlay.fps,
        frameMs: overlay.frameMs,
        drawCalls: overlay.drawCalls,
        triangles: overlay.triangles,
        textureMemMB: overlay.textureMemMB,
    })

    // Keep last 60 samples (5 minutes at 5s intervals)
    if trendBuffer.length > 60:
        trendBuffer.shift()
```

---

## 10. Per-Frame Integration

```
// The main render loop integrates all performance systems.
// Called at 72fps by renderer.setAnimationLoop().

RENDER_LOOP(renderer, scene, camera):
    delta = clock.getDelta()
    elapsed = clock.getElapsedTime()
    frameCount += 1

    // ── Frame budget tracking ───────────────────────────────
    FRAME_BEGIN(frameMonitor)

    // ── JS logic phase ──────────────────────────────────────
    SYSTEM_BEGIN(frameMonitor, "js_logic")

    // Desktop movement, VR controls, network sync...
    // (existing game logic)

    SYSTEM_END(frameMonitor, "js_logic")

    // ── Culling phase ───────────────────────────────────────
    SYSTEM_BEGIN(frameMonitor, "culling")

    // Pass 1: Frustum culling (automatic via Three.js)
    // Pass 2: Distance culling
    cameraPos = camera.getWorldPosition()
    DISTANCE_CULL(scene, cameraPos, elapsed)

    // Tier transitions (smooth blending)
    for citizen in allCitizens:
        UPDATE_TIER_TRANSITION(citizen, delta)

    // Building LOD transitions
    for building in scene.buildings:
        SELECT_BUILDING_LOD(building, cameraPos)
        UPDATE_BUILDING_LOD_TRANSITION(building, delta)

    SYSTEM_END(frameMonitor, "culling")

    // ── Instancing update ───────────────────────────────────
    SYSTEM_BEGIN(frameMonitor, "instancing")

    ambientCitizens = allCitizens.filter(c => c.tier == AMBIENT)
    activeCitizens = allCitizens.filter(c => c.tier == ACTIVE)
    UPDATE_AMBIENT_INSTANCES(instanceManager, ambientCitizens, elapsed)
    UPDATE_ACTIVE_INSTANCES(instanceManager, activeCitizens)

    SYSTEM_END(frameMonitor, "instancing")

    // ── Render ──────────────────────────────────────────────
    renderer.render(scene, camera)

    // ── Post-frame ──────────────────────────────────────────
    sample = FRAME_END(frameMonitor)

    // Adaptive quality (every ~1s)
    ADAPTIVE_QUALITY_CHECK(frameMonitor, frameCount, renderer, scene)

    // Memory monitor (every ~5s)
    if frameCount % 360 == 0:
        CHECK_MEMORY_THRESHOLDS(memoryMonitor, renderer, scene)

    // Profiling overlay
    COLLECT_PROFILING_DATA(profilingOverlay, frameMonitor, renderer, instanceManager, audioManager)

    // Performance trend logging
    LOG_PERFORMANCE_TREND(profilingOverlay, elapsed)
```
