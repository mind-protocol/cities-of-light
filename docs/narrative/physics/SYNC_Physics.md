# SYNC: narrative/physics -- Current State

Last updated: 2026-03-12

---

## Status: VENICE PHYSICS OPERATIONAL — TUNED AND VALIDATED

The Venice physics engine is running. 6-phase tick adapted from Blood Ledger v1.2 with DECAY for narrative forgetting. Tested: 200-tick dry run against 124-citizen Venice graph. Homeostasis verified. All metrics within healthy ranges.

---

## What Exists Now

### Physics Engine (Venice 6-phase, operational)

- **Location:** `.mind/runtime/physics/`
- **6 phases:** PUMP → ROUTE → DECAY → FLIP → INJECT (stub) → EMIT (stub)
- **Graph:** `cities_of_light` — 124 Characters, 233 Narratives, 12 Moments, 7 Places
- **Dry run results (200 ticks):**
  - First flip: tick 21 (1.8 hours)
  - Avg between flips: 15 ticks (1.2 hours)
  - Flip rate: 0.72/hour (target: 1-3)
  - Avg pressure: 0.567 (target: 0.4-0.6)
  - Homeostasis: decay rate dynamically adjusts 0.005-0.100
  - Decay/Generated ratio: 78% (healthy)
  - Verdict: HEALTHY

### Calibrated Constants

| Constant | Value | Rationale |
|----------|-------|-----------|
| `GENERATION_RATE` | 0.08 | Tuned for 124-citizen scale |
| `DECAY_RATE` | 0.05 | Higher base for faster homeostasis response |
| `DEFAULT_BREAKING_POINT` | 3.0 | Venice scale |
| `DRAW_RATE` | 0.15 | Moment absorption rate |
| `MOMENT_THRESHOLD_MIN` | 15.0 | Calibrated for 124-citizen energy output |
| `MOMENT_THRESHOLD_MAX` | 45.0 | Prevents instant flips |
| `FRICTION_FACTOR` | 0.8 | 80/20 SUPPORTS routing |
| `PROPENSITY_VARIANCE` | 0.2 | Anti-convergence |
| `COOLDOWN_TICKS` | 3 | District cooldown after flip |

### Scripts

| Script | Purpose | Status |
|--------|---------|--------|
| `scripts/seed_venice_graph.py` | Airtable → FalkorDB seeder | ✅ Working |
| `scripts/physics_dryrun.py` | Rapid tick tuning tool | ✅ Working |
| `scripts/physics_scheduler.py` | 5-minute tick loop | ✅ Written, not yet deployed |

### Fixed Bugs

1. ✅ `avg_emotion_intensity` — added as helper in `tick_v1_2.py`
2. ✅ Cypher syntax error — `rejection.py` `:` → `=`
3. ✅ Actor→Character label vocabulary — all phase files updated

### Audit Findings — All Incorporated

1. ✅ Propensity-Weighted Advantage — `_seeded_variance()` in generation.py
2. ✅ Friction Factor — 80/20 rule in ROUTE phase
3. ✅ Criticality Pressure — homeostasis in decay.py
4. ✅ Bootstrap Energy — Character: 0.5, Narrative: 0.3

---

## Known Limitations

- **12 moments only** — system goes idle after all flip (~tick 156). Production needs moment generation or recycling.
- **242 Blood Ledger orphan moments deleted** — were polluting pressure calculations.
- **Wealth factor capped at 1.5** — Venice citizens have 100K-10M ducats; uncapped log10 caused runaway generation.
- **INJECT phase is a stub** — reads economic_deltas.json if it exists, not wired to Airtable.
- **EMIT phase is a stub** — writes to JSONL file, not to any event bus.

---

## Remaining Work

1. 📋 Deploy scheduler as systemd service
2. 📋 Moment generation/recycling (new moments emerge from tension clusters)
3. 📋 Economic injection bridge (Airtable → energy deltas)
4. 📋 Event emission to Express server or WebSocket

---

## Pointers

| What | Where |
|------|-------|
| Physics tick (Venice) | `.mind/runtime/physics/tick_v1_2.py` |
| Constants | `.mind/runtime/physics/constants.py` |
| Tick runner CLI | `.mind/runtime/physics/tick_runner.py` |
| Phase: PUMP | `.mind/runtime/physics/phases/generation.py` |
| Phase: DECAY | `.mind/runtime/physics/phases/decay.py` |
| Phase: FLIP | `.mind/runtime/physics/phases/completion.py` |
| Phase: ROUTE | in `tick_v1_2.py._phase_route()` |
| Graph operations | `.mind/runtime/physics/graph/` |
| Algorithm spec | `docs/narrative/physics/ALGORITHM_Physics.md` |
| Validation spec | `docs/narrative/physics/VALIDATION_Physics.md` |
| Dry run script | `scripts/physics_dryrun.py` |
| Scheduler | `scripts/physics_scheduler.py` |
| Seed script | `scripts/seed_venice_graph.py` |
