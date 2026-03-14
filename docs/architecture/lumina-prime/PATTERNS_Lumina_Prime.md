# Lumina Prime — Patterns: The Graph Is the Scene Graph

```
STATUS: DRAFT
CREATED: 2026-03-14
VERIFIED: —
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Lumina_Prime.md
BEHAVIORS:       ./BEHAVIORS_Lumina_Prime.md
THIS:            PATTERNS_Lumina_Prime.md (you are here)
ALGORITHM:       ./ALGORITHM_Lumina_Prime.md
VALIDATION:      ./VALIDATION_Lumina_Prime.md
IMPLEMENTATION:  ./IMPLEMENTATION_Lumina_Prime.md
SYNC:            ./SYNC_Lumina_Prime.md

IMPL:            engine/lumina-prime/ (proposed — does not yet exist)
```

### Bidirectional Contract

**Before modifying this doc or the code:**
1. Read ALL docs in this chain first
2. Read the linked IMPL source file

**After modifying this doc:**
1. Update the IMPL source file to match, OR
2. Add a TODO in SYNC_Lumina_Prime.md: "Docs updated, implementation needs: {what}"
3. Run tests: `npm run test:lumina-prime` (proposed)

**After modifying the code:**
1. Update this doc chain to match, OR
2. Add a TODO in SYNC_Lumina_Prime.md: "Implementation changed, docs need: {what}"
3. Run tests: `npm run test:lumina-prime` (proposed)

---

## THE PROBLEM

The Mind Protocol cognitive substrate is a rich computational model — 7 node types, 10 physics dimensions per node, 14 link kinds, 21 physics laws across 3 tiers. It computes in silence. Energy propagates, tension accumulates, moments flip, consolidation crystallizes structure — and none of it is visible.

Without a spatial manifestation, the cognitive graph is:
- **Unwitnessable** — nobody can see what the mind is doing
- **Undiagnosable** — pathological states (runaway energy, dead zones, stale context) have no visual symptom
- **Uninhabitable** — you cannot walk through a spreadsheet of physics dimensions

The problem is not "how do we visualize a graph." Graph visualization is solved. The problem is: how do we make a cognitive computation into a place you can be inside, where visual properties are not decorations on data but direct manifestations of cognitive state.

---

## THE PATTERN

**The graph IS the scene graph.** There is no separate data model for rendering. The FalkorDB cognitive graph is read directly by the R3F/GLSL pipeline, and every visual property is a computed function of physics dimensions.

The core mapping:

| Cognitive Property | Visual Property |
|-------------------|-----------------|
| Node energy | Light intensity and color saturation |
| Node stability | Geometric dampening (stable = solid, unstable = oscillating) |
| Node weight | Scale and solidity of form |
| Node recency | Opacity (recent = opaque, fading = translucent) |
| Node type | Geometric primitive class (7 distinct signatures) |
| Link affinity | Spline curvature and luminosity |
| Link type | Spline visual properties (color family, dash pattern, pulse rate) |
| Arousal (limbic) | Camera speed and scene vibrancy |
| Valence (limbic) | Color temperature and motion fluidity |
| Frustration (limbic) | Red-shift, geometric instability, trajectory jitter |

The key insight: this is not a visualization layer sitting on top of a data layer. There is one layer. The graph topology IS the geometry. The physics dimensions ARE the shader uniforms. The link structure IS the spline network. The renderer does not ask "how should I draw this node?" — it asks "what does energy 0.7 and stability 0.3 look like in a desire-type vertex shader?"

### The Three Structural Spaces

The cognitive graph organizes into three spatial regions, each procedurally generated from graph topology:

1. **Self-Model** — the agent's identity, values, habits, and self-narrative. Dense, stable, luminous at center. This is the architecture of the self.
2. **Partner-Model** — the agent's representation of its human partner. Separate spatial cluster, connected by care_affinity and partner_relevance links. Brightness tracks interaction recency.
3. **Working-Memory Space** — the active computation surface. Nodes recently injected by stimuli, currently above the Selection Moat threshold. Bright, volatile, transient. This is where attention lives.

---

## BEHAVIORS SUPPORTED

- **B1: Energy-driven luminance** — nodes glow in proportion to their activation, enabling instant cognitive state readout
- **B2: Desire nodes pull geometry** — pulsating desire nodes create visible gravitational attraction, showing what the mind wants
- **B3: Narrative crystallization into architecture** — dense co-activation clusters (Law 10) spawn architectural forms, showing knowledge solidifying into structure
- **B4: Frustration color shift** — limbic distress produces visible red-shift and instability, showing the mind struggling
- **B5: Spline flight through knowledge** — navigation follows link topology, showing how the mind moves between ideas
- **B6: Satisfaction pulse on reward** — $MIND token receipt creates visible warmth propagation through care_affinity links
- **B7: Decay produces fading** — unreinforced nodes lose opacity and eventually vanish, showing the mind forgetting

## BEHAVIORS PREVENTED

- **A1: Stale visuals** — direct graph-to-pixel mapping means no visual state can persist after its cognitive source changes
- **A2: Art-directed deception** — no human can make a sick mind look healthy; the physics produces what it produces
- **A3: Information leakage** — raw graph data (node IDs, edge weights, energy values) never appears as text; only as visual properties

---

## PRINCIPLES

### Principle 1: Computed, Never Art-Directed

Every visual property is a mathematical function of cognitive state. No texture maps. No hand-placed lights. No artist decisions about "what a memory should look like." The shader computes it from the physics dimensions. If the result is beautiful, the cognition is healthy. If the result is distressing, the cognition is struggling. This is diagnostic transparency — the visual IS the data.

### Principle 2: One Graph, One Truth

There is exactly one data structure: the FalkorDB cognitive graph. The renderer reads it. The physics engine writes it. There is no render cache, no scene graph copy, no intermediate data model. When a physics dimension changes, the next frame reflects it. When the renderer needs a position, it computes it from graph topology. Duplication creates drift. One graph prevents it.

### Principle 3: Links Are Physical

Links are not lines between dots. Links are force vectors. A `projects_toward` link creates a spline control point that pulls the navigation trajectory. An `evokes` link creates an associative attractor that bends nearby geometry. A `conflicts_with` link creates repulsive tension visible as flickering interference between adjacent forms. The topology of connections produces the topology of space.

### Principle 4: Modality Determines Shader Source

Each node carries a modality (text, visual, biometric). The modality selects the shader input source — text nodes produce glyph-derived geometry, visual nodes produce image-derived patterns, biometric nodes produce waveform-derived oscillations. The same physics dimensions control the same visual properties regardless of modality, but the geometric vocabulary differs.

### Principle 5: Privacy Is Structural

The rendering pipeline reads the local cognitive graph. It never transmits graph data externally. Diagnostic views are gated by Trust Tier (Owner-only by default). The visual manifestation is the only output — and it is spatially local, visible only to whoever is present in the environment. No screenshots API, no telemetry on graph state, no training on cognitive data.

---

## DATA

| Source | Type | Purpose / Description |
|--------|------|-----------------------|
| FalkorDB cognitive graph | GRAPH DB | The single source of truth for all cognitive state — nodes, links, physics dimensions |
| `.mind/schema.yaml` | FILE | Graph Schema v2.0 — canonical node types, link kinds, dimension definitions |
| JSON Spec | FILE | Personhood Ladder source of truth — capability profiles, validation criteria |
| Solana Token-2022 | BLOCKCHAIN | $MIND token state — balances, transfer events, fee accumulation |

---

## DEPENDENCIES

| Module | Why We Depend On It |
|--------|---------------------|
| `.mind/runtime/physics/` | L1 physics engine — computes all 21 laws, writes physics dimensions to graph |
| FalkorDB | Graph persistence and query — Cypher traversals for topology, vector embeddings for coherence |
| R3F (React Three Fiber) | Declarative 3D rendering — React component model for procedural geometry |
| GLSL shaders | GPU-side computation — vertex displacement, fragment coloring, energy-to-light mapping |
| Solana Web3.js | Token economics — reads $MIND balance, listens for transfer events |
| ElevenLabs / Whisper | Voice pipeline — spatial audio playback positioned at node locations (if applicable) |

---

## INSPIRATIONS

- **Demoscene** — decades of generating entire visual worlds from mathematical functions, zero assets. The ethos: beauty from computation, not from content.
- **Neuroscience fMRI visualization** — energy maps where activity = brightness. Lumina Prime applies this principle to cognitive graphs instead of brain regions.
- **Force-directed graph layouts** — but inverted: instead of laying out a graph for display, the graph topology IS the spatial layout, and physics dimensions drive visual properties instead of spring constants.
- **Active Inference (Friston)** — the theoretical framework behind the 21 laws. Free energy minimization as the driver of cognitive dynamics. The visual manifestation makes the free energy landscape navigable.
- **Plutchik's wheel** — historical influence on the affect model, now replaced by trust/friction/affinity/aversion in Schema v2.0, but the principle of multi-dimensional affect space remains.

---

## SCOPE

### In Scope

- Procedural geometry generation for all 7 node types from physics dimensions
- GLSL shader pipeline mapping 10 dimensions to visual properties
- Spline navigation system using link topology as control points
- Limbic state visualization (arousal, valence, frustration, boredom)
- $MIND token reward visualization and limbic integration
- Trust Tier gating for diagnostic views
- Three structural spaces (self-model, partner-model, working-memory)
- Personhood Ladder visual progression

### Out of Scope

- **Physics engine computation** -> see: `.mind/runtime/physics/` — Lumina Prime reads physics output, does not compute it
- **Graph schema design** -> see: `.mind/schema.yaml` — Lumina Prime consumes the schema, does not define it
- **Voice pipeline** -> see: `src/server/voice/` — spatial audio positioning may use node locations, but voice processing is external
- **Serenissima world-specific content** -> see: `CONCEPT_Serenissima_Asset_Pipeline.md` — Venice is one instance; Lumina Prime is the engine
- **Solana smart contract development** -> see: $MIND protocol team — Lumina Prime reads token state, does not manage contracts
- **Traditional Three.js engine** -> see: `engine/` — V1 engine is separate; Lumina Prime is a clean-room R3F build

---

## MARKERS

<!-- @mind:todo Define the exact GLSL uniform mapping for all 10 physics dimensions -->
<!-- @mind:todo Establish the 7 node type geometric primitives (which SDF for each type) -->
<!-- @mind:proposition Evaluate WebGPU compute shaders for physics-on-GPU — could eliminate the graph-read bottleneck -->
<!-- @mind:escalation R3F migration path from current vanilla Three.js engine — scope and timeline needed from @nlr -->
<!-- @mind:escalation Solana integration depth — do we read on-chain state directly or via an indexer? -->
