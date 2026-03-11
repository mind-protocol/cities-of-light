# ALGORITHM -- Spatial Audio

> Pseudocode and data structures for every audio subsystem.
> Reference implementations: `src/client/voice.js`, `src/client/zone-ambient.js`,
> `src/client/voice-chat.js`, `src/shared/zones.js`.

---

## 1. Data Structures

```
AudioSource:
    id:            string          // unique source identifier
    tier:          enum(CRITICAL, FOREGROUND, ACTIVE, AMBIENT)
    position:      Vector3         // world-space position
    pannerNode:    PannerNode      // Web Audio API spatial panner
    gainNode:      GainNode        // per-source volume control
    sourceNode:    AudioBufferSourceNode | MediaElementSourceNode
    distance:      float           // cached distance to listener
    active:        bool            // currently playing
    createdAt:     timestamp       // for lifecycle tracking
    fadeState:     enum(NONE, FADING_IN, FADING_OUT)
    fadeEndTime:   float           // AudioContext.currentTime when fade completes

AudioSourceManager:
    sources:       Map<id, AudioSource>   // all managed sources
    activeCount:   int                    // currently active sources
    budgets:       Map<tier, { max: int, current: int }>
    audioContext:  AudioContext
    listener:      AudioListener

DistrictAmbientEngine:
    currentZone:       Zone | null
    targetZone:        Zone | null
    layers:            Map<zoneId, AmbientLayer[]>
    crossfadeProgress: float          // 0.0 to 1.0
    crossfadeDuration: float          // seconds (default 3.0)

AmbientLayer:
    audioElement:  HTMLAudioElement
    sourceNode:    MediaElementSourceNode
    gainNode:      GainNode
    pannerNode:    PannerNode | null   // for positional bias
    looping:       bool
    volume:        float               // target volume for this layer

ReverbSystem:
    convolver:         Map<zoneType, ConvolverNode>
    activeConvolver:   ConvolverNode | null
    targetConvolver:   ConvolverNode | null
    wetGain:           GainNode
    dryGain:           GainNode
    crossfadeProgress: float

ZoneOcclusionGraph:
    zones:        Map<zoneId, ZoneNode>
    edges:        Map<zoneId, Set<zoneId>>   // adjacency: which zones hear each other

ZoneNode:
    id:           string
    bounds:       BoundingBox2D    // XZ plane bounds for zone membership
    zoneType:     enum(PIAZZA, CALLE, CANAL, INDOOR, BRIDGE)

OcclusionResult:
    attenuation:  float     // dB reduction (0, -6, or -Infinity for culled)
    lowPassFreq:  float     // cutoff frequency (20000 = no filter, 2000 = muffled)
```

---

## 2. Audio Source Manager

### 2.1 Priority Queue and Budget Enforcement

```
TIER_BUDGETS = {
    CRITICAL:   { max: 2 },
    FOREGROUND: { max: 6 },
    ACTIVE:     { max: 8 },
    AMBIENT:    { max: 16 },
}
TOTAL_BUDGET = 32

CLASSIFY_TIER(source_type, context):
    if source_type == "citizen_response" or source_type == "narrative_event":
        return CRITICAL
    if source_type == "citizen_conversation" and context.distance < 10:
        return FOREGROUND
    if source_type == "citizen_chatter" and context.distance < 20:
        return ACTIVE
    return AMBIENT


REQUEST_AUDIO_SOURCE(id, tier, position, audioBuffer):
    // Check if source already exists (update position only)
    if sources.has(id):
        existing = sources.get(id)
        UPDATE_SOURCE_POSITION(existing, position)
        return existing

    // Check budget
    if activeCount < TOTAL_BUDGET:
        source = CREATE_SOURCE(id, tier, position, audioBuffer)
        ACTIVATE_SOURCE(source)
        return source

    // Budget full -- find a victim
    victim = FIND_EVICTION_CANDIDATE(tier)
    if victim is null:
        return null    // cannot displace higher priority

    DEACTIVATE_SOURCE(victim, fadeOut=true)
    source = CREATE_SOURCE(id, tier, position, audioBuffer)
    ACTIVATE_SOURCE(source)
    return source


FIND_EVICTION_CANDIDATE(requesting_tier):
    // Only evict sources at same or lower priority (higher tier number)
    candidates = []
    for source in sources.values():
        if not source.active:
            continue
        if source.tier >= requesting_tier:
            candidates.append(source)

    if candidates is empty:
        return null

    // Among candidates, evict the farthest from listener
    candidates.sort_by(source => source.distance, descending=true)
    return candidates[0]
```

### 2.2 Source Activation and Deactivation

```
CREATE_SOURCE(id, tier, position, audioBuffer):
    source = new AudioSource()
    source.id = id
    source.tier = tier
    source.position = position
    source.active = false

    // Build audio graph: sourceNode -> gainNode -> pannerNode -> destination
    source.pannerNode = CONFIGURE_PANNER(position, tier)
    source.gainNode = audioContext.createGain()
    source.gainNode.gain.value = 0    // start silent for fade-in
    source.gainNode.connect(source.pannerNode)

    if audioBuffer is AudioBuffer:
        source.sourceNode = audioContext.createBufferSource()
        source.sourceNode.buffer = audioBuffer
    else if audioBuffer is MediaStream:
        source.sourceNode = audioContext.createMediaStreamSource(audioBuffer)

    source.sourceNode.connect(source.gainNode)
    source.createdAt = now()
    sources.set(id, source)
    return source


ACTIVATE_SOURCE(source):
    if source.active:
        return

    // Connect panner to active reverb chain
    reverbSystem = GET_REVERB_SYSTEM()
    wetDry = GET_WET_DRY_RATIO(source.tier)
    source.pannerNode.connect(reverbSystem.dryGain)
    source.pannerNode.connect(reverbSystem.wetGain)
    reverbSystem.dryGain.gain.value = wetDry.dry
    reverbSystem.wetGain.gain.value = wetDry.wet

    // Fade in over 200ms
    t = audioContext.currentTime
    source.gainNode.gain.setValueAtTime(0, t)
    source.gainNode.gain.linearRampToValueAtTime(
        GET_TIER_VOLUME(source.tier), t + 0.2
    )
    source.fadeState = FADING_IN
    source.fadeEndTime = t + 0.2

    if source.sourceNode is AudioBufferSourceNode:
        source.sourceNode.start()

    source.active = true
    activeCount += 1
    budgets[source.tier].current += 1


DEACTIVATE_SOURCE(source, fadeOut=true):
    if not source.active:
        return

    if fadeOut:
        t = audioContext.currentTime
        source.gainNode.gain.setValueAtTime(
            source.gainNode.gain.value, t
        )
        source.gainNode.gain.linearRampToValueAtTime(0, t + 0.2)
        source.fadeState = FADING_OUT
        source.fadeEndTime = t + 0.2
        // Schedule cleanup after fade
        setTimeout(() => DISPOSE_SOURCE(source), 250)
    else:
        DISPOSE_SOURCE(source)


DISPOSE_SOURCE(source):
    if source.sourceNode is AudioBufferSourceNode:
        try: source.sourceNode.stop()
        catch: pass    // already stopped
    source.sourceNode.disconnect()
    source.gainNode.disconnect()
    source.pannerNode.disconnect()
    source.active = false
    activeCount -= 1
    budgets[source.tier].current -= 1
    sources.delete(source.id)


GET_TIER_VOLUME(tier):
    switch tier:
        case CRITICAL:   return 1.0
        case FOREGROUND: return 0.85
        case ACTIVE:     return 0.5     // -6dB: background chatter
        case AMBIENT:    return 0.35
```

---

## 3. HRTF Positioning

### 3.1 PannerNode Configuration Per Source

```
CONFIGURE_PANNER(position, tier):
    panner = audioContext.createPanner()

    // HRTF model: binaural rendering on Quest 3 headphones
    panner.panningModel = "HRTF"
    panner.distanceModel = "inverse"

    // Distance parameters
    panner.refDistance = 1.0         // full volume at 1 meter
    panner.maxDistance = 50.0        // inaudible beyond 50 meters
    panner.rolloffFactor = SELECT_ROLLOFF(tier)

    // Omnidirectional emission (citizens speak in all directions)
    panner.coneInnerAngle = 360
    panner.coneOuterAngle = 360
    panner.coneOuterGain = 1.0

    // Set initial position
    panner.positionX.value = position.x
    panner.positionY.value = position.y
    panner.positionZ.value = position.z

    panner.connect(audioContext.destination)
    return panner


SELECT_ROLLOFF(tier):
    // Higher rolloff = faster volume drop with distance
    switch tier:
        case CRITICAL:   return 1.0    // moderate falloff, stays audible longer
        case FOREGROUND: return 1.5    // standard
        case ACTIVE:     return 2.0    // drops faster
        case AMBIENT:    return 1.0    // ambient loops need reach


UPDATE_SOURCE_POSITION(source, newPosition):
    // Smooth position update (no snapping)
    source.pannerNode.positionX.value = newPosition.x
    source.pannerNode.positionY.value = newPosition.y
    source.pannerNode.positionZ.value = newPosition.z
    source.position = newPosition
```

### 3.2 Distance Attenuation Curve

```
// Web Audio API inverse distance model computes gain as:
//
//   gain = refDistance / (refDistance + rolloffFactor * (distance - refDistance))
//
// For refDistance=1, rolloffFactor=1.5:
//
//   distance=1m   -> gain=1.000  (full volume)
//   distance=2m   -> gain=0.400
//   distance=5m   -> gain=0.143
//   distance=10m  -> gain=0.069
//   distance=15m  -> gain=0.045
//   distance=25m  -> gain=0.027
//   distance=50m  -> gain=0.013  (barely perceptible)
//
// The curve is continuous. No hard cutoff. Voices fade smoothly.
// The rolloffFactor controls how aggressively volume drops.
//
// CRITICAL tier uses 1.0 rolloff (gentler): citizen responses stay
// audible at medium range so the visitor does not miss them.
// ACTIVE tier uses 2.0 rolloff (steeper): chatter drops quickly,
// becoming ambient texture rather than intelligible speech.
```

---

## 4. Listener Update (Per Frame)

```
// Called every frame in the render loop (72fps on Quest 3)

UPDATE_LISTENER(camera):
    listener = audioContext.listener

    // Extract world-space position and orientation from camera
    pos = camera.getWorldPosition()
    fwd = camera.getWorldDirection()
    up  = Vector3(0, 1, 0).applyQuaternion(camera.quaternion)

    // Modern Web Audio API (AudioParam-based, supported everywhere)
    if listener.positionX exists:
        listener.positionX.value = pos.x
        listener.positionY.value = pos.y
        listener.positionZ.value = pos.z
        listener.forwardX.value = fwd.x
        listener.forwardY.value = fwd.y
        listener.forwardZ.value = fwd.z
        listener.upX.value = up.x
        listener.upY.value = up.y
        listener.upZ.value = up.z
    else:
        // Legacy fallback (deprecated but needed for some browsers)
        listener.setPosition(pos.x, pos.y, pos.z)
        listener.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z)
```

---

## 5. District Ambient Engine

### 5.1 Layer Management

```
DISTRICT_PROFILES = {
    "rialto": {
        layers: [
            { file: "market-crowd.ogg",  volume: 0.7, positionalBias: null },
            { file: "water-lapping.ogg", volume: 0.4, positionalBias: { x: -10, z: 5 } },
            { file: "merchant-calls.ogg", volume: 0.25, positionalBias: { x: 3, z: -2 } },
        ]
    },
    "san_marco": {
        layers: [
            { file: "piazza-echo.ogg",   volume: 0.5, positionalBias: null },
            { file: "pigeons.ogg",        volume: 0.3, positionalBias: null },
            { file: "distant-bells.ogg",  volume: 0.2, positionalBias: { x: 20, z: -15 } },
        ]
    },
    "dorsoduro": {
        layers: [
            { file: "quiet-water.ogg",   volume: 0.4, positionalBias: { x: -8, z: 0 } },
            { file: "wind-trees.ogg",     volume: 0.3, positionalBias: null },
            { file: "gondolier-song.ogg", volume: 0.15, positionalBias: { x: 5, z: 10 } },
        ]
    },
    "cannaregio": {
        layers: [
            { file: "residential-hum.ogg", volume: 0.3, positionalBias: null },
            { file: "footsteps-stone.ogg", volume: 0.2, positionalBias: null },
            { file: "children.ogg",        volume: 0.15, positionalBias: { x: -5, z: 8 } },
        ]
    },
    "murano": {
        layers: [
            { file: "furnace-rumble.ogg", volume: 0.6, positionalBias: { x: 0, z: -5 } },
            { file: "glass-clink.ogg",    volume: 0.3, positionalBias: { x: 3, z: -3 } },
            { file: "heat-hiss.ogg",      volume: 0.2, positionalBias: null },
        ]
    },
}


INIT_AMBIENT_ENGINE(audioContext):
    engine = new DistrictAmbientEngine()
    engine.audioContext = audioContext
    engine.currentZone = null
    engine.layers = Map()
    engine.crossfadeProgress = 1.0   // 1.0 = no crossfade in progress

    // Pre-create audio elements for all layers (suspended, not playing)
    for district, profile in DISTRICT_PROFILES:
        districtLayers = []
        for layerDef in profile.layers:
            layer = new AmbientLayer()
            layer.audioElement = new Audio(layerDef.file)
            layer.audioElement.loop = true
            layer.audioElement.preload = "auto"
            layer.sourceNode = audioContext.createMediaElementSource(layer.audioElement)
            layer.gainNode = audioContext.createGain()
            layer.gainNode.gain.value = 0   // start silent

            if layerDef.positionalBias:
                layer.pannerNode = audioContext.createPanner()
                layer.pannerNode.panningModel = "HRTF"
                layer.pannerNode.distanceModel = "inverse"
                layer.pannerNode.refDistance = 5
                layer.pannerNode.maxDistance = 80
                layer.pannerNode.rolloffFactor = 0.5
                layer.sourceNode.connect(layer.gainNode)
                layer.gainNode.connect(layer.pannerNode)
                layer.pannerNode.connect(audioContext.destination)
            else:
                layer.sourceNode.connect(layer.gainNode)
                layer.gainNode.connect(audioContext.destination)

            layer.volume = layerDef.volume
            layer.looping = true
            districtLayers.append(layer)
        engine.layers.set(district, districtLayers)

    return engine
```

### 5.2 Crossfade on Zone Transition

```
AMBIENT_UPDATE(engine, playerPosition, deltaTime):
    // Detect current zone
    nearest = detectNearestZone(playerPosition)
    newZoneId = nearest.zone.id

    if engine.currentZone is null:
        // First zone: start layers immediately at full volume
        engine.currentZone = newZoneId
        START_LAYERS(engine, newZoneId)
        return

    if newZoneId != engine.currentZone and engine.crossfadeProgress >= 1.0:
        // Zone changed: begin crossfade
        engine.targetZone = newZoneId
        engine.crossfadeProgress = 0.0
        START_LAYERS(engine, newZoneId)    // start new layers at volume 0

    if engine.crossfadeProgress < 1.0:
        // Crossfade in progress
        engine.crossfadeProgress += deltaTime / engine.crossfadeDuration
        engine.crossfadeProgress = min(engine.crossfadeProgress, 1.0)

        t = engine.crossfadeProgress
        // Equal-power crossfade (prevents volume dip at midpoint)
        fadeOut = cos(t * PI / 2)
        fadeIn  = sin(t * PI / 2)

        // Fade out old district layers
        for layer in engine.layers.get(engine.currentZone):
            layer.gainNode.gain.value = layer.volume * fadeOut

        // Fade in new district layers
        for layer in engine.layers.get(engine.targetZone):
            layer.gainNode.gain.value = layer.volume * fadeIn

        if engine.crossfadeProgress >= 1.0:
            // Crossfade complete
            STOP_LAYERS(engine, engine.currentZone)
            engine.currentZone = engine.targetZone
            engine.targetZone = null

    // Update positional bias panners relative to zone center
    zoneCenter = nearest.zone.position
    for layer in engine.layers.get(engine.currentZone):
        if layer.pannerNode:
            bias = layer.positionalBias
            layer.pannerNode.positionX.value = zoneCenter.x + bias.x
            layer.pannerNode.positionZ.value = zoneCenter.z + bias.z
            layer.pannerNode.positionY.value = 1.0


START_LAYERS(engine, zoneId):
    for layer in engine.layers.get(zoneId):
        layer.audioElement.play()

STOP_LAYERS(engine, zoneId):
    for layer in engine.layers.get(zoneId):
        layer.audioElement.pause()
        layer.audioElement.currentTime = 0
        layer.gainNode.gain.value = 0
```

---

## 6. Reverb System

### 6.1 ConvolverNode Per Zone Type

```
ZONE_TYPES = {
    PIAZZA: { irFile: "ir_piazza.wav",  rt60: 2.5, wetDry: { voice: 0.2, chatter: 0.5, event: 0.7 } },
    CALLE:  { irFile: "ir_calle.wav",   rt60: 0.8, wetDry: { voice: 0.15, chatter: 0.4, event: 0.6 } },
    CANAL:  { irFile: "ir_canal.wav",   rt60: 1.5, wetDry: { voice: 0.2, chatter: 0.5, event: 0.65 } },
    INDOOR: { irFile: "ir_church.wav",  rt60: 4.0, wetDry: { voice: 0.25, chatter: 0.6, event: 0.8 } },
    BRIDGE: { irFile: "ir_bridge.wav",  rt60: 1.2, wetDry: { voice: 0.2, chatter: 0.45, event: 0.6 } },
}

INIT_REVERB_SYSTEM(audioContext):
    system = new ReverbSystem()
    system.convolver = Map()
    system.wetGain = audioContext.createGain()
    system.dryGain = audioContext.createGain()
    system.dryGain.connect(audioContext.destination)
    system.crossfadeProgress = 1.0

    // Load impulse responses and create ConvolverNodes
    for zoneType, config in ZONE_TYPES:
        convolver = audioContext.createConvolver()
        irBuffer = await LOAD_IMPULSE_RESPONSE(config.irFile)
        convolver.buffer = irBuffer
        convolver.normalize = true
        system.convolver.set(zoneType, convolver)

    system.activeConvolver = null
    return system


LOAD_IMPULSE_RESPONSE(filename):
    // Fetch IR file (mono, 44.1kHz, 16-bit, 2-4 seconds)
    // Total asset budget: ~500KB for all 5 IRs
    response = await fetch("/assets/audio/ir/" + filename)
    arrayBuffer = await response.arrayBuffer()
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    return audioBuffer
```

### 6.2 Impulse Response Selection and Crossfade

```
UPDATE_REVERB(reverbSystem, zoneType, deltaTime):
    targetConvolver = reverbSystem.convolver.get(zoneType)

    if targetConvolver == reverbSystem.activeConvolver:
        return    // no change needed

    if reverbSystem.activeConvolver is null:
        // First zone: activate immediately
        reverbSystem.activeConvolver = targetConvolver
        reverbSystem.wetGain.disconnect()
        reverbSystem.wetGain.connect(targetConvolver)
        targetConvolver.connect(audioContext.destination)
        return

    // Crossfade reverb profiles over 2 seconds
    if reverbSystem.crossfadeProgress >= 1.0:
        reverbSystem.targetConvolver = targetConvolver
        reverbSystem.crossfadeProgress = 0.0
        // Connect target convolver in parallel
        targetConvolver.connect(audioContext.destination)

    reverbSystem.crossfadeProgress += deltaTime / 2.0
    reverbSystem.crossfadeProgress = min(reverbSystem.crossfadeProgress, 1.0)

    t = reverbSystem.crossfadeProgress
    // Cross-fade wet signal between old and new convolvers
    // Implemented by ramping gains on two parallel wet paths
    oldWet = cos(t * PI / 2)
    newWet = sin(t * PI / 2)

    // Apply by adjusting convolver output gains
    // (Each convolver has its own output gain node in a real implementation)

    if reverbSystem.crossfadeProgress >= 1.0:
        // Disconnect old convolver
        reverbSystem.activeConvolver.disconnect()
        reverbSystem.activeConvolver = targetConvolver
        reverbSystem.targetConvolver = null


GET_WET_DRY_RATIO(tier):
    zoneType = GET_CURRENT_ZONE_TYPE()
    config = ZONE_TYPES[zoneType]

    switch tier:
        case CRITICAL:
        case FOREGROUND:
            wet = config.wetDry.voice
        case ACTIVE:
            wet = config.wetDry.chatter
        case AMBIENT:
            wet = config.wetDry.event

    return { wet: wet, dry: 1.0 - wet }
```

---

## 7. Zone-Based Occlusion

### 7.1 Zone Graph Construction

```
BUILD_OCCLUSION_GRAPH(zones):
    graph = new ZoneOcclusionGraph()

    // Register each zone with its spatial bounds
    for zone in zones:
        node = new ZoneNode()
        node.id = zone.id
        node.bounds = COMPUTE_ZONE_BOUNDS(zone)
        node.zoneType = CLASSIFY_ZONE_TYPE(zone)
        graph.zones.set(zone.id, node)
        graph.edges.set(zone.id, Set())

    // Build adjacency from zone waypoints (waypoints define connectivity)
    for zone in zones:
        for waypointId in zone.waypoints:
            graph.edges.get(zone.id).add(waypointId)
            graph.edges.get(waypointId).add(zone.id)

    return graph


RESOLVE_ZONE(position, graph):
    // Determine which zone a position belongs to
    // Uses detectNearestZone from shared/zones.js
    result = detectNearestZone(position)
    return result.zone.id
```

### 7.2 Occlusion Path Check

```
CHECK_OCCLUSION(graph, listenerZoneId, sourceZoneId):
    // Same zone: no occlusion
    if listenerZoneId == sourceZoneId:
        return OcclusionResult(attenuation=0, lowPassFreq=20000)

    // Adjacent connected zone: partial occlusion
    listenerEdges = graph.edges.get(listenerZoneId)
    if sourceZoneId in listenerEdges:
        return OcclusionResult(attenuation=-6, lowPassFreq=2000)

    // Check 2-hop adjacency (source is neighbor of a neighbor)
    for neighborId in listenerEdges:
        neighborEdges = graph.edges.get(neighborId)
        if sourceZoneId in neighborEdges:
            // Two zone boundaries: heavily occluded
            return OcclusionResult(attenuation=-18, lowPassFreq=800)

    // Separated by 3+ zone boundaries: fully culled
    return OcclusionResult(attenuation=-Infinity, lowPassFreq=0)


APPLY_OCCLUSION(source, occlusionResult):
    if occlusionResult.attenuation == -Infinity:
        // Fully occluded: deactivate source
        DEACTIVATE_SOURCE(source, fadeOut=true)
        return

    // Apply attenuation
    targetGain = GET_TIER_VOLUME(source.tier) * DB_TO_LINEAR(occlusionResult.attenuation)
    t = audioContext.currentTime
    source.gainNode.gain.setTargetAtTime(targetGain, t, 0.1)

    // Apply low-pass filter for muffling
    if source.lowPassFilter is null and occlusionResult.lowPassFreq < 20000:
        source.lowPassFilter = audioContext.createBiquadFilter()
        source.lowPassFilter.type = "lowpass"
        // Insert between gainNode and pannerNode
        source.gainNode.disconnect()
        source.gainNode.connect(source.lowPassFilter)
        source.lowPassFilter.connect(source.pannerNode)

    if source.lowPassFilter:
        source.lowPassFilter.frequency.setTargetAtTime(
            occlusionResult.lowPassFreq, t, 0.1
        )


DB_TO_LINEAR(dB):
    return pow(10, dB / 20)
```

---

## 8. Per-Frame Audio Update Loop

```
// Called every frame from the main render loop
// Integrates all audio subsystems into a single coherent update

AUDIO_UPDATE(audioManager, camera, deltaTime):
    // ── Step 1: Update listener ─────────────────────────────
    UPDATE_LISTENER(camera)

    // ── Step 2: Compute listener zone ───────────────────────
    listenerPos = camera.getWorldPosition()
    listenerZoneId = RESOLVE_ZONE(listenerPos, occlusionGraph)

    // ── Step 3: Update ambient engine ───────────────────────
    AMBIENT_UPDATE(ambientEngine, listenerPos, deltaTime)

    // ── Step 4: Update reverb for current zone type ─────────
    zoneType = occlusionGraph.zones.get(listenerZoneId).zoneType
    UPDATE_REVERB(reverbSystem, zoneType, deltaTime)

    // ── Step 5: Update all active audio sources ─────────────
    for source in audioManager.sources.values():
        if not source.active:
            continue

        // 5a. Recompute distance to listener
        dx = source.position.x - listenerPos.x
        dy = source.position.y - listenerPos.y
        dz = source.position.z - listenerPos.z
        source.distance = sqrt(dx*dx + dy*dy + dz*dz)

        // 5b. Resolve occlusion
        sourceZoneId = RESOLVE_ZONE(source.position, occlusionGraph)
        occlusion = CHECK_OCCLUSION(occlusionGraph, listenerZoneId, sourceZoneId)
        APPLY_OCCLUSION(source, occlusion)

        // 5c. Update panner position (if source moved, e.g. walking citizen)
        // Position already set by UPDATE_SOURCE_POSITION when server sends updates

    // ── Step 6: Check for completed fade-outs ───────────────
    t = audioContext.currentTime
    for source in audioManager.sources.values():
        if source.fadeState == FADING_OUT and t >= source.fadeEndTime:
            DISPOSE_SOURCE(source)

    // ── Step 7: Budget rebalance (every 500ms, not every frame) ──
    if (frameCount % 36 == 0):    // ~500ms at 72fps
        REBALANCE_BUDGET(audioManager, listenerPos)


REBALANCE_BUDGET(audioManager, listenerPos):
    // Re-sort all sources by distance and ensure budget compliance
    sorted = audioManager.sources.values()
        .filter(s => s.active)
        .sort_by(s => s.distance)

    tierCounts = { CRITICAL: 0, FOREGROUND: 0, ACTIVE: 0, AMBIENT: 0 }
    totalActive = 0

    for source in sorted:
        tierCounts[source.tier] += 1

        if tierCounts[source.tier] > TIER_BUDGETS[source.tier].max:
            // Over budget for this tier: deactivate farthest
            DEACTIVATE_SOURCE(source, fadeOut=true)
            continue

        totalActive += 1
        if totalActive > TOTAL_BUDGET:
            // Over total budget: deactivate
            DEACTIVATE_SOURCE(source, fadeOut=true)
```

---

## 9. Audio Source Lifecycle

```
// Complete lifecycle of an audio source from creation to disposal

LIFECYCLE_CREATE(citizenId, audioData, position, tier):
    // Step 1: Request slot from manager
    source = REQUEST_AUDIO_SOURCE(citizenId, tier, position, audioData)
    if source is null:
        // Budget exhausted, no eviction candidate
        return null

    // Step 2: Source is now active, playing, spatialized
    return source


LIFECYCLE_UPDATE(citizenId, newPosition):
    // Called when citizen moves (from WebSocket position update)
    source = audioManager.sources.get(citizenId)
    if source is null:
        return

    UPDATE_SOURCE_POSITION(source, newPosition)


LIFECYCLE_DISPOSE(citizenId):
    // Called when citizen leaves, walks out of range, or audio ends
    source = audioManager.sources.get(citizenId)
    if source is null:
        return

    DEACTIVATE_SOURCE(source, fadeOut=true)
    // source will be fully disposed after fade-out completes
    // (handled by fade-out timeout in DEACTIVATE_SOURCE)


// ─── Streaming TTS Lifecycle ─────────────────────────────────
// TTS audio arrives in chunks via WebSocket. The lifecycle differs:
// chunks are collected, then played as a single buffer.

LIFECYCLE_STREAM_START(citizenId, position, tier):
    // Allocate slot but do not start playback yet
    _streamBuffers[citizenId] = []
    _streamPositions[citizenId] = position
    _streamTiers[citizenId] = tier


LIFECYCLE_STREAM_CHUNK(citizenId, base64Chunk):
    buffer = base64_to_arraybuffer(base64Chunk)
    _streamBuffers[citizenId].append(buffer)


LIFECYCLE_STREAM_END(citizenId):
    chunks = _streamBuffers[citizenId]
    position = _streamPositions[citizenId]
    tier = _streamTiers[citizenId]

    if chunks is empty:
        return

    // Concatenate chunks into single buffer
    totalLength = sum(chunk.byteLength for chunk in chunks)
    fullBuffer = new Uint8Array(totalLength)
    offset = 0
    for chunk in chunks:
        fullBuffer.set(new Uint8Array(chunk), offset)
        offset += chunk.byteLength

    // Decode MP3 to PCM
    audioBuffer = await audioContext.decodeAudioData(fullBuffer.buffer)

    // Crossfade: if previous playback still active, fade it out
    existingSource = audioManager.sources.get(citizenId)
    if existingSource and existingSource.active:
        DEACTIVATE_SOURCE(existingSource, fadeOut=true)

    // Play the full buffer spatially
    LIFECYCLE_CREATE(citizenId, audioBuffer, position, tier)

    // Cleanup stream state
    delete _streamBuffers[citizenId]
    delete _streamPositions[citizenId]
    delete _streamTiers[citizenId]
```

---

## 10. WebRTC Peer Voice Spatial Update

```
// Peer-to-peer voice uses a separate panner per peer
// Updated every frame alongside the main audio loop

UPDATE_PEER_POSITIONS(voiceChat, listenerPos, listenerFwd, citizenPositions):
    for (citizenId, peer) in voiceChat.peers:
        position = citizenPositions.get(citizenId)
        if position is null:
            continue

        if peer.panner:
            peer.panner.positionX.value = position.x
            peer.panner.positionY.value = position.y
            peer.panner.positionZ.value = position.z

        // Peer voice does not go through the ambient/reverb chain
        // It routes directly: MediaStream -> panner -> destination
        // Occlusion is applied identically to other sources
        if occlusionGraph:
            sourceZone = RESOLVE_ZONE(position, occlusionGraph)
            listenerZone = RESOLVE_ZONE(listenerPos, occlusionGraph)
            occlusion = CHECK_OCCLUSION(occlusionGraph, listenerZone, sourceZone)
            if occlusion.attenuation == -Infinity:
                peer.panner.disconnect()
            else:
                targetGain = DB_TO_LINEAR(occlusion.attenuation)
                peer.gainNode.gain.setTargetAtTime(targetGain, audioContext.currentTime, 0.1)
```
