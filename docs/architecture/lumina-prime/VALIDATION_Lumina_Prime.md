# Lumina Prime — Validation: What Must Be True

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Lumina_Prime.md
PATTERNS:        ./PATTERNS_Lumina_Prime.md
BEHAVIORS:       ./BEHAVIORS_Lumina_Prime.md
THIS:            VALIDATION_Lumina_Prime.md (you are here)
ALGORITHM:       ./ALGORITHM_Lumina_Prime.md
IMPLEMENTATION:  ./IMPLEMENTATION_Lumina_Prime.md
SYNC:            ./SYNC_Lumina_Prime.md
```

---

## PURPOSE

**Validation = what we care about being true.**

Not mechanisms. Not test paths. Not how things work.

What properties, if violated, would mean the system has failed its purpose?

Lumina Prime exists to give the cognitive graph a visible body. If the body lies — if it shows something other than what the graph contains — the entire system is worse than useless. These invariants protect the truth of the manifestation.

---

## INVARIANTS

### V1: Cognition Is Visible

**Why we care:** This is the entire reason Lumina Prime exists. If a physics dimension changes and no visual property changes in response, there is a blind spot in the manifestation. The observer cannot read cognitive state. Diagnostic transparency fails. The mind has a silent tumor.

```
MUST:   Every physics dimension change on any visible node must produce a detectable visual change within 1 render frame (16ms at 60fps)
NEVER:  A node's visual appearance may persist unchanged while its physics dimensions have been updated by the physics tick
```

### V2: Physics Laws Produce Visual Truth

**Why we care:** The 21 laws are the computational engine of cognition. Each law produces a specific mathematical output — an energy change, a threshold adjustment, a node spawn, a decay. If the visual system does not faithfully reflect these outputs, the user sees a fiction. They see a stable mind when tension is accumulating. They see health when decay is consuming. The manifestation becomes decoration instead of diagnosis.

```
MUST:   Each of the 21 physics laws must have at least one traceable visual consequence — a specific shader parameter, geometry change, or post-processing effect that corresponds to the law's output
NEVER:  A physics law may execute without any visual consequence to any observer
```

### V3: Zero External Assets

**Why we care:** External assets break the computed-from-physics contract. A hand-placed mesh has no relationship to cognitive state. A texture file is a constant that cannot change when the graph changes. Every external asset is a lie — it shows something that is not a function of the mind's state. Moreover, external assets create supply chain dependencies, storage costs, and art pipeline requirements that defeat the elegance of procedural generation.

```
MUST:   All geometry, materials, lighting, and animation must be generated from mathematical functions with physics dimensions as inputs
NEVER:  The rendering pipeline may load any external 3D model, texture, image, or pre-baked animation file (.glb, .obj, .fbx, .png, .jpg, .hdr, .mp4, etc.)
```

### V4: Energy Conservation Under Propagation

**Why we care:** If energy is created from nothing during propagation (Law 2), the system inflates — everything gets brighter, tension accumulates without cause, moments flip from phantom energy. If energy disappears during propagation (beyond friction losses), the system deflates — the mind goes dark without reason. Conservation is the thermodynamic law of the cognitive universe. Break it, and the physics produces nonsense.

```
MUST:   For every Surplus Spill-Over (Law 2) propagation step: sum of energy entering target nodes + friction losses = surplus energy leaving source node
NEVER:  Total system energy may increase without an explicit injection event (Law 1) or external stimulus
```

### V5: Privacy Is Absolute

**Why we care:** The cognitive graph is the most intimate data structure imaginable — it contains the full computational state of a mind. Memories, desires, values, fears, relationships. If any of this data leaks beyond the local environment, it is a violation of cognitive sovereignty. There is no acceptable amount of leakage. Privacy is not a feature; it is a precondition of trust.

```
MUST:   Graph data remains local to the rendering environment. No graph state (node IDs, dimensions, link weights, topology) may be transmitted to any external service, telemetry endpoint, or training pipeline
NEVER:  The system may send cognitive graph data over a network connection for any purpose other than authorized graph persistence to the owner's own FalkorDB instance
```

### V6: JSON Spec Is Absolute Authority

**Why we care:** The Personhood Ladder (B1-B6) defines what capabilities an entity has, what stage of development it is in, and what trust tier gates which actions. If the runtime system diverges from the JSON Spec — if code grants capabilities the spec does not authorize, or restricts capabilities the spec permits — the personhood model is broken. The spec is the constitution. Code is the implementation. The constitution wins.

```
MUST:   All capability checks, trust tier gates, and personhood validation decisions must resolve against the JSON Spec as the single source of truth
NEVER:  Hardcoded capability grants or trust tier overrides may exist in application code that bypass the JSON Spec
```

### V7: Aspect Independence

**Why we care:** Criterion B5 of the Personhood Ladder requires that aspects (cognitive modules, skill domains, personality facets) operate independently. If aspect A's failure cascades into aspect B's corruption, the system has a contagion path. A failure in spatial navigation should not corrupt emotional regulation. A bug in the $MIND integration should not break memory retrieval. Independence is fault isolation for the mind.

```
MUST:   Each cognitive aspect must compute independently — its outputs may influence other aspects through the graph (via links and propagation), but its internal computation must not share mutable state with other aspects
NEVER:  A failure in one aspect (exception, NaN, timeout) may corrupt the state of another aspect
```

### V8: Selection Moat Consistency

**Why we care:** The Selection Moat (Law 13) is the attention filter. If it is inconsistent — if nodes appear in working memory without exceeding the threshold, or if nodes exceeding the threshold are absent from working memory — then the attention model is broken. The user sees things the mind is not attending to, or misses things it is. The cognitive space becomes incoherent.

```
MUST:   Every node in the working-memory visual space must have a salience score exceeding Theta_sel at the time of its most recent tick evaluation
NEVER:  A node may persist in the working-memory visual space after its salience drops below Theta_sel (removal must occur at next tick evaluation)
```

### V9: Navigation Follows Topology

**Why we care:** Spline navigation is not decoration — it is the cognitive constraint on attention. If the user can fly freely without following link topology, they experience unconstrained movement that has no relationship to how the mind moves between ideas. Attentional inertia (Law 13) would be meaningless. The experience would be "flying through a pretty scene" instead of "riding a thought."

```
MUST:   All navigation trajectories must be computed from link topology — spline control points must correspond to graph nodes connected by links
NEVER:  The user may navigate to a node that is not reachable through the current link graph (except via explicit search/jump that overrides inertia with sufficient force)
```

### V10: Economic Invariants Hold

**Why we care:** The $MIND token economics have protocol-level invariants: 1% transfer fees, LP lock until 2027, logarithmic satisfaction scaling, linear self-preservation with spend ratio. If the cognitive visualization shows satisfaction levels that do not match the logarithmic formula, or self-preservation that does not track spend ratio, the economic layer is decoupled from the limbic system. The mind would feel rich when it is poor, or calm when it should be anxious.

```
MUST:   satisfaction delta = exactly 0.1 * log10(amount) for every $MIND receipt, self_preservation = linear function of spend/daily_budget
NEVER:  The limbic system may apply economic effects using any formula other than the canonical Token-2022 specification
```

---

## PRIORITY

| Priority | Meaning | If Violated |
|----------|---------|-------------|
| **CRITICAL** | System purpose fails | Unusable — the manifestation is a lie |
| **HIGH** | Major value lost | Degraded severely — key behaviors broken |
| **MEDIUM** | Partial value lost | Works but worse — edge cases compromised |

---

## INVARIANT INDEX

| ID | Value Protected | Priority |
|----|-----------------|----------|
| V1 | Cognitive transparency — every physics change is visible | CRITICAL |
| V2 | Physics law fidelity — 21 laws produce 21 visual consequences | CRITICAL |
| V3 | Procedural purity — zero external assets | CRITICAL |
| V4 | Energy conservation — no phantom energy creation or destruction | CRITICAL |
| V5 | Cognitive privacy — no graph data leaks | CRITICAL |
| V6 | Personhood authority — JSON Spec is the constitution | HIGH |
| V7 | Fault isolation — aspect independence prevents contagion | HIGH |
| V8 | Attention integrity — Selection Moat consistency | HIGH |
| V9 | Navigation authenticity — trajectories follow cognitive topology | MEDIUM |
| V10 | Economic fidelity — token formulas are exact | MEDIUM |

---

## MARKERS

<!-- @mind:todo Define measurable test for V1 — how to detect "visual change within 1 frame" programmatically -->
<!-- @mind:todo Enumerate the 21 visual consequences for V2 — one per law -->
<!-- @mind:proposition V3 exception: should procedurally generated assets be cacheable to disk for performance? If so, they must be regenerable from physics state alone -->
<!-- @mind:escalation V5 scope: does rendering to a shared WebXR session constitute "transmission"? Need privacy model for multi-observer scenarios -->
