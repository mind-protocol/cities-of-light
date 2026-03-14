# Serenissima Asset Pipeline -- Implementation: Code Architecture and Structure

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Serenissima.md
BEHAVIORS:       ./BEHAVIORS_Serenissima.md
PATTERNS:        ./PATTERNS_Serenissima.md
ALGORITHM:       ./ALGORITHM_Serenissima.md
VALIDATION:      ./VALIDATION_Serenissima.md
THIS:            IMPLEMENTATION_Serenissima.md (you are here)
SYNC:            ./SYNC_Serenissima.md

IMPL:            src/server/physics-bridge.js
                 src/server/graph-client.js
                 src/server/ai-citizens.js
                 venezia/scripts/seed_venice_graph.py
                 .mind/runtime/physics/
```

> **Contract:** Read docs before modifying. After changes: update IMPL or add TODO to SYNC. Run tests.

---

## CODE STRUCTURE

```
cities-of-light/
├── src/server/
│   ├── physics-bridge.js        # Physics tick bridge -- schedules ticks, forwards results
│   ├── graph-client.js          # FalkorDB client -- all graph reads and writes
│   ├── ai-citizens.js           # Citizen AI state, conversation handling, context assembly
│   ├── index.js                 # Server entry point -- Express, WebSocket, tick integration
│   └── [TO BUILD]
│       ├── channel-router.js    # Bi-channel routing -- consciousness levels, WM bridge
│       ├── wm-selector.js       # Working Memory coalition selection algorithm
│       ├── consciousness.js     # Consciousness level management and switching
│       ├── llm-router.js        # Multi-provider LLM routing with failover
│       └── consensus.js         # At-scale consensus aggregation
├── venezia/scripts/
│   └── seed_venice_graph.py     # Serenissima graph seeding from historical data
├── .mind/runtime/physics/
│   ├── tick.js                  # Physics tick engine (L1-L18 laws)
│   ├── surplus.js               # Surplus propagation (Law 2)
│   ├── decay.js                 # Energy decay
│   ├── crystallization.js       # Law 10 crystallization
│   └── action.js                # Law 17 action node firing
```

### File Responsibilities

| File | Purpose | Key Functions/Classes | Lines | Status |
|------|---------|----------------------|-------|--------|
| `src/server/physics-bridge.js` | Schedules physics ticks, forwards results to WebSocket | `startPhysicsTick()`, `bridgeTick()`, `handleMomentFlip()` | ~180 | OK |
| `src/server/graph-client.js` | FalkorDB connection, Cypher query execution | `queryGraph()`, `writeGraph()`, `getSubgraph()` | ~150 | OK |
| `src/server/ai-citizens.js` | Citizen state management, conversation context, LLM calls | `getCitizenContext()`, `handleConversation()`, `updateCitizenState()` | ~350 | WATCH |
| `src/server/index.js` | Express server, WebSocket setup, route mounting | `startServer()`, WebSocket handlers | ~250 | OK |
| `venezia/scripts/seed_venice_graph.py` | Transforms Serenissima data into FalkorDB graph nodes | `seed_citizens()`, `seed_relationships()`, `seed_tensions()` | ~400 | WATCH |
| `.mind/runtime/physics/` | Physics tick engine -- L1-L18 law execution | `executeTick()`, `propagateSurplus()`, `applyDecay()` | ~600 | WATCH |

**Size Thresholds:**
- **OK** (<400 lines): Healthy size, easy to understand
- **WATCH** (400-700 lines): Getting large, consider extraction opportunities
- **SPLIT** (>700 lines): Too large, must split before adding more code

> `ai-citizens.js` is approaching WATCH because it handles both conversation context assembly and LLM interaction. The bi-channel routing will naturally split these concerns: context assembly stays, LLM interaction moves to `channel-router.js` and `llm-router.js`.

---

## DESIGN PATTERNS

### Architecture Pattern

**Pattern:** Event-Driven Pipeline with Bi-Channel Separation

**Why this pattern:** The system must process 200+ citizens per tick without blocking on any single citizen's LLM call. The event-driven pipeline allows the physics tick (Channel 2) to run synchronously and cheaply for all citizens, then asynchronously dispatch LLM calls (Channel 1) only for the few citizens that need articulation. This is not request-response. It is a continuous pipeline with two parallel channels of different cost and latency.

### Code Patterns in Use

| Pattern | Applied To | Purpose |
|---------|------------|---------|
| Bridge | `physics-bridge.js` | Thin translation between physics engine (Python/JS) and server (Express/WebSocket) |
| Strategy | `llm-router.js` (to build) | Interchangeable LLM providers with failover chain |
| Observer | `index.js` WebSocket handlers | Physics tick results broadcast to connected clients |
| Factory | `seed_venice_graph.py` | Birth template instantiation -- creates citizens from template definitions |

### Anti-Patterns to Avoid

- **God Object in ai-citizens.js**: This file currently handles context assembly, LLM calls, and state management. The bi-channel architecture demands separation: graph operations (Channel 2) and LLM operations (Channel 1) must not be interleaved in the same module.
- **LLM in the Tick**: The temptation to "just make one quick LLM call" during the physics tick to resolve an ambiguous situation. Never. The tick is pure math. Ambiguity resolves through physics, not through articulation.
- **Hardcoded Citizen Behavior**: The temptation to add `if (citizen.role === 'merchant') { ... }` when a merchant-specific behavior does not emerge from physics. Fix the birth template or the graph structure, not the code.
- **Shared Mutable State Between Channels**: Channel 1 (LLM) and Channel 2 (Graph) must communicate through the graph only. No in-memory shared state, no global variables, no side-channel communication.

### Boundaries

| Boundary | Inside | Outside | Interface |
|----------|--------|---------|-----------|
| Physics Tick | Energy propagation, decay, crystallization, action firing, moment detection | LLM calls, WebSocket events, HTTP requests | `executeTick(graph) -> TickResult` |
| WM Bridge | Node selection, drive bias computation, coalition assembly | LLM prompt construction, response parsing | `selectWMCoalition(graph, drives) -> WMCoalition` |
| LLM Router | Provider selection, failover, cost tracking | Graph operations, physics | `complete(prompt, options) -> Response` |
| Graph Client | FalkorDB queries, Cypher execution | Business logic, physics formulas | `queryGraph(cypher) -> ResultSet` |

---

## SCHEMA

### CitizenNode (Actor)

```yaml
CitizenNode:
  required:
    - id: string                    # Unique citizen identifier
    - name: string                  # Display name
    - role: string                  # Craft/profession
    - guild: string                 # Guild membership
    - district: string              # Home district
    - consciousness_level: enum     # full | minimal | subconscious
  optional:
    - drives: DriveVector           # Limbic motor state
    - tick_rate: string             # Current tick interval
    - budget_allocation: float      # API budget share
  constraints:
    - consciousness_level must be recalculated each tick
    - drives must be initialized from birth template
```

### CognitiveNode (Moment/Thing/Narrative)

```yaml
CognitiveNode:
  required:
    - id: string
    - l1_type: enum                 # memory | concept | narrative | value | process | desire | state
    - l3_type: enum                 # moment | thing | narrative
    - subgraph: enum                # self_model | partner_model | working_memory
    - weight: float                 # [0, 1] - consolidated importance
    - energy: float                 # [0, +inf) - activation potential
    - stability: float              # [0, 1] - decay resistance
    - recency: float                # [0, 1] - freshness
    - theta: float                  # Activation threshold (default: 30)
  optional:
    - action_command: string        # Shell/API command for Law 17 nodes
    - content: string               # Human-readable description
    - valence: float                # [-1, 1] - positive/negative affect
  relationships:
    - held_by: CitizenNode          # Which citizen owns this node
    - supports: CognitiveNode[]     # Supporting connections
    - tension: CognitiveNode[]      # Contradicting connections
```

### BirthTemplate

```yaml
BirthTemplate:
  required:
    - name: string
    - role: string
    - guild: string
    - district: string
    - personality: DriveVector
    - values: ValueNode[]           # Initial weight: 0.85-0.9
    - knowledge: KnowledgeNode[]    # Initial weight: 0.8-0.9
    - processes: ProcessNode[]      # Initial weight: 0.8-0.85
    - desires: DesireNode[]         # Initial weight: 0.75-0.85
  constraints:
    - All initial weights must be >= 0.75
    - At least 3 value nodes required (identity minimum)
    - At least 1 process node with action_command required (Law 17 survival)
```

---

## ENTRY POINTS

| Entry Point | File:Line | Triggered By |
|-------------|-----------|--------------|
| Physics tick | `src/server/physics-bridge.js:startPhysicsTick()` | setInterval (5-minute / 60-second based on consciousness) |
| Citizen conversation | `src/server/ai-citizens.js:handleConversation()` | WebSocket message from client |
| Graph seeding | `venezia/scripts/seed_venice_graph.py:main()` | Manual script execution |
| Server start | `src/server/index.js:startServer()` | `npm start` or `node src/server/index.js` |

---

## DATA FLOW AND DOCKING (FLOW-BY-FLOW)

### Flow 1: Physics Tick Pipeline

Explain what this flow covers: The core heartbeat of Serenissima. Every tick interval, the physics engine reads all citizen graphs from FalkorDB, computes energy propagation/decay/crystallization/action firing, writes updated state back to the graph, and emits tick results via WebSocket.

```yaml
flow:
  name: physics_tick_pipeline
  purpose: Run L1-L18 physics laws on all citizen graphs
  scope: FalkorDB graph state -> physics computation -> updated graph state + events
  steps:
    - id: step_1_read_graphs
      description: Read all citizen subgraphs from FalkorDB
      file: src/server/graph-client.js
      function: getSubgraph()
      input: citizen_ids[]
      output: citizenGraphs Map
      trigger: tick timer
      side_effects: none
    - id: step_2_execute_tick
      description: Run physics tick on all citizen graphs
      file: .mind/runtime/physics/tick.js
      function: executeTick()
      input: citizenGraphs
      output: TickResult
      trigger: step_1 completion
      side_effects: computed deltas (in memory only)
    - id: step_3_write_state
      description: Write energy/weight/stability changes back to FalkorDB
      file: src/server/graph-client.js
      function: writeGraph()
      input: TickResult.deltas
      output: confirmation
      trigger: step_2 completion
      side_effects: FalkorDB state updated
    - id: step_4_emit_events
      description: Forward moment flips and significant events to WebSocket
      file: src/server/physics-bridge.js
      function: handleMomentFlip()
      input: TickResult.moment_flips
      output: WebSocket events
      trigger: step_3 completion
      side_effects: connected clients receive events
  docking_points:
    guidance:
      include_when: state changes, boundary crossings, event emissions
      omit_when: internal physics computation steps
      selection_notes: Dock at graph read, graph write, and event emission -- the three boundary crossings
    available:
      - id: dock_graph_read
        type: db
        direction: input
        file: src/server/graph-client.js
        function: getSubgraph()
        trigger: tick timer
        payload: Cypher query results
        async_hook: required
        needs: add watcher for query timing
        notes: Performance critical -- must complete in <200ms for 200 citizens
      - id: dock_graph_write
        type: db
        direction: output
        file: src/server/graph-client.js
        function: writeGraph()
        trigger: tick completion
        payload: Graph deltas (energy, weight, stability, recency changes)
        async_hook: required
        needs: add transaction wrapping for atomicity
        notes: Must be atomic -- partial writes corrupt graph state
      - id: dock_event_emit
        type: event
        direction: output
        file: src/server/physics-bridge.js
        function: handleMomentFlip()
        trigger: moment flip detected
        payload: MomentFlip event JSON
        async_hook: optional
        needs: none
        notes: Non-blocking -- WebSocket emit is fire-and-forget
    health_recommended:
      - dock_id: dock_graph_read
        reason: Query timing reveals FalkorDB performance and citizen scale limits
      - dock_id: dock_graph_write
        reason: Write atomicity is critical for conservation invariant
```

### Flow 2: Conversation Pipeline (Channel 1 Invocation)

Explain what this flow covers: When a visitor speaks to a citizen, the system must assemble the WM coalition from the citizen's graph, route it to an LLM provider, and process the response back into the graph as a new moment node.

```yaml
flow:
  name: conversation_pipeline
  purpose: Translate visitor speech into citizen response via bi-channel routing
  scope: visitor input -> WM selection -> LLM call -> response + graph update
  steps:
    - id: step_1_receive_stimulus
      description: Receive visitor speech via WebSocket
      file: src/server/index.js
      function: WebSocket handler
      input: visitor message JSON
      output: stimulus object
      trigger: WebSocket message event
      side_effects: none
    - id: step_2_promote_consciousness
      description: Promote citizen to full consciousness if budget permits
      file: src/server/consciousness.js (to build)
      function: promoteForConversation()
      input: citizen_id, apiBudget
      output: consciousness_level
      trigger: step_1
      side_effects: citizen consciousness_level updated in graph
    - id: step_3_select_wm
      description: Select Working Memory coalition (5-7 nodes) from citizen graph
      file: src/server/wm-selector.js (to build)
      function: selectWMCoalition()
      input: citizenGraph, drives, K=7
      output: WMCoalition
      trigger: step_2
      side_effects: none (read-only graph operation)
    - id: step_4_invoke_llm
      description: Build prompt from WM coalition and send to LLM provider
      file: src/server/llm-router.js (to build)
      function: complete()
      input: prompt (WM nodes + drives + stimulus + history)
      output: LLM response text
      trigger: step_3
      side_effects: API budget consumed
    - id: step_5_process_response
      description: Create moment node from LLM response and insert into graph
      file: src/server/ai-citizens.js
      function: processLLMResponse()
      input: response text, WM context
      output: new moment node
      trigger: step_4
      side_effects: FalkorDB updated with new moment node and edges
  docking_points:
    guidance:
      include_when: Channel crossing (WM bridge), external API call, graph mutation
      omit_when: Internal prompt construction
      selection_notes: Dock at WM selection output, LLM call, and graph write-back
    available:
      - id: dock_wm_output
        type: custom
        direction: output
        file: src/server/wm-selector.js
        function: selectWMCoalition()
        trigger: conversation initiation
        payload: WMCoalition (5-7 nodes + drives)
        async_hook: optional
        needs: add logging for WM composition analysis
        notes: This is the Channel 2 -> Channel 1 bridge. Critical for cognitive sovereignty.
      - id: dock_llm_call
        type: api
        direction: output
        file: src/server/llm-router.js
        function: complete()
        trigger: WM coalition ready
        payload: prompt string (~2000-4000 tokens)
        async_hook: required
        needs: add cost tracking per call
        notes: Most expensive operation per citizen. Must track budget impact.
      - id: dock_response_writeback
        type: db
        direction: output
        file: src/server/ai-citizens.js
        function: processLLMResponse()
        trigger: LLM response received
        payload: new moment node + edge connections
        async_hook: required
        needs: add validation that LLM output does not directly overwrite graph state
        notes: Enforces V6 (cognitive sovereignty) -- LLM output becomes stimulus, not truth
    health_recommended:
      - dock_id: dock_wm_output
        reason: WM composition directly determines conversation quality and cognitive sovereignty
      - dock_id: dock_llm_call
        reason: Cost tracking is essential for budget management at scale
```

---

## LOGIC CHAINS

### LC1: Tick-to-Event Chain

**Purpose:** Trace how a physics tick produces a visible event in the 3D world

```
Tick timer fires
  -> physics-bridge.js:bridgeTick()
    -> graph-client.js:getSubgraph() [read all citizen graphs]
      -> .mind/runtime/physics/tick.js:executeTick() [L1-L18 laws]
        -> surplus.js:propagateSurplus() [Law 2]
        -> decay.js:applyDecay() [0.02 rate]
        -> crystallization.js:checkCrystallization() [Law 10]
        -> action.js:fireActionNodes() [Law 17]
        -> tick.js:checkMomentFlips() [threshold detection]
          -> TickResult with moment_flips[]
    -> graph-client.js:writeGraph() [persist state changes]
    -> physics-bridge.js:handleMomentFlip() [forward to WebSocket]
      -> Client receives event -> 3D world updates
```

**Data transformation:**
- Input: `citizenGraphs` -- raw FalkorDB subgraphs
- After tick: `TickResult` -- energy deltas, surplus flows, crystallizations, action firings, moment flips
- After write: FalkorDB state updated atomically
- Output: WebSocket events -- moment flips broadcast to connected clients

### LC2: Visitor-to-Response Chain

**Purpose:** Trace how a visitor's spoken words become a citizen's spoken response

```
Visitor speaks (WebSocket message)
  -> index.js:WebSocket handler
    -> consciousness.js:promoteForConversation() [raise to FULL]
    -> wm-selector.js:selectWMCoalition() [pick 5-7 nodes from graph]
      -> Channel 2 -> Channel 1 bridge [WM coalition crosses]
    -> llm-router.js:complete() [send prompt to Claude/GPT/Mistral]
      -> LLM response text
    -> ai-citizens.js:processLLMResponse() [create moment node]
      -> graph-client.js:writeGraph() [persist new moment]
    -> index.js:WebSocket emit [send response to client]
      -> Client receives text -> TTS pipeline -> spatial audio
```

---

## MODULE DEPENDENCIES

### Internal Dependencies

```
src/server/index.js
    └── imports -> physics-bridge.js
    └── imports -> ai-citizens.js
    └── imports -> graph-client.js

src/server/physics-bridge.js
    └── imports -> graph-client.js
    └── imports -> .mind/runtime/physics/tick.js

src/server/ai-citizens.js
    └── imports -> graph-client.js
    └── imports -> [to build] wm-selector.js
    └── imports -> [to build] llm-router.js
    └── imports -> [to build] consciousness.js

[to build] src/server/channel-router.js
    └── imports -> wm-selector.js
    └── imports -> llm-router.js
    └── imports -> consciousness.js
    └── imports -> graph-client.js
```

### External Dependencies

| Package | Used For | Imported By |
|---------|----------|-------------|
| `falkordb` | Graph database client | `graph-client.js` |
| `express` | HTTP server | `index.js` |
| `ws` | WebSocket server | `index.js` |
| `@anthropic-ai/sdk` | Claude API client | `llm-router.js` (to build) |
| `openai` | GPT API client (failover) | `llm-router.js` (to build) |

---

## STATE MANAGEMENT

### Where State Lives

| State | Location | Scope | Lifecycle |
|-------|----------|-------|-----------|
| Citizen cognitive graphs | FalkorDB | Per citizen | Persistent -- survives server restarts |
| Consciousness levels | FalkorDB + in-memory cache | Per citizen | Recalculated each tick |
| API budget remaining | Server memory + `.tick_state.json` | Global | Persisted to disk, reset daily |
| Active conversations | Server memory (`ai-citizens.js`) | Per citizen-visitor pair | Duration of WebSocket connection |
| Tick state | `.tick_state.json` | Global | Persisted between ticks for crash recovery |
| WM coalitions | Transient (computed per tick) | Per citizen | Discarded after LLM call completes |

### State Transitions

```
Consciousness: SUBCONSCIOUS ──visitor approaches──> MINIMAL ──conversation starts──> FULL
               FULL ──conversation ends──> MINIMAL ──visitor leaves──> SUBCONSCIOUS
               ANY ──budget exhausted──> SUBCONSCIOUS
               SUBCONSCIOUS ──budget returns──> MINIMAL (priority: citizens with recent visitor interaction)
```

---

## RUNTIME BEHAVIOR

### Initialization

```
1. Start Express server and WebSocket server (index.js)
2. Connect to FalkorDB (graph-client.js)
3. Verify graph schema and citizen count (graph-client.js)
4. Load tick state from .tick_state.json if exists (crash recovery)
5. Initialize consciousness levels for all citizens (default: SUBCONSCIOUS)
6. Start physics tick timer (physics-bridge.js, 60-second initial interval)
7. Server ready -- accepting WebSocket connections
```

### Main Loop / Physics Tick Cycle

```
1. Tick timer fires
2. Read all citizen graphs from FalkorDB
3. Assign consciousness levels based on budget and activity
4. Execute physics tick (L1-L18 on all graphs)
5. Write updated state to FalkorDB (atomic transaction)
6. For full/minimal citizens: select WM coalitions
7. Emit tick results via WebSocket (moment flips, atmosphere changes)
8. Persist tick state to .tick_state.json
9. Schedule next tick (interval depends on consciousness distribution)
```

### Shutdown

```
1. Stop accepting new WebSocket connections
2. Complete current tick if in progress (never abort mid-tick)
3. Persist final tick state to .tick_state.json
4. Close FalkorDB connection
5. Close WebSocket and HTTP servers
```

---

## CONCURRENCY MODEL

| Component | Model | Notes |
|-----------|-------|-------|
| Physics tick | Synchronous | Single-threaded tick computation -- must not be interrupted |
| LLM calls | Async (Promise.all) | Multiple citizens' LLM calls run in parallel |
| Graph reads/writes | Async | FalkorDB client is async; tick reads are batched |
| WebSocket events | Event-driven | Non-blocking emit to connected clients |
| Tick timer | setInterval | One tick at a time; if tick overruns interval, next tick waits |

---

## CONFIGURATION

| Config | Location | Default | Description |
|--------|----------|---------|-------------|
| `TICK_INTERVAL_MS` | `.env` | `300000` (5 min) | Physics tick interval for minimal/full consciousness |
| `SUBCONSCIOUS_TICK_MS` | `.env` | `60000` (60 sec) | Physics tick interval for subconscious-only mode |
| `FALKORDB_HOST` | `.env` | `localhost` | FalkorDB server address |
| `FALKORDB_PORT` | `.env` | `6379` | FalkorDB server port |
| `WM_COALITION_SIZE` | `.env` | `7` | Number of nodes in Working Memory coalition |
| `DECAY_RATE` | `.mind/runtime/physics/constants.js` | `0.02` | Energy decay per tick |
| `THETA_BASE` | `.mind/runtime/physics/constants.js` | `30` | Base activation threshold |
| `CRYSTALLIZATION_THRESHOLD` | `.mind/runtime/physics/constants.js` | `15` | Co-activation threshold for Law 10 |
| `MAX_CRYSTALLIZATIONS_PER_TICK` | `.mind/runtime/physics/constants.js` | `3` | Cap on crystallizations per citizen per tick |
| `CONSCIOUSNESS_BUDGET_FULL` | `src/server/consciousness.js` | `0.3` | Budget threshold for full consciousness |
| `CONSCIOUSNESS_BUDGET_MINIMAL` | `src/server/consciousness.js` | `0.01` | Budget threshold for minimal consciousness |

---

## BIDIRECTIONAL LINKS

### Code -> Docs

Files that reference this documentation:

| File | Line | Reference |
|------|------|-----------|
| `src/server/physics-bridge.js` | (header) | `// DOCS: docs/architecture/serenissima/` |
| `src/server/ai-citizens.js` | (header) | `// DOCS: docs/architecture/serenissima/` |

### Docs -> Code

| Doc Section | Implemented In |
|-------------|----------------|
| ALGORITHM: Surplus Propagation | `.mind/runtime/physics/surplus.js` |
| ALGORITHM: Crystallization | `.mind/runtime/physics/crystallization.js` |
| ALGORITHM: Bi-Channel Routing | `src/server/channel-router.js` (TO BUILD) |
| ALGORITHM: WM Selection | `src/server/wm-selector.js` (TO BUILD) |
| ALGORITHM: Consciousness Switching | `src/server/consciousness.js` (TO BUILD) |
| BEHAVIOR B1: Consciousness Levels | `src/server/consciousness.js` (TO BUILD) |
| BEHAVIOR B4: Subconscious Query | `src/server/consensus.js` (TO BUILD) |
| VALIDATION V2: Tick Isolation | `.mind/runtime/physics/tick.js` |
| VALIDATION V3: Conservation | `.mind/runtime/physics/surplus.js` |

---

## EXTRACTION CANDIDATES

Files approaching WATCH/SPLIT status -- identify what can be extracted:

| File | Current | Target | Extract To | What to Move |
|------|---------|--------|------------|--------------|
| `src/server/ai-citizens.js` | ~350L | <400L | `src/server/wm-selector.js` | WM coalition selection logic |
| `src/server/ai-citizens.js` | ~350L | <400L | `src/server/llm-router.js` | LLM provider calls and failover |
| `src/server/ai-citizens.js` | ~350L | <400L | `src/server/consciousness.js` | Consciousness level management |
| `venezia/scripts/seed_venice_graph.py` | ~400L | <400L | `venezia/scripts/birth_templates.py` | Template definitions (separate from seeding logic) |

---

## MARKERS

<!-- @mind:todo Build channel-router.js -- the core bi-channel routing module -->
<!-- @mind:todo Build wm-selector.js -- extract WM coalition selection from ai-citizens.js -->
<!-- @mind:todo Build consciousness.js -- consciousness level switching and budget management -->
<!-- @mind:todo Build llm-router.js -- multi-provider LLM routing with Claude/GPT/Mistral failover -->
<!-- @mind:todo Build consensus.js -- at-scale consensus aggregation -->
<!-- @mind:proposition Consider extracting physics tick scheduling from physics-bridge.js into a dedicated tick-scheduler.js -->
<!-- @mind:escalation ai-citizens.js is approaching WATCH -- extraction to new modules should precede any new feature work -->
