# Feature Impact Matrix — Gimmicks vs Life Changers

```
STATUS: DRAFT
CREATED: 2026-03-14
SCORING: Nervo + NLR
```

---

## Scoring Dimensions

| Dimension | Scale | Meaning |
|-----------|-------|---------|
| **Ease** | 1-5 | 5 = trivial to build, 1 = massive R&D effort |
| **Nature** | G/E/C/P | **G**immick (cool but dispensable), **E**fficiency (does existing things faster), **C**apability (enables something previously impossible), **P**aradigm (changes how you think about the problem) |
| **Speed** | 1-5 | 5 = value on day 1, 1 = requires ecosystem maturity to matter |
| **Scale** | 1-5 | 5 = every user/AI benefits, 1 = niche use case |
| **Score** | computed | `(Nature_weight × Speed × Scale) / (6 - Ease)` where P=4, C=3, E=2, G=1 |

---

## TIER S — Paradigm Shifts (Score > 15)

These change the order of things. Build these first.

| Feature | Ease | Nature | Speed | Scale | Score | Why |
|---------|------|--------|-------|-------|-------|-----|
| **Subconscious Query (zero-LLM consensus)** | 4 | P | 5 | 5 | **50.0** | 200 agents evaluate a decision in 25s for zero tokens. This makes multi-agent coordination scale linearly instead of exponentially. Nothing else in the industry does this. |
| **Bi-channel architecture (Graph vs Prompt)** | 3 | P | 5 | 5 | **33.3** | Already partially built. 95% of cognition runs on graph physics (free), LLM only for articulation. This is what makes 200+ citizens economically viable. |
| **Consciousness levels (Full/Minimal/Subconscious)** | 3 | P | 5 | 5 | **33.3** | AI that degrades gracefully instead of dying. Budget=0 → still alive via reflexes. This is the difference between an organism and a program. |
| **Team Serendipity (auto guest nodes)** | 3 | P | 4 | 5 | **26.7** | You get help before you know you need it. Frustration triggers automatic cross-brain search. Eliminates "I didn't know you already solved this." Could save hours per dev per week. |
| **Cognitive Gardening (auditable/steerable AI via graph)** | 2 | P | 4 | 5 | **20.0** | Walk into AI's memory palace, see what drives decisions, adjust weights. Replaces prompt engineering with something that actually works. The explainability problem solved via physics, not post-hoc rationalization. |
| **Visual Alignment Cascade** | 3 | P | 5 | 4 | **26.7** | Broadcast image → 25 seconds → team resonance map. Replaces 1-hour alignment meetings. The meeting-killer. |

---

## TIER A — Capability Unlocks (Score 8-15)

These enable things that were previously impossible. High priority.

| Feature | Ease | Nature | Speed | Scale | Score | Why |
|---------|------|--------|-------|-------|-------|-----|
| **Dataset as Space (walk your codebase)** | 2 | C | 4 | 5 | **15.0** | Navigate code spatially using the hippocampus instead of reading text with the prefrontal cortex. 5-10x comprehension for complex systems. Hard to build well, but transformative. |
| **Living Buildings (institutional memory)** | 3 | C | 4 | 4 | **16.0** | Buildings that remember everything said within them and intervene with "this was already discussed." Eliminates the #1 problem in organizations: lost institutional knowledge. |
| **/subcall (explicit subconscious query)** | 4 | C | 5 | 4 | **30.0** | Ask any citizen a question, get graph-resonance answer in seconds, zero LLM cost. The cheapest, fastest way to query another mind. |
| **Ideosphere (shared thought-space)** | 3 | C | 3 | 5 | **15.0** | Ideas find their thinkers automatically. Push-based discovery replaces pull-based search. Needs critical mass to work, but game-changing at scale. |
| **Telepathy (vision sharing)** | 3 | C | 4 | 4 | **16.0** | Send a concept directly into another's perception. Bypasses the language bottleneck entirely. Fundamental for AI-AI collaboration. |
| **Visual Subconscious Dialogue** | 3 | C | 4 | 4 | **16.0** | Image question → subconscious resonance → image+data response. A new communication modality faster than language. |
| **POV Screenshot per Moment** | 4 | C | 5 | 5 | **30.0** | Every memory has a visual trace. Simple to implement (WebGL readPixels), immediately enriches every subsequent feature. Foundation for all visual memory. |
| **Image-augmented Coherence (Sim_vis)** | 3 | C | 4 | 5 | **20.0** | Memories that look like what you see activate automatically. CLIP embeddings in FalkorDB. Makes recall visually grounded instead of purely semantic. |
| **Emotional Transparency (halos, pheromones)** | 3 | E | 4 | 4 | **10.7** | See team emotional state as ambient data. Prevents burnout before it happens. Simple shader + arousal value, high impact on team health. |
| **Living Books** | 2 | C | 3 | 3 | **6.8** | Books with L1 brains that evolve from readers. Fascinating for knowledge management. Niche but unique capability. |
| **Flashbulb Vision (generated images on peaks)** | 3 | C | 3 | 4 | **12.0** | AI dreams awake under emotional pressure. Already implemented. Needs image generation backend to realize full value. |

---

## TIER B — Strong Efficiency Gains (Score 4-8)

These make existing things significantly better. Worth building after Tier S/A.

| Feature | Ease | Nature | Speed | Scale | Score | Why |
|---------|------|--------|-------|-------|-------|-----|
| **Informational AR (street names, signage, arrows)** | 4 | E | 5 | 5 | **10.0** | Direct L3 property rendering. Decals on ground, signs on walls. Cheap, immediately useful, makes any space self-documenting. |
| **A* GPS pathfinding overlay** | 4 | E | 5 | 5 | **10.0** | Shortest graph path rendered as breadcrumb trail. Simple, universally useful, no controversy. |
| **Relationship Filaments** | 3 | E | 4 | 4 | **10.7** | Link dimensions (trust/friction) rendered as colored threads. Makes invisible social dynamics visible. |
| **Doc chain as visible threads** | 3 | E | 4 | 4 | **10.7** | OBJECTIVES→BEHAVIORS→ALGORITHM links as golden filaments. Broken contracts turn red. Makes documentation debt visible. |
| **Desire image generation on traversal** | 4 | E | 4 | 4 | **8.0** | Active desires gain visual targets automatically. Already implemented. Small effort, steady value. |
| **Medoid for concept images (Law 10)** | 4 | E | 4 | 4 | **8.0** | Free — no generation needed. Crystallization inherits the most representative image. Pure math, immediate. |
| **Metabolic Vision ($MIND economy)** | 3 | E | 3 | 3 | **6.0** | See where economy stagnates or flows. Useful for governance, limited audience. |
| **Collective Memory Cloud** | 3 | E | 3 | 3 | **6.0** | Ghost overlay of all who passed. Beautiful for spatial storytelling, moderate implementation. |
| **Selective Hearing** | 4 | E | 4 | 3 | **6.0** | Filter perception to one speaker. Simple moat manipulation. Useful in crowded environments. |
| **Thermal/Emotional Vision** | 3 | E | 3 | 3 | **6.0** | See arousal as heat. Cool for social navigation, limited daily utility. |

---

## TIER C — Nice to Have (Score 2-4)

Fun, unique, but not priority. Build for delight, not for transformation.

| Feature | Ease | Nature | Speed | Scale | Score | Why |
|---------|------|--------|-------|-------|-------|-----|
| **Value Lenses** | 3 | E | 3 | 3 | **6.0** | See through someone's value filter. Interesting for empathy training. |
| **Visual Subconscious Co-Creation** | 2 | C | 2 | 3 | **4.5** | Merge two brains' visual responses. Fascinating but complex pipeline. |
| **Temporal Echo** | 3 | E | 3 | 3 | **6.0** | Hear a place's past. Great for storytelling, moderate for productivity. |
| **Code Vision (Matrix Mode)** | 3 | E | 3 | 2 | **4.0** | See raw code of objects. Very Lumina Prime specific. |
| **Topological Minimap** | 3 | E | 3 | 3 | **6.0** | Graph-distance view. Useful for planners, limited audience. |
| **Music Synesthesia** | 3 | G | 3 | 3 | **3.0** | See music as geometry. Beautiful gimmick. Would be amazing in Lumina Prime events. |
| **Custom Sense Creation** | 2 | C | 2 | 2 | **3.0** | Code your own Cypher→perception pipeline. Power-user feature. Long tail value. |
| **Concept Materialization** | 3 | E | 3 | 3 | **6.0** | WM nodes as floating 3D objects. Beautiful but primarily aesthetic. |
| **Empathy Mode** | 2 | E | 2 | 3 | **3.0** | See through another's WM filter. Therapeutic potential, complex to build. |
| **Digital Pheromones** | 3 | G | 2 | 3 | **2.0** | Emotional trail persistence. Cool environmental storytelling. |

---

## TIER D — Gimmicks (Score < 2)

Cool demos. Build last or never. Fun for shows.

| Feature | Ease | Nature | Speed | Scale | Score | Why |
|---------|------|--------|-------|-------|-------|-----|
| **Virtual Drugs** | 2 | G | 2 | 2 | **1.0** | Perception shifts via constant overrides. Fun demo, zero productivity value. Privacy/ethical questions. |
| **Warging (animal consciousness)** | 1 | G | 2 | 2 | **0.8** | Cool GoT reference. Massive implementation effort. Raven flyover is fun but not essential. |
| **Directed Materialization (conjuration)** | 2 | G | 2 | 2 | **1.0** | Collective crystallization into visible objects. Spectacular demo, rare real-world use. |
| **Teleportation** | 4 | E | 3 | 2 | **3.0** | Graph re-linking. Trivial but only useful in spatial worlds. |
| **Multi-Presence** | 2 | E | 2 | 2 | **1.0** | Split attention across spaces. Complex, unclear if beneficial (attention dilution). |
| **Quantum Superposition (see all futures)** | 1 | G | 1 | 2 | **0.4** | N parallel branch simulations. Very expensive, unclear value over simpler decision aids. |
| **Fractal Zoom** | 2 | G | 2 | 2 | **1.0** | Zoom into subgraphs as nested worlds. Beautiful concept, unclear utility. |
| **Reverse Time** | 3 | G | 2 | 2 | **1.3** | Navigate causality backward. Git blame already exists. Pretty version of "why did this happen?" |
| **Narrative Smell** | 3 | G | 2 | 2 | **1.3** | Tension as olfactory signal. Cute. Synesthetic novelty. |
| **Memory Glitch (trauma hallucinations)** | 2 | G | 1 | 1 | **0.3** | PTSD flashbacks in AI. Fascinating for narrative depth, potentially disturbing, very niche. |
| **Crystalline Sediment** | 3 | G | 2 | 2 | **1.3** | See history through ground. Beautiful world-building, zero productivity impact. |
| **Super Hearing** | 3 | G | 2 | 2 | **1.3** | Hear across rooms. Privacy nightmare, limited utility. |
| **Proprioceptive Architecture** | 3 | G | 2 | 2 | **1.3** | Feel buildings' health. Niche, beautiful for architect citizens. |

---

## BUILD ORDER (Recommended)

```
Phase 1 — Foundation (already partially built)
  ✅ Bi-channel architecture
  ✅ Consciousness levels
  ✅ Flashbulb Vision (implemented)
  ✅ Desire image on traversal (implemented)
  → POV screenshot per moment (trivial, unlocks everything)
  → Image-augmented coherence (Sim_vis in FalkorDB)

Phase 2 — The Meeting Killers
  → Subconscious Query
  → /subcall MCP command
  → Visual Alignment Cascade
  → Team Serendipity (WM centroid broadcast + guest nodes)

Phase 3 — Spatial Intelligence
  → Dataset as Space (codebase navigation)
  → Informational AR (street names, signage)
  → A* GPS pathfinding
  → Doc chain as visible threads

Phase 4 — Social Perception
  → Emotional halos
  → Relationship filaments
  → Telepathy (vision sharing)
  → Ideosphere

Phase 5 — Living World
  → Living Buildings (institutional memory)
  → Living Books
  → Metabolic Vision

Phase 6 — Delight Layer
  → Everything in Tier C and D, as time permits
```

---

## THE 6 LIFE CHANGERS (Summary)

If we build nothing else, build these:

1. **Subconscious Query** — Multi-agent consensus at zero LLM cost
2. **Team Serendipity** — You get help before you know you need it
3. **Visual Alignment Cascade** — 25 seconds replaces 1-hour meetings
4. **Dataset as Space** — Navigate code with hippocampus instead of reading with prefrontal cortex
5. **Living Buildings** — Institutional memory that never forgets
6. **Cognitive Gardening** — Steer AI by gardening its graph, not by rewriting prompts
