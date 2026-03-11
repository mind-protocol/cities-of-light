# Citizens/Population -- Validation: Health Checks for Population Management

```
STATUS: DRAFT
CREATED: 2026-03-11
VERIFIED: Not yet implemented
```

---

## CHAIN

```
OBJECTIVES:      ../../../docs/01_OBJECTIFS_Venezia.md
PATTERNS:        ./PATTERNS_Population.md
ALGORITHM:       ./ALGORITHM_Population.md
THIS:            VALIDATION_Population.md (you are here)
PARENT:          ../../../docs/05_VALIDATION_Venezia.md
```

---

## INVARIANTS (must ALWAYS hold)

### INV-P1: 186 Citizens Always Accounted For

Every Airtable CITIZENS record must have a `CitizenPopulationState` on the client and a tracked state on the server. No citizen missing. No phantom citizens. Checked on every Airtable sync (15 min) and on client connection.

```
ASSERT Set(server.citizens.keys()) == Set(airtable.citizens.keys())
ASSERT Set(client.citizens.keys()) == Set(airtable.citizens.keys())
ASSERT count == 186
```

### INV-P2: Tier Counts Within Budget

At no point may citizens in any tier exceed the configured maximum. Counts must always sum to 186.

| Condition | maxFull | maxActive | maxAmbient |
|-----------|---------|-----------|------------|
| Normal | 20 | 60 | 120 |
| Memory pressure (heap > 1.5GB) | 10 | 30 | 120 |
| Emergency (heap > 1.8GB) | 10 | 30 | 60 |

```
ASSERT counts.FULL <= budget.maxFull
ASSERT counts.ACTIVE <= budget.maxActive
ASSERT counts.FULL + counts.ACTIVE + counts.AMBIENT + counts.HIDDEN == 186
```

### INV-P3: No Citizen in Two Places

Each citizen has exactly one tier, one position, one activity. No citizen ID appears in two tier lists. Combined tier list length must equal 186 with zero duplicates.

### INV-P4: Position Reflects Schedule

A citizen's position must correspond to their current schedule entry (within walking-distance tolerance). Citizens should be at or moving toward their scheduled location. Exception: event overrides (gatherings, dispersals) temporarily redirect.

### INV-P5: Conversation Lock

A citizen in active conversation with a visitor must never be downgraded below FULL tier. Mid-sentence tier demotion is a critical failure.

```
FOR each citizen WHERE activity == "talking" AND talkingTo == "visitor":
  ASSERT tier == FULL
```

---

## HEALTH CHECKS

### HC-P1: FULL Tier Count vs. Budget

Per-frame check in debug mode. Alert at 90% of budget. Fail if exceeded.

```
fullCount = count(citizens WHERE tier == FULL)
ASSERT fullCount <= frameBudget.maxFull
WARN IF fullCount > frameBudget.maxFull * 0.9
```

### HC-P2: Frame Time for Population Update

The entire `populationUpdate()` loop must complete within 1.0ms per frame. This includes scoring, hysteresis, budget enforcement, transitions, and position interpolation.

| Phase | Budget |
|-------|--------|
| Amortized scoring (20 citizens) | 0.3ms |
| Hysteresis + budget enforcement | 0.2ms |
| Transition updates | 0.1ms |
| Position interpolation (180 citizens) | 0.3ms |
| Time slot check | 0.1ms |
| **Total** | **1.0ms** |

Alert at > 1.0ms. Critical at > 2.0ms (will cause frame drops).

### HC-P3: Tier Transition Duration

Transitions must complete within 150% of target duration. Stalled transitions (stuck crossfades) produce visual artifacts.

| Transition | Target | Max Allowed |
|------------|--------|-------------|
| HIDDEN -> AMBIENT | 0.8s | 1.2s |
| AMBIENT -> ACTIVE | 0.5s | 0.75s |
| ACTIVE -> FULL | 0.3s | 0.45s |
| FULL -> ACTIVE | 0.4s | 0.6s |
| ACTIVE -> AMBIENT | 0.5s | 0.75s |
| AMBIENT -> HIDDEN | 1.0s | 1.5s |

If a transition exceeds 2x target, force-complete it and log a failure.

### HC-P4: Position Interpolation Smoothness

No visible citizen may jump > 0.2m in a single frame (at 72fps, fastest walker moves ~0.019m/frame). Jumps > 2.0m are teleportation failures.

```
FOR each citizen WHERE tier != HIDDEN:
  frameDelta = distance(lastFramePos, currentPos)
  WARN IF frameDelta > 0.2
  FAIL IF frameDelta > 2.0
```

### HC-P5: WebSocket Update Frequency

Citizens must receive server updates at tier-appropriate rates. Alert at 3x target interval.

| Tier | Target Interval | Alert If Gap Exceeds |
|------|----------------|---------------------|
| FULL | 33ms | 100ms |
| ACTIVE | 500ms | 1.5s |
| AMBIENT | 2s | 6s |
| HIDDEN | -- | -- |

### HC-P6: District Density Adherence

Actual citizen counts per district should approximate density targets for the current time slot. Check every 5 minutes.

```
FOR each district D:
  target = getDensityTarget(D.id, currentTimeSlot)
  actual = count(citizens WHERE district == D.id AND isOutdoors)
  WARN IF actual < target.minCount OR actual > target.maxCount
```

---

## ACCEPTANCE CRITERIA

### AC-P1: Full Population at 72fps

186 citizens tracked, maximum tier load active (20 FULL + 60 ACTIVE + 100 AMBIENT). Automated 120-second benchmark at Rialto midday.

- P50 frame time: < 13.9ms (72fps)
- P99 frame time: < 16.7ms (60fps)
- Zero frames > 33.3ms (30fps)
- Population update P95: < 1.0ms

### AC-P2: Invisible Tier Transitions

3-minute walk through populated district at normal pace, reviewed by 3 evaluators. Zero perceptible tier transitions (no pop-in, no opacity flicker, no geometry swap, no scale jump).

### AC-P3: District Population Feels Correct

5 evaluators rate density as "too empty," "right," or "too crowded" for 2 minutes each:

| Scenario | Expected |
|----------|----------|
| Rialto at midday | "right" or "too crowded" |
| Rialto at 3am | "too empty" acceptable |
| Residential at midday | "too empty" or "right" |
| Residential at 8pm | "right" |
| Council during session | "right" or "too crowded" |

Threshold: >= 80% match expected column.

### AC-P4: Citizens Remember Their Position

Speak to 5 citizens, note positions and time. Wait 30 minutes world time. Return. All 5 have moved. 4 of 5 are at schedule-appropriate locations (not frozen where you left them).

### AC-P5: Organic Event Response

Trigger a gathering event. Observe 60 seconds. Citizens arrive from different directions, at different times (staggered by distance), stop at different distances from center, and some do not attend. All 4 criteria pass by evaluator consensus.

---

## ANTI-PATTERNS

### AP-P1: Spawn Clusters
**Symptom:** Multiple citizens materialize at the same point and disperse. New AMBIENT citizens appear at a default spawn point instead of their simulation position.
**Detection:** Any two non-grouped citizens of different classes within 0.5m. Citizens transitioning from HIDDEN must appear within 5m of their `serverPosition`.
**Fix:** Verify `offScreenTick()` runs every 30s. Verify `prepareDistrictState()` called on district entry. Use server-tracked position, not defaults.

### AP-P2: Uniform Distribution
**Symptom:** Citizens evenly spaced across a district like a grid. No clustering at markets, no empty alleys.
**Detection:** Nearest-neighbor distance coefficient of variation < 0.3 across a district's outdoor citizens.
**Fix:** Ensure `randomActivityNode()` returns positions around buildings and activity points, not uniform random within district bounds. Weight market stalls and tavern entrances higher.

### AP-P3: Crowd Teleportation
**Symptom:** Citizens jump between locations across frames. Citizen at market one frame, at home the next.
**Detection:** HC-P4 (any frame delta > 2m for visible citizens).
**Fix:** On HIDDEN->visible transition, set `interpolatedPos = serverPosition` immediately. For normal updates, `POSITION_LERP_FACTOR = 0.12` smooths corrections over ~30 frames. If corrections regularly > 10m, increase server update frequency.

### AP-P4: Tier Flicker
**Symptom:** Citizen rapidly oscillates between two tiers at a boundary. Appearance alternates between detailed and simplified.
**Detection:** > 4 tier changes for any citizen in 60 frames.
**Fix:** Verify `applyHysteresis()` enforces `MIN_STABLE_FRAMES = 15`. Widen hysteresis bands from 5m to 8m if flicker persists.

### AP-P5: Night of the Living Dead
**Symptom:** City fully populated at 3am. Citizens walking the streets as if midday.
**Detection:** > 30 outdoor citizens during 22:00-6:00 is a warning. > 50 is a failure.
**Fix:** Verify `buildDailySchedule()` produces `indoors: true` for night hours. Verify `fillScheduleGaps()` defaults to `{ activity: "resting", indoors: true }`.

---

## DATA INTEGRITY

### On Airtable Sync (Every 15 Minutes)

```
DI-P1: Position Mapping
  FOR each citizen: Airtable position maps to a valid, in-bounds,
  walkable world position. Alert if mapped to water or inside walls.

DI-P2: Schedule Consistency
  FOR each citizen: schedule covers all 24 hours (no gaps),
  no time overlaps between entries, all outdoor locations are
  in-bounds and in known districts.

DI-P3: District Assignment
  FOR each outdoor citizen: computed district from position matches
  schedule district. Tolerate during walking transitions.
```

### Daily

```
DI-P4: Population Distribution by Class
  Nobili: 10-25. Cittadini: 20-45. Popolani: 60-100.
  Facchini: 25-55. Forestieri: 10-35. Total: 186.

DI-P5: Density Target Completeness
  Every (district, time_slot) pair has a density target with
  valid min/max/target counts and classMix summing to 1.0.
  Sum of district targets per time slot approximates expected
  outdoor population (186 * global scale for that slot, +/- 20).

DI-P6: Event Override Expiry
  No citizen holds an event override past 2x its duration.
  Expired overrides not cleaned up = scheduling bug.

DI-P7: Off-Screen Simulation Liveness
  Last offScreenTick < 60 seconds ago (runs every 30s).
  Sample 10 outdoor citizens: those not at schedule target
  must be advancing toward it (distance decreasing).
```
