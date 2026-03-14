# OBJECTIVES — 3D Pipeline & Cognitive Supply Chain

```
STATUS: DRAFT
CREATED: 2026-03-14
VERIFIED: —
```

---

## CHAIN

```
THIS:            OBJECTIVES_Pipeline.md (you are here - START HERE)
PATTERNS:       ./PATTERNS_Pipeline.md
BEHAVIORS:      ./BEHAVIORS_Pipeline.md
ALGORITHM:      ./ALGORITHM_Pipeline.md
VALIDATION:     ./VALIDATION_Pipeline.md
IMPLEMENTATION: ./IMPLEMENTATION_Pipeline.md
SYNC:           ./SYNC_Pipeline.md

IMPL:           engine/client/app.js
                engine/server/narrative_graph_seed_and_tick_bridge.js
                src/server/physics-bridge.js
```

**Read this chain in order before making changes.** Each doc answers different questions. Skipping ahead means missing context.

---

## PRIMARY OBJECTIVES (ranked)

1. **Bidirectional cognitive-3D coupling** — The 3D world must be a physical extension of the graph, not a disconnected skin. Every visual property (material wear, color temperature, geometric complexity, lighting) is a computed function of graph state. Conversely, every 3D event (collision, clipping, stable landing) injects energy back into the cognitive substrate via Law 1. Without this, citizens move through a world that doesn't reflect their internal state, and the visual layer becomes decoration.

2. **Energy-indexed rendering** — Visual fidelity must be proportional to graph energy. Low-energy nodes produce degraded geometry and worn textures (Law 3 temporal decay applied to materials). A building whose narrative energy has decayed shows procedural erosion; a citizen whose valence is negative shifts toward red/orange. The renderer never renders at full fidelity unconditionally — fidelity is earned by energetic relevance.

3. **Collision-to-limbic feedback** — Every rendering error, physics collision, or spatial incoherence is treated as negative energy injection into the agent's limbic system. Minor collisions add +0.05 frustration. Violent collisions add +0.15 frustration and +0.1 anxiety. Stable landings add +0.15 satisfaction. This closes the loop: the 3D engine is not a passive display — it is a sensory organ that feeds experience back into cognition.

4. **Sub-16ms propagation latency** — The delay between a cognitive impulse (C_t change from physics tick) and its 3D manifestation (shader uniform update, material swap, geometry degradation) must stay under 16ms to maintain 60fps phenomenological continuity. The cognitive engine ticks every 5 minutes; the 3D engine runs at 60fps. They synchronize through shared state, not lock-step execution.

---

## NON-OBJECTIVES

- **Photorealistic rendering** — This is not a AAA game engine. Visual quality serves cognitive information, not screenshot beauty. A procedural texture that accurately reflects energy decay is better than a photorealistic texture that is static.
- **Pre-authored 3D assets** — Zero external asset files (Lumina Prime principle). All geometry is procedurally generated from graph topology. Serenissima provides the finite dictionary mapping L1 node types to 3D manifestations, but the meshes are computed, not loaded.
- **Real-time physics simulation** — We do not simulate rigid body physics, cloth, or fluid dynamics. "Physics" here means narrative energy physics (the 21 Laws), not Newtonian mechanics. Collisions are detected for limbic feedback, not for realistic bounce trajectories.
- **GPU-intensive compute shaders** — The target is Meta Quest 3 at 72fps, <200 draw calls, <500K triangles. Shaders must be lightweight. The limbic state shader uses basic color mixing and sine pulsation, not ray marching or volumetric rendering.

---

## TRADEOFFS (canonical decisions)

- When **visual fidelity** conflicts with **latency**, choose latency. A citizen whose color hasn't updated is worse than a citizen whose color is slightly wrong but arrived on time.
- When **procedural generation quality** conflicts with **energy budget**, choose energy budget. The tick orchestrator allocates geometric complexity; the renderer must not exceed it, even if the result looks rough.
- When **collision detection accuracy** conflicts with **frame rate**, choose frame rate. Approximate bounding-sphere collisions at 60fps beat precise mesh collisions at 45fps.
- We accept **visual simplicity** (stick figures, box buildings, procedural textures) to preserve the **graph-to-visual coupling** that makes the world alive.

---

## SUCCESS SIGNALS (observable)

- A citizen whose valence drops to -0.8 visibly shifts toward red/orange within one frame of the C_t update arriving
- A building whose narrative energy has decayed below threshold shows visible texture erosion compared to a building at full energy
- A collision between two citizens produces a measurable frustration injection in both agents' graph state within 16ms
- The shader compilation failure for a citizen's limbic state produces a `narrative` node in the graph (frustration crystallization) rather than a silent error
- Session stride allocation correctly proportions rendering depth across parallel micro-sessions based on urgency weighting
- An observer watching the scene cannot tell when the 5-minute physics tick fires — changes fade in smoothly over 30-60 seconds, never jumping

---

## MARKERS

<!-- @mind:todo Define the exact C_t → uniform bridge data format (what fields, what types, what ranges) -->
<!-- @mind:todo Benchmark Quest 3 draw call budget with energy-indexed LOD system -->
<!-- @mind:proposition Consider WebGPU compute shaders for collision detection at scale (186 citizens) -->
<!-- @mind:escalation R3F vs raw Three.js architectural decision needed before implementation begins -->
