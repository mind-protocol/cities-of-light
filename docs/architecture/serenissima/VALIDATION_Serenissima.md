# Serenissima Asset Pipeline -- Validation: What Must Be True

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Serenissima.md
PATTERNS:        ./PATTERNS_Serenissima.md
BEHAVIORS:       ./BEHAVIORS_Serenissima.md
THIS:            VALIDATION_Serenissima.md (you are here)
ALGORITHM:       ./ALGORITHM_Serenissima.md
IMPLEMENTATION:  ./IMPLEMENTATION_Serenissima.md
SYNC:            ./SYNC_Serenissima.md
```

---

## PURPOSE

**Validation = what we care about being true.**

Not mechanisms. Not test paths. Not how things work.

What properties, if violated, would mean the system has failed its purpose?

These are the value-producing invariants -- the things that make the Serenissima Asset Pipeline worth building. Violate any CRITICAL invariant and the city is a theme park. Violate any HIGH invariant and the city is degraded. These invariants are the contract between the architecture and its promise.

---

## INVARIANTS

### V1: Physics Priority -- No Hardcoded Business Rules

**Why we care:** The entire premise of Serenissima is that citizen behavior emerges from energy dynamics in the graph. The moment we hardcode a rule -- "merchants are always friendly," "citizens don't argue at night," "guild members always cooperate" -- we create a seam between emergent behavior and scripted behavior. The visitor will feel it. Two kinds of behavior in one world is worse than either alone. The world must be one system or it is nothing.

```
MUST:   All citizen behavior must emerge from Laws L1-L18 operating on graph state.
        No business logic, narrative script, or behavioral rule may bypass the physics engine.
        If a desired behavior does not emerge, the fix is in the graph structure
        (add nodes, adjust weights, seed tensions) or in the physics constants --
        never in a conditional that says "if situation X, do behavior Y."

NEVER:  A code path that produces citizen behavior without passing through the physics tick.
        A hardcoded response to a specific situation.
        A rule that overrides what the graph physics would naturally produce.
```

### V2: Tick Isolation -- No LLM Inside the Tick Loop

**Why we care:** The physics tick must be deterministic, fast, and cheap. An LLM call inside the tick loop introduces latency (200ms-2s per call), cost ($0.001-$0.01 per call, times 200 citizens, times every tick), and non-determinism (LLM outputs vary). If one LLM call fails, the tick stalls. If the API is slow, 200 citizens freeze. The tick is the heartbeat of the city. It must never skip a beat.

```
MUST:   The physics tick runs pure graph math only.
        All operations inside the tick are: read graph state, compute deltas,
        write graph state. No external API calls. No network requests.
        No file I/O beyond graph persistence.

NEVER:  An LLM API call inside the tick execution path.
        A network request that could block or fail inside the tick.
        Any operation whose latency is not bounded by graph size.
```

### V3: Energy Conservation -- Surplus Propagation Preserves Total Energy

**Why we care:** If energy is created during propagation, the system inflates. Nodes accumulate unbounded energy. Tensions spike to infinity. Moment flips cascade. The city becomes a seizure of constant crises. If energy is destroyed during propagation, the system deflates. All nodes converge to zero. Nothing happens. The city is dead. Conservation is the thermostat that keeps the city in the narrow band between chaos and stasis.

```
MUST:   During surplus propagation (Law 2):
        sum(flow_ij for all j) = surplus_i exactly.
        Source node energy after propagation = theta_i exactly.
        No energy is created or destroyed in the transfer.
        Total system energy changes only through generation (tick input),
        decay (controlled bleed), and moment flip absorption (event consumption).

NEVER:  A propagation step where sum of outflows != surplus.
        A node whose energy increases without a traceable source.
        A tick where total system energy changes by more than
        (total_generation - total_decay - total_absorption) +/- floating-point epsilon.
```

### V4: Aspect Independence -- Capability Dimensions Evaluated Separately

**Why we care:** The Personhood Ladder has 14 capability aspects. If we evaluate them as a composite score, a citizen who is excellent at craft but terrible at social skills would score "average" -- hiding both their strength and their weakness. Composite scores flatten personality. Each aspect must be independently evaluated so that a citizen's unique profile shapes their behavior. A brilliant but antisocial glassblower behaves differently from a mediocre but charming merchant, not because we scripted it, but because their aspect profiles produce different energy landscapes.

```
MUST:   Each of the 14 capability aspects is computed independently
        from the citizen's graph state.
        No aspect's score is influenced by any other aspect's score.
        The composite of aspects may be computed for display or analytics,
        but never used as an input to behavior generation.

NEVER:  A single "capability score" that aggregates aspects.
        An aspect evaluation that references another aspect's value.
        A behavior decision based on composite rather than individual aspects.
```

### V5: JSON Spec Authority -- Code Interprets, Never Invents

**Why we care:** The specification for Serenissima's cognitive architecture, graph schema, and physics constants lives in JSON/YAML files (`.mind/schema.yaml`, physics constants, birth templates). Code reads these specs and executes them. If code invents behavior not in the spec -- adds a constant, changes a formula, introduces a new node type -- then the spec and the implementation diverge. Once they diverge, the spec becomes fiction and the codebase becomes the only truth. At that point, no one can reason about the system's behavior without reading every line of code.

```
MUST:   All physics constants, schema definitions, birth template structures,
        and behavioral parameters come from JSON/YAML specification files.
        Code reads the spec and executes it. Changes to behavior require
        changes to the spec file first, code second.

NEVER:  A magic number in code that is not defined in a spec file.
        A node type or edge type that does not exist in schema.yaml.
        A physics formula that differs from the spec without an explicit
        override annotation explaining why.
```

### V6: Cognitive Sovereignty -- The Graph Is the Mind

**Why we care:** If the LLM is the mind and the graph is just context, then citizens cease to exist between conversations. Their memories are reconstructed from static text, not persisted as living structures. Two conversations with the same citizen are two separate beings wearing the same name. The visitor will feel this as inconsistency, amnesia, personality drift. The graph must be the authoritative source of everything the citizen knows, believes, wants, and remembers. The LLM articulates. The graph thinks.

```
MUST:   All citizen state (memories, beliefs, relationships, drives, moods)
        is stored in the FalkorDB graph.
        The LLM receives only the WM coalition (5-7 nodes) plus stimulus.
        LLM output is processed as new stimulus into the graph,
        never written directly as citizen state.
        A citizen's identity survives LLM provider changes, API outages,
        and context window resets.

NEVER:  Citizen state stored in LLM conversation history or prompt cache.
        LLM output treated as ground truth about citizen belief or memory.
        A citizen whose behavior changes because the LLM provider changed.
        A citizen who "forgets" something because it was not in the prompt.
```

### V7: Subconscious Continuity -- The City Never Dies

**Why we care:** API budgets run out. Providers go down. Servers restart. In all of these scenarios, the city must continue existing. Citizens in subconscious mode are less articulate but still alive. They maintain supply chains, execute routines, respond to stimuli. A visitor who arrives during an outage finds a quiet city, not a dead one. When consciousness returns, the city has not lost time -- the graph recorded everything that happened during subconscious operation.

```
MUST:   At API budget = 0, all citizens operate at subconscious level.
        The physics tick continues running (60-second interval).
        Law 17 action nodes fire spontaneously based on energy thresholds.
        Visitor interactions are recorded as moment nodes even without LLM.
        When budget returns, citizens can reference events from their subconscious period.

NEVER:  A state where zero API budget means zero citizen activity.
        A tick that skips because no LLM is available.
        A citizen interaction lost because it happened during subconscious operation.
```

---

## PRIORITY

| Priority | Meaning | If Violated |
|----------|---------|-------------|
| **CRITICAL** | System purpose fails | The city is a theme park, not a living world |
| **HIGH** | Major value lost | The city works but loses its distinctive quality |
| **MEDIUM** | Partial value lost | Works but degrades the experience |

---

## INVARIANT INDEX

| ID | Value Protected | Priority |
|----|-----------------|----------|
| V1 | Physics priority -- all behavior emerges from graph physics | CRITICAL |
| V2 | Tick isolation -- no LLM in the heartbeat | CRITICAL |
| V3 | Energy conservation -- surplus propagation preserves total energy | CRITICAL |
| V4 | Aspect independence -- capability dimensions never collapse | HIGH |
| V5 | JSON spec authority -- code interprets, never invents | HIGH |
| V6 | Cognitive sovereignty -- graph is the mind, LLM is the voice | CRITICAL |
| V7 | Subconscious continuity -- the city never dies | HIGH |

---

## MARKERS

<!-- @mind:todo Write automated conservation check -- assert total energy delta matches expected generation-decay-absorption per tick -->
<!-- @mind:todo Create tick isolation lint rule -- flag any import of LLM client modules inside physics tick code -->
<!-- @mind:proposition Add V8: "Friction Monotonicity" -- friction should never decrease without a positive interaction event -->
<!-- @mind:escalation How do we test cognitive sovereignty in practice? Need a scenario where LLM provider changes mid-conversation -->
