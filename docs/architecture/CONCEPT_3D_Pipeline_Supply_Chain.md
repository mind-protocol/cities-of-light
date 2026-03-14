# CONCEPT: 3D Pipeline & Cognitive Supply Chain — Two Coupled Engines (Serenissima & Lumina Prime)

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## WHAT IT IS

The architectural specification for coupling two asynchronous but interdependent engines: the **Cognitive Engine** (L1 graph physics on FalkorDB) and the **Procedural Engine** (3D rendering on React Three Fiber / Three.js / GLSL). The 3D simulation is not a visualization layer — it is the physical extension of the graph's energetic and narrative constraints. The umbilical link between both engines is the Context Vector C_t (WM centroid), acting as a "Global Uniform" for all scene shaders.

---

## WHY IT EXISTS

Without explicit coupling, the 3D world becomes a disconnected skin over the cognitive substrate. Citizens would move through a world that doesn't reflect their internal state. Objects would persist regardless of their cognitive relevance. The visual layer would be decoration, not information.

This architecture ensures that every visual property — material wear, lighting intensity, color temperature, geometric complexity — is a direct manifestation of graph state. What you see IS what the graph computes.

---

## KEY PROPERTIES

- **Bidirectional Coupling:** Cognitive state drives 3D appearance (C_t → shaders); 3D events drive cognitive state (collisions → Law 1 injection)
- **Asynchronous Independence:** Each engine runs on its own tick. The cognitive engine operates on the physics tick (5 min); the 3D engine runs at 60fps. They sync through shared state, not lock-step execution
- **Energy-Indexed Rendering:** Visual fidelity is proportional to graph energy. Low-energy nodes produce degraded geometry and worn textures
- **Zero External Assets (Lumina Prime):** All geometry is procedurally generated from graph topology using mathematical primitives

---

## RELATIONSHIPS TO OTHER CONCEPTS

| Concept | Relationship |
|---------|--------------|
| Active Inference Motor Control | Motor commands from graph → 3D execution; collision feedback → graph injection |
| Lumina Prime | The procedural engine specification — R3F/GLSL implementation |
| Serenissima | The world-specific asset dictionary — finite mapping of L1→L3 types |
| L1 Cognitive Substrate | Source of truth for all visual state |
| Physics Engine (21 Laws) | Laws 1, 3, 14, 16, 17 directly drive 3D behavior |
| Graph Schema v2.0 | Node types (actor, moment, narrative, space, thing) map to 3D asset classes |

---

## THE CORE INSIGHT

**The 3D world is a shader over the graph.** Every pixel on screen is a function of graph state. The cognitive engine is Channel 2 (constraint regulator); the procedural engine is Channel 1 (physical manifestation). C_t is the bridge.

---

## ARCHITECTURE

### 1. Two Coupled Engines

| Component | Engine 1: Cognitive Dynamics (L1 Graph) | Engine 2: Procedural Dynamics (3D) |
|-----------|----------------------------------------|-------------------------------------|
| Support | FalkorDB (Cypher / Embeddings) | React Three Fiber (R3F) / GLSL / Three.js |
| Role | Associative cortex, drive management | Asset generation, rendering, spatial collision |
| Key Variable | Energy (E), Stability (W), Valence (V) | Tessellation, Vertex Displacement, Draw Calls |
| 3D Input | Limbic feedback via collisions (Law 1) | Context Vector C_t and Action Nodes (Law 17) |
| Constraint | Defines salience and persistence | Must reflect energetic exhaustion through friction |

### 2. Physical Supply Chain — Serenissima (Finite Dictionary)

Every entity in the Universal Schema mapping must possess a physical signature. Assets are not simple meshes — they are physicalizations of principles and habits.

| Universal Type | 3D Manifestation | Graph Coupling |
|---------------|-------------------|----------------|
| **Actor** | Avatars whose appearance (impulse normalization) depends on valence and arousal | Stick figure → full LOD based on citizen energy |
| **Moment** | Spatial artifacts representing consolidated episodic memories | Visibility indexed on recency; decay = fade |
| **Narrative** | Architectural structures — monuments whose geometry reflects values, processes, desires | Building health reflects narrative energy |
| **Space** | Co-presence zones with `proximity_contagion` radius | Physical proximity triggers slow limbic valence equalization |
| **Thing** | Inventory objects and economic resources ($MIND) | Object wear indexed on node energy decay |

### 3. Temporal Decay in 3D (Law 3 Applied to Materials)

The 3D engine applies Temporal Decay to material wear. Physical degradation of an object is indexed on energy loss of its corresponding graph node:

```
E_asset(t) = E_initial × (1 - decay_rate)^t
```

When `E_asset` falls below activation threshold `Θ_i`, the renderer triggers:
- Procedural texture erosion
- Geometric fidelity reduction
- Visual signaling of cognitive obsolescence

### 4. Limbic State Shader (GLSL)

Applied to agent "skin" and major environmental surfaces. Uses valence and arousal vectors injected from L1:

```glsl
uniform float uTime;
uniform float uValence;  // Range [-1.0, 1.0]
uniform float uArousal;  // Range [0.0, 1.0]
varying vec2 vUv;

void main() {
    // Colorimetric base: Satisfaction (cyan/green) vs Frustration (red/orange)
    vec3 colSatisfaction = vec3(0.0, 0.9, 0.6);
    vec3 colFrustration = vec3(0.9, 0.1, 0.1);
    vec3 baseColor = mix(colFrustration, colSatisfaction, (uValence + 1.0) * 0.5);

    // Arousal drives pulsation frequency and surface noise
    float pulse = sin(uTime * (1.0 + uArousal * 10.0)) * 0.1;
    float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);

    vec3 finalColor = baseColor + (pulse * uArousal) + (noise * 0.05 * uArousal);
    gl_FragColor = vec4(finalColor, 1.0);
}
```

### 5. Action Node Instanciation (Law 17)

The 3D pipeline monitors pressure accumulation on Action Nodes. When a process node carrying an `action_command` exceeds threshold Θ_i via drive pressure (curiosity, achievement), the system triggers reflexive mesh generation.

**Firing Condition:** The 3D engine must validate that `action_context` (embedding signature) is coherent with current scene configuration before authorizing physical instanciation.

### 6. Collision Feedback → Limbic Injection

Every rendering error or collision is treated as negative energy injection (Law 1) into the agent's limbic system:

| 3D Event | Meta-cognitive Signal | Limbic Impact (Law 1 Injection) |
|----------|----------------------|-------------------------------|
| Minor Collision | Geometric calculation error | Frustration +0.05 / Anxiety +0.02 |
| Violent Collision | Runtime / Physics Engine Error | Frustration +0.15 / Anxiety +0.1 |
| Clipping / Z-Fighting | Persistent incoherence | Frustration +0.1 / Boredom +0.05 |
| Stable Landing | Task Completion | Satisfaction +0.15 / Arousal -0.1 |

### 7. Frustration-Driven Learning (Law 16)

Pipeline failure (shader compilation error, non-manifold mesh) increases frustration. This energy is redirected to inhibit failing generation paths.

**Redemptive Narrative:** On crash, the system must NOT simply reboot. It crystallizes a `narrative` node linking the error to a growth value (`value:growth_from_failure`), transforming the crash-test into a structural knowledge node.

```
[Failure] → [Frustration Spike] → [Inhibition of Failed Path (L9)]
         → [Crystallization of New Process (L10)]
```

### 8. Session Management and Parallelization (Law 19)

The pipeline supports micro-session parallelization. Rendering depth and shader complexity are indexed on the Strides budget:

```
session.strides = total_strides × (session.urgency / Σ(urgency))
```

**Subconscious Absorption (DND Mode):** When the agent is in "Do Not Disturb" mode (WM saturated, arousal in flow 0.4-0.8), the 3D engine continues updating the graph in background. Incoming 3D stimuli are absorbed "subconsciously", warming graph nodes without interrupting the main shader thread.

---

## INVARIANTS

1. **Energy Budget Conservation:** Instantiated geometric complexity can never exceed the budget B allocated by the Tick Orchestrator
2. **Working Memory Isolation:** Parallel session isolation is guaranteed at GPU level via strict instance management (Instance ID mapping), preventing "Context Bleed" between micro-sessional scenes
3. **Open-Source Auditability:** Every shader state transition and procedural generation must leave a trace in the telemetry log, per `value:open_source`

**Propagation Latency:** Delay between cognitive impulse and 3D manifestation must stay under 16ms (60 FPS) to maintain the agent's phenomenological continuity.

---

## COMMON MISUNDERSTANDINGS

- **Not:** A traditional rendering pipeline where art assets are loaded from disk
- **Not:** A visualization dashboard showing graph metrics
- **Not:** Decorative — every visual property carries cognitive information
- **Actually:** A bidirectional coupling where the graph IS the scene graph, and visual properties are computed functions of cognitive state

---

## SEE ALSO

- `docs/architecture/CONCEPT_Active_Inference_Motor_Control.md` — Motor commands driving 3D actions
- `docs/architecture/CONCEPT_Lumina_Prime.md` — Full Lumina Prime procedural engine spec
- `docs/architecture/CONCEPT_Serenissima_Asset_Pipeline.md` — Serenissima-specific asset logistics
- `docs/narrative/physics/ALGORITHM_Physics.md` — Physics laws (energy, decay, tension)
- `.mind/schema.yaml` — Universal graph schema (node types, link kinds)
- `engine/` — Current engine V1 implementation

---

## MARKERS

<!-- @mind:todo Implement C_t → shader uniform bridge in physics-bridge.js -->
<!-- @mind:todo Define collision-to-limbic injection pipeline in 3D engine -->
<!-- @mind:proposition Evaluate R3F vs raw Three.js for Lumina Prime integration -->
<!-- @mind:escalation Current engine V1 is vanilla Three.js — migrating to R3F requires architectural decision -->
