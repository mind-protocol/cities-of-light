# Active Inference Motor Control — Patterns: Movement as Energy Gradient Descent

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Motor_Control.md
THIS:            PATTERNS_Motor_Control.md (you are here)
BEHAVIORS:       ./BEHAVIORS_Motor_Control.md
ALGORITHM:       ./ALGORITHM_Motor_Control.md
VALIDATION:      ./VALIDATION_Motor_Control.md
IMPLEMENTATION:  ./IMPLEMENTATION_Motor_Control.md
SYNC:            ./SYNC_Motor_Control.md

IMPL:            .mind/runtime/physics/motor_control.py (TODO — does not exist yet)
```

### Bidirectional Contract

**Before modifying this doc or the code:**
1. Read ALL docs in this chain first
2. Read the linked IMPL source file

**After modifying this doc:**
1. Update the IMPL source file to match, OR
2. Add a TODO in SYNC_Motor_Control.md: "Docs updated, implementation needs: {what}"
3. Run tests: `python -m pytest tests/test_motor_control.py`

**After modifying the code:**
1. Update this doc chain to match, OR
2. Add a TODO in SYNC_Motor_Control.md: "Implementation changed, docs need: {what}"
3. Run tests: `python -m pytest tests/test_motor_control.py`

---

## THE PROBLEM

Classical agent architectures place the LLM in the action loop: perceive, think (LLM), act. This produces two fatal problems for motor control:

**Latency kills continuous movement.** An LLM round-trip takes 500ms-3s. Motor control requires corrections within 16ms (one Fast Tick). A citizen reaching for a glass cannot wait half a second between each micro-adjustment of their fingers. By the time the LLM responds, the glass has already tipped over.

**Indeterminism kills smoothness.** The same prompt sent twice to an LLM produces different outputs. In motor control, this means the next trajectory correction is unpredictable — the arm jitters, the hand oscillates, the grasp never converges. The citizen looks drunk.

**Without this module:** Citizens can only execute pre-programmed animations or make one-shot LLM-planned movements with no real-time correction. They cannot react to collisions, adapt to moving targets, recover from failed grasps, or develop motor habits. They are puppets on strings, not embodied agents.

---

## THE PATTERN

**Movement is not commanded — it emerges from energy gradients.**

The agent does not "decide" to move its arm. Instead:

1. A `desire` node (e.g., "grasp the glass rod") creates a persistent energy attractor in the cognitive graph
2. The prediction error between current visual input and the Working Memory centroid (C_t) generates injection energy via Law 1
3. This energy propagates through motor `process` nodes (e.g., "arm_extend", "fine_grasping", "wrist_rotate") until one accumulates enough energy to fire (Law 17)
4. The fired `action_command` produces physical movement in the 3D world
5. New sensory feedback from the movement closes the loop, updating the prediction error

The LLM never touches this cycle. It operates only at "Consciousness Level: Full" for strategic planning — deciding *what* to grasp, not *how* to grasp it. In "Subconscious" mode, the agent continues manipulating objects via consolidated reflexes (high-weight `process` nodes).

**The key insight:** The same graph physics that governs narrative tension and belief propagation in the social world governs motor control in the physical world. Energy injection (Law 1), propagation (Law 2), decay (Law 3), selection (Law 4), and frustration (Law 16) are universal mechanisms. Motor control is not a separate system bolted on — it is the physics applied to a different subgraph topology.

---

## BEHAVIORS SUPPORTED

- **B1: Smooth Grasping Emerges from Servo Loop** — The prediction error drives continuous micro-corrections, producing smooth convergence on the target rather than jerky step-by-step movement
- **B2: Collision Recovery Saturates Working Memory** — Physics coupling (massive energy injection on collision) forces proprioceptive nodes past Theta_sel, instantly reorienting cognition toward self-preservation
- **B3: Trajectory Bifurcation on Deadlock** — Frustration gradient (Law 16) lowers Theta_sel after persistent failure, allowing alternative motor attractors to capture the WM
- **B4: Motor Habits Crystallize Over Repetition** — Law 6 consolidation transforms successful trajectories into high-weight permanent process nodes

## BEHAVIORS PREVENTED

- **A1: LLM-in-the-Loop Jitter** — The pattern structurally excludes the LLM from the servo cycle; there is no code path from prediction error to LLM call
- **A2: Phantom Impulses** — Energy conservation invariant (I1) ensures no movement occurs without a traceable energy source
- **A3: Infinite Retry Loops** — Frustration accumulation guarantees that failing actions are eventually abandoned

---

## PRINCIPLES

### Principle 1: The Servo Loop Is Closed Within the Graph

Every component of the motor control cycle — sensory encoding, prediction error calculation, energy injection, process node activation, action command firing, and sensory feedback — lives within the L1 cognitive graph. There is no external control system, no separate motor controller, no bypass. The graph is both the brain and the spinal cord.

This matters because it means motor control inherits all the properties of the physics engine for free: decay prevents stale motor plans from persisting; consolidation creates motor habits; frustration handles deadlocks; limbic modulation adjusts aggressiveness. These are not features we build — they are emergent from applying the existing physics to a proprioceptive subgraph.

### Principle 2: Perception Is Always Louder Than Planning

Law 1 injection (direct sensory input) always takes priority over Law 2 propagation (internal associative spread). This means a collision signal overwhelms any motor plan in progress. A moving obstacle detected by the visual stream interrupts trajectory execution.

This matters because it guarantees safety. The agent cannot become so absorbed in its motor plan that it ignores the physical world. Self-preservation is not a feature — it is a consequence of the energy priority hierarchy.

### Principle 3: Frustration Is the Escape Valve, Not a Bug

When a motor plan fails repeatedly, frustration energy accumulates. This is not a pathology to be suppressed — it is the mechanism that prevents the system from getting stuck. Frustration lowers the Selection Moat, allowing alternative motor strategies to compete for Working Memory. The agent that "gives up" on a stuck door and tries the window is exhibiting healthy frustration dynamics.

This matters because every control system needs a way to exit failed strategies. Classical systems use timeouts. This system uses an energy gradient that naturally favors abandonment as failure persists — a bio-inspired mechanism that produces more adaptive behavior than a simple timer.

### Principle 4: Stability Is Synthetic Friction

The `stability` dimension on proprioceptive nodes acts as a damping coefficient. High stability means the node resists rapid energy changes — movements are smooth, anchored, predictable. Low stability means the node responds rapidly to energy perturbations — movements are jittery, oscillatory, reactive.

This matters because it gives us a single dial for motor smoothing that is consistent with the rest of the physics. We do not need a separate smoothing algorithm — the graph's own damping mechanics produce it.

---

## DATA

| Source | Type | Purpose / Description |
|--------|------|-----------------------|
| `.mind/schema.yaml` | FILE | Graph schema v2.0 — defines node types, dimensions, and link kinds used by motor subgraph |
| `.mind/runtime/physics/` | DIR | Python implementation of the 21 Laws — motor control applies Laws 1, 2, 3, 4, 6, 11, 14, 16, 17 |
| `docs/architecture/CONCEPT_Active_Inference_Motor_Control.md` | FILE | Concept document — full technical specification of the motor control architecture |
| SigLIP/CLIP model weights | EXTERNAL | Visual encoder for converting camera frames to embeddings injected as `concept` nodes |
| Garmin Connect API | EXTERNAL | Biometric data (HRV, stress) for limbic modulation of motor aggressiveness |

---

## DEPENDENCIES

| Module | Why We Depend On It |
|--------|---------------------|
| `.mind/runtime/physics/` | Provides the 21 Laws implementation — motor control is an application of these laws, not a replacement |
| L1 Cognitive Substrate (Working Memory) | The Context Vector C_t is the target image for visual servoing; WM coalition determines which motor nodes are active |
| Law 17 (Impulse Accumulation) | Action command firing — the mechanism that translates accumulated energy into physical motor commands |
| Law 14 (Limbic Modulation) | Achievement drive creates attraction toward targets; self-preservation creates repulsion from collision zones |
| Lumina Prime (3D Manifestation) | Receives action commands and translates them into skeletal animation; returns collision feedback as Law 1 injection |

---

## INSPIRATIONS

**Active Inference (Karl Friston):** The theoretical foundation. Motor control is prediction error minimization — the agent acts to make its sensory predictions come true. The composite coherence calculation is a simplified free energy functional.

**Cerebellar Motor Smoothing (Neuroscience):** The proprioceptive subgraph with `stability` damping mirrors the cerebellum's role in smoothing voluntary movement. The synthetic cerebellum does not plan movements — it dampens oscillations and maintains kinematic homeostasis.

**Attractor Dynamics (Dynamical Systems Theory):** Motor targets are energy attractors in the graph. Movement is gradient descent toward these attractors. Frustration creates bifurcation points where the system can jump to alternative attractors — directly analogous to bifurcation in nonlinear dynamical systems.

**Subsumption Architecture (Rodney Brooks):** The priority hierarchy (perception > association, collision > plan) echoes Brooks' insight that reactive behavior should subsume planned behavior. But where Brooks used fixed priority layers, this system achieves the same hierarchy through energy magnitudes.

---

## SCOPE

### In Scope

- Proprioceptive subgraph design and maintenance (`state:functional` nodes for position, velocity, joint angles)
- Active inference loop: sensory encoding, prediction error calculation, energy injection, process node selection, action command firing
- Composite coherence calculation (multimodal similarity fusion)
- Frustration gradient mechanism for deadlock recovery
- Motor habit consolidation via Law 6
- Limbic modulation of motor aggressiveness (Law 14)
- Physics coupling: collision energy injection into proprioceptive subgraph

### Out of Scope

- **Visual encoder training/deployment** (SigLIP/CLIP) — see: external ML infrastructure
- **3D skeletal animation** from action commands — see: Lumina Prime
- **Strategic motor planning** ("what to grasp") — see: LLM planning layer
- **Inverse kinematics** joint chain solving — see: 3D engine / animation system
- **New motor primitive discovery** — process nodes are seeded by design or narrative, not learned from scratch
- **Biometric hardware integration** (Garmin SDK) — see: device layer; motor control consumes the data as Law 1 injection

---

## MARKERS

<!-- @mind:todo Define the exact Fast Tick frequency for motor control — 16ms target needs hardware validation on Quest 3 -->
<!-- @mind:proposition Evaluate whether stability damping should be per-node or per-subgraph — per-node is more expressive but more expensive -->
<!-- @mind:escalation The current physics tick is 5 minutes for narrative; motor control needs <16ms — tick stratification architecture decision required -->
<!-- @mind:proposition Consider whether SigLIP or CLIP is better for Venice visual context — SigLIP has better zero-shot but CLIP has richer spatial features -->
