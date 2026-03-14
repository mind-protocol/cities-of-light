# Active Inference Motor Control — Validation: What Must Be True

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Motor_Control.md
PATTERNS:        ./PATTERNS_Motor_Control.md
BEHAVIORS:       ./BEHAVIORS_Motor_Control.md
THIS:            VALIDATION_Motor_Control.md (you are here)
ALGORITHM:       ./ALGORITHM_Motor_Control.md
IMPLEMENTATION:  ./IMPLEMENTATION_Motor_Control.md
SYNC:            ./SYNC_Motor_Control.md
```

---

## PURPOSE

**Validation = what we care about being true.**

Not mechanisms. Not test paths. Not how things work.

What properties, if violated, would mean the motor control system has failed its purpose?

These invariants protect the system against the specific failure modes that make motor control dangerous: phantom movements (the agent twitches with no cause), deadlocked actions (the agent pushes a wall forever), perception blindness (the agent ignores a collision), and LLM contamination (latency and indeterminism enter the control loop). Every invariant below exists because its violation produces a concrete, observable pathology.

---

## INVARIANTS

### V1: Energy Is Strictly Conserved in Motor Propagation

**Why we care:** If energy appears from nowhere in the motor subgraph, the agent produces spontaneous, unexplained movements — the graph equivalent of phantom limb syndrome. A citizen's hand twitches. A leg extends without cause. The visitor sees a broken puppet, not a living being. This is the most fundamental invariant because it is the difference between a system that moves for reasons and a system that glitches.

```
MUST:   During Law 2 propagation in the motor subgraph, the total energy distributed
        from any source node must equal exactly its surplus above threshold:
        Sigma_j |flow_ij| = surplus_i = energy_i - threshold_i
        The source node energy falls back to exactly threshold_i after distribution.
        Total energy across the motor subgraph changes only through:
        - Law 1 injection (external sensory input)
        - Law 3 decay (deterministic reduction)
        - Law 17 firing (energy consumed by action command)
NEVER:  Energy must never be created by propagation. No floating point accumulation
        across ticks may produce net energy gain exceeding 1e-6 per 1000 ticks.
        No node may have negative energy.
```

### V2: Perception Always Overrides Planning

**Why we care:** If internal motor planning can drown out sensory input, the agent becomes blind to the physical world. A citizen walks into a wall because their "walk forward" plan has more energy than the collision signal. A hand closes on empty air because the visual stream showing the object has moved was ignored. This invariant is what keeps embodied agents embodied — the world is always louder than the plan.

```
MUST:   Law 1 injection (direct sensory input) takes absolute priority over
        Law 2 propagation (internal associative spread). Specifically:
        - Collision injection energy (COLLISION_MAGNITUDE >= 0.9) must exceed
          any single propagation flow by at least 3x
        - Collision-injected proprioceptive nodes must enter the WM coalition
          within 1 Fast Tick of injection
        - No motor process node may fire an action_command in the same tick
          that a collision injection occurs on a connected proprioceptive node
NEVER:  A motor plan in progress may never suppress, delay, or attenuate
        a collision signal. There is no "I'm busy" state for perception.
```

### V3: No LLM in the Motor Control Loop

**Why we care:** The LLM introduces 500ms-3s latency and non-deterministic output. If the LLM enters the servo loop, movement becomes jerky and unpredictable. Worse, each LLM call costs tokens and the servo loop runs at 60+ Hz — the cost would be astronomical. This invariant is the architectural boundary that makes real-time motor control possible. It is not a performance optimization; it is a structural requirement.

```
MUST:   The entire motor_tick() execution path — from sensory encoding through
        composite coherence calculation through energy propagation through
        action command firing — must complete without any LLM API call,
        any prompt construction, or any token generation.
        The LLM may only influence motor behavior indirectly:
        - By creating/modifying desire nodes (strategic planning)
        - By seeding new process nodes (capability definition)
        - By adjusting drive weights (goal prioritization)
        All of these occur outside the Fast Tick, on a separate planning cycle.
NEVER:  motor_tick() must never await, call, or depend on the result of
        an LLM inference. No conditional path within the function may
        route to an LLM. No fallback path may use an LLM as a backup.
```

### V4: Frustration Eventually Breaks Deadlocks

**Why we care:** An agent stuck in an infinite retry loop is indistinguishable from a crashed system. The visitor sees a citizen pushing against a wall forever. The motor subgraph wastes energy on a provably futile action. Without frustration-based escape, every motor deadlock requires external intervention (LLM replanning or human reset). With it, the system self-corrects through physics.

```
MUST:   If prediction error remains above DEADLOCK_THRESHOLD for more than
        PATIENCE_TICKS + FRUSTRATION_WINDOW consecutive Fast Ticks,
        the frustration_state.theta_sel_modifier must drop below 0.5,
        enabling bifurcation_ready = True.
        At that point, at least one alternative motor process node
        (previously below Theta_sel) must become eligible to fire.
NEVER:  A motor plan may never execute for more than MAX_RETRY_TICKS
        consecutive ticks without either: (a) achieving coherence improvement,
        or (b) triggering frustration bifurcation.
        No configuration of weights or energies may prevent frustration
        from eventually accumulating — the frustration pathway must not
        be suppressible by the motor plan itself.
```

### V5: Motor Tick Completes Within Time Budget

**Why we care:** If motor_tick() exceeds the Fast Tick budget (<16ms), corrections arrive late. Late corrections compound — the arm overshoots, the correction overshoots the correction, and the movement diverges into oscillation. The 16ms budget is not a nice-to-have; it is the threshold below which closed-loop control is stable and above which it is not.

```
MUST:   motor_tick() must complete in under 16ms wall-clock time
        on the target hardware (Meta Quest 3 equivalent compute).
        This includes sensory encoding (or symbolic fallback),
        coherence calculation, energy propagation, and action firing.
        If visual encoding (SigLIP/CLIP) exceeds 10ms, the system must
        automatically fall back to symbolic coherence (Law 8).
NEVER:  motor_tick() must never block on I/O, network calls,
        or GPU operations that do not complete within the tick budget.
        If async visual encoding is used, the tick must proceed
        with the most recent available embedding, not wait for the new one.
```

### V6: No Phantom Impulses at Rest

**Why we care:** When no desire is active and no sensory injection is occurring, the agent must be still. Any spontaneous movement at rest means energy is being created from nothing — a violation of V1 that manifests as visible twitching. The visitor sees a citizen standing still, then suddenly their arm moves for no reason. This breaks trust in the simulation more than any other bug.

```
MUST:   When no desire node is active, no collision has occurred,
        and no sensory injection is happening, all motor process nodes
        must decay monotonically toward zero energy.
        Within N ticks (where N = ceil(log(initial_energy / epsilon) / log(1 - DECAY_RATE))),
        all motor process nodes must have energy below firing threshold.
NEVER:  A process node may never fire an action_command when:
        - No desire node is active, AND
        - No Law 1 injection has occurred in the last 3 ticks, AND
        - No collision event is being processed
        Numerical drift across ticks must never accumulate enough
        to push a resting node past its threshold.
```

### V7: Consolidation Requires Demonstrated Success

**Why we care:** If motor habits consolidate from failed trajectories, the agent develops "bad habits" — it learns to perform actions incorrectly. A citizen who repeatedly drops objects would, over time, become better at dropping objects. This inversion of learning is catastrophic for the believability of motor behavior.

```
MUST:   Law 6 consolidation (weight increase on trajectory links,
        stability increase on process nodes) must only occur when
        the firing outcome is classified as SUCCESS.
        Success requires: prediction error decreased following the action,
        OR the target state was reached within a defined tolerance.
NEVER:  Consolidation must never strengthen links along a trajectory
        whose outcome was FAILURE. Failed trajectories must undergo
        slow deconsolidation (weight decrease) or no change — never reinforcement.
```

---

## PRIORITY

| Priority | Meaning | If Violated |
|----------|---------|-------------|
| **CRITICAL** | System purpose fails | Motor control is unusable — phantom movements, crashes, or infinite loops |
| **HIGH** | Major value lost | Motor control works but is degraded — slow, imprecise, or non-adaptive |
| **MEDIUM** | Partial value lost | Motor control works but suboptimal — habits don't form, movements lack personality |

---

## INVARIANT INDEX

| ID | Value Protected | Priority |
|----|-----------------|----------|
| V1 | No phantom movements — energy conservation | CRITICAL |
| V2 | World overrides plan — perception priority | CRITICAL |
| V3 | Real-time control — LLM isolation | CRITICAL |
| V4 | Self-recovery from deadlocks — frustration escape | HIGH |
| V5 | Smooth continuous control — tick time budget | HIGH |
| V6 | Stillness at rest — no spontaneous movement | HIGH |
| V7 | Correct habit formation — consolidation integrity | MEDIUM |

---

## MARKERS

<!-- @mind:todo Define exact numerical thresholds for V1 floating point tolerance (1e-6 per 1000 ticks — is this tight enough?) -->
<!-- @mind:todo Define MAX_RETRY_TICKS for V4 — need to balance patience with responsiveness -->
<!-- @mind:proposition Consider adding V8: "Motor habits decay without use" — prevents phantom skills in citizens who change roles -->
<!-- @mind:escalation V5 tick budget assumes Quest 3 compute — need benchmarks on actual hardware to validate 16ms target -->
<!-- @mind:escalation V2 collision magnitude (0.9) and 3x propagation ratio — need calibration against realistic motor subgraph energy levels -->
