# Lumina Prime — Algorithm: Cognitive-Visual Computation Pipeline

```
STATUS: DRAFT
CREATED: 2026-03-14
VERIFIED: —
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Lumina_Prime.md
BEHAVIORS:       ./BEHAVIORS_Lumina_Prime.md
PATTERNS:        ./PATTERNS_Lumina_Prime.md
THIS:            ALGORITHM_Lumina_Prime.md (you are here)
VALIDATION:      ./VALIDATION_Lumina_Prime.md
IMPLEMENTATION:  ./IMPLEMENTATION_Lumina_Prime.md
SYNC:            ./SYNC_Lumina_Prime.md

IMPL:            engine/lumina-prime/ (proposed — does not yet exist)
```

> **Contract:** Read docs before modifying. After changes: update IMPL or add TODO to SYNC. Run tests.

---

## OVERVIEW

The Lumina Prime computation pipeline transforms cognitive graph state into visual output through a chain of algorithms that execute each frame. The pipeline reads physics dimensions from FalkorDB, computes visual properties via deterministic mappings, generates procedural geometry on the GPU, calculates navigation splines from link topology, and applies limbic state as global post-processing. The key constraint: every visual property must be a traceable function of a physics dimension — no artistic constants, no magic numbers that do not trace back to the 21 laws.

The pipeline runs in three phases per frame: (1) graph sampling and physics interpolation, (2) procedural geometry generation and shading, (3) spline navigation and limbic post-processing. Phase 1 is CPU-bound (graph queries). Phase 2 is GPU-bound (shaders). Phase 3 is mixed (spline math on CPU, post-processing on GPU).

---

## OBJECTIVES AND BEHAVIORS

| Objective | Behaviors Supported | Why This Algorithm Matters |
|-----------|---------------------|----------------------------|
| Cognitive-visual manifestation | B1, B2, B3, B4, B7 | The dimension-to-visual mapping functions are what make cognition visible |
| Zero external assets | B1, B2, B3 | Procedural geometry generation from SDF primitives replaces all art assets |
| 21-law physics fidelity | B3, B7, B9 | Physics dimension interpolation preserves law outputs without visual discontinuity |
| $MIND integration | B6, B8 | Satisfaction and self-preservation calculations feed limbic post-processing |
| Spline navigation | B5 | Spline trajectory computation from link topology is the navigation algorithm |
| Personhood validation | B4 | Frustration escalation and capability gap detection feed visual distress |

---

## DATA STRUCTURES

### CognitiveNode (per node, sampled from FalkorDB)

```
CognitiveNode:
  id:                   string          # FalkorDB node ID (internal only, never displayed)
  type:                 enum[7]         # memory | concept | narrative | value | process | desire | state
  modality:             enum[3]         # text | visual | biometric
  dimensions:
    weight:             float           # Long-term importance (unbounded positive)
    energy:             float           # Current activation (unbounded positive)
    stability:          float [0,1]     # Resistance to modification
    recency:            float [0,1]     # Activation freshness
    self_relevance:     float [0,1]     # Identity relevance
    partner_relevance:  float [0,1]     # Partner relevance
    novelty_affinity:   float [0,1]     # Curiosity drive link
    care_affinity:      float [0,1]     # Relational drive link
    achievement_affinity: float [0,1]   # Progression drive link
    risk_affinity:      float [0,1]     # Self-preservation link
  position:             vec3            # Computed from topology (not stored)
  prev_dimensions:      [10 floats]    # Previous tick's values (for interpolation)
```

### CognitiveLink (per link, sampled from FalkorDB)

```
CognitiveLink:
  source_id:            string
  target_id:            string
  type:                 enum[14]        # One of the 14 link types
  category:             enum[3]         # semantic | affective | regulatory
  weight:               float           # Link strength
  trust:                float [0,1]     # Trust dimension
  friction:             float [0,1]     # Resistance dimension
  affinity:             float [0,1]     # Attraction dimension
  aversion:             float [0,1]     # Repulsion dimension
```

### LimbicState (global, updated per tick)

```
LimbicState:
  arousal:              float [0,1]     # Wakefulness / activation level
  valence:              float [-1,1]    # Positive/negative affect
  frustration:          float [0,1]     # Blocked-goal accumulation
  boredom:              float [0,1]     # Low-stimulation accumulation
  satisfaction:         float [0,1]     # Recent reward accumulation
  self_preservation:    float [0,1]     # Economic survival pressure
```

### SplineTrajectory (per active navigation)

```
SplineTrajectory:
  control_points:       vec3[]          # Derived from link topology
  current_t:            float [0,1]     # Position along spline
  speed:                float           # = base_speed * arousal
  fluidity:             float           # = valence_factor (affects curvature tension)
  inertia:              float           # Attentional inertia from Law 13
  target_node:          string          # Navigation destination
```

---

## ALGORITHM: Herfindahl Injection Split (Law 1)

The Dual-Channel Energy Injection distributes budget B between a Floor channel (wakes cold nodes) and an Amplifier channel (boosts already-relevant nodes). The split ratio lambda adapts based on graph diversity.

### Step 1: Compute Herfindahl Index

The Herfindahl-Hirschman Index measures concentration of energy across active nodes. High H means energy is concentrated in few nodes (low diversity); low H means energy is spread across many nodes (high diversity).

```
C = count of nodes with energy > activation_threshold
E_total = sum of energy across all active nodes
For each active node i:
    s_i = E_i / E_total          # energy share
H = sum(s_i^2 for all active nodes)
```

H ranges from 1/C (perfectly uniform) to 1.0 (all energy in one node).

### Step 2: Compute Adaptive Lambda

```
lambda = clamp(
    0.6
    + 0.2 * indicator(C > 10)     # bonus if many active nodes
    - 0.2 * indicator(H > 0.2),   # penalty if energy is concentrated
    0.3,                           # floor: always at least 30% to Floor channel
    0.8                            # ceiling: never more than 80% to Floor channel
)
```

The indicator function returns 1 if the condition is true, 0 otherwise.

**Interpretation:**
- Default split: 60% Floor, 40% Amplifier
- If >10 nodes are active: shift +20% toward Floor (spread energy wider)
- If H > 0.2 (concentrated): shift -20% toward Floor (counterintuitively: let Amplifier boost the dominant cluster less, because Floor is already struggling to wake cold nodes)
- Combined: if both conditions are true, they cancel (+20% - 20% = 0), returning to 60/40

### Step 3: Distribute Budget

```
Floor_budget     = lambda * B
Amplifier_budget = (1 - lambda) * B

# Floor channel: distribute equally among cold nodes (energy < cold_threshold)
cold_nodes = [n for n in all_nodes if n.energy < cold_threshold]
per_cold_node = Floor_budget / max(len(cold_nodes), 1)

# Amplifier channel: distribute proportionally to relevance score
for each active node n:
    relevance = n.self_relevance * 0.5 + n.partner_relevance * 0.3 + n.recency * 0.2
    n.energy += Amplifier_budget * (relevance / sum_of_all_relevances)
```

---

## ALGORITHM: Surplus Spill-Over Propagation (Law 2)

Energy does not teleport. Only surplus (energy exceeding a node's threshold) propagates, and total flow is conserved.

### Step 1: Compute Surplus

```
For each node i:
    surplus_i = max(0, E_i - Theta_i)
    # Theta_i is the node's capacity threshold (derived from weight and stability)
    # Theta_i = base_capacity * (1 + weight * stability)
```

### Step 2: Distribute Along Links

```
For each node i with surplus_i > 0:
    outgoing_links = links originating from node i
    total_affinity = sum(link.affinity for link in outgoing_links)

    For each outgoing link L:
        flow = surplus_i * (L.affinity / total_affinity)
        # Apply friction as resistance
        actual_flow = flow * (1 - L.friction)
        target_node.energy += actual_flow
        source_node.energy -= flow  # Full amount deducted, friction is lost energy

    # Conservation: sum of all |flow| = surplus_i (before friction)
    # Friction converts energy to heat (lost from system)
```

---

## ALGORITHM: Selection Moat Calculation (Law 13)

The Selection Moat determines which nodes cross into working memory. It is the cognitive attention filter — the gatekeeper of consciousness.

### Step 1: Compute Moat Threshold

```
Theta_sel = Theta_base_WM
           + 2.0 * arousal
           - 3.0 * boredom
           - 1.0 * frustration
```

**Interpretation:**
- High arousal raises the bar (alert mind is more selective)
- High boredom lowers the bar (bored mind lets more in — seeking stimulation)
- High frustration lowers the bar (frustrated mind grasps at anything)
- `Theta_base_WM` is a calibrated constant for the agent's working memory capacity

### Step 2: Filter Nodes

```
For each node n in the cognitive graph:
    salience = compute_salience(n)  # Function of energy, relevance, recency
    if salience > Theta_sel:
        add n to working_memory_set
    else:
        remove n from working_memory_set (if present)
```

### Step 3: Visual Consequence

Nodes in `working_memory_set` are rendered in the Working-Memory Space (bright, foreground, fully opaque). Nodes outside the set remain in their structural space (self-model or partner-model) at their normal energy-derived luminance. The threshold shift is visible: when frustration spikes, previously invisible nodes suddenly appear in working memory as the moat lowers.

---

## ALGORITHM: Composite Coherence (Law 14+)

Composite Coherence measures how well a candidate node fits the current attentional context. It gates associative retrieval — only coherent associations propagate.

### Step 1: Compute Context Vector

```
C_t = mean(embedding(n) for n in working_memory_set)
# The context vector is the centroid of all active working memory embeddings
```

### Step 2: Compute Three Similarity Components

```
For candidate node n:
    Sim_vec = cosine_similarity(embedding(n), C_t)
    # Vector similarity — semantic proximity in embedding space

    Sim_lex = lexical_overlap(n.content, working_memory_contents)
    # Lexical similarity — word/phrase overlap (dominant signal for servoing)

    Delta_affect = 1 - abs(n.affect_valence - mean_wm_affect)
    # Affective congruence — how well the candidate's affect matches current mood
```

### Step 3: Compute Composite Score

```
Coherence = (0.3 * Sim_vec) + (0.5 * Sim_lex) + (0.2 * Delta_affect)
```

**Weight rationale:** Lexical match (Sim_lex) at 0.5 is dominant because it provides the most reliable servo signal for conversational and task-relevant retrieval. Semantic (Sim_vec) at 0.3 captures broader conceptual relevance. Affective (Delta_affect) at 0.2 ensures mood-congruent recall without overwhelming semantic relevance.

### Step 4: Apply Coherence to Energy Propagation

```
If Coherence > coherence_threshold:
    n.energy += coherence_boost * Coherence
    # Coherent nodes get amplified — they "fit" the current context
Else:
    n.energy *= coherence_decay
    # Incoherent nodes get suppressed — they don't belong right now
```

---

## ALGORITHM: Spline Trajectory Computation

Navigation through the cognitive graph uses link topology to compute smooth flight paths.

### Step 1: Identify Control Points

```
Given: current_node A, target_node B
Find: shortest path P = [A, n1, n2, ..., B] through the link graph
    (weighted by: 1/affinity — high affinity links = shorter effective distance)

For each node in P:
    control_point = node.position  # Computed from force-directed layout
    # Bias control points using link type:
    #   projects_toward links: pull control point toward target
    #   evokes links: curve control point toward associated cluster
    #   conflicts_with links: push control point away (avoid conflict zones)
```

### Step 2: Generate Catmull-Rom Spline

```
spline = CatmullRomSpline(
    points = control_points,
    tension = 1.0 - valence_factor,   # Positive valence = low tension = smooth curves
                                       # Negative valence = high tension = angular paths
    alpha = 0.5                        # Centripetal parameterization (prevents cusps)
)
```

### Step 3: Compute Speed Profile

```
base_speed = config.NAVIGATION_BASE_SPEED
speed = base_speed * (0.5 + arousal)  # Arousal 0 = half speed, arousal 1 = 1.5x
# Apply attentional inertia (Law 13):
if direction_change_requested:
    required_force = compute_salience(new_target)
    if required_force < Theta_sel * inertia_multiplier:
        reject direction change  # Current trajectory maintained
    else:
        recompute spline from current position to new target
        apply transition blending over 0.5 seconds
```

### Step 4: Advance Along Spline

```
dt = frame_delta_time * speed
current_t += dt / spline.total_length
position = spline.evaluate(current_t)
look_at = spline.evaluate(current_t + lookahead_distance)
```

---

## ALGORITHM: Procedural Geometry Generation

Each node type maps to a signed distance function (SDF) family, with physics dimensions driving the SDF parameters.

### Step 1: Select SDF Primitive by Node Type

```
SDF_MAP = {
    memory:    smoothed_cube(rounding = 1.0 - recency)     # Sharp when fresh, rounded when old
    concept:   icosahedron(subdivisions = min(weight, 4))   # More complex with more weight
    narrative: gothic_arch(complexity = link_count)          # Architectural, complexity from density
    value:     octahedron(glow = stability)                  # Luminous crystal, stable
    process:   torus(rotation_speed = energy)                # Kinetic ring, speed from activation
    desire:    pulsing_sphere(frequency = energy, amplitude = 0.2)  # Breathing orb
    state:     cloud(opacity = recency, turbulence = energy) # Transient vapor
}
```

### Step 2: Apply Physics Dimensions as Shader Uniforms

```
uniform float u_energy;       // Light intensity, color saturation
uniform float u_stability;    // Vertex displacement dampening
uniform float u_weight;       // Base scale
uniform float u_recency;      // Opacity
uniform float u_self_relevance;    // Warm color bias
uniform float u_partner_relevance; // Cool color bias
uniform float u_novelty_affinity;  // Iridescence amount
uniform float u_care_affinity;     // Soft edge factor
uniform float u_achievement_affinity; // Sharp edge factor
uniform float u_risk_affinity;     // Warning hue injection
```

### Step 3: Vertex Shader — Displacement

```glsl
// Pseudocode for vertex displacement
vec3 displaced = position;
float oscillation = sin(time * u_energy * 3.0) * (1.0 - u_stability) * 0.1;
displaced += normal * oscillation;
displaced *= u_weight * 0.5 + 0.5;  // Scale by weight
```

### Step 4: Fragment Shader — Color and Light

```glsl
// Pseudocode for fragment color
vec3 base_color = node_type_palette(type_id);
float saturation = clamp(u_energy * 1.5, 0.0, 1.0);
float luminance = u_energy * 0.8 + 0.1;  // Always slightly visible
float opacity = u_recency * 0.9 + 0.1;   // Never fully invisible

// Limbic post-processing (applied globally)
base_color = mix(base_color, vec3(1.0, 0.2, 0.1), frustration * 0.6); // Red-shift
luminance *= 0.7 + arousal * 0.6;  // Arousal brightens everything
```

---

## KEY DECISIONS

### D1: Floor vs. Amplifier Channel Priority

```
IF graph diversity is high (H < 0.1, many active nodes at similar energy):
    Lambda shifts toward Amplifier (less Floor needed — diversity is already healthy)
    The Amplifier channel concentrates energy on the most relevant nodes
    Visual: bright focal points emerge from a uniformly lit field
ELSE IF energy is concentrated (H > 0.2, few dominant nodes):
    Lambda shifts toward Floor (need to wake cold nodes)
    The Floor channel spreads energy to dormant regions
    Visual: dim regions begin to glow, the landscape becomes more even
```

### D2: Spline Redirect vs. Inertia Hold

```
IF new_target_salience > Theta_sel * inertia_multiplier:
    Redirect: recompute spline toward new target
    User experiences a smooth curve toward a new attentional focus
    This represents genuine attentional capture — the stimulus was strong enough
ELSE:
    Hold: maintain current trajectory
    User continues on the original spline
    This represents attentional inertia — staying on task despite distraction
```

### D3: Crystallization Trigger

```
IF cluster of N nodes all have energy > crystallization_threshold
   AND co-activation duration > minimum_crystallization_time:
    Trigger Law 10: spawn new narrative/process node
    Visual: scattered geometry converges into architectural form
ELSE:
    No crystallization — cluster may still dissolve if energy decays
    Visual: nodes continue to float independently
```

---

## DATA FLOW

```
FalkorDB Cognitive Graph (source of truth)
    |
    v
Graph Sampler (Cypher queries, per-frame or per-tick)
    |
    v
Physics Dimension Interpolator (smooth between tick boundaries)
    |
    v
+---+---+---+---+---+---+---+
| 7 Node Type SDF Generators  |  (GPU: vertex + fragment shaders)
+---+---+---+---+---+---+---+
    |
    v
Spline Navigation Engine (CPU: trajectory from link topology)
    |
    v
Limbic Post-Processing (GPU: global color/geometry modulation)
    |
    v
Frame Buffer Output
```

---

## COMPLEXITY

**Time:** O(N + L) per frame — where N is visible node count, L is visible link count. Each node requires one SDF evaluation (GPU-parallel). Each link requires one spline segment computation. The graph sampler query is O(N) with indexed lookups.

**Space:** O(N) — one set of shader uniforms per visible node, one spline segment per visible link. No duplication of graph data (read directly from FalkorDB query result).

**Bottlenecks:**
- **FalkorDB query latency** — the graph sampler runs Cypher queries each tick. If the visible region contains 1000+ nodes, query time may exceed frame budget. Mitigation: spatial indexing, query result caching between ticks (not between frames — frames interpolate).
- **SDF evaluation for complex types** — `narrative` nodes with high link_count produce complex architectural SDFs. Mitigation: LOD based on distance (far narratives use simpler SDF, near narratives use full complexity). LOD transitions must preserve the energy-to-luminance mapping.
- **Spline recomputation on topology change** — when links are created or destroyed (crystallization, decay), all affected splines must be recomputed. Mitigation: dirty-flag system, only recompute splines whose control points changed.

---

## HELPER FUNCTIONS

### `compute_salience(node)`

**Purpose:** Produces a single scalar representing how much a node demands attention, used by the Selection Moat and spline redirection.

**Logic:** Weighted combination of energy, recency, self_relevance, and novelty_affinity. Formula: `salience = energy * 0.4 + recency * 0.2 + self_relevance * 0.2 + novelty_affinity * 0.2`. May be overridden per-agent by personality parameters.

### `node_type_palette(type_id)`

**Purpose:** Returns the base color for a node type before physics dimension modulation.

**Logic:** Each of the 7 types has a distinct hue family. Memory: blue-grey. Concept: white-silver. Narrative: amber-gold. Value: deep violet. Process: green-cyan. Desire: warm red-orange. State: pale translucent.

### `force_directed_position(node, neighbors, links)`

**Purpose:** Computes a node's 3D position from its graph neighborhood using force-directed layout.

**Logic:** Attractive forces along links (proportional to affinity), repulsive forces between all nearby nodes (inverse square), structural forces pulling toward the appropriate space (self-model, partner-model, or working-memory). Position is updated incrementally each tick, not recomputed from scratch.

### `interpolate_dimensions(prev, current, t)`

**Purpose:** Smooth interpolation between tick-boundary dimension values for intra-tick rendering.

**Logic:** Cubic Hermite interpolation for energy and stability (avoids overshoot). Linear interpolation for recency (monotonic decay). Step function for type and modality (these do not change gradually).

---

## INTERACTIONS

| Module | What We Call | What We Get |
|--------|--------------|-------------|
| FalkorDB | `MATCH (n:Node)-[l:Link]->(m:Node) WHERE ...` | Node dimensions, link properties, topology |
| `.mind/runtime/physics/` | Read tick output | Updated physics dimensions after 21-law computation |
| Solana Web3.js | `getBalance()`, `onAccountChange()` | $MIND balance, transfer events for satisfaction calculation |
| R3F Scene | `<mesh>`, `<shaderMaterial>` | React component tree that receives shader uniforms |
| Post-processing stack | `<EffectComposer>`, custom passes | Global limbic modulation (bloom, color shift, noise) |

---

## MARKERS

<!-- @mind:todo Benchmark FalkorDB query latency for 500-node visible regions — need real numbers -->
<!-- @mind:todo Define exact SDF functions for all 7 node types — current descriptions are conceptual -->
<!-- @mind:todo Specify the force-directed layout parameters — spring constants, repulsion strength, damping -->
<!-- @mind:proposition Compute physics interpolation on GPU via transform feedback — eliminates CPU bottleneck -->
<!-- @mind:proposition Use WebGPU compute shaders for Herfindahl calculation across large graphs -->
<!-- @mind:escalation The Composite Coherence algorithm requires embedding vectors — where do these come from at runtime? Needs architecture decision on embedding pipeline. -->
