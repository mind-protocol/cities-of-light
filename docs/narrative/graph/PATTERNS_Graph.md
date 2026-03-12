# PATTERNS: narrative/graph -- Design Philosophy

The graph is the world's unconscious. It is not a database. It is not a knowledge graph for retrieval-augmented generation. It is the substrate on which narrative physics operates -- the medium through which tension accumulates, beliefs propagate, and moments flip into events. Without the graph, the physics engine has nothing to compute on. Without the physics engine, the graph is inert data.

This module owns the FalkorDB schema, the seeding pipeline from Serenissima's 152 citizens, and the query patterns that citizen conversation context assembly depends on.

---

## Pattern 1: Separate Graph, Shared Engine

The Blood Ledger already has a FalkorDB graph seeded with Norman England -- characters, narratives, places, moments. Venice is a different world. It must not contaminate the Blood Ledger graph, and the Blood Ledger must not contaminate Venice.

The separation is by graph name within the same FalkorDB instance:

```
FalkorDB (localhost:6379)
  graph: "blood_ledger"   -- Norman England (Blood Ledger's world)
  graph: "venezia"         -- 15th century Venice (this project)
```

Same server, different namespaces. The physics engine code (`engine/physics/`) is reused without modification -- it takes `graph_name` as a parameter. `GraphTickV1_2(graph_name="venezia")` operates exclusively on the Venice graph. No cross-contamination.

**Why not a separate FalkorDB container?** Unnecessary operational complexity. FalkorDB's graph isolation is sufficient. Both graphs are small (hundreds of nodes, not millions). A single Redis-protocol container handles both.

**What this means for code:** Every graph operation must explicitly pass the graph name. No hardcoded defaults. No implicit "current graph." The `FALKORDB_GRAPH=venezia` env var sets the default for the Venezia server, but every function that touches FalkorDB accepts an override.

---

## Pattern 2: Schema Is the Blood Ledger Schema, Extended

The Venice graph uses the same node and edge types as Blood Ledger. This is not a coincidence -- it is the reason the physics engine is reusable. The schema:

```
NODES:
  Character(id, name, energy, weight, class, mood, district)
  Narrative(id, content, truth, energy, weight, type, source)
  Place(id, name, district, position_x, position_z)
  Moment(id, description, threshold, flipped, category, severity)

EDGES:
  BELIEVES(character -> narrative, confidence, source, heard_at)
  AT(character -> place)
  TENSION(narrative <-> narrative, strength)
  SUPPORTS(narrative -> narrative)
  WITNESS(character -> moment)
  ABOUT(narrative -> character|place)
```

Venice-specific extensions (properties that Blood Ledger characters do not have):
- `Character.class`: Serenissima social class (Nobili, Cittadini, Popolani, Facchini, Forestieri)
- `Character.district`: Home district in Venice (Rialto, Dorsoduro, Cannaregio, etc.)
- `Character.ducats`: Current wealth from Airtable
- `Narrative.type`: Extended types -- `grievance`, `rumor`, `belief`, `debt`, `alliance`, `grudge`
- `Moment.category`: Venice-specific -- `economic_crisis`, `political_uprising`, `celebration`, `personal_tragedy`, `guild_dispute`, `trade_disruption`
- `Place.district`: Which of the 7 Venice districts this place belongs to

These extensions are additive. The physics engine does not read `class` or `district` -- it reads `energy`, `weight`, `threshold`. The extensions exist for query and seeding purposes only.

---

## Pattern 3: Seeding Is a One-Time Transform, Not a Sync Loop

The graph is seeded from Serenissima Airtable data: 152 citizens become Character nodes, their grievances become Narrative nodes, Venice districts become Place nodes. This is a one-time operation per graph instance, not a continuous sync.

Why not continuous sync? Because the graph is a narrative layer, not an economic mirror. Once a citizen exists as a Character node in the graph, their narrative state diverges from their economic state. A citizen may believe a rumor that has no basis in Airtable data. A citizen may have accumulated tension from graph physics that Airtable knows nothing about. Syncing would overwrite emergent narrative state with economic data.

**Seeding pipeline:**

```
1. Fetch 152 citizens from Airtable CITIZENS table
2. For each citizen:
   a. CREATE (:Character {id, name, energy: 0.5, weight: 1.0, class, district, ducats, mood})
   b. Fetch their relationships from RELATIONSHIPS table
   c. For each active grievance:
      CREATE (:Narrative {type: "grievance", content, energy: 0.3, weight: 0.5})
      CREATE (character)-[:BELIEVES {confidence: 0.8}]->(narrative)
3. Fetch 7 districts
   a. CREATE (:Place {id, name, district, position_x, position_z})
4. For each citizen, CREATE (character)-[:AT]->(home_place)
5. Seed initial tensions between contradicting grievances
6. Seed 10-20 latent Moments from existing conflicts
```

After seeding, the graph evolves through physics ticks only. Economic data flows in through energy injection (Pattern 5), not through node overwrites.

---

## Pattern 4: Append-Only With Cold Pruning

Graph nodes are never deleted during normal operation. New narratives, new beliefs, new tensions -- all append. This is consistent with Blood Ledger's design and with the memory philosophy of the citizens/mind module.

But unbounded growth is a problem. A graph with 152 characters that runs for months will accumulate thousands of narrative nodes. Most will have decayed to near-zero energy and weight. They are cold -- narratively dead.

**Cold pruning** runs on the daily cycle (every 24 hours):

```
MATCH (n:Narrative)
WHERE n.energy < 0.001 AND n.weight < MIN_WEIGHT
AND NOT EXISTS((n)-[:TENSION]->()) AND NOT EXISTS(()-[:TENSION]->(n))
DETACH DELETE n
```

Pruning rules:
- Only Narrative nodes. Characters and Places are never pruned.
- Energy AND weight must both be below threshold. A low-energy narrative with high weight is historically significant -- it may re-energize.
- No active tensions. A cold narrative under tension is still structurally important.
- Moments are never pruned. Even flipped moments are historical record.

This keeps the graph bounded at roughly 500-2000 narrative nodes for a 152-citizen population. The Blood Ledger graph for a much smaller world stabilizes around 200-400 narratives.

---

## Pattern 5: Economy Injects Energy, Not State

The Serenissima economy runs on a 15-minute tick. Citizens earn, spend, trade, produce. This economic activity is the fuel that drives narrative physics -- but indirectly.

Every economy tick, the physics bridge reads economic deltas and injects them as energy:

```
For each citizen where abs(ducats_delta) > threshold:
  character.energy += abs(ducats_delta) * ECONOMIC_ENERGY_FACTOR

For each citizen where mood changed significantly:
  For each narrative the character BELIEVES:
    narrative.energy += mood_delta * MOOD_ENERGY_FACTOR
```

The economy does not create narrative nodes. It does not modify graph structure. It pumps energy into existing structures. A citizen who just lost half their wealth does not get a "financial_crisis" narrative injected -- instead, their existing grievances and debts receive a burst of energy, which the physics engine routes through SUPPORTS and TENSION edges, potentially pushing a Moment past its threshold.

This is the core insight: **the economy is a heat source, not a narrative author.** Narratives emerge from the physics of tension and belief, not from economic events directly.

---

## Pattern 6: Query Patterns Serve Conversation, Not Analytics

The graph exists to answer one question well: "What does this citizen believe, fear, and care about right now?" Every query pattern is designed for citizen conversation context assembly, not for dashboards or reports.

**Primary query (citizen context):**

```cypher
MATCH (c:Character {id: $citizen_id})-[b:BELIEVES]->(n:Narrative)
WHERE n.energy > 0.05
RETURN n.content, b.confidence, n.energy
ORDER BY n.energy * b.confidence DESC
LIMIT 5
```

This returns the top 5 active beliefs for a citizen, ranked by how strongly they believe them (confidence) weighted by how narratively alive the belief is (energy). A citizen does not talk about dead narratives. A citizen does not talk about things they barely believe.

**Secondary query (district tension):**

```cypher
MATCH (n1:Narrative)-[t:TENSION]-(n2:Narrative)
WHERE EXISTS((c1:Character)-[:BELIEVES]->(n1))
  AND EXISTS((c2:Character)-[:BELIEVES]->(n2))
  AND c1.district = $district AND c2.district = $district
RETURN n1.content, n2.content, t.strength
ORDER BY t.strength DESC
LIMIT 3
```

This returns the hottest tensions in a district -- useful for atmosphere and event prediction, but also for conversation context ("things are tense at the market lately").

**Tertiary query (moment proximity):**

```cypher
MATCH (m:Moment {flipped: false})<-[:WITNESS]-(c:Character {id: $citizen_id})
RETURN m.description, m.threshold, m.energy * m.weight AS salience
ORDER BY salience DESC
LIMIT 2
```

This tells the citizen what might be about to happen near them. A citizen near a breaking point is anxious, distracted, preoccupied -- this shapes their conversation behavior.

---

## Design Anti-Patterns

1. **The knowledge graph.** This is not a retrieval system. Do not add nodes for "facts" about Venice (its history, its architecture, its customs). Those belong in citizen CLAUDE.md prompts and .cascade/ memories. The graph stores only narrative state that the physics engine can operate on.

2. **The event log.** Do not store historical events as graph nodes. Events are Moments that have flipped. Once flipped, a Moment is marked `flipped: true` and stops participating in physics. Its consequences are new Narratives and Tensions, not a log entry.

3. **The social network.** BELIEVES edges connect characters to narratives, not characters to characters. Social structure emerges from shared beliefs and tensions, not from explicit "FRIENDS_WITH" or "RIVALS" edges. Two citizens who believe the same thing are implicitly connected. Two citizens who believe contradicting things are implicitly in tension. The physics computes this.

4. **The mirror of Airtable.** The graph does not replicate citizen economic state. It does not store Ducats, contracts, or trade data. It stores what citizens believe about their economic situation -- which may be wrong, outdated, or paranoid.

5. **Querying for rendering.** The graph is never queried on the 3-second render loop. Graph queries happen on conversation start (citizen context), on physics tick (every 5 minutes), and on event propagation (every hour). If you find yourself querying FalkorDB per frame, the architecture is wrong.

---

## Key Files

| What | Where |
|------|-------|
| Blood Ledger physics engine | `/home/mind-protocol/the-blood-ledger/engine/physics/` |
| Graph interface (protocol) | `/home/mind-protocol/ngram/engine/physics/graph/graph_interface.py` |
| Graph operations | `/home/mind-protocol/ngram/engine/physics/graph/graph_ops.py` |
| Physics constants | `/home/mind-protocol/ngram/engine/physics/constants.py` |
| Tick runner | `/home/mind-protocol/ngram/engine/physics/tick_runner.py` |
| Serenissima Airtable sync (existing) | `src/server/serenissima-sync.js` (planned) |
| Venice graph seeding script | `scripts/seed_venice_graph.py` (to be written) |
| Physics bridge | `src/server/physics-bridge.js` (to be written) |
| FalkorDB config | `.env` -> `FALKORDB_HOST`, `FALKORDB_PORT`, `FALKORDB_GRAPH=venezia` |
| Cross-repo integration | `docs/CONCEPT_Cross_Repo_Integration.md` |
