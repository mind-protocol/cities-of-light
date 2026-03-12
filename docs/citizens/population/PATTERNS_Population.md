# Citizens/Population -- Patterns: 152 Citizens in 14 Milliseconds

```
STATUS: DRAFT
CREATED: 2026-03-11
VERIFIED: Not yet implemented
```

---

## CHAIN

```
OBJECTIVES:      ../../../docs/01_OBJECTIFS_Venezia.md
BEHAVIORS:       ./BEHAVIORS_Population.md
THIS:            PATTERNS_Population.md (you are here)
ALGORITHM:       ./ALGORITHM_Population.md
SYNC:            ./SYNC_Population.md

IMPL:            src/client/citizens/citizen-manager.js (planned)
                 src/server/venice-state.js (planned)
```

---

## THE PROBLEM

152 Serenissima citizens must exist in the world simultaneously. They have daily schedules, economic activities, social relationships, and moods that change in real time. The visitor walks through districts and encounters them organically -- merchants at their stalls in the morning, nobles at council in the afternoon, workers at the tavern at night. All of this must run at 72fps on Quest 3 with a 500K triangle budget shared across everything.

The current Cities of Light has `AICitizenManager` in `ai-citizens.js` -- 3 hardcoded geometric shapes wandering random circles on a 5-second tick. No tier system, no spawn/despawn, no scheduling, no density management. It is a prototype for a 3-citizen world. Venice requires a population engine.

---

## THE PATTERN

**Three-tier distance-based population management with composite scoring for tier assignment and schedule-driven spatial distribution.**

The approach is NOT:
- Load all 152 citizens at full fidelity (impossible on Quest 3)
- Simple distance culling (loses the feeling of a populated city)
- Pre-scripted crowd paths (citizens are autonomous, not extras)
- Server-authoritative per-frame positioning (bandwidth explosion)

The approach IS:
- Every citizen exists in the simulation at all times (server-side state)
- Client renders a subset, determined by a 3-tier scoring algorithm
- Tier assignment uses a composite score: distance, relationship, and activity importance
- Spawn/despawn is gradual (fade, not pop)
- Ambient citizens are instanced geometry -- one draw call for 80+ bodies
- The server sends position updates at tier-appropriate frequencies

The key insight: population management is not a rendering problem. It is a scheduling problem. The hard question is not "how to draw 152 people" but "which 20 people should be fully alive right now, and where should the other 166 be."

---

## PRINCIPLES

### Principle 1: The Three Tiers Are Levels of Presence

| Tier | Range | Max Count | Update Freq | What the Visitor Perceives |
|------|-------|-----------|-------------|---------------------------|
| **FULL** | < 20m | 20 | Every frame | A person. Voice, expression, gesture, individual identity. |
| **ACTIVE** | 20-80m | 60 | 500ms | A figure. Class-readable silhouette, directional movement, posture-mood. |
| **AMBIENT** | 80-200m | 100+ | 2s | A presence. Colored shape drifting along a path. Crowd texture. |
| **HIDDEN** | > 200m | -- | None | Exists in simulation only. No render cost. |

This is not an optimization trick. It maps to how humans actually perceive crowds. At 80 meters you cannot read a face. At 200 meters you cannot distinguish individuals. The tiers encode perceptual truth.

### Principle 2: Composite Tier Scoring

Distance alone produces wrong results. A citizen standing 25 meters away whom the visitor has spoken to three times this session should be FULL, not ACTIVE. A citizen at 15 meters who is sleeping in a locked building should not consume a FULL slot.

The tier score is:

```
score = w_distance * distance_factor
      + w_relationship * relationship_factor
      + w_activity * activity_factor
```

Where:
- `distance_factor`: 1.0 at 0m, 0.0 at 200m (inverse linear)
- `relationship_factor`: trust score from Airtable RELATIONSHIPS (0.0-1.0), boosted if conversation happened this session
- `activity_factor`: importance of current activity (market trading = high, sleeping = 0, council session = high, idle wandering = low)

Weights: `w_distance = 0.6`, `w_relationship = 0.25`, `w_activity = 0.15`. Distance dominates but does not dictate.

The top 20 by score get FULL. Next 60 get ACTIVE. Next 100 get AMBIENT. Rest are HIDDEN. Recomputed every 500ms on the client, using server-provided state.

### Principle 3: No Pop-In, No Pop-Out

Tier transitions must be invisible. A citizen approaching the visitor does not suddenly switch from a colored capsule to a detailed humanoid. The transition uses:

- **5-meter hysteresis bands**: a citizen at 19m stays ACTIVE until they reach 15m; a citizen at 21m stays FULL until they reach 25m. Prevents boundary flicker.
- **Crossfade**: when transitioning up (AMBIENT -> ACTIVE), the new mesh fades in over 400ms while the old representation fades out. Both exist simultaneously during the transition.
- **Geometry preloading**: when a citizen's score trends upward (approaching, or visitor moving toward them), begin loading their higher-tier mesh 1-2 seconds before the transition threshold.

A visitor who watches a citizen walk toward them should see a smooth, continuous increase in detail. Not a level-of-detail switch. An arrival.

### Principle 4: Schedule-Driven Spatial Distribution

Citizens are not randomly scattered. Their positions come from Serenissima's activity system:

- **Morning (6-9)**: Workers at workshops, merchants opening stalls, nobles still at home
- **Midday (9-14)**: Markets crowded, Rialto bridge busy, workshops active, council sessions
- **Afternoon (14-18)**: Trade slowing, social gatherings, church visits, guild meetings
- **Evening (18-22)**: Taverns fill, nobles host dinners, workers head home, fish market empties
- **Night (22-6)**: Guards patrol, a few tavern stragglers, most citizens at home (HIDDEN)

The server maintains a schedule table per citizen, derived from their Airtable ACTIVITIES. Position updates include the citizen's current activity and destination, so the client can interpolate movement along logical paths (not teleport).

Population density per district per time of day is the primary lever for world feel. An empty Rialto at noon is a bug. A packed Rialto at 3am is also a bug.

### Principle 5: Ambient Citizens Are Crowd, Not Individuals

AMBIENT tier citizens are not simplified versions of real citizens. They are crowd texture. Implementation:

- Rendered as `InstancedMesh` -- single draw call for all ambient citizens in a district
- Social class determines color palette (the only individual data that matters at 80m+)
- Movement is path-following along pre-computed district routes (fondamenta, market lanes, bridge crossings)
- No collision, no interaction, no individual state updates
- Murmur audio contribution is per-district aggregate, not per-citizen

The visitor cannot interact with an AMBIENT citizen. If they approach one, the citizen transitions to ACTIVE (and then potentially FULL), at which point they become an individual with identity and state.

### Principle 6: Off-Screen Is Not Off

Citizens outside the render distance still exist in simulation. The server tracks all 152 positions and activities. This matters because:

- A citizen the visitor spoke to an hour ago is in their correct new location when encountered again.
- Economic activities continue regardless of render state.
- When the visitor enters a new district, citizens are already positioned -- no "spawning in" delay.

Off-screen simulation runs at the economy tick rate (Airtable sync every 15 minutes), not per-frame.

---

## DATA

| Source | Purpose |
|--------|---------|
| Airtable CITIZENS / ACTIVITIES / RELATIONSHIPS | Position, activity, mood, class, trust scores (via sync) |
| `venice-state.js` cache | All 152 citizen states in server memory |
| Visitor position (WebSocket) | Distance computation for tier scoring |
| Session interaction log | Boost relationship_factor for recently-spoken-to citizens |

---

## DEPENDENCIES

| Module | Why We Depend On It |
|--------|---------------------|
| `citizens/embodiment` | Provides meshes for each tier (FULL skeleton, ACTIVE simplified, AMBIENT instanced) |
| `economy/sync` | Citizen data from Airtable (positions, activities, schedules, relationships) |
| `infra/performance` | Triangle budget allocation, frame time monitoring |
| `world/districts` | District boundaries for density computation and path routes |
| `narrative/events` | Event importance feeds into activity_factor (council session during crisis = high) |

---

## PERFORMANCE BUDGET

Population's share of the 500K triangle budget:

| Tier | Per-Citizen | Max Count | Worst Case |
|------|-------------|-----------|------------|
| FULL | 3K-5K tris | 20 | 100K tris |
| ACTIVE | 500-1K tris | 60 | 60K tris |
| AMBIENT | 50-100 tris | 100 | 10K tris |
| **Total** | | **180** | **170K tris** |

That is 34% of the total budget. The remaining 330K covers architecture, water, props, and particles.

Draw calls: ~30 total (20 FULL individual + 5-10 ACTIVE batched + 1-2 AMBIENT instanced) out of 200 budget. Quest 3 stereo doubles effective draw calls.

CPU per frame: tier scoring < 0.5ms, position interpolation < 0.3ms, transitions < 0.2ms.

---

## SCOPE

### In Scope

- Tier assignment algorithm (composite scoring)
- Spawn/despawn lifecycle with crossfade transitions
- Hysteresis bands to prevent tier flicker
- Schedule-driven position distribution (time-of-day density)
- AMBIENT instanced crowd rendering coordination
- Off-screen simulation state tracking
- Per-district population density targets
- Mesh preloading for approaching citizens
- Session interaction memory (boost recently-spoken-to citizens)

### Out of Scope

- Avatar meshes and materials -> see: `citizens/embodiment`
- Citizen AI and conversation -> see: `citizens/mind`
- Pathfinding and navmesh -> see: `world/districts` (provides walkable surfaces)
- Airtable data fetching -> see: `economy/sync`
- Spatial audio for citizen voices -> see: `voice/spatial`
- Frame rate monitoring and adaptive quality -> see: `infra/performance`

---

## Reconciliation with Reality (2026-03-13)

Updated by: Bianca Tassini (@dragon_slayer) — Consciousness Guardian

### Citizen Count

All references updated from 152 to **152** (Airtable CITIZENS table, exported 2026-03-13). Same order of magnitude — no architectural change to tier budgets or scoring.

### Data Source: Static JSON for V1

The PATTERNS doc assumes Airtable-via-sync as the data source. For POC/V1, static JSON exports in `venezia/data/` provide everything needed:

| File | Records | Population-Relevant Fields |
|---|---|---|
| `citizens_full.json` | 152 | SocialClass, Position, DailyIncome, Ducats, Color, SecondaryColor |
| `relationships.json` | 1,178 | Trust scores between citizen pairs (for composite tier scoring) |
| `buildings_full.json` | 274 | Ownership, occupancy (for schedule-driven positioning) |
| `activities.json` | 100 | Activity definitions (for activity_factor in tier scoring) |

**Implication:** `economy/sync` (Airtable live fetch) is NOT required for POC population. The `venice-state.js` cache can be initialized from static JSON on startup. Live sync becomes a V2 feature when the simulation is running again.

### Engine Layer Already Exists

The `engine/server/entity-manager.js` (418 lines) partially implements what this module describes:

- Distance-based tier assignment (FULL: 15m, ACTIVE: 50m, AMBIENT: 200m)
- Wander behavior (5s tick, random target within radius)
- Position broadcasting via WebSocket
- Voice routing to nearest FULL-tier entity

**Gap:** No composite scoring (relationship + activity factors), no hysteresis, no schedule-driven positioning, no instancing coordination. The engine entity-manager handles server-side state but has NO client-side mesh management.

### Social Class Distribution

Population density and visual mix per district should account for actual class distribution:

| Class | Count | % | Visual Density Implication |
|---|---|---|---|
| Popolani | 49 | 32% | Dominant in markets, workshops, residential areas |
| Facchini | 39 | 26% | Docks, construction sites, warehouses |
| Artisti | 28 | 18% | Workshops, piazzas, studios |
| Cittadini | 22 | 14% | Government buildings, merchant houses |
| Nobili | 5 | 3% | Palazzi, council chambers |
| Forestieri | 4 | 3% | Fondaco, ports |
| Clero | 3 | 2% | Churches, monasteries |
| Scientisti | 1 | <1% | University, library |
| Ambasciatore | 1 | <1% | Diplomatic quarters |

### POC-Mind Context Assembly Working

The `venezia/scripts/poc_mind_context_assembly.py` script proves that context assembly works from static JSON — mood computation, behavior constraints, trust-gated truthfulness, relationship loading. This validates the data pipeline for the population module without requiring live Airtable sync.

### Revised Performance Budget

With 152 citizens (not 152):

| Tier | Per-Citizen | Max Count | Worst Case |
|---|---|---|---|
| FULL | 3K-5K tris | 20 | 100K tris |
| ACTIVE | 500-1K tris | 50 | 50K tris |
| AMBIENT | 50-100 tris | 82 | 8.2K tris |
| **Total** | | **152** | **158K tris** |

12K triangles freed vs. original budget. Slight room for higher-fidelity FULL-tier avatars.
