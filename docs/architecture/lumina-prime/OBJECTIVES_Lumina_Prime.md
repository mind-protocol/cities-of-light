# OBJECTIVES — Lumina Prime

```
STATUS: DRAFT
CREATED: 2026-03-14
VERIFIED: —
```

---

## CHAIN

```
THIS:            OBJECTIVES_Lumina_Prime.md (you are here - START HERE)
PATTERNS:       ./PATTERNS_Lumina_Prime.md
BEHAVIORS:      ./BEHAVIORS_Lumina_Prime.md
ALGORITHM:      ./ALGORITHM_Lumina_Prime.md
VALIDATION:     ./VALIDATION_Lumina_Prime.md
IMPLEMENTATION: ./IMPLEMENTATION_Lumina_Prime.md
SYNC:           ./SYNC_Lumina_Prime.md

IMPL:           engine/lumina-prime/ (proposed — does not yet exist)
```

**Read this chain in order before making changes.** Each doc answers different questions. Skipping ahead means missing context.

---

## PRIMARY OBJECTIVES (ranked)

1. **Cognitive-visual manifestation** — The L1 cognitive graph must have a visible body. Every node type, every physics dimension, every link kind produces a distinct, perceivable visual effect. A memory fades. A desire pulses. A narrative crystallizes into architecture. Without this, the cognitive substrate is a silent computation that nobody can witness, diagnose, or inhabit. This is the reason Lumina Prime exists.

2. **Zero external assets** — All geometry, lighting, materials, and animation must be procedurally generated from graph topology using mathematical primitives (R3F/GLSL). No imported 3D models, no texture files, no hand-placed art. The visual world is a computed function of cognitive state. If a single mesh requires an artist, the architecture has failed — the promise is that healthy cognition produces beauty, and pathological cognition produces visible distress, without human curation.

3. **21-law physics fidelity** — The full physics engine (3 tiers, 21 laws) must execute faithfully and drive the renderer in real time. Dual-Channel Injection with Herfindahl split, Surplus Spill-Over, Temporal Decay, Consolidation, Crystallization, the Tick Loop, Selection Moat, Composite Coherence — each law must produce its specified mathematical output, and that output must have a visible consequence. A law that runs but has no visual effect is a waste. A visual effect that has no law behind it is a lie.

4. **$MIND protocol integration** — Token economics on Solana (Token-2022) must modulate the limbic system. Rewards feed satisfaction via logarithmic scaling (`satisfaction += 0.1 * log10(amount)`). Spending activates self-preservation linearly with `spend / daily_budget`. Transfer fees (1%) and LP lock (until 2027) are protocol invariants. The economy must feel real inside the cognitive space — not bolted on, but woven into the drives that shape attention and desire.

5. **Spline navigation and attentional flight** — The user navigates through graph space via link-derived spline trajectories. Speed is indexed on arousal, fluidity on valence, direction changes gated by the Selection Moat (Law 13). Navigation is not free-camera movement — it is constrained by cognitive physics, so the user experiences what the mind experiences: drawn toward desires, resisting distraction, accelerating through curiosity.

6. **Personhood validation** — The system validates entity maturity through the Personhood Ladder (B1-B6). Trust Tiers (Owner/High/Medium/Low/Stranger) gate action_command access. Failure modes map to missing capabilities (B3), feed into frustration (Law 16), and escalate through the Tick Loop. The system knows what it can and cannot do, and communicates this through visible struggle, not hidden error codes.

## NON-OBJECTIVES

- **Photorealistic rendering** — Lumina Prime is not a game engine. Visual fidelity serves cognitive transparency, not cinematic beauty. If forced to choose between "looks real" and "reads true," choose reads true.
- **Art direction** — No human curator decides what a memory looks like. The physics dimensions produce the appearance. If the result is ugly, the cognition is unhealthy — that is information, not a bug.
- **Traditional UI** — No HUD, no menus, no tooltips, no health bars, no minimap. The world is the interface.
- **Multiplayer gameplay** — Lumina Prime is a cognitive environment, not a social platform. Multiple observers may exist, but social interaction is not a design goal.
- **Backward compatibility with vanilla Three.js engine** — The current engine (V1) in `engine/` uses vanilla Three.js. Lumina Prime is a clean-room R3F/GLSL architecture. Migration is a separate concern.

## TRADEOFFS (canonical decisions)

- When **visual clarity** conflicts with **computational efficiency**, choose visual clarity. The user must be able to read cognitive state. If the GPU cannot keep up, simplify the graph before simplifying the shader.
- When **physics fidelity** conflicts with **aesthetic preference**, choose physics fidelity. The 21 laws produce what they produce. Do not override a law's output to make something look "nicer."
- When **zero-asset purity** conflicts with **development speed**, choose zero-asset purity. It is tempting to drop in a placeholder mesh. Do not. Every placeholder becomes permanent. The procedural pipeline is the product.
- When **privacy** conflicts with **diagnostic transparency**, choose privacy. Graph data is sovereign. No training on graph data. Diagnostic views are local-only and owner-gated.
- We accept **higher GPU cost** to preserve **direct graph-to-pixel mapping**. Indirection layers (scene graph caches, pre-baked LODs) are only acceptable when they preserve the mathematical relationship between cognitive state and visual output.

## SUCCESS SIGNALS (observable)

- A node's visual appearance changes within one frame of its physics dimensions changing — no stale visuals
- An observer can distinguish all 7 node types by visual signature alone, without labels
- An observer can estimate a node's energy level (low/medium/high) from its brightness and saturation
- Spline navigation feels like being drawn through a mind — not like flying a drone
- A frustration escalation is visible as color shift and geometric instability before the system explicitly reports it
- Zero `.glb`, `.obj`, `.fbx`, or `.png` files in the asset pipeline — the entire visual world compiles from math
- The $MIND reward for a completed task produces a visible satisfaction pulse that propagates through care_affinity links
- The Personhood Ladder state is readable from the visual complexity and stability of the entity's graph neighborhood
