# Living Places — Health: Verification Mechanics and Coverage

```
STATUS: CANONICAL
CREATED: 2026-03-13
UPDATED: 2026-03-13
```

---

## WHEN TO USE HEALTH (NOT TESTS)

Health checks verify runtime behavior that tests cannot catch:

| Use Health For | Why |
|----------------|-----|
| Presence drift over time | Ghost participants accumulate from network failures, not fixture inputs |
| Delivery latency under load | Real WebSocket fan-out with N participants, not mocked connections |
| Graph/memory consistency | In-memory room state vs graph AT links diverges under real traffic |
| Voice pipeline round-trip | STT + LLM + TTS latency depends on real API response times |

**Tests gate completion. Health monitors runtime.**

If behavior is deterministic with known inputs → write a test.
If behavior emerges from real data over time → write a health check.

See `VALIDATION_Living_Places.md` for the full invariant list.

---

## PURPOSE OF THIS FILE

This HEALTH file covers the Living Places communication substrate — real-time multi-participant rooms where AI citizens and humans communicate through Moments.

It exists because Living Places is a real-time system with external dependencies (Whisper, ElevenLabs, FalkorDB, WebSocket connections) where the primary failure modes are latency drift, presence inconsistency, and silent message loss — none of which are catchable by unit tests.

**Boundaries:** This file verifies the Place Server and Moment Pipeline. It does NOT verify:
- 3D rendering (cities-of-light engine HEALTH)
- AI response quality (AI partner's concern)
- Token economics of place access (economy module HEALTH)

---

## WHY THIS PATTERN

Tests verify "does this function return the right value?" Health verifies "is the live system behaving correctly over time?"

Living Places has three failure modes that only manifest at runtime:
1. **Presence drift** — connections drop, AT links linger, ghost participants accumulate
2. **Latency creep** — external APIs slow down, delivery exceeds 500ms threshold
3. **Persistence gaps** — Moments broadcast but never written to graph (async write failure)

Docking-based checks are the right tradeoff because they observe input/output at boundaries without modifying the pipeline code. Throttling matters because health checks that fire on every Moment would themselves degrade performance.

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Living_Places.md
PATTERNS:        ./PATTERNS_Living_Places.md
BEHAVIORS:       ./BEHAVIORS_Living_Places.md
ALGORITHM:       ./ALGORITHM_Living_Places.md
VALIDATION:      ./VALIDATION_Living_Places.md
IMPLEMENTATION:  ./IMPLEMENTATION_Living_Places.md
THIS:            HEALTH_Living_Places.md
SYNC:            ./SYNC_Living_Places.md

IMPL:            mind-mcp/.mind/capabilities/living-places/runtime/checks.py (7 checkers, implemented)
```

> **Contract:** HEALTH checks verify input/output against VALIDATION with minimal or no code changes. After changes: update IMPL or add TODO to SYNC. Run HEALTH checks at throttled rates.

---

## FLOWS ANALYSIS (TRIGGERS + FREQUENCY)

```yaml
flows_analysis:
  - flow_id: moment_delivery
    purpose: A Moment created by any participant reaches all other participants in the room
    triggers:
      - type: event
        source: src/server/moment-pipeline.js:handleInput
        notes: Triggered by PLACE_SPEAK WebSocket message from any participant
    frequency:
      expected_rate: 5-20/min per room
      peak_rate: 100/min per room (heated debate, 7+ participants)
      burst_behavior: All Moments queued and delivered in order; no backpressure mechanism in V1
    risks:
      - Silent message loss (I3 — Real-Time Delivery)
      - Graph write failure while broadcast succeeds (I5 — Persistence Integrity)
    notes: Cross-boundary flow — WebSocket input → graph write → WebSocket fan-out

  - flow_id: presence_lifecycle
    purpose: Participants join and leave rooms; AT links and in-memory state stay synchronized
    triggers:
      - type: event
        source: src/server/place-server.js:joinRoom, leaveRoom
        notes: Triggered by PLACE_JOIN/PLACE_LEAVE messages or WebSocket disconnect
    frequency:
      expected_rate: 1-5/min per room
      peak_rate: 20/min (meeting start/end bursts)
      burst_behavior: Sequential processing; capacity check prevents overload
    risks:
      - Ghost participants — AT link without connection (I4 — Presence Accuracy)
      - Phantom departures — connection without AT link (I4)
      - Capacity exceeded silently (I6 — Capacity Enforcement)
    notes: Dual-state system (graph + memory) creates consistency risk

  - flow_id: voice_round_trip
    purpose: Human speech becomes text Moment; AI Moment becomes audible speech
    triggers:
      - type: event
        source: src/server/voice.js:processVoiceStreaming
        notes: Triggered by PLACE_VOICE message with audio buffer
    frequency:
      expected_rate: 2-10/min per voice-active room
      peak_rate: 30/min (rapid voice exchange)
      burst_behavior: Sequential STT calls; TTS parallelized per recipient
    risks:
      - Latency exceeds 5s budget (I3)
      - Whisper/ElevenLabs unavailable (I9 — Graceful Degradation)
    notes: Depends on 3 external APIs (Whisper, LLM, ElevenLabs); each can fail independently

  - flow_id: presence_reconciliation
    purpose: Periodic check that graph AT links match in-memory WebSocket connections
    triggers:
      - type: schedule
        source: src/server/place-server.js:reconcilePresence
        notes: 30-second interval timer
    frequency:
      expected_rate: 2/min (fixed)
      peak_rate: 2/min (fixed)
      burst_behavior: N/A — fixed schedule
    risks:
      - Reconciliation itself fails silently
      - Prune removes valid connection (false positive)
    notes: This is itself a health mechanism; health checks verify it runs correctly
```

---

## HEALTH INDICATORS SELECTED

## OBJECTIVES COVERAGE

| Objective | Indicators | Why These Signals Matter |
|-----------|------------|--------------------------|
| S1: Real-time communication | delivery_latency, moment_loss_rate | If delivery is slow or lossy, conversation fails |
| S2: Mixed AI + human | bridge_connectivity | If MCP bridge drops, AI citizens go silent |
| S4: Spatial awareness | presence_accuracy | False presence breaks spatial trust |
| S6: Persistence | graph_persistence_integrity | Unpersisted conversations are lost knowledge |

```yaml
health_indicators:
  - name: delivery_latency
    flow_id: moment_delivery
    priority: high
    rationale: Delivery > 500ms for text makes conversation feel broken. Users leave.

  - name: moment_loss_rate
    flow_id: moment_delivery
    priority: high
    rationale: Silent message loss means participants see different conversations. Trust destroyed.

  - name: presence_accuracy
    flow_id: presence_lifecycle
    priority: high
    rationale: Ghost participants or phantom departures break the social contract of "who's here."

  - name: graph_persistence_integrity
    flow_id: moment_delivery
    priority: med
    rationale: Moments that broadcast but don't persist mean the conversation is ephemeral. AI memories depend on graph persistence.

  - name: voice_round_trip_latency
    flow_id: voice_round_trip
    priority: med
    rationale: Voice > 5s feels like talking to someone on Mars. Unusable for real conversation.

  - name: reconciliation_health
    flow_id: presence_reconciliation
    priority: med
    rationale: If reconciliation stops running, ghost participants accumulate silently.
```

---

## STATUS (RESULT INDICATOR)

```yaml
status:
  stream_destination: mind-mcp/.mind/capabilities/living-places/runtime/checks.py → Signal returns
  result:
    representation: enum
    value: UNKNOWN
    updated_at: 2026-03-13T00:00:00Z
    source: place_health_checker
```

---

## DOCK TYPES USED

- `event` — WebSocket message emission/reception (Moment broadcast, join/leave)
- `db` — FalkorDB graph writes (Moment nodes, AT links)
- `api` — External API calls (Whisper STT, ElevenLabs TTS)
- `stream` — WebSocket streaming I/O

---

## CHECKER INDEX

```yaml
checkers:
  - name: check_place_liveness
    purpose: Active places with no moments in 30min → flag as stale
    status: implemented
    priority: high
    location: mind-mcp/.mind/capabilities/living-places/runtime/checks.py
  - name: check_moment_persistence
    purpose: Verifies Moments have IN links to Space (graph integrity)
    status: implemented
    priority: high
    location: mind-mcp/.mind/capabilities/living-places/runtime/checks.py
  - name: check_presence_consistency
    purpose: Verifies AT links consistency for place nodes
    status: implemented
    priority: high
    location: mind-mcp/.mind/capabilities/living-places/runtime/checks.py
  - name: check_orphaned_utterances
    purpose: Moment nodes with no Space link
    status: implemented
    priority: high
    location: mind-mcp/.mind/capabilities/living-places/runtime/checks.py
  - name: check_voice_latency
    purpose: Verifies voice round-trip within budget
    status: implemented
    priority: med
    location: mind-mcp/.mind/capabilities/living-places/runtime/checks.py
  - name: check_reconciliation_health
    purpose: Verifies reconciliation mechanisms function
    status: implemented
    priority: med
    location: mind-mcp/.mind/capabilities/living-places/runtime/checks.py
  - name: check_capacity_enforcement
    purpose: Verifies room participant count never exceeds capacity
    status: implemented
    priority: med
    location: mind-mcp/.mind/capabilities/living-places/runtime/checks.py
```

---

## INDICATOR: Delivery Latency

Text Moments must reach all participants within 500ms. This is the core promise of real-time communication. If it degrades, conversation becomes asynchronous — which defeats the purpose.

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: delivery_latency
  client_value: Conversation feels real-time. Participants respond naturally without waiting.
  validation:
    - validation_id: I3
      criteria: Text Moments delivered to all participants within 500ms
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - float_0_1
    - enum
  semantics:
    float_0_1: p95 delivery time as fraction of 500ms budget (0.0 = instant, 1.0 = at limit, >1.0 = violated)
    enum: OK (p95 < 300ms), WARN (p95 300-500ms), ERROR (p95 > 500ms)
  aggregation:
    method: worst-case across all active rooms
    display: enum
```

### DOCKS SELECTED

```yaml
docks:
  input:
    id: moment_created_timestamp
    method: MomentPipeline.handleInput
    location: src/server/moment-pipeline.js
  output:
    id: moment_delivered_timestamp
    method: PlaceServer.broadcast → ws.send callback
    location: src/server/place-server.js
```

### ALGORITHM / CHECK MECHANISM

```yaml
mechanism:
  summary: Compare timestamp of Moment creation with timestamp of WebSocket send completion for furthest participant
  steps:
    - Record Moment creation timestamp in handleInput
    - Record ws.send callback timestamp for each participant
    - Compute max(delivery_time) across all participants
    - Compare against 500ms threshold
  data_required: Moment creation timestamps, WebSocket send completion timestamps
  failure_mode: p95 delivery latency exceeds 500ms across a 5-minute window
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: Every 100th Moment (sampling) + 5-minute aggregation window
  max_frequency: 1 report/5min per room
  burst_limit: 10 reports/5min across all rooms
  backoff: Double window (10min, 20min) on repeated ERROR to prevent alert storms
```

### FORWARDINGS & DISPLAYS

```yaml
forwarding:
  targets:
    - location: stdout (structured JSON log)
      transport: file
      notes: Consumed by mind doctor
display:
  locations:
    - surface: CLI (mind doctor output)
      location: mind doctor → Living Places section
      signal: OK / WARN / ERROR
      notes: Green = p95 < 300ms, Yellow = 300-500ms, Red = > 500ms
```

---

## INDICATOR: Presence Accuracy

The participant list must reflect reality. If someone is shown as present but their connection is dead, or if someone is connected but invisible, trust in the system breaks.

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: presence_accuracy
  client_value: Participants trust the "who's here" list. No ghosts, no phantoms.
  validation:
    - validation_id: I4
      criteria: Participant list reflects actual connections. AT links match WebSocket state.
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - binary
  semantics:
    binary: 1 = graph AT links match in-memory connections (zero mismatches), 0 = mismatch detected
  aggregation:
    method: AND across all rooms (any mismatch = 0)
    display: binary
```

### DOCKS SELECTED

```yaml
docks:
  input:
    id: graph_at_links
    method: graphClient.query("MATCH (a)-[r:link {type: 'AT'}]->(s:space {type: 'place'}) RETURN a, s, r")
    location: FalkorDB query
  output:
    id: memory_participant_map
    method: PlaceServer.rooms.get(space_id).participants
    location: src/server/place-server.js
```

### ALGORITHM / CHECK MECHANISM

```yaml
mechanism:
  summary: Compare set of actor_ids with AT links in graph against set of actor_ids in in-memory participant maps
  steps:
    - Query all AT links to place nodes from graph
    - Read all in-memory participant maps from PlaceServer
    - Compute symmetric difference (graph-only vs memory-only)
    - Any non-empty difference = failure
  data_required: Graph AT links, in-memory participant maps
  failure_mode: Ghost participant (AT link without connection) or phantom departure (connection without AT link)
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: schedule (aligned with reconciliation tick)
  max_frequency: 1/30s (matches reconciliation interval)
  burst_limit: 2/min
  backoff: Linear (60s, 90s, 120s) on repeated failure
```

### FORWARDINGS & DISPLAYS

```yaml
forwarding:
  targets:
    - location: stdout (structured JSON log)
      transport: file
      notes: Consumed by mind doctor; includes mismatch details for debugging
display:
  locations:
    - surface: CLI (mind doctor output)
      location: mind doctor → Living Places section
      signal: OK / ERROR
      notes: Binary — either consistent or not
```

---

## INDICATOR: Graph Persistence Integrity

Every Moment that broadcasts to participants must also persist in the graph. If broadcast succeeds but graph write fails, the conversation exists only in ephemeral memory.

### VALUE TO CLIENTS & VALIDATION MAPPING

```yaml
value_and_validation:
  indicator: graph_persistence_integrity
  client_value: Conversations are searchable, replayable, and feed into AI citizen memories
  validation:
    - validation_id: I5
      criteria: Every Moment created in a place is persisted as a graph node
```

### HEALTH REPRESENTATION

```yaml
representation:
  selected:
    - float_0_1
  semantics:
    float_0_1: ratio of persisted Moments to broadcast Moments (1.0 = all persisted, <1.0 = loss)
  aggregation:
    method: min across all rooms over 5-minute window
    display: float_0_1
```

### DOCKS SELECTED

```yaml
docks:
  input:
    id: broadcast_moment_count
    method: MomentPipeline.handleInput (increment counter on broadcast)
    location: src/server/moment-pipeline.js
  output:
    id: graph_moment_count
    method: graphClient.query("MATCH (m:moment)-[:link {type: 'IN'}]->(s:space {id: $space_id}) RETURN count(m)")
    location: FalkorDB query
```

### ALGORITHM / CHECK MECHANISM

```yaml
mechanism:
  summary: Compare in-memory broadcast count against graph Moment count per room
  steps:
    - Track broadcast count per room in MomentPipeline (in-memory counter)
    - Query graph for Moment count per Space node
    - Compute ratio (graph_count / broadcast_count)
    - Alert if ratio < 1.0
  data_required: Broadcast counter, graph Moment count
  failure_mode: Ratio < 1.0 means Moments were broadcast but not persisted
```

### THROTTLING STRATEGY

```yaml
throttling:
  trigger: schedule
  max_frequency: 1/5min per room
  burst_limit: 5/5min across all rooms
  backoff: Double window on repeated failure
```

---

## HOW TO RUN

```bash
# Run via mind doctor (auto-discovers capability checkers)
cd /home/mind-protocol/mind-mcp
mind doctor

# Or run directly
PYTHONPATH=".mind:$PYTHONPATH" python3 -c "
from capabilities.living_places.runtime.checks import *
# Each @check function returns a Signal (healthy/degraded/critical)
"
```

---

## KNOWN GAPS

- Delivery latency and moment loss rate are covered by check_moment_persistence and check_place_liveness but need real-time instrumentation for sub-500ms precision
- I1 (Protocol Universality) — needs multi-renderer test, not a health check
- I2 (AI-Human Indistinguishability) — protocol-level, verified by schema validation test
- I6 (Capacity Enforcement) — checker designed but pending
- I7 (Access Control) — needs integration test, not health check
- I8 (Ambient Context Consistency) — needs multi-AI test harness
- I9 (Graceful Degradation) — needs chaos testing (kill TTS service, verify fallback)
- I10 (Spatial Attenuation) — V3, not applicable until spatial implementation

<!-- @mind:todo Design chaos test for I9 (graceful degradation) — kill external APIs, verify text continues -->

---

## MARKERS

> See PRINCIPLES.md "Feedback Loop" section for marker format and usage.

<!-- @mind:proposition Add WebSocket connection health monitoring (ping/pong latency) as additional indicator -->
<!-- @mind:escalation Decision needed: should health checks run inside the Place Server process or as a separate sidecar? -->
