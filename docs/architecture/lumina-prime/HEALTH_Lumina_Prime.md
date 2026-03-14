# HEALTH: architecture/lumina-prime — Runtime Verification

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## WHEN TO USE HEALTH (NOT TESTS)

Health checks verify runtime behavior that tests cannot catch:

| Use Health For | Why |
|----------------|-----|
| Cognitive transparency across all node types | Needs real graph with diverse node types, not mocked singles |
| Energy conservation over extended sessions | Needs 1000+ ticks with real propagation, not isolated fixtures |
| Privacy compliance under real usage | Needs real network traffic monitoring, not code inspection |
| Selection Moat consistency at scale | Needs 500+ nodes competing for WM, not small test sets |

**Tests gate completion. Health monitors runtime.**

---

## PURPOSE OF THIS FILE

This HEALTH file covers Lumina Prime — the procedural visualization engine that gives the cognitive graph a visible body. Every physics dimension becomes light, geometry, color, and motion through pure mathematical functions with zero external assets.

It exists to protect against the failure modes that make Lumina Prime a lie instead of a lens: blind spots where physics changes produce no visual response, energy inflation from conservation violations, external assets that break the computed-from-physics contract, and privacy leaks of cognitive graph data.

This file does not verify physics law computation (covered by engine HEALTH), 3D pipeline coupling (covered by pipeline HEALTH), or motor control fidelity (covered by motor-control HEALTH).

---

## WHY THIS PATTERN

Tests can verify that a specific energy value produces the correct luminance in a shader. But they cannot verify that across all 7 node types, across all 21 physics laws, every dimension change produces a visible response in the running system. They cannot verify that over a 30-minute session, energy conservation holds under real graph propagation. They cannot verify that no network call leaks graph data under real usage conditions.

Docking-based checks at `dock_graph_sample`, `dock_interpolated_dims`, and `dock_shader_uniforms` allow verification at the sampling, interpolation, and GPU boundaries without modifying the rendering pipeline. Throttling ensures checks run during idle time, not during frame rendering.

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Lumina_Prime.md
PATTERNS:        ./PATTERNS_Lumina_Prime.md
BEHAVIORS:       ./BEHAVIORS_Lumina_Prime.md
ALGORITHM:       ./ALGORITHM_Lumina_Prime.md
VALIDATION:      ./VALIDATION_Lumina_Prime.md
IMPLEMENTATION:  ./IMPLEMENTATION_Lumina_Prime.md
THIS:            HEALTH_Lumina_Prime.md (you are here)
SYNC:            ./SYNC_Lumina_Prime.md
```

---

## IMPLEMENTS

This HEALTH file is a **spec**. The actual code lives in runtime:

```yaml
implements:
  runtime: engine/lumina-prime/__checks__/health.ts  # TODO — does not exist yet
  decorator: @check
```

> **Separation:** HEALTH.md defines WHAT to check and WHEN to trigger. Runtime code defines HOW to check.

> **Contract:** HEALTH checks verify input/output against VALIDATION with minimal or no code changes. After changes: update runtime or add TODO to SYNC. Run HEALTH checks at throttled rates.

---

## FLOWS ANALYSIS (TRIGGERS + FREQUENCY)

```yaml
flows_analysis:
  - flow_id: tick_to_frame
    purpose: Primary rendering pipeline — if this flow fails, the cognitive graph is invisible
    triggers:
      - type: event
        source: engine/lumina-prime/graph/sampler.ts:sampleVisibleRegion()
        notes: Physics tick completion triggers graph re-sampling
    frequency:
      expected_rate: 1/5min (one tick per physics interval)
      peak_rate: 1/1min (reduced interval for testing)
      burst_behavior: single sample per tick — no bursting
    risks:
      - V1 dimension change produces no visual change (cognitive transparency)
      - V4 energy conservation violated during propagation
      - V8 Selection Moat inconsistency at scale
    notes: This flow is the entire reason Lumina Prime exists

  - flow_id: token_to_limbic
    purpose: Economic events modulate visual environment — if this flow fails, economy is invisible
    triggers:
      - type: external
        source: engine/lumina-prime/limbic/economy.ts:onTokenTransfer()
        notes: Solana WebSocket delivers $MIND transfer events
    frequency:
      expected_rate: variable (depends on token activity)
      peak_rate: unknown (Solana burst capacity)
      burst_behavior: queue for next tick — do not process inline
    risks:
      - V10 economic formula divergence from canonical spec
    notes: External trigger with variable frequency
```

---

## HEALTH INDICATORS SELECTED

## OBJECTIVES COVERAGE

| Objective | Indicators | Why These Signals Matter |
|-----------|------------|--------------------------|
| Cognitive transparency | cognitive_visibility | If any dimension change is invisible, the manifestation has a blind spot |
| Physics fidelity | physics_law_coverage | If a law executes without visual consequence, the user sees fiction |
| Procedural purity | zero_external_assets | Any external asset breaks the computed-from-physics contract |
| Energy conservation | energy_conservation | Inflation or deflation makes the visual environment incoherent |
| Privacy | graph_privacy | Cognitive graph data leaking beyond local environment is an absolute violation |

```yaml
health_indicators:
  - name: cognitive_visibility
    flow_id: tick_to_frame
    priority: high
    rationale: Blind spots in the manifestation mean the mind has silent tumors — invisible to the observer

  - name: zero_external_assets
    flow_id: tick_to_frame
    priority: high
    rationale: Any external asset is a constant that cannot change with graph state — it lies

  - name: energy_conservation
    flow_id: tick_to_frame
    priority: high
    rationale: Inflation makes everything bright without cause; deflation makes the mind go dark

  - name: graph_privacy
    flow_id: tick_to_frame
    priority: high
    rationale: Cognitive graph is the most intimate data — any leak is an absolute violation of trust

  - name: selection_moat_consistency
    flow_id: tick_to_frame
    priority: med
    rationale: Nodes in WM visual space that should not be there (or absent when they should be) break attention model
```

---

## STATUS (RESULT INDICATOR)

```yaml
status:
  stream_destination: .mind/state/health/lumina_prime.json
  result:
    representation: enum
    value: UNKNOWN
    updated_at: 2026-03-14T00:00:00Z
    source: cognitive_visibility
```

---

## CHECKER INDEX

```yaml
checkers:
  - name: cognitive_visibility
    purpose: Verify every physics dimension change produces a detectable visual change within 1 frame (V1)
    status: pending
    priority: high
  - name: zero_external_assets
    purpose: Verify no .glb, .obj, .fbx, .png, .jpg, .hdr, .mp4 files are loaded by the render pipeline (V3)
    status: pending
    priority: high
  - name: energy_conservation
    purpose: Verify total system energy changes only through injection, decay, and absorption (V4)
    status: pending
    priority: high
  - name: graph_privacy
    purpose: Verify no graph data (node IDs, dimensions, link weights, topology) is transmitted to external services (V5)
    status: pending
    priority: high
  - name: selection_moat_consistency
    purpose: Verify WM visual space contains only nodes exceeding Theta_sel, and all such nodes are present (V8)
    status: pending
    priority: med
```

---

## INDICATOR: cognitive_visibility

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: cognitive_visibility
  client_value: Every physics change is visible — no silent cognitive events, full diagnostic transparency
  validation:
    - validation_id: V1
      criteria: Every physics dimension change on any visible node produces a detectable visual change within 1 render frame (16ms at 60fps)
    - validation_id: V2
      criteria: Each of the 21 physics laws has at least one traceable visual consequence
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - float_0_1
  semantics:
    float_0_1: Ratio of dimension changes that produced a detected visual change within 1 frame, over a sampling window. 1.0 = all changes were visible. 0.0 = no changes were visible.
  aggregation:
    method: ratio across sampled dimension changes
    display: float_0_1 with per-dimension breakdown available
```

### DOCKS SELECTED

```yaml
docks:
  - point: dock_graph_sample
    type: db
    payload: previous and current PhysicsDimensions per node
  - point: dock_shader_uniforms
    type: custom
    payload: uniform values before and after dimension change
```

### SIGNALS

```yaml
signals:
  healthy: >95% of dimension changes produced detectable visual change
  degraded: 80-95% — some dimension/type combinations have blind spots
  critical: <80% — major portions of cognitive state are invisible
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: physics tick completion
  max_frequency: 1/5min
  burst_limit: 1
  backoff: double interval on repeated healthy (reduces overhead when stable)
```

---

## INDICATOR: zero_external_assets

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: zero_external_assets
  client_value: Every visual element is a function of physics state — nothing is decoration
  validation:
    - validation_id: V3
      criteria: No external 3D model, texture, image, or pre-baked animation file loaded by the render pipeline
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - binary
  semantics:
    binary: 1 = zero external asset files loaded. 0 = at least one external asset detected.
  aggregation:
    method: AND
    display: binary pass/fail
```

### DOCKS SELECTED

```yaml
docks:
  - point: dock_graph_sample
    type: db
    payload: list of loaded resources (textures, geometries, models) from Three.js ResourceTracker
```

### SIGNALS

```yaml
signals:
  healthy: Zero external asset files loaded — all geometry and materials are procedural
  degraded: N/A — external assets are binary (present or not)
  critical: Any .glb, .obj, .fbx, .png, .jpg, .hdr, .mp4 loaded by the render pipeline
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: application startup + physics tick
  max_frequency: 1/30min
  burst_limit: 1
  backoff: stop checking after 10 consecutive healthy (re-enable on deploy)
```

---

## INDICATOR: energy_conservation

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: energy_conservation
  client_value: Visual brightness and activity levels reflect real cognitive activity — no phantom glow, no unexplained darkness
  validation:
    - validation_id: V4
      criteria: For every Law 2 propagation step, sum of energy entering targets + friction losses = surplus leaving source. Total system energy increases only through Law 1 injection.
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - float_0_1
  semantics:
    float_0_1: 1.0 = total energy delta matches expected (injection - decay - absorption) within epsilon. Score decreases with drift magnitude.
  aggregation:
    method: min across all tick intervals in sampling window
    display: float_0_1
```

### DOCKS SELECTED

```yaml
docks:
  - point: dock_graph_sample
    type: db
    payload: total system energy before and after tick, injection/decay/absorption totals
```

### SIGNALS

```yaml
signals:
  healthy: Energy delta matches expected within floating-point epsilon
  degraded: Drift detected but < 1% of total system energy per tick
  critical: Drift >= 1% of total system energy — visual layer is inflating or deflating
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

## INDICATOR: graph_privacy

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: graph_privacy
  client_value: Cognitive data never leaves the local environment — absolute trust in data sovereignty
  validation:
    - validation_id: V5
      criteria: No graph state (node IDs, dimensions, link weights, topology) transmitted to any external service, telemetry endpoint, or training pipeline
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - binary
  semantics:
    binary: 1 = no graph data detected in outbound network traffic. 0 = graph data detected in outbound traffic.
  aggregation:
    method: AND
    display: binary pass/fail
```

### DOCKS SELECTED

```yaml
docks:
  - point: dock_graph_sample
    type: db
    payload: network request log (URLs, payload sizes, content-type headers)
```

### SIGNALS

```yaml
signals:
  healthy: Zero outbound requests containing graph data
  degraded: N/A — privacy is binary
  critical: Any outbound request containing graph node IDs, dimension values, or topology
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: schedule
  max_frequency: 1/10min
  burst_limit: 1
  backoff: none — privacy violations must always be caught
```

---

## HOW TO RUN

```bash
# Run all health checks for this module
npx ts-node engine/lumina-prime/__checks__/health.ts --all

# Run a specific checker
npx ts-node engine/lumina-prime/__checks__/health.ts --check cognitive_visibility
```

---

## KNOWN GAPS

- V2 (physics law fidelity) needs enumeration of all 21 visual consequences before a checker can verify coverage — partially covered by cognitive_visibility
- V6 (JSON Spec authority) has no health checker — needs runtime validation that all capability checks resolve against the JSON Spec
- V7 (aspect independence) has no health checker — needs runtime verification that aspect failures do not cascade
- V9 (navigation follows topology) has no health checker — needs spline navigation to exist first
- V10 (economic invariants) has no health checker — needs Solana integration and limbic economy module to exist
- Measurable test for V1 "visual change within 1 frame" is undefined — needs pixel-level comparison or uniform delta detection strategy
- V5 privacy checker needs network traffic interception capability that may not exist in browser context

<!-- @mind:todo Enumerate 21 visual consequences (one per physics law) for V2 checker -->
<!-- @mind:todo Implement V6 JSON Spec authority checker when personhood module exists -->
<!-- @mind:todo Implement V9 navigation checker when spline navigation exists -->
<!-- @mind:todo Implement V10 economic formula checker when Solana integration exists -->
<!-- @mind:todo Design pixel-level or uniform-delta detection strategy for V1 checker -->
<!-- @mind:escalation V5 privacy checker in browser context — may need service worker or build-time analysis instead of runtime check -->

---

## MARKERS

<!-- @mind:todo Implement all pending checkers when Lumina Prime code exists (0% implemented) -->
<!-- @mind:proposition Build-time asset scanner as a simpler alternative to runtime zero_external_assets checker -->
<!-- @mind:escalation All checkers are pending — module is PROPOSED with 0% code -->
