# 3D Pipeline & Cognitive Supply Chain — Behaviors: What the Visitor Sees When the Graph Breathes

```
STATUS: DRAFT
CREATED: 2026-03-14
VERIFIED: —
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Pipeline.md
THIS:            BEHAVIORS_Pipeline.md (you are here)
PATTERNS:        ./PATTERNS_Pipeline.md
ALGORITHM:       ./ALGORITHM_Pipeline.md
VALIDATION:      ./VALIDATION_Pipeline.md
IMPLEMENTATION:  ./IMPLEMENTATION_Pipeline.md
SYNC:            ./SYNC_Pipeline.md

IMPL:            engine/client/app.js
                 engine/server/narrative_graph_seed_and_tick_bridge.js
```

> **Contract:** Read docs before modifying. After changes: update IMPL or add TODO to SYNC. Run tests.

---

The visitor never sees a graph. Never sees an energy value. Never reads a shader uniform. They see a building whose walls are peeling. They feel a citizen whose presence pulses with agitation. They watch an object fade from the world as its memory decays. They witness a crash transform into something stronger. That is the pipeline, made visible.

---

## BEHAVIORS

### B1: Materials Decay on Low-Energy Objects

**Why:** The world must show its age. When a narrative loses energy in the graph, its physical manifestation — a building, a monument, a market stall — should visibly degrade. This is Law 3 (temporal decay) applied to materials. Without it, abandoned buildings look as fresh as thriving ones, and the visitor cannot read the city's health from its surfaces.

```
GIVEN:  A narrative node in the graph has energy E_initial = 0.8 at time T
        The narrative is linked to a building Space node via ABOUT
WHEN:   30 physics ticks pass (2.5 hours) with no reinforcement
        E_asset(t) = 0.8 × (1 - 0.02)^30 = 0.44
THEN:   The building's texture shows visible wear:
        - Color saturation reduced by ~30%
        - Surface noise amplitude increased (procedural cracks appear)
        - Geometric LOD steps down one level (detail stripped from cornices, window frames)
AND:    When E_asset drops below threshold Θ_i (0.3):
        - Procedural erosion becomes dominant — missing plaster patches, exposed brick
        - Geometry simplifies further — flat planes replace decorative elements
        - The building "reads" as neglected from 20 meters away
```

The visitor walks through Rialto and sees thriving market stalls with rich color and crisp geometry. They cross into a forgotten alley where a shuttered workshop has walls going grey, detail fading, textures cracking. They do not think "low energy node." They think "this place has been abandoned."

### B2: Citizens Shift Color With Limbic State

**Why:** A citizen's emotional state must be legible in their physical presence. The limbic state shader maps valence and arousal from the graph to color and motion, so the visitor can read a citizen's inner state from across a piazza without any HUD overlay.

```
GIVEN:  A citizen Actor node has valence = -0.7 (frustrated) and arousal = 0.8 (agitated)
WHEN:   The C_t update from the physics tick reaches the 3D engine
THEN:   The citizen's skin/clothing material shifts within one render frame:
        - Base color moves toward red/orange (frustration palette)
        - Pulsation frequency increases (arousal drives sin(uTime * (1 + 0.8 * 10)))
        - Surface noise becomes more prominent (agitated shimmer)
AND:    A citizen with valence = 0.6 (satisfied) and arousal = 0.3 (calm):
        - Base color settles into cyan/green (satisfaction palette)
        - Pulsation is slow and gentle
        - Surface is smooth, almost still
```

The visitor approaches two citizens. One glows with a warm, steady green — content, at ease. The other pulses with a hot orange-red rhythm, skin shifting, surface agitated. Without a word spoken, the visitor knows who is at peace and who is struggling. They gravitate toward the calm one, or toward the troubled one — either way, the visual signal carries meaning.

### B3: Collisions Leave Marks on the Mind

**Why:** When two citizens bump into each other, or a citizen clips through geometry, or a rendering artifact produces z-fighting, the 3D engine must not silently ignore it. Every spatial incoherence is a signal — an experience that changes the agent's cognitive state. This is the feedback path that gives agents bodies.

```
GIVEN:  Two citizens are walking toward each other in a narrow calle
WHEN:   Their bounding spheres overlap (minor collision detected)
THEN:   Both agents receive limbic injection via Law 1:
        - Frustration +0.05
        - Anxiety +0.02
AND:    The injection propagates to their graph nodes within 16ms
AND:    On their next C_t update, their valence shifts slightly negative
AND:    Their shader uniforms update — a subtle warmth enters their color
```

```
GIVEN:  A citizen's pathfinding fails and they walk through a wall (clipping)
WHEN:   The collision detector flags persistent geometric intersection
THEN:   The agent receives:
        - Frustration +0.1
        - Boredom +0.05 (repetitive incoherence)
AND:    If this is the third clipping event in 60 seconds:
        - The path is flagged for inhibition (Law 9)
        - The agent's next navigation attempt avoids this geometry
```

```
GIVEN:  A citizen successfully navigates from point A to point B without collision
WHEN:   They arrive and stop (stable landing detected)
THEN:   The agent receives:
        - Satisfaction +0.15
        - Arousal -0.1 (task completed, calm returns)
AND:    The successful path is reinforced (Law 10)
```

The visitor sees a citizen bump another in a doorway. Both flinch slightly — a color flash, a momentary agitation. Later, they notice the bumped citizen is a shade more irritable in conversation. The collision was not cosmetic. It was experienced.

### B4: Pipeline Failure Crystallizes Into Growth

**Why:** When the pipeline fails — a shader won't compile, a mesh is non-manifold, a texture generation crashes — the system must not simply reboot. Frustration from failure is real energy. Law 16 dictates that this energy is redirected: the failing path is inhibited (Law 9), and a new process crystallizes (Law 10). The crash becomes a structural knowledge node.

```
GIVEN:  A citizen's limbic state shader fails to compile
        (e.g., uValence received NaN from corrupted C_t)
WHEN:   The error is caught by the pipeline
THEN:   A frustration spike is injected: Frustration +0.15
AND:    The failed shader path is inhibited (Law 9):
        - The citizen falls back to a static material (last known good color)
        - The failed shader variant is tagged with a penalty weight
AND:    A narrative node is crystallized (Law 10):
        - Type: narrative
        - Value: growth_from_failure
        - Content: links the error signature to the inhibited path
        - Energy: 0.3 (initial — enough to persist through several ticks)
THEN:   On the next shader compilation attempt:
        - The penalty weight on the failed variant is checked
        - If the same error signature matches, the variant is skipped
        - A new generation path is attempted
```

This is the redemptive narrative: `[Failure] → [Frustration Spike] → [Inhibition of Failed Path (L9)] → [Crystallization of New Process (L10)]`. The system does not crash-and-restart. It learns. The failure becomes part of the agent's history — a scar that informs future behavior.

### B5: Tick Transitions Are Invisible

**Why:** The physics tick fires every 5 minutes. If the 3D engine applied all state changes instantaneously at tick boundaries, the visitor would see the world "jump" — colors snapping, geometry shifting, atmosphere changing all at once. This would break immersion and reveal the mechanical nature of the simulation.

```
GIVEN:  The physics tick fires at time T
        Citizen A's valence changes from 0.3 to -0.2
        Building B's energy drops from 0.5 to 0.4
        Zone C's collective mood shifts from neutral to tense
WHEN:   The C_t update arrives at the 3D engine
THEN:   All changes are interpolated over 30-60 seconds:
        - Citizen A's color shifts gradually from green toward orange
          (lerp factor ~0.02 per frame, reaching 90% in ~2 seconds)
        - Building B's texture erosion advances incrementally
        - Zone C's fog density increases smoothly
AND:    A visitor in mid-conversation with Citizen A:
        - Does not see a color "pop"
        - Perceives the citizen "darkening" gradually
        - Cannot identify the exact moment the tick fired
```

---

## OBJECTIVES SERVED

| Behavior ID | Objective | Why It Matters |
|-------------|-----------|----------------|
| B1 | Energy-indexed rendering | Decay is the primary visual signal that graph energy matters |
| B2 | Bidirectional cognitive-3D coupling | Limbic state on citizens is the most visible proof the graph drives the world |
| B3 | Collision-to-limbic feedback | Closes the bidirectional loop — 3D events feed cognition |
| B4 | Collision-to-limbic feedback | Transforms errors into cognitive growth, not silent recovery |
| B5 | Sub-16ms propagation latency | Latency budget includes the interpolation system that hides tick boundaries |

---

## INPUTS / OUTPUTS

### Primary Function: `updatePipelineUniforms()`

**Inputs:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `C_t` | `Object` | Context vector from physics tick — per-citizen valence/arousal, per-node energy levels |
| `delta` | `float` | Frame delta time in seconds |
| `elapsed` | `float` | Total elapsed time (for shader uTime) |

**Outputs:**

| Return | Type | Description |
|--------|------|-------------|
| `uniformsApplied` | `int` | Number of shader uniforms updated this frame |

**Side Effects:**

- Modifies shader uniform values on all active citizen materials
- Modifies texture parameters on energy-indexed buildings
- Modifies zone atmosphere (fog, light) via interpolation targets

### Primary Function: `processCollisionFeedback()`

**Inputs:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `collisions` | `Array<{entityA, entityB, type, severity}>` | Detected collisions from the frame |

**Outputs:**

| Return | Type | Description |
|--------|------|-------------|
| `injections` | `Array<{entityId, dimension, delta}>` | Limbic injections to send to graph |

**Side Effects:**

- Queues graph mutations for next physics tick sync
- May flag paths for inhibition if collision is persistent

---

## EDGE CASES

### E1: C_t Contains NaN or Out-of-Range Values

```
GIVEN:  The physics tick produces a C_t where citizen.valence = NaN
        (e.g., division by zero in energy propagation)
THEN:   The uniform bridge clamps to last known good value
AND:    A frustration injection is queued for that citizen (+0.1)
AND:    The error is logged to telemetry with the tick number and citizen ID
```

### E2: Energy Drops to Zero (Complete Decay)

```
GIVEN:  A narrative node's energy reaches 0.0 (fully decayed)
THEN:   The 3D manifestation does not disappear instantly
AND:    It fades to minimum LOD (flat quad with near-transparent texture)
AND:    After 3 additional ticks at zero, it is culled from the render list
AND:    The Moment persists in the graph — only its visual representation is removed
```

### E3: 186 Citizens All Need Shader Updates Simultaneously

```
GIVEN:  A physics tick produces C_t updates for all 186 citizens at once
THEN:   Updates are batched into groups of 20 per frame
AND:    Each group's uniforms are applied in a single GPU state change
AND:    Full convergence occurs within 10 frames (~167ms) — well within the 30-60s interpolation window
```

### E4: Collision Cascade (Multiple Simultaneous Collisions)

```
GIVEN:  A narrow bridge produces 8 simultaneous citizen-citizen collisions
THEN:   Limbic injections are capped at 3 per citizen per second
AND:    Excess collisions are logged but not injected
AND:    The frustration cap prevents runaway negative spirals from geometry bottlenecks
```

---

## ANTI-BEHAVIORS

### A1: Static Visual State

```
GIVEN:   A citizen's graph state has changed (valence dropped by 0.3)
WHEN:    The next frame renders
MUST NOT: Show the citizen in their previous color/pulsation state
INSTEAD:  Begin interpolating toward the new visual state immediately
```

### A2: Visible Tick Boundary

```
GIVEN:   The physics tick fires and produces new C_t values
WHEN:    The 3D engine receives the update
MUST NOT: Apply all changes in a single frame (color snap, geometry jump)
INSTEAD:  Interpolate all changes over 30-60 seconds using per-frame lerp
```

### A3: Silent Pipeline Failure

```
GIVEN:   A shader compilation fails or a mesh is non-manifold
WHEN:    The error is caught
MUST NOT: Silently fall back to a default material with no cognitive consequence
INSTEAD:  Inject frustration into the agent's limbic state and crystallize a narrative node
```

### A4: Decorative Geometry

```
GIVEN:   A new visual element is added to the scene
WHEN:    It has no corresponding graph node or is not derived from graph state
MUST NOT: Render it as part of the cognitive world
INSTEAD:  Either create a graph node for it or place it in a non-cognitive layer (skybox, water plane)
```

---

## MARKERS

<!-- @mind:todo Define the exact interpolation curve — linear lerp or eased? Should decay erosion use a different curve than color shifts? -->
<!-- @mind:todo Specify collision detection method — bounding spheres on stick figures? How do buildings collide? -->
<!-- @mind:proposition Proximity_contagion on Space nodes could use soft-body force fields instead of hard radius checks -->
<!-- @mind:escalation The frustration cap (3 injections/second) needs gameplay testing — is it too aggressive or too lenient? -->
