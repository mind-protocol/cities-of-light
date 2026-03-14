# HEALTH: architecture/serenissima — Runtime Verification

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## WHEN TO USE HEALTH (NOT TESTS)

Health checks verify runtime behavior that tests cannot catch:

| Use Health For | Why |
|----------------|-----|
| Energy conservation across 200 citizens | Needs real graph topology with real edge weights, not fixtures |
| Tick isolation under real load | Needs production call patterns to detect accidental LLM imports |
| Subconscious continuity during outages | Needs real API budget exhaustion scenarios, not mocked budget |
| Cognitive sovereignty over conversation history | Needs real LLM provider interactions across multiple turns |

**Tests gate completion. Health monitors runtime.**

---

## PURPOSE OF THIS FILE

This HEALTH file covers the Serenissima Asset Pipeline — the system that runs the cognitive physics tick for 200+ AI citizens, manages consciousness levels, routes conversations through the bi-channel architecture, and maintains cognitive sovereignty through the graph.

It exists to protect against the failure modes that turn a living city into a theme park: hardcoded rules that bypass physics, LLM calls that stall the tick, energy inflation or deflation from conservation violations, and citizens whose identities live in prompt caches instead of the graph.

This file does not verify 3D rendering (covered by pipeline HEALTH), motor control (covered by motor-control HEALTH), or procedural visualization (covered by lumina-prime HEALTH).

---

## WHY THIS PATTERN

Tests can verify that `propagateSurplus()` conserves energy for a hand-crafted 5-node graph. But they cannot verify conservation holds across 200 citizens with thousands of nodes and edges evolved over weeks of ticking. Tests can verify no LLM import exists in tick.js today, but they cannot detect a future accidental import added during a refactor. Tests can verify subconscious mode works with a mocked budget, but they cannot verify the city actually survives a real API outage.

Docking-based checks at `dock_graph_read`, `dock_graph_write`, and `dock_llm_call` allow verification at the critical boundaries (database, API, events) without modifying the tick pipeline. Throttling ensures health checks do not themselves slow the tick.

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Serenissima.md
PATTERNS:        ./PATTERNS_Serenissima.md
BEHAVIORS:       ./BEHAVIORS_Serenissima.md
ALGORITHM:       ./ALGORITHM_Serenissima.md
VALIDATION:      ./VALIDATION_Serenissima.md
IMPLEMENTATION:  ./IMPLEMENTATION_Serenissima.md
THIS:            HEALTH_Serenissima.md (you are here)
SYNC:            ./SYNC_Serenissima.md
```

---

## IMPLEMENTS

This HEALTH file is a **spec**. The actual code lives in runtime:

```yaml
implements:
  runtime: src/server/health/serenissima_health.js  # TODO — does not exist yet
  decorator: @check
```

> **Separation:** HEALTH.md defines WHAT to check and WHEN to trigger. Runtime code defines HOW to check.

> **Contract:** HEALTH checks verify input/output against VALIDATION with minimal or no code changes. After changes: update runtime or add TODO to SYNC. Run HEALTH checks at throttled rates.

---

## FLOWS ANALYSIS (TRIGGERS + FREQUENCY)

```yaml
flows_analysis:
  - flow_id: physics_tick_pipeline
    purpose: The heartbeat of the city — if this flow fails, all 200 citizens freeze
    triggers:
      - type: schedule
        source: src/server/physics-bridge.js:startPhysicsTick()
        notes: setInterval fires every 5 minutes (full) or 60 seconds (subconscious)
    frequency:
      expected_rate: 1/5min (full consciousness) or 1/1min (subconscious)
      peak_rate: 1/1min
      burst_behavior: one tick at a time — if tick overruns interval, next tick waits
    risks:
      - V2 accidental LLM call inside tick execution path
      - V3 energy conservation violated during surplus propagation
      - V1 hardcoded behavior bypass discovered in tick code
    notes: Physics bridge and tick.js exist — this is the most testable flow

  - flow_id: conversation_pipeline
    purpose: Visitor-to-citizen dialogue — if this flow fails, citizens cannot speak
    triggers:
      - type: event
        source: src/server/index.js:WebSocket handler
        notes: WebSocket message from client initiates conversation
    frequency:
      expected_rate: variable (depends on visitor activity)
      peak_rate: 10/min (multiple concurrent visitors)
      burst_behavior: each conversation is independent — no shared state between conversations
    risks:
      - V6 LLM output treated as ground truth instead of stimulus
      - V7 subconscious continuity broken when budget runs out mid-conversation
    notes: ai-citizens.js exists but wm-selector.js and llm-router.js are TO BUILD
```

---

## HEALTH INDICATORS SELECTED

## OBJECTIVES COVERAGE

| Objective | Indicators | Why These Signals Matter |
|-----------|------------|--------------------------|
| Physics priority | physics_priority | Hardcoded rules turn the city into a theme park — visitors feel the seam |
| Tick isolation | tick_isolation | LLM in the tick means 200 citizens freeze on every API hiccup |
| Energy conservation | energy_conservation | Inflation means constant crises; deflation means a dead city |
| Cognitive sovereignty | cognitive_sovereignty | Citizens whose identity lives in prompt caches are amnesiacs between conversations |
| Subconscious continuity | subconscious_continuity | A city that dies on API outage is not a living world |

```yaml
health_indicators:
  - name: physics_priority
    flow_id: physics_tick_pipeline
    priority: high
    rationale: Any hardcoded rule that bypasses physics creates a seam the visitor will feel

  - name: tick_isolation
    flow_id: physics_tick_pipeline
    priority: high
    rationale: One LLM call in the tick blocks 200 citizens for 200ms-2s and costs tokens at tick frequency

  - name: energy_conservation
    flow_id: physics_tick_pipeline
    priority: high
    rationale: Energy inflation cascades into moment flip storms; deflation converges all nodes to zero

  - name: cognitive_sovereignty
    flow_id: conversation_pipeline
    priority: high
    rationale: If LLM output overwrites graph state, citizens lose identity across LLM provider changes

  - name: subconscious_continuity
    flow_id: physics_tick_pipeline
    priority: med
    rationale: API outages are inevitable — the city must survive them without losing time
```

---

## STATUS (RESULT INDICATOR)

```yaml
status:
  stream_destination: .mind/state/health/serenissima.json
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
  - name: physics_priority
    purpose: Verify no code path produces citizen behavior without passing through physics tick (V1)
    status: pending
    priority: high
  - name: tick_isolation
    purpose: Verify tick execution path contains zero LLM calls, network requests, or unbounded I/O (V2)
    status: pending
    priority: high
  - name: energy_conservation
    purpose: Verify total energy delta per tick matches generation - decay - absorption within epsilon (V3)
    status: pending
    priority: high
  - name: cognitive_sovereignty
    purpose: Verify LLM output is processed as stimulus into graph, never written directly as state (V6)
    status: pending
    priority: high
  - name: subconscious_continuity
    purpose: Verify tick continues running and moment nodes are created at API budget = 0 (V7)
    status: pending
    priority: med
```

---

## INDICATOR: tick_isolation

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: tick_isolation
  client_value: The city's heartbeat never skips — 200 citizens tick reliably regardless of external API state
  validation:
    - validation_id: V2
      criteria: Physics tick runs pure graph math only. No external API calls, no network requests, no file I/O beyond graph persistence inside the tick execution path.
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - binary
  semantics:
    binary: 1 = tick execution path contains zero LLM calls, zero network requests (beyond FalkorDB), zero unbounded I/O. 0 = any violation detected.
  aggregation:
    method: AND across all tick executions in sampling window
    display: binary pass/fail
```

### DOCKS SELECTED

```yaml
docks:
  - point: dock_graph_read
    type: db
    payload: tick start timestamp, modules loaded in tick context
  - point: dock_graph_write
    type: db
    payload: tick end timestamp, any outbound network calls logged during tick
```

### ALGORITHM / CHECK MECHANISM

```python
@check(
    id="tick_isolation",
    triggers=[
        triggers.cron.every("10m"),
    ],
    on_problem="SERENISSIMA_TICK_LLM_CONTAMINATION",
    task="fix_tick_isolation",
)
def tick_isolation(ctx) -> dict:
    """Check that physics tick contains no LLM or external API calls."""
    # Inspect module imports in tick execution path
    # Monitor outbound network calls during tick window
    # Check for @anthropic-ai/sdk, openai, or fetch calls in tick.js dependency tree
    if no_external_calls:
        return Signal.healthy()
    return Signal.critical(details={"calls_detected": calls})
```

### SIGNALS

```yaml
signals:
  healthy: Zero external API calls detected in tick execution path
  degraded: N/A — tick isolation is binary
  critical: Any LLM call, network request, or unbounded I/O detected in tick
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: physics tick completion
  max_frequency: 1/10min
  burst_limit: 1
  backoff: none — isolation violations are always critical
```

---

## INDICATOR: energy_conservation

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: energy_conservation
  client_value: The city stays in the narrow band between chaos and stasis — no inflation storms, no deflation deaths
  validation:
    - validation_id: V3
      criteria: During surplus propagation, sum(flow_ij for all j) = surplus_i exactly. Total system energy changes only through generation, decay, and moment flip absorption.
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - float_0_1
  semantics:
    float_0_1: 1.0 = energy delta matches expected within floating-point epsilon across all citizens. Score decreases with total drift magnitude.
  aggregation:
    method: min across all citizen ticks in sampling window
    display: float_0_1
```

### DOCKS SELECTED

```yaml
docks:
  - point: dock_graph_read
    type: db
    payload: total energy across all citizen subgraphs before tick
  - point: dock_graph_write
    type: db
    payload: total energy after tick, generation/decay/absorption deltas
```

### SIGNALS

```yaml
signals:
  healthy: Per-tick drift < floating-point epsilon for all citizens
  degraded: Drift detected but < 0.1% of total energy — not yet visible
  critical: Drift >= 0.1% of total energy — inflation or deflation observable
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: physics tick completion
  max_frequency: 1/5min
  burst_limit: 1
  backoff: none — conservation is always critical
```

---

## INDICATOR: cognitive_sovereignty

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: cognitive_sovereignty
  client_value: Citizens maintain identity across LLM provider changes and API outages — they are the graph, not the prompt
  validation:
    - validation_id: V6
      criteria: All citizen state is stored in FalkorDB graph. LLM receives only WM coalition (5-7 nodes) plus stimulus. LLM output processed as new stimulus, never written directly as state.
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - binary
  semantics:
    binary: 1 = all LLM responses in sampling window were processed as moment nodes (stimulus), not direct state writes. 0 = any LLM output written directly to citizen state properties.
  aggregation:
    method: AND across all conversations in sampling window
    display: binary pass/fail
```

### DOCKS SELECTED

```yaml
docks:
  - point: dock_response_writeback
    type: db
    payload: graph mutation type (CREATE moment node vs SET on citizen properties)
  - point: dock_wm_output
    type: custom
    payload: WM coalition size, node types included
```

### SIGNALS

```yaml
signals:
  healthy: All LLM responses created moment nodes — no direct state writes
  degraded: N/A — sovereignty is binary
  critical: Any LLM response written directly to citizen properties (bypassing moment creation)
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: conversation completion
  max_frequency: 1/min
  burst_limit: 10
  backoff: none — sovereignty violations must always be caught
```

---

## INDICATOR: subconscious_continuity

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: subconscious_continuity
  client_value: Visitors arriving during an API outage find a quiet city, not a dead one
  validation:
    - validation_id: V7
      criteria: At API budget = 0, physics tick continues. Law 17 action nodes fire spontaneously. Visitor interactions are recorded as moment nodes even without LLM.
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - binary
  semantics:
    binary: 1 = tick ran successfully during zero-budget window and moment nodes were created from visitor interactions. 0 = tick skipped or interactions lost.
  aggregation:
    method: AND across all zero-budget windows in sampling period
    display: binary pass/fail
```

### DOCKS SELECTED

```yaml
docks:
  - point: dock_graph_write
    type: db
    payload: tick success flag, moment node creation count during zero-budget period
  - point: dock_event_emit
    type: event
    payload: tick_complete events during zero-budget period
```

### SIGNALS

```yaml
signals:
  healthy: Ticks continued and interactions were recorded during zero-budget period
  degraded: N/A — continuity is binary (ticks either run or they do not)
  critical: Any tick skipped or interaction lost due to zero API budget
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: budget state change (budget reaches 0 or returns from 0)
  max_frequency: 1/hour
  burst_limit: 1
  backoff: none — outage windows are rare and must always be verified
```

---

## HOW TO RUN

```bash
# Run all health checks for this module
node src/server/health/serenissima_health.js --all

# Run a specific checker
node src/server/health/serenissima_health.js --check energy_conservation
```

---

## KNOWN GAPS

- V1 (physics priority) checker needs static analysis of code paths — runtime detection of hardcoded rules is difficult. May need a lint rule instead.
- V4 (aspect independence) has no health checker — needs runtime verification that 14 capability aspects are computed independently
- V5 (JSON Spec authority) has no health checker — needs runtime diff between spec constants and code constants
- Tick isolation checker currently proposes module inspection, but a more robust approach would be network-level monitoring during tick execution
- Cognitive sovereignty checker cannot verify full round-trip until wm-selector.js and llm-router.js exist
- Subconscious continuity checker needs a real zero-budget scenario to test — cannot be verified with mocked budgets

<!-- @mind:todo Implement tick_isolation checker — physics tick code exists in .mind/runtime/physics/ -->
<!-- @mind:todo Implement energy_conservation checker — surplus.js exists -->
<!-- @mind:todo Create tick isolation lint rule — flag LLM client imports inside physics tick code -->
<!-- @mind:todo Implement cognitive_sovereignty checker when wm-selector.js and processLLMResponse() are built -->
<!-- @mind:todo Add V4 aspect independence checker -->
<!-- @mind:todo Add V5 JSON Spec authority checker — compare spec file constants with code constants -->
<!-- @mind:escalation How to test cognitive sovereignty in practice — need scenario where LLM provider changes mid-conversation -->

---

## MARKERS

<!-- @mind:todo Implement tick_isolation and energy_conservation checkers first — existing code supports them -->
<!-- @mind:proposition Static analysis tool for V1 physics priority — scan for if/else patterns that reference citizen roles or situations -->
<!-- @mind:escalation ai-citizens.js approaching WATCH — sovereignty checker should wait for extraction to wm-selector.js -->
