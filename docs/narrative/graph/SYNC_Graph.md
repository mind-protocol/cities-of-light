# SYNC: narrative/graph -- Current State

Last updated: 2026-03-11

---

## Status: NOT SEEDED

The Blood Ledger has a working FalkorDB schema and physics engine. The Venice graph does not exist yet. No `venezia` graph has been created in FalkorDB. No seeding scripts exist. The graph interface protocol is defined but has never been instantiated against a Venice dataset.

---

## What Exists Now

### Blood Ledger FalkorDB (working, Norman England)

The Blood Ledger repo has a complete graph stack:

- **Schema:** Character, Narrative, Moment, Place nodes with BELIEVES, TENSION, SUPPORTS, WITNESS, AT, ABOUT edges
- **Engine:** Physics tick (`tick_v1_2.py`), energy generation, draw, flow, backflow, link cooling
- **Constants:** `DECAY_RATE=0.02`, `GENERATION_RATE=0.5`, `DRAW_RATE=0.3`, `COLD_THRESHOLD=0.01`
- **Graph interface:** Protocol class in `ngram/engine/physics/graph/graph_interface.py` -- defines the minimal contract any graph backend must satisfy
- **Graph operations:** Full CRUD in `ngram/engine/physics/graph/graph_ops.py` -- create nodes, create edges, update properties, delete cold nodes
- **Tick runner:** CLI tool in `ngram/engine/physics/tick_runner.py` -- `python -m engine.physics.tick_runner until_next_moment --graph venezia`
- **Agents:** Narrator, World Builder, World Runner in `the-blood-ledger/agents/` -- generate consequences from moment flips

All code is proxy-based: Blood Ledger files import from `/home/mind-protocol/ngram/` via exec. The actual implementations live in ngram.

### Blood Ledger Schema (confirmed from code)

The `GraphClient` protocol defines these queries:
- `get_character(id)`, `get_all_characters(type_filter)`, `get_characters_at(place_id)`
- `get_place(id)`, `get_path_between(from, to)`, `get_player_location(player_id)`
- `get_narrative(id)`, `get_character_beliefs(id, min_heard)`, `get_narrative_believers(id)`, `get_narratives_about(...)`
- `build_scene_context(player_location, player_id)` -- used by Narrator agent
- `query(cypher, params)` -- raw Cypher access

### Serenissima Airtable (source data, working)

The Serenissima Airtable base (`appkLmnbsEFAZM5rB`) holds:
- **CITIZENS table:** 186 AI citizens with `FirstName`, `LastName`, `SocialClass`, `Ducats`, `District`, `IsAI`, mood data
- **RELATIONSHIPS table:** Trust scores between citizens, relationship types
- **GRIEVANCES table:** Active complaints, support counts, political significance
- **BUILDINGS table:** Properties with coordinates, owners, categories
- **ACTIVITIES table:** Current citizen activities (production, trade, movement)

This is the source data for the Venice graph seeding pipeline.

### What Does NOT Exist

- `venezia` graph in FalkorDB (not created)
- Seeding script (`scripts/seed_venice_graph.py`)
- Venice-specific graph queries for conversation context
- Physics bridge (`src/server/physics-bridge.js`) connecting Express server to FalkorDB
- Economic energy injection pipeline (economy tick -> graph energy pump)
- Cold pruning cron job
- Any test of Blood Ledger physics against Venice-scale data (186 characters)

---

## Dependencies

### Hard Dependencies (blocks graph creation)

1. **FalkorDB running.** The Docker container must be up on port 6379. Blood Ledger already uses it, so this is likely satisfied. Verify with `redis-cli -p 6379 PING`.

2. **Airtable API access.** Need `AIRTABLE_API_KEY` (PAT) and `AIRTABLE_BASE_ID` to fetch citizen data. Both are known: base `appkLmnbsEFAZM5rB`, PAT starts with `patbbBiN98GWxGs44`.

3. **ngram repo present at `/home/mind-protocol/ngram/`.** The physics engine code lives there. Blood Ledger proxies to it. Without it, no graph operations work. This should be cloned and present.

### Soft Dependencies (graph works without, but incomplete)

4. **Serenissima .cascade/ directories.** Citizen memories are read during conversation, not during graph seeding. Seeding only needs Airtable data.

5. **Economy sync.** Energy injection from economic deltas requires the economy sync module to be running. Graph can be seeded and physics can tick without it -- just no external energy input.

---

## Build Order

### Step 1: Create Venice Graph

```bash
# Verify FalkorDB is running
redis-cli -p 6379 PING

# Create the graph with a single seed node (FalkorDB creates graphs on first write)
redis-cli -p 6379 GRAPH.QUERY venezia "CREATE (:Place {id: 'rialto', name: 'Rialto', district: 'Rialto'})"
```

### Step 2: Write Seeding Script

`scripts/seed_venice_graph.py`:
- Connect to Airtable, fetch all 186 citizens
- Connect to FalkorDB, target graph `venezia`
- Create Character nodes from citizen data
- Create Place nodes from district data (7 districts)
- Create initial Narrative nodes from grievances
- Create BELIEVES edges (citizen -> grievance)
- Create AT edges (citizen -> home district place)
- Create initial TENSION edges between contradicting grievances
- Seed 10-20 latent Moments from existing conflicts
- Log: character count, narrative count, edge count, moment count

### Step 3: Validate Schema

Run known queries against the seeded graph:
- `get_all_characters()` returns 186
- `get_character_beliefs(citizen_id)` returns beliefs for a test citizen
- `get_characters_at("rialto")` returns citizens in Rialto district

### Step 4: Test Physics Tick

```bash
python -m engine.physics.tick_runner until_next_moment --graph venezia --max-ticks 50 --verbose
```

Observe:
- Energy generates from characters
- Energy flows through BELIEVES and SUPPORTS edges
- Tension accumulates on TENSION edges
- Moments absorb energy
- At least one moment approaches its threshold

### Step 5: Write Physics Bridge

`src/server/physics-bridge.js`:
- On 5-minute interval, call Python physics tick (subprocess or HTTP)
- Read tick result (completions, energy stats)
- If moment flipped: emit WebSocket event to clients
- Log tick stats for monitoring

### Step 6: Wire Conversation Context

When a citizen conversation starts, query the Venice graph for:
- Top 5 active beliefs (`get_character_beliefs`)
- District tension level (custom query)
- Nearby unflipped moments (custom query)
- Inject into citizen's Claude API context

---

## Open Questions

### Q1: How many grievances does Serenissima actually have?

The seeding quality depends on initial narrative density. If there are only 5 grievances total, the graph starts very sparse and physics will stall (no energy, no tension). If there are 500, we need to select the most relevant ones. Need to query the GRIEVANCES table and count.

### Q2: What is the right initial energy for 186 characters?

Blood Ledger tested with ~10-20 characters. Venice has 186. The `GENERATION_RATE=0.5` and `DRAW_RATE=0.3` constants were tuned for a small population. With 10x more characters pumping energy, moments may flip too fast. May need to reduce `GENERATION_RATE` or increase moment thresholds for Venice.

### Q3: Should the physics bridge be Python or JavaScript?

The physics engine is Python. The Express server is JavaScript. Options:
- **(a)** Shell out to Python from Node.js (subprocess, simple, slow startup)
- **(b)** Run physics as a separate Python service with an HTTP API (clean, adds a service to manage)
- **(c)** Port physics to JavaScript (risky, duplicates code, diverges from Blood Ledger)

Recommendation: **(b)**. The physics service runs independently on its 5-minute tick. The Express server queries it for results. No tight coupling.

### Q4: Does the Blood Ledger Narrator agent work for Venice?

The Narrator agent generates consequences when a Moment flips. It uses Claude to interpret the moment in context. For Venice, the Narrator needs Venice-specific prompting (15th century setting, Venetian culture, social class dynamics). The agent code is reusable, but the system prompt needs a Venice overlay. This may be a customization point in the physics bridge.

### Q5: How do we handle the player character in the graph?

Blood Ledger has `char_player` as a Character node. Venice has a Forestiere visitor. Should the visitor be a Character node? If yes, they accumulate beliefs and participate in physics. If no, they observe but don't influence the narrative graph directly. Recommendation: yes, create a visitor Character node, but with low initial weight so their energy contribution is minimal until they build relationships.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| 186-character graph overwhelms physics tick performance | Medium | Profile tick duration. FalkorDB is fast for graph traversal. If >1s per tick, reduce active character count (only characters with energy > threshold participate). |
| Initial graph is too sparse (few narratives, no tension) | High | Seed synthetic narratives from citizen personality + class data, not just grievances. World Builder agent can fill sparse areas. |
| Physics constants tuned for Blood Ledger scale produce wrong dynamics at Venice scale | High | Run 1000 ticks in test mode, observe energy distribution and moment flip rate. Adjust constants before going live. |
| FalkorDB graph name collision with Blood Ledger | Low | Enforce `FALKORDB_GRAPH=venezia` in all Venice code. Never use default graph name. |
| Seeding script creates invalid graph structure | Medium | Validate after seeding: run all GraphClient protocol queries, assert expected results. |

---

## Pointers

| What | Where |
|------|-------|
| Blood Ledger engine (proxied from ngram) | `/home/mind-protocol/the-blood-ledger/engine/` |
| Actual physics implementation | `/home/mind-protocol/ngram/engine/physics/` |
| Graph interface protocol | `/home/mind-protocol/ngram/engine/physics/graph/graph_interface.py` |
| Physics constants (both versions) | `/home/mind-protocol/ngram/engine/physics/constants.py` |
| Tick runner CLI | `/home/mind-protocol/ngram/engine/physics/tick_runner.py` |
| Blood Ledger agents | `/home/mind-protocol/the-blood-ledger/agents/narrator/`, `world-builder/`, `world_runner/` |
| Cross-repo integration plan | `docs/CONCEPT_Cross_Repo_Integration.md` |
| Venezia architecture map | `docs/00_MAP_Venezia.md` |
| Venezia algorithms (graph schema) | `docs/04_ALGORITHM_Venezia.md` section A4 |
| FalkorDB env vars | `docs/CONCEPT_Cross_Repo_Integration.md` (Environment Variables section) |
