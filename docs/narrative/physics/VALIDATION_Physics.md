# VALIDATION: narrative/physics -- What Must Be True

Health checks, invariants, and acceptance criteria for the physics engine. Every threshold is derived from the constants in ALGORITHM_Physics.md. If a check fails, the world is either dead or on fire.

---

## Invariants (must ALWAYS hold)

### PI1. Energy Conservation Within Bounds

Total energy is accountable. Every unit traces to a source (generation, economic injection) and a sink (decay, moment absorption, energy-to-weight conversion).

```
expected = E_before + E_generated + E_injected - E_decayed - E_absorbed - E_to_weight
ASSERT abs(E_after - expected) < 0.01
```

This is not strict conservation (the system is open). It is accounting. If the delta exceeds 0.01, energy is being created or destroyed outside defined mechanisms.

### PI2. Decay Is Always Positive

Decay rate stays within [DECAY_RATE_MIN, DECAY_RATE_MAX] = [0.005, 0.1]. After decay, every node's energy is <= its pre-decay energy and >= 0.

### PI3. Moments Are Irreversible Once Flipped

`flipped = true` never reverts. Flipped Moments must not participate in phase_draw() or phase_flip_check(). Their energy must not be modified by the tick.

### PI4. Tick Phase Ordering Is Sacred

Six phases execute in exact order: GENERATE, DRAW, FLOW, BACKFLOW, COOL, CHECK. No phase skipped, repeated, or reordered. The Blood Ledger test suite validates this.

### PI5. Cooldown Enforced After Flip

After a Moment flips, no other Moment in the same district may flip for 3 ticks (15 minutes). This prevents cascade seizures.

### PI6. Maximum Concurrent Active Moments

No more than 3 active (unflipped, above 50% threshold) Moments simultaneously. A 4th is held at 50% until a slot opens.

### PI7. Weight Non-Negative and Bounded

All weight values in [0.0, MAX_WEIGHT]. Weight accumulates through COOL phase only.

---

## Health Checks (periodic monitoring)

### PH1. Tick Duration

```
CHECK every tick:
  NOMINAL:  < 2000ms
  WARNING:  2000-5000ms
  CRITICAL: > 5000ms
  ALERT if 3 consecutive ticks > 3000ms
```

Expected for 186 characters + 1000 narratives: 500-1500ms. If consistently > 3s, cold pruning is overdue or graph has exploded.

### PH2. Total System Energy

```
CHECK every tick:
  CRITICAL: < 10 (dead) or > 1500 (runaway)
  WARNING:  < 50 (cooling) or > 800 (running hot)
  NOMINAL:  50-500
```

Bounds calibrated for 186 citizens. Lower bound ~19 (186 * 0.1 minimum). Upper bound ~1400 (186 * 2.0 + 1000 * 1.0 maximum).

### PH3. Tension Count and Distribution

```
CHECK every tick:
  CRITICAL: 0 (no drama) or > 500 (inflation)
  WARNING:  < 10 (low) or > 300 (high)
  NOMINAL:  10-200

  Per-district: WARNING if any district has 0 tensions (narratively dead district).
```

### PH4. Moment Flip Rate

Target: 1-3 flips per hour (12 ticks).

```
CHECK hourly:
  CRITICAL: 0 flips for 3 consecutive hours (dead world)
  NOMINAL:  1-3 flips/hour
  WARNING:  4-6 flips/hour (chaotic)
  CRITICAL: > 6 flips/hour (flip storm, cascade prevention broken)
```

### PH5. Criticality Pressure

Average pressure = mean(moment.energy * moment.weight / moment.threshold) across unflipped Moments.

```
NOMINAL:  0.3-0.7  |  WARNING: < 0.2 or > 0.8  |  CRITICAL: < 0.05 or > 0.95
```

### PH6. Decay Rate Stability

Effective decay rate should not oscillate rapidly. Over last 12 ticks: variance < 0.0005 is nominal, > 0.001 is warning, > 0.005 is critical (unstable feedback loop).

### PH7. Economic Injection Magnitude

```
CHECK every injection tick (every 3rd tick):
  NOMINAL:  0-50 total injected
  WARNING:  > 100 (economic crisis pumping hard)
  CRITICAL: > 200 (will likely trigger multiple flips)
  WARNING:  0 for 6 consecutive injection ticks (economy stalled)
```

---

## Acceptance Criteria

### PAC1. Tick Stability

- [ ] 1000 consecutive ticks without error (83 hours)
- [ ] No tick exceeds 5s duration
- [ ] No NaN or Infinity in any node property after any tick
- [ ] Energy conservation holds within 0.01 on every tick
- [ ] Character count remains 186 after every tick

### PAC2. Flip Behavior

- [ ] At least 1 flip within first 100 ticks (8.3 hours) of freshly seeded graph
- [ ] No more than 3 flips in any single tick
- [ ] No flipped Moment ever reverts
- [ ] After a flip, no same-district flip for 3 ticks
- [ ] Average flip rate over 1000 ticks: 0.5-5.0 per hour

### PAC3. Homeostasis Effectiveness

- [ ] After high-energy injection, system returns to bounds within 24 ticks (2 hours)
- [ ] Without injection for 100 ticks, system does not flatline (generation maintains minimum)
- [ ] Criticality pressure stays within 0.2-0.8 for 90% of ticks over 1000-tick run
- [ ] Decay rate adjustments monotonic within any 6-tick window

### PAC4. Phase Correctness

- [ ] GENERATE increases energy only on Characters and their believed Narratives
- [ ] DRAW moves energy only from Narratives to connected Moments
- [ ] FLOW moves energy only along SUPPORTS edges between Narratives
- [ ] BACKFLOW moves energy only from Narratives back to Characters
- [ ] COOL converts energy to weight without creating or destroying total energy+weight
- [ ] CHECK only flips Moments where salience exceeds threshold

### PAC5. Venice Calibration

- [ ] With defaults (GENERATION_RATE=0.3, DECAY_RATE=0.02, DEFAULT_BREAKING_POINT=3.0), first flip occurs between tick 20 and 200
- [ ] Core types (debt, grudge, oath, alliance) decay at 1/4 rate of standard narratives
- [ ] Citizen losing 50% wealth produces energy spike > 0.1 in their believed narratives

---

## Anti-Patterns

### PAP1. Energy Explosion

**Symptom:** Total energy grows unbounded. Multiple flips every tick.
**Detection:** `total_energy(N) > total_energy(N-1) * 1.5` in one tick, or total > 1500, or flips > 3/tick.
**Causes:** GENERATION_RATE too high (should be 0.3), economic injection multiplier too aggressive, decay not running, homeostasis ceiling broken.
**Fix:** Verify constants match spec. Check decay phase executed. If immediate: set DECAY_RATE to 0.05 for 12 ticks to bleed excess.

### PAP2. Dead World

**Symptom:** No tensions, no flip for 3+ hours, total energy < 20.
**Detection:** `active_tensions == 0 AND total_energy < 20 AND no_flips_36_ticks`.
**Causes:** DECAY_RATE too high, seeding had too few tensions, all Moments already flipped with no new seeds, economic injection not running.
**Fix:** Check tensions exist. Verify unflipped Moments exist. Invoke Narrator to seed new Moments. Reduce DECAY_RATE to 0.01 temporarily.

### PAP3. Tick Timeout

**Symptom:** Ticks exceed 5s. Interval drifts > 6 minutes.
**Causes:** Graph > 3000 narratives (pruning overdue), FalkorDB memory pressure, unindexed queries, CPU contention.
**Fix:** Run cold pruning. Verify indexes. Monitor server resources.

### PAP4. Flip Storm

**Symptom:** > 5 flips in 6 ticks (30 minutes).
**Causes:** Cooldown not enforced, thresholds too low (should be 3.0, not 0.9), low-threshold Moments seeded, homeostasis too slow.
**Fix:** Verify cooldown logic. Check new Moments have escalated thresholds. Increase DEFAULT_BREAKING_POINT by 50%.

### PAP5. Oscillating Homeostasis

**Symptom:** Decay rate swings between MIN and MAX every few ticks. Energy oscillates.
**Detection:** `decay_rate_variance > 0.005` over 12 ticks, or > 4 direction changes in 12 ticks.
**Causes:** Adjustment step too large. Target band (0.4-0.6) too narrow.
**Fix:** Halve HOMEOSTASIS_ADJUSTMENT_RATE. Widen target to 0.3-0.7. Use exponential moving average of pressure instead of instantaneous.

---

## Data Integrity

### PDI1. Energy Conservation Audit (every tick)

Full accounting: E_before, E_generated, E_injected, E_decayed, E_absorbed, E_to_weight, E_after. Weight balance: W_after = W_before + E_to_weight. Both must hold within 0.01 tolerance. Logged as JSONL per tick.

### PDI2. Tick History Log

Every tick logged as JSONL: tick_number, timestamp, duration_ms, total_energy, total_weight, character_count, narrative_count, moment counts (flipped/unflipped), tension_count, flips_this_tick, effective_decay_rate, avg_criticality_pressure, energy_generated/injected/decayed, top_tension, nearest_flip. Retention: 7 days (2016 entries).

### PDI3. Moment Lifecycle Audit

Track every Moment from creation to flip:
- Flipped Moments must exist in flip audit log and not participate in current tick phases.
- Unflipped Moments older than 1000 ticks with energy < 0.1: WARNING (may never flip, candidate for replacement).
- Unflipped Moments older than 2000 ticks: stale, candidate for retirement.

### PDI4. Cross-Graph Isolation (daily)

Verify venezia and blood_ledger Character ID sets do not overlap. Verify venezia node count > 200 (expected) and blood_ledger count is proportionally smaller. If blood_ledger suddenly has 200+ nodes, data may have been written to the wrong graph.
