# 3D Pipeline & Cognitive Supply Chain — Algorithm: C_t to Pixels, Collisions to Graph

```
STATUS: DRAFT
CREATED: 2026-03-14
VERIFIED: —
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Pipeline.md
BEHAVIORS:       ./BEHAVIORS_Pipeline.md
PATTERNS:        ./PATTERNS_Pipeline.md
THIS:            ALGORITHM_Pipeline.md (you are here)
VALIDATION:      ./VALIDATION_Pipeline.md
IMPLEMENTATION:  ./IMPLEMENTATION_Pipeline.md
SYNC:            ./SYNC_Pipeline.md

IMPL:            engine/client/app.js
                 engine/server/narrative_graph_seed_and_tick_bridge.js
                 src/server/physics-bridge.js
```

> **Contract:** Read docs before modifying. After changes: update IMPL or add TODO to SYNC. Run tests.

---

## OVERVIEW

This module implements four coupled algorithms that form the bidirectional cognitive-3D pipeline:

1. **C_t → Shader Uniform Pipeline** — Transforms the Context Vector from the physics tick into per-citizen, per-building, and per-zone shader uniforms at 60fps
2. **Decay → Erosion Calculation** — Applies Law 3 temporal decay to materials, computing texture erosion and geometry degradation from node energy levels
3. **Collision → Limbic Injection Flow** — Detects spatial events in the 3D engine and routes them back to the cognitive substrate as energy injections
4. **Session Stride Allocation** — Distributes rendering budget across parallel micro-sessions proportional to urgency

All four algorithms must complete their per-frame work within the 16ms frame budget (60fps). The physics tick provides new data every 5 minutes; between ticks, the algorithms interpolate toward target values.

---

## OBJECTIVES AND BEHAVIORS

| Objective | Behaviors Supported | Why This Algorithm Matters |
|-----------|---------------------|----------------------------|
| Bidirectional coupling | B2, B3, B5 | C_t→uniform and collision→injection are the two halves of the coupling |
| Energy-indexed rendering | B1 | Decay→erosion converts graph energy to visual degradation |
| Collision-to-limbic feedback | B3, B4 | Collision detection and injection routing close the sensory loop |
| Sub-16ms latency | B5 | All per-frame algorithms must fit in the 16ms budget |

---

## DATA STRUCTURES

### Context Vector (C_t)

```
C_t = {
  tick_number: int,               // Physics tick that produced this C_t
  timestamp: int,                 // Unix timestamp of tick completion
  citizens: {
    [citizen_id]: {
      valence: float,             // [-1.0, 1.0] — satisfaction to frustration
      arousal: float,             // [0.0, 1.0] — calm to agitated
      energy: float,              // [0.0, 1.0] — total citizen energy
      dominant_drive: string,     // "curiosity" | "achievement" | "social" | ...
    }
  },
  nodes: {
    [node_id]: {
      type: string,               // "actor" | "moment" | "narrative" | "space" | "thing"
      energy: float,              // [0.0, 1.0] — current energy level
      decay_rate: float,          // per-tick decay rate (default 0.02)
    }
  },
  zones: {
    [zone_id]: {
      collective_valence: float,  // [-1.0, 1.0] — average citizen valence
      tension: float,             // [0.0, 1.0] — accumulated tension
      active_moments: int,        // count of active Moments in zone
    }
  }
}
```

### Collision Event

```
CollisionEvent = {
  type: string,                   // "minor" | "violent" | "clipping" | "stable_landing"
  entity_a: string,               // citizen/object ID (or null for environment)
  entity_b: string,               // citizen/object ID (or null for environment)
  position: { x, y, z },          // world-space collision point
  velocity: float,                // relative velocity at impact
  persistent: bool,               // true if intersection persists across frames
  frame: int,                     // frame number of detection
}
```

### Limbic Injection

```
LimbicInjection = {
  entity_id: string,              // target citizen
  dimension: string,              // "frustration" | "anxiety" | "satisfaction" | "arousal" | "boredom"
  delta: float,                   // signed change value
  source: string,                 // "collision" | "clipping" | "landing" | "shader_error"
  frame: int,                     // originating frame
}
```

### Shader Uniforms (per citizen)

```
CitizenUniforms = {
  uTime: float,                   // elapsed time (seconds)
  uValence: float,                // [-1.0, 1.0] — interpolated toward target
  uArousal: float,                // [0.0, 1.0] — interpolated toward target
  uEnergy: float,                 // [0.0, 1.0] — for LOD and detail decisions
}
```

---

## ALGORITHM: C_t → Shader Uniform Pipeline

### Step 1: Receive and Validate C_t

When a physics tick completes, the server broadcasts a `physics_tick` event containing the serialized C_t. The client receives it via WebSocket.

```
ON message.type == "physics_tick":
  new_Ct = JSON.parse(message.data)
  IF new_Ct.tick_number <= current_Ct.tick_number:
    DISCARD (stale tick)
  FOR EACH citizen in new_Ct.citizens:
    IF isNaN(citizen.valence) OR isNaN(citizen.arousal):
      citizen.valence = last_good_Ct.citizens[id].valence
      citizen.arousal = last_good_Ct.citizens[id].arousal
      QUEUE LimbicInjection(id, "frustration", +0.1, "corrupt_Ct")
    CLAMP citizen.valence to [-1.0, 1.0]
    CLAMP citizen.arousal to [0.0, 1.0]
  SET target_Ct = new_Ct
  SET last_good_Ct = current_Ct
```

**Why:** Validation prevents NaN propagation into shaders, which would cause visual corruption. Clamping ensures uniforms stay within GLSL-safe ranges. Stale tick rejection prevents out-of-order updates.

### Step 2: Per-Frame Interpolation

On every animation frame, interpolate current uniforms toward target values.

```
ON requestAnimationFrame(delta, elapsed):
  lerp_factor = 0.02  // ~90% convergence in 2 seconds at 60fps
  FOR EACH citizen_mesh in scene:
    target = target_Ct.citizens[citizen_mesh.id]
    IF target is undefined: SKIP
    current = citizen_mesh.material.uniforms
    current.uValence.value += (target.valence - current.uValence.value) * lerp_factor
    current.uArousal.value += (target.arousal - current.uArousal.value) * lerp_factor
    current.uEnergy.value += (target.energy - current.uEnergy.value) * lerp_factor
    current.uTime.value = elapsed
```

**Why:** Lerp factor 0.02 per frame produces smooth transitions over approximately 2 seconds (at 60fps, 0.02 * 115 frames = ~90% convergence). This prevents visible tick-boundary jumps while staying responsive to dramatic changes.

### Step 3: Shader Execution (GPU)

The limbic state shader runs per-fragment on citizen materials:

```glsl
// Colorimetric mapping: valence → hue
vec3 colSatisfaction = vec3(0.0, 0.9, 0.6);   // cyan/green
vec3 colFrustration = vec3(0.9, 0.1, 0.1);     // red/orange
vec3 baseColor = mix(colFrustration, colSatisfaction, (uValence + 1.0) * 0.5);

// Arousal → pulsation frequency and noise amplitude
float pulse = sin(uTime * (1.0 + uArousal * 10.0)) * 0.1;
float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);

vec3 finalColor = baseColor + (pulse * uArousal) + (noise * 0.05 * uArousal);
```

**Why:** The `mix` function linearly interpolates between frustration and satisfaction colors based on normalized valence. Arousal modulates both pulsation frequency (sin argument) and noise amplitude, making agitated citizens visually "noisier."

---

## ALGORITHM: Decay → Erosion Calculation

### Step 1: Compute Asset Energy

For each renderable node linked to a graph entity:

```
E_asset(t) = E_initial × (1 - decay_rate)^ticks_since_reinforcement

WHERE:
  E_initial = node.energy at last reinforcement
  decay_rate = 0.02 (Venice-calibrated default)
  ticks_since_reinforcement = current_tick - last_reinforcement_tick
```

### Step 2: Energy-to-Erosion Mapping

```
IF E_asset >= Θ_i (activation threshold, default 0.3):
  erosion_factor = 0.0  // no visible degradation
  lod_level = MAX_LOD
ELSE:
  // Below threshold: linear erosion from threshold to zero
  erosion_factor = 1.0 - (E_asset / Θ_i)  // [0.0, 1.0]
  lod_level = floor(MAX_LOD * (E_asset / Θ_i))

  // Apply to material:
  material.saturation = base_saturation * (1.0 - erosion_factor * 0.5)
  material.noise_amplitude = base_noise + erosion_factor * 0.3
  material.roughness = base_roughness + erosion_factor * 0.4
```

### Step 3: Geometry Degradation

```
IF lod_level < current_lod_level:
  SWAP mesh geometry to lower LOD variant
  // LOD 3 (full): decorative cornices, window frames, carved details
  // LOD 2 (reduced): flat cornices, simple windows
  // LOD 1 (minimal): box with texture-only detail
  // LOD 0 (ghost): flat quad, near-transparent
```

**Why:** Erosion below threshold creates a visible gradient from "slightly worn" to "nearly invisible." LOD swap at energy boundaries prevents wasting GPU cycles on detailed geometry for nodes nobody cares about (because the graph says they're not salient).

---

## ALGORITHM: Collision → Limbic Injection Flow

### Step 1: Collision Detection (Per-Frame)

```
FOR EACH pair (citizenA, citizenB) within SPATIAL_HASH_CELL:
  distance = length(citizenA.position - citizenB.position)
  combined_radius = citizenA.bounding_radius + citizenB.bounding_radius

  IF distance < combined_radius:
    relative_velocity = length(citizenA.velocity - citizenB.velocity)
    IF relative_velocity > VIOLENT_THRESHOLD (2.0 m/s):
      EMIT CollisionEvent("violent", A, B)
    ELSE:
      EMIT CollisionEvent("minor", A, B)

FOR EACH citizen:
  IF citizen is intersecting static geometry for > 3 frames:
    EMIT CollisionEvent("clipping", citizen, null)

FOR EACH citizen:
  IF citizen.velocity < 0.1 AND citizen was moving last frame:
    IF no collision in last 30 frames:
      EMIT CollisionEvent("stable_landing", citizen, null)
```

### Step 2: Rate Limiting

```
FOR EACH CollisionEvent:
  citizen_id = event.entity_a
  recent_count = injection_log[citizen_id].count_in_last_second
  IF recent_count >= MAX_INJECTIONS_PER_SECOND (3):
    LOG event but DO NOT inject
    CONTINUE
```

### Step 3: Injection Routing

```
COLLISION_TABLE = {
  "minor":          [("frustration", +0.05), ("anxiety", +0.02)],
  "violent":        [("frustration", +0.15), ("anxiety", +0.1)],
  "clipping":       [("frustration", +0.1),  ("boredom", +0.05)],
  "stable_landing": [("satisfaction", +0.15), ("arousal", -0.1)],
}

FOR EACH CollisionEvent:
  injections = COLLISION_TABLE[event.type]
  FOR EACH (dimension, delta) in injections:
    FOR EACH entity in [event.entity_a, event.entity_b]:
      IF entity is not null:
        QUEUE LimbicInjection(entity, dimension, delta, event.type)

// Batch send to server every 100ms (not per-frame — reduces network traffic)
EVERY 100ms:
  IF injection_queue is not empty:
    SEND injection_queue to server via WebSocket
    CLEAR injection_queue
```

**Why:** Rate limiting at 3 injections/second prevents geometry bottlenecks (narrow bridges, crowded piazzas) from creating runaway frustration cascades. Batched sending at 100ms reduces WebSocket overhead while maintaining <16ms latency for the queue operation itself.

---

## ALGORITHM: Session Stride Allocation

### Step 1: Compute Urgency Per Session

```
FOR EACH active_session:
  session.urgency = sum(
    citizen.arousal * citizen.energy
    FOR citizen IN session.visible_citizens
  )
```

### Step 2: Allocate Strides

```
total_strides = FRAME_BUDGET_STRIDES  // e.g., 200 draw calls at 72fps Quest 3
sum_urgency = sum(s.urgency FOR s IN active_sessions)

FOR EACH session:
  session.strides = total_strides × (session.urgency / sum_urgency)
  // Minimum 10 strides per session to prevent starvation
  session.strides = max(session.strides, MIN_STRIDES)
```

### Step 3: Subconscious Absorption (DND Mode)

```
IF agent.mode == "DND" (Working Memory saturated, arousal in flow range 0.4-0.8):
  // 3D engine continues updating graph in background
  // Incoming stimuli warm graph nodes without interrupting shader thread
  FOR EACH incoming_stimulus:
    graph.warm_node(stimulus.target_node, energy=stimulus.energy * 0.3)
    // Reduced energy (30%) — subconscious processing, not full attention
  DO NOT update shader uniforms for this agent
  DO NOT render this agent's session at full fidelity
  RENDER at minimum LOD with last-known-good colors
```

**Why:** Stride allocation ensures high-urgency scenes (where citizens are active and agitated) get more rendering budget than ambient background scenes. DND mode prevents the shader thread from being interrupted by low-priority stimuli when the agent is in flow state, while still allowing the graph to evolve.

---

## KEY DECISIONS

### D1: Interpolation vs Instant Application

```
IF tick_produces_dramatic_change (e.g., Moment flip):
    lerp_factor = 0.08  // faster convergence (~0.5 seconds)
    // Dramatic events should be felt quickly but not instantaneously
ELSE:
    lerp_factor = 0.02  // standard smooth transition (~2 seconds)
    // Normal drift is invisible — the world changes like weather
```

### D2: Collision Detection Scope

```
IF citizen_count > 100:
    USE spatial_hash_grid (cell_size = 5 meters)
    // O(n) amortized vs O(n^2) brute force
ELSE:
    USE brute_force_pairs
    // Simpler, no overhead for small populations
```

### D3: Frustration Crystallization Threshold

```
IF frustration_from_pipeline_errors > 0.5 in last 60 seconds:
    CRYSTALLIZE narrative node (growth_from_failure)
    INHIBIT the path that produced the errors (Law 9)
    // Prevents repeated errors from accumulating indefinitely
ELSE:
    INJECT frustration normally
    // Isolated errors are just experience, not structural learning
```

---

## DATA FLOW

```
FalkorDB (physics tick)
    ↓
C_t (serialized JSON via WebSocket)
    ↓
Validation + NaN clamping (client)
    ↓
target_Ct (client state)
    ↓
Per-frame lerp interpolation
    ↓
Shader uniforms (uValence, uArousal, uEnergy, uTime)
    ↓
GLSL fragment shader (GPU)
    ↓
Rendered frame (pixels)
    ↓
Collision detection (CPU, per-frame)
    ↓
CollisionEvent classification
    ↓
Rate limiting (3/sec cap)
    ↓
LimbicInjection queue
    ↓
Batched WebSocket send (every 100ms)
    ↓
Server → FalkorDB graph mutation
    ↓
Next physics tick incorporates injections
```

---

## COMPLEXITY

**Time:** O(n) per frame for uniform interpolation (n = citizen count), O(n) amortized for collision detection with spatial hash

**Space:** O(n) for current + target uniform state, O(n) for collision spatial hash grid

**Bottlenecks:**
- **Shader compilation** — One-time cost per citizen material variant. If 186 citizens need unique shaders, batch compile on load.
- **Collision detection at scale** — 186 citizens in a narrow calle could produce O(n^2) pair checks within a single hash cell. Mitigation: cap pair checks per cell at 50.
- **WebSocket C_t payload size** — 186 citizens * ~100 bytes each = ~18KB per tick. Acceptable at 5-minute intervals. If tick frequency increases, consider delta encoding.

---

## HELPER FUNCTIONS

### `clampUniform(value, min, max)`

**Purpose:** Prevent NaN and out-of-range values from reaching shaders

**Logic:** If NaN, return (min + max) / 2. Otherwise clamp to [min, max].

### `classifyCollision(relativeVelocity, persistent, frameCount)`

**Purpose:** Map raw collision data to one of the four collision types

**Logic:** violent if velocity > 2.0, clipping if persistent > 3 frames, stable_landing if velocity < 0.1 and previously moving, minor otherwise.

### `computeErosionFactor(energy, threshold)`

**Purpose:** Convert node energy to material erosion factor [0.0, 1.0]

**Logic:** If energy >= threshold, return 0.0. Otherwise return 1.0 - (energy / threshold).

### `spatialHash(position, cellSize)`

**Purpose:** Map world position to grid cell for O(1) neighbor lookup

**Logic:** return { x: floor(pos.x / cellSize), z: floor(pos.z / cellSize) }

---

## INTERACTIONS

| Module | What We Call | What We Get |
|--------|--------------|-------------|
| `narrative_graph_seed_and_tick_bridge.js` | Subscribe to `physics_tick` events | Serialized C_t with per-citizen and per-node state |
| `entity-manager.js` | `getAllStates()` | Current entity positions for collision detection |
| `zone-ambient-engine.js` | `update(playerPos, elapsed)` | Zone atmosphere targets (fog, light) — we extend with tension-based modulation |
| FalkorDB (via server) | POST `/api/physics/inject` | Batch limbic injections from collision feedback |

---

## MARKERS

<!-- @mind:todo Implement spatial hash grid for collision detection — current brute force won't scale past 100 citizens -->
<!-- @mind:todo Define the C_t WebSocket message format — needs to be added to engine/shared/protocol.js -->
<!-- @mind:proposition Consider SharedArrayBuffer for C_t transfer between main thread and Web Worker -->
<!-- @mind:escalation The 100ms injection batch interval may be too slow for violent collisions — needs latency testing -->
