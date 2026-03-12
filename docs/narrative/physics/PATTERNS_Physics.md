# PATTERNS: narrative/physics -- Design Philosophy

The physics engine is the heartbeat of the world. It does not simulate physics in the Newtonian sense. It simulates the physics of narrative -- how beliefs accumulate energy, how contradictions generate tension, how tension crosses thresholds and becomes event. There is no scheduler. There is no event queue. There is no cron job that says "generate a crisis at 3pm." The physics IS the scheduling. Events emerge when the math says they must.

This is the single most important architectural decision in the entire system. If you replace the physics with scripted events, the world becomes a theme park. If you keep the physics but tune it wrong, the world becomes chaos or stasis. The job of this module is to keep the world in the narrow band between boring and broken.

---

## Pattern 1: Physics IS the Scheduling

There is no event scheduler in Venezia. No cron job fires "political_uprising" at a random interval. No random number generator decides "today something interesting happens." Instead:

1. Citizens pump energy into what they believe (every tick)
2. Energy routes through narrative connections (SUPPORTS, TENSION)
3. Decay slowly bleeds energy from all nodes (0.02 per tick)
4. Moments absorb energy from their connected narratives
5. When a Moment's salience (energy x weight) exceeds its threshold, it flips

A political uprising happens when enough citizens believe contradicting things about governance, those beliefs accumulate enough tension, and that tension feeds into a "Council Revolt" Moment until it crosses its threshold. It might take 50 ticks. It might take 500. It depends on how many citizens care, how strongly they believe, and whether other events drain the energy first.

This is not random. It is deterministic given the same initial state and inputs. But it is emergent -- no one authored the uprising. The uprising authored itself from the ground truth of citizen beliefs.

**Consequence for development:** Never add a "trigger event" function. Never add a timer that fires events. If events are not emerging, the problem is in the graph structure (not enough narratives, not enough tension) or in the constants (too much decay, thresholds too high). Fix the substrate, not the symptoms.

---

## Pattern 2: The Tick Is Sacred

The physics tick runs every 5 minutes. This is not arbitrary. It is calibrated for a 152-citizen Venice population.

**Why 5 minutes:**

- Too fast (30 seconds): Energy accumulates too quickly. Moments flip every few minutes. The world is a seizure of constant crises. Citizens cannot have a conversation without the ground shifting under them.
- Too slow (30 minutes): Energy decays before it can accumulate meaningfully. Moments never flip. The world is a pond. Nothing happens. The visitor leaves.
- 5 minutes: A visitor who spends 1 hour in the world experiences ~12 ticks. That is enough for tension to build perceptibly, for one or two moments to approach their threshold, for maybe one event to actually happen during a session. The world feels alive without feeling manic.

**Tick phases (in order):**

```
1. GENERATE   -- Characters pump energy into believed narratives
2. DRAW       -- Moments draw energy from connected narratives
3. FLOW       -- Energy flows through SUPPORTS edges
4. BACKFLOW   -- Excess energy returns from narratives to characters
5. COOL       -- Link energy drains/converts to weight (v1.2 model)
6. CHECK      -- Evaluate Moment salience vs. threshold, flip if exceeded
```

Each phase is independent and stateless within the tick. The tick reads graph state, computes deltas, writes new state. No intermediate state persists between phases. This makes the tick idempotent in structure (though not in effect -- state changes between ticks).

---

## Pattern 3: Decay Is Memory Fade, Not Garbage Collection

Every node loses energy each tick: `node.energy *= (1 - DECAY_RATE)` where `DECAY_RATE = 0.02`. This means a narrative that receives no new energy loses half its energy in ~35 ticks (~3 hours). After 12 hours with no reinforcement, it is at ~5% of its peak.

This is not cleanup. This is the narrative equivalent of forgetting. A belief that no one reinforces fades. A tension that no one feeds dissipates. A rumor that no one repeats dies. This is how real narrative works -- stories that are not retold stop mattering.

**Core types decay slower.** Blood Ledger defines `CORE_TYPES = ['oath', 'blood', 'debt']` with `CORE_DECAY_MULTIPLIER = 0.25`. For Venice, the core types are extended: `['debt', 'grudge', 'oath', 'alliance']`. These decay at 0.005 per tick instead of 0.02. Debts are not forgotten. Grudges linger. Oaths bind. Alliances persist.

**What this means for tuning:** If the world feels too static, decrease `DECAY_RATE`. If the world feels too chaotic, increase it. The sweet spot for 152 citizens is probably in the 0.015-0.025 range. Blood Ledger uses 0.02 for a ~15-character world -- Venice may need slightly lower (0.015) because energy is distributed across more nodes and takes longer to concentrate.

---

## Pattern 4: Tension Is the Only Source of Drama

Two narratives under TENSION are the engine of all interesting events. Without tension, energy just flows, decays, and nothing happens. With tension, energy accumulates at the contradiction point and feeds Moments.

Tension arises when:
- Two citizens in the same district believe contradicting things ("The Doge is just" vs. "The Doge is corrupt")
- A narrative SUPPORTS one side while another SUPPORTS the opposing side
- Economic pressure creates competing interests (a merchant guild vs. a workers' coalition)

Tension strength increases when both narratives have high energy:
```
tension_delta = (narrative_a.energy + narrative_b.energy) * TENSION_FACTOR
```

Tension does not decay on its own. It only decreases when one of its connected narratives loses energy (through decay or moment absorption). This is critical: tension is sticky. Once two groups start disagreeing, the disagreement persists until one side's belief fades or an event resolves it.

**Design consequence:** The seeding pipeline must include initial tensions. A graph with 152 characters and zero tensions is dead on arrival. The seeding script must analyze Serenissima grievances and create TENSION edges between contradicting ones. Even synthetic tensions (generated from class conflicts: Nobili vs. Popolani economic beliefs) are better than none.

---

## Pattern 5: Moment Flips Are Irreversible Phase Transitions

A Moment is a potential event waiting to happen. It has a threshold. When its salience (`energy * weight`) exceeds the threshold, it flips. Flipping is irreversible -- `flipped = true`, and the Moment stops participating in physics.

```
IF moment.energy * moment.weight > moment.threshold:
  flip_moment(moment)
  # Moment is now an event. It cannot un-happen.
```

After flipping, the consequences are applied:
1. The Narrator agent interprets the moment in context and generates consequences
2. New Narrative nodes are created (the aftermath, the reaction, the new status quo)
3. New TENSION edges may form (the event created new disagreements)
4. New Moments are seeded (the aftermath has its own potential events)
5. The 3D world is notified via WebSocket event

This is a phase transition. The system state before the flip and after the flip are qualitatively different. New narratives exist. Old tensions may resolve. New tensions may form. The energy landscape reshapes around the event.

**Threshold calibration for Venice:** Blood Ledger moments have thresholds in the 0.5-1.5 range. With 152 citizens generating energy, Venice moments need higher thresholds -- probably 2.0-5.0 range. Otherwise, moments flip too quickly and the world is a sequence of crises. A political uprising should take days of building tension, not hours.

---

## Pattern 6: Anti-Runaway Homeostasis

The greatest risk in narrative physics is runaway cascades. A moment flips, creates new tensions, those tensions feed new moments, those moments flip immediately, creating more tensions -- a chain reaction that consumes all energy and produces a dozen events in a single tick.

**Homeostasis mechanisms:**

1. **Energy conservation:** Moment flips consume the energy they absorbed. After a flip, the energy is gone, not redistributed. This drains energy from the system.

2. **Threshold escalation:** New Moments seeded after a flip have higher thresholds than the average. The aftermath is harder to trigger than the inciting event.

3. **Cooldown period:** After a moment flips, no other moment in the same district can flip for 3 ticks (15 minutes). This prevents cascading crises in a single location.

4. **Criticality targeting:** The engine monitors average pressure across the system. If pressure is above `CRITICALITY_TARGET_MAX` (0.6), decay rate temporarily increases. If below `CRITICALITY_TARGET_MIN` (0.4), decay rate decreases. This creates a negative feedback loop that keeps the system in the interesting zone.

5. **Maximum concurrent moments:** No more than 3 active (unflipped, above 50% threshold) moments simultaneously. If a 4th would become active, it is held at 50% until one of the others resolves. This prevents cognitive overload for both the citizens and the visitor.

**What to watch for:** If the system stabilizes at zero activity (all energy decayed, no tensions, no moments near threshold), the homeostasis has over-damped the system. Inject energy by running the economy energy pump or using the World Builder agent to seed new narratives and tensions.

---

## Pattern 7: Energy Injection From the Real Economy

The physics engine does not run in isolation. It receives energy from the Serenissima economic simulation every 15 minutes (economy tick). This is the bridge between deterministic economic computation and emergent narrative:

```
EVERY 15 MINUTES:
  For each citizen:
    economic_delta = current_ducats - previous_ducats
    IF abs(economic_delta) > ECONOMIC_THRESHOLD:
      citizen.energy += abs(economic_delta) * ECONOMIC_ENERGY_FACTOR
      # Losing money and gaining money both generate narrative energy
      # A citizen who just gained 100 Ducats has stories to tell
      # A citizen who just lost 100 Ducats has grievances to voice
```

The energy factor must be calibrated so that normal economic fluctuations produce gentle narrative pressure, while crises (a citizen losing half their wealth) produce sharp energy spikes that can push moments toward their threshold.

Additional injection points:
- **Visitor conversations:** When a visitor talks to a citizen about a belief, that belief gets a small energy boost. The visitor's attention feeds the narrative.
- **Forestiere news:** External RSS feeds (real-world events translated to 15th century context) inject new Narrative nodes with starting energy. This prevents the system from becoming solipsistic.
- **Time of day:** Night reduces generation rate (citizens sleep). Morning increases it (citizens wake and start talking). This creates a natural daily rhythm in narrative pressure.

---

## Pattern 8: The Physics Bridge Is a Thin Translation Layer

The physics engine is Python. The 3D world is JavaScript. The physics bridge translates between them without adding logic:

```
Physics tick (Python) -> tick result JSON -> physics-bridge.js -> WebSocket events
```

The bridge does NOT:
- Interpret moment flips (that is the events module's job)
- Modify energy values (that is the physics engine's job)
- Query the graph for rendering (that is the conversation context's job)
- Store state (all state is in FalkorDB)

The bridge DOES:
- Invoke the physics tick on schedule (5-minute interval)
- Parse the tick result (energy stats, completions, active moments)
- Forward moment flip events to the events module
- Log tick stats for monitoring
- Implement the economy energy injection (reads Airtable deltas, writes energy to graph)

This thinness is intentional. The physics engine is the most tested and validated code in the stack (Blood Ledger has hundreds of tests). The bridge should not add untested complexity on top.

---

## Design Anti-Patterns

1. **The event scheduler.** Never schedule events by time. Events emerge from physics or they do not happen. If you need an event for narrative purposes, increase energy injection or lower thresholds -- do not bypass the physics.

2. **The difficulty slider.** Do not expose tick interval or decay rate to end users. These are engineering constants, not gameplay settings. Mis-tuning them breaks the entire narrative layer.

3. **The god mode.** No admin panel to "force flip" a moment. If testing requires a flip, inject energy into the relevant narratives until the physics produces it. The moment you bypass physics, you lose the ability to reason about system behavior.

4. **The parallel universe.** Do not run multiple physics simulations for "what if" scenarios. One graph, one reality, one timeline. Branching breaks the authenticity that the system depends on.

5. **The real-time display.** Do not render energy values or tension numbers in the 3D world. The physics is invisible. Its effects are visible (citizen behavior, atmosphere, events). The numbers are for developers only.

---

## Key Constants (Venice-Calibrated Estimates)

| Constant | Blood Ledger Value | Venice Estimate | Rationale |
|----------|-------------------|-----------------|-----------|
| `DECAY_RATE` | 0.02 | 0.015 | More characters = energy spreads thinner, needs slower decay |
| `GENERATION_RATE` | 0.5 | 0.3 | 152 characters generate 10x more total energy, reduce per-character rate |
| `DRAW_RATE` | 0.3 | 0.3 | Keep same -- moment absorption rate is independent of population |
| `TICK_INTERVAL_MINUTES` | 5 | 5 | Keep same -- visitor session pacing is the driver |
| `DEFAULT_BREAKING_POINT` | 0.9 | 3.0 | Much higher -- more energy in system means thresholds must be higher |
| `CORE_TYPES` | oath, blood, debt | debt, grudge, oath, alliance | Venice-specific persistent narratives |

These are starting estimates. Calibration requires running 1000+ ticks against a seeded Venice graph and observing flip rates. Target: 1-3 moment flips per hour of world time.

---

## Key Files

| What | Where |
|------|-------|
| Physics tick engine (v1.2) | `/home/mind-protocol/ngram/engine/physics/tick_v1_2.py` |
| Physics constants | `/home/mind-protocol/ngram/engine/physics/constants.py` |
| Tick runner CLI | `/home/mind-protocol/ngram/engine/physics/tick_runner.py` |
| Flow/backflow mechanics | `/home/mind-protocol/ngram/engine/physics/flow.py` |
| Crystallization | `/home/mind-protocol/ngram/engine/physics/crystallization.py` |
| Physics bridge (to be written) | `src/server/physics-bridge.js` |
| Venice graph schema | `docs/narrative/graph/PATTERNS_Graph.md` |
| Venezia algorithm pseudocode | `docs/04_ALGORITHM_Venezia.md` section A4 |
