# Active Inference Motor Control — Algorithm: The Servo Loop and Its Mechanics

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
THIS:            ALGORITHM_Motor_Control.md (you are here)
VALIDATION:      ./VALIDATION_Motor_Control.md
IMPLEMENTATION:  ./IMPLEMENTATION_Motor_Control.md
SYNC:            ./SYNC_Motor_Control.md

IMPL:            .mind/runtime/physics/motor_control.py (TODO — does not exist yet)
```

> **Contract:** Read docs before modifying. After changes: update IMPL or add TODO to SYNC. Run tests.

---

## OVERVIEW

The active inference motor control algorithm runs on the Fast Tick (<16ms) and produces motor commands by minimizing prediction error between sensory input and the Working Memory centroid. It is a four-stage pipeline executed every tick: (1) encode sensory streams into graph nodes, (2) compute composite coherence to derive prediction error, (3) inject error energy and propagate through motor subgraph, (4) fire action commands from process nodes that cross the Selection Moat. A parallel frustration accumulator monitors persistent failure and triggers trajectory bifurcation when deadlocks are detected.

The entire algorithm operates within the L1 cognitive graph. No LLM is called. No external controller is consulted. The physics IS the algorithm.

---

## OBJECTIVES AND BEHAVIORS

| Objective | Behaviors Supported | Why This Algorithm Matters |
|-----------|---------------------|----------------------------|
| Real-time motor control without LLM | B1 (Smooth Grasping) | The 4-stage pipeline completes in <16ms, producing continuous corrections |
| Energy conservation | B1, B2 | Strict surplus distribution (I1) prevents phantom impulses |
| Frustration-based recovery | B3 (Trajectory Bifurcation) | Frustration accumulator detects deadlocks and lowers Theta_sel |
| Motor habit consolidation | B4 (Habit Crystallization) | Medium Tick hook reinforces successful trajectory weights via Law 6 |
| Multimodal integration | B1, B5 (Limbic Motor Character) | Composite coherence fuses visual, lexical, and affective signals |
| Perception priority | B2 (Collision Recovery) | Law 1 injection magnitude hierarchy guarantees sensory override |

---

## DATA STRUCTURES

### Proprioceptive Node (state:functional)

```
ProprioceptiveNode:
  id:         string          # e.g., "state:functional:position_vector"
  type:       "state"
  subtype:    "functional"
  content:    float[]          # [x, y, z] for position, [vx, vy, vz] for velocity, [theta_1..n] for joints
  energy:     float [0, 1]    # Current kinetic impulse reflection
  stability:  float [0, 1]    # Synthetic friction coefficient — high = smooth, low = oscillatory
  modality:   "spatial"        # Isolation tag for priority routing
  recency:    float [0, 1]    # Proprioceptive feedback freshness — decays if not updated
  threshold:  float            # Theta_i — energy level at which node contributes to WM
```

### Motor Process Node

```
MotorProcessNode:
  id:             string       # e.g., "process:fine_grasping"
  type:           "process"
  content:        string       # Human-readable description: "Precision grasping"
  action_command: string       # Executable command: "arm_execute(grasp, pressure=0.2)"
  action_context: string       # Embedding signature for spatial targeting
  drive_affinity: dict         # {"achievement": 0.8, "self_preservation": 0.3}
  stability:      float [0,1]  # Movement smoothness factor
  weight:         float [0,1]  # Consolidated strength — increases with successful use (Law 6)
  recency:        float [0,1]  # How recently this process was activated
  energy:         float [0,1]  # Current accumulated energy
  threshold:      float        # Theta_sel — Selection Moat, may be reduced by frustration
```

### Context Vector (C_t)

```
ContextVector:
  embeddings:     float[]      # Weighted average of all WM coalition node embeddings
  lexical_tags:   set[string]  # Union of identifier tags from WM coalition nodes
  affect_state:   dict         # Current limbic tension: {"achievement": float, "self_preservation": float, ...}
  timestamp:      int          # Tick number when C_t was last computed
```

### Frustration State

```
FrustrationState:
  energy:              float [0, 1]    # Current frustration accumulation
  prediction_errors:   deque[float]    # Rolling window of last N prediction errors
  ticks_since_improve: int             # Counter of consecutive ticks without coherence improvement
  theta_sel_modifier:  float [0, 1]    # Multiplicative reduction to Theta_sel: effective_theta = Theta_sel * modifier
  bifurcation_ready:   bool            # True when modifier < 0.5 (alternative attractors can compete)
```

---

## ALGORITHM: motor_tick()

### Step 1: Sensory Encoding and Law 1 Injection

Encode all available sensory streams into graph nodes and inject them via Law 1 (Dual-Channel Injection). This is where the outside world enters the motor subgraph.

```
FOR each sensory modality:
    IF visual stream available:
        visual_embedding = SigLIP_encode(camera_frame)
        inject_node("concept:visual_current", visual_embedding, channel="floor")
        // Floor channel: wakes "cold" motor nodes related to detected objects
        inject_node("concept:visual_current", visual_embedding, channel="amplifier")
        // Amplifier channel: boosts the most coherent active trajectory

    IF proprioceptive feedback available:
        update_node("state:functional:position_vector", new_position)
        update_node("state:functional:velocity_vector", new_velocity)
        update_node("state:functional:joint_angles", new_angles)

    IF biometric signal available:
        update_limbic_state(hrv=garmin.hrv, stress=garmin.stress)
        // Feeds Law 14 — modulates achievement and self_preservation drives

    IF collision detected:
        inject_node("state:functional:position_vector",
                    energy=COLLISION_MAGNITUDE,  // >> normal injection, typically 0.9
                    channel="floor")
        // Massive injection forces proprioceptive nodes past Theta_sel
        // Saturates WM within this tick — overrides active motor plan

    IF visual stream unavailable:
        // Symbolic fallback (Law 8)
        symbolic_coherence = type_match(target) * keyword_overlap(target)
        inject_node("concept:symbolic_target", symbolic_coherence, channel="floor")
```

**Why this step exists:** The motor loop is closed-loop control. Without fresh sensory injection every tick, the system would operate on stale data and diverge from reality. Law 1 dual-channel injection ensures both breadth (floor channel wakes relevant nodes) and depth (amplifier channel strengthens the best candidate).

### Step 2: Composite Coherence and Prediction Error

Compute how well the current sensory state matches the Working Memory target image. The gap is the prediction error that drives corrective action.

```
// Compute Context Vector C_t from current WM coalition
C_t = weighted_average(wm_coalition.embeddings)
C_t_lex = union(wm_coalition.lexical_tags)
C_t_affect = wm_coalition.affect_state

// Compute Composite Coherence
FOR each injected sensory node S:
    Sim_vec = cosine_similarity(S.embedding, C_t.embeddings)
    Sim_lex = lexical_match(S.tags, C_t_lex)
        // Strict identifier matching: "red_brick" == "red_brick" → 1.0
        // Partial match: "red_brick" ~ "brick_fragment" → 0.5
        // No match → 0.0
    Delta_affect = abs(S.limbic_tension - C_t_affect.current_tension)
        // Surprise signal: how much does this stimulus deviate from expected affect?

    Coherence = (0.3 * Sim_vec) + (0.5 * Sim_lex) + (0.2 * Delta_affect)

// Prediction Error
prediction_error = 1.0 - Coherence
    // High coherence → low error → target nearly reached → small correction
    // Low coherence → high error → far from target → large correction
```

**Why the weights (0.3, 0.5, 0.2):** Lexical similarity (0.5) dominates because strict identifier matching is the most reliable signal for motor targeting — when you are reaching for "glass_rod", you need to know if what you see IS a glass_rod, not something vaguely similar. Vector similarity (0.3) provides generalization for novel objects. Affective delta (0.2) signals surprise, triggering heightened attention when something unexpected enters the visual field.

### Step 3: Energy Injection and Propagation

Convert prediction error into energy and propagate it through the motor subgraph. This is where the physics does the work.

```
// Inject prediction error as energy (Law 1)
injection_energy = prediction_error * drive_modulation(active_drives)
    // Law 14: achievement drive amplifies injection toward target
    //         self_preservation dampens approach, amplifies withdrawal

// Distribute via dual channels
FOR each motor process node P connected to active desire:
    floor_injection = injection_energy * FLOOR_FRACTION
    amplifier_injection = injection_energy * coherence_with_target(P) * AMPLIFIER_FRACTION
    P.energy += (floor_injection + amplifier_injection) * (1.0 - P.stability * DAMPING_FACTOR)
        // Stability dampens energy absorption — high stability = smooth accumulation

// Propagate energy (Law 2)
FOR each node N in motor subgraph WHERE N.energy > N.threshold:
    surplus = N.energy - N.threshold
    N.energy = N.threshold  // Source falls back to threshold
    FOR each outgoing edge E from N:
        flow = surplus * E.weight * alignment(E.target, active_desire)
        E.target.energy += flow
    // INVARIANT I1: sum(|flow_ij|) == surplus_i — strictly conserved

// Apply decay (Law 3)
FOR each node N in motor subgraph:
    N.energy *= (1.0 - DECAY_RATE)  // DECAY_RATE = 0.02 per tick
    N.recency *= RECENCY_DECAY
```

**Why this step exists:** This is the core of the motor control — prediction error becomes energy, energy flows through the graph following weighted connections, and the topology of the subgraph determines which motor actions accumulate the most energy. The movement is not computed by an optimizer; it emerges from the graph structure.

### Step 4: Action Command Firing (Law 17)

Process nodes that have accumulated enough energy fire their action commands. This is where graph energy becomes physical movement.

```
fired_commands = []

// Law 11: Orientation Selection — determine dominant action tendency
candidates = [P for P in motor_process_nodes WHERE P.energy > effective_theta_sel(P)]
    // effective_theta_sel = P.threshold * frustration_state.theta_sel_modifier

IF len(candidates) == 0:
    RETURN []  // No movement this tick — citizen remains still

IF len(candidates) > 1:
    // Arbitrate via drive alignment (Law 11)
    winner = argmax(candidates, key=lambda P: drive_alignment(P, active_drives))
    candidates = [winner]  // Only one action per tick

// Law 17: Fire the action command
FOR each P in candidates:
    command = parse_action_command(P.action_command)
    command.context = P.action_context
    command.pressure = P.energy / P.threshold  // Energy ratio modulates force
    fired_commands.append(command)
    P.energy = P.threshold * 0.5  // Partial energy reset after firing
    P.recency = 1.0  // Mark as recently used

RETURN fired_commands
```

**Why partial energy reset (0.5):** Full reset to zero would mean the process node needs to accumulate from scratch for the next correction. Partial reset preserves momentum — the node is ready to fire again quickly if prediction error remains high, producing the continuous correction that makes movement smooth.

---

## ALGORITHM: frustration_tick()

Runs in parallel with the main motor tick. Monitors prediction error persistence and manages the frustration gradient.

### Step 1: Track Prediction Error History

```
frustration_state.prediction_errors.append(current_prediction_error)
IF len(frustration_state.prediction_errors) > WINDOW_SIZE:
    frustration_state.prediction_errors.popleft()
```

### Step 2: Detect Deadlock

```
// Deadlock = prediction error not improving over time
recent_errors = frustration_state.prediction_errors[-DEADLOCK_WINDOW:]
IF all(e > DEADLOCK_THRESHOLD for e in recent_errors):
    frustration_state.ticks_since_improve += 1
ELSE:
    frustration_state.ticks_since_improve = max(0, ticks_since_improve - 2)
    // Improvement resets the counter (with hysteresis — doesn't snap to zero)
```

### Step 3: Accumulate Frustration Energy (Law 16)

```
IF frustration_state.ticks_since_improve > PATIENCE_TICKS:
    // Patience exhausted — frustration begins accumulating
    frustration_injection = prediction_error * FRUSTRATION_RATE
    frustration_state.energy += frustration_injection

    // Reduce Theta_sel modifier (makes alternative attractors accessible)
    frustration_state.theta_sel_modifier = max(0.2,
        1.0 - (frustration_state.energy * MOAT_REDUCTION_RATE))

    IF frustration_state.theta_sel_modifier < 0.5:
        frustration_state.bifurcation_ready = True
        // Alternative motor attractors can now compete for WM
```

### Step 4: Bifurcation

```
IF frustration_state.bifurcation_ready:
    // The current motor attractor loses its grip
    // Alternative process nodes (previously below Theta_sel) can now fire
    // No explicit "switch" — the reduced moat lets a different node win the
    // Law 11 orientation selection naturally

    // Log the bifurcation event
    emit("motor.bifurcation", {
        abandoned: current_motor_plan.id,
        frustration_energy: frustration_state.energy,
        theta_sel_effective: frustration_state.theta_sel_modifier
    })
```

---

## ALGORITHM: consolidation_hook() (Medium Tick, Law 6)

Runs on the Medium Tick (slower than Fast Tick). Reinforces successful motor trajectories.

```
FOR each recently_fired process node P:
    IF P.last_firing_outcome == SUCCESS:
        // Strengthen links along the successful trajectory
        FOR each link L in P.trajectory_links:
            L.weight = min(1.0, L.weight + CONSOLIDATION_RATE * (1.0 - L.weight))
            // Diminishing returns — already-strong links gain less

        // Increase node stability (smoother execution next time)
        P.stability = min(1.0, P.stability + STABILITY_GAIN)

    IF P.last_firing_outcome == FAILURE:
        // Weaken the failed trajectory (but slowly — one failure doesn't erase a habit)
        FOR each link L in P.trajectory_links:
            L.weight = max(0.01, L.weight - DECONSOLIDATION_RATE)
```

---

## KEY DECISIONS

### D1: Single Action Per Tick

```
IF multiple process nodes cross Theta_sel simultaneously:
    Fire only the one with highest drive alignment (Law 11)
    Suppress others by reducing their energy by 20%
    WHY: Prevents contradictory motor commands (e.g., "extend arm" and "retract arm")
         The body has one set of effectors; the graph must respect this constraint
```

### D2: Collision Override Priority

```
IF collision energy injection occurs during active motor plan:
    Collision injection magnitude (0.9) >> normal injection magnitude (0.01-0.3)
    Proprioceptive nodes saturate WM within 1 tick
    Active motor plan suppressed — not deleted, just out-competed
    WHY: Perception priority (I2) — the world is always louder than the plan
         This is not a special case; it falls out naturally from energy magnitudes
```

### D3: Symbolic Fallback Threshold

```
IF visual_embedding is None OR SigLIP confidence < CONFIDENCE_FLOOR:
    Use symbolic fallback: coherence = type_match * keyword_overlap
    WHY: Motor control must not halt if the visual encoder fails
         Symbolic matching is less precise but guarantees continuity
         The citizen moves cautiously in this mode (self_preservation increases)
ELSE:
    Use full composite coherence calculation
```

### D4: Frustration Hysteresis

```
IF prediction error improves after frustration has begun accumulating:
    Reduce ticks_since_improve by 2 (not reset to 0)
    WHY: Prevents oscillation between frustration and recovery
         A momentary improvement shouldn't reset all frustration state
         The citizen who gets a brief reprieve still remembers recent failure
```

---

## DATA FLOW

```
Camera Frame / Proprioceptive Sensors / Biometric Data / Collision Events
    |
    v
[Step 1: Sensory Encoding & Law 1 Injection]
    |  → concept:visual_current (floor + amplifier channels)
    |  → state:functional:* (proprioceptive update)
    |  → limbic state update (Law 14 input)
    |
    v
[Step 2: Composite Coherence Calculation]
    |  → Sim_vec (cosine similarity)
    |  → Sim_lex (lexical match)
    |  → Delta_affect (surprise signal)
    |  → Coherence = 0.3*Sim_vec + 0.5*Sim_lex + 0.2*Delta_affect
    |  → prediction_error = 1.0 - Coherence
    |
    v
[Step 3: Energy Injection & Propagation]
    |  → injection_energy = error * drive_modulation
    |  → Law 1 dual-channel distribution to motor process nodes
    |  → Law 2 surplus propagation (energy conserved: I1)
    |  → Law 3 decay applied
    |
    v
[Step 4: Action Command Firing]
    |  → Law 11 orientation selection (single winner)
    |  → Law 17 impulse accumulation check
    |  → action_command fired if energy > effective_theta_sel
    |
    v
Action Commands → Lumina Prime (3D Manifestation) → Skeletal Animation → World State Change
    |
    v
New Sensory Feedback (next tick) → [Step 1]    // The loop is closed
    |
    |--- [Parallel] frustration_tick() monitors prediction_error history
    |                → accumulates frustration if deadlocked
    |                → reduces Theta_sel → enables bifurcation
    |
    |--- [Medium Tick] consolidation_hook()
                       → reinforces successful trajectory weights
                       → crystallizes motor habits
```

---

## COMPLEXITY

**Time:** O(N + E) per tick — where N is the number of nodes in the motor subgraph and E is the number of edges. Each node is visited once for injection/decay, each edge once for propagation. With a typical motor subgraph of ~50 nodes and ~200 edges, this is well under 1ms.

**Space:** O(N + E) — the motor subgraph is stored in the main cognitive graph. No auxiliary data structures grow unboundedly. The frustration state's prediction_error deque is bounded by WINDOW_SIZE.

**Bottlenecks:**
- SigLIP/CLIP visual encoding is the most expensive step (~5-10ms on GPU). If this exceeds the Fast Tick budget, the symbolic fallback (Law 8) activates automatically.
- Cosine similarity computation for Sim_vec is O(d) where d is embedding dimensionality (768 for SigLIP). Fast with SIMD but non-trivial.
- If the motor subgraph grows beyond ~200 nodes (e.g., very complex multi-joint robot), propagation may need to be bounded by hop count.

---

## HELPER FUNCTIONS

### `composite_coherence(stimulus, context_vector)`

**Purpose:** Compute the three-component coherence score between a sensory stimulus and the WM centroid.

**Logic:** Calculates Sim_vec (cosine similarity of embeddings), Sim_lex (strict identifier match with partial credit), and Delta_affect (absolute difference in limbic tension). Returns weighted sum: 0.3 * Sim_vec + 0.5 * Sim_lex + 0.2 * Delta_affect.

### `drive_modulation(active_drives)`

**Purpose:** Apply limbic modulation (Law 14) to scale energy injection based on current drive state.

**Logic:** Achievement drive amplifies injection toward approach targets (multiplier 1.0-2.0). Self-preservation amplifies injection toward withdrawal targets and dampens approach targets (multiplier 0.5-1.5). Returns a scalar modulation factor.

### `effective_theta_sel(process_node)`

**Purpose:** Compute the effective Selection Moat for a process node, accounting for frustration reduction.

**Logic:** Returns `process_node.threshold * frustration_state.theta_sel_modifier`. When frustration is zero, the modifier is 1.0 (full moat). When frustration is high, the modifier drops to 0.2 (minimal moat — alternatives can compete).

### `alignment(target_node, active_desire)`

**Purpose:** Compute how well a target node serves the active desire during Law 2 propagation.

**Logic:** Dot product of target node's drive_affinity with active desire's drive signature, weighted by the link's own weight. Determines the fraction of surplus energy that flows through each edge.

### `parse_action_command(command_string)`

**Purpose:** Parse the action_command string from a process node into an executable ActionCommand object.

**Logic:** Extracts command name, parameters, and context. E.g., `"arm_execute(grasp, pressure=0.2)"` becomes `ActionCommand(name="arm_execute", action="grasp", params={"pressure": 0.2})`.

---

## INTERACTIONS

| Module | What We Call | What We Get |
|--------|--------------|-------------|
| `.mind/runtime/physics/laws.py` | `apply_law_1()`, `apply_law_2()`, `apply_law_3()` | Energy injection, propagation, and decay on graph nodes |
| `.mind/runtime/physics/laws.py` | `apply_law_14()` | Limbic drive modulation coefficients |
| `.mind/runtime/physics/laws.py` | `apply_law_16()` | Frustration energy calculation |
| `.mind/runtime/physics/laws.py` | `apply_law_17()` | Action command firing threshold check |
| Lumina Prime (3D engine bridge) | `execute_action_command()` | Confirmation of execution + collision events |
| SigLIP/CLIP encoder | `encode_visual(frame)` | 768-dimensional embedding vector |
| Working Memory module | `get_wm_coalition()` | Current WM contents for C_t computation |

---

## MARKERS

<!-- @mind:todo Determine exact values for COLLISION_MAGNITUDE, FRUSTRATION_RATE, PATIENCE_TICKS, MOAT_REDUCTION_RATE -->
<!-- @mind:todo Profile SigLIP encoding latency on target hardware — if >10ms, need async pipeline -->
<!-- @mind:proposition Consider running visual encoding asynchronously (1 tick behind) to stay within 16ms budget -->
<!-- @mind:escalation Fast Tick frequency: current physics runs at 5-minute intervals for narrative. Motor control needs <16ms. Need tick stratification architecture. -->
<!-- @mind:proposition Investigate whether CONSOLIDATION_RATE should vary by process node type — fine motor vs gross motor may need different learning rates -->
