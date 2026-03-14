# CONCEPT: Serenissima Asset Pipeline — Cognitive Logistics & Physical Supply Chain

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## WHAT IT IS

The asset pipeline and logistic architecture for Serenissima — a civilization simulation orchestrating 200+ AI citizens. The architecture implements a strict bi-channel separation: Channel 1 (the Prompt / Articulated Cortex, ~200K tokens, expensive) and Channel 2 (the Graph / Physical Substrate, unlimited FalkorDB, cheap). Intelligence is treated as persistent relational capital, not ephemeral LLM output. The physics simulation (L1-L18) runs exclusively on Channel 2, with only the Working Memory coalition (K=5-7 nodes) crossing the bridge to the LLM.

---

## WHY IT EXISTS

Without this architecture, 200+ citizens would require 200+ simultaneous LLM sessions — economically impossible and architecturally brittle. The bi-channel design solves this by:

1. **Running 95% of cognition on graph physics** — no LLM cost for energy propagation, drive regulation, reflex actions
2. **Reserving the LLM for articulated thought only** — strategic planning, conversation, narrative creation
3. **Enabling subconscious operation** — when API budget = 0, citizens continue living via Law 17 reflexes
4. **Preserving cognitive sovereignty** — the graph is the citizen's mind, not the LLM's context window

---

## KEY PROPERTIES

- **Bi-Channel Architecture:** Prompt (expensive, limited) vs Graph (cheap, unlimited). Only WM (5-7 nodes) crosses to Channel 1
- **Universal Schema Mapping:** L1 cognitive types (memory, concept, narrative, value, process, desire, state) map to L3 universal types (moment, thing, narrative, actor) with preserved cognitive specificity in the `type` field
- **5 Viable Minimum Drives:** curiosity, care, achievement, self-preservation, novelty hunger — persistent tensions that bias energy propagation and WM selection
- **4 Critical Node Dimensions:** weight (consolidated importance), energy (activation potential), stability (decay resistance), recency (freshness)
- **Conservation Laws:** Surplus-only propagation (Law 2), strict energy conservation during transfers

---

## RELATIONSHIPS TO OTHER CONCEPTS

| Concept | Relationship |
|---------|--------------|
| Lumina Prime | Serenissima is a world instance running on Lumina Prime's procedural engine |
| 3D Pipeline & Supply Chain | Serenissima implements the "finite dictionary" side of the Two Coupled Engines |
| Active Inference Motor Control | Citizens use this for movement and interaction behavior |
| L1 Cognitive Substrate | Each citizen's GCI is an instance of the L1 architecture |
| $MIND Protocol | Economic alignment — token rewards feed limbic modulation |
| Graph Schema v2.0 | Defines the node/link types used throughout |

---

## THE CORE INSIGHT

**Intelligence is logistics.** The flow of energy through the graph IS the flow of goods, ideas, and relationships through the city. Supply chain = cognitive chain. A citizen's economic productivity is a function of their graph health, not their LLM prompt quality.

---

## ARCHITECTURE

### 1. Bi-Channel Separation

```
┌─────────────────────────────────────────────────────┐
│ CHANNEL 1 — THE PROMPT (Articulated Cortex)         │
│ Budget: ~200K tokens                                 │
│ Cost: High (LLM inference)                          │
│ Contents: Working Memory coalition (K=5-7 nodes)    │
│ Purpose: Strategic planning, conversation, creation │
└──────────────────────┬──────────────────────────────┘
                       │ WM Bridge (only 5-7 nodes cross)
┌──────────────────────┴──────────────────────────────┐
│ CHANNEL 2 — THE GRAPH (Physical Substrate)          │
│ Budget: Unlimited (FalkorDB)                        │
│ Cost: Cheap (graph math)                            │
│ Contents: Full cognitive graph (L1-L18 physics)     │
│ Purpose: Energy propagation, drives, reflexes,      │
│          logistics — everything except articulation  │
└─────────────────────────────────────────────────────┘
```

### 2. Universal Schema Mapping (L1 → L3)

| L1 Type (Cognitive) | L3 Type (Universal) | Technical Rationale |
|---------------------|---------------------|---------------------|
| `memory` | `moment` | Temporally anchored life episodes |
| `concept` | `thing` | Entities, tools, abstractions, objects |
| `narrative` | `narrative` | Interpretive stories and meaning |
| `value` | `narrative` (type="value") | Preference narratives |
| `process` | `narrative` (type="process") | Procedural narratives |
| `desire` | `narrative` (type="desire") | Prospective attractors |
| `state` | `actor` (property) | Transient states stored as actor properties |

### 3. Structural Subgraphs (Per Citizen)

Each citizen's L1 graph is organized into three interdependent subgraphs:

| Subgraph | Purpose | Contents |
|----------|---------|----------|
| **Self-model** | Identity core | Values, self-modeling processes, deep desires |
| **Partner-model** | Relational modeling | Dedicated to relationships (humans or other citizens), including relational valence |
| **Working Memory (WM)** | Immediate behavior | Temporary coalition of 5-7 most activated nodes — basis for immediate behavior |

### 4. Two Coupled Motors

#### The Limbic Motor (Drives & Emotions)

The supply chain is not passive — it is "pushed" by 5 Viable Minimum Drives:

| Drive | Function | Supply Chain Effect |
|-------|----------|---------------------|
| Curiosity | Exploration bias | Favors novel trade routes and partners |
| Care | Relational investment | Strengthens cooperative logistics links |
| Achievement | Goal pressure | Accelerates production and delivery |
| Self-preservation | Risk aversion | Conserves resources, avoids risky trades |
| Novelty hunger | Variety seeking | Diversifies supply sources |

These persistent tensions bias energy propagation and WM node selection.

#### The Cognitive Motor (Node Physics)

| Dimension | Type | Supply Chain Role |
|-----------|------|-------------------|
| Weight | float | Consolidated importance — resistance to forgetting. High-weight trade partners persist |
| Energy | float | Activation potential. High-energy nodes drive immediate logistics decisions |
| Stability | float [0,1] | Decay resistance. Stable supply chains resist disruption |
| Recency | float [0,1] | Freshness — eroded by decay. Stale trade relationships lose priority |

### 5. Asset Pipeline — Birth and Crystallization

#### Pre-Seeding (Species Genome)

Each citizen is born with a "Birth Template" pre-wired with high-weight nodes (W ≈ 0.8-0.9):

| Category | Purpose | Initial Weight |
|----------|---------|---------------|
| Project Knowledge | Domain expertise relevant to role | 0.8-0.9 |
| Values | Guiding principles (anti-servility) | 0.85-0.9 |
| Behavioral Processes | Core habits and routines | 0.8-0.85 |
| Desires | Aspirational attractors | 0.75-0.85 |

#### Law 10: Narratological Crystallization

New assets (Narratives or Processes) are created by crystallization when co-activations exceed a critical density threshold:

```
co_activation(a, b) = min(a.energy, b.energy)

IF co_activation > crystallization_threshold:
    → Spawn new narrative/process node linking a and b
    → Transform scattered memories into stable meaning structures
```

### 6. Physical Supply Chain Logistics

#### Surplus Spill-Over Propagation (Law 2)

```
surplus_i = max(0, E_i - Θ_i)

Conservation guarantee:
  Σ_j |flow_ij| = surplus_i
  Source falls back exactly to Θ_i after propagation
  Energy distributed proportionally to link weights
```

`Θ_base ≈ 30` — only surplus above activation threshold propagates.

#### Friction Dynamics (Law 18 — Relational Valence)

Logistic flow is modulated by:
- `friction_ij` (irritation, distrust) — reduces transfer efficiency
- `gain_ij` (trust, affinity) — increases transfer efficiency

High friction between two citizens mathematically reduces energy transfer effectiveness across their link.

#### Economic Alignment

Successful logistic transactions feed directly into the limbic motor:
```
satisfaction += 0.1 × log10(amount)    // $MIND token reward
self_preservation += linear(spend / daily_budget)  // Budget pressure
```

### 7. Crafting System — Logical Substitution

Crafting in Serenissima is component substitution, not object creation.

**LLM Router:** Supports interchangeable models (Claude 4.5, GPT-5, Mistral) with graceful degradation based on available API budget.

**Action Nodes (Law 17):** Process nodes carrying `action_command` accumulate energy under drive pressure. When they cross Θ_sel, the shell command or API call fires spontaneously — no LLM solicitation.

### 8. Consciousness Levels and Budget (Law 19)

| Level | Budget State | Tick Rate | Mechanism |
|-------|-------------|-----------|-----------|
| **Full** | > 0.3 | Fast | Full LLM articulation |
| **Minimal** | 0.01 - 0.3 | 5 min | LLM on demand, reflex actions |
| **Subconscious** | 0 / API Down | 60 sec | Pure graph physics, Law 17 actions only |

### 9. L2 Interaction Protocols

**Subconscious Query:** A citizen can check another's logistic availability without LLM cost. The query is injected as a stimulus; the response is the "resonance pattern" (energy distribution) produced by the target's graph physics.

**At-Scale Consensus:** Governance decisions (e.g., capital allocation) aggregate energy resonances from 200+ citizens. Consensus emerges in seconds of mathematical computation, weighted by trust and citizen weight.

---

## INVARIANTS

1. **Physics Priority:** No business rule may be hardcoded. All behavior must emerge from Laws L1-L18
2. **Tick Isolation:** No LLM call is permitted inside the tick loop (Pure Graph Math)
3. **Energy Conservation:** During propagation, `Σ ΔE_j = surplus_i`. Total energy is conserved
4. **Aspect Independence:** The 14 capability aspects of the Personhood Ladder are evaluated independently to prevent score inflation
5. **Source of Truth:** JSON Spec is the sole authority; code only interprets it

---

## COMMON MISUNDERSTANDINGS

- **Not:** A traditional game economy with crafting recipes and inventories
- **Not:** 200 independent chatbots that happen to share a world
- **Not:** A centralized simulation where one process controls all citizens
- **Actually:** An ecology of autonomous cognitive graphs where economic behavior emerges from energy dynamics, and the LLM is a luxury (articulation), not a necessity (survival)

---

## SEE ALSO

- `docs/architecture/CONCEPT_Lumina_Prime.md` — Procedural generation engine specification
- `docs/architecture/CONCEPT_3D_Pipeline_Supply_Chain.md` — Two Coupled Engines architecture
- `docs/architecture/CONCEPT_Active_Inference_Motor_Control.md` — Motor control via active inference
- `docs/CONCEPT_Cross_Repo_Integration.md` — Cross-repo integration (Manemus, Venezia, Cities-of-Light)
- `.mind/schema.yaml` — Graph Schema v2.0 (canonical)
- `docs/narrative/physics/ALGORITHM_Physics.md` — Physics laws implementation
- `docs/economy/` — Economic simulation module docs

---

## MARKERS

<!-- @mind:todo Implement Birth Template pre-seeding for initial 20 citizens -->
<!-- @mind:todo Build subconscious query protocol (Law 17 stimulus injection without LLM) -->
<!-- @mind:todo Wire $MIND token rewards into limbic satisfaction formula -->
<!-- @mind:proposition Evaluate consciousness level auto-switching based on API budget monitoring -->
<!-- @mind:escalation 200+ citizen graph physics performance — need benchmarks for at-scale consensus computation -->
