# VALIDATION: narrative/events -- What Must Be True

Health checks, invariants, and acceptance criteria for the event system. Every threshold is derived from PATTERNS_Events.md and ALGORITHM_Events.md. If a check fails, the world either cannot produce observable events or is drowning in them.

---

## Invariants (must ALWAYS hold)

### EI1. Maximum Concurrent Events

No more than 3 events may be in EMERGING or ACTIVE phase simultaneously. Hard cap. When a 4th would activate: suppress if lower severity than all 3, preempt lowest-severity active event if higher.

### EI2. Events Always Have a Lifecycle

Every event has a phase from `[EMERGING, ACTIVE, SETTLING, AFTERMATH, RESOLVED]`. Transitions are forward-only. No backward moves. No null phase.

```
VALID: EMERGING -> ACTIVE -> SETTLING -> AFTERMATH -> RESOLVED
INVALID: SETTLING -> ACTIVE, ACTIVE -> EMERGING, any -> null
```

### EI3. News Propagation Respects Social Graph

Citizens learn about events through the social graph, not instantly:
- t=0: only WITNESS citizens know (confidence 1.0)
- t=1 tick: same-district, trust > 50 (confidence 0.8)
- t=4 ticks: adjacent district, trust > 30 (confidence 0.6)
- t=12 ticks: city-wide, trust > 20 (confidence 0.4)
- t=24 ticks: universal knowledge

A citizen with a BELIEVES edge to an event narrative must satisfy one of these conditions. If not, propagation was bypassed.

### EI4. Every Event Traces to a Moment Flip

No random events, no scheduled events, no manual triggers. Every event has a `source_moment_id` pointing to a flipped Moment in the graph. Exception: Forestiere news injects Narratives (not events) -- events only emerge from physics.

### EI5. Event Severity Is Immutable

Once classified, an event's severity and category do not change during its lifecycle. Severity determines duration, radius, effect intensity, and preemption priority.

### EI6. Belief Confidence Decays With Hops

Confidence is monotonically decreasing with propagation hop count: witness 1.0, hop 1 = 0.8, hop 2 = 0.6, hop 3+ = 0.4 floor.

### EI7. Event Effects Bounded by Radius

3D effects (atmosphere, citizen behavior, audio) do not extend beyond computed radius:
- MINOR (severity 0.0-0.3): 50-100m
- NOTABLE (0.3-0.6): 150-300m
- MAJOR (0.6-0.9): 300-600m
- CRISIS (0.9-1.0): city-wide

---

## Health Checks (periodic monitoring)

### EH1. Event Generation Rate

```
CHECK hourly:
  CRITICAL: 0 events for 3 consecutive hours (pipeline broken or physics dead)
  NOMINAL:  1-3 events/hour
  WARNING:  4-6 (slightly high)
  CRITICAL: > 6 (event flood)
```

### EH2. Propagation Coverage

After an event reaches ACTIVE, measure citizen awareness over time:

```
Expected coverage:
  1 tick  (5 min):   5-15%   (witnesses + neighbors)
  4 ticks (20 min):  15-35%  (district spread)
  12 ticks (1 hour): 35-60%  (adjacent districts)
  24 ticks (2 hours): 60-85% (city-wide)
  48 ticks (4 hours): 85-100% (universal)

WARNING if > 20% above expected (too fast) or > 20% below (stuck).
CRITICAL if < 5% after 12 ticks (propagation broken).
```

### EH3. 3D Effect Performance Impact

```
Per active event:
  fog_computation:       < 0.5ms/frame
  particle_system:       < 1.0ms/frame
  spatial_audio_sources: <= 5

Total across all active events:
  fog_layers:         <= 3
  particle_emitters:  <= 6
  audio_sources:      <= 15
  frame_time_added:   < 2ms (out of 13.8ms at 72fps)

WARNING > 2ms | CRITICAL > 4ms
```

### EH4. Lifecycle Duration Compliance

Each phase has an expected duration by severity:

```
MINOR:   total 1h   (EMERGING 5m, ACTIVE 15m, SETTLING 20m, AFTERMATH 20m)
NOTABLE: total 6h   (EMERGING 5m, ACTIVE 1h, SETTLING 2h, AFTERMATH 3h)
MAJOR:   total 24h  (EMERGING 5m, ACTIVE 6h, SETTLING 6h, AFTERMATH 12h)
CRISIS:  until resolved by another event

WARNING if EMERGING > 2 ticks, or any phase exceeds expected by > 50%.
```

### EH5. Event Queue Health

Active pipeline (EMERGING + ACTIVE + SETTLING + AFTERMATH) should be <= 10 at any time. Total resolved events should be >= 80% of all events. Event store should not accumulate indefinitely.

### EH6. Narrator Response Time

After a Moment flip, the Narrator must generate consequences within bounds:
```
NOMINAL: < 5s | WARNING: 5-15s | CRITICAL: > 30s
If no consequences within 60s: pipeline broken (event has 3D effects but no narrative impact).
```

### EH7. Forestiere News Frequency

At most 1 injection per 24 hours. WARNING if 2, CRITICAL if > 2.

---

## Acceptance Criteria

### EAC1. Event Generation

- [ ] Moment flip produces exactly one event
- [ ] Event has valid category (economic_crisis, political_uprising, celebration, personal_tragedy, guild_dispute, trade_disruption)
- [ ] Severity computed from Moment salience at flip time
- [ ] Location derived from flipped Moment's district
- [ ] Radius proportional to severity
- [ ] Event enters EMERGING within 1 tick of flip

### EAC2. Observable Effects

- [ ] EMERGING: subtle atmosphere at 50% intensity within radius
- [ ] ACTIVE: full atmosphere, citizen behavior, and audio changes
- [ ] SETTLING: effects fade linearly to zero
- [ ] AFTERMATH: zero visual/audio but persists in conversation context
- [ ] No pop-in or pop-out transitions (fade only)

### EAC3. News Propagation

- [ ] t=0: only witnesses aware
- [ ] t=1 tick: same-district, high-trust citizens aware (confidence 0.8)
- [ ] t=4 ticks: adjacent-district spread (confidence 0.6)
- [ ] t=12 ticks: city-wide spread (confidence 0.4)
- [ ] t=24 ticks: universal knowledge
- [ ] Aware citizens gain BELIEVES edge to event narrative
- [ ] Conversation language reflects confidence ("I saw it" vs. "I heard that...")

### EAC4. Concurrent Event Management

- [ ] 4th event with higher severity preempts lowest active event
- [ ] Preempted event effects end immediately
- [ ] Suppressed event (lower severity) delays effects, Moment still marked flipped
- [ ] Suppressed event activates when a slot opens

### EAC5. Narrative Consequences

- [ ] Narrator produces 2-5 new Narrative nodes per flip
- [ ] At least 1 new TENSION edge created
- [ ] At least 1 new Moment seeded with higher threshold than source
- [ ] Consequence Narratives reference the triggering event

---

## Anti-Patterns

### EAP1. Event Spam

**Symptom:** Multiple events fire in rapid succession. Atmosphere constantly shifting.
**Detection:** > 3 events in 6 ticks, or average gap < 2 ticks over last 12 events.
**Causes:** Physics flip storm (fix physics first -- see PAP4 in VALIDATION_Physics.md), cooldown not enforced at events layer, low Moment thresholds.
**Fix:** Verify physics cooldown. Add 3-tick minimum inter-event gap. Increase DEFAULT_BREAKING_POINT.

### EAP2. Silent Events

**Symptom:** Moment flips and event is logged, but nothing observable in 3D. No atmosphere shift, no citizen behavior change, no audio.
**Detection:** ACTIVE event with zero atmosphere changes + zero citizen overrides + zero audio sources = CRITICAL.
**Causes:** WebSocket to consumers broken, radius computed as 0, category not in consumer template maps.
**Fix:** Verify WebSocket connection. Check descriptor radius > 0. Verify all 6 categories handled in each consumer.

### EAP3. Stale Events That Never Resolve

**Symptom:** Events stuck in ACTIVE or SETTLING indefinitely. All 3 slots permanently occupied. New events always suppressed.
**Detection:** Phase duration > 2x expected, or all 3 slots occupied > 48 ticks with no SETTLING transition.
**Causes:** Event tick scheduler stopped, phase transition logic bug, CRISIS event without resolution condition.
**Fix:** Verify event tick running. Inspect time comparison logic. Add 48-hour max CRISIS duration. Force-transition stuck non-CRISIS events.

### EAP4. Propagation Stuck

**Symptom:** Only witnesses know about event. Coverage flat after 4 ticks.
**Detection:** Citizens aware < 30% of district population after 4 ticks.
**Causes:** Propagation function not called, trust values all below threshold, social graph disconnected, BELIEVES edge creation failing silently.
**Fix:** Verify propagation is called post-event. Check trust distribution. Verify FalkorDB writes succeed.

### EAP5. Atmosphere Mud

**Symptom:** Overlapping events with conflicting atmosphere instructions. Fog both increasing and decreasing.
**Detection:** Two active events in same district with opposing fog_delta or light_delta signs.
**Causes:** Concurrent cap enforced globally but not per-district. Atmosphere consumer naively sums deltas.
**Fix:** Atmosphere consumer should use highest-severity event's deltas per district. Lower-severity events contribute citizen behavior and audio only.

---

## Data Integrity

### EDI1. Event-Graph Moment Mapping

Bidirectional consistency between event store and graph Moments:
- Every event has a `source_moment_id` pointing to a `flipped=true` Moment in the graph.
- Every `flipped=true` Moment has a corresponding event in the event store.
- Count parity: flipped Moments == events with valid source_moment_id.

A flipped Moment without an event means the pipeline dropped it -- physics happened but the world did not react.

### EDI2. Event Descriptor Completeness

Every descriptor must have all required fields:

```
REQUIRED: event_id, category, severity (0-1), location (district, x, z),
          radius (> 0), affected_citizens (non-empty), atmosphere,
          citizen_behavior, audio, duration_minutes (> 0), created_at,
          source_moment_id, phase

Null or missing field in any of these = CRITICAL (consumer modules fail silently).
```

### EDI3. Propagation Audit Trail

Every awareness creation logged as JSONL: event_id, tick, citizen_id, citizen_district, informed_by, hop_count, confidence, method. Checks:
- hop_count monotonically increasing over time per event
- confidence <= 1.0 - (hop_count * 0.2) with 0.4 floor
- informed_by was already aware at a previous tick
- No duplicate awareness entries per citizen per event

### EDI4. Event Store Consistency

- All event_id values unique
- Events in chronological creation order
- RESOLVED events have resolved_at > created_at
- EMERGING events have null active_at
- Active slot count (EMERGING + ACTIVE) <= 3
- No events with created_at in the future

### EDI5. Consequence Narrative Traceability

Every Narrative with `source_type = "event_consequence"` must have a valid `source_event_id` pointing to an existing event. Every event past EMERGING phase must have produced >= 2 consequence Narratives. An event with zero consequences is pure spectacle with no narrative impact.
