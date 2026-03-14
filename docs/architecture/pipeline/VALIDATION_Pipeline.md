# 3D Pipeline & Cognitive Supply Chain — Validation: What Must Be True

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Pipeline.md
PATTERNS:        ./PATTERNS_Pipeline.md
BEHAVIORS:       ./BEHAVIORS_Pipeline.md
THIS:            VALIDATION_Pipeline.md (you are here)
ALGORITHM:       ./ALGORITHM_Pipeline.md
IMPLEMENTATION:  ./IMPLEMENTATION_Pipeline.md
SYNC:            ./SYNC_Pipeline.md
```

---

## PURPOSE

**Validation = what we care about being true.**

Not mechanisms. Not test paths. Not how things work.

What properties, if violated, would mean the 3D pipeline has failed its purpose? These are the invariants that protect the coupling between the cognitive engine and the procedural engine — the properties that make Venice alive rather than decorated.

---

## INVARIANTS

### V1: Energy Budget Conservation

**Why we care:** If the renderer consumes more geometric complexity than the tick orchestrator allocates, the frame rate drops, the Quest 3 misses its 72fps target, and the visitor's phenomenological continuity breaks. The pipeline becomes the bottleneck that makes the world stutter. Worse: if energy can be "created" in the renderer (an object rendered at higher fidelity than its graph energy justifies), the visual layer lies about the cognitive state.

```
MUST:   Instantiated geometric complexity (total draw calls, total triangles)
        can NEVER exceed the budget B allocated by the Tick Orchestrator
        for the current frame.
        Σ(draw_calls) <= B_draw_calls  (target: 200 on Quest 3)
        Σ(triangles) <= B_triangles    (target: 500K on Quest 3)
NEVER:  An object rendered at LOD level higher than its node energy permits.
        If node.energy < Θ_i, LOD must be <= LOD_1 (minimal).
        If node.energy == 0, LOD must be LOD_0 (ghost) or culled.
```

### V2: Working Memory Isolation

**Why we care:** When multiple agents run parallel micro-sessions (session stride allocation), their rendering contexts must not leak into each other. If Citizen A's shader uniforms bleed into Citizen B's render pass, both citizens display corrupted visual state. The visitor sees color artifacts, flickering, or ghosts of one citizen's emotional state on another's body. This destroys the information-carrying property of the visual layer.

```
MUST:   Parallel session isolation is guaranteed at GPU level via strict
        instance management. Each citizen's shader uniforms are bound to
        their GPU instance ID. No uniform buffer is shared across instances
        unless it is a true global (uTime, camera matrices).
NEVER:  Citizen A's uValence or uArousal value applied to Citizen B's
        material during the same frame. Instance ID mapping must be
        bijective: one citizen, one instance, one uniform set.
```

### V3: Propagation Latency Under 16ms

**Why we care:** If the delay between a cognitive impulse (C_t arriving via WebSocket) and its first visual effect (uniform value beginning to change) exceeds 16ms, the pipeline misses a frame. At 60fps, one missed frame is tolerable. At 72fps (Quest 3), one missed frame is 14ms of dead time. If latency regularly exceeds 16ms, the visitor perceives the world as "laggy" — citizens whose colors don't update, buildings that freeze mid-decay, atmospheres that stutter. Phenomenological continuity requires that the world responds within one frame of receiving new state.

```
MUST:   The wall-clock time from WebSocket message arrival to the first
        shader uniform update incorporating the new C_t must be < 16ms.
        This includes: JSON parse, validation, NaN clamping, target_Ct
        assignment, and the first lerp step.
NEVER:  A C_t update queued for "next frame" that actually takes effect
        two or more frames later due to processing backlog.
```

### V4: Open-Source Auditability

**Why we care:** Per `value:open_source`, every shader state transition and procedural generation must be traceable. If a citizen turns red and nobody can explain why (because the pipeline doesn't log the C_t that caused it), the system fails its transparency obligation. Auditability also serves debugging: when a visual artifact appears, the telemetry trace must be sufficient to reconstruct the full causal chain from graph state through C_t through shader output.

```
MUST:   Every C_t update is logged with tick_number, timestamp, and
        a hash of the citizen state block.
        Every collision event is logged with frame, type, entities, position.
        Every limbic injection is logged with entity, dimension, delta, source.
        Logs are append-only and survive process restart.
NEVER:  A visual state change that cannot be traced back to a specific
        C_t tick_number or collision event via the telemetry log.
```

### V5: Feedback Loop Closure

**Why we care:** If collisions are detected but never injected into the graph, the 3D engine is a one-way consumer. The agent has no body. Frustration from spatial experience never accumulates. Path inhibition (Law 9) never fires from collision data. The redemptive narrative (Law 16) never crystallizes from pipeline failures. The entire feedback architecture collapses, and the coupling becomes unidirectional — which is just a visualization layer with extra steps.

```
MUST:   Every classified collision event (minor, violent, clipping,
        stable_landing) produces a corresponding limbic injection that
        reaches the FalkorDB graph within 200ms of the collision frame.
        The injection must be visible in the next C_t computation
        (next physics tick).
NEVER:  A collision event classified but not injected (dropped silently).
        Rate limiting may defer injection, but deferred events must still
        be logged and counted in telemetry.
```

### V6: Decay Monotonicity

**Why we care:** If a decaying object's visual state can improve without a corresponding graph energy increase, the visual layer lies. A building that looks better than its energy justifies is decoration. A citizen who brightens without receiving positive valence has broken the coupling. Decay must be monotonic: visual quality goes down as energy goes down, and only goes back up when energy goes back up.

```
MUST:   For any renderable object, visual_quality(t+1) <= visual_quality(t)
        UNLESS node.energy(t+1) > node.energy(t) (energy was reinforced).
        Erosion factor can only increase or stay constant between frames
        when no reinforcement occurs.
NEVER:  A building or citizen whose visual state improves (higher LOD,
        more saturated color, less noise) while its graph energy is
        constant or declining.
```

---

## PRIORITY

| Priority | Meaning | If Violated |
|----------|---------|-------------|
| **CRITICAL** | System purpose fails | Unusable |
| **HIGH** | Major value lost | Degraded severely |
| **MEDIUM** | Partial value lost | Works but worse |

---

## INVARIANT INDEX

| ID | Value Protected | Priority |
|----|-----------------|----------|
| V1 | Energy budget conservation — renderer cannot exceed allocated complexity | CRITICAL |
| V2 | Working memory isolation — no context bleed between parallel sessions | CRITICAL |
| V3 | Propagation latency — cognitive impulse to visual effect within 16ms | HIGH |
| V4 | Open-source auditability — every state transition is traceable | HIGH |
| V5 | Feedback loop closure — collisions reach the graph, not just the screen | HIGH |
| V6 | Decay monotonicity — visual quality tracks energy monotonically | MEDIUM |

---

## MARKERS

<!-- @mind:todo V1 needs concrete measurement: instrument draw call counter and triangle counter in the render loop -->
<!-- @mind:todo V2 needs test: render 10 citizens with deliberately overlapping instance IDs and verify no bleed -->
<!-- @mind:todo V3 needs benchmark: measure actual parse-to-uniform latency with 186-citizen C_t payload -->
<!-- @mind:proposition V4 telemetry could use a ring buffer with configurable depth to prevent unbounded log growth -->
<!-- @mind:escalation V5 200ms threshold for injection-to-graph may be too generous — if physics tick fires right after, the injection is included; if right before, it waits 5 minutes. Need confirmation from @nervo on timing. -->
