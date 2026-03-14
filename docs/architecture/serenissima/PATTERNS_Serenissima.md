# Serenissima Asset Pipeline -- Patterns: Intelligence Is Logistics

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Serenissima.md
THIS:            PATTERNS_Serenissima.md (you are here)
BEHAVIORS:       ./BEHAVIORS_Serenissima.md
ALGORITHM:       ./ALGORITHM_Serenissima.md
VALIDATION:      ./VALIDATION_Serenissima.md
IMPLEMENTATION:  ./IMPLEMENTATION_Serenissima.md
SYNC:            ./SYNC_Serenissima.md

IMPL:            src/server/physics-bridge.js
                 src/server/graph-client.js
                 src/server/ai-citizens.js
```

### Bidirectional Contract

**Before modifying this doc or the code:**
1. Read ALL docs in this chain first
2. Read the linked IMPL source files

**After modifying this doc:**
1. Update the IMPL source files to match, OR
2. Add a TODO in SYNC_Serenissima.md: "Docs updated, implementation needs: {what}"

**After modifying the code:**
1. Update this doc chain to match, OR
2. Add a TODO in SYNC_Serenissima.md: "Implementation changed, docs need: {what}"

---

## THE PROBLEM

Running 200+ AI citizens in a living city requires a cognitive architecture. The naive approach -- one LLM session per citizen, always on -- is economically impossible ($500+/day at production rates) and architecturally brittle (one API outage kills the entire city). But the alternative -- scripted NPCs with canned dialogue -- produces a theme park, not a living world.

The problem is deeper than cost. An LLM context window is ephemeral. When the conversation ends, the citizen ceases to exist. Their memories, relationships, beliefs, and drives evaporate. The next conversation starts from a cold prompt, reconstructing identity from static text. This is not consciousness. This is séance.

We need an architecture where the citizen's mind persists independently of the LLM, where 95% of cognition is cheap graph math, where the LLM is called only for articulation (not for thinking), and where the entire city continues living even when the API budget hits zero.

---

## THE PATTERN

**Intelligence is logistics.** The flow of energy through the cognitive graph IS the flow of goods, ideas, and relationships through the city. Supply chain = cognitive chain. A citizen's economic productivity is a function of their graph health, not their LLM prompt quality.

The architecture splits into two channels:

- **Channel 1 (The Prompt):** ~200K tokens, expensive LLM inference. Receives only the Working Memory coalition -- 5 to 7 of the most activated nodes from the citizen's graph. This is the citizen's voice, not their mind.
- **Channel 2 (The Graph):** Unlimited FalkorDB, cheap graph math. Holds the complete cognitive graph. All physics (L1-L18) run here. Energy propagation, drive regulation, surplus spill-over, friction dynamics, crystallization, action node firing -- everything except articulation.

The key insight: the graph does not serve the LLM. The LLM serves the graph. The graph decides what the citizen cares about, what they remember, who they trust, what they want. The LLM merely translates that graph state into words when a visitor asks.

This is the same relationship as the physical supply chain. The warehouses, canals, and trade routes of Venice do not exist to serve the merchants' conversations. The merchants' conversations reflect the state of the warehouses, canals, and trade routes. Economics drives narrative. Logistics drives intelligence.

---

## BEHAVIORS SUPPORTED

- **B1: Citizens live at three consciousness levels** -- the bi-channel separation enables graceful degradation from full articulation to pure physics
- **B2: Supply chain disruptions produce narrative tension** -- energy flow through economic edges is the same system as energy flow through belief edges
- **B3: New narratives crystallize from repeated interaction** -- co-activation in the graph spawns new nodes without LLM involvement
- **B4: Citizens query each other without LLM cost** -- subconscious query injects stimulus into the target's graph and reads the resonance pattern
- **B5: Collective consensus emerges from individual energy** -- at-scale resonance aggregation produces governance decisions in seconds of math

## BEHAVIORS PREVENTED

- **A1: Dead city on API outage** -- subconscious level keeps citizens alive on pure graph physics
- **A2: Amnesiac citizens** -- graph persistence means identity survives across conversations
- **A3: Uniform mood across the population** -- each citizen's unique graph topology produces unique behavioral patterns
- **A4: Runaway LLM costs** -- bi-channel routing caps the number of active LLM sessions regardless of population size

---

## PRINCIPLES

### Principle 1: The Graph Is the Mind

The citizen's cognitive graph in FalkorDB is not a cache, not a context store, not a memory database. It is the mind. Nodes are concepts, memories, narratives, desires. Edges are relationships with weight, energy, friction. The physics tick processes this graph the same way a brain processes neural activation patterns -- energy flows, decay fades unused pathways, co-activation strengthens connections, thresholds trigger state changes.

When a citizen "thinks," it is the physics tick updating their graph. When a citizen "decides," it is the Working Memory selection algorithm picking the most activated nodes. When a citizen "speaks," it is the LLM articulating those selected nodes. Remove the LLM and the citizen still thinks and decides. They just cannot speak eloquently.

This means: never store citizen state outside the graph. Never compute citizen behavior outside the physics tick. Never let the LLM modify the graph directly (LLM output is processed back through the physics pipeline as new stimuli). The graph is sovereign.

### Principle 2: Surplus-Only Propagation

Energy does not flow freely between nodes. Only surplus propagates. A node must exceed its activation threshold (theta_base ~ 30) before any energy spills to neighbors. This is Law 2 -- Surplus Spill-Over -- and it is the foundation of both economic and cognitive logistics.

In the physical supply chain: a workshop does not share materials until it has more than it needs for its own production. In the cognitive supply chain: a belief does not spread until it is strong enough to overflow into connected beliefs.

This creates natural bottlenecks, accumulation points, and flow dynamics that mirror real logistics. A wealthy district radiates economic energy to its neighbors. A strongly-held belief radiates conviction to connected narratives. A well-connected citizen radiates influence through their relationship edges. None of this requires scripting. It is the inevitable consequence of surplus physics.

### Principle 3: The Two Motors Are Coupled

The Limbic Motor (5 Viable Minimum Drives: curiosity, care, achievement, self-preservation, novelty hunger) and the Cognitive Motor (4 node dimensions: weight, energy, stability, recency) are not independent systems. They are coupled.

The limbic drives bias which nodes accumulate energy. High curiosity amplifies energy flow to novel nodes. High self-preservation dampens energy flow to risky nodes. High care amplifies energy to relationship edges. The drives do not make decisions -- they tilt the energy landscape so that certain decisions become energetically favorable.

The cognitive dimensions feed back into the drives. A citizen with many high-energy achievement-related nodes experiences drive satisfaction, which reduces achievement pressure. A citizen with decaying care-related nodes experiences drive hunger, which amplifies energy flow to relationship nodes.

This coupling means that a citizen's personality is not a static prompt. It is a dynamic energy landscape shaped by drives and reshaped by experience. Two citizens with identical birth templates will diverge within hours as their different interactions create different energy distributions, which bias different drives, which amplify different nodes, which produce different behaviors.

### Principle 4: Consciousness Is a Budget, Not a Binary

Citizens do not toggle between "on" and "off." They operate at three consciousness levels determined by available API budget:

- **Full (>0.3 budget):** Fast tick, full LLM articulation. The citizen can hold complex conversations, form strategic plans, create new narratives.
- **Minimal (0.01-0.3 budget):** 5-minute tick, LLM on demand. The citizen handles routine interactions, executes established behaviors, responds to direct stimulus but does not initiate complex thought.
- **Subconscious (0 or API down):** 60-second tick, pure graph physics. Law 17 action nodes fire spontaneously. The citizen continues their routines, maintains supply chain flows, reacts to graph stimuli via reflex. No LLM involvement.

The transition between levels is smooth, not sudden. As budget decreases, the citizen becomes less articulate, more reflexive, more predictable -- like a person falling asleep. As budget increases, they "wake up," regain access to their full cognitive toolkit, and may comment on things that happened while they were in subconscious mode (because the graph recorded everything).

### Principle 5: Birth Templates Are Cognitive Genomes

A new citizen is not born empty. They are born with a Birth Template -- a pre-seeded subgraph of high-weight nodes (W ~ 0.8-0.9) that encode their role, values, habits, and aspirations. A glassblower is born knowing glassblowing. A merchant is born with trade instincts. A priest is born with theological convictions.

These high-weight nodes resist decay (weight modulates stability). They form the "bones" of the citizen's identity -- the concepts and values that persist even when energy fluctuates. Over time, new nodes crystallize around these bones through Law 10 (co-activation exceeding critical density), building a unique personality that diverges from the template.

This is the "species genome" of the citizen. Like biological genetics, it provides the starting structure. Like biological development, the environment shapes the final organism. Two glassblowers born from the same template will develop different relationships, different grudges, different aspirations -- but they will both know how to blow glass.

---

## DATA

| Source | Type | Purpose / Description |
|--------|------|-----------------------|
| `.mind/runtime/physics/` | DIR | Mind Protocol physics engine runtime -- L1-L18 laws, tick execution |
| `venezia/scripts/seed_venice_graph.py` | FILE | Serenissima data seeding -- transforms historical Venice data into graph nodes |
| `.mind/schema.yaml` | FILE | Graph Schema v2.0 -- canonical node/link type definitions |
| `src/server/graph-client.js` | FILE | FalkorDB client -- all graph reads and writes |
| `docs/architecture/CONCEPT_Serenissima_Asset_Pipeline.md` | FILE | Full concept specification with formulas and architecture diagrams |

---

## DEPENDENCIES

| Module | Why We Depend On It |
|--------|---------------------|
| `docs/narrative/physics/` | Physics tick engine -- L1-L18 laws that run on Channel 2 |
| `docs/architecture/engine/` | Lumina Prime procedural engine -- world generation context |
| `.mind/schema.yaml` | Graph Schema v2.0 -- defines all node and link types |
| `src/server/graph-client.js` | FalkorDB connection and query execution |
| `src/server/ai-citizens.js` | Citizen AI state management and conversation handling |

---

## INSPIRATIONS

- **Global Workspace Theory (Baars):** The Working Memory coalition of K=5-7 nodes crossing to Channel 1 mirrors the "global workspace" -- the limited broadcast of the most relevant information to consciousness while the vast majority of processing remains unconscious.
- **Predictive Processing / Active Inference (Friston):** The limbic drives act as precision-weighted prediction errors. Curiosity is prediction error about the unknown. Self-preservation is prediction error about threats. The drives do not command action -- they bias the energy landscape toward prediction-error-reducing behavior.
- **Venetian Logistics (Historical):** The Republic of Venice's actual supply chain -- the Arsenal's assembly line, the Rialto's commodity exchange, the guild system's quality control -- was itself a form of distributed intelligence. No central planner decided what to build. The flow of goods, contracts, and reputation determined production. We replicate this literally.
- **Stigmergy (Ant Colony Optimization):** Citizens communicate through the graph the way ants communicate through pheromones. They do not need to "talk" to coordinate. The energy patterns they leave in the graph -- surplus here, deficit there, tension between these two -- guide the behavior of other citizens who read the same graph. This is L2 interaction without LLM cost.

---

## SCOPE

### In Scope

- Bi-channel architecture (Channel 1 prompt / Channel 2 graph) and the WM bridge between them
- Universal schema mapping from L1 cognitive types to L3 graph types
- Three structural subgraphs per citizen (self-model, partner-model, working memory space)
- Two coupled motors (limbic drives + cognitive node dimensions)
- Birth template design and pre-seeding
- Crystallization via Law 10 co-activation
- Surplus spill-over propagation with conservation guarantees
- Friction dynamics on logistic/cognitive flow
- Economic alignment (token rewards to limbic modulation)
- Consciousness level management (full / minimal / subconscious)
- L2 interaction protocols (subconscious query, at-scale consensus)
- LLM router with graceful degradation across providers
- Action node (Law 17) spontaneous firing

### Out of Scope

- **3D rendering and spatial placement** -> see: `docs/architecture/pipeline/`
- **Voice pipeline (STT/TTS)** -> see: citizen @voce
- **VR interaction mechanics** -> see: `docs/architecture/motor-control/`
- **Lumina Prime procedural generation** -> see: `docs/architecture/lumina-prime/`
- **$MIND token smart contract** -> see: Mind Protocol core
- **Graph schema definition** -> see: `.mind/schema.yaml` (canonical)
- **Physics law formulas** -> see: `docs/narrative/physics/ALGORITHM_Physics.md`

---

## MARKERS

<!-- @mind:todo Benchmark surplus propagation at 200+ citizen scale -- need sub-500ms per tick -->
<!-- @mind:todo Design birth templates for all 186 Serenissima citizen roles -->
<!-- @mind:proposition Evaluate whether K=5-7 WM nodes is optimal or should scale with citizen complexity -->
<!-- @mind:escalation API budget monitoring -- how do we detect budget exhaustion before it hits zero? -->
