# SYNC: narrative/events -- Current State

Last updated: 2026-03-11

---

## Status: NOTHING BUILT

No event system exists. No event classification, no 3D effect mapping, no news propagation, no Forestiere news injection, no event lifecycle management. The Blood Ledger has a Narrator agent concept that generates consequences from moment flips, but there is no Venice event system that translates those consequences into observable world effects.

---

## What Exists Now

### Blood Ledger Moment Flip Handling (conceptual, partial)

The Blood Ledger physics tick detects moment flips and returns them in the `TickResult.completions` list. The tick runner CLI prints them. The Narrator agent can generate consequences. But there is no downstream consumer that turns a flip into a world event.

Specifically, in the Blood Ledger:
- `tick_v1_2.py` detects flips and populates `result.completions`
- `tick_runner.py` prints completions to console
- `agents/narrator/` has prompt infrastructure for interpreting moments
- `agents/world-builder/` can fill sparse graph areas
- `agents/world_runner/` can advance background storylines

None of these agents produce structured event descriptors. They produce narrative text and graph mutations. The translation from "narrative text about what happened" to "structured 3D world instructions" does not exist anywhere.

### Venezia Algorithm Pseudocode (designed, not implemented)

`docs/04_ALGORITHM_Venezia.md` section A5 (World State -> 3D Rendering Bridge) defines the event broadcast format:

```javascript
event = {
  type: M.category,
  location: M.place.position,
  severity: M.salience,
  affected_citizens: [...],
  description: M.description
}
```

And a client-side switch statement for rendering by event type (economic_crisis, political_uprising, personal_tragedy). This is pseudocode only -- no implementation exists.

### Atmosphere System (not built, but planned)

`docs/00_MAP_Venezia.md` lists `world/atmosphere` as a module with responsibility for day/night, weather, fog, and mood-driven ambiance. The events module depends on this for atmospheric effects. Neither exists.

### Existing Audio Infrastructure (partial)

The current Cities of Light codebase has:
- Spatial audio with HRTF panning (working)
- Zone-based ambient audio system (`src/client/zone-ambient.js`)
- Voice pipeline (STT -> LLM -> TTS) (working)
- WebSocket-based audio state sync (working)

The zone ambient system could be extended to consume event audio descriptors, but it currently works on static zone definitions, not dynamic event-driven shifts.

### What Does NOT Exist

- Event classification engine (moment category -> response template)
- Event descriptor format (the JSON structure consuming modules read)
- 3D effect templates per event category
- Event severity computation (salience -> severity scale)
- News propagation system (BELIEVES edge creation over time hops)
- Forestiere news injection (RSS -> Claude -> narrative node)
- Event lifecycle manager (emerging -> active -> settling -> aftermath -> resolved)
- Event priority queue (max 3 concurrent)
- Event-to-atmosphere bridge
- Event-to-citizen-behavior bridge
- Event-to-audio bridge
- `src/server/event-propagation.js`
- `src/server/forestiere-news.js`
- Venice Narrator agent prompts
- Venice World Builder agent prompts
- Venice World Runner agent prompts
- Any event-related tests

---

## Dependencies

### Hard Dependencies (blocks event system)

1. **Physics engine running against Venice graph.** Events are produced by moment flips. No moment flips = no events. Requires: narrative/graph seeded, narrative/physics bridge running. See `SYNC_Graph.md` and `SYNC_Physics.md`.

2. **Physics bridge (`src/server/physics-bridge.js`).** The bridge is where moment flips are detected and forwarded to the events module. Without it, the events module has no input.

3. **WebSocket server.** Event descriptors are broadcast to connected clients via WebSocket. The Express server already has WebSocket support (`src/server/index.js`).

### Soft Dependencies (events work partially without these)

4. **Atmosphere module (`world/atmosphere`).** Without it, atmospheric effects in event descriptors are ignored. Events still affect citizen behavior and audio.

5. **Citizen population manager (`citizens/population`).** Without it, citizen behavior instructions in event descriptors are ignored. Events still affect atmosphere and audio.

6. **Claude API access.** Needed for Narrator agent (consequence generation) and Forestiere news (headline translation). Without it, events can still fire with pre-seeded consequences and no external news.

7. **RSS feed access.** Needed for Forestiere news injection. Without it, the world receives no external news. Events still emerge from internal physics.

---

## Build Order

### Step 1: Event Descriptor Format

Define the canonical JSON schema for event descriptors. This is a design task, not a coding task. The schema in `PATTERNS_Events.md` is a starting point but needs finalization:
- Confirm all fields
- Define TypeScript interface (for client consumption)
- Define Python dataclass (for server-side creation)
- Document which consuming modules read which fields

### Step 2: Event Classification Engine

`src/server/event-classifier.js`:
- Input: moment flip data from physics bridge (moment properties + affected citizens + location)
- Output: event descriptor
- Maps moment `category` to response template
- Computes severity from salience (how far above threshold)
- Computes affected radius from severity
- Identifies affected citizens (within radius + WITNESS edges)
- Populates atmosphere, citizen_behavior, and audio sections from category template

This is the core of the module. Once this works, events can be broadcast even without downstream consumers -- they just log to console until consumers are built.

### Step 3: Event Priority Queue

`src/server/event-manager.js`:
- Maintains list of active events (max 3)
- Tracks event lifecycle phase (emerging -> active -> settling -> aftermath -> resolved)
- Handles preemption (higher severity event replaces lowest active)
- Handles suppression (4th event queued until slot opens)
- Emits lifecycle phase transitions to clients

### Step 4: News Propagation

`src/server/event-propagation.js`:
- When an event fires, create initial BELIEVES edges for WITNESS citizens
- On each subsequent tick, propagate knowledge outward through social graph
- Respect trust scores and distance for propagation gating
- Update citizen confidence values based on hop count

### Step 5: Forestiere News Injection

`src/server/forestiere-news.js`:
- RSS reader (configurable feed URLs)
- Claude API translation (modern headline -> 15th century Venice context)
- Narrative node creation in FalkorDB
- Energy injection for new narrative
- Schedule: once per 24-hour world cycle

### Step 6: Consumer Integration

Wire event descriptors into consuming modules as they become available:
- `world/atmosphere` reads `event.atmosphere` -> adjusts fog, light, particles
- `citizens/population` reads `event.citizen_behavior` -> adjusts movement, posture, gathering
- `voice/spatial` reads `event.audio` -> adds/removes ambient layers and spatial sources

Each consumer integration is independent. They can be built in any order. The events module broadcasts regardless of whether consumers are listening.

### Step 7: Venice Agent Prompts

Write Venice-specific system prompts for:
- **Narrator:** Consequences of events in Venetian context (trade guilds, class dynamics, canal logistics, church influence)
- **World Builder:** Generate new tensions and narratives appropriate to Venice (not generic fantasy)
- **World Runner:** Advance Venetian storylines (Doge politics, guild elections, seasonal trade patterns, religious festivals)

---

## Open Questions

### Q1: Who invokes the Narrator agent?

When a moment flips, the Narrator agent generates consequences. But who calls it?
- **(a)** The physics bridge (Python side) calls the Narrator before returning the tick result. Consequence generation is synchronous with the tick.
- **(b)** The events module (JavaScript side) calls the Narrator asynchronously after receiving the flip. The 3D effects happen immediately, consequences follow.

Recommendation: **(b)**. The physics tick should be fast and deterministic. Narrator calls involve Claude API (slow, non-deterministic). Decouple them.

### Q2: How do event effects compose?

If two events overlap spatially (both affecting Rialto district), their atmosphere deltas should add, not override. But additive composition can produce extreme values (double fog, zero light). Need a clamping strategy:
- Simple: clamp each atmospheric property to its valid range after addition
- Complex: each event gets a proportional share of the atmospheric budget

Recommendation: simple clamping for MVP.

### Q3: What happens to events when no visitor is connected?

The physics engine runs 24/7. Moments flip even when no one is watching. Should events fire into the void?
- Event descriptors: no, do not emit WebSocket events with no listeners
- News propagation: yes, knowledge still spreads through the social graph
- Narrator consequences: yes, the graph still evolves
- Lifecycle: track phases even without a visitor. When a visitor connects, they see the current state (active events in progress, aftermath of recent events)

### Q4: How do we test events without the full 3D pipeline?

A test harness that:
1. Seeds a graph with known tensions
2. Runs physics ticks until a moment flips
3. Passes the flip through the event classifier
4. Validates the output event descriptor against the schema
5. Validates news propagation after N ticks

This can run headless, no Three.js, no browser. Pure server-side logic.

### Q5: RSS feed selection for Forestiere news

Which feeds produce headlines that translate well to 15th century Venice?
- World economic news (trade, sanctions, market crashes) -> trade route disruptions
- Political news (elections, coups, treaties) -> diplomatic dispatches
- Natural disaster news (earthquakes, floods, storms) -> maritime disasters
- Cultural news (art, architecture, festivals) -> cultural events

Avoid: technology news (untranslatable), sports (irrelevant), celebrity gossip (anachronistic). Need to curate 3-5 feeds that reliably produce translatable content.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| No events emerge because graph is too sparse | Critical | This is the graph module's problem, not the events module's. But if it happens, the events module has nothing to do. Validate graph seeding quality first. |
| Narrator agent produces incoherent Venice consequences | High | Test prompts with sample moment flips before wiring live. Iterate on system prompt. Keep consequences conservative (small graph changes, not world-altering rewrites). |
| Event effects look wrong in 3D (fog too thick, audio too loud) | Medium | Parametric tuning. Severity-to-effect curves need visual testing in the actual 3D environment. Cannot be done headless. |
| Forestiere news translation is anachronistic or absurd | Medium | Filter translated news through a validation prompt: "Would a 15th century Venetian understand this? Is it plausible?" Reject if not. |
| News propagation creates too many BELIEVES edges | Medium | Cap propagation at 3 hops. After 3 hops, remaining citizens get universal knowledge at low confidence without individual edges. |
| Event priority queue drops important events | Low | Log all suppressed events. If suppression rate is high, increase max concurrent from 3 to 4. But start at 3. |

---

## Pointers

| What | Where |
|------|-------|
| Event broadcast pseudocode | `docs/04_ALGORITHM_Venezia.md` section A5 |
| Blood Ledger Narrator agent | `/home/mind-protocol/the-blood-ledger/agents/narrator/` |
| Blood Ledger World Builder | `/home/mind-protocol/the-blood-ledger/agents/world-builder/` |
| Blood Ledger World Runner | `/home/mind-protocol/the-blood-ledger/agents/world_runner/` |
| Physics tick result format | `/home/mind-protocol/ngram/engine/physics/tick_runner.py` (TickRunResult) |
| Existing WebSocket server | `src/server/index.js` |
| Existing zone ambient audio | `src/client/zone-ambient.js` |
| Physics patterns | `docs/narrative/physics/PATTERNS_Physics.md` |
| Graph patterns | `docs/narrative/graph/PATTERNS_Graph.md` |
| Venezia design philosophy | `docs/02_PATTERNS_Venezia.md` |
