# ESTIMATION: Complexity Matrix -- Venezia

Per-module scoring across 5 dimensions: context budget, technical complexity, connectivity, estimated LOC, and estimated sessions. Scores derived from IMPLEMENTATION + VALIDATION + ALGORITHM doc analysis.

---

## Scoring Methodology

| Dimension | How Computed |
|-----------|-------------|
| **Context Budget** | Doc chain tokens + files to create × 3.5K + invariants × 500. S (<30K), M (30-80K), L (80-150K), XL (150K+) |
| **Technical Complexity** | Average of: novelty (1-5), external APIs (1-5), real-time constraints (1-5), state management (1-5), error surface (1-5) |
| **Connectivity** | imports_from + exports_to + shared_state + event_coupling. Leaf (0-3), Branch (4-7), Hub (8-12), Core (13+) |
| **Estimated LOC** | (source files × avg size) + config + tests. Aggregated across all milestone phases. |
| **Estimated Sessions** | Based on context budget, complexity, and multi-phase build. One session ≈ one Claude Code conversation. |

---

## Module Scores

### WORLD

| Module | Context Budget | Complexity | Connectivity | Type | Est. LOC | Est. Sessions | Milestone Phases |
|--------|---------------|------------|-------------|------|----------|---------------|------------------|
| **world/districts** | XL | 5 | 8 (Hub) | Hub | 8,500 | 20 | POC → Alpha → Beta |
| **world/atmosphere** | M | 3 | 7 (Branch) | Branch | 2,600 | 8 | Alpha → Beta |
| **world/navigation** | M | 3 | 5 (Branch) | Branch | 1,500 | 4 | POC(partial) → Alpha |

**world/districts** is the largest module by LOC and sessions. It spans 3 milestone phases: Rialto in POC, 6 remaining districts in Alpha, weather/economy effects in Beta. Procedural generation from Airtable building data, LOD system, canal geometry, and prop placement make it technically the most complex module. XL context budget means multi-session work with compaction required.

**world/atmosphere** is mid-range. Day/night cycle + fog + district mood in Alpha, weather + biometrics + particles in Beta. No POC work (fixed time of day).

**world/navigation** is the smallest world module. Desktop WASD in POC, VR + gondola + bridges in Alpha. Straightforward input handling with collision.

### CITIZENS

| Module | Context Budget | Complexity | Connectivity | Type | Est. LOC | Est. Sessions | Milestone Phases |
|--------|---------------|------------|-------------|------|----------|---------------|------------------|
| **citizens/mind** | L | 5 | 10 (Hub) | Hub | 3,600 | 12 | POC → Alpha → Beta |
| **citizens/embodiment** | XL | 5 | 8 (Hub) | Hub | 3,800 | 12 | POC(partial) → Alpha → Beta |
| **citizens/population** | L | 4 | 9 (Hub) | Hub | 2,300 | 8 | Alpha → Beta |

**citizens/mind** is the soul of the project. Context assembly, Claude API integration, memory persistence, trust system, belief injection, mood computation. Complexity 5: novel consciousness architecture, 3 external APIs (Claude, FalkorDB, Airtable), complex state machine (trust × mood × memory heat), significant error surface (API failures, memory corruption, belief inconsistency). Hub connectivity: consumed by voice/pipeline, narrative/events, narrative/physics; depends on economy/sync, narrative/graph.

**citizens/embodiment** is the visual counterpart. 3-tier LOD system (FULL/ACTIVE/AMBIENT), class-based appearance, mood expression through body, activity animation. Complexity 5: novel instanced rendering at scale, glTF pipeline, real-time tier transitions. XL context budget due to asset pipeline + animation system.

**citizens/population** manages the 186-citizen simulation layer. Tier assignment, spawn/despawn, crowd density, daily rhythms. Depends on sync data and embodiment system.

### NARRATIVE

| Module | Context Budget | Complexity | Connectivity | Type | Est. LOC | Est. Sessions | Milestone Phases |
|--------|---------------|------------|-------------|------|----------|---------------|------------------|
| **narrative/graph** | M | 4 | 9 (Hub) | Hub | 2,900 | 10 | POC → Alpha → Beta |
| **narrative/physics** | M | 5 | 7 (Branch) | Branch | 1,900 | 7 | POC → Alpha |
| **narrative/events** | M | 4 | 8 (Hub) | Hub | 2,800 | 9 | Alpha → Beta |

**narrative/graph** is the knowledge substrate. FalkorDB schema, citizen seeding, belief queries, chorus effect. Hub connectivity: physics, events, and mind all depend on graph data.

**narrative/physics** is research-level. Energy pump/route/decay/flip cycle, homeostasis, moment detection. Complexity 5: novel algorithm (Blood Ledger physics adapted to Venice), complex state machine (energy flow + tension accumulation + flip cooldowns). No external APIs beyond FalkorDB, but the algorithm itself is the hard part.

**narrative/events** bridges physics to the 3D world. Event types, lifecycle management, atmosphere effects, Forestiere news injection. Depends on physics for triggers and graph for context.

### ECONOMY

| Module | Context Budget | Complexity | Connectivity | Type | Est. LOC | Est. Sessions | Milestone Phases |
|--------|---------------|------------|-------------|------|----------|---------------|------------------|
| **economy/sync** | M | 3 | 12 (Hub) | Hub | 1,700 | 6 | POC → Alpha → Beta |
| **economy/simulation** | XL | 5 | 8 (Hub) | Hub | 3,500 | 10 | Beta |
| **economy/governance** | L | 4 | 6 (Branch) | Branch | 2,200 | 7 | Beta |

**economy/sync** is the data foundation. Everything depends on Airtable citizen state flowing through sync. Hub connectivity (12): nearly every module reads sync cache. But the code itself is straightforward (fetch, diff, cache swap) — complexity 3.

**economy/simulation** is the heaviest Beta module. Full activity processor, production engine, trade system, stratagems, market dynamics, boom/bust, bankruptcy. Complexity 5: novel economic simulation, 2 external APIs (Airtable, Serenissima FastAPI), complex state machine, cascading failure modes.

**economy/governance** layers political systems on top of simulation. Grievance engine, council deliberation, enforcement. Depends on simulation producing economic pressure.

### VOICE

| Module | Context Budget | Complexity | Connectivity | Type | Est. LOC | Est. Sessions | Milestone Phases |
|--------|---------------|------------|-------------|------|----------|---------------|------------------|
| **voice/pipeline** | L | 4 | 6 (Branch) | Branch | 2,800 | 8 | POC → GA |
| **voice/spatial** | M | 3 | 5 (Branch) | Branch | 3,200 | 9 | POC → Alpha → Beta |

**voice/pipeline** is the interaction channel. STT (Whisper) → LLM (Claude) → TTS (ElevenLabs) → spatial playback. 3 external APIs with rate limits. Real-time constraint: <2.5s total latency. Complexity 4 due to API orchestration and streaming.

**voice/spatial** is the audio substrate. HRTF positioning, district ambients, reverb zones, occlusion, audio priority. Spans all milestones (basic HRTF in POC, ambients in Alpha, reverb/occlusion in Beta). Web Audio API work is standard but the full system is substantial.

### INFRA

| Module | Context Budget | Complexity | Connectivity | Type | Est. LOC | Est. Sessions | Milestone Phases |
|--------|---------------|------------|-------------|------|----------|---------------|------------------|
| **infra/server** | L | 4 | 15 (Core) | Core | 3,600 | 11 | POC → Alpha → GA |
| **infra/performance** | M | 4 | 6 (Branch) | Branch | 2,200 | 7 | Alpha → GA |
| **infra/deployment** | L | 3 | 4 (Branch) | Branch | 1,500 | 5 | GA |

**infra/server** is the highest-connectivity module (15). Express server, WebSocket manager, citizen router, state orchestration. Every module connects through the server. Core type: must be built first, interfaces defined early, expect rework as modules integrate.

**infra/performance** is about making everything fast. Frame budget monitoring, adaptive quality, thermal management. Depends on having renderable content first (Alpha).

**infra/deployment** is GA-only. Docker, nginx, TLS, monitoring, alerting. Straightforward DevOps but L context budget due to config complexity.

---

## Summary Table (All 17 Modules)

| # | Module | Budget | Cmplx | Conn | **ROI** | Type | LOC | Sessions | First Milestone |
|---|--------|--------|-------|------|---------|------|-----|----------|-----------------|
| 1 | citizens/mind | L | **5** | **10** | **5** | Hub | 3,600 | 12 | POC |
| 2 | infra/server | L | 4 | **15** | **5** | **Core** | 3,600 | 11 | POC |
| 3 | voice/pipeline | L | 4 | 6 | **5** | Branch | 2,800 | 8 | POC |
| 4 | world/districts | **XL** | **5** | **8** | **5** | Hub | **8,500** | **20** | POC |
| 5 | economy/sync | M | 3 | **12** | **4** | Hub | 1,700 | 6 | POC |
| 6 | narrative/graph | M | 4 | **9** | **4** | Hub | 2,900 | 10 | POC |
| 7 | narrative/physics | M | **5** | 7 | **4** | Branch | 1,900 | 7 | POC |
| 8 | citizens/embodiment | **XL** | **5** | **8** | 3 | Hub | 3,800 | 12 | POC |
| 9 | voice/spatial | M | 3 | 5 | 3 | Branch | 3,200 | 9 | POC |
| 10 | citizens/population | L | 4 | **9** | 3 | Hub | 2,300 | 8 | Alpha |
| 11 | world/navigation | M | 3 | 5 | 3 | Branch | 1,500 | 4 | POC |
| 12 | narrative/events | M | 4 | **8** | 3 | Hub | 2,800 | 9 | Alpha |
| 13 | world/atmosphere | M | 3 | 7 | 2 | Branch | 2,600 | 8 | Alpha |
| 14 | economy/simulation | **XL** | **5** | **8** | 2 | Hub | 3,500 | 10 | Beta |
| 15 | infra/performance | M | 4 | 6 | 2 | Branch | 2,200 | 7 | Alpha |
| 16 | economy/governance | L | 4 | 6 | 2 | Branch | 2,200 | 7 | Beta |
| 17 | infra/deployment | L | 3 | 4 | 2 | Branch | 1,500 | 5 | GA |
| | **TOTAL** | | | | | | **49,100** | **152** | |

**Table is now sorted by ROI (descending), then by connectivity (descending).** This reflects implementation priority better than the previous connectivity-only sort.

---

## Complexity Factor Breakdown

### Technical Complexity Detail (1-5 per factor)

| Module | Novelty | Ext APIs | Real-time | State Mgmt | Error Surface | **Avg** |
|--------|---------|----------|-----------|-----------|---------------|---------|
| world/districts | 4 | 2 | 5 | 5 | 4 | **4 → 5** |
| world/atmosphere | 3 | 2 | 4 | 3 | 2 | **3** |
| world/navigation | 2 | 3 | 4 | 3 | 2 | **3** |
| citizens/embodiment | 5 | 3 | 5 | 5 | 4 | **4 → 5** |
| citizens/mind | 5 | 4 | 3 | 5 | 4 | **4 → 5** |
| citizens/population | 3 | 2 | 4 | 5 | 3 | **3 → 4** |
| narrative/graph | 3 | 3 | 3 | 4 | 3 | **3 → 4** |
| narrative/physics | 5 | 2 | 4 | 5 | 4 | **4 → 5** |
| narrative/events | 3 | 4 | 3 | 4 | 3 | **3 → 4** |
| economy/simulation | 5 | 3 | 2 | 5 | 5 | **4 → 5** |
| economy/sync | 2 | 2 | 3 | 3 | 3 | **3** |
| economy/governance | 3 | 3 | 2 | 4 | 3 | **3 → 4** |
| voice/pipeline | 3 | 5 | 5 | 3 | 3 | **4** |
| voice/spatial | 3 | 2 | 4 | 3 | 2 | **3** |
| infra/server | 2 | 3 | 5 | 5 | 4 | **4** |
| infra/performance | 3 | 2 | 5 | 4 | 3 | **3 → 4** |
| infra/deployment | 2 | 3 | 2 | 2 | 3 | **2 → 3** |

Rounded up when avg ≥ X.4. Modules scoring **5** are flagged for extra review.

---

## Connectivity Detail

| Module | Imports From | Exports To | Shared State | Event Coupling | **Total** | Type |
|--------|-------------|-----------|-------------|----------------|-----------|------|
| infra/server | 3 | 5 | 4 | 3 | **15** | Core |
| economy/sync | 1 | 5 | 4 | 2 | **12** | Hub |
| citizens/mind | 4 | 2 | 2 | 2 | **10** | Hub |
| narrative/graph | 2 | 3 | 2 | 2 | **9** | Hub |
| citizens/population | 3 | 2 | 2 | 2 | **9** | Hub |
| world/districts | 2 | 2 | 2 | 2 | **8** | Hub |
| citizens/embodiment | 3 | 1 | 2 | 2 | **8** | Hub |
| narrative/events | 3 | 2 | 1 | 2 | **8** | Hub |
| economy/simulation | 2 | 3 | 2 | 1 | **8** | Hub |
| narrative/physics | 2 | 2 | 1 | 2 | **7** | Branch |
| world/atmosphere | 3 | 1 | 1 | 2 | **7** | Branch |
| voice/pipeline | 3 | 1 | 1 | 1 | **6** | Branch |
| infra/performance | 2 | 1 | 2 | 1 | **6** | Branch |
| economy/governance | 3 | 1 | 1 | 1 | **6** | Branch |
| voice/spatial | 2 | 1 | 1 | 1 | **5** | Branch |
| world/navigation | 2 | 1 | 1 | 1 | **5** | Branch |
| infra/deployment | 1 | 1 | 1 | 1 | **4** | Branch |

---

## ROI Detail (Bridge Mode)

ROI = Return on Implementation. What value does building this module deliver, and what is lost while it doesn't exist?

**Scoring method:** Weighted average of 5 factors — demonstrability (0.15), differentiation (0.20), unblock_count (0.25), user_impact (0.25), risk_reduction (0.15).

**This is a bridge.** These scores are manual approximations. The target is physicalized ROI where priority emerges from graph energy flow, not human/AI judgment. See "Toward Physicalized ROI" below.

### ROI Factor Breakdown

| Module | Demo | Diff | Unblock | Impact | Risk Red. | **ROI** | Justification |
|--------|------|------|---------|--------|-----------|---------|---------------|
| citizens/mind | 5 | 5 | 4 | 5 | 5 | **5** | THE differentiator. Without this, citizens are NPCs. This is what makes the project exist. |
| infra/server | 2 | 1 | 5 | 3 | 5 | **5** (infrastructure) | Invisible but everything breaks without it. 15 modules depend on it. Highest unblock count. |
| voice/pipeline | 5 | 4 | 3 | 5 | 4 | **5** | The interaction channel. No voice = no way to talk to citizens = no experience. |
| world/districts | 5 | 4 | 4 | 5 | 4 | **5** | The physical space. Without Venice, there is nowhere to be. Core demonstrability. |
| economy/sync | 2 | 2 | 5 | 2 | 4 | **4** | Invisible plumbing but 6 modules read from sync cache. Without real Airtable data, citizens speak fiction. |
| narrative/graph | 3 | 4 | 4 | 3 | 4 | **4** | Beliefs make citizens authentic. Without graph, mind module has no depth — citizens are memoryless responders. |
| narrative/physics | 3 | 5 | 3 | 3 | 4 | **4** | THE novel algorithm. Drama emerges from physics, not scripts. Without it, world is static. High differentiation. |
| citizens/embodiment | 4 | 3 | 3 | 4 | 2 | **3** | Visual presence matters but capsule fallback works for POC. Full tier system is Alpha. |
| voice/spatial | 3 | 3 | 2 | 4 | 2 | **3** | HRTF positioning is core to spatial truth. Basic version needed for POC. Full system is polish. |
| citizens/population | 2 | 3 | 3 | 3 | 2 | **3** | Scale from 3 to 186 citizens. Not needed for POC but essential for "living city" feel at Alpha. |
| world/navigation | 3 | 2 | 2 | 4 | 2 | **3** | Movement through space. WASD for POC is trivial. VR locomotion for Alpha is where value lives. |
| narrative/events | 3 | 4 | 2 | 3 | 2 | **3** | Events make the world dynamic. Without them, narrative physics has no visible output. Alpha priority. |
| world/atmosphere | 3 | 3 | 1 | 3 | 1 | **2** | Beautiful but not core. Fixed lighting works for POC. Day/night and fog are Alpha polish. |
| economy/simulation | 2 | 3 | 2 | 2 | 2 | **2** | Serenissima runs the simulation externally. Venezia only needs sync. Full integration is Beta depth. |
| infra/performance | 1 | 1 | 1 | 3 | 3 | **2** | Optimization matters for Quest 3 but premature before content exists. Alpha/GA concern. |
| economy/governance | 2 | 3 | 1 | 2 | 1 | **2** | Political depth. Rich but deferred. Core experience works without grievances and councils. |
| infra/deployment | 1 | 1 | 1 | 2 | 2 | **2** | Production deployment. Localhost works until GA. No user value until then. |

### Toward Physicalized ROI

The scores above are manual. They represent one human + one AI's best judgment at a point in time. They are necessarily incomplete because:

1. **We can't see second-order effects.** economy/sync scores ROI 4 because 6 modules depend on it. But which of those 6 modules matters most? That depends on which narratives (user stories, project goals) are most active — and that changes daily.

2. **We can't price absence correctly.** We say "voice/pipeline is essential" but we can't quantify the cost of each day it doesn't exist. In a physicalized system, the tension would accumulate measurably — every blocked narrative adds energy to the node, and the priority surfaces naturally.

3. **We can't predict emergence.** Maybe building narrative/physics first (despite lower user_impact) would produce emergent behaviors that redefine what citizens/mind needs to do. The graph physics would detect this because energy would flow unexpectedly from physics to mind, signaling a dependency we didn't predict.

**When the graph is operational for this project:**
- Each module/behavior becomes a cluster of narrative + moment + pattern nodes
- Project intentions ("prove citizens are real", "ship POC by week 4") are active narrative nodes with energy
- The physics tick routes energy through dependencies — high-tension nodes surface as priorities
- The membrane handles routing automatically — no scoring needed
- Implementation order emerges from topology, not from a table

**Until then, this table is the best we have. Use it. But don't trust it completely.**

---

## Flagged Modules

### Complexity ≥ 4 (Extra Review Required)

| Module | Complexity | Risk | Mitigation |
|--------|-----------|------|------------|
| world/districts | 5 | Procedural geometry + LOD at Venice scale is novel. XL context. | Build Rialto as reference, extract patterns, then parallelize other districts. |
| citizens/mind | 5 | Consciousness architecture is research-level. 3 API dependencies. | POC proves the core loop with 3 citizens. Iterate on context assembly. |
| citizens/embodiment | 5 | 186-citizen instanced rendering with 3 LOD tiers. XL context. | Start with capsule fallback, add mesh/animation incrementally. |
| narrative/physics | 5 | Blood Ledger energy model adapted to Venice. Novel algorithm. | Port from existing Blood Ledger code. Calibrate with 20 citizens first. |
| economy/simulation | 5 | Full economic simulation. Deferred to Beta for good reason. | Serenissima already runs the simulation. Venezia integrates, not reimplements. |

### Connectivity ≥ 8 (Hub Fragility)

| Module | Connectivity | Risk | Mitigation |
|--------|-------------|------|------------|
| infra/server | 15 | Interface changes cascade everywhere. | Define WebSocket protocol + REST API contract early. Freeze after Alpha. |
| economy/sync | 12 | Cache schema changes break all consumers. | Define VeniceState type interface in POC. All modules import this type. |
| citizens/mind | 10 | Context assembly format affects voice, events, physics. | Define CitizenContext interface in POC. Freeze after proving 3-citizen conversations. |
| narrative/graph | 9 | Schema changes require re-seeding + query updates. | Use MERGE (idempotent) operations. Schema frozen after POC seeding. |
| citizens/population | 9 | Tier changes affect embodiment, atmosphere, server. | Define CitizenTier enum + TierAssignment interface. Freeze at Alpha. |

### XL Context Budget (Multi-Session Required)

| Module | Budget | Sessions | Strategy |
|--------|--------|----------|----------|
| world/districts | XL | 20 | Split by district. Rialto is reference implementation. Others follow pattern. |
| citizens/embodiment | XL | 12 | Split by tier. FULL first, then ACTIVE instancing, then AMBIENT. |
| economy/simulation | XL | 10 | Split by subsystem. Activity → Production → Trade → Stratagems. |

---

## VALIDATION Cross-Reference

| Module | Invariants | Health Checks | Acceptance Criteria | Total Checks |
|--------|-----------|---------------|-------------------|-------------|
| world/districts | 6 | 7 | 12 | 25 |
| world/atmosphere | 6 | 6 | 15 | 27 |
| world/navigation | 6 | 6 | 22 | 34 |
| citizens/embodiment | 5 | 6 | 5 | 16 |
| citizens/mind | 5 | 6 | 5 | 16 |
| citizens/population | 5 | 6 | 5 | 16 |
| narrative/graph | 7 | 6 | 4 | 17 |
| narrative/physics | 7 | 7 | 5 | 19 |
| narrative/events | 7 | 7 | 5 | 19 |
| economy/simulation | 6 | 6 | 4 | 16 |
| economy/sync | 5 | 6 | 5 | 16 |
| economy/governance | 6 | 5 | 5 | 16 |
| voice/pipeline | 5 | 5 | 4 | 14 |
| voice/spatial | 5 | 5 | 5 | 15 |
| infra/server | 5 | 5 | 5 | 15 |
| infra/performance | 5 | 5 | 5 | 15 |
| infra/deployment | 3 | 5 | 5 | 13 |
| **TOTAL** | **104** | **99** | **122** | **325** |

world/navigation has the highest acceptance criteria count (22) — collision and movement precision require extensive testing. world/atmosphere is second (15) — atmospheric effects are perceptual and need subjective validation.
