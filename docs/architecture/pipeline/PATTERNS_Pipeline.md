# 3D Pipeline & Cognitive Supply Chain — Patterns: The World Is a Shader Over the Graph

```
STATUS: DRAFT
CREATED: 2026-03-14
VERIFIED: —
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Pipeline.md
THIS:            PATTERNS_Pipeline.md (you are here)
BEHAVIORS:       ./BEHAVIORS_Pipeline.md
ALGORITHM:       ./ALGORITHM_Pipeline.md
VALIDATION:      ./VALIDATION_Pipeline.md
IMPLEMENTATION:  ./IMPLEMENTATION_Pipeline.md
SYNC:            ./SYNC_Pipeline.md

IMPL:            engine/client/app.js
                 engine/server/narrative_graph_seed_and_tick_bridge.js
                 src/server/physics-bridge.js
```

### Bidirectional Contract

**Before modifying this doc or the code:**
1. Read ALL docs in this chain first
2. Read the linked IMPL source files

**After modifying this doc:**
1. Update the IMPL source files to match, OR
2. Add a TODO in SYNC_Pipeline.md: "Docs updated, implementation needs: {what}"
3. Run tests: `node engine/index.js --world ./worlds/venezia/world-manifest.json`

**After modifying the code:**
1. Update this doc chain to match, OR
2. Add a TODO in SYNC_Pipeline.md: "Implementation changed, docs need: {what}"
3. Run tests: `node engine/index.js --world ./worlds/venezia/world-manifest.json`

---

## THE PROBLEM

Without explicit coupling between the cognitive substrate and the 3D renderer, Venice becomes a painted backdrop. Citizens walk through streets that don't know about tension. Buildings stand pristine regardless of the narratives they house. A frustrated citizen looks identical to a satisfied one. A decayed memory occupies the same visual weight as a fresh revelation.

The visitor walks through a diorama — pretty, maybe, but inert. Nothing they see carries information about the graph state that is the actual simulation. The 3D layer becomes a liability: engineering effort that produces no cognitive value, a skin that lies about the skeleton beneath it.

Worse, without the feedback path (3D events injecting back into the graph), the 3D world cannot teach the cognitive engine anything. Collisions happen and are forgotten. Spatial relationships exist but don't influence limbic state. The rendering engine becomes a one-way consumer of data, never a producer. The agent loses its body.

---

## THE PATTERN

**The 3D world is a shader over the graph.** Every pixel on screen is a function of graph state. The cognitive engine (FalkorDB, Cypher, embeddings) is Channel 2 — the constraint regulator that computes salience, energy, tension, and drive pressure. The procedural engine (Three.js / R3F / GLSL) is Channel 1 — the physical manifestation that renders those constraints as light, color, geometry, and motion.

The umbilical link is the **Context Vector C_t** — the Working Memory centroid computed by the cognitive engine on each physics tick. C_t acts as a "Global Uniform" for all scene shaders. When the physics tick completes, C_t is serialized and pushed to the 3D engine, which unpacks it into per-citizen shader uniforms (uValence, uArousal), per-building energy levels, per-zone atmosphere parameters, and per-object decay coefficients.

The two engines are asynchronous but coupled:
- The cognitive engine ticks every 5 minutes (physics tick interval)
- The 3D engine runs at 60fps (requestAnimationFrame)
- They share state through a uniform bridge, not lock-step execution
- Changes from the physics tick are smoothly interpolated over 30-60 seconds in the 3D engine

The feedback path runs in the opposite direction: the 3D engine detects collisions, clipping, and stable landings, classifies them as limbic events, and injects energy back into the graph via Law 1. This closes the loop — the graph drives the world, and the world feeds the graph.

---

## BEHAVIORS SUPPORTED

- **B1** (Material Decay on Low-Energy Objects) — Energy-indexed rendering ensures decayed graph nodes produce visually degraded assets
- **B2** (Limbic Color Shifts on Citizens) — C_t → shader uniform bridge maps valence/arousal to citizen appearance in real time
- **B3** (Collision Aftermath) — Collision detection → limbic injection ensures 3D events have cognitive consequences
- **B4** (Redemptive Narrative Crystallization) — Frustration-driven learning transforms pipeline failures into growth nodes
- **B5** (Smooth Tick Transitions) — Asynchronous coupling with interpolation prevents visible tick boundaries

## BEHAVIORS PREVENTED

- **Decorative rendering** — Every visual property must be derived from graph state; static decoration is an anti-behavior
- **Silent failure** — Pipeline errors (shader compilation, non-manifold mesh) must produce limbic injection and narrative crystallization, never silent recovery
- **Tick visibility** — The visitor must never perceive the 5-minute tick boundary as a visual discontinuity

---

## PRINCIPLES

### Principle 1: Two Engines, One Truth

The cognitive engine (FalkorDB) is the source of truth. The procedural engine (Three.js) is the physical manifestation. There is no visual state that exists independently of graph state. If a building appears damaged, it is because its narrative energy is below threshold in the graph. If a citizen glows cyan, it is because their valence is positive in the graph.

This means the renderer never "decides" what something looks like. It computes the appearance from graph inputs using deterministic functions. Two observers viewing the same scene from the same angle at the same time see the same thing, because the graph state is the same.

### Principle 2: Serenissima is the Finite Dictionary

The mapping from graph node types to 3D manifestations is finite and enumerable. Every node in the Universal Schema has exactly one 3D asset class:

| Universal Type | 3D Manifestation |
|---------------|-------------------|
| Actor | Avatars — stick figure to full LOD based on energy. Skin color from valence/arousal via limbic shader. |
| Moment | Spatial memory artifacts — visibility indexed on recency. Decay = fade to transparency. |
| Narrative | Architectural structures — building health reflects narrative energy. Geometry degrades below threshold. |
| Space | Co-presence zones with proximity_contagion radius. Physical proximity triggers slow limbic valence equalization. |
| Thing | Inventory objects and economic resources ($MIND). Object wear indexed on node energy decay. |

This dictionary is the Serenissima physical supply chain. It is finite because every entity in the world must have a known visual signature. New node types require explicit dictionary expansion — no procedural generation from unknown schemas.

### Principle 3: Feedback Closes the Loop

The 3D engine is not a display. It is a sensory organ. Every collision, every spatial relationship, every rendering artifact is a signal that flows back into the cognitive substrate:

| 3D Event | Limbic Impact |
|----------|--------------|
| Minor collision | Frustration +0.05, Anxiety +0.02 |
| Violent collision | Frustration +0.15, Anxiety +0.1 |
| Clipping / Z-fighting | Frustration +0.1, Boredom +0.05 |
| Stable landing | Satisfaction +0.15, Arousal -0.1 |

Without this feedback, the agent is disembodied. The graph computes drives and tensions, but the agent cannot learn from spatial experience. Frustration from collisions drives path inhibition (Law 9). Satisfaction from stable landings reinforces successful navigation (Law 10). The body teaches the mind.

---

## DATA

| Source | Type | Purpose / Description |
|--------|------|-----------------------|
| FalkorDB `venezia` graph | DATABASE | Source of truth for all visual state — node energies, citizen valence/arousal, narrative tensions, spatial relationships |
| `engine/client/app.js` | FILE | Current V1 3D client — Three.js rendering, citizen spawning, animation loop |
| `engine/server/narrative_graph_seed_and_tick_bridge.js` | FILE | Physics tick bridge — broadcasts tick events to connected clients |
| `src/server/physics-bridge.js` | FILE | Legacy physics bridge — Python subprocess tick execution, JSON stdout capture |
| `docs/architecture/CONCEPT_3D_Pipeline_Supply_Chain.md` | FILE | Full CONCEPT specification for this module |
| `docs/architecture/CONCEPT_Lumina_Prime.md` | FILE | Lumina Prime procedural engine spec (zero external assets) |
| `docs/narrative/physics/ALGORITHM_Physics.md` | FILE | Physics laws (energy, decay, tension) that drive 3D behavior |

---

## DEPENDENCIES

| Module | Why We Depend On It |
|--------|---------------------|
| `docs/narrative/physics/` | Physics tick produces the energy values, tensions, and moment flips that drive all visual state |
| `docs/narrative/graph/` | FalkorDB graph schema defines node types, link kinds, and the properties we render |
| `docs/architecture/engine/` | Engine V1 provides the rendering infrastructure (Three.js scene, camera, animation loop) |
| `docs/citizens/mind/` | Citizen context assembly produces the C_t vector that becomes shader uniforms |
| `.mind/schema.yaml` | Universal graph schema — the type system that Serenissima maps to 3D asset classes |

---

## INSPIRATIONS

**Demoscene procedural generation** — The tradition of generating entire visual worlds from mathematical functions, not asset files. Lumina Prime's zero-external-assets constraint is a direct descendant.

**Active inference / embodied cognition** — The agent perceives and acts through its body. The collision-to-limbic feedback loop is grounded in the active inference framework where sensory prediction error (collision = unexpected contact) drives belief updating.

**Shader-driven data visualization** — The idea that every pixel should carry information, not decoration. Scientific visualization pipelines where color, opacity, and geometry map to data dimensions.

**Venice's own materiality** — Real Venice decays. Plaster crumbles, wood rots, stone erodes. The temporal decay shader (Law 3 applied to materials) is not an aesthetic choice — it is Venice made computationally honest.

---

## SCOPE

### In Scope

- C_t to shader uniform bridge (serialization, transport, unpacking)
- Serenissima physical supply chain (type-to-asset dictionary, all 5 node types)
- Limbic state shader (GLSL: valence → color, arousal → pulsation)
- Temporal decay applied to materials (energy → texture erosion, geometry degradation)
- Collision detection and limbic injection pipeline
- Action node physical instanciation (Law 17 — embedding validation before mesh generation)
- Session stride allocation for parallel micro-sessions
- Subconscious absorption in DND mode (background graph warming without shader thread interruption)

### Out of Scope

- **Newtonian physics simulation** → not needed; narrative physics only
- **Pre-authored 3D asset pipeline** → see `docs/architecture/CONCEPT_Serenissima_Asset_Pipeline.md` for the crafting-by-substitution approach
- **VR controller input handling** → see engine input system
- **Voice pipeline** → see `docs/voice/pipeline/`
- **Network synchronization** → see engine protocol (`engine/shared/protocol.js`)
- **Graph seeding and schema design** → see `docs/narrative/graph/`

---

## MARKERS

<!-- @mind:todo Define C_t serialization format — JSON? Binary? What fields constitute the centroid? -->
<!-- @mind:todo Map existing engine/client/app.js citizen rendering to Serenissima Actor asset class -->
<!-- @mind:proposition Evaluate instanced rendering for 186 citizens with shared limbic shader -->
<!-- @mind:escalation R3F migration decision blocks shader implementation — raw Three.js ShaderMaterial works today, R3F drei shaders are different API -->
