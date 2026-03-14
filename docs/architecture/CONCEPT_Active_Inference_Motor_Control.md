# CONCEPT: Active Inference Motor Control — Spatial Motor Control via L1 Cognitive Substrate

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## WHAT IT IS

A bio-inspired motor control system implemented entirely within the L1 cognitive substrate. Instead of routing motor commands through an LLM (expensive, latent, non-deterministic), this architecture uses attractor dynamics and graph physics for visual servoing. Motor behavior emerges from energy gradients in the graph — no LLM in the real-time control loop.

The system models movement as a prediction error minimization problem: the agent continuously compares its current sensory state against the Working Memory centroid (C_t), and the resulting energy differential drives corrective motor commands.

---

## WHY IT EXISTS

Classical agent architectures place the LLM in the action loop: perceive → think (LLM) → act. This creates two fatal problems:

1. **Latency** — LLM round-trips (500ms-3s) make real-time motor control impossible
2. **Indeterminism** — LLM outputs vary between calls, producing jittery, unreliable movement

By grounding motor control in graph physics (which runs on the Fast Tick at <16ms), the agent achieves continuous, smooth, deterministic movement while reserving the LLM for strategic planning only.

---

## KEY PROPERTIES

- **Multimodal Memory Integration:** Sensory streams (visual, spatial, biometric, textual) are encoded as graph nodes via specialized encoders (SigLIP/CLIP for visual, XYZ coordinates for spatial, Garmin HRV for biometric), then injected via Law 1
- **Synthetic Cerebellum:** A high-frequency proprioceptive subgraph maintains kinematic homeostasis through `state:functional` nodes encoding position, velocity, and joint angles. The `stability` dimension acts as synthetic friction coefficient — high stability dampens oscillations
- **Physics Coupling:** Physical disturbances (collisions) inject massive energy into the proprioceptive subgraph, forcing these nodes past the Selection Moat (Θ_sel) to saturate the WM, instantly reorienting cognition toward self-preservation
- **Frustration-Driven Trajectory Correction:** Persistent prediction error accumulates frustration energy (Law 16), which lowers Θ_sel, breaking attentional inertia and allowing alternative motor attractors to capture the WM

---

## RELATIONSHIPS TO OTHER CONCEPTS

| Concept | Relationship |
|---------|--------------|
| L1 Cognitive Substrate (21 Laws) | Motor control is a direct application of Laws 1, 6, 11, 14, 16, 17 |
| Working Memory (WM) | The Context Vector C_t serves as the "target image" for visual servoing |
| Limbic Modulation (Law 14) | Achievement drive creates attraction field toward target; self-preservation creates repulsion from collision zones |
| Action Nodes (Law 17) | Motor commands fire when process nodes accumulate energy past Θ_sel |
| Lumina Prime | 3D manifestation of motor commands; collision feedback loops back as Law 1 injection |
| Serenissima Citizens | Each citizen's motor behavior (pathfinding, gestures) could use this architecture |

---

## THE CORE INSIGHT

**Movement is not commanded — it emerges from energy gradients.**

The agent doesn't "decide" to move its arm. Instead:
1. A `desire` node creates a persistent energy attractor in the graph
2. The prediction error between current visual input and C_t generates injection energy (Law 1)
3. This energy propagates through motor `process` nodes until one accumulates enough to fire (Law 17)
4. The fired `action_command` produces physical movement
5. New sensory feedback closes the loop

The LLM never touches this cycle. It operates at "Consciousness Level: Full" only for strategic planning — deciding *what* to grasp, not *how* to grasp it.

---

## ARCHITECTURE

### 1. Multimodal Sensory Encoding

| Modality | Encoder | L1 Node Type | Role in Motor Cycle |
|----------|---------|-------------|---------------------|
| Visual | SigLIP / CLIP | `concept` | Target identification and obstacle detection via visual embeddings |
| Spatial | XYZ Coordinates / Posture | `memory` | Successful trajectory cartography and spatial invariants |
| Biometric | Garmin HRV/Stress | `state` | Limbic modulation of aggressiveness and fluidity |
| Textual | Logs / Instructions | `memory` | Symbolic constraint recall (e.g., "delicate manipulation") |

**Symbolic Fallback (Law 8):** When embeddings fail or resources are constrained, the system falls back to `type_match * keyword_overlap`, ensuring servo continuity in frugal mode.

### 2. Proprioceptive Subgraph (Synthetic Cerebellum)

```
state:functional nodes
├── position_vector     (content: [x, y, z])
├── velocity_vector     (content: [vx, vy, vz])
├── joint_angles        (content: [θ1, θ2, ...θn])
└── Properties:
    ├── energy:     kinetic impulse reflection
    ├── stability:  [0,1] — synthetic friction coefficient
    ├── modality:   spatial (isolation tag for priority routing)
    └── recency:    proprioceptive feedback freshness
```

**Damping:** `stability` acts as a dampening factor. High stability = smooth, anchored movement. Low stability = oscillatory, erratic motion. This is the synthetic equivalent of cerebellar motor smoothing.

### 3. Active Inference Loop — Target Image vs Current State

Motor control is modeled as an energy gradient descent minimizing prediction error between current stimulus and the WM centroid C_t.

**Context Vector (C_t):** Weighted average of embeddings in the active WM coalition. The target image (`desire` or `narrative` node) exerts constant pressure to align C_t with its own signature.

**Composite Coherence Calculation:**

```
Coherence = (0.3 × Sim_vec) + (0.5 × Sim_lex) + (0.2 × Δ_affect)

Where:
  Sim_vec  — cosine similarity between visual embedding and C_t (thematic field)
  Sim_lex  — strict identifier match (e.g., "red_brick") — DOMINANT signal for servoing
  Δ_affect — incongruence between current limbic tension and stimulus (surprise signal)
```

**Motor Feedback:** Prediction error `(1 - Coherence)` generates injection energy (Law 1), distributed to "warm up" corrective `process` nodes (e.g., gripper readjustment).

### 4. Law Application for Motor Cycle

| Law | Motor Function | Effect |
|-----|---------------|--------|
| **L1** (Dual-Channel Injection) | Motor schema reactivation | Floor channel wakes "cold" grasping nodes on brick detection; Amplifier boosts most coherent trajectory |
| **L11** (Orientation Selection) | Action tendency arbitrage | Stabilizes movement direction ("Grasp" vs "Move") via desire-process coalition |
| **L14** (Limbic Modulation) | Drive regulation | `achievement` drive → attraction field toward target; `self_preservation` → repulsion from collision zones |
| **L16** (Frustration) | Kinematic deadlock detection | Persistent prediction error accumulates energy, preparing trajectory bifurcation |
| **L6** (Consolidation) | Motor habit crystallization | Medium Tick reinforces weights of successful trajectory links, transforming movement sequences into permanent `process` nodes |

### 5. Frustration Gradient and Trajectory Correction

```
Phase 1: DEADLOCK
  Arm blocked; prediction error (1 - Coh) remains high despite energy injection

Phase 2: PHYSICS REACTION
  state:frustration node energy grows
  → Drastically reduces Selection Moat Θ_sel (Law 4)

Phase 3: MOTOR RESULT
  Attentional inertia broken
  → System abandons ineffective process
  → Alternative attractor (e.g., "arm withdrawal") captures WM
```

### 6. Action Command Execution (Process Nodes)

Physical execution triggered by Law 17 (Impulse Accumulation). When a `process` node accumulates energy exceeding Θ_sel under drive pressure, its `action_command` fires.

```json
{
  "id": "process:fine_grasping",
  "type": "process",
  "content": "Precision grasping",
  "action_command": "arm_execute(grasp, pressure=0.2)",
  "action_context": "embedding_signature_spatial_0x442",
  "drive_affinity": {
    "achievement": 0.8,
    "self_preservation": 0.3
  },
  "stability": 0.85,
  "weight": 0.72,
  "recency": 0.9,
  "energy": 0.65
}
```

---

## INVARIANTS

### I1: Energy Conservation in Motor Propagation

During motor propagation (Law 2), energy is strictly conserved: `Σ_j |flow_ij| = surplus_i`. The source distributes its surplus and falls back exactly to its threshold Θ_i. No phantom impulses are generated by the graph.

### I2: Perception Priority

Direct injection (Law 1) of visual streams takes priority over associative propagation (Law 2), guaranteeing reaction to environmental changes in less than one Fast Tick (L12).

---

## OPERATIONAL FRAME

Motor control is an **emergent property** of graph physics running on the Fast Tick. The LLM never intervenes in servoing — it is only solicited at "Consciousness Level: Full" for strategic planning or narrative articulation of action. In "Subconscious" mode, the agent continues manipulating objects via consolidated reflexes (high-weight `process` nodes).

---

## COMMON MISUNDERSTANDINGS

- **Not:** A traditional robotics control loop with PID controllers
- **Not:** LLM-in-the-loop for real-time movement decisions
- **Not:** Pre-programmed animation sequences
- **Actually:** Emergent motor behavior from energy dynamics in the cognitive graph, with the LLM reserved exclusively for high-level strategic planning

---

## SEE ALSO

- `docs/narrative/physics/ALGORITHM_Physics.md` — Physics laws governing energy propagation
- `docs/architecture/CONCEPT_Lumina_Prime.md` — 3D manifestation and collision feedback
- `docs/architecture/CONCEPT_3D_Pipeline_Supply_Chain.md` — Two coupled engines architecture
- `.mind/schema.yaml` — Graph schema v2.0 (node types, dimensions, link kinds)
- `.mind/runtime/physics/` — Python implementation of physics engine

---

## MARKERS

<!-- @mind:todo Implement proprioceptive subgraph node creation in physics bridge -->
<!-- @mind:todo Define Fast Tick frequency for motor control (target: <16ms) -->
<!-- @mind:proposition Evaluate SigLIP vs CLIP for visual encoding in Venice context -->
<!-- @mind:escalation Fast Tick frequency for motor control vs current 5-minute physics tick — needs architectural decision on tick stratification -->
