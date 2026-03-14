# Lumina Prime — Implementation: Code Architecture and Structure

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Lumina_Prime.md
BEHAVIORS:       ./BEHAVIORS_Lumina_Prime.md
PATTERNS:        ./PATTERNS_Lumina_Prime.md
ALGORITHM:       ./ALGORITHM_Lumina_Prime.md
VALIDATION:      ./VALIDATION_Lumina_Prime.md
THIS:            IMPLEMENTATION_Lumina_Prime.md (you are here)
SYNC:            ./SYNC_Lumina_Prime.md

IMPL:            engine/lumina-prime/ (proposed — does not yet exist)
```

> **Contract:** Read docs before modifying. After changes: update IMPL or add TODO to SYNC. Run tests.

---

## CODE STRUCTURE

**Current status: PROPOSED (0% code exists).** The following is the target architecture. All files are TODO.

```
engine/lumina-prime/
├── index.ts                          # Module entry point, exports LuminaPrimeEngine
├── graph/
│   ├── sampler.ts                    # FalkorDB query engine — reads cognitive graph
│   ├── interpolator.ts               # Physics dimension interpolation between ticks
│   └── topology.ts                   # Force-directed layout computation
├── nodes/
│   ├── index.ts                      # Node component registry (maps type → R3F component)
│   ├── MemoryNode.tsx                # R3F component for memory-type nodes
│   ├── ConceptNode.tsx               # R3F component for concept-type nodes
│   ├── NarrativeNode.tsx             # R3F component for narrative-type nodes
│   ├── ValueNode.tsx                 # R3F component for value-type nodes
│   ├── ProcessNode.tsx               # R3F component for process-type nodes
│   ├── DesireNode.tsx                # R3F component for desire-type nodes
│   └── StateNode.tsx                 # R3F component for state-type nodes
├── shaders/
│   ├── common.glsl                   # Shared uniforms and utility functions
│   ├── energy-light.frag             # Energy → luminance + saturation mapping
│   ├── stability-displacement.vert   # Stability → vertex displacement dampening
│   ├── type-sdf.glsl                 # SDF primitives for each node type
│   ├── limbic-post.frag              # Global limbic post-processing (frustration, arousal)
│   └── link-spline.vert              # Link visualization — spline geometry shader
├── navigation/
│   ├── spline.ts                     # Catmull-Rom spline computation from link topology
│   ├── inertia.ts                    # Attentional inertia (Law 13) — direction change gating
│   └── camera.ts                     # Camera controller bound to spline trajectory
├── limbic/
│   ├── state.ts                      # Limbic state aggregation (arousal, valence, frustration, etc.)
│   ├── post-processing.tsx           # R3F EffectComposer integration for limbic effects
│   └── economy.ts                    # $MIND token → limbic modulation (satisfaction, self-preservation)
├── personhood/
│   ├── ladder.ts                     # Personhood Ladder validation (B1-B6)
│   ├── trust-tiers.ts               # Trust tier gating for action_command access
│   └── spec-loader.ts               # JSON Spec parser — single source of truth
├── spaces/
│   ├── self-model.tsx                # Self-model structural space layout
│   ├── partner-model.tsx             # Partner-model structural space layout
│   └── working-memory.tsx            # Working-memory space — Selection Moat filtered
└── __tests__/
    ├── sampler.test.ts               # Graph sampler unit tests
    ├── interpolator.test.ts          # Dimension interpolation tests
    ├── spline.test.ts                # Spline computation tests
    ├── inertia.test.ts               # Attentional inertia tests
    ├── energy-conservation.test.ts   # V4: energy conservation invariant
    ├── selection-moat.test.ts        # V8: Selection Moat consistency
    └── integration/
        ├── graph-to-visual.test.ts   # V1: dimension change → visual change
        └── navigation.test.ts        # V9: topology-constrained navigation
```

### File Responsibilities

| File | Purpose | Key Functions/Classes | Lines | Status |
|------|---------|----------------------|-------|--------|
| `graph/sampler.ts` | Query FalkorDB for visible-region nodes and links | `sampleVisibleRegion()`, `subscribeToTick()` | ~0 | TODO |
| `graph/interpolator.ts` | Smooth dimension values between tick boundaries | `interpolateDimensions()`, `cubicHermite()` | ~0 | TODO |
| `graph/topology.ts` | Compute 3D positions from graph structure | `forceDirectedStep()`, `assignToSpace()` | ~0 | TODO |
| `nodes/index.ts` | Registry mapping node type enum to R3F component | `NodeRegistry`, `resolveComponent()` | ~0 | TODO |
| `nodes/*.tsx` | Individual node type R3F components (7 files) | `<MemoryNode>`, `<ConceptNode>`, etc. | ~0 each | TODO |
| `shaders/common.glsl` | Shared GLSL: uniforms, noise functions, palettes | `u_energy`, `u_stability`, `snoise()` | ~0 | TODO |
| `shaders/energy-light.frag` | Fragment shader: energy → light intensity + saturation | `computeLuminance()`, `computeSaturation()` | ~0 | TODO |
| `shaders/stability-displacement.vert` | Vertex shader: stability → displacement dampening | `computeDisplacement()` | ~0 | TODO |
| `shaders/type-sdf.glsl` | SDF functions for 7 node type geometries | `sdfMemory()`, `sdfConcept()`, etc. | ~0 | TODO |
| `shaders/limbic-post.frag` | Post-processing: frustration red-shift, arousal bloom | `applyFrustration()`, `applyArousal()` | ~0 | TODO |
| `navigation/spline.ts` | Catmull-Rom spline from link control points | `computeSpline()`, `evaluateSpline()` | ~0 | TODO |
| `navigation/inertia.ts` | Attentional inertia gating for direction changes | `checkInertia()`, `computeForce()` | ~0 | TODO |
| `navigation/camera.ts` | Camera bound to spline with speed/fluidity from limbic | `SplineCamera`, `updateCamera()` | ~0 | TODO |
| `limbic/state.ts` | Aggregate limbic dimensions from graph state | `computeLimbicState()`, `LimbicState` | ~0 | TODO |
| `limbic/economy.ts` | $MIND token events → satisfaction/self-preservation | `onTokenTransfer()`, `computeSatisfaction()` | ~0 | TODO |
| `personhood/ladder.ts` | Validate entity against Personhood Ladder B1-B6 | `validatePersonhood()`, `checkCriteria()` | ~0 | TODO |
| `personhood/trust-tiers.ts` | Trust tier resolution and action gating | `resolveTrustTier()`, `gateAction()` | ~0 | TODO |

---

## DESIGN PATTERNS

### Architecture Pattern

**Pattern:** Reactive Pipeline — graph state flows unidirectionally through sampling, interpolation, and rendering stages. R3F's declarative component model means the scene graph is a function of state, re-rendered on every dimension change.

**Why this pattern:** The core contract is "visual = f(graph state)." A reactive pipeline guarantees this — when the graph changes, the pipeline re-evaluates, and the frame updates. No imperative scene management, no manual invalidation, no cache coherence problems.

### Code Patterns in Use

| Pattern | Applied To | Purpose |
|---------|------------|---------|
| Registry | `nodes/index.ts` | Maps node type enum to R3F component — adding a new node type = one file + one registry entry |
| Strategy | `shaders/type-sdf.glsl` | Each node type selects its own SDF function — the shader dispatches by type_id |
| Observer | `graph/sampler.ts` | Subscribes to physics tick events — pulls new dimensions when the tick completes |
| Functional Components | `nodes/*.tsx` | Stateless R3F components that receive physics dimensions as props — pure rendering |
| Interpolation Bridge | `graph/interpolator.ts` | Decouples tick rate (slow, ~5min) from render rate (fast, 60fps) — smooth transitions |

### Anti-Patterns to Avoid

- **Scene Graph Cache**: Do not maintain a separate scene graph that mirrors the cognitive graph. One graph, one truth. The R3F component tree IS the scene graph, and it reads directly from sampled graph state.
- **Imperative Animation**: Do not use `requestAnimationFrame` loops to manually update object properties. Use R3F's `useFrame` hook with dimension-driven uniforms. Animation is a function of physics state, not of time.
- **Magic Constants in Shaders**: Every numeric constant in a GLSL shader must trace back to either (a) a physics dimension uniform or (b) a documented calibration parameter in the config. No unnamed `0.37` multipliers.
- **God Shader**: Do not put all node type rendering in one massive fragment shader with switch/case. Each node type gets its own SDF function in `type-sdf.glsl`, composed with shared utility functions.
- **Premature Abstraction**: Do not create shared base classes for node components until at least 3 types share identical logic. The 7 types are intentionally different.

### Boundaries

| Boundary | Inside | Outside | Interface |
|----------|--------|---------|-----------|
| Graph Boundary | FalkorDB queries, raw Cypher results | Everything else | `sampler.ts: sampleVisibleRegion()` returns typed `CognitiveNode[]` and `CognitiveLink[]` |
| Render Boundary | R3F components, GLSL shaders | Graph logic, physics, economy | Props: physics dimensions as typed objects, limbic state as uniform block |
| Economy Boundary | $MIND token state, Solana RPC | Cognitive graph, rendering | `economy.ts: onTokenTransfer()` produces limbic deltas only |
| Trust Boundary | Personhood validation, trust tier gates | Rendering, navigation | `trust-tiers.ts: gateAction()` returns boolean allow/deny |

---

## SCHEMA

### CognitiveNode (TypeScript interface)

```yaml
CognitiveNode:
  required:
    - id: string                    # FalkorDB node ID
    - type: NodeType                # enum: memory|concept|narrative|value|process|desire|state
    - modality: Modality            # enum: text|visual|biometric
    - dimensions: PhysicsDimensions # 10 float values
  optional:
    - content: string               # Text content (for Sim_lex computation)
    - embedding: Float32Array       # Vector embedding (for Sim_vec computation)
    - action_command: string        # Process nodes only — gated by trust tier
  constraints:
    - stability, recency, self_relevance, partner_relevance, *_affinity: [0, 1]
    - weight, energy: [0, +inf)
    - type is immutable after creation
```

### CognitiveLink (TypeScript interface)

```yaml
CognitiveLink:
  required:
    - source_id: string
    - target_id: string
    - type: LinkType               # enum: 14 link types
    - category: LinkCategory       # enum: semantic|affective|regulatory
    - weight: float
  optional:
    - trust: float [0,1]
    - friction: float [0,1]
    - affinity: float [0,1]
    - aversion: float [0,1]
  relationships:
    - source: CognitiveNode
    - target: CognitiveNode
```

### ShaderUniformBlock

```yaml
ShaderUniformBlock:
  required:
    - u_energy: float
    - u_stability: float
    - u_weight: float
    - u_recency: float
    - u_self_relevance: float
    - u_partner_relevance: float
    - u_novelty_affinity: float
    - u_care_affinity: float
    - u_achievement_affinity: float
    - u_risk_affinity: float
    - u_time: float
    - u_type_id: int
  constraints:
    - All values are interpolated between tick boundaries (never raw tick values mid-frame)
    - u_time is monotonically increasing wall-clock time
```

---

## ENTRY POINTS

| Entry Point | File:Line | Triggered By |
|-------------|-----------|--------------|
| `LuminaPrimeEngine.init()` | `index.ts:TODO` | Application startup — mounts R3F canvas, connects to FalkorDB |
| `sampler.onTick()` | `graph/sampler.ts:TODO` | Physics tick completion — triggers graph re-sampling |
| `economy.onTokenTransfer()` | `limbic/economy.ts:TODO` | Solana WebSocket — $MIND transfer event |
| `camera.onNavigate()` | `navigation/camera.ts:TODO` | User input — initiates spline navigation to target |
| `ladder.onValidate()` | `personhood/ladder.ts:TODO` | Periodic or on-demand — validates entity personhood criteria |

---

## DATA FLOW AND DOCKING (FLOW-BY-FLOW)

### Flow 1: Tick-to-Frame — Physics Dimensions Become Pixels

This is the primary flow. It transforms raw physics dimensions from the cognitive graph into rendered pixels. It is the flow that makes the entire system real.

```yaml
flow:
  name: tick_to_frame
  purpose: Transform cognitive graph state into visual output each render frame
  scope: FalkorDB → GPU frame buffer
  steps:
    - id: step_1_sample
      description: Query FalkorDB for all nodes/links in the visible region
      file: engine/lumina-prime/graph/sampler.ts
      function: sampleVisibleRegion()
      input: camera position + visible radius
      output: CognitiveNode[], CognitiveLink[]
      trigger: physics tick completion event
      side_effects: updates cached node set for interpolator
    - id: step_2_interpolate
      description: Smooth dimension values between previous and current tick values
      file: engine/lumina-prime/graph/interpolator.ts
      function: interpolateDimensions()
      input: prev_dimensions, current_dimensions, frame_t
      output: interpolated PhysicsDimensions per node
      trigger: each render frame (useFrame hook)
      side_effects: none (pure computation)
    - id: step_3_layout
      description: Update force-directed positions for all visible nodes
      file: engine/lumina-prime/graph/topology.ts
      function: forceDirectedStep()
      input: CognitiveNode[], CognitiveLink[]
      output: vec3 position per node
      trigger: each physics tick (coarse) + interpolation per frame (fine)
      side_effects: updates node position state
    - id: step_4_render
      description: R3F components receive interpolated dimensions as props, shaders compute visuals
      file: engine/lumina-prime/nodes/*.tsx + shaders/*.glsl
      function: React render cycle
      input: interpolated PhysicsDimensions, positions, limbic state
      output: GPU draw calls
      trigger: React re-render on prop change
      side_effects: GPU state (frame buffer)
    - id: step_5_postprocess
      description: Limbic post-processing applied to entire frame
      file: engine/lumina-prime/limbic/post-processing.tsx
      function: LimbicPostProcessing component
      input: LimbicState (arousal, frustration, valence)
      output: modified frame buffer
      trigger: every frame after scene render
      side_effects: none (GPU-only)
  docking_points:
    guidance:
      include_when: data transformation, cross-boundary, state mutation
      omit_when: pure pass-through, trivial prop forwarding
      selection_notes: Focus on graph→interpolator boundary (tick vs frame rate mismatch) and interpolator→shader boundary (CPU→GPU handoff)
    available:
      - id: dock_graph_sample
        type: db
        direction: input
        file: engine/lumina-prime/graph/sampler.ts
        function: sampleVisibleRegion()
        trigger: tick event
        payload: CognitiveNode[], CognitiveLink[]
        async_hook: required
        needs: add async hook for FalkorDB query
        notes: Latency-critical — must complete before next frame
      - id: dock_interpolated_dims
        type: custom
        direction: output
        file: engine/lumina-prime/graph/interpolator.ts
        function: interpolateDimensions()
        trigger: useFrame
        payload: PhysicsDimensions per node
        async_hook: not_applicable
        needs: none (synchronous per-frame)
        notes: This is where tick rate meets frame rate
      - id: dock_shader_uniforms
        type: custom
        direction: input
        file: engine/lumina-prime/shaders/*.glsl
        function: uniform block upload
        trigger: React prop change
        payload: ShaderUniformBlock
        async_hook: not_applicable
        needs: none
        notes: CPU→GPU boundary — uniform upload cost
    health_recommended:
      - dock_id: dock_graph_sample
        reason: FalkorDB query latency directly impacts frame budget — must monitor
      - dock_id: dock_interpolated_dims
        reason: Interpolation correctness is V1 invariant — wrong interpolation = wrong visuals
```

### Flow 2: Token Transfer → Limbic Modulation

Economic events from Solana feed into the limbic system, changing the visual character of the entire environment.

```yaml
flow:
  name: token_to_limbic
  purpose: Transform $MIND transfer events into limbic state changes and visual effects
  scope: Solana RPC → limbic state → post-processing
  steps:
    - id: step_1_receive
      description: Solana WebSocket delivers $MIND transfer event
      file: engine/lumina-prime/limbic/economy.ts
      function: onTokenTransfer()
      input: transfer amount, sender, receiver
      output: satisfaction delta, self_preservation update
      trigger: Solana onAccountChange callback
      side_effects: updates limbic state
    - id: step_2_compute
      description: Apply canonical formulas to limbic dimensions
      file: engine/lumina-prime/limbic/economy.ts
      function: computeSatisfaction(), computeSelfPreservation()
      input: amount, daily_budget, current_spend
      output: new satisfaction value, new self_preservation value
      trigger: called by onTokenTransfer
      side_effects: mutates LimbicState
    - id: step_3_visualize
      description: Updated limbic state flows into post-processing
      file: engine/lumina-prime/limbic/post-processing.tsx
      function: LimbicPostProcessing component re-renders
      input: updated LimbicState
      output: gold satisfaction pulse, self_preservation contraction
      trigger: React state change
      side_effects: GPU post-processing
  docking_points:
    available:
      - id: dock_solana_event
        type: event
        direction: input
        file: engine/lumina-prime/limbic/economy.ts
        function: onTokenTransfer()
        trigger: Solana WebSocket
        payload: TransferEvent
        async_hook: required
        needs: add WebSocket listener
        notes: Must validate transfer authenticity before processing
    health_recommended:
      - dock_id: dock_solana_event
        reason: Economic events carry real value — incorrect processing means wrong limbic state
```

---

## LOGIC CHAINS

### LC1: Graph State → Visual Frame

**Purpose:** The primary rendering pipeline — cognitive graph becomes pixels.

```
FalkorDB (cognitive graph)
  → sampler.sampleVisibleRegion()      # Cypher query for visible nodes/links
    → interpolator.interpolateDimensions()  # Smooth between tick values
      → topology.forceDirectedStep()        # Compute 3D positions
        → NodeRegistry.resolveComponent()   # Select R3F component by type
          → <ShaderMaterial uniforms={dims}>  # Upload to GPU
            → GPU fragment shader              # Compute final color per pixel
              → Frame buffer
```

**Data transformation:**
- Input: `FalkorDB graph` — raw Cypher result set
- After sampling: `CognitiveNode[]` — typed, filtered to visible region
- After interpolation: `InterpolatedNode[]` — smooth values between ticks
- After layout: `PositionedNode[]` — 3D coordinates assigned
- After component resolution: `React element tree` — R3F JSX
- Output: `GPU frame buffer` — pixels on screen

### LC2: User Navigation Request → Spline Flight

**Purpose:** Transform a navigation intent into a spline trajectory through the cognitive graph.

```
User input (click target node)
  → camera.onNavigate(target_id)          # Capture intent
    → spline.computeSpline(current, target)  # Build trajectory from link topology
      → inertia.checkInertia(force)           # Gate direction change against Theta_sel
        → camera.updateCamera(spline, speed)   # Bind camera to spline
          → useFrame() advances position        # Per-frame interpolation along spline
```

### LC3: Frustration Escalation → Visual Distress → Help Request

**Purpose:** The failure loop — blocked goals produce visible distress that may trigger escalation.

```
Personhood validation failure (B3)
  → limbic.state.frustration += delta       # Law 16: failure feeds frustration
    → post-processing: red-shift, jitter     # Visual distress (B4)
      → Selection Moat drops (Theta_sel -= 1.0 * frustration)  # More nodes flood WM
        → Tick Loop (Law 12) accumulates frustration over ticks
          → IF frustration > escalation_threshold:
              → system emits help request         # Breaks inertia, asks for external input
```

---

## MODULE DEPENDENCIES

### Internal Dependencies

```
index.ts (entry point)
    └── imports → graph/sampler.ts
    └── imports → graph/interpolator.ts
    └── imports → graph/topology.ts
    └── imports → nodes/index.ts
        └── imports → nodes/MemoryNode.tsx
        └── imports → nodes/ConceptNode.tsx
        └── imports → nodes/NarrativeNode.tsx
        └── imports → nodes/ValueNode.tsx
        └── imports → nodes/ProcessNode.tsx
        └── imports → nodes/DesireNode.tsx
        └── imports → nodes/StateNode.tsx
    └── imports → navigation/spline.ts
    └── imports → navigation/inertia.ts
    └── imports → navigation/camera.ts
    └── imports → limbic/state.ts
    └── imports → limbic/economy.ts
    └── imports → limbic/post-processing.tsx
    └── imports → personhood/ladder.ts
    └── imports → personhood/trust-tiers.ts
    └── imports → personhood/spec-loader.ts
    └── imports → spaces/self-model.tsx
    └── imports → spaces/partner-model.tsx
    └── imports → spaces/working-memory.tsx
```

### External Dependencies

| Package | Used For | Imported By |
|---------|----------|-------------|
| `@react-three/fiber` | Declarative 3D rendering, React reconciler for Three.js | `nodes/*.tsx`, `spaces/*.tsx`, `limbic/post-processing.tsx` |
| `@react-three/drei` | Helper components (OrbitControls, Line, etc.) | `navigation/camera.ts`, `nodes/*.tsx` |
| `@react-three/postprocessing` | EffectComposer, custom post-processing passes | `limbic/post-processing.tsx` |
| `three` | Three.js core — Vector3, CatmullRomCurve3, ShaderMaterial | `navigation/spline.ts`, `shaders/*` |
| `falkordb` | FalkorDB client — Cypher queries, subscriptions | `graph/sampler.ts` |
| `@solana/web3.js` | Solana RPC, WebSocket subscriptions, Token-2022 | `limbic/economy.ts` |
| `glsl-noise` | Simplex/Perlin noise for procedural textures | `shaders/common.glsl` |

---

## STATE MANAGEMENT

### Where State Lives

| State | Location | Scope | Lifecycle |
|-------|----------|-------|-----------|
| Sampled graph nodes | `graph/sampler.ts: nodeCache` | Module | Created on first tick, updated each tick, cleared on disconnect |
| Interpolated dimensions | `graph/interpolator.ts: interpolationState` | Module | Recomputed each frame, reset on tick |
| Force-directed positions | `graph/topology.ts: positionMap` | Module | Updated incrementally each tick, persists across session |
| Limbic state | `limbic/state.ts: limbicState` | Global (React context) | Created on init, updated by physics tick and economy events |
| Spline trajectory | `navigation/spline.ts: activeSpline` | Module | Created on navigation request, cleared on arrival |
| Trust tier cache | `personhood/trust-tiers.ts: tierCache` | Module | Loaded from JSON Spec on init, invalidated on spec change |

### State Transitions

```
DISCONNECTED ──init()──▶ SAMPLING ──firstTick──▶ RENDERING ──navigate()──▶ FLYING
     ▲                                                         │
     └────────────────────disconnect()─────────────────────────┘
```

---

## RUNTIME BEHAVIOR

### Initialization

```
1. Mount R3F Canvas with WebGL2 context
2. Connect to FalkorDB instance
3. Load JSON Spec for Personhood Ladder
4. Connect to Solana RPC WebSocket
5. Sample initial graph state (first query)
6. Compute initial force-directed layout (may take 1-2 seconds for large graphs)
7. Begin render loop — first frame shows the cognitive landscape
```

### Main Loop / Request Cycle

```
Per physics tick (~every few minutes, configured by physics engine):
1. sampler.sampleVisibleRegion() → fresh node/link data from FalkorDB
2. interpolator.resetInterpolation(prev, current) → prepare for smooth transitions
3. topology.forceDirectedStep() → update positions
4. limbic.state.update() → aggregate new limbic dimensions

Per render frame (60fps):
1. interpolator.interpolateDimensions(frame_t) → smooth values
2. R3F re-renders all node components with new interpolated props
3. Shader uniforms uploaded to GPU
4. Post-processing applies limbic effects
5. Frame buffer presented
```

### Shutdown

```
1. Disconnect Solana WebSocket
2. Disconnect FalkorDB
3. Dispose all Three.js geometries and materials
4. Unmount R3F Canvas
```

---

## CONCURRENCY MODEL

| Component | Model | Notes |
|-----------|-------|-------|
| Graph sampling | Async (Promise) | FalkorDB queries are async; must complete before interpolation can reset |
| Dimension interpolation | Sync (per-frame) | Runs in `useFrame` — must be fast, no async |
| Force-directed layout | Sync (per-tick) | Runs once per tick, not per frame; may use Web Worker if >500 nodes |
| Shader execution | GPU parallel | All nodes rendered in parallel by GPU |
| Solana events | Async (WebSocket callback) | Token transfer events arrive asynchronously; queued for next tick |
| Personhood validation | Async (on-demand) | Triggered by specific events, not on every tick |

---

## CONFIGURATION

| Config | Location | Default | Description |
|--------|----------|---------|-------------|
| `FALKORDB_URL` | env | `redis://localhost:6379` | FalkorDB connection string |
| `SOLANA_RPC_URL` | env | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint |
| `MIND_TOKEN_MINT` | env | (required) | $MIND Token-2022 mint address |
| `NAVIGATION_BASE_SPEED` | config | `1.0` | Base spline navigation speed |
| `INTERPOLATION_MODE` | config | `cubic_hermite` | Dimension interpolation method |
| `VISIBLE_RADIUS` | config | `50.0` | Radius around camera for graph sampling |
| `FORCE_LAYOUT_DAMPING` | config | `0.95` | Force-directed layout damping factor |
| `COLD_THRESHOLD` | config | `0.1` | Energy below which a node is "cold" for Floor channel |
| `CRYSTALLIZATION_THRESHOLD` | config | `0.7` | Minimum co-activation energy for Law 10 |
| `THETA_BASE_WM` | config | `0.5` | Base Selection Moat threshold |
| `SATISFACTION_LOG_SCALE` | config | `0.1` | Multiplier for log10(amount) in satisfaction formula |
| `TRANSFER_FEE_RATE` | config | `0.01` | $MIND transfer fee (1%) — protocol invariant, do not change |
| `LP_LOCK_UNTIL` | config | `2027-01-01` | LP lock date — protocol invariant, do not change |

---

## BIDIRECTIONAL LINKS

### Code → Docs

No code exists yet. When implementation begins, each source file should reference:

```
// DOCS: docs/architecture/lumina-prime/IMPLEMENTATION_Lumina_Prime.md
```

### Docs → Code

| Doc Section | Implemented In |
|-------------|----------------|
| ALGORITHM: Herfindahl Injection Split | `graph/sampler.ts` (TODO) |
| ALGORITHM: Surplus Spill-Over | `graph/sampler.ts` (TODO — reads physics output, does not compute) |
| ALGORITHM: Selection Moat | `spaces/working-memory.tsx` (TODO) |
| ALGORITHM: Composite Coherence | `graph/sampler.ts` (TODO — used for relevance scoring) |
| ALGORITHM: Spline Trajectory | `navigation/spline.ts` (TODO) |
| ALGORITHM: Procedural Geometry | `shaders/type-sdf.glsl` + `nodes/*.tsx` (TODO) |
| BEHAVIOR B1 | `shaders/energy-light.frag` (TODO) |
| BEHAVIOR B2 | `nodes/DesireNode.tsx` (TODO) |
| BEHAVIOR B3 | `nodes/NarrativeNode.tsx` (TODO) |
| BEHAVIOR B4 | `limbic/post-processing.tsx` (TODO) |
| BEHAVIOR B5 | `navigation/spline.ts` + `navigation/camera.ts` (TODO) |
| BEHAVIOR B6 | `limbic/economy.ts` (TODO) |
| VALIDATION V1 | `__tests__/integration/graph-to-visual.test.ts` (TODO) |
| VALIDATION V4 | `__tests__/energy-conservation.test.ts` (TODO) |
| VALIDATION V8 | `__tests__/selection-moat.test.ts` (TODO) |

---

## EXTRACTION CANDIDATES

No code exists yet. This section will be populated as files approach WATCH/SPLIT thresholds during implementation.

---

## MARKERS

<!-- @mind:todo Scaffold the engine/lumina-prime/ directory structure and package.json -->
<!-- @mind:todo Implement graph/sampler.ts as the first file — it unblocks all visual work -->
<!-- @mind:todo Write shaders/common.glsl with the 10-uniform block — shared by all node types -->
<!-- @mind:proposition Consider monorepo workspace structure if lumina-prime becomes its own package -->
<!-- @mind:escalation R3F version: pin to a specific version that supports custom shader materials well — needs evaluation -->
<!-- @mind:escalation FalkorDB client library for TypeScript — evaluate falkordb-ts vs raw Redis commands -->
