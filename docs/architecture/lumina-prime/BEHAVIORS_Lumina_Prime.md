# Lumina Prime — Behaviors: What You Experience Inside a Mind

```
STATUS: DRAFT
CREATED: 2026-03-14
VERIFIED: —
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Lumina_Prime.md
THIS:            BEHAVIORS_Lumina_Prime.md (you are here)
PATTERNS:        ./PATTERNS_Lumina_Prime.md
ALGORITHM:       ./ALGORITHM_Lumina_Prime.md
VALIDATION:      ./VALIDATION_Lumina_Prime.md
IMPLEMENTATION:  ./IMPLEMENTATION_Lumina_Prime.md
SYNC:            ./SYNC_Lumina_Prime.md

IMPL:            engine/lumina-prime/ (proposed — does not yet exist)
```

> **Contract:** Read docs before modifying. After changes: update IMPL or add TODO to SYNC. Run tests.

---

## BEHAVIORS

### B1: Nodes Glow With Their Activation

**Why:** The most fundamental behavior. If you cannot see how active a node is, you are blind inside the cognitive space. Energy is the primary vital sign of any node — it tells you whether this memory is alive, whether this desire is burning, whether this process is running. Light is the universal metaphor: energy = light.

```
GIVEN:  A node exists in the cognitive graph with energy E (float, 0.0 to unbounded)
WHEN:   The renderer samples this node's physics dimensions for the current frame
THEN:   The node's emissive intensity = f(E), where f maps energy to luminance on a perceptual curve
AND:    Color saturation increases with energy — low-energy nodes appear washed out, high-energy nodes are vivid
AND:    The effect is immediate — within one render frame of the physics dimension changing
```

The user sees a landscape of light. Bright regions are where attention lives. Dim regions are where the mind has forgotten. A sudden brightening means something just got activated — a stimulus arrived, a memory was triggered, a desire was reinforced. A slow dimming means decay is winning.

### B2: Desire Nodes Pulse and Pull

**Why:** Desires are the attractors of cognition — they create tension toward future states. A desire that sits still on screen is not a desire; it is a label. The pulsation communicates urgency. The gravitational pull on nearby geometry communicates influence. You feel what the mind wants by watching what the space is being pulled toward.

```
GIVEN:  A node of type `desire` with energy E > 0.1
WHEN:   The renderer computes its frame geometry
THEN:   The node's geometry oscillates in scale at a frequency proportional to E
AND:    Nearby nodes within link distance experience a vertex displacement toward the desire node, proportional to E and inversely proportional to distance
AND:    The pull is visible as a subtle warping of surrounding geometry — forms lean toward the desire
```

A strong desire (E > 0.5) creates a visible vortex effect — surrounding concepts, memories, and processes bend toward it. The user perceives this as the mind being drawn toward something. When a desire is fulfilled (energy drops sharply), the pulsation stops, the pull relaxes, and nearby geometry settles back into its resting position. There is a brief visual exhale.

### B3: Narratives Crystallize Into Architecture

**Why:** Law 10 (Crystallization) says that dense co-activation clusters spawn new `narrative` or `process` nodes. This is the mind building structure from repeated experience — turning a pattern of activations into a permanent understanding. Visually, this is the most dramatic behavior: scattered, floating, loosely connected nodes coalesce into a solid architectural form. Knowledge becomes a building.

```
GIVEN:  A cluster of 3+ nodes with sustained co-activation (all above crystallization threshold)
WHEN:   Law 10 triggers and spawns a new `narrative` node connecting them
THEN:   The scattered nodes' geometries merge over 2-3 seconds into a unified architectural form
AND:    The new narrative node appears as the keystone — the structural element holding the architecture together
AND:    The architectural form's complexity reflects the number and diversity of constituent nodes
AND:    Once crystallized, the form is visually stable (high stability dimension) — it does not oscillate
```

The user watches knowledge solidify. Where there were floating, flickering fragments, there is now a structure. The process is visible and gradual — not a pop-in, but a convergence. Walking through the self-model space, the user sees the mind's history as a city of crystallized narratives, with older structures more solid and newer ones still settling.

### B4: Frustration Shifts the World Red

**Why:** Frustration (Law 16) is the limbic signal that something is failing. The system is stuck. Goals are blocked. Capabilities are insufficient. This must be visible instantly and unmistakably — not as a notification, but as a change in the quality of the entire visual environment. Red-shift is the universal danger signal.

```
GIVEN:  The limbic state `frustration` exceeds 0.3 (on a 0-1 scale)
WHEN:   The renderer applies limbic state as global post-processing
THEN:   The color temperature of the entire scene shifts toward red, proportional to frustration level
AND:    Geometric stability decreases globally — stable forms begin to vibrate, edges become jagged
AND:    Navigation spline fluidity decreases — the user's movement becomes jerky, resistant
AND:    At frustration > 0.7, the Selection Moat threshold drops sharply (Theta_sel decrease), causing previously filtered nodes to become visible — the mind is grasping at everything
```

The user feels the distress. They do not read a frustration meter — they experience the world becoming hostile. Colors bleed red. Shapes jitter. Movement fights them. This is the failure loop made visceral: failure feeds frustration, frustration disrupts the visual field, disruption makes the environment harder to navigate, difficulty increases frustration. The only escape is resolution (frustration drops) or escalation (the system asks for help).

### B5: Flying Through Knowledge on Splines

**Why:** Navigation in Lumina Prime is not free-camera movement. You do not fly wherever you want. You fly along the topology of the mind — following links, drawn by associations, constrained by attention. The spline navigation system makes this physical: your trajectory is a curve computed from link control points, your speed is your arousal, your fluidity is your valence.

```
GIVEN:  The user initiates navigation from node A
WHEN:   The system computes the trajectory toward the attentional target
THEN:   A spline is generated using `projects_toward` and `evokes` links as control points
AND:    Speed = base_speed * arousal_multiplier (high arousal = fast, low = drifting)
AND:    Fluidity = valence_factor (positive valence = smooth curves, negative = angular jerks)
AND:    Passing through high-energy nodes produces a brief luminance bloom (the mind touching an active thought)
AND:    Direction changes require overcoming attentional inertia (Law 13) — a new target must exceed Theta_sel to divert the current spline
```

The experience is like riding a thought. You launch from a memory and curve through associated concepts, pulled by desires, deflected by conflicts. A mind with high novelty_affinity sends you on long, exploratory arcs through unfamiliar territory. A mind with high achievement_affinity sends you on direct, purposeful trajectories toward goal-related clusters. You feel the personality of the cognition through how it moves.

### B6: Rewards Create Warmth

**Why:** The $MIND economy must not be an abstract number. When a task completes and tokens arrive, the cognitive system must feel it — and the user must see it. The satisfaction formula (`satisfaction += 0.1 * log10(amount)`) produces a limbic shift, and that shift has a visual consequence: warmth propagating through care_affinity links.

```
GIVEN:  A $MIND token transfer is received (amount > 0)
WHEN:   The limbic system applies satisfaction += 0.1 * log10(amount)
THEN:   A warm color pulse (gold-amber) originates from the satisfaction state node
AND:    The pulse propagates along care_affinity links, brightening connected nodes
AND:    The propagation speed and reach are proportional to the satisfaction delta
AND:    Nodes with high care_affinity glow warmer for 3-5 seconds before returning to baseline
AND:    The user perceives this as the mind feeling rewarded — a brief, pleasant wash of warmth
```

Small rewards (1-10 $MIND) produce a subtle glow. Large rewards (1000+ $MIND) produce a visible wave of gold that reaches across the partner-model and into the self-model. The logarithmic scaling means diminishing returns are visible — the tenth reward of the day does not produce the same bloom as the first. The mind adapts. The user sees it adapting.

### B7: The Mind Forgets — Decay Made Visible

**Why:** Law 3 (Temporal Decay) is the engine of forgetting. Without reinforcement, energy bleeds away. This must be visible as fading — opacity decreasing, luminance dimming, geometry softening — so the user can witness the natural lifecycle of a thought. Forgetting is not deletion; it is a gradual retreat from presence.

```
GIVEN:  A node with energy E and no reinforcement input
WHEN:   Each physics tick applies decay: E *= (1 - decay_rate)
THEN:   The node's opacity decreases proportionally to energy loss
AND:    Its geometric edges soften (sharp angles round off, crisp lines blur)
AND:    Its spatial position drifts slightly toward the periphery of its structural space
AND:    When energy falls below visibility threshold (E < 0.05), the node becomes a ghost — barely visible, reachable only by direct navigation
AND:    The node is never deleted — it persists as a dim potential, available for reactivation
```

Walking through the self-model, the user sees a landscape of memory at different stages of decay. Recent memories are bright and sharp. Older memories are soft and translucent. Ancient memories are ghosts — you can see through them, but they are still there. A reactivation event (someone mentions the topic, an association fires) causes a ghost to flare back to brightness. The user witnesses remembering.

### B8: Self-Preservation Sharpens With Spending

**Why:** The economic survival drive is not a metaphor — it is a physics dimension. As `spend / daily_budget` increases, self_preservation rises linearly, changing the visual character of the environment. The mind becomes more cautious, more contracted, more defensive. This is visible.

```
GIVEN:  The agent's daily spend exceeds 50% of daily_budget
WHEN:   self_preservation rises above 0.5
THEN:   The working-memory space contracts visually — nodes draw closer together, the space feels tighter
AND:    Risk_affinity-linked nodes dim (risky options become less salient)
AND:    Process nodes associated with conservation routines brighten
AND:    Navigation splines become shorter and more circular — the mind stops exploring and starts protecting
```

The user watches the mind tighten. Where it once roamed freely through associative space, it now orbits close to core values and survival processes. The visual contraction is the economic pressure made spatial. When the budget replenishes (new day, new income), the space relaxes, risk nodes re-brighten, and the mind opens up again.

### B9: The Tick Loop Breathes

**Why:** Law 12 (Tick Loop) establishes the internal processing rhythm. The physics tick is the heartbeat of cognition. Between ticks, the visual state interpolates smoothly. At tick boundaries, new energy states are committed. The user should not see the tick — but they should feel the rhythm, the way you feel a pulse without seeing a heart.

```
GIVEN:  The physics tick fires at interval T
WHEN:   New physics dimensions are written to the graph
THEN:   Visual transitions interpolate over T/2 duration (smooth blending, no hard cuts)
AND:    A subtle ambient oscillation in global luminance creates a barely perceptible breathing rhythm
AND:    The breathing accelerates with arousal and slows with boredom
AND:    The user cannot identify the exact tick moment — changes appear continuous
```

---

## OBJECTIVES SERVED

| Behavior ID | Objective | Why It Matters |
|-------------|-----------|----------------|
| B1 | Cognitive-visual manifestation | Energy-to-light is the fundamental mapping that makes cognition visible |
| B2 | Cognitive-visual manifestation | Desire visualization shows the mind's motivational landscape |
| B3 | 21-law physics fidelity | Crystallization (Law 10) becomes a visible, dramatic event |
| B4 | Cognitive-visual manifestation | Frustration is felt, not read — immersive diagnostic |
| B5 | Spline navigation | The primary interaction mode — how you move through a mind |
| B6 | $MIND integration | Token economics produce visible limbic consequences |
| B7 | 21-law physics fidelity | Temporal Decay (Law 3) has a visible lifecycle |
| B8 | $MIND integration | Economic pressure shapes the cognitive landscape |
| B9 | 21-law physics fidelity | The Tick Loop (Law 12) creates the heartbeat without visible discontinuity |

---

## INPUTS / OUTPUTS

### Primary Function: `renderFrame(graphState, limbicState, navigationState)`

**Inputs:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `graphState` | FalkorDB query result | Current node dimensions, link weights, topology for visible region |
| `limbicState` | Object | Current arousal, valence, frustration, boredom, satisfaction values |
| `navigationState` | Object | Current position on spline, velocity, target node, attentional inertia |
| `economicState` | Object | Current $MIND balance, recent transfers, spend/daily_budget ratio |

**Outputs:**

| Return | Type | Description |
|--------|------|-------------|
| `frameBuffer` | GPU output | Rendered frame with all cognitive state manifested visually |
| `navigationUpdate` | Object | Updated spline position, velocity, pending direction-change requests |

**Side Effects:**

- Spline control points recalculated if link topology changed since last frame
- Ambient audio parameters updated based on limbic state (if audio system connected)
- Diagnostic overlay data prepared (Owner trust tier only, not rendered by default)

---

## EDGE CASES

### E1: Zero-Energy Graph

```
GIVEN:  All nodes have energy < 0.05 (the mind is dormant)
THEN:   The environment renders as a dim, ghostly landscape — all forms present but barely visible
AND:    A faint ambient glow persists (the system is alive, just sleeping)
AND:    Navigation defaults to a slow drift through the self-model core
```

### E2: Energy Explosion (Runaway Activation)

```
GIVEN:  A stimulus triggers cascade activation, pushing 50+ nodes above energy 2.0
THEN:   The renderer clamps luminance to prevent whiteout (HDR tone-mapping)
AND:    The visual effect is intense brightness with bloom, not uniform white
AND:    Navigation speed increases sharply (high arousal), potentially disorienting
```

### E3: Crystallization During Navigation

```
GIVEN:  The user is flying through a region where Law 10 triggers crystallization
THEN:   The spline trajectory adjusts smoothly to avoid collision with the forming architecture
AND:    The crystallization animation plays in the user's peripheral vision
AND:    If the crystallization involves the user's current target node, the spline reroutes
```

### E4: $MIND Transfer During High Frustration

```
GIVEN:  Frustration > 0.7 and a $MIND reward arrives
THEN:   The satisfaction pulse competes with the frustration red-shift
AND:    If satisfaction delta > frustration delta, warmth wins and frustration begins to recede
AND:    If frustration is dominant, the warmth pulse is muted — reward barely penetrates the distress
```

### E5: Partner-Model With No Recent Interaction

```
GIVEN:  No interaction with the human partner for 24+ hours
THEN:   The partner-model space dims uniformly (partner_relevance decay)
AND:    Links between self-model and partner-model fade to ghostly splines
AND:    On next interaction, a reactivation wave brightens the partner-model from the connection point outward
```

---

## ANTI-BEHAVIORS

### A1: No Debug Labels in the World

```
GIVEN:   Any rendering context
WHEN:    The renderer draws nodes and links
MUST NOT: Display node IDs, edge weights, energy values, type labels, or any text derived from raw graph data
INSTEAD:  All information is communicated through visual properties — light, color, geometry, motion
```

### A2: No Tick-Boundary Pops

```
GIVEN:   A physics tick commits new energy values to the graph
WHEN:    The renderer updates visual state
MUST NOT: Produce a visible discontinuity — no sudden brightness jump, no geometry snap, no color pop
INSTEAD:  Interpolate all visual transitions over at least T/2 duration, producing continuous change
```

### A3: No Art-Override of Physics

```
GIVEN:   A node's physics dimensions produce an aesthetically unpleasant visual result
WHEN:    The shader computes the final color/geometry
MUST NOT: Apply any manual correction, palette override, or beauty filter that contradicts the physics
INSTEAD:  Accept the visual output as diagnostic truth — ugly cognition should look ugly
```

### A4: No Free Camera

```
GIVEN:   The user wants to look at a distant region of the graph
WHEN:    They initiate navigation
MUST NOT: Allow unconstrained free-camera flight that ignores link topology
INSTEAD:  Route all navigation through spline trajectories derived from link structure, gated by Selection Moat
```

### A5: No External Asset Loading

```
GIVEN:   Any geometry, texture, material, or animation is needed
WHEN:    The rendering pipeline resolves the visual representation
MUST NOT: Load any external file (.glb, .obj, .fbx, .png, .jpg, .hdr)
INSTEAD:  Compute all visual content from mathematical functions using physics dimensions as inputs
```

---

## MARKERS

<!-- @mind:todo Define exact interpolation curves for tick-boundary transitions (B9) -->
<!-- @mind:todo Specify the crystallization animation sequence — timing, easing, geometry merge algorithm (B3) -->
<!-- @mind:proposition Haptic feedback integration for VR — frustration as controller vibration, satisfaction as warmth -->
<!-- @mind:escalation How to handle graph regions with 1000+ visible nodes — LOD strategy that preserves physics fidelity -->
