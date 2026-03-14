# HEALTH: architecture/pipeline — Runtime Verification

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## WHEN TO USE HEALTH (NOT TESTS)

Health checks verify runtime behavior that tests cannot catch:

| Use Health For | Why |
|----------------|-----|
| Energy budget drift under load | Needs 186 citizens rendering simultaneously, not mocked scenes |
| GPU instance isolation | Needs real parallel render passes, not single-citizen tests |
| C_t propagation latency | Varies with network conditions, payload size, and client hardware |
| Decay monotonicity over time | Emergent from real tick sequences, not fixture values |

**Tests gate completion. Health monitors runtime.**

---

## PURPOSE OF THIS FILE

This HEALTH file covers the 3D Pipeline and Cognitive Supply Chain module — the system that transforms physics tick output (C_t) into shader uniforms and visual state, and routes collision feedback back into the cognitive graph.

It exists to protect against the failure modes that break the coupling between cognition and rendering: budget overruns that crash the Quest 3, instance bleed that corrupts citizen appearance, latency that makes the world feel laggy, and broken feedback loops that leave agents without bodies.

This file does not verify physics tick correctness (covered by engine/serenissima HEALTH), motor control fidelity (covered by motor-control HEALTH), or cognitive graph integrity (covered by serenissima HEALTH).

---

## WHY THIS PATTERN

Tests can verify that a single C_t message produces the correct uniform values. But they cannot verify that 186 citizens rendering simultaneously stay within the draw call budget. They cannot verify that GPU instance IDs never collide under real concurrent render passes. They cannot verify that C_t messages arriving over a real WebSocket are processed within 16ms on Quest 3 hardware.

Docking-based checks at `dock_tick_output`, `dock_uniform_update`, and `dock_injection_arrive` allow verification at the critical boundaries without instrumenting the render loop. Throttling ensures health checks do not themselves consume frame budget.

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Pipeline.md
PATTERNS:        ./PATTERNS_Pipeline.md
BEHAVIORS:       ./BEHAVIORS_Pipeline.md
ALGORITHM:       ./ALGORITHM_Pipeline.md
VALIDATION:      ./VALIDATION_Pipeline.md
IMPLEMENTATION:  ./IMPLEMENTATION_Pipeline.md
THIS:            HEALTH_Pipeline.md (you are here)
SYNC:            ./SYNC_Pipeline.md
```

---

## IMPLEMENTS

This HEALTH file is a **spec**. The actual code lives in runtime:

```yaml
implements:
  runtime: engine/client/health/pipeline_health.js  # TODO — does not exist yet
  decorator: @check (server-side) / requestIdleCallback (client-side)
```

> **Separation:** HEALTH.md defines WHAT to check and WHEN to trigger. Runtime code defines HOW to check.

> **Contract:** HEALTH checks verify input/output against VALIDATION with minimal or no code changes. After changes: update runtime or add TODO to SYNC. Run HEALTH checks at throttled rates.

---

## FLOWS ANALYSIS (TRIGGERS + FREQUENCY)

```yaml
flows_analysis:
  - flow_id: ct_to_visual
    purpose: Forward path — if this flow fails, citizens are visually static regardless of cognitive state
    triggers:
      - type: event
        source: engine/server/narrative_graph_seed_and_tick_bridge.js:broadcast()
        notes: physics_tick WebSocket message triggers C_t reception on client
    frequency:
      expected_rate: 1/5min (one physics tick per interval)
      peak_rate: 1/1min (if tick interval is reduced for testing)
      burst_behavior: single message per tick — no bursting
    risks:
      - V1 draw call budget exceeded when all 186 citizens are visible
      - V3 latency spike on large C_t payloads
    notes: This is the primary data flow that makes the graph visible

  - flow_id: collision_to_graph
    purpose: Feedback path — if this flow fails, agents have no bodies
    triggers:
      - type: event
        source: engine/client/app.js:detectCollisions() (planned)
        notes: Per-frame collision detection triggers injection pipeline
    frequency:
      expected_rate: 60/sec (checked every frame, few collisions per second)
      peak_rate: 60/sec
      burst_behavior: rate-limited to MAX_INJECTIONS_PER_SECOND (3) per citizen, batched every 100ms
    risks:
      - V5 collisions detected but never injected (feedback loop open)
    notes: Collision detection does not yet exist — this flow is entirely planned
```

---

## HEALTH INDICATORS SELECTED

## OBJECTIVES COVERAGE

| Objective | Indicators | Why These Signals Matter |
|-----------|------------|--------------------------|
| Performance budget | energy_budget | Quest 3 drops below 72fps if budget is exceeded — visitor experiences nausea |
| GPU isolation | wm_isolation | Instance bleed corrupts citizen appearance — visitor sees emotional state artifacts |
| Responsiveness | propagation_latency | Laggy world feels dead — citizens whose colors lag behind their state |
| Feedback closure | feedback_loop | Without feedback, agents are puppets — collision data never reaches cognition |
| Visual truth | ct_shader_coupling | If shaders diverge from C_t, the visual layer lies about cognitive state |

```yaml
health_indicators:
  - name: energy_budget
    flow_id: ct_to_visual
    priority: high
    rationale: Budget overrun crashes Quest 3 frame rate — visitor experiences motion sickness

  - name: wm_isolation
    flow_id: ct_to_visual
    priority: high
    rationale: Uniform bleed between citizens produces visible color artifacts — breaks immersion

  - name: propagation_latency
    flow_id: ct_to_visual
    priority: high
    rationale: C_t-to-shader delay exceeding 16ms means world responds a frame late — felt as lag

  - name: feedback_loop
    flow_id: collision_to_graph
    priority: med
    rationale: Open feedback loop means collisions are decorative — agents never feel the world

  - name: ct_shader_coupling
    flow_id: ct_to_visual
    priority: med
    rationale: If shader uniforms diverge from C_t target, visual layer lies about cognitive state
```

---

## STATUS (RESULT INDICATOR)

```yaml
status:
  stream_destination: .mind/state/health/pipeline.json
  result:
    representation: enum
    value: UNKNOWN
    updated_at: 2026-03-14T00:00:00Z
    source: energy_budget
```

---

## CHECKER INDEX

```yaml
checkers:
  - name: energy_budget
    purpose: Verify draw calls and triangle count stay within Quest 3 budget (V1)
    status: pending
    priority: high
  - name: wm_isolation
    purpose: Verify no uniform bleed between citizen GPU instances (V2)
    status: pending
    priority: high
  - name: propagation_latency
    purpose: Verify C_t message arrival to first uniform update < 16ms (V3)
    status: pending
    priority: high
  - name: feedback_loop
    purpose: Verify classified collisions produce graph injections within 200ms (V5)
    status: pending
    priority: med
  - name: ct_shader_coupling
    purpose: Verify shader uniforms converge toward C_t target values (V6 decay monotonicity)
    status: pending
    priority: med
```

---

## INDICATOR: energy_budget

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: energy_budget
  client_value: Stable 72fps on Quest 3 — no frame drops, no motion sickness
  validation:
    - validation_id: V1
      criteria: Draw calls <= 200 and triangles <= 500K on Quest 3. No object rendered at LOD higher than its node energy permits.
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - float_0_1
  semantics:
    float_0_1: 1.0 = draw calls < 150 AND triangles < 375K (25% headroom). 0.0 = either exceeds budget. Linear interpolation in between.
  aggregation:
    method: min of draw_call_score and triangle_score
    display: float_0_1 with raw counts in tooltip
```

### DOCKS SELECTED

```yaml
docks:
  - point: dock_uniform_update
    type: custom
    payload: renderer.info.render.calls, renderer.info.render.triangles per frame
```

### SIGNALS

```yaml
signals:
  healthy: Draw calls < 150 AND triangles < 375K (25% headroom)
  degraded: Either metric between 75% and 100% of budget
  critical: Either metric exceeds budget (200 draw calls or 500K triangles)
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: requestIdleCallback (client-side)
  max_frequency: 1/10sec
  burst_limit: 1
  backoff: stop checking during frame drops (checking would worsen the problem)
```

---

## INDICATOR: wm_isolation

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: wm_isolation
  client_value: Each citizen's visual state reflects only their own cognitive state — no color artifacts from other citizens
  validation:
    - validation_id: V2
      criteria: Instance ID mapping is bijective. No citizen's uValence or uArousal applied to another citizen's material during the same frame.
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - binary
  semantics:
    binary: 1 = all instance IDs are unique and no uniform buffer is shared across non-global uniforms. 0 = collision detected.
  aggregation:
    method: AND across all citizen instances
    display: binary pass/fail
```

### DOCKS SELECTED

```yaml
docks:
  - point: dock_uniform_update
    type: custom
    payload: map of citizen_id to GPU instance_id, per-citizen uniform values
```

### SIGNALS

```yaml
signals:
  healthy: All instance IDs unique, no non-global uniform sharing detected
  degraded: N/A — isolation is binary
  critical: Any instance ID collision or non-global uniform shared between citizens
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: physics_tick arrival (when uniforms are re-bound)
  max_frequency: 1/5min
  burst_limit: 1
  backoff: none — isolation failures must always be caught
```

---

## INDICATOR: propagation_latency

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: propagation_latency
  client_value: World responds within one frame of receiving new cognitive state — no perceived lag
  validation:
    - validation_id: V3
      criteria: Wall-clock time from WebSocket message arrival to first shader uniform update < 16ms. No C_t update takes effect two or more frames after arrival.
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - float_0_1
  semantics:
    float_0_1: 1.0 = p99 latency < 8ms. 0.0 = p99 latency > 16ms. Linear interpolation between.
  aggregation:
    method: rolling p99 over last 100 C_t messages
    display: float_0_1 with p99 latency in ms
```

### DOCKS SELECTED

```yaml
docks:
  - point: dock_ct_arrival
    type: event
    payload: WebSocket message timestamp
  - point: dock_uniform_update
    type: custom
    payload: first uniform update timestamp after C_t
```

### SIGNALS

```yaml
signals:
  healthy: p99 latency < 8ms
  degraded: p99 latency 8ms-16ms
  critical: p99 latency > 16ms — missing frames
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: physics_tick arrival
  max_frequency: 1/5min
  burst_limit: 1
  backoff: none — latency measurement is lightweight
```

---

## HOW TO RUN

```bash
# Run all health checks for this module (server-side checks)
node engine/health/pipeline_health.js --all

# Run a specific checker
node engine/health/pipeline_health.js --check energy_budget
```

---

## KNOWN GAPS

- V4 (open-source auditability) has no health checker — needs telemetry infrastructure first
- V6 (decay monotonicity) is partially covered by ct_shader_coupling but needs a dedicated decay-specific checker
- V5 (feedback loop closure) checker cannot verify end-to-end until collision detection and graph injection endpoints exist
- LOD-energy coupling (V1 sub-invariant: no object rendered at LOD higher than energy permits) is not yet checkable
- No client-side health dashboard exists to surface these indicators
- Collision detection does not exist in current code — feedback_loop checker is entirely prospective

<!-- @mind:todo Implement energy_budget checker when limbic shader materials exist -->
<!-- @mind:todo Implement wm_isolation checker when instanced citizen rendering is implemented -->
<!-- @mind:todo Implement propagation_latency checker when C_t WebSocket handler exists -->
<!-- @mind:todo Add V4 auditability checker when telemetry logging is implemented -->
<!-- @mind:todo Add V6 decay monotonicity dedicated checker -->
<!-- @mind:escalation R3F migration decision affects all shader/uniform patterns — checkers must be written after migration decision -->

---

## MARKERS

<!-- @mind:todo Implement all pending checkers — module is DESIGNING with some engine code -->
<!-- @mind:proposition Client-side health overlay (debug mode only) showing budget and latency -->
<!-- @mind:escalation Quest 3 hardware benchmarks needed to validate budget thresholds -->
