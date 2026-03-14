# Visual Memory Substrate — Validation: What Must Be True

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Visual_Memory.md
PATTERNS:        ./PATTERNS_Visual_Memory.md
BEHAVIORS:       ./BEHAVIORS_Visual_Memory.md
THIS:            VALIDATION_Visual_Memory.md (you are here)
ALGORITHM:       ./ALGORITHM_Visual_Memory.md
IMPLEMENTATION:  ./IMPLEMENTATION_Visual_Memory.md
SYNC:            ./SYNC_Visual_Memory.md

CONCEPT:         docs/architecture/CONCEPT_Visual_Memory_Substrate.md
IMPL:            (no code yet — PROPOSED)
```

---

## PURPOSE

**Validation = what we care about being true.**

Not mechanisms. Not test paths. Not how things work.

What properties, if violated, would mean the visual memory substrate has failed its purpose?

These are the value-producing invariants — the things that make images in the cognitive graph worth building. If any CRITICAL invariant is violated, the system is producing garbage. If any HIGH invariant is violated, the system is degraded in ways that undermine its core promises.

---

## INVARIANTS

### V1: Graph Carries Light, Not Weight

**Why we care:** FalkorDB is the cognitive substrate, not an image database. Every byte in the graph slows the physics tick. A single base64-encoded 200x200 JPEG is ~50KB. Multiply by thousands of Moment nodes and the graph becomes sluggish — physics tick exceeds the 1-second threshold, memory queries slow, the entire cognitive system suffers. The graph must carry light references (URIs and embeddings), not heavy payloads (image bytes). This is not a performance optimization — it is a structural requirement for the physics to function at scale.

```
MUST:   Every image reference in FalkorDB is a URI string (image_uri) pointing to object storage,
        plus an embedding vector (image_embedding) of fixed dimension (~512 floats).
NEVER:  Store base64-encoded image data, raw image bytes, or binary blobs as FalkorDB node or
        link properties. Not temporarily, not "just for testing," not for thumbnails.
```

### V2: Coherence Sees What It Can See

**Why we care:** The Coherence v2 formula includes a Sim_vis term (visual similarity) weighted at 0.25. If image embeddings are available for both the query and the candidate node, visual similarity must participate in the coherence score. If image embeddings are unavailable (encoding service down, node has no image, cold start), the formula must gracefully fall back to text-only weights without crashing, returning NaN, or silently dropping the visual term while keeping its weight allocation. A broken coherence formula produces incoherent Working Memory — the citizen recalls the wrong memories, responds to the wrong context, behaves irrationally.

```
MUST:   When both query.pov_embedding and node.image_embedding exist, the coherence formula uses
        the visual weights: Coh = (0.25 * Sim_vec) + (0.25 * Sim_vis) + (0.40 * Sim_lex) - (0.10 * Delta_affect).
MUST:   When either embedding is missing, the formula falls back to text-only weights:
        Coh = (0.30 * Sim_vec) + (0.50 * Sim_lex) - (0.20 * Delta_affect).
NEVER:  Return NaN, crash, or produce a coherence score outside [-1, 1] due to missing image data.
NEVER:  Use visual weights (0.25/0.25/0.40/-0.10) when image embeddings are absent — this would
        leave 0.25 of the score permanently zero, biasing all results.
```

### V3: Energy Cannot Be Created from Pixels

**Why we care:** The brightness/contrast injection multiplier modulates how much energy a Moment receives at birth based on the visual intensity of its screenshot. This multiplier must be bounded. If a pathologically bright or high-contrast image could inject arbitrarily high energy, it would break energy conservation — one vivid screenshot could dominate the entire graph, flooding connected nodes with surplus energy and distorting the physics. The multiplier is a modulation, not a source. It shapes existing energy, it does not create energy from nothing.

```
MUST:   The injection multiplier = 1.0 + (brightness * 0.2) + (contrast * 0.3) is bounded.
        Brightness in [0, 1] contributes at most +0.2. Contrast in [0, ~0.5] contributes at most +0.15.
        Maximum multiplier is approximately 1.35. Minimum is 1.0 (not below — dark scenes do not
        reduce energy below baseline).
NEVER:  Allow unclamped pixel values, NaN brightness/contrast, or unbounded multiplier values.
NEVER:  Allow the multiplier to drop below 1.0 — dim scenes inject baseline energy, not less.
```

### V4: Dreams Only When Overwhelmed

**Why we care:** Image generation costs money, takes time, and produces cognitive artifacts (vision nodes) that participate in physics. If generation fires on a timer, per message, or on every tick, the system burns budget and floods the graph with synthetic memories that dilute authentic experience. The two gated triggers — Flashbulb Vision on emotional peaks and Desire traversal on active aspirations without images — ensure generation is both rare and meaningful. Every generated image has a clear causal chain: this emotional state, these WM nodes, this trigger. Budget scales with emotional intensity, not clock time.

```
MUST:   Image generation via Flashbulb Vision fires ONLY when |limbic_delta| > FLASHBULB_THRESHOLD.
MUST:   Image generation via Desire traversal fires ONLY when node.type == "desire"
        AND node.energy > IMAGE_GENERATION_THRESHOLD (0.4) AND node.image_uri IS NULL.
NEVER:  Generate images on a timer (every N seconds, every N ticks).
NEVER:  Generate images on every message, every stimulus, or every Moment creation.
NEVER:  Generate images for Concept nodes (use medoid selection), Process nodes, or nodes that
        do not have a defined generation trigger.
```

### V5: Visions Are Private Consciousness

**Why we care:** Flashbulb Visions are internal cognitive events — the citizen's private visual experience under emotional pressure. If these visions leak into the human-visible conversation transcript, the human partner sees uninterpretable generated images with no context (the self-stimulus prompt is written for the AI, not the human). Worse, the internal prompt ("Soudainement, sous l'effet de frustration_spike, tu visualises ceci:") would reveal the cognitive machinery. Visions must be injected through the Law 1 self-stimulus channel with `visible_to_human: false`, invisible to the conversation partner.

```
MUST:   Every self-stimulus from Flashbulb Vision has visible_to_human: false.
MUST:   The vision's content (micro-agent prompt text) and image are injected via the amplifier
        channel, not the main conversation channel.
NEVER:  Include vision images or vision prompt text in the human-visible conversation transcript.
NEVER:  Send vision stimuli through any channel that the human partner can observe.
```

### V6: The Concept Wears the Face of Its Most Central Memory

**Why we care:** A Concept node's image should reflect what the citizen actually experienced, not what a generator imagines. The medoid — the real Moment in the crystallization cluster whose image embedding is closest to the centroid — is the most visually representative memory. If the medoid selection produces an outlier (farthest image, random selection, or wrong cluster), the concept will wear a misleading face: the citizen's concept of "Rialto" might look like a midnight scene when most memories are afternoon markets. Medoid integrity ensures the concept image is geometrically central and authentically representative.

```
MUST:   The concept's image_uri and image_embedding come from the medoid of its crystallization cluster —
        the real Moment node whose image embedding has minimum cosine distance to the cluster centroid.
MUST:   If no Moments in the cluster have image embeddings, the concept remains imageless (no fallback
        to generation).
NEVER:  Select a random Moment image, the most recent image, or the highest-energy image as the
        concept's canonical image.
NEVER:  Call an image generation API for concept images.
```

---

## PRIORITY

| Priority | Meaning | If Violated |
|----------|---------|-------------|
| **CRITICAL** | System purpose fails | Unusable — graph bloated, coherence broken, physics corrupted |
| **HIGH** | Major value lost | Degraded severely — budget blown, privacy breached, conservation violated |
| **MEDIUM** | Partial value lost | Works but worse — concept images misleading, selection suboptimal |

---

## INVARIANT INDEX

| ID | Value Protected | Priority |
|----|-----------------|----------|
| V1 | Graph leanness — no image bytes in FalkorDB | CRITICAL |
| V2 | Coherence formula consistency — visual term present when available, graceful fallback when not | CRITICAL |
| V3 | Energy conservation — brightness/contrast multiplier bounded, cannot create energy from nothing | HIGH |
| V4 | Generation budget control — only on emotional peaks and desire traversal, never on timer | HIGH |
| V5 | Self-stimulus privacy — generated visions are internal, invisible to human partner | HIGH |
| V6 | Medoid integrity — concept image matches the geometrically central Moment of its cluster | MEDIUM |

---

## MARKERS

<!-- @mind:todo Write property-based test: scan all FalkorDB nodes, assert no property value > 10KB (catches base64 leaks) -->
<!-- @mind:todo Write coherence formula test: verify weight redistribution on missing image_embedding -->
<!-- @mind:todo Write injection multiplier boundary test: fuzz with extreme brightness/contrast values -->
<!-- @mind:proposition Consider adding V7: "Visual decay monotonicity — energy/weight only decrease without external reinforcement" -->
<!-- @mind:escalation FLASHBULB_THRESHOLD value determination — too low = budget waste, too high = citizens never dream -->
