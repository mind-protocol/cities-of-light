# HEALTH: architecture/motor-control — Runtime Verification

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## WHEN TO USE HEALTH (NOT TESTS)

Health checks verify runtime behavior that tests cannot catch:

| Use Health For | Why |
|----------------|-----|
| Energy drift over time | Needs 1000+ real ticks to detect floating-point accumulation |
| Frustration deadlock escape | Emergent from real graph topology, not fixture-friendly |
| Tick budget compliance | Wall-clock timing varies by hardware and graph size |
| Phantom impulse detection | Requires real decay curves on real node counts |

**Tests gate completion. Health monitors runtime.**

---

## PURPOSE OF THIS FILE

This HEALTH file covers the Active Inference Motor Control module — the closed-loop servo pipeline that transforms sensory input into motor commands through energy dynamics in the cognitive graph.

It exists to protect against the failure modes that make motor control dangerous at runtime: phantom movements from energy drift, deadlocked actions from frustration failure, perception blindness from suppressed collisions, and LLM contamination of the control loop.

This file does not verify physics law correctness (covered by engine HEALTH), narrative graph integrity (covered by serenissima HEALTH), or 3D rendering fidelity (covered by pipeline HEALTH).

---

## WHY THIS PATTERN

Tests can verify that `motor_tick()` produces correct output for a known input graph. But they cannot verify that after 10,000 ticks on a real citizen's motor subgraph, floating-point drift has not created phantom energy. They cannot verify that frustration bifurcation actually fires under real-world graph topologies. They cannot verify that tick timing stays under 16ms on production hardware with real visual encoder latency.

Docking-based checks at `dock_sensory_injection`, `dock_action_commands`, and `dock_bifurcation_event` allow verification of input/output relationships without modifying the motor tick pipeline. Throttling ensures health checks do not themselves violate the tick budget.

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Motor_Control.md
PATTERNS:        ./PATTERNS_Motor_Control.md
BEHAVIORS:       ./BEHAVIORS_Motor_Control.md
ALGORITHM:       ./ALGORITHM_Motor_Control.md
VALIDATION:      ./VALIDATION_Motor_Control.md
IMPLEMENTATION:  ./IMPLEMENTATION_Motor_Control.md
THIS:            HEALTH_Motor_Control.md (you are here)
SYNC:            ./SYNC_Motor_Control.md
```

---

## IMPLEMENTS

This HEALTH file is a **spec**. The actual code lives in runtime:

```yaml
implements:
  runtime: .mind/runtime/checks/motor_control_health.py  # TODO — does not exist yet
  decorator: @check
```

> **Separation:** HEALTH.md defines WHAT to check and WHEN to trigger. Runtime code defines HOW to check.

> **Contract:** HEALTH checks verify input/output against VALIDATION with minimal or no code changes. After changes: update runtime or add TODO to SYNC. Run HEALTH checks at throttled rates.

---

## FLOWS ANALYSIS (TRIGGERS + FREQUENCY)

```yaml
flows_analysis:
  - flow_id: motor_servo_cycle
    purpose: Closed-loop motor control — if this flow fails, the citizen produces no movement or phantom movement
    triggers:
      - type: schedule
        source: .mind/runtime/physics/motor_control.py:motor_tick()
        notes: Fast Tick scheduler fires every <16ms
    frequency:
      expected_rate: 60/sec
      peak_rate: 60/sec
      burst_behavior: tick is sequential — if one tick overruns, next waits
    risks:
      - V1 energy drift over extended tick runs
      - V5 tick budget exceeded on complex motor subgraphs
      - V6 phantom impulses from numerical accumulation at rest
    notes: All motor state changes flow through this single loop

  - flow_id: frustration_bifurcation
    purpose: Deadlock escape — if this flow fails, citizens push walls forever
    triggers:
      - type: event
        source: .mind/runtime/physics/frustration.py:frustration_tick()
        notes: Called within motor_tick() after coherence calculation
    frequency:
      expected_rate: 60/sec (checked every tick, fires rarely)
      peak_rate: 60/sec
      burst_behavior: bifurcation events are rare — most ticks produce no output
    risks:
      - V4 frustration pathway suppressed by motor plan energy
    notes: Bifurcation is the safety valve — must always be reachable
```

---

## HEALTH INDICATORS SELECTED

## OBJECTIVES COVERAGE

| Objective | Indicators | Why These Signals Matter |
|-----------|------------|--------------------------|
| No phantom movements | energy_conservation, rest_stillness | If energy drifts, citizens twitch without cause — visitor trust destroyed |
| World overrides plan | collision_priority | If collision signals are suppressed, citizens walk through walls |
| Real-time control | tick_budget | If ticks exceed 16ms, movement oscillates and diverges |
| Self-recovery | frustration_escape | If deadlocks persist, citizens appear frozen or crashed |
| LLM isolation | llm_isolation | If LLM enters the loop, cost explodes and latency kills control |

```yaml
health_indicators:
  - name: energy_conservation
    flow_id: motor_servo_cycle
    priority: high
    rationale: Phantom energy creates visible twitching — the most trust-destroying motor artifact

  - name: collision_priority
    flow_id: motor_servo_cycle
    priority: high
    rationale: Collision blindness means citizens walk through walls — breaks spatial believability

  - name: tick_budget
    flow_id: motor_servo_cycle
    priority: high
    rationale: Late corrections compound into oscillation — movement diverges above 16ms

  - name: frustration_escape
    flow_id: frustration_bifurcation
    priority: med
    rationale: Deadlocked citizens appear frozen — indistinguishable from a crash to visitors

  - name: llm_isolation
    flow_id: motor_servo_cycle
    priority: high
    rationale: LLM in the loop means 500ms+ latency per tick — control loop is unusable

  - name: rest_stillness
    flow_id: motor_servo_cycle
    priority: med
    rationale: Spontaneous movement at rest breaks visitor trust more than any other motor bug
```

---

## STATUS (RESULT INDICATOR)

```yaml
status:
  stream_destination: .mind/state/health/motor_control.json
  result:
    representation: enum
    value: UNKNOWN
    updated_at: 2026-03-14T00:00:00Z
    source: energy_conservation
```

---

## CHECKER INDEX

```yaml
checkers:
  - name: energy_conservation
    purpose: Verify total motor subgraph energy changes only through injection, decay, and firing (V1)
    status: pending
    priority: high
  - name: collision_priority
    purpose: Verify collision injection overrides active motor plans within 1 tick (V2)
    status: pending
    priority: high
  - name: tick_budget
    purpose: Verify motor_tick() completes in under 16ms wall-clock (V5)
    status: pending
    priority: high
  - name: frustration_escape
    purpose: Verify deadlocked plans eventually trigger bifurcation (V4)
    status: pending
    priority: med
  - name: llm_isolation
    purpose: Verify motor_tick() execution path contains zero LLM calls (V3)
    status: pending
    priority: high
  - name: rest_stillness
    purpose: Verify no action commands fire when no desire/injection/collision is active (V6)
    status: pending
    priority: med
```

---

## INDICATOR: energy_conservation

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: energy_conservation
  client_value: Citizens move only for reasons — no phantom twitching, no spontaneous gestures
  validation:
    - validation_id: V1
      criteria: Total energy across motor subgraph changes only through Law 1 injection, Law 3 decay, and Law 17 firing. Net gain from floating-point drift must not exceed 1e-6 per 1000 ticks.
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - float_0_1
  semantics:
    float_0_1: 1.0 = zero drift detected across sampling window. Score decreases proportionally to drift magnitude relative to 1e-6 threshold.
  aggregation:
    method: min across all sampled citizens
    display: float_0_1 surfaced in health dashboard
```

### DOCKS SELECTED

```yaml
docks:
  - point: dock_sensory_injection
    type: graph_ops
    payload: total motor subgraph energy before and after propagation step
  - point: dock_action_commands
    type: event
    payload: energy consumed by fired commands, total energy delta for tick
```

### ALGORITHM / CHECK MECHANISM

```python
@check(
    id="energy_conservation",
    triggers=[
        triggers.cron.every("5m"),
    ],
    on_problem="MOTOR_ENERGY_DRIFT",
    task="fix_motor_energy_conservation",
)
def energy_conservation(ctx) -> dict:
    """Check that motor subgraph energy is conserved across recent ticks."""
    # Compare total energy before/after propagation across last N ticks
    # Drift = |actual_delta - expected_delta| accumulated over window
    # expected_delta = injections - decay - firings
    if drift < 1e-6:
        return Signal.healthy()
    if drift < 1e-4:
        return Signal.degraded(details={"drift": drift, "ticks": n})
    return Signal.critical(details={"drift": drift, "ticks": n})
```

### SIGNALS

```yaml
signals:
  healthy: Accumulated drift < 1e-6 per 1000 ticks across all sampled citizens
  degraded: Accumulated drift between 1e-6 and 1e-4 — visible twitching unlikely but accumulating
  critical: Accumulated drift > 1e-4 — phantom movements likely observable
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: cron every 5 minutes
  max_frequency: 1/5min
  burst_limit: 1
  backoff: double interval on repeated degraded signals (max 30min)
```

### FORWARDINGS & DISPLAYS

```yaml
forwarding:
  targets:
    - location: .mind/state/health/motor_control.json
      transport: file
      notes: Persisted for Doctor to read
display:
  locations:
    - surface: Log
      location: server stdout
      signal: healthy/degraded/critical
      notes: Log level INFO for healthy, WARN for degraded, ERROR for critical
```

### MANUAL RUN

```yaml
manual_run:
  command: python -m mind.runtime.checks.motor_control_health --check energy_conservation
  notes: Run after changing propagation code or decay constants
```

---

## INDICATOR: collision_priority

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: collision_priority
  client_value: Citizens react to collisions immediately — hands retract, bodies flinch, walls stop movement
  validation:
    - validation_id: V2
      criteria: Collision injection energy (>=0.9) exceeds any single propagation flow by 3x. Collision-injected nodes enter WM within 1 tick. No motor action fires in the same tick as a collision on a connected node.
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - binary
  semantics:
    binary: 1 = all collision events in sample window produced WM entry within 1 tick and suppressed competing motor fires. 0 = at least one collision was ignored or delayed.
  aggregation:
    method: AND across all collision events in window
    display: binary surfaced as pass/fail
```

### DOCKS SELECTED

```yaml
docks:
  - point: dock_collision_injection
    type: event
    payload: collision magnitude, injection energy, tick number
  - point: dock_action_commands
    type: event
    payload: commands fired in same tick as collision
```

### SIGNALS

```yaml
signals:
  healthy: All collisions in window produced immediate WM entry and motor suppression
  degraded: N/A — collision priority is binary (works or does not)
  critical: Any collision event was ignored, delayed, or failed to suppress competing motor fire
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: collision event
  max_frequency: 1/min
  burst_limit: 5
  backoff: none — collision failures are always critical
```

---

## INDICATOR: tick_budget

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: tick_budget
  client_value: Smooth continuous movement — no jitter, no oscillation, no overshooting
  validation:
    - validation_id: V5
      criteria: motor_tick() completes in under 16ms wall-clock time. If visual encoding exceeds 10ms, system falls back to symbolic coherence.
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - float_0_1
  semantics:
    float_0_1: 1.0 = p99 tick duration is under 8ms (50% headroom). 0.0 = p99 exceeds 16ms. Linear interpolation between 8ms and 16ms.
  aggregation:
    method: rolling p99 over last 1000 ticks
    display: float_0_1 with p99 duration in tooltip
```

### DOCKS SELECTED

```yaml
docks:
  - point: dock_sensory_injection
    type: graph_ops
    payload: tick start timestamp
  - point: dock_action_commands
    type: event
    payload: tick end timestamp
```

### SIGNALS

```yaml
signals:
  healthy: p99 tick duration < 12ms
  degraded: p99 tick duration 12ms-16ms — nearing budget limit
  critical: p99 tick duration > 16ms — control loop is unstable
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: cron every 1 minute
  max_frequency: 1/min
  burst_limit: 1
  backoff: none — timing data is cheap to collect
```

---

## HOW TO RUN

```bash
# Run all health checks for this module
python -m mind.runtime.checks.motor_control_health

# Run a specific checker
python -m mind.runtime.checks.motor_control_health --check energy_conservation
```

---

## KNOWN GAPS

- V4 frustration escape checker is pending — needs real graph topology to test bifurcation reachability
- V6 rest stillness checker is pending — needs extended idle periods under real decay curves
- V7 consolidation integrity is not covered by any health checker — may need a separate consolidation health indicator
- Exact numerical thresholds for V1 floating-point tolerance (1e-6 per 1000 ticks) need hardware validation
- V5 tick budget assumes Quest 3 compute — benchmarks on actual hardware needed to validate 16ms target
- V2 collision magnitude (0.9) and 3x propagation ratio need calibration against realistic motor subgraph energy levels

<!-- @mind:todo Implement energy_conservation checker when motor_control.py exists -->
<!-- @mind:todo Implement collision_priority checker when collision-feedback.js exists -->
<!-- @mind:todo Implement tick_budget checker when Fast Tick scheduler is running -->
<!-- @mind:todo Add V7 consolidation integrity health indicator -->
<!-- @mind:escalation V5 tick budget needs real Quest 3 benchmarks before thresholds are meaningful -->

---

## MARKERS

<!-- @mind:todo Implement all pending checkers when motor control code exists -->
<!-- @mind:proposition Add a visual encoder latency sub-indicator to tick_budget -->
<!-- @mind:escalation All checkers are pending — module is PROPOSED with 0% code -->
