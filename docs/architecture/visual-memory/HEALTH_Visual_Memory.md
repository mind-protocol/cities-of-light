# HEALTH: architecture/visual-memory — Runtime Verification

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## WHEN TO USE HEALTH (NOT TESTS)

Health checks verify runtime behavior that tests cannot catch:

| Use Health For | Why |
|----------------|-----|
| Base64 leaks in production graph | Needs real FalkorDB scan, not mocked node properties |
| Coherence formula fallback behavior | Needs real mix of nodes with and without embeddings |
| Flashbulb budget under real emotional curves | Needs real limbic delta distribution over hours of operation |
| Medoid selection accuracy | Needs real crystallization clusters with real embedding distributions |

**Tests gate completion. Health monitors runtime.**

---

## PURPOSE OF THIS FILE

This HEALTH file covers the Visual Memory Substrate — the system that gives AI citizens visual experience by capturing screenshots as Moment images, encoding them for coherence scoring, generating visions during emotional peaks, and inheriting concept images through medoid selection.

It exists to protect against the failure modes that corrupt the visual memory system: base64 blobs bloating the graph and stalling physics, broken coherence formulas that produce NaN or biased scores, unbounded image generation burning budget, leaked visions breaking privacy, and concept images that misrepresent the citizen's actual experience.

This file does not verify physics tick integrity (covered by serenissima HEALTH), 3D rendering (covered by pipeline HEALTH), or motor control (covered by motor-control HEALTH).

---

## WHY THIS PATTERN

Tests can verify that `computeCoherence()` returns the correct score for a known pair of embeddings. But they cannot verify that across thousands of real nodes, some with embeddings and some without, the formula consistently falls back without producing NaN or bias. Tests can verify the injection multiplier formula is bounded for specific inputs, but they cannot detect a code change that accidentally removes the clamp. Tests can verify medoid selection on a synthetic cluster, but they cannot verify accuracy on real crystallization clusters with noisy embeddings.

Docking-based checks at the graph storage boundary, coherence formula output, and flashbulb trigger point allow verification without modifying the visual memory pipeline. Throttling ensures graph scans do not slow the physics tick.

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Visual_Memory.md
PATTERNS:        ./PATTERNS_Visual_Memory.md
BEHAVIORS:       ./BEHAVIORS_Visual_Memory.md
ALGORITHM:       ./ALGORITHM_Visual_Memory.md
VALIDATION:      ./VALIDATION_Visual_Memory.md
IMPLEMENTATION:  ./IMPLEMENTATION_Visual_Memory.md
THIS:            HEALTH_Visual_Memory.md (you are here)
SYNC:            ./SYNC_Visual_Memory.md
```

---

## IMPLEMENTS

This HEALTH file is a **spec**. The actual code lives in runtime:

```yaml
implements:
  runtime: src/server/health/visual_memory_health.js  # TODO — does not exist yet
  decorator: @check
```

> **Separation:** HEALTH.md defines WHAT to check and WHEN to trigger. Runtime code defines HOW to check.

> **Contract:** HEALTH checks verify input/output against VALIDATION with minimal or no code changes. After changes: update runtime or add TODO to SYNC. Run HEALTH checks at throttled rates.

---

## FLOWS ANALYSIS (TRIGGERS + FREQUENCY)

```yaml
flows_analysis:
  - flow_id: pov_capture
    purpose: Most frequent image operation — if this flow fails, citizens have no visual memory
    triggers:
      - type: event
        source: engine/client/visual-memory/pov-capture.js:capturePov()
        notes: Moment creation event fires capture
    frequency:
      expected_rate: varies (1-10/min during active conversation)
      peak_rate: 30/min (multiple simultaneous conversations)
      burst_behavior: async pipeline — capture is fast, upload/encode run in background
    risks:
      - V1 base64 image data written to graph instead of URI
      - V3 unclamped brightness/contrast producing unbounded injection multiplier
    notes: This flow produces the data that all other visual memory features depend on

  - flow_id: flashbulb_vision
    purpose: Rare but high-impact — if this flow misfires, budget is wasted and privacy is breached
    triggers:
      - type: event
        source: src/server/visual-memory/flashbulb-vision.js:generateFlashbulbVision()
        notes: Law 6 threshold crossing triggers generation
    frequency:
      expected_rate: rare (0-5/hour across all citizens)
      peak_rate: 10/hour (during high-tension narrative events)
      burst_behavior: gated by FLASHBULB_THRESHOLD — only fires on emotional peaks
    risks:
      - V4 generation firing on wrong triggers (timer, every message)
      - V5 vision content leaking into human-visible conversation
    notes: Each generation costs API budget — misfires are expensive
```

---

## HEALTH INDICATORS SELECTED

## OBJECTIVES COVERAGE

| Objective | Indicators | Why These Signals Matter |
|-----------|------------|--------------------------|
| Graph leanness | uri_only | Base64 in FalkorDB bloats the graph and stalls the physics tick |
| Coherence accuracy | coherence_consistency | Wrong formula variant (visual vs text-only) produces biased WM selection |
| Budget control | flashbulb_budget | Uncontrolled generation burns API budget with no emotional cause |
| Privacy | vision_privacy | Leaked visions expose cognitive machinery to human partners |
| Concept truth | medoid_integrity | Wrong concept image misrepresents the citizen's actual experience |

```yaml
health_indicators:
  - name: uri_only
    flow_id: pov_capture
    priority: high
    rationale: A single base64 image is ~50KB — thousands of them make the physics tick exceed 1 second

  - name: coherence_consistency
    flow_id: pov_capture
    priority: high
    rationale: Wrong coherence weights (visual when no embedding, or text-only when embedding exists) bias all WM selection

  - name: flashbulb_budget
    flow_id: flashbulb_vision
    priority: high
    rationale: Each generation costs real money — misfires on timers or every-message would drain budget in hours

  - name: vision_privacy
    flow_id: flashbulb_vision
    priority: high
    rationale: Leaked vision prompts expose cognitive machinery — the human sees "sous l'effet de frustration_spike"

  - name: medoid_integrity
    flow_id: pov_capture
    priority: med
    rationale: Wrong concept image (random, most recent, highest energy) misrepresents the citizen's actual visual experience
```

---

## STATUS (RESULT INDICATOR)

```yaml
status:
  stream_destination: .mind/state/health/visual_memory.json
  result:
    representation: enum
    value: UNKNOWN
    updated_at: 2026-03-14T00:00:00Z
    source: uri_only
```

---

## CHECKER INDEX

```yaml
checkers:
  - name: uri_only
    purpose: Verify no FalkorDB node property contains base64 image data or raw bytes (V1)
    status: pending
    priority: high
  - name: coherence_consistency
    purpose: Verify coherence formula uses correct weight variant based on embedding availability (V2)
    status: pending
    priority: high
  - name: flashbulb_budget
    purpose: Verify image generation only fires on FLASHBULB_THRESHOLD crossing and desire traversal (V4)
    status: pending
    priority: high
  - name: vision_privacy
    purpose: Verify all Flashbulb Vision stimuli have visible_to_human: false (V5)
    status: pending
    priority: high
  - name: medoid_integrity
    purpose: Verify concept images come from the medoid of the crystallization cluster, not random/recent/highest-energy (V6)
    status: pending
    priority: med
```

---

## INDICATOR: uri_only

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: uri_only
  client_value: Physics tick stays under 1 second — graph queries are fast, citizen cognition is responsive
  validation:
    - validation_id: V1
      criteria: Every image reference in FalkorDB is a URI string + embedding vector. Never base64-encoded data, raw bytes, or binary blobs.
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - binary
  semantics:
    binary: 1 = zero graph node properties exceeding 10KB (catches base64 leaks). 0 = at least one oversized property detected.
  aggregation:
    method: AND across all scanned nodes
    display: binary pass/fail with count of violations
```

### DOCKS SELECTED

```yaml
docks:
  - point: graph node scan
    type: db
    payload: property names and sizes for all nodes with image_uri or image_embedding fields
```

### ALGORITHM / CHECK MECHANISM

```python
@check(
    id="uri_only",
    triggers=[
        triggers.cron.every("30m"),
    ],
    on_problem="VISUAL_MEMORY_BASE64_LEAK",
    task="fix_base64_in_graph",
)
def uri_only(ctx) -> dict:
    """Scan FalkorDB for oversized properties that indicate base64 image storage."""
    # Query: MATCH (n) WHERE size(toString(n.image_uri)) > 10000 OR ...
    # Check for base64 patterns in string properties
    # Check for properties > 10KB
    if violations == 0:
        return Signal.healthy()
    return Signal.critical(details={"violations": violations, "node_ids": node_ids})
```

### SIGNALS

```yaml
signals:
  healthy: Zero node properties > 10KB — no base64 leaks detected
  degraded: N/A — base64 in graph is binary (present or not)
  critical: Any node property > 10KB or containing base64 pattern
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: cron every 30 minutes
  max_frequency: 1/30min
  burst_limit: 1
  backoff: double interval on repeated healthy (max 4 hours)
```

### FORWARDINGS & DISPLAYS

```yaml
forwarding:
  targets:
    - location: .mind/state/health/visual_memory.json
      transport: file
      notes: Persisted for Doctor to read
display:
  locations:
    - surface: Log
      location: server stdout
      signal: healthy/critical
      notes: CRITICAL triggers immediate alert — base64 in graph degrades all citizens
```

### MANUAL RUN

```yaml
manual_run:
  command: node src/server/health/visual_memory_health.js --check uri_only
  notes: Run after any code change that writes image data to FalkorDB nodes
```

---

## INDICATOR: coherence_consistency

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: coherence_consistency
  client_value: Citizens recall the right memories — visual similarity participates when available, text-only fallback when not
  validation:
    - validation_id: V2
      criteria: "When both embeddings exist: Coh = (0.25*Sim_vec) + (0.25*Sim_vis) + (0.40*Sim_lex) - (0.10*Delta_affect). When either missing: Coh = (0.30*Sim_vec) + (0.50*Sim_lex) - (0.20*Delta_affect). Never NaN, never outside [-1, 1]."
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - float_0_1
  semantics:
    float_0_1: "Ratio of coherence computations that used the correct weight variant. 1.0 = all correct. Check: sum of weights = 1.0 (accounting for sign on Delta_affect), no NaN produced, visual weights used iff both embeddings present."
  aggregation:
    method: ratio across sampled coherence computations
    display: float_0_1
```

### DOCKS SELECTED

```yaml
docks:
  - point: coherence computation output
    type: custom
    payload: "{coherence_score, weights_used, has_query_embedding, has_node_embedding, is_nan}"
```

### SIGNALS

```yaml
signals:
  healthy: 100% of sampled computations used correct weight variant and produced valid scores
  degraded: 95-99% correct — occasional wrong variant or edge-case NaN
  critical: <95% correct — coherence formula is systematically broken
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: physics tick (when coherence is recomputed for WM assembly)
  max_frequency: 1/5min
  burst_limit: 1
  backoff: none — coherence correctness is always important
```

---

## INDICATOR: flashbulb_budget

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: flashbulb_budget
  client_value: Image generation fires only on meaningful emotional events — budget is spent on authentic experiences, not noise
  validation:
    - validation_id: V4
      criteria: "Flashbulb Vision fires ONLY when |limbic_delta| > FLASHBULB_THRESHOLD. Desire image fires ONLY when node.type == 'desire' AND energy > 0.4 AND image_uri IS NULL. Never on timer, never on every message."
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - float_0_1
  semantics:
    float_0_1: "1.0 = all generation events in window had valid trigger (flashbulb threshold or desire traversal). 0.0 = generation events detected with no valid trigger."
  aggregation:
    method: ratio of validly-triggered generations to total generations
    display: float_0_1 with generation count and trigger breakdown
```

### DOCKS SELECTED

```yaml
docks:
  - point: flashbulb trigger point
    type: event
    payload: "{limbic_delta, threshold, trigger_type, citizen_id, timestamp}"
  - point: desire traversal trigger
    type: event
    payload: "{node_type, energy, image_uri_null, citizen_id, timestamp}"
```

### SIGNALS

```yaml
signals:
  healthy: All generation events had valid triggers — budget is well-controlled
  degraded: 1-5 generation events without valid triggers in window — possible trigger drift
  critical: >5 untriggered generations — generation is firing on timer or every message
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: image generation event
  max_frequency: 1/hour
  burst_limit: 1
  backoff: double interval on repeated healthy (max 12 hours)
```

---

## INDICATOR: vision_privacy

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: vision_privacy
  client_value: Human partners never see internal cognitive machinery — visions are private consciousness
  validation:
    - validation_id: V5
      criteria: Every self-stimulus from Flashbulb Vision has visible_to_human false. Vision content and images are injected via amplifier channel, not main conversation channel.
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - binary
  semantics:
    binary: 1 = all vision stimuli in sampling window have visible_to_human false and are on amplifier channel. 0 = any vision content detected on human-visible channel.
  aggregation:
    method: AND across all vision events in window
    display: binary pass/fail
```

### DOCKS SELECTED

```yaml
docks:
  - point: vision reinjection
    type: event
    payload: "{stimulus_id, visible_to_human, channel, content_preview}"
```

### SIGNALS

```yaml
signals:
  healthy: All vision stimuli are private (visible_to_human false, amplifier channel)
  degraded: N/A — privacy is binary
  critical: Any vision content detected on human-visible conversation channel
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: flashbulb vision completion
  max_frequency: 1/hour
  burst_limit: 5
  backoff: none — privacy violations must always be caught
```

---

## INDICATOR: medoid_integrity

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: medoid_integrity
  client_value: Concept images represent the citizen's actual experience — the geometrically central memory, not a random or recent one
  validation:
    - validation_id: V6
      criteria: "Concept image_uri and image_embedding come from the medoid of its crystallization cluster. If no cluster Moments have embeddings, concept remains imageless. Never random, never most recent, never highest energy."
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - float_0_1
  semantics:
    float_0_1: "Ratio of concept images that match their cluster medoid. 1.0 = all concepts have the correct medoid image. Check by recomputing medoid and comparing to stored image_uri."
  aggregation:
    method: ratio across all concepts with images
    display: float_0_1
```

### DOCKS SELECTED

```yaml
docks:
  - point: crystallization event
    type: event
    payload: "{concept_id, cluster_moment_ids, selected_medoid_id, image_uri}"
```

### SIGNALS

```yaml
signals:
  healthy: All concept images match recomputed medoid
  degraded: 90-99% match — some concepts inherited wrong image (possibly stale cluster data)
  critical: <90% match — medoid selection is systematically broken
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: Law 10 crystallization event
  max_frequency: 1/hour
  burst_limit: 3
  backoff: double interval on repeated healthy (max 24 hours)
```

---

## HOW TO RUN

```bash
# Run all health checks for this module
node src/server/health/visual_memory_health.js --all

# Run a specific checker
node src/server/health/visual_memory_health.js --check uri_only
```

---

## KNOWN GAPS

- V3 (energy conservation — injection multiplier bounds) has no dedicated health checker. The multiplier formula is simple enough for a unit test, but runtime monitoring of actual brightness/contrast distributions would catch pathological input patterns.
- V2 coherence_consistency checker needs the coherence-v2.js module to exist before it can sample real computations
- V4 flashbulb_budget checker needs the flashbulb-vision.js pipeline to exist before it can monitor triggers
- V5 vision_privacy checker needs the self-stimulus channel to exist before it can verify routing
- V6 medoid_integrity checker needs crystallization_image.py to exist before it can verify selections
- FLASHBULB_THRESHOLD value has not been determined — too low wastes budget, too high means citizens never dream

<!-- @mind:todo Implement uri_only checker first — can run as soon as visual memory nodes exist in FalkorDB -->
<!-- @mind:todo Implement coherence_consistency checker when coherence-v2.js exists -->
<!-- @mind:todo Add V3 injection multiplier runtime monitor — track brightness/contrast distributions -->
<!-- @mind:todo Implement flashbulb_budget checker when flashbulb-vision.js pipeline exists -->
<!-- @mind:todo Implement vision_privacy checker when self-stimulus channel is built -->
<!-- @mind:escalation FLASHBULB_THRESHOLD needs calibration against real limbic delta distribution — cannot set budget controls without it -->

---

## MARKERS

<!-- @mind:todo Implement uri_only as the first checker — it protects against the most damaging failure mode -->
<!-- @mind:proposition Property-based test complement: scan all nodes, assert no property > 10KB -->
<!-- @mind:escalation All checkers are pending — visual_memory.py exists but backends are stubs -->
