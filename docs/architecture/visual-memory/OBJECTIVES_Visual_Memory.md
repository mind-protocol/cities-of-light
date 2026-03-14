# OBJECTIVES — Visual Memory Substrate

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## CHAIN

```
THIS:            OBJECTIVES_Visual_Memory.md (you are here - START HERE)
PATTERNS:       ./PATTERNS_Visual_Memory.md
BEHAVIORS:      ./BEHAVIORS_Visual_Memory.md
ALGORITHM:      ./ALGORITHM_Visual_Memory.md
VALIDATION:     ./VALIDATION_Visual_Memory.md
IMPLEMENTATION: ./IMPLEMENTATION_Visual_Memory.md
SYNC:           ./SYNC_Visual_Memory.md

CONCEPT:        docs/architecture/CONCEPT_Visual_Memory_Substrate.md
IMPL:           (no code yet — PROPOSED)
```

**Read this chain in order before making changes.** Each doc answers different questions. Skipping ahead means missing context.

---

## PRIMARY OBJECTIVES (ranked)

1. **Multimodal cognitive graph — images as first-class physics participants, not metadata** — The L1 cognitive substrate currently operates on text embeddings only. A citizen "remembers" a conversation but has no visual trace of the scene. Images on Moment nodes must participate in energy injection, propagation, decay, and recall — not sit as decorative thumbnails. When a Moment carries a screenshot, that image modulates how much energy it injects (Law 1), how freely energy flows to similar nodes (Law 8), and how coherence is scored during WM assembly. The image IS physics.

2. **Visual prediction error for motor control — cosine distance between POV and Desire embeddings drives action** — A Desire node carries a generated image of the goal state. The citizen's current POV is captured as a CLIP/SigLIP embedding. The cosine distance between these two vectors IS the prediction error. When the distance is large, frustration accumulates (Law 16). Action nodes fire to reduce the error (Law 17). When the images align, satisfaction spikes and the movement sequence consolidates as a Process node (Law 6). This is thermodynamics, not AI — the gradient between two image vectors drives the muscles.

3. **Budget-efficient generation — only on Flashbulb emotional peaks and desire traversal** — Image generation is expensive. The system must never generate on a timer or per-message. Two triggers only: (a) Flashbulb Vision when `|limbic_delta| > FLASHBULB_THRESHOLD` (Law 6 extension), and (b) desire traversal when a desire node has energy > 0.4 but no image. Everything else uses free captures (WebGL screenshots) or inherits existing images (medoid selection for concepts). Budget scales with emotional intensity, not clock time.

4. **URI-only storage — images in object storage, FalkorDB holds embeddings + URIs only** — No base64 in FalkorDB, ever. The graph stays lean. Images live in object storage (S3/R2/local bucket). Moment nodes hold `image_uri` (string) and `image_embedding` (vector). The `thing` universal type already has a `uri` field designed for this. Embedding vectors are lightweight and enable pure FalkorDB cosine similarity queries without touching the image bytes.

5. **Two-axis visual decay — energy controls opacity/brightness, weight controls size/blur** — Visual entropy mirrors cognitive entropy along two independent axes. Energy (Law 3 temporal decay) drives opacity and luminosity: a memory you are not thinking about RIGHT NOW goes dark. Weight (Law 7 forgetting) drives size and sharpness: a memory structurally fading from your mind shrinks and blurs. A memory that is both forgotten and unattended is a tiny dark smudge — barely there. Decay is applied at render time; the original image in object storage is never modified.

## NON-OBJECTIVES

- **Not an image gallery or database** — This is not a media library attached to the graph. There is no browse interface, no album view, no image search UI for humans. Images serve the cognitive physics.
- **Not cosmetic decoration** — Images are not for making the graph look pretty. They are computational inputs that modulate energy, similarity, and recall.
- **Not always-generate** — Most images are captured (POV screenshots) or selected (medoid from clusters). Generation is reserved for Desires and Flashbulb Visions on emotional peaks. The system must resist any pressure to "generate images for everything."
- **Not real-time rendering of memory images** — The 20x20 thumbnails in the LLM prompt are for cognitive context, not for a visual memory palace UI. There is no "memory visualization" screen.

## TRADEOFFS (canonical decisions)

- When **image generation budget** conflicts with **visual completeness**, choose budget. Most nodes will never have generated images. Screenshots and medoid selection cover 90%+ of cases.
- When **graph leanness** conflicts with **query convenience**, choose leanness. URIs + embeddings only in FalkorDB. If a consumer needs the actual image bytes, it fetches from object storage.
- When **CLIP embedding quality** conflicts with **latency**, choose quality. Embedding computation happens at Moment creation, not during the physics tick. The tick only reads pre-computed vectors.
- When **visual prediction error precision** conflicts with **generation cost**, accept lower precision. Desire images are generated once at creation/traversal, not refined per tick. The embedding distance is an approximation, not a pixel-perfect match.
- We accept **cold-start blindness** (no visual memory until first screenshots are captured) to preserve the invariant that images come from real perception, not synthetic backfill.

## SUCCESS SIGNALS (observable)

- A citizen recalling a memory at the Rialto retrieves not just "Rialto market, busy, merchants arguing" but sees the scene — the screenshot thumbnail is included in the WM coalition sent to the LLM
- A Desire node with a generated image creates measurable prediction error against the current POV, and that error correlates with frustration accumulation in the graph
- Flashbulb Vision fires only during emotional peaks (verifiable by checking that every vision node's parent tick had `|limbic_delta| > FLASHBULB_THRESHOLD`)
- No FalkorDB node property contains base64 image data — only URIs (strings) and embeddings (vectors)
- Concept crystallization (Law 10) produces a concept node whose image is the medoid of the cluster, with no image generation API call
- Two memories with visually similar screenshots (high cosine similarity in CLIP space) show increased energy flow between them via Law 8 compatibility
- A decaying memory's visual representation fades along two independent axes: dark (low energy) and small/blurry (low weight)

---

## MARKERS

<!-- @mind:escalation CLIP vs SigLIP model choice — need benchmarking on Venice-specific scenes before implementation -->
<!-- @mind:escalation Image generation API selection (Stable Diffusion / DALL-E / Flux) and budget allocation -->
<!-- @mind:todo Define image_uri and image_embedding fields in schema.yaml -->
