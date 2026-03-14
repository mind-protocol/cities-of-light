# Active Inference Motor Control — Implementation: Code Architecture and Structure

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Motor_Control.md
BEHAVIORS:       ./BEHAVIORS_Motor_Control.md
PATTERNS:        ./PATTERNS_Motor_Control.md
ALGORITHM:       ./ALGORITHM_Motor_Control.md
VALIDATION:      ./VALIDATION_Motor_Control.md
THIS:            IMPLEMENTATION_Motor_Control.md (you are here)
SYNC:            ./SYNC_Motor_Control.md

IMPL:            .mind/runtime/physics/motor_control.py (TODO — does not exist yet)
```

> **Contract:** Read docs before modifying. After changes: update IMPL or add TODO to SYNC. Run tests.

---

## STATUS: PROPOSED — NO CODE EXISTS YET

This module is fully specified but entirely unimplemented. All file paths, functions, and classes below are proposed locations and interfaces. Nothing has been written. Every item is marked TODO.

---

## CODE STRUCTURE

```
.mind/runtime/physics/
├── motor_control.py              # TODO — Core motor tick loop and active inference pipeline
├── proprioceptive_subgraph.py    # TODO — Synthetic cerebellum: state:functional node management
├── composite_coherence.py        # TODO — Multimodal coherence calculation (Sim_vec, Sim_lex, Delta_affect)
├── frustration.py                # TODO — Frustration gradient, deadlock detection, bifurcation
├── motor_consolidation.py        # TODO — Law 6 application to motor trajectories (Medium Tick)
└── sensory_encoders/
    ├── visual_encoder.py         # TODO — SigLIP/CLIP visual encoding with symbolic fallback
    ├── spatial_encoder.py        # TODO — XYZ coordinate encoding for proprioceptive nodes
    └── biometric_encoder.py      # TODO — Garmin HRV/stress to limbic state translation

src/server/
├── motor-bridge.js               # TODO — Bridge between physics engine (Python) and 3D world (JS)
├── collision-feedback.js          # TODO — Collision event capture and Law 1 injection routing
└── action-executor.js             # TODO — Translates ActionCommand objects into Lumina Prime API calls

tests/
├── test_motor_tick.py             # TODO — Unit tests for the motor tick pipeline
├── test_composite_coherence.py    # TODO — Tests for coherence calculation with known inputs
├── test_frustration_gradient.py   # TODO — Tests for deadlock detection and bifurcation
├── test_energy_conservation.py    # TODO — Invariant V1: energy in == energy out across propagation
└── test_motor_consolidation.py    # TODO — Tests for Law 6 trajectory reinforcement
```

### File Responsibilities

| File | Purpose | Key Functions/Classes | Lines | Status |
|------|---------|----------------------|-------|--------|
| `motor_control.py` | Main motor tick loop — orchestrates the 4-step pipeline | `motor_tick()`, `MotorController` | TODO | TODO |
| `proprioceptive_subgraph.py` | Manages state:functional nodes (position, velocity, joints) | `ProprioceptiveSubgraph`, `update_state()`, `inject_collision()` | TODO | TODO |
| `composite_coherence.py` | Computes 3-component coherence and prediction error | `composite_coherence()`, `lexical_match()`, `affect_delta()` | TODO | TODO |
| `frustration.py` | Frustration accumulation, Theta_sel reduction, bifurcation | `FrustrationState`, `frustration_tick()`, `check_bifurcation()` | TODO | TODO |
| `motor_consolidation.py` | Medium Tick hook for Law 6 trajectory reinforcement | `consolidation_hook()`, `evaluate_outcome()` | TODO | TODO |
| `visual_encoder.py` | SigLIP/CLIP encoding with Law 8 symbolic fallback | `encode_visual()`, `symbolic_fallback()` | TODO | TODO |
| `spatial_encoder.py` | XYZ coordinate encoding for proprioceptive injection | `encode_spatial()` | TODO | TODO |
| `biometric_encoder.py` | Garmin HRV/stress to limbic modulation coefficients | `encode_biometric()` | TODO | TODO |
| `motor-bridge.js` | Python-to-JS bridge for physics engine to 3D world | `MotorBridge`, `sendCommand()`, `receiveCollision()` | TODO | TODO |
| `collision-feedback.js` | Captures Three.js collision events, routes to physics | `CollisionListener`, `injectCollision()` | TODO | TODO |
| `action-executor.js` | Translates action commands to skeletal animation calls | `executeAction()`, `ActionCommandParser` | TODO | TODO |

---

## DESIGN PATTERNS

### Architecture Pattern

**Pattern:** Event-Driven Pipeline with Physics Coupling

**Why this pattern:** The motor control loop is a pipeline (encode -> cohere -> propagate -> fire) that runs synchronously on each Fast Tick, but the inputs arrive asynchronously (visual frames, collision events, biometric data). The pipeline consumes whatever is available at tick time and produces action commands that are dispatched as events. This decouples the tick rate from sensor rates — if a camera frame arrives late, the tick uses the previous frame and continues.

### Code Patterns in Use

| Pattern | Applied To | Purpose |
|---------|------------|---------|
| Pipeline | `motor_control.py:motor_tick()` | 4-stage sequential processing with clear stage boundaries |
| State Machine | `frustration.py:FrustrationState` | Tracks frustration phases (calm -> impatient -> frustrated -> bifurcating) |
| Observer | `collision-feedback.js:CollisionListener` | Three.js collision events trigger Law 1 injection without polling |
| Strategy | `visual_encoder.py` | SigLIP/CLIP as primary strategy, symbolic fallback as secondary — selected by confidence threshold |
| Bridge | `motor-bridge.js` | Crosses the Python (physics) / JavaScript (3D) boundary via process communication |

### Anti-Patterns to Avoid

- **LLM-in-the-Loop:** It is tempting to call the LLM for "smart" motor corrections. Do not. The physics IS the intelligence. If the motor control seems too dumb, the graph topology is wrong — fix the graph, not the algorithm.
- **God Object:** `motor_control.py` orchestrates the pipeline but must not contain coherence logic, frustration logic, or encoding logic. Each concern has its own file.
- **Premature Optimization:** Do not optimize the propagation loop until profiling proves it is the bottleneck. The visual encoder will almost certainly be slower.
- **Shared Mutable State:** The frustration state, proprioceptive subgraph, and main cognitive graph must not be modified by multiple concurrent ticks. The Fast Tick is sequential; do not introduce parallelism within the tick.

### Boundaries

| Boundary | Inside | Outside | Interface |
|----------|--------|---------|-----------|
| Motor Subgraph | Proprioceptive nodes, motor process nodes, frustration state | Narrative graph, social graph, economic graph | Shared cognitive graph with modality-based isolation (`modality: spatial`) |
| Physics / 3D | Energy propagation, action command generation | Skeletal animation, collision detection, rendering | `motor-bridge.js` — sends ActionCommand, receives CollisionEvent |
| Fast Tick / Medium Tick | motor_tick(), frustration_tick() | consolidation_hook() | Medium Tick calls consolidation_hook() after N Fast Ticks |
| Motor / LLM | Servo loop, prediction error, energy propagation | Desire creation, process seeding, drive adjustment | Desire nodes in graph — LLM writes them, motor reads them |

---

## SCHEMA

### Proprioceptive Node

```yaml
ProprioceptiveNode:
  required:
    - id: string               # "state:functional:{component}" e.g., "state:functional:position_vector"
    - type: "state"
    - subtype: "functional"
    - content: float[]          # Component-specific: [x,y,z] for position, [vx,vy,vz] for velocity
    - energy: float             # [0, 1] — kinetic impulse reflection
    - stability: float          # [0, 1] — synthetic friction coefficient
    - modality: "spatial"       # Isolation tag
    - recency: float            # [0, 1] — feedback freshness
  optional:
    - threshold: float          # Override default Theta_i for this node
  constraints:
    - energy must be >= 0 and <= 1
    - stability must be >= 0 and <= 1
    - recency decays each tick by RECENCY_DECAY rate
```

### Motor Process Node

```yaml
MotorProcessNode:
  required:
    - id: string               # "process:{action_name}" e.g., "process:fine_grasping"
    - type: "process"
    - content: string           # Human-readable description
    - action_command: string    # Executable command string
    - drive_affinity: dict      # {"achievement": float, "self_preservation": float, ...}
    - energy: float             # [0, 1] — accumulated energy
    - weight: float             # [0, 1] — consolidated strength
    - stability: float          # [0, 1] — movement smoothness
    - recency: float            # [0, 1] — last activation time
  optional:
    - action_context: string    # Embedding signature for spatial targeting
    - trajectory_links: list    # IDs of links along the trajectory this node belongs to
  constraints:
    - action_command must be parseable by parse_action_command()
    - weight only increases via Law 6 consolidation on SUCCESS outcomes
    - energy resets to 50% of threshold after firing (partial reset for momentum)
```

### Action Command

```yaml
ActionCommand:
  required:
    - name: string             # e.g., "arm_execute"
    - action: string           # e.g., "grasp"
    - params: dict             # e.g., {"pressure": 0.2}
  optional:
    - context: string          # Spatial targeting signature
    - source_node: string      # ID of the process node that fired this command
    - energy_ratio: float      # energy / threshold at firing time — modulates force
  relationships:
    - fired_by: MotorProcessNode
    - executed_by: Lumina Prime action executor
```

---

## ENTRY POINTS

| Entry Point | File:Line | Triggered By |
|-------------|-----------|--------------|
| `motor_tick()` | `motor_control.py:TODO` | Fast Tick scheduler (every <16ms) |
| `frustration_tick()` | `frustration.py:TODO` | Called within motor_tick() after Step 2 |
| `consolidation_hook()` | `motor_consolidation.py:TODO` | Medium Tick scheduler (periodic) |
| `inject_collision()` | `proprioceptive_subgraph.py:TODO` | `collision-feedback.js` via motor-bridge |
| `encode_visual()` | `visual_encoder.py:TODO` | Camera frame available event |

---

## DATA FLOW AND DOCKING (FLOW-BY-FLOW)

### Flow 1: Motor Servo Cycle (Fast Tick)

The core control loop that runs every <16ms. Transforms sensory input into motor commands through energy dynamics in the graph.

```yaml
flow:
  name: motor_servo_cycle
  purpose: Closed-loop motor control via active inference — sensory input becomes motor output through graph physics
  scope: Camera frame in, action commands out, proprioceptive state updated
  steps:
    - id: step_1_encode
      description: Encode sensory streams into graph nodes via Law 1 injection
      file: .mind/runtime/physics/motor_control.py
      function: motor_tick() → _encode_and_inject()
      input: camera_frame (raw), proprioceptive_readings (dict), biometric_data (dict)
      output: Updated concept and state:functional nodes with fresh energy
      trigger: Fast Tick scheduler
      side_effects: Graph node energy values modified
    - id: step_2_cohere
      description: Compute composite coherence between sensory state and WM centroid
      file: .mind/runtime/physics/composite_coherence.py
      function: composite_coherence()
      input: Injected sensory nodes, WM coalition (C_t)
      output: Coherence score (float), prediction_error (float)
      trigger: Called by motor_tick() after encoding
      side_effects: None — pure computation
    - id: step_3_propagate
      description: Inject prediction error energy and propagate through motor subgraph
      file: .mind/runtime/physics/motor_control.py
      function: motor_tick() → _propagate()
      input: prediction_error, drive_modulation coefficients, motor subgraph
      output: Updated energy values on all motor process nodes
      trigger: Called by motor_tick() after coherence
      side_effects: Graph edge energy flows, node energy changes, decay applied
    - id: step_4_fire
      description: Check process nodes against Theta_sel, fire action commands
      file: .mind/runtime/physics/motor_control.py
      function: motor_tick() → _fire_commands()
      input: Motor process nodes with updated energy, effective_theta_sel
      output: list[ActionCommand]
      trigger: Called by motor_tick() after propagation
      side_effects: Fired nodes have energy partially reset, recency set to 1.0
  docking_points:
    guidance:
      include_when: Boundary crossing, state mutation, or risk-bearing transformation
      omit_when: Internal intermediate computation with no side effects
      selection_notes: Focus on injection point (external world enters graph) and firing point (graph energy exits as motor command)
    available:
      - id: dock_sensory_injection
        type: graph_ops
        direction: input
        file: .mind/runtime/physics/motor_control.py
        function: _encode_and_inject()
        trigger: Fast Tick
        payload: Sensory data (visual embedding, XYZ, biometric)
        async_hook: optional
        needs: add async hook for visual encoder latency monitoring
        notes: This is where the external world enters the motor subgraph
      - id: dock_coherence_output
        type: custom
        direction: output
        file: .mind/runtime/physics/composite_coherence.py
        function: composite_coherence()
        trigger: Called after encoding
        payload: {coherence: float, prediction_error: float, sim_vec: float, sim_lex: float, delta_affect: float}
        async_hook: not_applicable
        needs: none
        notes: Pure function — safe to monitor without side effects
      - id: dock_action_commands
        type: event
        direction: output
        file: .mind/runtime/physics/motor_control.py
        function: _fire_commands()
        trigger: Process node energy > effective_theta_sel
        payload: list[ActionCommand]
        async_hook: required
        needs: add event emitter for command dispatch
        notes: This is where graph energy exits as physical movement — critical boundary
      - id: dock_collision_injection
        type: event
        direction: input
        file: .mind/runtime/physics/proprioceptive_subgraph.py
        function: inject_collision()
        trigger: Three.js collision event via motor-bridge
        payload: CollisionEvent {position, magnitude, normal_vector}
        async_hook: required
        needs: add event listener and bridge protocol
        notes: Collision override — must not be delayed or buffered
    health_recommended:
      - dock_id: dock_sensory_injection
        reason: Entry point for all external data — latency here determines control quality
      - dock_id: dock_action_commands
        reason: Output boundary — monitors whether the system is producing movement at all
      - dock_id: dock_collision_injection
        reason: Safety-critical — collision response latency is a V2 invariant
```

### Flow 2: Frustration and Bifurcation

Parallel monitoring of prediction error persistence, leading to trajectory bifurcation on deadlock.

```yaml
flow:
  name: frustration_bifurcation
  purpose: Detect motor deadlocks and enable alternative strategies via Theta_sel reduction
  scope: Prediction error history in, Theta_sel modifier out
  steps:
    - id: step_1_track
      description: Append current prediction error to rolling window
      file: .mind/runtime/physics/frustration.py
      function: frustration_tick() → _track_error()
      input: prediction_error (float)
      output: Updated prediction_errors deque
      trigger: Called every motor tick after coherence calculation
      side_effects: Deque state modified
    - id: step_2_detect
      description: Check if recent errors indicate deadlock
      file: .mind/runtime/physics/frustration.py
      function: frustration_tick() → _detect_deadlock()
      input: prediction_errors window
      output: is_deadlocked (bool)
      trigger: After tracking
      side_effects: ticks_since_improve counter updated
    - id: step_3_accumulate
      description: If deadlocked, accumulate frustration energy and reduce Theta_sel
      file: .mind/runtime/physics/frustration.py
      function: frustration_tick() → _accumulate()
      input: prediction_error, is_deadlocked
      output: Updated theta_sel_modifier, bifurcation_ready flag
      trigger: After deadlock detection
      side_effects: FrustrationState modified, may emit motor.bifurcation event
  docking_points:
    guidance:
      include_when: State change that affects motor behavior
      omit_when: Internal counter updates
      selection_notes: The bifurcation event is the critical moment
    available:
      - id: dock_bifurcation_event
        type: event
        direction: output
        file: .mind/runtime/physics/frustration.py
        function: _accumulate()
        trigger: theta_sel_modifier drops below 0.5
        payload: {abandoned_plan: string, frustration_energy: float, theta_sel_effective: float}
        async_hook: optional
        needs: add event emitter
        notes: Observable moment when the agent gives up and tries something else
    health_recommended:
      - dock_id: dock_bifurcation_event
        reason: V4 invariant — proves the system can escape deadlocks
```

---

## LOGIC CHAINS

### LC1: Sensory Input to Motor Output (Single Tick)

**Purpose:** The complete path from perceiving the world to acting on it, within one Fast Tick.

```
camera_frame
  → visual_encoder.encode_visual()         # SigLIP/CLIP embedding (or symbolic fallback)
    → motor_control._encode_and_inject()   # Law 1 dual-channel injection into graph
      → composite_coherence()              # 0.3*Sim_vec + 0.5*Sim_lex + 0.2*Delta_affect
        → motor_control._propagate()       # prediction_error → energy injection → Law 2 propagation
          → motor_control._fire_commands() # Law 11 selection → Law 17 firing
            → ActionCommand                # Dispatched to Lumina Prime via motor-bridge
```

**Data transformation:**
- Input: `camera_frame` (raw pixels) — what the agent sees
- After encoding: `float[768]` embedding — compressed visual representation
- After coherence: `float` prediction_error — how far from target
- After propagation: `float[]` node energies — which motor actions are "warm"
- Output: `ActionCommand` — what the body does

### LC2: Frustration Accumulation to Trajectory Switch

**Purpose:** The path from repeated failure to behavioral change.

```
prediction_error (high, persistent)
  → frustration._track_error()              # Record in rolling window
    → frustration._detect_deadlock()        # N consecutive errors above threshold
      → frustration._accumulate()           # Frustration energy grows, Theta_sel shrinks
        → motor_control._fire_commands()    # Different process node now wins Law 11 arbitration
          → New ActionCommand               # Agent tries alternative approach
```

### LC3: Collision to Flinch Response

**Purpose:** The path from physical contact to protective withdrawal.

```
Three.js collision event
  → collision-feedback.js.injectCollision()    # Capture and package collision data
    → motor-bridge.js.sendCollision()          # Cross Python/JS boundary
      → proprioceptive_subgraph.inject_collision() # Massive Law 1 injection (energy=0.9)
        → state:functional nodes saturate WM       # Displaces active motor plan
          → motor_control._fire_commands()         # self_preservation drive wins Law 11
            → ActionCommand: withdrawal            # Hand retracts from obstacle
```

---

## MODULE DEPENDENCIES

### Internal Dependencies

```
motor_control.py
    └── imports → composite_coherence.py
    └── imports → proprioceptive_subgraph.py
    └── imports → frustration.py
    └── imports → motor_consolidation.py (Medium Tick only)
    └── imports → sensory_encoders/visual_encoder.py
    └── imports → sensory_encoders/spatial_encoder.py
    └── imports → sensory_encoders/biometric_encoder.py

motor_control.py
    └── depends on → .mind/runtime/physics/laws.py  (Law 1, 2, 3, 4, 6, 11, 14, 16, 17)

motor-bridge.js
    └── imports → collision-feedback.js
    └── imports → action-executor.js
    └── depends on → src/server/index.js (server integration)
```

### External Dependencies

| Package | Used For | Imported By |
|---------|----------|-------------|
| `torch` | SigLIP/CLIP model inference | `visual_encoder.py` |
| `transformers` | SigLIP/CLIP model loading | `visual_encoder.py` |
| `numpy` | Vector operations, cosine similarity | `composite_coherence.py`, `proprioceptive_subgraph.py` |
| `collections.deque` | Rolling prediction error window | `frustration.py` |
| `three.js` (Raycaster) | Collision detection in 3D scene | `collision-feedback.js` |

---

## STATE MANAGEMENT

### Where State Lives

| State | Location | Scope | Lifecycle |
|-------|----------|-------|-----------|
| Proprioceptive nodes | Cognitive graph (FalkorDB) | Per-citizen | Created on citizen spawn, updated every Fast Tick |
| Motor process nodes | Cognitive graph (FalkorDB) | Per-citizen | Seeded by design/narrative, weights evolve via Law 6 |
| Frustration state | In-memory (per MotorController instance) | Per-citizen | Created when motor controller initializes, reset on desire change |
| Context Vector C_t | Computed fresh each tick | Per-tick | Not persisted — recomputed from WM coalition |
| Visual embedding cache | In-memory | Per-citizen | Last valid embedding, replaced when new frame arrives |

### State Transitions

```
IDLE ──(desire activated)──> SEEKING ──(target detected)──> APPROACHING
  |                              |                              |
  |                              └──(frustration)──> BIFURCATING ──> SEEKING (new target)
  |                                                                    |
  └──────────────────────────────────────────────────────────────────<──┘
                                                                    |
APPROACHING ──(contact)──> EXECUTING ──(success)──> CONSOLIDATING ──> IDLE
                |                        |
                └──(collision)──> FLINCHING ──> REASSESSING ──> SEEKING
```

---

## RUNTIME BEHAVIOR

### Initialization

```
1. Load physics engine with 21 Laws
2. Create ProprioceptiveSubgraph for citizen (position, velocity, joints nodes)
3. Initialize FrustrationState (energy=0, modifier=1.0)
4. Load or initialize motor process nodes from citizen's graph
5. Initialize visual encoder (SigLIP model load — may take 2-5s)
6. Register collision listener on motor-bridge
7. Register motor_tick() with Fast Tick scheduler
8. Register consolidation_hook() with Medium Tick scheduler
9. Motor controller ready — IDLE state
```

### Main Loop (Fast Tick)

```
1. Fast Tick fires (<16ms interval)
2. Gather available sensory data (latest visual embedding, proprioceptive state, biometric)
3. Execute motor_tick() pipeline:
   a. Encode and inject (Step 1)
   b. Compute coherence (Step 2)
   c. Run frustration_tick() in parallel
   d. Propagate energy (Step 3)
   e. Fire action commands (Step 4)
4. Dispatch fired ActionCommands to motor-bridge
5. Wait for next Fast Tick
```

### Shutdown

```
1. Deregister motor_tick() from Fast Tick scheduler
2. Deregister consolidation_hook() from Medium Tick scheduler
3. Persist current motor process node weights to graph (save consolidated habits)
4. Release visual encoder model from memory
5. Close motor-bridge connection
```

---

## CONCURRENCY MODEL

| Component | Model | Notes |
|-----------|-------|-------|
| motor_tick() | Synchronous (within Fast Tick) | Entire pipeline runs sequentially — no parallelism within a tick |
| visual_encoder | Potentially async | If encoding exceeds tick budget, run 1 tick behind using cached embedding |
| collision-feedback.js | Event-driven (async) | Collision events arrive asynchronously; queued for next tick |
| motor-bridge.js | Message-passing (async) | Python/JS communication via stdin/stdout or WebSocket |
| consolidation_hook() | Synchronous (within Medium Tick) | Runs less frequently; can take longer |

---

## CONFIGURATION

| Config | Location | Default | Description |
|--------|----------|---------|-------------|
| `FAST_TICK_MS` | `motor_control.py` | `16` | Fast Tick interval in milliseconds (target: 60fps) |
| `DECAY_RATE` | `motor_control.py` | `0.02` | Energy decay per tick — Venice-calibrated, do not adjust without approval |
| `COLLISION_MAGNITUDE` | `proprioceptive_subgraph.py` | `0.9` | Energy injection on collision — must saturate WM in 1 tick |
| `DEADLOCK_THRESHOLD` | `frustration.py` | `0.7` | Prediction error above this = not improving |
| `PATIENCE_TICKS` | `frustration.py` | `5` | Ticks of deadlock before frustration begins accumulating |
| `FRUSTRATION_RATE` | `frustration.py` | `0.15` | Rate of frustration energy accumulation per tick |
| `MOAT_REDUCTION_RATE` | `frustration.py` | `2.0` | How fast Theta_sel drops as frustration grows |
| `CONSOLIDATION_RATE` | `motor_consolidation.py` | `0.05` | Weight increase per successful trajectory execution |
| `DECONSOLIDATION_RATE` | `motor_consolidation.py` | `0.01` | Weight decrease per failed trajectory execution |
| `STABILITY_GAIN` | `motor_consolidation.py` | `0.02` | Stability increase per successful execution |
| `CONFIDENCE_FLOOR` | `visual_encoder.py` | `0.3` | Below this confidence, fall back to symbolic matching |
| `COHERENCE_WEIGHTS` | `composite_coherence.py` | `[0.3, 0.5, 0.2]` | Weights for [Sim_vec, Sim_lex, Delta_affect] |

---

## BIDIRECTIONAL LINKS

### Code → Docs

No code exists yet. When implemented, each source file should contain:

```python
# DOCS: docs/architecture/motor-control/IMPLEMENTATION_Motor_Control.md
```

### Docs → Code

| Doc Section | Implemented In |
|-------------|----------------|
| ALGORITHM Step 1 | `motor_control.py:_encode_and_inject()` — TODO |
| ALGORITHM Step 2 | `composite_coherence.py:composite_coherence()` — TODO |
| ALGORITHM Step 3 | `motor_control.py:_propagate()` — TODO |
| ALGORITHM Step 4 | `motor_control.py:_fire_commands()` — TODO |
| BEHAVIOR B1 | Integration test: grasp sequence — TODO |
| BEHAVIOR B2 | `proprioceptive_subgraph.py:inject_collision()` — TODO |
| BEHAVIOR B3 | `frustration.py:frustration_tick()` — TODO |
| BEHAVIOR B4 | `motor_consolidation.py:consolidation_hook()` — TODO |
| VALIDATION V1 | `test_energy_conservation.py` — TODO |
| VALIDATION V2 | `test_motor_tick.py:test_collision_override` — TODO |
| VALIDATION V3 | `test_motor_tick.py:test_no_llm_calls` — TODO |
| VALIDATION V4 | `test_frustration_gradient.py:test_deadlock_escape` — TODO |

---

## EXTRACTION CANDIDATES

No code exists yet. When implemented, monitor:

| File | Expected Size | Watch At | Action If Exceeded |
|------|--------------|----------|-------------------|
| `motor_control.py` | ~300L | 400L | Extract _propagate() into motor_propagation.py |
| `frustration.py` | ~150L | 400L | Unlikely to exceed — isolated concern |
| `motor-bridge.js` | ~200L | 400L | Extract protocol serialization into motor-protocol.js |

---

## MARKERS

<!-- @mind:todo Implement motor_control.py — the core module, start here -->
<!-- @mind:todo Implement proprioceptive_subgraph.py — needed before motor_tick can run -->
<!-- @mind:todo Implement composite_coherence.py — needed for Step 2 -->
<!-- @mind:todo Implement frustration.py — needed for deadlock recovery -->
<!-- @mind:todo Implement motor_consolidation.py — needed for habit formation -->
<!-- @mind:todo Implement visual_encoder.py — needed for Step 1 (or start with symbolic fallback only) -->
<!-- @mind:todo Implement motor-bridge.js — Python/JS boundary crossing -->
<!-- @mind:todo Implement collision-feedback.js — Three.js collision capture -->
<!-- @mind:todo Implement action-executor.js — ActionCommand to Lumina Prime translation -->
<!-- @mind:todo Write all test files — start with test_energy_conservation.py (V1 invariant) -->
<!-- @mind:proposition Start implementation with symbolic fallback only (no SigLIP), add visual encoder later -->
<!-- @mind:escalation Tick stratification: motor Fast Tick (<16ms) vs narrative physics tick (5min) — need architectural decision before implementation -->
<!-- @mind:escalation Python/JS bridge architecture: subprocess with stdin/stdout, WebSocket, or shared memory? Latency implications for motor control. -->
