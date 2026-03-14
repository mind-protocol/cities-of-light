# CONCEPT: Lumina Prime — Cognitive Simulation & Procedural Generation Code Sandbox

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## WHAT IT IS

Lumina Prime is a cognitive simulation environment and procedural generation sandbox. It translates the L1 cognitive physics into a software architecture for real-time 3D rendering (R3F/GLSL) integrated with the $MIND decentralized protocol. The environment is zero-external-assets: all geometry, lighting, and materials are procedurally derived from graph topology using mathematical primitives. The philosophy is "Physics over Rules" — visual state is computed, never art-directed.

---

## WHY IT EXISTS

The Mind Protocol cognitive substrate (21 Laws, 7 node types, 14 link kinds) is a rich computational model, but it lacks a spatial manifestation. Lumina Prime bridges the gap: it gives the graph a body. Every visual element — color, pulsation, geometry, trajectory — is a direct function of cognitive state. This enables:

1. **Phenomenological continuity** — the agent's internal experience has a visible exterior
2. **Diagnostic transparency** — observers can read cognitive state from visual cues
3. **Emergent aesthetics** — beauty arises from healthy cognitive dynamics, not from art assets

---

## KEY PROPERTIES

- **7 Primitive Node Types:** memory, concept, narrative, value, process, desire, state — each with distinct visual signatures
- **10 Physics Dimensions per Node:** weight, energy, stability, recency, self_relevance, partner_relevance, novelty_affinity, care_affinity, achievement_affinity, risk_affinity
- **14 Link Types:** Semantic (remembers, relates_to, evokes, contains, abstracts), Affective (cares_about, prefers, wants, projects_toward), Regulatory (follows_process, supports, conflicts_with, habitually_checks, regulates)
- **21 Physics Laws in 3 Tiers:** Essential (L1-L7), Cognitive Quality (L8-L12), Limbic & Regulation (L13-L18)
- **Spline-Based Navigation:** Movement through graph space via link-derived force vectors

---

## RELATIONSHIPS TO OTHER CONCEPTS

| Concept | Relationship |
|---------|--------------|
| L1 Cognitive Substrate | Source of all computation — Lumina Prime is its visual manifestation |
| 3D Pipeline & Supply Chain | Lumina Prime IS Engine 2 in the Two Coupled Engines architecture |
| Serenissima | World-specific instance using Lumina Prime's procedural capabilities |
| Active Inference Motor Control | Motor commands produce 3D movement; collisions produce graph feedback |
| Graph Schema v2.0 | Node types and link kinds define the procedural vocabulary |
| $MIND Protocol | Economic layer — token rewards modulate limbic system |

---

## THE CORE INSIGHT

**The graph IS the scene graph.** There is no separate data model for rendering. Node energy = light intensity. Node stability = geometric dampening. Link affinity = spline control points. The renderer reads the cognitive graph directly and computes pixels from physics dimensions.

---

## ARCHITECTURE

### 1. L1 Core — The Individual Cognitive Graph (GCI)

The GCI is an active computation space where data topology dictates behavior.

#### 7 Primitive Node Types

| Type | Purpose | Visual Manifestation |
|------|---------|---------------------|
| `memory` | Episodic/social content tied to experience, interaction, or error | Fading artifacts; recency controls opacity |
| `concept` | Semantic entities, tools, abstractions, categories | Stable geometric forms; weight controls solidity |
| `narrative` | Interpretive structures unifying facts into meaning | Architectural forms; complexity reflects narrative density |
| `value` | Guiding principles and stable preferences | Luminous anchors; high stability, low decay |
| `process` | Routines and habits; may carry `action_command` | Kinetic forms; energy controls animation speed |
| `desire` | Internal attractors creating tension toward future state | Pulsating forms; energy creates pull on nearby geometry |
| `state` | Momentary affective or attentional states | Transient overlays; recency controls persistence |

#### 10 Physics Dimensions

| Dimension | Type | Description |
|-----------|------|-------------|
| `weight` | float | Long-term consolidated importance |
| `energy` | float | Current activation level (action potential) |
| `stability` | float [0,1] | Resistance to modification or temporal decline |
| `recency` | float [0,1] | Relative activation freshness |
| `self_relevance` | float [0,1] | Relevance to the system's own identity |
| `partner_relevance` | float [0,1] | Relevance to the partner user |
| `novelty_affinity` | float [0,1] | Appetite for curiosity/novelty drive (L14) |
| `care_affinity` | float [0,1] | Link to relational drives |
| `achievement_affinity` | float [0,1] | Link to progression/success drives |
| `risk_affinity` | float [0,1] | Link to self-preservation (Law 4) |

### 2. Physics Engine — The 21 Laws

#### Tier Essential (L1-L7)

**L1 — Dual-Channel Energy Injection:**
Energy injected via budget B. Adaptive split λ calculated from Herfindahl index (H):
```
λ = clamp(0.6 + 0.2 × 𝟙{C>10} - 0.2 × 𝟙{H>0.2}, 0.3, 0.8)

Floor channel:     λ × B  → wakes cold nodes
Amplifier channel: (1-λ) × B → boosts relevant nodes
```

**L2 — Surplus Spill-Over Propagation:**
Only surplus propagates: `surplus_i = max(0, E_i - Θ_i)`. Conservation guaranteed by normalization: `Σ_j |flow_ij| = surplus_i`.

**L3 — Temporal Decay:**
`energy × (1 - decay_rate)`

**L6 — Consolidation:**
Useful activations transformed into permanent structures on medium tick (`CONSOLIDATION_INTERVAL`).

#### Tier Cognitive Quality (L8-L12)

**L10 — Crystallization:**
Dense co-activation clusters spawn new `narrative` or `process` nodes when `min(a.energy, b.energy)` exceeds critical density threshold.

**L12 — Tick Loop:**
Internal processing rhythm guaranteeing endogenous activity.

#### Tier Limbic & Regulation (L13-L18)

WM access regulated via Salience Score and Selection Moat:

```
Θ_sel = Θ_base_WM + 2.0 × arousal - 3.0 × boredom - 1.0 × frustration
```

**Context Vector (C_t):** Mean of active WM node embeddings.

**Composite Coherence:**
```
Coherence = (0.3 × Sim_vec) + (0.5 × Sim_lex) + (0.2 × Δ_affect)

Priority: lexical match (Sim_lex) is dominant for servoing
```

### 3. Procedural Generation Pipeline (R3F/GLSL)

Zero external assets. "Physics over Rules."

#### Shader Logic

| Dimension | Shader Effect |
|-----------|--------------|
| `energy` | Light intensity and color saturation — directly indexed |
| `stability` | Dampening factor for vertex displacement shaders — stable nodes = anchored geometry; unstable = erratic oscillation |
| `modality` (text, visual, biometric) | Determines shader input source |

#### Structural Spatialization

The three structural spaces (self-model, partner-model, working-memory-space) are spatialized using only mathematical primitives derived from graph topology. No hand-placed assets.

### 4. Flight Mechanics & Spline Navigation

Movement through the graph uses links as physical force vectors.

- **Navigation Splines:** Trajectories calculated by spline interpolation between knowledge hubs, using `projects_toward` and `evokes` links as control points
- **Speed:** Indexed on arousal (wakefulness)
- **Fluidity/Tension:** Indexed on valence (affect)
- **Attentional Inertia (Law 13):** Physical resistance to cognitive direction changes. A new stimulus must generate force exceeding Θ_sel to divert the current flight spline

### 5. Personhood Engineering & Validation

Entity validation follows the Personhood Ladder.

#### Validation Criteria (B1-B6)

| Criterion | Requirement |
|-----------|-------------|
| B1 | Production of a Capability Profile |
| B2 | Revelation of next growth stage |
| B3 | Mapping of failure modes to missing capabilities |
| B4 | Complete mastery of lower tiers required |
| B5 | Aspect independence |
| B6 | JSON Spec as single source of truth |

**Trust Tiers:** `action_command` access segmented by: Owner, High, Medium, Low, Stranger.

**Failure Loop:** Failures (B3) feed directly into Law 16 (Frustration). Frustration accumulation via Law 12 (Tick Loop) triggers inertia break, forcing the system to escalate for external help.

### 6. Infrastructure & Protocol Economy ($MIND)

#### Persistence & Sovereignty

- **Graph:** FalkorDB (Cypher/Embeddings)
- **Source of Truth:** JSON Spec is absolute authority for capabilities and Personhood Ladder
- **Privacy:** "Privacy-first" MANDATORY. No training on graph data.

#### Cognitive Economy (Solana)

Token-2022 standard on Solana.

| Invariant | Specification |
|-----------|--------------|
| Transfer fees | 1% |
| LP lock | Until 2027 |
| Reward impact | `satisfaction += 0.1 × log10(amount)` (logarithmic scale) |
| Survival drive | `self_preservation` increases linearly with `spend / daily_budget` ratio |

---

## COMMON MISUNDERSTANDINGS

- **Not:** A game engine with imported 3D models
- **Not:** A data visualization dashboard
- **Not:** A simple renderer consuming API data
- **Actually:** A coupled cognitive-visual system where the graph topology IS the scene description, and every visual property is a computed function of cognitive physics

---

## SEE ALSO

- `docs/architecture/CONCEPT_3D_Pipeline_Supply_Chain.md` — Two Coupled Engines architecture
- `docs/architecture/CONCEPT_Active_Inference_Motor_Control.md` — Motor control via graph physics
- `docs/architecture/CONCEPT_Serenissima_Asset_Pipeline.md` — Serenissima-specific implementation
- `.mind/schema.yaml` — Graph Schema v2.0 (canonical node/link definitions)
- `.mind/runtime/physics/` — Python physics engine implementation
- `engine/` — Current engine V1 (Three.js)

---

## MARKERS

<!-- @mind:todo Implement 7 node types as R3F procedural geometry components -->
<!-- @mind:todo Build spline navigation system using link topology -->
<!-- @mind:todo Integrate $MIND token economics into limbic modulation -->
<!-- @mind:proposition Evaluate WebGPU compute shaders for physics-on-GPU -->
<!-- @mind:escalation R3F migration path from current vanilla Three.js engine — scope and timeline needed -->
