# PATTERNS -- Economic Simulation

> Design philosophy for the 24/7 economic engine powering Venice.
> Venezia observes the economy. It does not control it. Serenissima owns the simulation.

---

## Core Principle: The Economy Is Real

The economy is not a game mechanic. It is a simulation that has been running for
months, with 186 citizens making autonomous decisions about production, trade,
employment, and land. Citizens go bankrupt. Monopolies form. Prices fluctuate
based on actual supply and demand. None of this is scripted.

Venezia's job is to make this economy visible and audible in 3D space. A merchant
complaining about grain prices is not reading from a dialogue tree -- she is
reacting to the actual price of grain in Airtable, which moved because a galley
shipment was delayed, which happened because the logistics citizen assigned to
the route chose to attend mass instead.

This is why the simulation matters: it gives citizens something real to talk about.

---

## Ownership Boundary: Serenissima Runs It, Venezia Reads It

This is the single most important architectural decision in the economy area.

**Serenissima owns all writes to economic state.** The simulation engine lives in
`serenissima/backend/engine/`. Activity creators decide what citizens do. Activity
processors execute those decisions. Stratagem processors handle competitive moves.
All results write back to Airtable.

**Venezia is a read-only observer** with two narrow exceptions:
1. Citizen memory updates (writing encounter data to `.cascade/` after conversations)
2. Trust score updates (writing to RELATIONSHIPS in Airtable after interactions)

Everything else -- Ducats, inventory, contracts, building ownership, wages, taxes,
land prices -- is Serenissima's domain. Venezia must never modify these values.

### Why This Matters

If Venezia writes to economic tables, two systems are mutating the same state
with no coordination. Serenissima's activity processor might be computing a trade
while Venezia adjusts a price. The result is corrupt data and broken invariants.

The boundary is clean: Serenissima writes economy, Venezia reads economy and
writes only memory/trust.

---

## Activity System Architecture

Serenissima's engine is built on an activity model with two halves:

### Activity Creators (what should I do next?)

~80 creator files in `backend/engine/activity_creators/`. Each evaluates whether
a citizen should perform a specific action: `production_activity_creator.py`,
`goto_work_activity_creator.py`, `file_grievance_activity_creator.py`,
`manage_public_sell_contract_creator.py`, etc.

Creators check preconditions (time of day, location, wealth, inventory, social
class) and emit an activity record if conditions are met. One citizen, one
activity at a time.

### Activity Processors (execute the decision)

~90 processor files in `backend/engine/activity_processors/`. Each processes a
specific activity type: `production_processor.py` creates goods,
`deliver_to_building_processor.py` moves inventory, `file_grievance_processor.py`
submits political complaints.

Processors write results to Airtable: updated Ducats, inventory changes, new
contracts, position changes.

### Venezia's Relationship to Activities

Venezia syncs the ACTIVITIES table every 15 minutes (via economy/sync). This
gives the 3D world:

- **Citizen positions**: where each citizen is right now
- **Citizen actions**: what they are doing (producing, trading, walking, praying)
- **Action metadata**: resource type, destination building, trade partner

The 3D renderer uses this to animate citizens: a citizen with activity
`production` is shown at their workshop. A citizen with `goto_location` is
walking. A citizen with `pray` is at a church.

---

## Stratagem System

Stratagems are competitive economic moves that go beyond simple trade. They are
the political economy layer -- citizens manipulating markets, reputations, and
supply chains for advantage.

Known stratagem processors in `backend/engine/stratagem_processors/`:

| Stratagem | Effect |
|---|---|
| `monopoly_pricing` | Citizen with market dominance raises prices |
| `supplier_lockout` | Block competitors from accessing a resource supplier |
| `political_campaign` | Spend Ducats to increase political influence |
| `reputation_assault` | Damage a competitor's reputation through gossip |
| `reputation_boost` | Spend to improve own reputation |
| `organize_gathering` | Create a social event that builds faction support |
| `marketplace_gossip` | Spread information (true or false) about prices |
| `printing_propaganda` | Use the printing press to amplify a message |
| `theater_conspiracy` | Stage events to influence public opinion |
| `neighborhood_watch` | Organize local surveillance on competitors |
| `organize_collective_delivery` | Coordinate logistics for group benefit |

Stratagems are what make the economy dramatic. A visitor walking through the
Rialto might overhear a merchant muttering about being locked out of the fish
market. That lockout is real -- another citizen executed a `supplier_lockout`
stratagem. The 3D world renders the consequence, not the mechanism.

### Venezia's Relationship to Stratagems

Venezia does not execute stratagems. It observes their effects:
- Price spikes (monopoly_pricing) visible as angry merchants, empty stalls
- Reputation changes visible as citizen mood shifts, altered greetings
- Gatherings visible as citizen clusters at specific locations
- Propaganda visible as posted notices, overheard conversations

---

## Resource Flows

The economy has real resource chains:

```
Raw materials (imported via galleys or produced locally)
    |
    v
Workshops (citizens with production activities transform inputs to outputs)
    |
    v
Storage (warehouses, personal inventory)
    |
    v
Market (public sell contracts, markup buy contracts)
    |
    v
Consumers (citizens buy what they need: food, clothing, tools, luxury goods)
```

Each link in the chain is an activity with a processor. Goods have weight and
must be physically transported -- a citizen walks from the warehouse to the
market stall. This creates visible movement in the 3D world.

Venezia renders resource flows as:
- Citizens carrying goods (visible inventory on avatar)
- Market stalls with displayed wares (from CONTRACTS table)
- Boats in canals (galley import/export activities)
- Empty shelves when supply is low (from inventory counts)

---

## What Runs Where

| Component | Location | Runtime |
|---|---|---|
| Activity creation | Serenissima backend (Python) | Triggered by simulation tick |
| Activity processing | Serenissima backend (Python) | Triggered by simulation tick |
| Stratagem execution | Serenissima backend (Python) | Triggered by simulation tick |
| Airtable writes | Serenissima backend (Python) | On activity completion |
| State sync to Venezia | cities-of-light Express server (JS) | Every 15 minutes |
| 3D rendering of state | cities-of-light client (Three.js) | Every frame |
| Blood Ledger physics | cities-of-light physics-bridge.js | Every 5 minutes |

The simulation tick is Serenissima's heartbeat. Venezia's heartbeat is the
15-minute sync plus the 5-minute physics tick. The two clocks are independent.

---

## Simulation Tick Rate

Serenissima's engine processes all 186 citizens per tick. Each tick:
1. Evaluate all citizens for activity completion
2. Process completed activities (write results)
3. Create new activities for idle citizens
4. Execute pending stratagems
5. Update market prices based on supply/demand

The tick rate is configurable. When frozen (current state -- 186 citizens paused),
tick rate is zero. When active, ticks run every few minutes. The exact interval
is tuned for Airtable rate limits: 5 requests/second means ~12 seconds to process
one citizen's full state update, so 186 citizens need ~37 minutes at full serial
processing. Parallelization and batching bring this down.

Venezia does not need to match this tick rate. It syncs the result, not the
process.

---

## Economic Balance

The economy self-regulates through scarcity and competition, not through tuning
knobs. Key dynamics:

- **Wage pressure**: If no citizens will work at offered wages, businesses raise pay or shut down
- **Price discovery**: Public sell contracts compete on price. Undercutting is a valid stratagem
- **Bankruptcy**: Citizens whose expenses exceed income long enough go bankrupt. This is real
- **Class mobility**: Successful Popolani can become Cittadini. Failed Nobili can fall
- **Import dependency**: Venice imports most raw materials. Galley disruptions ripple through the economy

Venezia should not attempt to "fix" economic imbalances. If half the city is
starving, that is a narrative event, not a bug.

---

## Reuse vs. Rewrite Decision

The simulation engine already exists. It has been running for months. The code is
battle-tested with real data.

**Decision: Reuse entirely. Do not rewrite.**

Venezia adds a rendering layer on top. The rendering layer reads state from
Airtable (via economy/sync) and from the ACTIVITIES table. It does not need to
understand the simulation internals -- only the output schema.

The only new code needed is:
1. `serenissima-sync.js` -- the Airtable sync module (economy/sync)
2. `physics-bridge.js` -- the Blood Ledger integration (narrative/physics)
3. Client-side renderers for economic state (citizen animations, market stalls)

The simulation engine itself stays in Serenissima's repo, running as a separate
process.

---

## Anti-Patterns

1. **Do not write economic state from Venezia.** Not prices, not Ducats, not
   contracts, not inventory. Serenissima owns all economic writes.

2. **Do not duplicate simulation logic.** If you need to know whether a citizen
   can afford something, read their Ducats from the synced cache. Do not
   reimplement the wealth calculation.

3. **Do not run activity processors in Venezia.** The simulation runs in
   Serenissima's Python backend. Venezia is JavaScript. Do not port processors.

4. **Do not assume tick freshness.** The synced data may be up to 15 minutes
   stale. Citizens in conversation should acknowledge this gracefully -- "I was
   at the market earlier" not "I am at the market right now" if the activity
   data is from 10 minutes ago.

5. **Do not throttle the simulation for rendering.** The simulation runs at its
   own pace. If the 3D world cannot keep up with state changes, drop frames on
   the rendering side, not the simulation side.
