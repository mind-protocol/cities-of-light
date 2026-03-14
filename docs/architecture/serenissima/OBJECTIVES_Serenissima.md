# OBJECTIVES -- Serenissima Asset Pipeline

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## CHAIN

```
THIS:            OBJECTIVES_Serenissima.md (you are here - START HERE)
PATTERNS:       ./PATTERNS_Serenissima.md
BEHAVIORS:      ./BEHAVIORS_Serenissima.md
ALGORITHM:      ./ALGORITHM_Serenissima.md
VALIDATION:     ./VALIDATION_Serenissima.md
IMPLEMENTATION: ./IMPLEMENTATION_Serenissima.md
SYNC:           ./SYNC_Serenissima.md

IMPL:           src/server/physics-bridge.js
                src/server/graph-client.js
                src/server/ai-citizens.js
                venezia/scripts/seed_venice_graph.py
                .mind/runtime/physics/
```

**Read this chain in order before making changes.** Each doc answers different questions. Skipping ahead means missing context.

---

## PRIMARY OBJECTIVES (ranked)

1. **Bi-channel cost efficiency** -- Run 200+ citizens without 200+ LLM sessions. 95% of cognition runs on Channel 2 (FalkorDB graph physics, cheap, unlimited). Only Working Memory coalitions (K=5-7 nodes) cross the bridge to Channel 1 (LLM prompt, ~200K tokens, expensive). Without this, the monthly API cost of Serenissima would exceed the entire project budget. With it, most citizens run on graph math alone, and only those in active conversation or strategic planning consume LLM tokens.

2. **Cognitive sovereignty** -- The graph IS the citizen's mind, not the LLM's context window. Every citizen's identity, memories, relationships, drives, and beliefs persist in FalkorDB as structured nodes and weighted edges. The LLM is a luxury -- it articulates what the graph already knows. If the LLM is unavailable, the citizen continues to exist, act, and evolve. Their mind does not vanish when the prompt window closes.

3. **Subconscious survival** -- When API budget = 0 or the LLM provider is down, citizens do not die. They drop to subconscious consciousness level (60-second tick, pure graph physics). Law 17 action nodes fire spontaneously based on accumulated energy. Citizens continue their routines, maintain their supply chains, react to graph stimuli -- they just cannot articulate complex thoughts. The city never goes dark.

4. **Economic alignment** -- The physical supply chain (goods, ducats, trade routes) and the cognitive supply chain (beliefs, relationships, energy) are the same system. A successful trade feeds the limbic motor: `satisfaction += 0.1 * log10(amount)`. Budget pressure feeds self-preservation: `self_preservation += linear(spend / daily_budget)`. Economic health IS cognitive health. A citizen who is prosperous thinks differently than one who is desperate -- not because we wrote different prompts, but because their graph energy distribution is fundamentally different.

5. **Emergent narrative through logistics** -- No scripted events, no authored crises, no scheduled dramas. Narrative emerges from the surplus spill-over of energy through weighted edges, modulated by friction and drives. When a glassblower's supply chain breaks, their frustration accumulates naturally in the graph, tensions rise with trading partners, and if enough citizens face the same disruption simultaneously, a Moment flips. The crisis was not designed. It was inevitable given the energy flows.

---

## NON-OBJECTIVES

- **Individual LLM session quality** -- We do not optimize for making each citizen's LLM conversation maximally impressive. We optimize for making the graph state rich enough that even a brief LLM articulation produces authentic dialogue.
- **Real-time tick performance below 100ms** -- The physics tick must complete in under 1 second, not under 100ms. Graph math at the scale of 200 citizens is not a hot path. The hot path is the 3D render loop.
- **Full LLM articulation for all citizens** -- Most citizens most of the time operate at minimal or subconscious consciousness. Full articulation is reserved for citizens in active visitor conversation or undergoing moment flips. This is by design, not a limitation.
- **Traditional game economy** -- We do not build inventories, crafting recipes, or shop UIs. The economy is energy flow through the graph. Crafting is component substitution. Trade is surplus propagation.

---

## TRADEOFFS (canonical decisions)

- When **LLM quality** conflicts with **cost efficiency**, choose cost efficiency. A citizen who speaks in simple sentences from graph physics is better than a citizen who speaks beautifully but costs $0.50 per interaction.
- When **real-time responsiveness** conflicts with **graph fidelity**, choose graph fidelity. It is acceptable for a consciousness level switch to take one tick cycle (up to 60 seconds) if it means the graph state remains consistent.
- When **individual citizen depth** conflicts with **population scale**, choose population scale. 200 citizens with authentic graph-driven lives are more valuable than 20 citizens with deep LLM conversations.
- We accept **reduced articulation quality at subconscious level** to preserve **city-wide continuity**. A city that never sleeps, even crudely, is more immersive than one that pauses when the API key expires.
- We accept **complexity in the bi-channel routing** to preserve **the separation between mind (graph) and voice (LLM)**. The routing logic is complex, but the invariant it protects -- cognitive sovereignty -- is non-negotiable.

---

## SUCCESS SIGNALS (observable)

- 200+ citizens run simultaneously with fewer than 10 active LLM sessions at any given time
- A citizen whose LLM access is revoked mid-conversation continues behaving coherently via Law 17 reflexes within 1 tick
- Surplus spill-over propagation across the full 200-citizen graph completes in under 500ms per tick
- Visitor cannot distinguish a citizen at minimal consciousness from one at full consciousness during a brief (<30 second) encounter
- At-scale consensus (200+ citizen resonance aggregation) completes in under 2 seconds of pure graph computation
- A new citizen seeded from a birth template exhibits role-appropriate behavior within their first 3 ticks without any LLM interaction
- Economic events in one district produce observable narrative effects in connected districts within 2-4 ticks
