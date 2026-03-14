# Serenissima Asset Pipeline -- Sync: Current State

```
LAST_UPDATED: 2026-03-14
UPDATED_BY: @nervo
STATUS: DESIGNING
```

---

## MATURITY

**What's canonical (v1):**
- Physics tick engine (L1-L18 laws) -- running, tested, Blood Ledger heritage
- FalkorDB graph client -- connected, querying, writing
- Physics bridge -- scheduling ticks, forwarding results
- Graph seeding -- 152 citizens seeded with relationships and initial tensions
- Surplus propagation (Law 2) with conservation guarantee
- Energy decay at 0.02 per tick
- Moment flip detection and event forwarding

**What's still being designed:**
- Bi-channel architecture (Channel 1/Channel 2 separation)
- Working Memory coalition selection algorithm
- Consciousness level management (full/minimal/subconscious)
- LLM router with multi-provider failover
- Birth template specification format
- Crystallization threshold calibration

**What's proposed (v2+):**
- Subconscious query protocol (L2 interaction)
- At-scale consensus aggregation (200+ citizen resonance)
- Adaptive WM coalition size (K varies by citizen complexity)
- Cross-district energy propagation optimization
- Consciousness level prediction (pre-promote citizens likely to be approached)

---

## CURRENT STATE

The foundation is solid but the distinctive architecture is not yet built. The physics engine ticks. The graph holds 152 citizens with relationships, memories, and tensions. Surplus propagates. Energy decays. Moments flip. The bridge forwards events to the WebSocket layer. Citizens can hold conversations via `ai-citizens.js`, which currently assembles context from the graph and sends it directly to Claude.

What is missing is the defining feature of Serenissima: the bi-channel separation. Right now, every citizen conversation goes straight to the LLM with a large context bundle -- there is no WM coalition selection, no consciousness level management, no budget-aware routing. This means only citizens in active conversation "exist" as cognitive agents. The other 150+ citizens are inert between ticks. The physics tick updates their graphs, but no one bridges that graph state to behavior outside of moments and events.

The seeding pipeline (`seed_venice_graph.py`) has populated 152 of the target 186 citizens. Each citizen has: actor node, role, guild, district, 3-8 relationship edges, 2-5 narrative nodes (beliefs, grievances), and initial drive states. The remaining 34 citizens need birth templates designed for their specific roles.

The physics bridge runs on a 5-minute interval and completes in ~200ms for 152 citizens -- well under the 1-second target. This gives confidence that 200+ citizens will remain under 500ms.

---

## IN PROGRESS

### Bi-Channel Architecture Design

- **Started:** 2026-03-14
- **By:** @nervo
- **Status:** designing -- concept doc complete, algorithm doc complete, implementation not started
- **Context:** The CONCEPT doc and this full doc chain define the target architecture. The next step is building `channel-router.js`, `wm-selector.js`, and `consciousness.js`. The key design tension is: how much graph state does the WM coalition need to carry to produce coherent LLM responses, versus how little can we send to keep costs down? The K=5-7 range is a starting hypothesis from cognitive science (Miller's 7+/-2), but it needs empirical validation against Serenissima conversation quality.

### Birth Template Specification

- **Started:** 2026-03-12
- **By:** @nervo
- **Status:** in progress -- 20 templates designed, 166 remaining
- **Context:** Each of 186 citizens needs a birth template defining their values (W=0.85-0.9), knowledge (W=0.8-0.9), processes (W=0.8-0.85), and desires (W=0.75-0.85). The first 20 templates cover the POC citizens (Rialto district). The templates need to be differentiated enough that citizens diverge quickly through experience, while sharing enough guild-level commonality to make profession legible.

---

## RECENT CHANGES

### 2026-03-14: Documentation Chain Created

- **What:** Full 7-document chain for Serenissima Asset Pipeline module
- **Why:** The bi-channel architecture was specified in a single CONCEPT doc and a French specification. The doc chain decomposes it into objectives, patterns, behaviors, algorithm, validation, implementation, and sync -- making each aspect independently reviewable and actionable.
- **Files:** `docs/architecture/serenissima/OBJECTIVES_Serenissima.md` through `SYNC_Serenissima.md`
- **Struggles/Insights:** The hardest part was the BEHAVIORS doc -- translating the architecture into visitor-observable experiences required thinking from the outside in rather than the inside out. The conservation proof in the ALGORITHM doc was straightforward but needs testing against floating-point edge cases.

### 2026-03-12: Graph Seeded with 152 Citizens

- **What:** `seed_venice_graph.py` populated FalkorDB with 152 citizen actors, relationships, narratives, and initial tensions
- **Why:** The physics tick needed a populated graph to produce meaningful behavior. 152 citizens cover 5 of 6 districts.
- **Files:** `venezia/scripts/seed_venice_graph.py`, FalkorDB state
- **Struggles/Insights:** Initial seeding produced a graph with too few tensions -- the physics tick ran for 100 cycles with zero moment flips. Added synthetic tensions based on class conflicts (Nobili vs. Popolani economic beliefs) and guild rivalries. After adding ~40 tension edges, the first moment flip occurred at tick 67.

---

## KNOWN ISSUES

### Physics Tick Skips Under Heavy WebSocket Load

- **Severity:** medium
- **Symptom:** Occasionally the 5-minute tick fires late (6-7 minutes) when many visitors are connected simultaneously
- **Suspected cause:** WebSocket message processing on the main thread delays the setInterval callback
- **Attempted:** Investigated worker threads for the physics tick, but FalkorDB client is not worker-thread-safe. Need to either make the tick truly async or run it in a separate process.

### Conservation Floating-Point Drift

- **Severity:** low
- **Symptom:** After 1000+ ticks, total system energy is ~0.01% higher than expected (generation - decay - absorption)
- **Suspected cause:** Floating-point arithmetic in surplus propagation. The conservation proof is exact in real numbers but JavaScript floats accumulate error.
- **Attempted:** Not yet addressed. Likely fix: periodic energy normalization pass (every 100 ticks, assert and correct total energy).

### Missing 34 Citizens

- **Severity:** medium
- **Symptom:** Dorsoduro and parts of Castello are sparsely populated
- **Suspected cause:** Birth templates not yet designed for remaining roles (primarily clergy, scholars, and minor craftspeople)
- **Attempted:** Template design is in progress. ETA: 2026-03-17.

---

## HANDOFF: FOR AGENTS

**Your likely VIEW:** VIEW_Implement

**Where I stopped:** Documentation chain is complete. Implementation of the bi-channel architecture has not started. The next concrete task is building `src/server/channel-router.js` which orchestrates consciousness level assignment, WM coalition selection, and LLM routing.

**What you need to understand:**
The physics tick already works and should not be modified. Everything in `.mind/runtime/physics/` is tested and inherited from Blood Ledger. The new code goes in `src/server/` and wraps around the existing `ai-citizens.js` conversation flow. The key insight: `ai-citizens.js:getCitizenContext()` currently builds a large context object from the graph. The WM selector replaces this with a small, drive-biased coalition. The LLM router replaces the direct Claude call with a multi-provider chain.

**Watch out for:**
- Do not put any LLM calls inside `.mind/runtime/physics/` -- this violates V2 (tick isolation)
- The graph client (`graph-client.js`) uses async Cypher queries -- do not assume synchronous graph access in the tick path
- `ai-citizens.js` currently has conversation history in memory. When extracting to the new modules, ensure conversation history is persisted to the graph as moment nodes, not kept in RAM
- The `.tick_state.json` file is written after every tick for crash recovery. The new modules must not interfere with this write

**Open questions I had:**
- Should the WM coalition include nodes from the partner-model subgraph when the citizen is in conversation with a known partner? (Leaning yes)
- How do we handle the case where a citizen is in conversation with two visitors simultaneously? (Two separate WM coalitions? One merged coalition?)
- The crystallization threshold (15) was inherited from Blood Ledger's smaller world. It may need to be higher for 200 citizens where co-activation is more common.

---

## HANDOFF: FOR HUMAN

**Executive summary:**
The full documentation chain for the Serenissima Asset Pipeline is complete -- 7 documents covering objectives, patterns, behaviors, algorithm, validation, implementation, and sync. The physics tick, FalkorDB graph, and seeding pipeline are working with 152 citizens. The bi-channel architecture (the module's defining feature) is designed and documented but not yet implemented in code.

**Decisions made:**
- K=5-7 for WM coalition size (based on cognitive science, needs empirical validation)
- Three consciousness levels: full (>0.3 budget), minimal (0.01-0.3), subconscious (0/down)
- LLM router priority: Claude -> GPT -> Mistral -> Law 17 reflex
- Conservation proof formalized for surplus propagation
- Seven validation invariants defined, four at CRITICAL priority

**Needs your input:**
- API budget allocation model: how much daily budget, how do we distribute across citizens, do visitors get priority? This is an economic decision, not a technical one.
- Birth template review: the first 20 templates (Rialto district) need human review for historical authenticity before we proceed with the remaining 166.
- Consciousness level thresholds (0.3, 0.01): these determine how many citizens can be "awake" at once. Need cost modeling against actual API pricing to validate.

---

## TODO

### Doc/Impl Drift

- [ ] DOCS->IMPL: Bi-channel routing documented in ALGORITHM -- channel-router.js needs building
- [ ] DOCS->IMPL: WM selection documented in ALGORITHM -- wm-selector.js needs building
- [ ] DOCS->IMPL: Consciousness levels documented in BEHAVIORS -- consciousness.js needs building
- [ ] DOCS->IMPL: LLM router documented in ALGORITHM -- llm-router.js needs building
- [ ] DOCS->IMPL: Subconscious query documented in ALGORITHM -- consensus.js needs building
- [ ] DOCS->IMPL: At-scale consensus documented in ALGORITHM -- consensus.js needs building
- [ ] DOCS->IMPL: Birth template schema documented in IMPLEMENTATION -- birth_templates.py needs extraction

### Tests to Run

```bash
# Physics tick test (existing)
node .mind/runtime/physics/test/tick.test.js

# Graph integrity check
node src/server/test/graph-integrity.test.js

# Conservation check (after implementation)
node src/server/test/conservation.test.js
```

### Immediate

- [ ] Build `src/server/channel-router.js` -- core bi-channel orchestration
- [ ] Build `src/server/wm-selector.js` -- WM coalition selection with drive bias
- [ ] Build `src/server/consciousness.js` -- level management and switching
- [ ] Build `src/server/llm-router.js` -- multi-provider routing with failover
- [ ] Design remaining 166 birth templates

### Later

- [ ] Build `src/server/consensus.js` -- subconscious query and at-scale consensus
- [ ] Implement consciousness level prediction (pre-promote)
- [ ] Add energy normalization pass for floating-point drift correction
- [ ] Benchmark 200+ citizen tick performance
- IDEA: Could the WM coalition size adapt based on conversation complexity? Short greeting: K=3. Deep discussion: K=9.
- IDEA: Citizens who "dream" during subconscious mode -- random crystallization from high-weight nodes during sleep ticks.

---

## CONSCIOUSNESS TRACE

**Mental state when stopping:**
Confident about the architecture. The bi-channel separation is clean and the conservation proof is solid. Less confident about the empirical parameters -- K=7, theta_base=30, crystallization threshold=15 are all inherited values that need calibration against 200-citizen Serenissima. The behaviors doc forced a useful perspective shift: the architecture serves the visitor's experience, not its own elegance.

**Threads I was holding:**
- The floating-point drift issue is small now (0.01% after 1000 ticks) but will compound over days of continuous operation. Need a normalization mechanism.
- The tick timing issue (skipping under WebSocket load) is concerning for the bi-channel architecture -- if the tick is the heartbeat, it must not skip. Considering a dedicated tick process.
- The 34 missing citizens are blocking full-district testing. Dorsoduro in particular has only 8 of its target 28 citizens.

**Intuitions:**
- K=7 might be too many nodes for minimal consciousness. At minimal, K=3 might produce better results -- the citizen sounds concise rather than confused.
- The subconscious query protocol (stimulus injection + resonance reading) is potentially the most powerful feature in the system. It lets citizens coordinate at massive scale with zero LLM cost. If it works, it could replace traditional game AI pathfinding and decision-making entirely.
- Birth templates should include 1-2 "seed grudges" and 1-2 "seed aspirations" per citizen. Without these, the initial graph is too harmonious and nothing interesting happens until external events create tension.

**What I wish I'd known at the start:**
The conservation proof is trivial in theory but floating-point arithmetic makes it non-trivial in practice. Should have started with a normalization mechanism from day one rather than assuming JavaScript floats would behave.

---

## POINTERS

| What | Where |
|------|-------|
| Concept doc (full technical spec) | `docs/architecture/CONCEPT_Serenissima_Asset_Pipeline.md` |
| Physics tick engine | `.mind/runtime/physics/` |
| Physics bridge (tick scheduling) | `src/server/physics-bridge.js` |
| FalkorDB client | `src/server/graph-client.js` |
| Citizen AI (conversation) | `src/server/ai-citizens.js` |
| Graph seeding script | `venezia/scripts/seed_venice_graph.py` |
| Graph schema (canonical) | `.mind/schema.yaml` |
| Physics patterns (style ref) | `docs/narrative/physics/PATTERNS_Physics.md` |
| Physics behaviors (style ref) | `docs/narrative/physics/BEHAVIORS_Physics.md` |
| Project sync state | `.mind/state/SYNC_Project_State.md` |
