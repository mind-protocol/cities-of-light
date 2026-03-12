# Citizens/Embodiment — Algorithm: Rendering 152 Citizens on Quest 3

```
STATUS: DRAFT
CREATED: 2026-03-11
VERIFIED: Not yet implemented
```

---

## CHAIN

```
OBJECTIVES:      ../../../docs/01_OBJECTIFS_Venezia.md
BEHAVIORS:       ./BEHAVIORS_Embodiment.md
PATTERNS:        ./PATTERNS_Embodiment.md
THIS:            ALGORITHM_Embodiment.md (you are here)
SYNC:            ./SYNC_Embodiment.md

IMPL:            src/client/citizens/citizen-avatar.js (planned)
                 src/client/citizens/citizen-manager.js (planned)
```

---

## OVERVIEW

The embodiment system runs every frame on the client. It manages which citizens are visible, at what level of detail, in what animation state, and disposes of resources for citizens no longer in range. The system is designed around a strict triangle and memory budget (500K triangles visible, 2GB total memory, 72fps minimum on Quest 3).

---

## DATA STRUCTURES

### CitizenConfig (static, loaded once from server)

```
CitizenConfig {
  id:            string           // Airtable citizen ID
  firstName:     string
  lastName:      string
  gender:        "male" | "female"
  ageGroup:      "young" | "middle" | "elder"
  socialClass:   "Nobili" | "Cittadini" | "Popolani" | "Facchini" | "Forestieri"
  baseMeshId:    string           // e.g., "male_middle_01"
  clothingId:    string           // e.g., "nobili_male_robe_02"
  colorPrimary:  number           // hex, e.g., 0x8B0000 (crimson)
  colorSecondary:number           // hex
  faceAtlasUV:   { u, v, w, h }  // position in shared face texture atlas
  heightScale:   number           // 0.9 - 1.1 (parametric variation)
  buildScale:    number           // 0.85 - 1.15
  walkSpeedMult: number           // 0.85 - 1.15
  animPhaseOffset: number         // 0.0 - 1.0 (random, prevents sync)
}
```

### CitizenState (dynamic, updated from server every 3s)

```
CitizenState {
  id:            string
  position:      { x, y, z }
  heading:       number           // radians, facing direction
  mood:          string           // "happy" | "sad" | "angry" | "fearful" | "desperate" | "content" | "anxious" | "nostalgic" | "ecstatic" | "furious"
  moodValence:   number           // -1.0 (desperate) to +1.0 (ecstatic)
  moodArousal:   number           // 0.0 (calm) to 1.0 (agitated)
  activity:      string           // "idle" | "walking" | "working" | "eating" | "socializing" | "resting" | "praying"
  talkingTo:     string | null    // citizen ID or "visitor"
  isAlive:       boolean
  isOutdoors:    boolean
}
```

### CitizenRenderState (per-citizen, managed by client)

```
CitizenRenderState {
  id:            string
  tier:          "FULL" | "ACTIVE" | "AMBIENT" | "HIDDEN"
  prevTier:      "FULL" | "ACTIVE" | "AMBIENT" | "HIDDEN"
  transitionT:   number           // 0.0 (start) to 1.0 (complete)
  meshFull:      THREE.Group | null
  meshActive:    THREE.Group | null
  meshAmbient:   THREE.Mesh | null  // instanced reference
  animState:     string           // current animation state name
  animTime:      number           // elapsed in current animation
  spineOffset:   number           // -0.15 (hunched) to +0.05 (upright) — mood-driven
  headLookAt:    THREE.Vector3 | null // conversation target
  lastVisible:   number           // timestamp of last frame rendered
}
```

### MeshLibrary (singleton, loaded at startup)

```
MeshLibrary {
  baseBodies: Map<string, {
    geometry:    THREE.BufferGeometry  // shared, not cloned
    skeleton:    THREE.Skeleton
    animations:  Map<string, THREE.AnimationClip>
  }>
  clothing: Map<string, {
    geometry:    THREE.BufferGeometry
    // Clothing attaches to skeleton — same bone structure as base body
  }>
  classAtlases: Map<string, THREE.Texture>  // one texture atlas per social class
  faceAtlas:    THREE.Texture               // all 152 faces in one 4096x4096 atlas
  ambientGeo:   THREE.BufferGeometry        // single low-poly capsule for instancing
}
```

---

## ALGORITHM: Tier Assignment

Runs every frame for all citizens with known positions. This is the core LOD decision.

### Step 1: Compute Distance and Relationship Score

```
FOR each citizen C with state S:
  distance = length(S.position - visitor.position)

  // Relationship bonus: known citizens stay at higher tier longer
  relationship = getTrustScore(C.id, visitor.id)  // 0.0 - 1.0
  activityPriority = getActivityPriority(S.activity)  // 0.0 - 1.0

  // Effective distance: closer = lower value = higher tier
  effectiveDistance = distance - (relationship * 5) - (activityPriority * 3)
  // A citizen you know well "feels" 5m closer
  // A citizen doing something important "feels" 3m closer
```

### Step 2: Assign Tier with Hysteresis

```
  currentTier = C.renderState.tier

  IF effectiveDistance < 20:
    desiredTier = FULL
  ELSE IF effectiveDistance < 80:
    desiredTier = ACTIVE
  ELSE IF effectiveDistance < 200:
    desiredTier = AMBIENT
  ELSE:
    desiredTier = HIDDEN

  // Hysteresis: upgrading uses normal thresholds, downgrading uses wider thresholds
  IF desiredTier < currentTier:  // closer, upgrading
    newTier = desiredTier
  ELSE IF desiredTier > currentTier:  // further, downgrading
    // Apply hysteresis band: 5m for FULL->ACTIVE, 5m for ACTIVE->AMBIENT
    IF currentTier == FULL AND effectiveDistance < 25:
      newTier = FULL  // stay FULL until 25m
    ELSE IF currentTier == ACTIVE AND effectiveDistance < 85:
      newTier = ACTIVE  // stay ACTIVE until 85m
    ELSE:
      newTier = desiredTier
  ELSE:
    newTier = currentTier

  // Conversation lock: never downgrade mid-conversation
  IF C.state.talkingTo == "visitor" AND newTier > FULL:
    newTier = FULL
```

### Step 3: Enforce Budget Caps

```
  // Count current tier assignments
  fullCount  = count(citizens WHERE tier == FULL)
  activeCount = count(citizens WHERE tier == ACTIVE)

  // Cap enforcement: if at FULL limit, only upgrade if citizen is closer than the furthest FULL
  IF newTier == FULL AND fullCount >= MAX_FULL (20):
    furthestFull = citizen in FULL tier with highest effectiveDistance
    IF effectiveDistance < furthestFull.effectiveDistance:
      // Swap: downgrade furthest, upgrade this one
      furthestFull.renderState.tier = ACTIVE
      newTier = FULL
    ELSE:
      newTier = ACTIVE  // denied upgrade

  IF newTier == ACTIVE AND activeCount >= MAX_ACTIVE (60):
    newTier = AMBIENT  // denied upgrade

  C.renderState.tier = newTier
```

---

## ALGORITHM: Mesh Management (create/swap/dispose)

Runs after tier assignment. Handles mesh creation for new tiers and disposal for old ones.

### Step 1: Tier Changed — Initiate Transition

```
IF C.renderState.tier != C.renderState.prevTier:
  C.renderState.transitionT = 0.0

  // Create new mesh for target tier (if not already cached)
  SWITCH C.renderState.tier:
    FULL:
      IF C.renderState.meshFull == null:
        C.renderState.meshFull = createFullMesh(C.config)
        scene.add(C.renderState.meshFull)
      C.renderState.meshFull.visible = true
      C.renderState.meshFull.material.opacity = 0.0  // fade in

    ACTIVE:
      IF C.renderState.meshActive == null:
        C.renderState.meshActive = createActiveMesh(C.config)
        scene.add(C.renderState.meshActive)
      C.renderState.meshActive.visible = true
      C.renderState.meshActive.material.opacity = 0.0

    AMBIENT:
      // Ambient uses instanced mesh — set instance matrix
      setAmbientInstance(C.id, C.state.position, C.config.colorPrimary)

    HIDDEN:
      // Will be cleaned up in step 3
      pass
```

### Step 2: Animate Transition (per-frame)

```
IF C.renderState.transitionT < 1.0:
  C.renderState.transitionT += deltaTime / TRANSITION_DURATION
  // TRANSITION_DURATION: 0.5s for AMBIENT->ACTIVE, 0.3s for ACTIVE->FULL
  t = smoothstep(0, 1, C.renderState.transitionT)

  // Fade in new tier mesh
  IF C.renderState.tier == FULL AND C.renderState.meshFull:
    C.renderState.meshFull.material.opacity = t
  IF C.renderState.tier == ACTIVE AND C.renderState.meshActive:
    C.renderState.meshActive.material.opacity = t

  // Fade out old tier mesh
  IF C.renderState.prevTier == FULL AND C.renderState.meshFull:
    C.renderState.meshFull.material.opacity = 1.0 - t
  IF C.renderState.prevTier == ACTIVE AND C.renderState.meshActive:
    C.renderState.meshActive.material.opacity = 1.0 - t
  IF C.renderState.prevTier == AMBIENT:
    setAmbientInstanceOpacity(C.id, 1.0 - t)

  IF C.renderState.transitionT >= 1.0:
    C.renderState.prevTier = C.renderState.tier
    // Transition complete
```

### Step 3: Dispose Unused Meshes

```
// Dispose meshes for tiers no longer active
// Use a delay: only dispose if unused for > 5 seconds (prevents thrashing at tier boundaries)

IF C.renderState.tier != FULL AND C.renderState.meshFull != null:
  IF timeSince(C.renderState.lastFullUse) > 5.0:
    scene.remove(C.renderState.meshFull)
    disposeMesh(C.renderState.meshFull)  // geometry stays in library, dispose material clone + textures
    C.renderState.meshFull = null

IF C.renderState.tier != ACTIVE AND C.renderState.meshActive != null:
  IF timeSince(C.renderState.lastActiveUse) > 5.0:
    scene.remove(C.renderState.meshActive)
    disposeMesh(C.renderState.meshActive)
    C.renderState.meshActive = null

IF C.renderState.tier == HIDDEN:
  removeAmbientInstance(C.id)
  // Also dispose FULL and ACTIVE if cached
```

---

## ALGORITHM: Animation State Machine

Runs every frame for FULL and ACTIVE tier citizens. Drives skeletal animation for FULL, posture offset for ACTIVE.

### Animation States

```
States:
  idle          — standing still, weight shifting, breathing
  walking       — locomotion cycle, speed from mood arousal
  working       — occupation loop (class-dependent)
  eating        — seated, hand gesture loop
  socializing   — standing, gesticulating, head turns
  resting       — seated/leaning, minimal motion
  praying       — kneeling or standing, hands together
  talking       — conversation with visitor, attentive pose, gestures
  distressed    — sitting on ground, head in hands, or pacing
```

### State Transition Rules

```
FUNCTION updateAnimState(citizen, deltaTime):
  target = mapActivityToAnim(citizen.state.activity, citizen.state.mood)

  // Override: if talking to visitor, force "talking" state
  IF citizen.state.talkingTo == "visitor":
    target = "talking"

  // Override: desperate mood forces distressed regardless of activity
  IF citizen.state.mood == "desperate" AND citizen.state.activity != "walking":
    target = "distressed"

  IF target != citizen.renderState.animState:
    // Blend from current to target over 0.4 seconds
    startAnimBlend(citizen, citizen.renderState.animState, target, 0.4)
    citizen.renderState.animState = target

  // Apply animation with phase offset (prevents synchronization)
  citizen.renderState.animTime += deltaTime * citizen.config.walkSpeedMult
  elapsed = citizen.renderState.animTime + citizen.config.animPhaseOffset * clipDuration
  sampleAnimation(citizen, elapsed)
```

### Mood-to-Posture Mapping (ACTIVE tier)

```
FUNCTION computePostureOffset(moodValence, moodArousal):
  // Spine curve: negative valence = hunched, positive = upright
  spineOffset = moodValence * 0.15  // range: -0.15 to +0.15 radians

  // Movement speed multiplier
  speedMult = 0.8 + moodArousal * 0.4  // range: 0.8 (calm) to 1.2 (agitated)

  // Head droop: sad/desperate = head down
  headPitch = IF moodValence < -0.3 THEN moodValence * 0.2 ELSE 0.0

  RETURN { spineOffset, speedMult, headPitch }
```

---

## ALGORITHM: Avatar Generation Pipeline (Build Time)

Not real-time. Runs once to produce the asset library.

### Step 1: Face Atlas Generation

```
FOR each citizen C in CITIZENS (152):
  prompt = buildFacePrompt(C)
  // Example: "Portrait of a 45-year-old Venetian nobleman, Renaissance oil painting style,
  //           stern expression, dark eyes, trimmed beard, wearing red beretta,
  //           neutral background, square crop, 256x256"

  faceImage = stableDiffusion.generate(prompt, size=256)
  // Place in atlas grid (14 columns x 14 rows = 196 slots in 4096x4096 atlas)
  atlasPosition = { u: (C.index % 14) * 256, v: floor(C.index / 14) * 256 }
  blitToAtlas(faceImage, faceAtlas, atlasPosition)
  C.config.faceAtlasUV = normalizeToUV(atlasPosition, 4096)
```

### Step 2: Citizen Config Generation

```
FOR each citizen C:
  // Base mesh: selected by gender + age group
  C.config.baseMeshId = selectBaseMesh(C.gender, C.ageGroup)

  // Clothing: selected by class + gender + personality variation
  C.config.clothingId = selectClothing(C.socialClass, C.gender, C.personalityHash)

  // Colors: class palette + individual variation
  palette = CLASS_PALETTES[C.socialClass]
  C.config.colorPrimary = palette.primary + hashVariation(C.id, 0x101010)
  C.config.colorSecondary = palette.secondary + hashVariation(C.id, 0x080808)

  // Parametric variation
  C.config.heightScale = 0.9 + hash(C.id, "height") * 0.2
  C.config.buildScale = 0.85 + hash(C.id, "build") * 0.3
  C.config.walkSpeedMult = 0.85 + hash(C.id, "speed") * 0.3
  C.config.animPhaseOffset = hash(C.id, "phase")
```

### Step 3: Mesh Library Authoring

```
Base body meshes needed (authored in Blender, exported as glTF):
  male_young_01     ~2000 tris, T-pose, 25-bone skeleton
  male_young_02     variant build
  male_middle_01    ~2000 tris
  male_elder_01     ~1800 tris, slightly hunched bind pose
  female_young_01   ~2000 tris
  female_middle_01  ~2000 tris
  female_elder_01   ~1800 tris

Clothing overlay meshes (same skeleton, worn over body):
  nobili_male_robe_01       ~1500 tris (long toga with sleeves)
  nobili_male_robe_02       variant
  nobili_female_gown_01     ~1500 tris
  cittadini_male_coat_01    ~1000 tris (knee-length)
  cittadini_female_dress_01 ~1000 tris
  popolani_male_tunic_01    ~600 tris (simple)
  popolani_female_tunic_01  ~600 tris
  facchini_male_work_01     ~500 tris (minimal)
  facchini_female_work_01   ~500 tris
  forestieri_ottoman_01     ~800 tris (turban + robe)
  forestieri_germanic_01    ~800 tris (doublet)
  forestieri_moorish_01     ~800 tris

LOD variants:
  ACTIVE tier: each mesh at 30% triangle count (auto-decimated or hand-authored)
  AMBIENT tier: single capsule (50 tris), colored by class primary
```

---

## ALGORITHM: AMBIENT Tier Instancing

Uses THREE.InstancedMesh to render 100+ ambient citizens in a single draw call.

```
// Setup (once)
ambientMesh = new THREE.InstancedMesh(
  capsuleGeometry,        // 50 tris: cylinder + hemisphere caps
  ambientMaterial,        // vertex color enabled, no texture
  MAX_AMBIENT_INSTANCES   // 150
)
ambientMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
scene.add(ambientMesh)

// Per-frame update
instanceIndex = 0
FOR each citizen C WHERE C.renderState.tier == AMBIENT:
  matrix = new Matrix4()
  matrix.makeTranslation(C.state.position.x, C.state.position.y, C.state.position.z)
  matrix.scale(C.config.heightScale, C.config.heightScale, 1.0)

  ambientMesh.setMatrixAt(instanceIndex, matrix)
  ambientMesh.setColorAt(instanceIndex, new Color(C.config.colorPrimary))
  instanceIndex++

ambientMesh.count = instanceIndex
ambientMesh.instanceMatrix.needsUpdate = true
ambientMesh.instanceColor.needsUpdate = true

// Result: 100 ambient citizens = 1 draw call, ~5000 tris total
```

---

## ALGORITHM: Memory Management

### Disposal Protocol

```
FUNCTION disposeMesh(group):
  FOR each child in group.children (recursive):
    IF child.geometry AND child.geometry is NOT in MeshLibrary.shared:
      child.geometry.dispose()
    IF child.material:
      IF child.material.map AND child.material.map is NOT shared atlas:
        child.material.map.dispose()
      child.material.dispose()
  // Do NOT dispose shared geometries or atlas textures
  // Those persist in MeshLibrary for the session lifetime
```

### Memory Budget Monitoring

```
EVERY 10 SECONDS:
  heapUsed = performance.memory.usedJSHeapSize  // Chrome/Quest only
  textureMemory = estimateTextureMemory()
  geometryMemory = estimateGeometryMemory()

  IF heapUsed > 1.5GB:
    // Aggressive disposal: reduce FULL tier cache
    FOR each citizen NOT in FULL tier:
      IF citizen.renderState.meshFull != null:
        disposeMesh(citizen.renderState.meshFull)
        citizen.renderState.meshFull = null

  IF heapUsed > 1.8GB:
    // Emergency: reduce ACTIVE tier cache too
    FOR each citizen NOT in ACTIVE tier:
      IF citizen.renderState.meshActive != null:
        disposeMesh(citizen.renderState.meshActive)
        citizen.renderState.meshActive = null
    // Reduce MAX_FULL from 20 to 10
    // Reduce MAX_ACTIVE from 60 to 30
    console.warn("Memory pressure: reduced citizen quality")
```

---

## DATA FLOW

```
Server (every 3s)
  ↓ WebSocket: citizen_update { id, position, mood, activity }
Client: updateCitizenState(id, newState)
  ↓
Tier Assignment (every frame)
  ↓ assigns: FULL | ACTIVE | AMBIENT | HIDDEN
Mesh Management
  ↓ creates/swaps/disposes meshes per tier
Animation Update (every frame)
  ↓ samples animation, applies posture offset
Position Update (every frame, lerped)
  ↓ citizen.mesh.position = lerp(current, target, 0.1)
Three.js Render
  ↓ draw calls: FULL (individual) + ACTIVE (individual) + AMBIENT (instanced)
GPU → Screen
```

---

## COMPLEXITY

**Time:** O(N) per frame where N = number of citizens with known positions (max 152). Tier assignment is a single pass. Animation sampling is O(1) per citizen per frame (skeletal evaluation).

**Space:** O(N * T) where T = mesh memory per tier. Worst case: all 152 loaded = ~50MB geometry + ~32MB textures (face atlas + class atlases). Typical: ~20MB active.

**Bottlenecks:**
- Skeletal animation for 20 FULL citizens is the main CPU cost. Mitigate: `THREE.AnimationMixer` with shared clips, not cloned.
- Instanced mesh color update for AMBIENT tier triggers buffer upload each frame. Mitigate: only update dirty instances (position changed).
- Mesh creation stall when many citizens transition tier simultaneously. Mitigate: stagger transitions — max 3 tier upgrades per frame.

---

## HELPER FUNCTIONS

### `createFullMesh(config)`

**Purpose:** Build the FULL-tier Three.js Group for a citizen.

**Logic:** Clone skeleton from base body in MeshLibrary. Create SkinnedMesh with base body geometry (shared) and unique material (cloned, with face atlas UV and class colors). Attach clothing SkinnedMesh with same skeleton. Set up AnimationMixer. Apply heightScale and buildScale. Return Group containing body + clothing + mixer reference.

### `createActiveMesh(config)`

**Purpose:** Build the ACTIVE-tier Three.js Group.

**Logic:** Use decimated geometry from MeshLibrary. Single SkinnedMesh (body + clothing merged into one mesh at lower LOD). Simpler material (vertex color + flat class color, no face texture). No AnimationMixer — posture is applied via bone transforms directly (cheaper than animation sampling).

### `mapActivityToAnim(activity, mood)`

**Purpose:** Convert citizen activity + mood to animation state name.

**Logic:** Direct mapping with mood overrides. `walking` + `sad` = `walking_slow`. `idle` + `angry` = `idle_agitated`. `working` + any mood = `working` (work doesn't change with mood). Returns string matching animation clip name.

### `smoothstep(edge0, edge1, x)`

**Purpose:** Standard smoothstep for transition easing.

**Logic:** `t = clamp((x - edge0) / (edge1 - edge0), 0, 1); return t * t * (3 - 2 * t);`

---

## INTERACTIONS

| Module | What We Call | What We Get |
|--------|--------------|-------------|
| `citizens/population` | `getTierAssignment(citizenId)` | Tier override if population manager has opinion |
| `economy/sync` | `getCitizenState(citizenId)` | Position, mood, activity, class |
| `voice/pipeline` | `getVisemeData(citizenId)` | Current viseme for lip sync (FULL tier only) |
| `infra/performance` | `getTriangleBudget()` | Remaining triangle budget after architecture |
| `world/atmosphere` | `getLightAtPosition(pos)` | Light color/intensity for material ambient (night scenes) |
