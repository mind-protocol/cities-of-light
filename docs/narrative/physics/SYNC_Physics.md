# SYNC: narrative/physics -- Current State

Last updated: 2026-03-11

---

## Status: ENGINE EXISTS, VENICE ADAPTATION NOT STARTED

The Blood Ledger physics engine is fully implemented and tested in the ngram repo. It runs a complete energy-flow tick with generation, draw, flow, backflow, and link cooling phases. It has been tested against small-scale graphs (~10-20 characters). It has never been run against a 186-character Venice graph. No Venice-specific constants, no physics bridge, no economy energy injection pipeline exists.

---

## What Exists Now

### Physics Engine (working, in ngram repo)

The canonical implementation lives at `/home/mind-protocol/ngram/engine/physics/`. Blood Ledger proxies to it via exec imports. The engine consists of:

**Core tick (`tick_v1_2.py`):**
- `GraphTickV1_2` class -- instantiated with a graph name, runs one physics tick per `.run()` call
- Returns a `TickResult` dataclass: `energy_generated`, `energy_drawn`, `energy_flowed`, `energy_backflowed`, `moments_active`, `moments_possible`, `moments_completed`, `completions`, `rejections`, `hot_links`
- Six phases per tick: generate, draw, flow, backflow, cool, check
- Parameterized by `graph_name` -- already supports multiple graphs

**Constants (`constants.py`):**
- Two constant sets coexist: v1.1 (decay-based) and v1.2 (energy-flow, no-decay)
- Key v1.2 values: `GENERATION_RATE=0.5`, `DRAW_RATE=0.3`, `BACKFLOW_RATE=0.1`, `COLD_THRESHOLD=0.01`, `TOP_N_LINKS=20`
- Key v1.1 values still present: `DECAY_RATE=0.02`, `BASE_PRESSURE_RATE=0.001`, `DEFAULT_BREAKING_POINT=0.9`
- Plutchik emotion axes for emotion-modulated energy flow
- `distance_to_proximity()` function for spatial energy gating

**Tick runner (`tick_runner.py`):**
- CLI tool: `python -m engine.physics.tick_runner until_next_moment --graph venezia`
- Two modes: `until_next_moment` (run until a moment flips) and `until_completion_or_interruption` (run until any terminal state change)
- Max ticks safety limit (default 100)
- JSON output mode for programmatic consumption
- Already accepts `--graph NAME` parameter -- can target Venice graph today

**Graph operations (`graph/`):**
- `graph_interface.py` -- Protocol class defining the read contract
- `graph_ops.py` -- FalkorDB CRUD operations (create nodes, create edges, update energy, etc.)
- `graph_queries.py` -- Read queries (get character, get beliefs, get tensions, build scene context)
- `graph_ops_moments.py` -- Moment-specific operations (create, flip, reject)

**Supporting modules:**
- `flow.py` -- Energy flow through SUPPORTS edges
- `crystallization.py` -- Link crystallization (new links form from energy patterns)
- `exploration.py` -- Exploration tracking
- `synthesis.py`, `synthesis_unfold.py` -- Narrative synthesis from graph state
- `monitoring.py` -- Tick monitoring and metrics
- `health/` -- Health check endpoints

### Blood Ledger Agents (working, Norman England context)

Three agents generate narrative content from graph state:
- **Narrator** (`agents/narrator/`) -- interprets scenes, generates dialogue, applies moment consequences
- **World Builder** (`agents/world-builder/`) -- fills sparse graph areas with new narratives and tensions
- **World Runner** (`agents/world_runner/`) -- advances background storylines when time passes

These agents use Claude API with system prompts specific to Blood Ledger's Norman England setting. For Venice, the agent logic is reusable but system prompts need replacement.

### What Does NOT Exist

- Venice-specific physics constants (calibrated for 186 characters)
- Physics bridge (`src/server/physics-bridge.js`) -- Node.js <-> Python tick invocation
- Economy energy injection (Airtable economic deltas -> graph energy)
- Visitor energy injection (conversation -> belief energy boost)
- Forestiere news injection (RSS -> narrative nodes)
- Venice-specific agent prompts (Narrator, World Builder, World Runner)
- Any test of tick performance at Venice scale
- Cold pruning scheduled task for Venice graph
- Time-of-day generation rate modulation
- District-local cooldown after moment flips
- Maximum concurrent active moments enforcement

---

## Known Issues

### v1.2 vs v1.1 constant conflict

The constants file has both v1.1 and v1.2 constants. The v1.2 engine (`tick_v1_2.py`) uses v1.2 constants. But the file also exports v1.1 constants like `DECAY_RATE` which the pseudocode in `docs/04_ALGORITHM_Venezia.md` references. Need to decide: does Venice use v1.1 (decay-based) or v1.2 (energy-flow, no-decay) physics? The v1.2 model replaces decay with link cooling, which is a different narrative feel.

- **v1.1:** Energy decays globally. All beliefs fade unless reinforced. Feels like forgetting.
- **v1.2:** Energy flows through links and cools. Beliefs persist longer but links between them weaken. Feels like attention shifting.

Recommendation: v1.2 for Venice. Link cooling is more nuanced for a large population where many parallel narratives should coexist without all decaying uniformly.

### Scale uncertainty

The physics engine has been tested with 10-20 characters and ~50-100 narratives. Venice will have 186 characters and potentially 500-2000 narratives. Unknowns:
- Tick duration at this scale (could be 10ms or 10s depending on FalkorDB query patterns)
- Energy distribution (does energy concentrate or spread too thin?)
- Moment flip rate (too many flips? too few?)
- Memory usage (graph query result sets could be large)

These are answered by running the engine against a seeded Venice graph. This is Step 4 in the graph module build order.

### Agent prompt gap

The Narrator agent generates consequences when moments flip. Its system prompt assumes a Norman England setting: lords, villeins, manor houses, feudal obligations. Venice needs: Doge, senators, guilds, canals, trade, class hierarchy. The agent Python code is reusable, but the prompt layer needs a Venice-specific system message. This is an integration task, not a physics task.

---

## Build Order

### Step 1: Constant Calibration (estimate, pre-seeding)

Before seeding, estimate Venice-appropriate constants:

| Constant | Blood Ledger | Venice (initial) | Adjustable? |
|----------|-------------|-------------------|-------------|
| `GENERATION_RATE` | 0.5 | 0.3 | Yes, via env var |
| `DRAW_RATE` | 0.3 | 0.3 | Yes |
| `BACKFLOW_RATE` | 0.1 | 0.1 | Yes |
| `COLD_THRESHOLD` | 0.01 | 0.01 | Yes |
| `TOP_N_LINKS` | 20 | 20 | Yes |
| `DEFAULT_BREAKING_POINT` | 0.9 | 3.0 | Yes |
| `TICK_INTERVAL_MINUTES` | 5 | 5 | No (hardcoded in bridge) |

Create a Venice constants override file: `config/venice_physics_constants.json`. The physics bridge reads this and passes overrides to the tick engine.

### Step 2: Dry Run (depends on graph seeding)

After the graph is seeded (graph module Step 2), run the tick runner in verbose mode:

```bash
python -m engine.physics.tick_runner until_next_moment \
  --graph venezia --max-ticks 200 --verbose
```

Observe:
- Total energy generated per tick (should be ~50-100 for 186 characters at rate 0.3)
- Energy drawn by moments (should be non-zero if moments are seeded)
- Hot links count (should be >0 if tensions exist)
- Ticks to first moment flip (target: 30-100 ticks = 2.5-8 hours of world time)

If first flip happens in <10 ticks: raise `DEFAULT_BREAKING_POINT`.
If first flip never happens in 200 ticks: lower it, or add more tensions to graph.

### Step 3: Physics Bridge Implementation

`src/server/physics-bridge.js`:

```javascript
// Pseudocode structure
class PhysicsBridge {
  constructor(graphName, tickIntervalMs) { ... }

  start() {
    setInterval(() => this.runTick(), this.tickIntervalMs);
  }

  async runTick() {
    const result = await this.invokePythonTick();
    this.logTickStats(result);
    if (result.completions.length > 0) {
      for (const completion of result.completions) {
        this.emitMomentFlip(completion);
      }
    }
  }

  async invokePythonTick() {
    // Option A: subprocess
    // Option B: HTTP call to physics service
  }

  emitMomentFlip(completion) {
    // Forward to events module via WebSocket
    this.wsBroadcast('moment_flip', completion);
  }
}
```

### Step 4: Economy Energy Injection

After economy sync (`serenissima-sync.js`) is running, add energy injection to the sync callback:

```
On economy sync complete:
  For each citizen with significant economic delta:
    GRAPH.QUERY venezia
      "MATCH (c:Character {id: $id})
       SET c.energy = c.energy + $delta"
```

### Step 5: Visitor Energy Injection

When a visitor talks to a citizen about a specific belief, boost that belief's energy:

```
On conversation about belief B with citizen C:
  GRAPH.QUERY venezia
    "MATCH (c:Character {id: $c_id})-[b:BELIEVES]->(n:Narrative {id: $b_id})
     SET n.energy = n.energy + 0.1"
```

This makes the visitor's attention a force in the world. What they ask about becomes more important.

### Step 6: Venice Agent Prompts

Create Venice-specific system prompts for:
- Narrator: "You are the narrator of 15th century Venice. When a Moment flips, describe its consequences in the context of Venetian society..."
- World Builder: "You observe the narrative graph of Venice and identify areas that are sparse. Generate new narratives about trade disputes, guild politics, canal district rivalries..."
- World Runner: "Time has passed in Venice. Advance background storylines: ongoing trade negotiations, seasonal festivals, political maneuvering..."

---

## Open Questions

### Q1: v1.1 or v1.2 physics model?

See Known Issues above. Recommendation is v1.2 (link cooling) but this needs validation. The Venezia pseudocode in `04_ALGORITHM_Venezia.md` describes v1.1 (decay-based). Need to update the algorithm doc if we go v1.2.

### Q2: Should the physics service be standalone?

Current assumption is the physics bridge invokes Python as a subprocess or HTTP service. Alternative: embed the physics engine in the Express server via a Python-to-WASM bridge or a port to JavaScript. Subprocess is simplest and keeps the tested Python code unchanged. HTTP service adds operational complexity but enables independent scaling. Recommendation: subprocess for MVP, HTTP service for production.

### Q3: How do we test at Venice scale without the full pipeline?

The physics engine can run against a seeded graph without the 3D world, without citizen conversations, without the economy sync. A test harness that seeds the graph, runs 1000 ticks, and reports statistics would validate the constants before any integration work. This should be the first thing built after graph seeding.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Tick duration exceeds 5-minute interval at Venice scale | Critical | Profile FalkorDB queries. The tick must complete in <30s to leave headroom. If slow, reduce active character participation (only characters with energy > threshold). |
| Constants produce boring world (nothing happens) | High | Run test harness, adjust. Too-low generation rate is easily fixed. Too-high thresholds are easily lowered. |
| Constants produce chaotic world (everything happens at once) | High | Same test harness. Increase thresholds, increase decay/cooling, add cooldown periods. |
| Physics bridge subprocess startup is too slow (Python cold start) | Medium | Keep a long-running Python physics service instead of spawning per tick. Or use the HTTP service pattern. |
| Agent prompts produce incoherent Venice narrative | Medium | Test Narrator agent with sample moment flips before wiring into live system. Iterate on prompts. |

---

## Pointers

| What | Where |
|------|-------|
| Physics tick v1.2 implementation | `/home/mind-protocol/ngram/engine/physics/tick_v1_2.py` |
| Physics constants | `/home/mind-protocol/ngram/engine/physics/constants.py` |
| Tick runner CLI | `/home/mind-protocol/ngram/engine/physics/tick_runner.py` |
| Flow mechanics | `/home/mind-protocol/ngram/engine/physics/flow.py` |
| Crystallization | `/home/mind-protocol/ngram/engine/physics/crystallization.py` |
| Blood Ledger Narrator agent | `/home/mind-protocol/the-blood-ledger/agents/narrator/` |
| Blood Ledger World Builder | `/home/mind-protocol/the-blood-ledger/agents/world-builder/` |
| Blood Ledger World Runner | `/home/mind-protocol/the-blood-ledger/agents/world_runner/` |
| Venezia algorithm pseudocode | `docs/04_ALGORITHM_Venezia.md` |
| Graph module sync state | `docs/narrative/graph/SYNC_Graph.md` |
| Events module patterns | `docs/narrative/events/PATTERNS_Events.md` |
