# Active Inference Motor Control — Behaviors: What the World Sees When Bodies Move

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Motor_Control.md
THIS:            BEHAVIORS_Motor_Control.md (you are here)
PATTERNS:        ./PATTERNS_Motor_Control.md
ALGORITHM:       ./ALGORITHM_Motor_Control.md
VALIDATION:      ./VALIDATION_Motor_Control.md
IMPLEMENTATION:  ./IMPLEMENTATION_Motor_Control.md
SYNC:            ./SYNC_Motor_Control.md

IMPL:            .mind/runtime/physics/motor_control.py (TODO — does not exist yet)
```

> **Contract:** Read docs before modifying. After changes: update IMPL or add TODO to SYNC. Run tests.

---

What the visitor sees is a citizen reaching for a glass and picking it up. What the visitor does not see is the prediction error shrinking tick by tick, the process nodes warming up as energy flows through them, the stability dimension dampening the last oscillation of the wrist. The visitor sees fluidity. The system produces it through physics.

The visitor never sees energy values. Never sees a coherence score. Never reads a prediction error. They see a glassblower's hands moving with practiced ease. They see a stumble when a foot catches a cobblestone. They see a citizen give up on a stuck door and walk around to the side entrance. That is the motor control, made flesh.

---

## BEHAVIORS

### B1: Smooth Grasping Emerges from the Servo Loop

**Why:** A citizen that jerks and stutters when picking up objects breaks immersion instantly. Smooth grasping is the baseline proof that the motor control system works. If this fails, nothing else matters.

```
GIVEN:  A citizen has a desire node active ("grasp the glass rod on the workbench")
        AND the glass rod is within visual range (SigLIP embedding injected via Law 1)
        AND the citizen's hand is at rest position
WHEN:   The active inference loop begins executing on the Fast Tick
THEN:   The visitor observes the citizen's hand rising from rest, extending toward the glass rod,
        fingers opening as the hand approaches, then closing precisely around the rod.
        The movement is continuous — no visible pauses between phases.
        The hand does not overshoot the rod. The fingers do not clench too hard.
AND:    The entire grasp sequence completes within 3 Fast Ticks of motor activation.
        No LLM call occurs during the sequence.
```

What the visitor sees: a glassblower reaching for a rod with the casual precision of someone who has done it ten thousand times. What the system is doing: computing composite coherence between the visual embedding of the rod and the WM centroid C_t, injecting the prediction error as energy into motor process nodes, and firing `arm_execute(grasp, pressure=0.2)` when the `process:fine_grasping` node crosses Theta_sel. The visitor sees craft. The system produces gradient descent.

### B2: Collision Snaps the Body to Attention

**Why:** An agent that ignores collisions is not embodied — it is a ghost. Physical contact must override any motor plan in progress, because in the real world, pain is louder than intention.

```
GIVEN:  A citizen is mid-grasp, hand extending toward an object
        AND the motor process nodes are active with moderate energy
WHEN:   The citizen's hand collides with an unexpected obstacle
        (collision event injected as massive energy into proprioceptive subgraph via Law 1)
THEN:   Within 1 Fast Tick, the proprioceptive nodes (position_vector, velocity_vector)
        saturate the Working Memory, displacing the grasp plan entirely.
        The citizen's hand retracts from the obstacle.
        The self_preservation drive (Law 14) creates a repulsion field around the collision zone.
AND:    The visitor sees the citizen flinch — a sharp, immediate withdrawal
        followed by a moment of reorientation before resuming or abandoning the task.
```

The visitor sees a citizen bump their hand on the edge of a shelf and pull back sharply, shaking their hand for a moment before carefully reaching around the obstacle. They do not see that the collision injected 0.9 energy units into `state:functional:position_vector`, which blew past Theta_sel, saturated the WM, activated the `self_preservation` drive, and suppressed the `achievement` drive for two ticks. They see a human reaction. The system produces it through energy priority.

### B3: Trajectory Bifurcation When the Plan Fails

**Why:** An agent stuck in a loop — endlessly pushing against a locked door — is not intelligent. The frustration gradient is what gives agents the ability to "try something else" without needing an LLM to tell them.

```
GIVEN:  A citizen is executing a motor plan (e.g., "push open the workshop door")
        AND the door is stuck (motor action produces no change in visual feedback)
        AND prediction error remains high (Coherence stays low) across multiple Fast Ticks
WHEN:   The frustration node accumulates energy past its threshold (Law 16)
THEN:   Theta_sel drops significantly, breaking attentional inertia.
        The current motor attractor ("push door") loses its grip on the WM.
        An alternative motor attractor ("try side entrance" or "pull instead of push")
        captures the WM and begins executing.
AND:    The visitor observes: the citizen pushes the door once, twice, three times.
        Their body language shifts — shoulders tense, movements become sharper.
        On the fourth attempt, they step back, look around, and walk toward the side entrance.
```

This is the frustration gradient made visible. The visitor sees a citizen getting frustrated and changing approach. They do not see that three ticks of high prediction error accumulated 0.6 energy in `state:frustration`, which reduced Theta_sel from 0.7 to 0.3, which allowed the previously sub-threshold `process:navigate_alternate_route` node to capture the WM. They see adaptive intelligence. The system produces it through energy accumulation and moat reduction.

### Phase Detail: The Three Phases of Frustration

**Phase 1 — Persistence (Ticks 1-3):** The citizen repeats the action with increasing force. Energy injection from prediction error goes into the active motor plan. The citizen looks determined. The visitor sees effort.

**Phase 2 — Agitation (Ticks 4-6):** Frustration energy begins accumulating visibly. The citizen's movements become less smooth (stability dimension drops as frustration rises). They may glance around. Gestures become clipped. The visitor senses something is wrong.

**Phase 3 — Bifurcation (Tick 7+):** Theta_sel collapses. The old attractor releases. A new motor plan captures the WM. The citizen pivots — physically and cognitively. The visitor sees a decision being made, though no decision was computed. Energy found a new valley.

### B4: Motor Habits Crystallize Over Repetition

**Why:** A citizen who has carried goods across the Rialto bridge a thousand times should not "plan" the route each time. Consolidated motor habits are what make citizens look like they belong in their world — their movements carry the weight of practice.

```
GIVEN:  A citizen has successfully executed a motor sequence (e.g., "pick up crate, carry to stall")
        at least 20 times across multiple sessions
WHEN:   The Medium Tick fires and Law 6 (Consolidation) evaluates trajectory links
THEN:   The weights of links along the successful trajectory increase.
        The process nodes involved become high-weight permanent fixtures in the motor subgraph.
        Subsequent executions of the same task require less energy injection to fire
        and complete in fewer Fast Ticks.
AND:    The visitor observes: a dock worker carrying crates moves with practiced efficiency.
        No hesitation. No wasted motion. The path from dock to stall is traced
        as if the citizen's feet remember it independently of their mind.
```

The visitor in Venice sees a fishmonger gutting fish with breathtaking speed — knife moving in patterns so fluid they look choreographed. This citizen has executed `process:fillet_cut` ten thousand times. The link weights are near maximum. The process fires almost instantly on desire activation. The energy cost is minimal. The stability is near 1.0 — the movement is as smooth as physics allows. The visitor sees mastery. The system has crystallized a habit.

### B5: Limbic Drive Shapes Motor Character

**Why:** Two citizens grasping the same object should not move identically. A citizen driven by `achievement` reaches with confidence and speed. A citizen driven by `self_preservation` reaches cautiously, ready to withdraw. The limbic state is what gives each citizen's movements their personality.

```
GIVEN:  Two citizens both have an active desire to pick up the same type of object
        AND citizen A has high achievement drive and low self_preservation
        AND citizen B has low achievement drive and high self_preservation
WHEN:   Both execute the grasp via the active inference loop
THEN:   Citizen A's grasp is direct, fast, and slightly forceful.
        Their hand approaches on a straight line, closes firmly.
        Citizen B's grasp is tentative, slower, with a slight hovering pause before contact.
        Their hand approaches on a curved, cautious trajectory.
AND:    The visitor perceives personality in movement — one citizen is bold, the other careful.
        Neither is "wrong." Both successfully grasp the object.
```

Law 14 modulates energy injection rates. High `achievement` amplifies energy flow to motor process nodes — movements are faster, more committed. High `self_preservation` dampens energy flow and increases the activation threshold for approach actions — movements are slower, more deliberate. The visitor sees character. The system produces it through drive coefficients.

---

## OBJECTIVES SERVED

| Behavior ID | Objective | Why It Matters |
|-------------|-----------|----------------|
| B1 | Real-time motor control without LLM | Smooth grasping proves the core loop works at Fast Tick speed |
| B2 | Perception priority over planning | Collision override proves sensory injection dominates associative propagation |
| B3 | Frustration-based deadlock recovery | Trajectory bifurcation proves the system escapes failed strategies without LLM |
| B4 | Motor habit consolidation | Crystallization proves Law 6 produces measurable performance improvement |
| B5 | Multimodal integration | Limbic-shaped movement proves drive modulation reaches the motor output |

---

## INPUTS / OUTPUTS

### Primary Function: `motor_tick()`

**Inputs:**

| Parameter | Type | Description |
|-----------|------|-------------|
| visual_embedding | float[768] | SigLIP/CLIP encoding of current visual field, injected as `concept` node |
| proprioceptive_state | dict | Current position_vector, velocity_vector, joint_angles from `state:functional` nodes |
| biometric_signal | dict | HRV, stress level from Garmin — feeds limbic modulation |
| active_desires | list[Node] | Currently active `desire` nodes driving motor behavior |
| wm_coalition | list[Node] | Current Working Memory contents — used to compute C_t |

**Outputs:**

| Return | Type | Description |
|--------|------|-------------|
| action_commands | list[ActionCommand] | Fired action commands from process nodes that crossed Theta_sel |
| updated_subgraph | Graph | Modified proprioceptive and motor subgraph with new energy values |
| prediction_error | float | Current composite coherence gap — used for monitoring and frustration tracking |

**Side Effects:**

- Modifies energy values on all nodes in the motor subgraph
- May fire `action_command` on process nodes that cross Theta_sel
- May accumulate frustration energy if prediction error persists
- May trigger Law 6 consolidation on successful trajectory links (Medium Tick only)

---

## EDGE CASES

### E1: No Visual Input Available

```
GIVEN:  The visual encoder fails or returns null (camera occluded, encoder crash)
THEN:   Symbolic fallback activates (Law 8): coherence calculated via type_match * keyword_overlap.
        Motor control continues in "frugal mode" — less precise but uninterrupted.
        The citizen moves more cautiously (self_preservation drive increases automatically).
```

### E2: All Motor Process Nodes Below Threshold

```
GIVEN:  Energy injection is too low for any process node to cross Theta_sel
THEN:   No action commands fire. The citizen remains still.
        If a desire is active, prediction error accumulates, which increases injection energy
        on subsequent ticks until a process node eventually fires.
        The visitor sees a citizen hesitating — a pause before action.
```

### E3: Multiple Process Nodes Fire Simultaneously

```
GIVEN:  Two or more process nodes cross Theta_sel on the same Fast Tick
THEN:   Law 11 (Orientation Selection) arbitrates — the node with highest drive alignment fires,
        others are suppressed. Only one motor action executes per tick.
        The citizen does not attempt two movements at once.
```

### E4: Desire Node Deactivated Mid-Grasp

```
GIVEN:  The LLM (operating at strategic level) deactivates the desire node
        while the motor loop is mid-execution
THEN:   Energy injection from the desire attractor ceases.
        Active motor process nodes decay naturally over 2-3 ticks.
        The citizen's hand slows, opens, returns to rest.
        The visitor sees the citizen change their mind — a natural trailing off of movement.
```

---

## ANTI-BEHAVIORS

What should NOT happen:

### A1: LLM Called During Servo Execution

```
GIVEN:   The motor servo loop is executing (prediction error being minimized)
WHEN:    A process node needs to decide the next micro-correction
MUST NOT: Route the decision through an LLM API call
INSTEAD:  Energy propagation through the graph produces the correction —
          the physics IS the decision
```

### A2: Phantom Movement Without Energy Source

```
GIVEN:   No desire node is active and no sensory injection is occurring
WHEN:    A motor process node is evaluated
MUST NOT: Fire an action_command from residual numerical noise or floating point drift
INSTEAD:  Energy conservation (I1) guarantees that without injection,
          all motor nodes decay toward zero. Stillness is the default state.
```

### A3: Collision Ignored During Active Motor Plan

```
GIVEN:   A motor plan is executing with high energy
WHEN:    A collision event occurs
MUST NOT: Continue the motor plan as if the collision did not happen
INSTEAD:  Collision energy injection (Law 1, massive magnitude) saturates the WM
          within 1 Fast Tick, overriding the active motor plan
```

### A4: Infinite Retry Without Frustration Escalation

```
GIVEN:   A motor action fails repeatedly (high prediction error persists)
WHEN:    More than 6 Fast Ticks pass without coherence improvement
MUST NOT: Continue executing the same action indefinitely
INSTEAD:  Frustration energy accumulates (Law 16), Theta_sel drops,
          and an alternative attractor captures the WM
```

---

## MARKERS

<!-- @mind:todo Define exact energy magnitudes for collision injection — must be large enough to saturate WM in 1 tick -->
<!-- @mind:todo Calibrate frustration accumulation rate — how many ticks of failure before bifurcation? -->
<!-- @mind:proposition Consider whether motor habits should decay if not used — prevents "phantom skills" in citizens who change roles -->
<!-- @mind:escalation How does motor control interact with the 5-minute narrative tick? Motor runs at <16ms but narrative at 5min — need clear boundary -->
