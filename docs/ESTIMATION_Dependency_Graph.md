# ESTIMATION: Dependency Graph -- Venezia

Module dependency DAG with critical path analysis, parallel clusters, and build order recommendation.

---

## Dependency DAG

```
                         ┌─────────────────────────────────┐
                         │         infra/server             │
                         │  Conn: 15 (Core) │ Cmplx: 4     │
                         │  LOC: 3600 │ Sessions: 11       │
                         │  POC → Alpha → GA               │
                         └──────────┬──────────────────────┘
                                    │
              ┌─────────────────────┼──────────────────────────┐
              │                     │                          │
              ▼                     ▼                          ▼
   ┌──────────────────┐  ┌──────────────────┐     ┌──────────────────┐
   │  economy/sync    │  │  world/districts  │     │  voice/pipeline  │
   │  Conn: 12 (Hub)  │  │  Conn: 8 (Hub)   │     │  Conn: 6 (Br.)  │
   │  POC → Beta      │  │  POC → Beta      │     │  POC → GA        │
   └────────┬─────────┘  └────────┬─────────┘     └────────┬─────────┘
            │                     │                         │
     ┌──────┼───────┐      ┌─────┼──────┐           ┌──────┤
     │      │       │      │     │      │           │      │
     ▼      ▼       ▼      ▼     ▼      ▼           ▼      ▼
  ┌──────┐┌──────┐┌────┐┌─────┐┌────┐┌──────┐  ┌──────┐┌──────────┐
  │mind  ││pop.  ││sim.││atmo.││nav.││embod.│  │spat. ││citizens/ │
  │Cn:10 ││Cn:9  ││Cn:8││Cn:7 ││Cn:5││Cn:8  │  │Cn:5  ││mind      │
  │Hub   ││Hub   ││Hub ││Br.  ││Br. ││Hub   │  │Br.   ││(via pipe)│
  └──┬───┘└──┬───┘└─┬──┘└─────┘└────┘└──────┘  └──────┘└──────────┘
     │       │      │
     ▼       ▼      ▼
  ┌──────────────────────┐
  │   narrative/graph    │
  │   Conn: 9 (Hub)      │
  │   POC → Beta         │
  └──────────┬───────────┘
             │
      ┌──────┼──────┐
      │      │      │
      ▼      ▼      ▼
  ┌──────┐┌──────┐┌──────────┐
  │phys. ││evnts.││governance│
  │Cn:7  ││Cn:8  ││Cn:6      │
  │Br.   ││Hub   ││Br.       │
  └──────┘└──────┘└──────────┘

  ┌──────────────────┐  ┌──────────────────┐
  │ infra/performance│  │ infra/deployment  │
  │ Conn: 6 (Br.)   │  │ Conn: 4 (Br.)    │
  │ Alpha → GA       │  │ GA               │
  └──────────────────┘  └──────────────────┘
  (depends on renderable content)  (depends on everything)
```

---

## Detailed Dependency Edges

### Direct Dependencies (imports_from)

| Module | Depends On | Relationship |
|--------|-----------|-------------|
| economy/sync | (none) | Root node. Fetches from Airtable directly. |
| infra/server | (none) | Root node. Express + WebSocket infrastructure. |
| world/districts | (none) | Root node. Generates geometry from config + Airtable data. |
| voice/pipeline | infra/server | WebSocket for message routing. |
| voice/spatial | voice/pipeline | Audio output from TTS feeds into spatial positioning. |
| citizens/mind | economy/sync, narrative/graph | Citizen state from sync, beliefs from graph. |
| citizens/embodiment | economy/sync, world/districts | Citizen visual state from sync, placed in district geometry. |
| citizens/population | economy/sync, citizens/embodiment | Tier management over embodied citizens with sync data. |
| narrative/graph | economy/sync | Seeds character nodes from Airtable citizen data. |
| narrative/physics | narrative/graph | Reads/writes energy on graph edges. |
| narrative/events | narrative/physics, narrative/graph | Physics tick triggers events; graph provides context. |
| world/atmosphere | economy/sync, citizens/population, world/districts | Mood aggregates from population, district geometry for fog. |
| world/navigation | world/districts, infra/server | Collision mesh from districts, position sync through server. |
| economy/simulation | economy/sync, citizens/population | Extends sync with server-side simulation. |
| economy/governance | economy/simulation, narrative/graph, citizens/population | Political layer over economic simulation. |
| infra/performance | world/districts, citizens/embodiment | Optimizes rendering of districts + citizens. |
| infra/deployment | infra/server, infra/performance | Deploys the complete stack. |

### Reverse Dependencies (exports_to / consumed by)

| Module | Consumed By | Impact of Change |
|--------|-----------|-----------------|
| infra/server | ALL modules (WebSocket protocol) | **Critical.** Protocol changes break everything. |
| economy/sync | mind, embodiment, population, atmosphere, graph, simulation | **Critical.** Cache schema changes break 6 modules. |
| narrative/graph | mind, physics, events, governance | **High.** Schema changes require re-seeding + query updates. |
| citizens/population | atmosphere, events, performance | **Medium.** Tier interface changes affect 3 modules. |
| world/districts | navigation, atmosphere, embodiment, performance | **Medium.** Geometry/collision changes affect 4 modules. |
| narrative/physics | events | **Low.** Only events reads physics output directly. |
| voice/pipeline | spatial | **Low.** Audio stream format is stable. |

---

## Critical Path Analysis

The critical path is the longest chain of dependent modules that must be built sequentially.

### Critical Path (30 sessions)

```
economy/sync (4) → narrative/graph (5) → narrative/physics (5) → narrative/events (5)
                                                                         │
economy/sync (4) → citizens/mind (7) ─────────────────────────────────── ↓
                                                                    [Alpha integration]
infra/server (6) ──────────────────────────────────────────────────── ↓
                                                                    [POC validation]
world/districts (10) ──────────────────────────────────────────────── ↓
                                                                    [POC validation]
```

**Longest sequential chain:** economy/sync → narrative/graph → narrative/physics → narrative/events → economy/simulation → economy/governance
- **Total sessions on chain:** 4 + 5 + 5 + 5 + 10 + 7 = **36 sessions**
- **Calendar time at 2 sessions/day:** ~18 working days = **~4 weeks**

**POC critical path:** economy/sync (4) + narrative/graph (5) + narrative/physics (5) = **14 sessions**
- Plus parallel: infra/server (6), world/districts (10), citizens/mind (7), voice/pipeline (5)
- POC elapsed = max(14, 10, 7+5, 6+5) = **14 sessions** (graph→physics chain dominates)
- At 2 sessions/day: **~7 working days** for POC foundation

---

## Parallel Clusters

Modules that can be built simultaneously because they have no mutual dependencies.

### POC Parallel Tracks (3 independent tracks)

```
TRACK A (World):        world/districts ──────────────────────── 10 sessions
                                    └─→ world/navigation (partial) ─ 1 session

TRACK B (Data+Mind):    economy/sync ─→ narrative/graph ─→ narrative/physics
                              │              │
                              └──→ citizens/mind (uses sync + graph)
                                                          Total: 4+5+5+7 = 21 sessions
                                                          (but 7 of mind parallel with physics)
                                                          Effective: 14 sessions

TRACK C (Infra+Voice):  infra/server ─→ voice/pipeline ─→ voice/spatial
                                                          Total: 6+5+2 = 13 sessions
```

**POC wall-clock with 3 parallel tracks:** max(11, 14, 13) = **14 sessions ≈ 7 days**

### Alpha Parallel Tracks (4 independent tracks)

```
TRACK A (World):        world/districts(exp.) ─→ world/atmosphere ─→ world/navigation
                        7 + 5 + 4 = 16 sessions

TRACK B (Citizens):     citizens/embodiment ─→ citizens/population ─→ citizens/mind(exp.)
                        9 + 6 + 3 = 18 sessions

TRACK C (Narrative):    narrative/events ─→ narrative/graph(exp.) ─→ narrative/physics(exp.)
                        5 + 3 + 2 = 10 sessions

TRACK D (Infra+Voice):  infra/performance ─→ infra/server(exp.) ─→ voice/spatial(exp.)
                        4 + 3 + 3 = 10 sessions

Plus standalone:        voice/pipeline(exp.) ─ 4 sessions
                        economy/sync(exp.) ─ 2 sessions
                        citizens/mind(exp.) ─ 3 sessions
```

**Alpha wall-clock with 4 parallel tracks:** max(16, 18, 10, 10) = **18 sessions ≈ 9 days**

### Beta Parallel Tracks (3 independent tracks)

```
TRACK A (Economy):      economy/simulation ─→ economy/governance
                        10 + 7 = 17 sessions

TRACK B (Narrative):    narrative/events(exp.) ─→ world/districts(depth) ─→ citizens/mind(full)
                        4 + 3 + 2 = 9 sessions

TRACK C (Audio+Visual): world/atmosphere(exp.) || voice/spatial(full) || citizens/embodiment(full)
                        3 + 4 + 3 = 10 sessions (parallel within track)
                        Effective: 4 sessions

Plus standalone:        economy/sync(full) ─ 2 sessions
                        narrative/graph(full) ─ 2 sessions
                        citizens/population(full) ─ 2 sessions
```

**Beta wall-clock with 3 parallel tracks:** max(17, 9, 4) = **17 sessions ≈ 9 days**

### GA Parallel Tracks (2 independent tracks)

```
TRACK A (Deploy):       infra/deployment ─ 5 sessions
TRACK B (Polish):       infra/performance(full) || infra/server(full) || voice/pipeline(full)
                        3 + 2 + 3 = 8 sessions (parallel)
                        Effective: 3 sessions
```

**GA wall-clock:** max(5, 3) = **5 sessions ≈ 3 days**

---

## Hub Module Risk Matrix

Hub modules (connectivity ≥ 8) require special care. Interface changes cascade.

| Module | Conn | Consumers | Interface Freeze Point | Risk Level |
|--------|------|-----------|----------------------|------------|
| infra/server | 15 | All 16 modules | End of POC: WebSocket message schema locked | **Critical** |
| economy/sync | 12 | 6 modules | End of POC: VeniceState type interface locked | **Critical** |
| citizens/mind | 10 | 3 modules | End of POC: CitizenContext interface locked | **High** |
| narrative/graph | 9 | 4 modules | End of POC: FalkorDB schema locked | **High** |
| citizens/population | 9 | 3 modules | End of Alpha: CitizenTier enum locked | **High** |
| world/districts | 8 | 4 modules | End of POC: Collision mesh API locked | **Medium** |
| citizens/embodiment | 8 | 3 modules | End of Alpha: Avatar mesh interface locked | **Medium** |
| narrative/events | 8 | 3 modules | End of Alpha: WorldEvent type locked | **Medium** |
| economy/simulation | 8 | 2 modules | End of Beta: SimulationState locked | **Medium** |

**Key insight:** The 4 Core/Hub modules with the highest connectivity (server, sync, mind, graph) must all have their **interfaces defined and frozen by the end of POC**. Their implementations will evolve, but their contracts with other modules must stabilize early.

---

## Build Order Recommendation

Based on DAG constraints, connectivity risk, and milestone targets:

### Phase 1: POC Foundation (Weeks 1-2) -- 3 parallel tracks

| Order | Module | Sessions | Track | Why First |
|-------|--------|----------|-------|-----------|
| 1 | economy/sync | 4 | B | Data foundation. Everything reads from sync cache. |
| 2 | infra/server | 6 | C | WebSocket infra. Everything connects through server. |
| 3 | world/districts (Rialto) | 10 | A | Visual foundation. The space citizens inhabit. |

### Phase 2: POC Core (Weeks 2-3) -- depends on Phase 1

| Order | Module | Sessions | Track | Dependency |
|-------|--------|----------|-------|------------|
| 4 | narrative/graph | 5 | B | Seeds from sync data. |
| 5 | voice/pipeline | 5 | C | Routes through server. |
| 6 | citizens/mind | 7 | B | Reads sync + graph. Core value proposition. |

### Phase 3: POC Completion (Weeks 3-4) -- depends on Phase 2

| Order | Module | Sessions | Track | Dependency |
|-------|--------|----------|-------|------------|
| 7 | narrative/physics | 5 | B | Operates on graph. |
| 8 | voice/spatial (basic) | 2 | C | Positions pipeline audio. |
| 9 | world/navigation (WASD) | 1 | A | Collision mesh from districts. |

### Phase 4: Alpha Build (Weeks 5-8) -- 4 parallel tracks

| Order | Module | Sessions | Track | Dependency |
|-------|--------|----------|-------|------------|
| 10 | citizens/embodiment | 9 | B | Full 3-tier system. |
| 11 | world/districts (6 more) | 7 | A | Extends Rialto patterns. |
| 12 | narrative/events | 5 | C | Triggered by physics. |
| 13 | citizens/population | 6 | B | Manages embodied citizens. |
| 14 | world/atmosphere | 5 | A | Day/night + fog + mood. |
| 15 | world/navigation (VR) | 4 | A | VR locomotion + gondola. |
| 16-22 | Expansions (7 modules) | 21 | All | Alpha polish + depth. |

### Phase 5: Beta Build (Weeks 9-14) -- 3 parallel tracks

| Order | Module | Sessions | Track | Dependency |
|-------|--------|----------|-------|------------|
| 23 | economy/simulation | 10 | A | Full economic engine. |
| 24 | economy/governance | 7 | A | Political layer. |
| 25-31 | Expansions + Full (7 modules) | 18 | All | Beta depth. |

### Phase 6: GA (Weeks 15-18) -- 2 parallel tracks

| Order | Module | Sessions | Track | Dependency |
|-------|--------|----------|-------|------------|
| 32 | infra/deployment | 5 | A | Docker + nginx + TLS. |
| 33-35 | Finals (3 modules) | 8 | All | Production polish. |

---

## Cycle Analysis

**No dependency cycles detected.** The graph is a clean DAG.

Potential quasi-cycles (bidirectional data flow, but not circular dependencies):
- `economy/sync ↔ economy/simulation`: Sync reads Airtable; simulation writes Airtable. But Venezia only reads (Serenissima writes). No cycle in Venezia's codebase.
- `citizens/mind ↔ narrative/graph`: Mind reads beliefs; conversations could update beliefs. Write direction is async (post-conversation memory update). Not a build-time cycle.
- `infra/server ↔ voice/pipeline`: Server routes messages; pipeline sends responses. Standard request/response pattern, not a cycle.

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total modules | 17 |
| Total build steps (with expansions) | 37 |
| Total estimated LOC | 49,100 |
| Total estimated sessions | 152 |
| Critical path sessions | 36 |
| Max parallel tracks | 4 (Alpha phase) |
| Wall-clock estimate (2 sessions/day) | ~28 working days with full parallelization |
| Wall-clock estimate (sequential) | ~76 working days |
| Core modules (conn ≥ 13) | 1 (infra/server) |
| Hub modules (conn 8-12) | 8 |
| Branch modules (conn 4-7) | 8 |
| Leaf modules (conn 0-3) | 0 |
| Modules with complexity ≥ 5 | 5 (districts, mind, embodiment, physics, simulation) |
| XL context budget modules | 3 (districts, embodiment, simulation) |
