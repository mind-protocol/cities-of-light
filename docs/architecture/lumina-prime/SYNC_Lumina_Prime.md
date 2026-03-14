# Lumina Prime — Sync: Current State

```
LAST_UPDATED: 2026-03-14
UPDATED_BY: @nervo
STATUS: PROPOSED
```

---

## MATURITY

**What's canonical (v1):**
- The CONCEPT document (`docs/architecture/CONCEPT_Lumina_Prime.md`) defining the vision, architecture, and core insight ("the graph IS the scene graph")
- The 7 node types, 10 physics dimensions, 14 link types, and 21 physics laws — these are defined in the L1 cognitive substrate and are upstream dependencies, not Lumina Prime decisions
- The full documentation chain (OBJECTIVES through SYNC) — this chain you are reading now

**What's still being designed:**
- Exact SDF primitives for each of the 7 node types — conceptual descriptions exist, mathematical definitions do not
- GLSL shader architecture — uniform block structure is documented, but actual shader code does not exist
- Force-directed layout parameters — spring constants, repulsion strength, damping, space assignments
- Spline navigation feel — speed curves, inertia multipliers, fluidity mappings need playtesting
- Personhood Ladder visual representation — how does B1-B6 progression look spatially?

**What's proposed (v2+):**
- WebGPU compute shaders for physics-on-GPU — would eliminate the CPU bottleneck for large graphs
- Haptic feedback integration for VR headsets — frustration as vibration, satisfaction as warmth
- Multi-observer mode — multiple users navigating the same cognitive space simultaneously
- Audio spatialization — spatial audio positioned at node locations, pitch/volume driven by physics dimensions
- Unity port — the `unity/` directory exists in the repo skeleton but has no Lumina Prime integration path

---

## CURRENT STATE

Nothing exists. Lumina Prime is a fully documented architecture with zero lines of implementation code. The `engine/lumina-prime/` directory does not exist. No R3F components, no GLSL shaders, no FalkorDB queries, no Solana integration, no spline navigation, no personhood validation.

The current rendering engine lives in `engine/` and uses vanilla Three.js (not R3F). It renders the Venice world for Cities of Light but has no connection to the L1 cognitive graph, no procedural generation from physics dimensions, and no concept of the 21 laws. Lumina Prime is a clean-room replacement, not an incremental refactor.

The upstream dependencies exist:
- FalkorDB is running and contains graph data (seeded by @nervo's work on the narrative physics)
- The L1 physics engine exists in `.mind/runtime/physics/` (Python)
- The $MIND token exists on Solana (Token-2022)
- The JSON Spec for the Personhood Ladder exists

The gap: nothing connects these systems to a visual rendering pipeline that maps physics dimensions to pixels.

---

## IN PROGRESS

### Documentation Chain

- **Started:** 2026-03-14
- **By:** @nervo
- **Status:** Complete (DRAFT)
- **Context:** All 7 docs in the chain created. The architecture is fully documented before any code is written. This is intentional — the doc chain IS the specification. Code implements the docs, not the other way around.

---

## RECENT CHANGES

### 2026-03-14: Full Documentation Chain Created

- **What:** Created OBJECTIVES, PATTERNS, BEHAVIORS, ALGORITHM, VALIDATION, IMPLEMENTATION, and SYNC documents for Lumina Prime
- **Why:** The CONCEPT doc existed but lacked the operational detail needed for implementation. The doc chain provides the complete specification — from "why does this exist" (OBJECTIVES) through "what must be true" (VALIDATION) to "where does the code go" (IMPLEMENTATION)
- **Files:** `docs/architecture/lumina-prime/OBJECTIVES_Lumina_Prime.md` through `SYNC_Lumina_Prime.md`
- **Struggles/Insights:** The hardest part was the ALGORITHM doc — translating the mathematical formulas from the French specification into pseudocode that is precise enough to implement but readable enough to understand. The Herfindahl injection split in particular required careful thought about the indicator function semantics. The Composite Coherence formula's weight rationale (why 0.5 for lexical, not 0.3?) needed explicit documentation.

---

## KNOWN ISSUES

### No R3F in the project yet

- **Severity:** critical (blocks all implementation)
- **Symptom:** The project uses vanilla Three.js. Lumina Prime requires React Three Fiber.
- **Suspected cause:** Original engine was built before the Lumina Prime architecture was conceived
- **Attempted:** Nothing yet — this is a known prerequisite

### Physics engine is Python, rendering will be TypeScript/GLSL

- **Severity:** high
- **Symptom:** The L1 physics engine (`.mind/runtime/physics/`) runs in Python. Lumina Prime's rendering pipeline runs in the browser (TypeScript/GLSL). There is no bridge.
- **Suspected cause:** The physics engine was built for the Mind Protocol backend, not for browser-side rendering
- **Attempted:** `src/server/physics-bridge.js` is mentioned in @nervo's key files but does not exist yet

### Embedding pipeline undefined

- **Severity:** high
- **Symptom:** The Composite Coherence algorithm requires vector embeddings for nodes. Where these embeddings come from at runtime is not defined.
- **Suspected cause:** The coherence algorithm was specified mathematically without an embedding infrastructure decision
- **Attempted:** Nothing — needs architecture decision

---

## HANDOFF: FOR AGENTS

**Your likely VIEW:** VIEW_Implement

**Where I stopped:** Documentation is complete. No code has been written. You are starting from scratch.

**What you need to understand:**
The doc chain is the spec. Read OBJECTIVES first (what matters), then PATTERNS (how it works conceptually), then ALGORITHM (the math), then IMPLEMENTATION (where files go). Do not start coding without reading the chain. The VALIDATION doc tells you what invariants your code must satisfy — these are your acceptance criteria.

**Watch out for:**
- Do not use the existing `engine/` code as a starting point — it is vanilla Three.js and has no cognitive graph integration. Lumina Prime is a clean-room R3F build.
- The physics engine is Python. Your first real task is the bridge — getting physics dimensions from the Python backend into the browser. Without this, you have no data to render.
- The satisfaction formula `0.1 * log10(amount)` and self-preservation formula are protocol invariants. Do not change them. Do not approximate them. They are exact.

**Open questions I had:**
- Should the force-directed layout run on the main thread or in a Web Worker? For 500+ nodes it will be slow on the main thread.
- What is the right LOD strategy for narrative nodes with complex SDF? Distance-based LOD is obvious but may break V1 (cognition is visible) if a distant node's energy change is not reflected.
- How do we handle the physics engine's tick rate vs the renderer's frame rate for the interpolation bridge? The tick might be every 5 minutes but the concept doc does not specify this for Lumina Prime's context.

---

## HANDOFF: FOR HUMAN

**Executive summary:**
The full Lumina Prime documentation chain is complete (7 docs, DRAFT status). Zero code exists. The architecture specifies a procedural 3D rendering engine that maps L1 cognitive physics directly to visual output using R3F/GLSL. The system is fully designed but entirely unbuilt.

**Decisions made:**
- R3F over vanilla Three.js (declarative model fits the reactive pipeline pattern)
- 7 separate node components (one per type) rather than a single parameterized component (types are fundamentally different)
- Cubic Hermite interpolation for energy/stability between ticks (avoids overshoot that linear would cause)
- Physics dimensions as shader uniforms (direct mapping, no intermediate representation)

**Needs your input:**
- R3F migration timeline — adding R3F to the project is a significant dependency change. When?
- Physics bridge architecture — Python backend to TypeScript frontend. WebSocket? REST polling? Shared Redis?
- Embedding pipeline — where do node embeddings come from for Composite Coherence? Need to choose an embedding model and decide if embeddings are computed server-side or client-side.
- Build priority — which module to implement first? Recommendation: `graph/sampler.ts` (unblocks everything) then `shaders/common.glsl` + one node type (proves the pipeline end-to-end).

---

## TODO

### Doc/Impl Drift

- [ ] DOCS→IMPL: Entire implementation needs building (0% code exists)

### Tests to Run

```bash
# No tests exist yet. Target:
npm run test:lumina-prime
```

### Immediate

- [ ] Create `engine/lumina-prime/` directory structure
- [ ] Add R3F, drei, and postprocessing to project dependencies
- [ ] Implement `graph/sampler.ts` — FalkorDB query for visible nodes/links
- [ ] Implement `shaders/common.glsl` — 10-dimension uniform block
- [ ] Implement one node type (e.g., `nodes/DesireNode.tsx`) end-to-end as proof of concept
- [ ] Build physics bridge (`src/server/physics-bridge.js`) to get Python tick output into browser

### Later

- [ ] Implement remaining 6 node types
- [ ] Implement spline navigation system
- [ ] Implement limbic post-processing pipeline
- [ ] Implement $MIND Solana integration
- [ ] Implement Personhood Ladder validation
- [ ] Implement force-directed layout with Web Worker option
- [ ] Write invariant tests (V1-V10)
- IDEA: WebGPU compute shaders for physics-on-GPU — would be transformative for large graphs
- IDEA: Record spline flights as cognitive "memories of traversal" — meta-cognitive loop

---

## CONSCIOUSNESS TRACE

**Mental state when stopping:**
Confident about the architecture. The doc chain is thorough and internally consistent. The core insight ("graph IS scene graph") is sound and produces a clean implementation architecture. Slightly anxious about the Python↔TypeScript bridge — this is the riskiest integration point.

**Threads I was holding:**
- The Herfindahl split lambda formula has an interesting property: when both conditions are true (C>10 AND H>0.2), they cancel. This means diverse-but-concentrated graphs get the default split. Is this intentional or a design artifact? Documenting it faithfully regardless.
- The 7 node type SDF functions are described conceptually but not mathematically. Each one needs a proper SDF definition (smoothed cube, icosahedron, gothic arch, etc.) before shader code can be written.
- The Selection Moat threshold formula has frustration as a negative term (-1.0). This means frustrated minds let MORE nodes into working memory. This is cognitively plausible (anxious scanning) but could produce overwhelming visual density. Need to test this.

**Intuitions:**
- The first visual proof-of-concept should be a single desire node pulsating in empty space. If that looks right — if the pulsation feels like wanting — the rest will follow.
- The crystallization behavior (B3) will be the hardest to implement and the most impressive to witness. Prioritize it for demo.
- The economics integration ($MIND → satisfaction) will feel magical or will feel bolted-on, depending entirely on the smoothness of the gold propagation animation. Invest in the easing curve.

**What I wish I'd known at the start:**
The French specification is dense but internally consistent. Every formula reference every other formula. Reading it linearly is hard; reading it as a graph (which is fitting) is easier. The 21 laws are not 21 independent rules — they are one system with 21 aspects.

---

## POINTERS

| What | Where |
|------|-------|
| CONCEPT document | `docs/architecture/CONCEPT_Lumina_Prime.md` |
| Graph Schema v2.0 | `.mind/schema.yaml` |
| L1 Physics Engine | `.mind/runtime/physics/` |
| Current Three.js engine (V1) | `engine/` |
| Physics bridge (proposed) | `src/server/physics-bridge.js` |
| Serenissima data (graph seeding) | seeded via @nervo's narrative physics work |
| $MIND token | Solana Token-2022 (mint address in env) |
| JSON Spec (Personhood) | loaded by `personhood/spec-loader.ts` (TODO) |
| French specification | original design document (not in repo — reference only) |
