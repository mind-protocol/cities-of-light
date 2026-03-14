# Serenissima Asset Pipeline -- Algorithm: Bi-Channel Routing, Surplus Propagation, and Cognitive Logistics

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
THIS:            ALGORITHM_Serenissima.md (you are here)
VALIDATION:      ./VALIDATION_Serenissima.md
IMPLEMENTATION:  ./IMPLEMENTATION_Serenissima.md
SYNC:            ./SYNC_Serenissima.md

IMPL:            src/server/physics-bridge.js
                 src/server/graph-client.js
                 src/server/ai-citizens.js
                 .mind/runtime/physics/
```

> **Contract:** Read docs before modifying. After changes: update IMPL or add TODO to SYNC. Run tests.

---

## OVERVIEW

The Serenissima algorithm orchestrates cognitive logistics for 200+ autonomous citizens through a strict bi-channel architecture. Channel 2 (FalkorDB graph) runs all physics continuously and cheaply. Channel 1 (LLM prompt) is invoked only when a citizen needs to articulate -- speak, plan, create -- and only receives the minimal Working Memory coalition (5-7 nodes) from the citizen's graph.

The algorithm has six major subsystems: bi-channel routing (what crosses to Channel 1 and when), WM selection (which nodes cross), surplus propagation (how energy flows with conservation), friction modulation (how relationships affect flow), consciousness level switching (how budget determines depth), and birth template seeding (how new citizens are initialized). Each subsystem is detailed below with pseudocode, conservation proofs, and complexity analysis.

---

## OBJECTIVES AND BEHAVIORS

| Objective | Behaviors Supported | Why This Algorithm Matters |
|-----------|---------------------|----------------------------|
| Bi-channel cost efficiency | B1, B4, B7 | Routes 95% of cognition to cheap graph math |
| Cognitive sovereignty | B3, B5, B6 | Graph computes all decisions; LLM only articulates |
| Subconscious survival | B7 | Law 17 action nodes fire without any LLM involvement |
| Economic alignment | B2 | Same surplus propagation governs economic and cognitive flow |
| Emergent narrative | B3 | Crystallization creates new narrative nodes from co-activation |

---

## DATA STRUCTURES

### CitizenGraph (per citizen, stored in FalkorDB)

```
CitizenGraph:
  nodes:
    - id: string                    # Unique node identifier
    - l1_type: enum                 # memory | concept | narrative | value | process | desire | state
    - l3_type: enum                 # moment | thing | narrative | actor
    - subgraph: enum                # self_model | partner_model | working_memory
    - weight: float [0, 1]          # Consolidated importance (resistance to decay)
    - energy: float [0, +inf)       # Activation potential
    - stability: float [0, 1]       # Decay resistance (derived from weight)
    - recency: float [0, 1]         # Freshness (eroded by decay)
    - action_command: string | null  # Shell/API command for Law 17 action nodes
    - theta: float                  # Activation threshold (default: 30)

  edges:
    - source: node_id
    - target: node_id
    - type: enum                    # supports | tension | supplies | trusts | ...
    - weight: float [0, 1]          # Link strength
    - friction: float [0, 1]        # Transfer resistance (irritation, distrust)
    - gain: float [0, 1]            # Transfer amplification (trust, affinity)

  drives:                           # Limbic motor state
    - curiosity: float [0, 1]
    - care: float [0, 1]
    - achievement: float [0, 1]
    - self_preservation: float [0, 1]
    - novelty_hunger: float [0, 1]
```

### WMCoalition (transient, assembled each tick)

```
WMCoalition:
  citizen_id: string
  nodes: Node[5..7]                 # Highest-activation nodes after drive bias
  drive_state: DriveVector          # Current limbic state for LLM context
  consciousness_level: enum         # full | minimal | subconscious
  total_activation: float           # Sum of node energies in coalition
```

### TickResult (output of each tick)

```
TickResult:
  timestamp: ISO8601
  citizens_processed: int
  consciousness_levels: Map<citizen_id, level>
  wm_coalitions: Map<citizen_id, WMCoalition>    # Only for full/minimal citizens
  surplus_flows: FlowRecord[]                      # Edge-level flow details
  crystallizations: CrystallizationEvent[]         # New nodes spawned
  action_firings: ActionEvent[]                    # Law 17 commands executed
  moment_flips: MomentFlip[]                       # From physics tick
  energy_stats: { total, mean, max, min }
```

---

## ALGORITHM: Bi-Channel Routing

### Step 1: Consciousness Level Assignment

Each tick begins by determining every citizen's consciousness level based on available API budget and current activity state.

```
function assignConsciousnessLevels(citizens, apiBudget, activeConversations):

    # Priority 1: Citizens in active visitor conversations get full consciousness
    for citizen in activeConversations:
        if apiBudget > 0.01:
            citizen.level = FULL
            apiBudget -= estimateCost(citizen)

    # Priority 2: Citizens near visitors get minimal consciousness
    for citizen in nearbyVisitorCitizens:
        if apiBudget > 0.005 AND citizen.level != FULL:
            citizen.level = MINIMAL
            apiBudget -= estimateCost(citizen) * 0.1

    # Priority 3: Citizens with high-energy moment flips pending
    for citizen in pendingMomentFlipCitizens:
        if apiBudget > 0.01 AND citizen.level == null:
            citizen.level = FULL
            apiBudget -= estimateCost(citizen)

    # Everyone else: subconscious
    for citizen in citizens:
        if citizen.level == null:
            citizen.level = SUBCONSCIOUS

    return consciousnessMap
```

**Why priority ordering matters:** Visitors in conversation expect responsiveness -- they get budget first. Citizens near visitors might be overheard or approached next -- they get minimal. Citizens undergoing moment flips need LLM to narrate the event. Everyone else runs on pure physics.

### Step 2: WM Coalition Selection

For citizens at full or minimal consciousness, select the K most activated nodes to cross the bridge to Channel 1.

```
function selectWMCoalition(citizenGraph, drives, K=7):

    # Compute effective activation for each node
    for node in citizenGraph.nodes:
        # Base activation = energy * recency
        base = node.energy * node.recency

        # Drive bias: each drive amplifies relevant node types
        drive_multiplier = 1.0
        if node.l1_type == "desire" AND drives.curiosity > 0.5:
            drive_multiplier += drives.curiosity * 0.3
        if node.l1_type == "memory" AND node.relates_to("relationship"):
            drive_multiplier += drives.care * 0.3
        if node.l1_type == "process" AND node.relates_to("achievement"):
            drive_multiplier += drives.achievement * 0.3
        if node.l1_type == "state" AND node.valence < 0:
            drive_multiplier += drives.self_preservation * 0.4
        if node.recency < 0.3:                          # Novel node
            drive_multiplier += drives.novelty_hunger * 0.2

        node.effective_activation = base * drive_multiplier

    # Select top K by effective activation
    coalition = sorted(citizenGraph.nodes, by=effective_activation, desc)[:K]

    # Ensure at least 1 self-model node (identity anchor)
    if not any(n.subgraph == "self_model" for n in coalition):
        # Replace lowest-activation node with highest self-model node
        self_nodes = [n for n in citizenGraph.nodes if n.subgraph == "self_model"]
        if self_nodes:
            coalition[-1] = max(self_nodes, by=effective_activation)

    return WMCoalition(nodes=coalition, drives=drives)
```

**Why K=5-7:** This mirrors the cognitive science finding that human working memory holds 7 +/- 2 items. It also keeps the prompt compact -- at ~200-500 tokens per node, the WM coalition consumes 1000-3500 tokens, leaving ample room for conversation history and system prompt.

### Step 3: Channel 1 Invocation (LLM Call)

When a citizen at full consciousness needs to articulate (respond to visitor, narrate event), the WM coalition is serialized into the prompt.

```
function invokeChannel1(citizen, wmCoalition, stimulus):

    prompt = buildPrompt(
        identity = citizen.birthTemplate.identity,
        wm_nodes = wmCoalition.nodes,          # 5-7 nodes, serialized
        drives = wmCoalition.drive_state,       # Current limbic state
        stimulus = stimulus,                    # Visitor's words, event, etc.
        conversation_history = last_5_turns     # Recent conversation if any
    )

    # LLM Router: try providers in order of preference
    response = null
    for provider in [CLAUDE, GPT, MISTRAL]:
        try:
            response = provider.complete(prompt, max_tokens=500)
            break
        catch ProviderError:
            continue    # Graceful degradation

    if response == null:
        # All providers failed -- fall back to Law 17 reflex
        return generateReflexResponse(citizen, stimulus)

    # Process LLM output back into graph as new stimulus
    newMoment = createMomentNode(
        content = response.text,
        energy = 0.3,                          # Moderate initial energy
        connections = wmCoalition.nodes         # Link to WM context
    )
    citizenGraph.addNode(newMoment)

    return response
```

**What crosses to Channel 1:** Only the WM coalition (5-7 nodes), drive state, stimulus, and conversation history. The full graph (potentially thousands of nodes) stays on Channel 2. The LLM never sees the complete mind -- only the current focus of attention.

---

## ALGORITHM: Surplus Propagation (Law 2)

### Step 1: Compute Surplus

For each node, determine how much energy exceeds its activation threshold.

```
function computeSurplus(node):
    return max(0, node.energy - node.theta)
```

### Step 2: Distribute Surplus Along Edges

Surplus energy flows proportionally to edge weights, modulated by friction and gain.

```
function propagateSurplus(citizenGraph):

    for node in citizenGraph.nodes:
        surplus = computeSurplus(node)
        if surplus <= 0:
            continue

        # Collect outgoing edges
        edges = citizenGraph.outEdges(node)
        if not edges:
            continue

        # Compute effective weights (modulated by friction and gain)
        for edge in edges:
            edge.effective_weight = edge.weight * (1.0 + edge.gain - edge.friction)
            edge.effective_weight = max(0.01, edge.effective_weight)  # Never zero

        # Normalize to ensure conservation
        total_weight = sum(e.effective_weight for e in edges)

        # Distribute surplus proportionally
        for edge in edges:
            flow = surplus * (edge.effective_weight / total_weight)
            edge.target.energy += flow

        # Source falls back to theta (conservation)
        node.energy = node.theta

    # CONSERVATION PROOF:
    #   Before: node.energy = node.theta + surplus
    #   Distributed: sum(flow_ij) = surplus * sum(ew_j/total_w) = surplus * 1.0 = surplus
    #   After source: node.energy = node.theta
    #   After targets: sum(delta_target) = surplus
    #   Total energy change: -surplus + surplus = 0. QED.
```

### Conservation Proof (Formal)

```
Let E_i = energy of source node i
Let Theta_i = activation threshold of node i
Let surplus_i = max(0, E_i - Theta_i)
Let w_j = effective_weight of edge to neighbor j
Let W = sum(w_j) for all neighbors j

Flow to neighbor j:
    flow_ij = surplus_i * (w_j / W)

Sum of all flows:
    sum_j(flow_ij) = surplus_i * sum_j(w_j / W) = surplus_i * (W / W) = surplus_i

Energy removed from source: surplus_i
Energy added to targets: sum_j(flow_ij) = surplus_i

Net energy change in system: -surplus_i + surplus_i = 0

Energy is conserved. The source falls back to exactly Theta_i.
No energy is created or destroyed during propagation.
```

---

## ALGORITHM: Friction Modulation (Law 18)

Friction and gain on edges modulate the effective transfer efficiency.

```
function modulateEdge(edge, interaction):

    # Positive interaction: reduce friction, increase gain
    if interaction.valence > 0:
        edge.friction *= (1.0 - 0.05 * interaction.valence)
        edge.gain += 0.02 * interaction.valence
        edge.gain = min(1.0, edge.gain)

    # Negative interaction: increase friction, reduce gain
    if interaction.valence < 0:
        edge.friction += 0.03 * abs(interaction.valence)
        edge.friction = min(1.0, edge.friction)
        edge.gain *= (1.0 - 0.02 * abs(interaction.valence))

    # Friction and gain both decay slowly toward neutral
    edge.friction *= 0.995      # Irritation fades
    edge.gain *= 0.998          # Trust erodes without reinforcement (but slower)
```

**Supply chain effect:** An edge with friction=0.8 (high distrust) effectively reduces flow by 80%. A citizen who distrusts a supplier receives almost no surplus energy from them. This forces the graph to route around high-friction edges, naturally modeling trade route disruption, social avoidance, and guild feuds.

---

## ALGORITHM: Consciousness Level Switching

```
function switchConsciousness(citizen, apiBudget, tick):

    previousLevel = citizen.consciousness_level

    # Determine new level based on budget and activity
    if citizen.inActiveConversation AND apiBudget > 0.01:
        newLevel = FULL
    elif citizen.nearVisitor AND apiBudget > 0.005:
        newLevel = MINIMAL
    elif apiBudget > 0.3:
        # Budget is healthy -- use activation-based promotion
        if citizen.highestNodeEnergy > CONSCIOUSNESS_PROMOTION_THRESHOLD:
            newLevel = MINIMAL
        else:
            newLevel = SUBCONSCIOUS
    else:
        newLevel = SUBCONSCIOUS

    # Apply level
    citizen.consciousness_level = newLevel

    # Adjust tick rate
    if newLevel == FULL:
        citizen.tickRate = "fast"        # Every server tick (~1-5s)
    elif newLevel == MINIMAL:
        citizen.tickRate = "5min"         # Every 5 minutes
    else:
        citizen.tickRate = "60s"          # Every 60 seconds

    # Log transition for debugging (never exposed to visitor)
    if previousLevel != newLevel:
        logTransition(citizen.id, previousLevel, newLevel, tick.timestamp)
```

**Smooth transitions:** The visitor never sees a "loading" state or a personality shift. When consciousness rises, the citizen simply becomes more articulate over the next 1-2 responses. When consciousness drops, the citizen becomes "distracted" -- shorter responses, less initiative, more routine behavior.

---

## ALGORITHM: Birth Template Seeding

```
function seedCitizen(template, graph):

    citizen = createActorNode(
        name = template.name,
        role = template.role,
        guild = template.guild,
        district = template.district
    )

    # Self-model subgraph: identity core
    for value in template.values:
        node = createNarrativeNode(
            l1_type = "value",
            content = value.description,
            weight = value.initial_weight,          # 0.85-0.9
            energy = value.initial_weight * 30,     # Start at threshold
            stability = value.initial_weight,
            recency = 1.0,
            subgraph = "self_model"
        )
        graph.addNode(node)
        graph.addEdge(citizen, node, type="holds", weight=value.initial_weight)

    # Project knowledge (craft, domain expertise)
    for knowledge in template.knowledge:
        node = createThingNode(
            l1_type = "concept",
            content = knowledge.description,
            weight = knowledge.initial_weight,       # 0.8-0.9
            energy = knowledge.initial_weight * 25,
            stability = knowledge.initial_weight * 0.9,
            recency = 1.0,
            subgraph = "self_model"
        )
        graph.addNode(node)
        graph.addEdge(citizen, node, type="knows", weight=knowledge.initial_weight)

    # Behavioral processes (routines, habits)
    for process in template.processes:
        node = createNarrativeNode(
            l1_type = "process",
            content = process.description,
            weight = process.initial_weight,         # 0.8-0.85
            energy = process.initial_weight * 20,
            stability = process.initial_weight * 0.85,
            recency = 1.0,
            subgraph = "self_model",
            action_command = process.action_command   # For Law 17 firing
        )
        graph.addNode(node)
        graph.addEdge(citizen, node, type="executes", weight=process.initial_weight)

    # Desires (aspirational attractors)
    for desire in template.desires:
        node = createNarrativeNode(
            l1_type = "desire",
            content = desire.description,
            weight = desire.initial_weight,          # 0.75-0.85
            energy = desire.initial_weight * 15,
            stability = desire.initial_weight * 0.7,
            recency = 1.0,
            subgraph = "self_model"
        )
        graph.addNode(node)
        graph.addEdge(citizen, node, type="wants", weight=desire.initial_weight)

    # Initialize drives from template personality
    citizen.drives = {
        curiosity: template.personality.curiosity,                # 0.0-1.0
        care: template.personality.care,
        achievement: template.personality.achievement,
        self_preservation: template.personality.self_preservation,
        novelty_hunger: template.personality.novelty_hunger
    }

    return citizen
```

**Why high initial weights:** Birth template nodes must survive the first hours of physics ticks. A citizen born with weight=0.5 values would see those values decay below relevance within a day. Weight 0.85-0.9 gives values a half-life of weeks, ensuring the citizen's core identity persists while experience adds new layers.

---

## ALGORITHM: Crystallization (Law 10)

```
function checkCrystallization(citizenGraph, maxPerTick=3):

    crystallizations = []

    # Find all node pairs with high co-activation
    candidates = []
    for (a, b) in allNodePairs(citizenGraph):
        coact = min(a.energy, b.energy)
        if coact > CRYSTALLIZATION_THRESHOLD:
            candidates.append((a, b, coact))

    # Sort by co-activation strength (strongest first)
    candidates.sort(by=coact, desc)

    # Crystallize up to maxPerTick
    for (a, b, coact) in candidates[:maxPerTick]:

        # Spawn new narrative node
        newNode = createNarrativeNode(
            l1_type = "narrative",
            content = generateLabel(a, b),          # Descriptive label
            weight = 0.3,                           # Starts moderate
            energy = coact * 0.5,                   # Inherits half of co-activation energy
            stability = 0.4,
            recency = 1.0,
            subgraph = "working_memory"
        )

        # Connect to parent nodes
        citizenGraph.addNode(newNode)
        citizenGraph.addEdge(a, newNode, type="supports", weight=0.5)
        citizenGraph.addEdge(b, newNode, type="supports", weight=0.5)

        # Consume energy from parents (conservation)
        a.energy -= coact * 0.25
        b.energy -= coact * 0.25

        crystallizations.append(newNode)

    return crystallizations
```

---

## ALGORITHM: Subconscious Query (L2 Interaction)

```
function subconsciousQuery(sourceGraph, targetGraph, stimulus):

    # Inject stimulus into target graph as temporary energy
    stimulusNode = createTemporaryNode(
        content = stimulus,
        energy = 5.0,               # Moderate injection
        connections = findRelevantNodes(targetGraph, stimulus)
    )

    # Run one mini-tick on the target graph (no LLM, no full physics)
    miniTick(targetGraph, stimulusNode)

    # Read resonance pattern: energy distribution after stimulus
    resonance = {}
    for node in targetGraph.nodes:
        if node.energy > node.theta * 0.5:          # Only above-threshold nodes
            resonance[node.id] = {
                energy: node.energy,
                type: node.l1_type,
                valence: node.valence
            }

    # Remove temporary stimulus node
    targetGraph.removeNode(stimulusNode)

    return resonance
```

**Cost:** One mini-tick per query. No LLM. Pure graph math. A subconscious query across 200 citizens completes in ~100ms total.

---

## ALGORITHM: At-Scale Consensus

```
function atScaleConsensus(stimulus, citizens, trustWeights):

    # Inject stimulus into all citizen graphs
    resonances = {}
    for citizen in citizens:
        resonances[citizen.id] = subconsciousQuery(null, citizen.graph, stimulus)

    # Aggregate resonance patterns
    aggregate = {}
    for citizenId, resonance in resonances:
        weight = trustWeights[citizenId] * citizens[citizenId].stake(stimulus)
        for nodeId, response in resonance:
            if nodeId not in aggregate:
                aggregate[nodeId] = { total_energy: 0, total_weight: 0, valences: [] }
            aggregate[nodeId].total_energy += response.energy * weight
            aggregate[nodeId].total_weight += weight
            aggregate[nodeId].valences.append(response.valence * weight)

    # Compute consensus landscape
    landscape = {}
    for nodeId, data in aggregate:
        landscape[nodeId] = {
            mean_energy: data.total_energy / data.total_weight,
            mean_valence: sum(data.valences) / data.total_weight,
            participation: data.total_weight / sum(trustWeights.values())
        }

    return landscape
```

---

## KEY DECISIONS

### D1: What Crosses the Bridge to Channel 1

```
IF citizen.consciousness == FULL AND stimulus requires articulation:
    Cross: WM coalition (5-7 nodes), drive state, stimulus, conversation history
    Do NOT cross: full graph, raw edge weights, other citizens' data, physics state
    Why: The LLM needs enough context to articulate, not enough to reason about the system
ELSE:
    Nothing crosses. Citizen operates purely on Channel 2.
```

### D2: When to Promote Consciousness Level

```
IF visitor initiates direct conversation:
    Promote to FULL immediately (budget permitting)
    Why: Visitor experience is the top priority for the POC
ELIF visitor is within proximity threshold:
    Promote to MINIMAL
    Why: Nearby citizens should be semi-aware, not catatonic
ELIF citizen has pending moment flip:
    Promote to FULL
    Why: Moment flips produce narrative events that need articulation
ELSE:
    Remain at current level (default: SUBCONSCIOUS)
    Why: Conserve budget for when it matters
```

### D3: LLM Provider Selection

```
IF Claude available AND budget sufficient:
    Use Claude (highest quality articulation)
ELIF GPT available AND budget sufficient:
    Use GPT (good quality, different cost profile)
ELIF Mistral available:
    Use Mistral (lowest cost, acceptable quality for minimal consciousness)
ELSE:
    Fall back to Law 17 reflex response (no LLM at all)
    Why: Graceful degradation -- the citizen never goes silent
```

---

## DATA FLOW

```
Economic Events + Visitor Stimuli + Tick Timer
    |
    v
Consciousness Level Assignment (budget-based prioritization)
    |
    v
Physics Tick on Channel 2 (all citizens, graph math only)
    |-- Surplus propagation (Law 2)
    |-- Friction modulation (Law 18)
    |-- Drive updates (limbic motor)
    |-- Action node firing (Law 17)
    |-- Crystallization check (Law 10)
    |-- Moment flip detection
    |
    v
WM Coalition Selection (full/minimal citizens only)
    |
    v
Channel 1 Invocation (LLM, only for citizens needing articulation)
    |
    v
Response Processing (LLM output -> new moment nodes -> graph update)
    |
    v
TickResult (energy stats, flips, actions, coalitions)
```

---

## COMPLEXITY

**Time:** O(N * E) per tick -- where N is citizen count (~200) and E is average edges per citizen (~50). Surplus propagation is the bottleneck at O(N * E). WM selection is O(N * K * log(K)) where K=7, negligible.

**Space:** O(N * (V + E)) -- where V is average nodes per citizen (~100) and E is average edges (~50). For 200 citizens: ~200 * 150 = 30,000 graph elements. FalkorDB handles this comfortably.

**Bottlenecks:**
- Surplus propagation at 200+ citizens with dense graphs (>100 edges each) -- target: <500ms per tick
- At-scale consensus with all 200+ citizens -- target: <2 seconds
- Crystallization candidate search (all node pairs) -- O(V^2) per citizen, needs optimization via activation threshold pre-filter

---

## HELPER FUNCTIONS

### `computeEffectiveActivation(node, drives)`

**Purpose:** Calculate drive-biased activation for WM selection.

**Logic:** Base activation (energy * recency) multiplied by drive-specific modifiers. Each drive amplifies relevant node types: curiosity amplifies novel/desire nodes, care amplifies relationship nodes, achievement amplifies process/goal nodes, self-preservation amplifies threat/negative-valence nodes, novelty hunger amplifies low-recency nodes.

### `estimateCost(citizen)`

**Purpose:** Predict API cost for a citizen's LLM call.

**Logic:** Based on WM coalition size (tokens per node * K), conversation history length, and provider pricing. Used by consciousness level assignment to budget allocations.

### `miniTick(graph, stimulusNode)`

**Purpose:** Run a single lightweight physics cycle for subconscious query.

**Logic:** Inject stimulus energy, propagate one round of surplus, read resulting energy distribution. No decay, no crystallization, no moment flip detection -- just energy flow. Completes in <1ms per citizen.

### `generateLabel(a, b)`

**Purpose:** Create a human-readable label for a crystallized narrative node.

**Logic:** Concatenates the most salient attributes of nodes a and b into a descriptive phrase. Used for debugging and for LLM context when the crystallized node enters WM.

---

## INTERACTIONS

| Module | What We Call | What We Get |
|--------|--------------|-------------|
| `src/server/graph-client.js` | `queryGraph()`, `writeGraph()` | Graph reads/writes to FalkorDB |
| `.mind/runtime/physics/` | `executeTick()` | Physics tick results (energy deltas, moment flips) |
| `src/server/ai-citizens.js` | `getCitizenState()`, `updateCitizenState()` | Citizen conversation state, active conversations |
| LLM Providers (Claude/GPT/Mistral) | `complete(prompt)` | Articulated text response |
| `src/server/physics-bridge.js` | `bridgeTick()` | Tick scheduling, result forwarding |

---

## MARKERS

<!-- @mind:todo Optimize crystallization candidate search -- current O(V^2) is too expensive for dense graphs -->
<!-- @mind:todo Implement LLM Router with provider failover and cost tracking -->
<!-- @mind:todo Design the mini-tick for subconscious query -- how much physics is "enough" for meaningful resonance -->
<!-- @mind:proposition Consider adaptive K for WM coalition -- citizens with richer graphs might benefit from K=9 -->
<!-- @mind:escalation Conservation proof assumes instantaneous propagation -- need to verify under concurrent tick access -->
