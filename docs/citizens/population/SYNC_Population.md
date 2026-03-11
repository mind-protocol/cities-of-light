# Citizens/Population -- Sync: Current State

```
LAST_UPDATED: 2026-03-11
UPDATED_BY: Claude Agent
STATUS: DESIGNING
```

---

## MATURITY

**What's canonical (v1):**
- Three-tier system: FULL (< 20m, max 20), ACTIVE (< 80m, max 60), AMBIENT (< 200m, 100+), HIDDEN
- Composite tier scoring: distance (0.6) + relationship (0.25) + activity importance (0.15)
- 5-meter hysteresis bands on tier transitions
- Schedule-driven spatial distribution from Serenissima activity data
- AMBIENT citizens as InstancedMesh (crowd texture, not individuals)
- 72fps on Quest 3, 170K triangle budget for all citizens

**What's still being designed:**
- AMBIENT path routes per district, crossfade implementation, mesh preloading strategy
- Population density targets per district per time of day (needs playtesting)
- Server-side update protocol (delta encoding, frequency per tier)

**What's proposed (v2+):**
- Crowd event clustering, visitor reputation, multi-visitor balancing, adaptive tier caps

---

## CURRENT STATE

The Cities of Light repository has no population management system. What exists is `AICitizenManager` in `src/server/ai-citizens.js` -- a server-side class managing 3 hardcoded citizens.

**What exists in code (`src/server/ai-citizens.js`):**

- 3 citizens defined as constants: VOX (icosahedron), LYRA (octahedron), PITCH (torus knot)
- Each citizen has: home zone, wander radius, move speed, system prompt, 10-message conversation history
- Server-side 5-second behavior tick: pick random wander target within radius, move toward it, broadcast `citizen_moved` via WebSocket
- Proximity-based conversation: finds nearest citizen within 15m of speaker, calls GPT-4o, returns text response
- Global cooldown: 10 seconds between any AI citizen speech
- No tier system. No LOD. No spawn/despawn. No scheduling. No instancing.
- Citizens float at y=1.2 with sinusoidal bob. Acceptable for abstract shapes, wrong for Venice.

**What exists on the client (`src/client/main.js`, `src/client/avatar.js`):**

- `createAICitizenAvatar()` creates geometric shapes with emissive glow and floating name labels
- Position interpolation via `lerp(0.3)` on WebSocket `citizen_moved` messages
- No frustum culling budget, no triangle counting, no distance-based quality. Fails at 186.

**What does NOT exist:**

- Tier assignment, composite scoring, spawn/despawn, crossfade transitions, hysteresis
- Schedule-driven positioning, InstancedMesh crowd, district density management
- Off-screen simulation tracking
- `citizen-manager.js` and `venice-state.js` as specified in the implementation plan

---

## KNOWN ISSUES

### No population scaling path (Critical)
The system was built for 3 citizens. Adding more increases server tick and client render cost linearly with no budget management. No tier concept, no culling, no instancing. `AICitizenManager` is not extensible -- `citizen-manager.js` must be built from scratch.

### Server broadcasts every position every tick (High)
Every 5 seconds, all citizen positions go to all clients. At 186 citizens that is 186 messages per tick. Fix: tier-stratified updates (FULL: per-frame, ACTIVE: 500ms, AMBIENT: 2s, HIDDEN: never). Server must know visitor position to filter.

### No schedule or activity integration (High)
Citizens wander random circles. No connection to Serenissima activity data, no time-of-day awareness. Fix: `venice-state.js` pulls schedules from Airtable sync, citizens move between activity locations.

### No Serenissima identity on client (High)
Citizens are VOX/LYRA/PITCH with hardcoded prompts. The 186 citizens with economic state, class, and memory do not exist. Fix: `economy/sync` fetches from Airtable, `venice-state.js` caches, `citizen-manager.js` scores.

---

## GAP ANALYSIS

Every component is a full rebuild. The current system has: 3 hardcoded citizens, no tiers, no spawn/despawn, no scheduling, broadcast-all networking, render-all client, no density control, no off-screen simulation. Venice requires all of these. There is no incremental path from the current `AICitizenManager` to the target architecture.

---

## HANDOFF: FOR AGENTS

**Your likely VIEW:** VIEW_Implement

**Where I stopped:** Design phase. PATTERNS document defines the architecture. No implementation code exists for the Venice population system.

**What you need to understand:**
The existing `AICitizenManager` in `ai-citizens.js` is NOT the foundation for Venice population. It manages 3 citizens with no tier concept. The Venice system requires two new files: `src/client/citizens/citizen-manager.js` (client-side tier management, spawn/despawn, rendering coordination) and `src/server/venice-state.js` (server-side state for all 186 citizens, schedule tracking, tier-aware network protocol). Both are specified in `docs/06_IMPLEMENTATION_Venezia.md`.

**Watch out for:**
- `ai-citizens.js` is imported in `src/server/index.js`. Replace this import, do not extend it.
- Tier scoring must run < 0.5ms for 186 citizens. Use typed arrays, pre-sort by distance, early-exit past AMBIENT threshold.
- `InstancedMesh` requires `DynamicDrawUsage` on the instance matrix buffer or GPU upload stalls.
- Quest 3 stereo doubles draw calls. The 200 budget means 100 unique objects max. Instancing is not optional.
- Hysteresis must be stateful per citizen -- promote/demote only when hysteresis threshold is crossed.

**Open questions:**
- Tier scoring on client or server? Client has exact position. Server has relationship + activity data. Current design: server sends state, client scores.
- District transitions: hard cut or gradual handoff? Gradual temporarily exceeds FULL budget.
- Session interaction memory: persist across browser sessions or reset each visit?

---

## HANDOFF: FOR HUMAN

**Executive summary:**
Population module design complete. 3-tier system with composite scoring (distance + relationship + activity) manages which of 186 citizens render at what fidelity. Schedule-driven positioning creates natural density patterns. AMBIENT citizens are instanced crowd texture. Total budget: 170K triangles. The 3-citizen prototype must be fully replaced.

**Needs your input:**
1. District density targets -- how crowded should Rialto feel at midday vs. a residential sestiere at night?
2. District transition strategy -- hard cut or gradual handoff when walking between districts?
3. Visitor identity persistence -- remember spoken-to citizens across sessions? Requires account/cookie system.

---

## TODO

### Immediate

- [ ] Implement `venice-state.js`: server-side cache for 186 citizen states from Airtable sync
- [ ] Implement `citizen-manager.js` core: tier scoring algorithm (distance-only first, add composite factors later)
- [ ] Wire visitor position reporting from client to server (extend existing WebSocket protocol)
- [ ] Implement tier-stratified position broadcast (FULL/ACTIVE/AMBIENT frequencies)
- [ ] Test with 186 dummy citizens: verify tier assignment runs under 0.5ms on Quest 3
- [ ] Implement hysteresis state tracking per citizen

### Later

- [ ] Crossfade tier transitions (requires `citizens/embodiment`)
- [ ] AMBIENT InstancedMesh integration (requires `citizens/embodiment`)
- [ ] Schedule-driven positioning (requires `economy/sync`)
- [ ] Per-district density targets and enforcement
- [ ] Mesh preloading, adaptive tier caps, session interaction memory
- IDEA: Crowd attractors -- events pull ambient citizens toward a location
- IDEA: Citizen-to-citizen proximity -- friends walk together, rivals avoid

---

## POINTERS

| What | Where |
|------|-------|
| Current AI citizen logic | `src/server/ai-citizens.js` |
| Current avatar rendering | `src/client/avatar.js`, `src/client/main.js` |
| Venezia architecture | `docs/00_MAP_Venezia.md`, `docs/06_IMPLEMENTATION_Venezia.md` |
| Performance + validation | `docs/05_VALIDATION_Venezia.md` (POC-3) |
| Embodiment module | `docs/citizens/embodiment/PATTERNS_Embodiment.md` |
