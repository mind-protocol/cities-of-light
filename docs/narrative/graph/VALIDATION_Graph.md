# VALIDATION: narrative/graph -- What Must Be True

Health checks, invariants, and acceptance criteria for the FalkorDB narrative graph. Every check is testable. Every threshold is specific. If a check fails, the graph is broken and the physics engine is operating on corrupt substrate.

---

## Invariants (must ALWAYS hold)

### GI1. Citizen-Character Parity

Every Airtable citizen has exactly one Character node. No more, no less.

```
MATCH (c:Character) RETURN count(c)  => MUST equal 152
```

Count < 152: seeding failed. Count > 152: duplicate seeding. This is the foundational invariant -- every downstream system operates on an incomplete world if this breaks.

### GI2. No Orphan Edges

Every edge connects two existing nodes. Check after every pruning cycle.

```
MATCH ()-[r]->() WHERE NOT EXISTS(startNode(r)) OR NOT EXISTS(endNode(r))
RETURN count(r)  => MUST equal 0
```

### GI3. Belief Confidence Range

Every BELIEVES edge has `confidence` in [0.0, 1.0]. Values outside this range corrupt the citizen context query ranking (`energy * confidence`).

```
MATCH ()-[b:BELIEVES]->() WHERE b.confidence < 0.0 OR b.confidence > 1.0
RETURN count(b)  => MUST equal 0
```

### GI4. Energy Non-Negative

No node may have negative energy. Decay is multiplicative and cannot produce negatives from positive inputs.

```
MATCH (n) WHERE n.energy < 0 RETURN count(n)  => MUST equal 0
```

### GI5. Moments Are Irreversible

`flipped = true` must never revert to `flipped = false`. The set of flipped moment IDs at tick N must be a superset of the set at tick N-1.

### GI6. Place Nodes Are Immutable

7 Place nodes (Rialto, Dorsoduro, Cannaregio, San_Marco, Castello, Santa_Croce, San_Polo). Created at seeding. Never modified, never deleted.

### GI7. Every Character Has Exactly One AT Edge

No character locationless. No character in two places.

```
MATCH (c:Character) OPTIONAL MATCH (c)-[a:AT]->(p:Place)
WITH c, count(a) AS loc WHERE loc != 1
RETURN c.id, loc  => MUST return 0 rows
```

---

## Health Checks (periodic monitoring)

### GH1. Graph Query Latency

Primary citizen context query must complete within bounds:

```
MATCH (c:Character {id: $id})-[b:BELIEVES]->(n:Narrative)
WHERE n.energy > 0.05
RETURN n.content, b.confidence, n.energy
ORDER BY n.energy * b.confidence DESC LIMIT 5

p50: < 20ms | p95: < 50ms | p99: < 100ms
```

If p95 exceeds 50ms: check FalkorDB indexes, narrative node count (should be 500-2000), memory usage.

### GH2. Node Count Within Expected Range

```
CHECK every 5 minutes:
  Character nodes:  MUST equal 152
  Place nodes:      MUST equal 7
  Narrative nodes:  SHOULD be 200-2000 (ALERT > 3000 or < 50)
  Moment nodes:     SHOULD be 10-100 (ALERT if 0)
  BELIEVES edges:   expected 1000-5000
  TENSION edges:    expected 50-300
```

### GH3. Edge Integrity Audit

```
CHECK every hour:
  BELIEVES edges with null confidence:     MUST equal 0
  TENSION edges with null/zero strength:   MUST equal 0
  AT edges to invalid district name:       MUST equal 0
```

### GH4. Active Tension Count

```
MATCH ()-[t:TENSION]-() WHERE t.strength > 0.1 RETURN count(t)

CRITICAL: 0 (dead world)  |  WARNING: < 10  |  NOMINAL: 10-200  |  WARNING: > 500
```

### GH5. Belief Distribution

Citizens should have varying numbers of active beliefs. Check daily.

```
Stats across all citizens: avg belief_count 3-15, stdev > 1.0, max <= 30.
WARNING if stdev < 0.5 (uniform -- seeding bug) or max > 50 (belief magnet).
```

### GH6. Graph Connectivity

80%+ of citizens (>= 150) should be reachable from each other through shared BELIEVES edges to common Narratives. Below 100 = fragmenting. Below 50 = critical.

---

## Acceptance Criteria

### AC1. Seeding Completeness

- [ ] 152 Character nodes, each with unique id matching Airtable
- [ ] 7 Place nodes, one per district
- [ ] Every Character has exactly 1 AT edge to a Place
- [ ] >= 100 Narrative nodes from citizen grievances
- [ ] >= 50 BELIEVES edges, >= 20 TENSION edges, >= 10 Moment nodes
- [ ] All Character.energy = 0.5, all Character.class valid, all Narrative.type valid
- [ ] Idempotent: running seed twice produces same graph, not duplicates

### AC2. Query Correctness

- [ ] Citizen context returns beliefs ranked by `energy * confidence` descending
- [ ] District tension returns only tensions within specified district
- [ ] Moment proximity returns only unflipped moments citizen is WITNESS of
- [ ] Non-existent citizen IDs return empty results, not errors

### AC3. Cold Pruning Safety

- [ ] Never deletes Character, Place, or Moment nodes
- [ ] Only deletes Narratives where energy < 0.001 AND weight < MIN_WEIGHT AND no TENSION edges
- [ ] After pruning, zero orphan edges remain

### AC4. Graph Isolation

- [ ] "venezia" operations do not affect "blood_ledger" and vice versa
- [ ] Wrong graph_name returns empty results, not cross-graph data

---

## Anti-Patterns

### GAP1. Graph Explosion

**Symptom:** Narrative count grows unbounded, query latency spikes.
**Detection:** `MATCH (n:Narrative) RETURN count(n)` -- ALERT > 3000, CRITICAL > 5000.
**Causes:** Pruning not running, Narrator creating too many consequences per flip (should be 2-5), Forestiere injection > 1/day, propagation creating duplicate nodes instead of BELIEVES edges.
**Fix:** Run cold pruning. Check cron. Review Narrator output volume.

### GAP2. Stale Beliefs

**Symptom:** BELIEVES edges pointing to near-zero energy narratives accumulate.
**Detection:** Count BELIEVES where target Narrative energy < 0.01. WARNING if > 500.
**Fix:** Add belief edge cleanup to cold pruning (remove BELIEVES to dead narratives).

### GAP3. Disconnected Subgraphs

**Symptom:** Districts are narrative islands. Cross-district tension propagation fails.
**Detection:** Per district, count cross-district links via shared Narratives. WARNING if any district has zero.
**Fix:** Seed cross-district narratives (trade disputes, political factions). Run Forestiere pipeline for city-wide news.

### GAP4. Belief Monoculture

**Symptom:** Most citizens believe the same narratives. No diversity, no tension.
**Detection:** Top narrative has > 100 believers (55%+). WARNING.
**Fix:** Seed contradicting narratives. Verify propagation confidence decay per hop.

### GAP5. Index Corruption

**Symptom:** Indexed queries return empty while full scans succeed.
**Detection:** Compare `MATCH (c:Character {id: X})` vs `MATCH (c:Character) WHERE c.id = X`.
**Fix:** Drop and recreate indexes via `create_venezia_schema()`.

---

## Data Integrity

### DI1. Airtable-Graph Parity Check (daily)

Compare Airtable CITIZENS IDs against graph Character IDs. Sets must be identical. Name mismatches flagged for review (graph is narrative authority -- do not auto-update from Airtable).

### DI2. Grievance-Tension Mapping

For each contradicting grievance pair in Airtable RELATIONSHIPS, verify a corresponding TENSION edge exists between their Narrative nodes in the graph.

### DI3. Post-Tick Integrity (after every tick)

```
ASSERT: no negative energy, no NaN/Infinity values, Character count == 152,
        Place count == 7, zero orphan edges, all BELIEVES confidence in [0,1].
```

### DI4. Moment Flip Audit Trail

Every flip logged as JSONL: tick, timestamp, moment_id, salience_at_flip, threshold, connected_narratives, affected_district, witness_count. For every `flipped=true` Moment in graph, a corresponding audit entry must exist.

### DI5. Cold Pruning Audit

Every pruning run logged: timestamp, narratives_pruned, believes_edges_cleaned, pre/post counts, duration_ms. Post-conditions: orphan_count == 0, character_count == 152, place_count == 7.
