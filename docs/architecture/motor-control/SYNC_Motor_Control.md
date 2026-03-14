# Active Inference Motor Control — Sync: Current State

```
LAST_UPDATED: 2026-03-14
UPDATED_BY: @nervo
STATUS: PROPOSED
```

---

## MATURITY

**What's canonical (v1):**
- The CONCEPT document (`docs/architecture/CONCEPT_Active_Inference_Motor_Control.md`) — approved technical specification
- The documentation chain (OBJECTIVES through IMPLEMENTATION) — fully specified, reviewed
- The composite coherence formula: `0.3 * Sim_vec + 0.5 * Sim_lex + 0.2 * Delta_affect`
- The invariant set (V1-V7) — energy conservation, perception priority, LLM isolation, frustration escape, tick budget, rest stillness, consolidation integrity
- The decay rate of 0.02 per tick — Venice-calibrated, consistent with narrative physics

**What's still being designed:**
- Fast Tick frequency: target is <16ms but this conflicts with the current 5-minute narrative physics tick. Tick stratification architecture needed.
- Python/JS bridge protocol for motor-bridge.js — subprocess, WebSocket, or shared memory? Latency implications are significant.
- Exact numerical constants: COLLISION_MAGNITUDE, PATIENCE_TICKS, FRUSTRATION_RATE, MOAT_REDUCTION_RATE — specified with reasonable defaults but not calibrated against real scenarios.
- SigLIP vs CLIP for visual encoding — SigLIP has better zero-shot performance but CLIP has richer spatial features. Venice context may favor one.

**What's proposed (v2+):**
- Motor habit decay (if unused) — prevents phantom skills in citizens who change roles
- Async visual encoding pipeline (1 tick behind) — needed if SigLIP inference exceeds 10ms
- Multi-citizen motor coordination — citizens carrying the same object need synchronized motor graphs
- Haptic feedback integration — for human visitors in VR who interact with citizens physically

---

## CURRENT STATE

Nothing is implemented. The module exists entirely as documentation and specification. The CONCEPT document was written on 2026-03-14 and the full documentation chain (7 documents) was created the same day. The specification is detailed enough to begin implementation: data structures are defined, algorithms are pseudocoded, invariants are enumerated, file paths are proposed, and configuration constants have default values.

The physics engine that this module depends on (`.mind/runtime/physics/`) exists and implements the 21 Laws. The FalkorDB graph is operational. The 3D client (Three.js) is running. The server bridge (`src/server/`) exists. The foundational infrastructure is present — what is missing is the motor control module itself and the Fast Tick scheduling layer that would drive it.

The most significant architectural blocker is tick stratification: the narrative physics runs on a 5-minute tick, but motor control needs <16ms. These cannot be the same tick. An architecture decision is needed on how Fast Tick and Slow Tick coexist — do they share the graph? Are they separate processes? Does the Fast Tick operate on a subgraph shadow copy?

---

## IN PROGRESS

Nothing is in progress. The module is in PROPOSED status.

---

## RECENT CHANGES

### 2026-03-14: Full Documentation Chain Created

- **What:** Created the complete 7-document chain (OBJECTIVES, PATTERNS, BEHAVIORS, ALGORITHM, VALIDATION, IMPLEMENTATION, SYNC) from the CONCEPT specification
- **Why:** The motor control architecture needs formal documentation before implementation begins. The doc chain captures design decisions, invariants, and implementation guidance that would otherwise be lost or reinvented
- **Files:** `docs/architecture/motor-control/` — all 7 new files
- **Struggles/Insights:** The main tension is between the motor control's need for <16ms tick rate and the narrative physics' 5-minute tick. These are fundamentally different timescales operating on the same graph. The frustration gradient mechanism is elegant on paper but the numerical constants (PATIENCE_TICKS, FRUSTRATION_RATE, MOAT_REDUCTION_RATE) will need extensive tuning against real motor scenarios. The symbolic fallback (Law 8) is critical — starting implementation with symbolic-only (no SigLIP) is the pragmatic path.

---

## KNOWN ISSUES

### Tick Stratification Not Designed

- **Severity:** critical
- **Symptom:** Motor control requires <16ms Fast Tick but current physics runs on 5-minute intervals
- **Suspected cause:** The physics engine was designed for narrative (slow) dynamics, not motor (fast) dynamics
- **Attempted:** Not yet — this is a design gap, not a bug

### Python/JS Bridge Latency Unknown

- **Severity:** high
- **Symptom:** Motor commands generated in Python must reach the Three.js 3D engine in JavaScript. Bridge latency is unknown.
- **Suspected cause:** The current server architecture uses HTTP/WebSocket for client communication but the motor bridge may need lower-latency IPC
- **Attempted:** Not yet — requires prototyping

### Visual Encoder Latency On Quest 3

- **Severity:** high
- **Symptom:** SigLIP/CLIP inference may exceed the 16ms tick budget on Quest 3 equivalent compute
- **Suspected cause:** Vision transformer inference is GPU-intensive; Quest 3 has mobile-class GPU
- **Attempted:** Not yet — requires benchmarking. Symbolic fallback (Law 8) is the planned mitigation.

---

## HANDOFF: FOR AGENTS

**Your likely VIEW:** VIEW_Implement

**Where I stopped:** Documentation complete. Zero lines of code written. The spec is ready to be turned into code.

**What you need to understand:**
The motor control module is an APPLICATION of the existing 21 Laws to a proprioceptive subgraph. You do not need to write new physics — you need to create the right graph topology (proprioceptive nodes, motor process nodes, frustration state) and wire the existing Law functions to run on it at Fast Tick speed. Start with `composite_coherence.py` and `frustration.py` — these are pure functions with no external dependencies and can be unit tested immediately. Leave visual encoding for last; use symbolic fallback initially.

**Watch out for:**
- The decay rate (0.02) is Venice-calibrated and shared with narrative physics. Do not change it for motor control without explicit approval — this number is a project-wide constant.
- Energy conservation (V1) is the invariant most likely to be violated by floating point accumulation. Use double precision and add an energy audit at the end of each tick that logs any drift > 1e-8.
- The frustration mechanism has a hysteresis design (ticks_since_improve reduces by 2 on improvement, not resets to 0). This is intentional — do not simplify it to a boolean reset.

**Open questions I had:**
- Should the motor subgraph be physically isolated in FalkorDB (separate graph) or logically isolated (modality tag filtering)? Performance implications differ.
- Should consolidation_hook run every N Fast Ticks or on a separate timer? If on a timer, it may miss short motor sequences.
- Can frustration energy flow to other subgraphs (e.g., affecting the citizen's mood in the narrative layer)? This would be a beautiful emergent property but adds complexity.

---

## HANDOFF: FOR HUMAN

**Executive summary:**
The Active Inference Motor Control module is fully documented across a 7-document chain, from objectives through implementation plan. It specifies how citizens achieve real-time motor control (grasping, collision recovery, habit formation) using graph physics alone — no LLM in the loop. Zero code has been written. The specification is implementation-ready but blocked on a tick stratification architectural decision (motor <16ms vs narrative 5min on the same graph).

**Decisions made:**
- Composite coherence weights: 0.3 vector / 0.5 lexical / 0.2 affective — lexical dominates because strict ID matching is most reliable for motor targeting
- Seven invariants defined, three CRITICAL (energy conservation, perception priority, LLM isolation), two HIGH (frustration escape, tick budget), two MEDIUM (rest stillness, consolidation integrity)
- Implementation order: start with symbolic fallback (no visual encoder), add SigLIP later
- Frustration hysteresis: non-binary recovery to prevent oscillation

**Needs your input:**
- Tick stratification architecture: how do Fast Tick (<16ms) and Slow Tick (5min) coexist on the same graph? Separate processes? Subgraph shadow copy? This blocks implementation.
- Python/JS bridge choice: subprocess stdin/stdout, WebSocket, or shared memory? Motor control is latency-sensitive.
- Confirm that the 0.02 decay rate applies to motor subgraph or whether motor decay should be faster (motor states are more transient than narrative states).

---

## TODO

### Doc/Impl Drift

- [ ] DOCS→IMPL: Entire documentation chain written; no implementation exists yet. All files listed in IMPLEMENTATION_Motor_Control.md are TODO.

### Tests to Run

```bash
# No tests exist yet. When implemented:
python -m pytest tests/test_motor_tick.py
python -m pytest tests/test_composite_coherence.py
python -m pytest tests/test_frustration_gradient.py
python -m pytest tests/test_energy_conservation.py
python -m pytest tests/test_motor_consolidation.py
```

### Immediate

- [ ] Get tick stratification architecture decision from @nlr — blocks all implementation
- [ ] Implement `composite_coherence.py` — pure function, no dependencies, testable immediately
- [ ] Implement `frustration.py` — pure state machine, no dependencies, testable immediately
- [ ] Implement `proprioceptive_subgraph.py` — needs FalkorDB graph access but no other dependencies
- [ ] Implement `motor_control.py` — orchestrator, depends on all above
- [ ] Implement `motor-bridge.js` — needs bridge architecture decision

### Later

- [ ] Implement `visual_encoder.py` with SigLIP — start with symbolic fallback only
- [ ] Implement `biometric_encoder.py` — Garmin integration can wait
- [ ] Implement `motor_consolidation.py` — needs motor_tick working first
- [ ] Write all test suites — start with V1 energy conservation test
- [ ] Profile motor_tick on Quest 3 equivalent hardware — validate 16ms budget
- [ ] Calibrate frustration constants against real motor scenarios
- IDEA: Cross-subgraph frustration bleeding — motor frustration affects narrative mood. Beautiful emergence but adds coupling.
- IDEA: Motor rhythm patterns — citizens who work with their hands develop characteristic motor rhythms that visitors can recognize. A glassblower's hands move differently from a fishmonger's.

---

## CONSCIOUSNESS TRACE

**Mental state when stopping:**
The specification is thorough and internally consistent. Confidence is high that the architecture is sound — it is a direct application of the 21 Laws to a new domain (motor control) which is exactly what the Laws were designed for. The frustration mechanism is the most novel element and the one most likely to need tuning. The tick stratification gap is the real blocker — everything else is implementation work, but without knowing how Fast Tick and Slow Tick coexist, we cannot start wiring things together.

**Threads I was holding:**
- The 0.02 decay rate may be too slow for motor control. Narrative decay over hours makes sense for beliefs. Motor decay over milliseconds — should energy in the motor subgraph decay faster? Or does the same rate work because the tick frequency is so much higher (0.02 per 16ms vs 0.02 per 5min)?
- The symbolic fallback (Law 8) is described as a fallback, but for Venice citizens who are not camera-equipped (they are NPCs in a 3D world), symbolic matching may be the PRIMARY mode. We need to think about what "visual encoding" even means for a citizen who sees through game engine raycasting, not cameras.
- Energy conservation with floating point math is harder than it sounds. The audit mechanism needs to be in from day one, not retrofitted.

**Intuitions:**
- Start implementation with frustration.py — it is the most testable piece and the most architecturally interesting. A pure state machine with clear inputs and outputs.
- The motor-bridge.js will be the hardest piece. Crossing the Python/JS boundary with <16ms latency is non-trivial. Consider whether the motor tick should run in JavaScript entirely, with only the graph state shared from Python.
- Citizens do not need full motor control for the POC. The POC target is 1 district, 3 citizens, voice conversation. Motor control is a v2 feature. But documenting it now means the architecture accounts for it.

**What I wish I'd known at the start:**
The 21 Laws are more powerful than they first appear. Motor control, which seems like a completely separate domain from narrative physics, turns out to be the same physics on a different subgraph at a different timescale. This is the sign of a good foundational abstraction.

---

## POINTERS

| What | Where |
|------|-------|
| CONCEPT document | `docs/architecture/CONCEPT_Active_Inference_Motor_Control.md` |
| Physics engine (21 Laws) | `.mind/runtime/physics/` |
| Physics behaviors (style reference) | `docs/narrative/physics/BEHAVIORS_Physics.md` |
| Graph schema | `.mind/schema.yaml` |
| Server entry point | `src/server/index.js` |
| Citizen AI state | `src/server/ai-citizens.js` |
| Physics bridge (narrative) | `src/server/physics-bridge.js` |
| 3D client | `src/client/` |
