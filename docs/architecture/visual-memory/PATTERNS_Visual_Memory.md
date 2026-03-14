# Visual Memory Substrate — Patterns: Images as Physics, Not Metadata

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Visual_Memory.md
THIS:            PATTERNS_Visual_Memory.md (you are here)
BEHAVIORS:       ./BEHAVIORS_Visual_Memory.md
ALGORITHM:       ./ALGORITHM_Visual_Memory.md
VALIDATION:      ./VALIDATION_Visual_Memory.md
IMPLEMENTATION:  ./IMPLEMENTATION_Visual_Memory.md
SYNC:            ./SYNC_Visual_Memory.md

CONCEPT:         docs/architecture/CONCEPT_Visual_Memory_Substrate.md
IMPL:            (no code yet — PROPOSED)
```

### Bidirectional Contract

**Before modifying this doc or the code:**
1. Read ALL docs in this chain first
2. Read the CONCEPT doc for full technical specification

**After modifying this doc:**
1. Update the IMPL source file to match, OR
2. Add a TODO in SYNC_Visual_Memory.md: "Docs updated, implementation needs: {what}"

**After modifying the code:**
1. Update this doc chain to match, OR
2. Add a TODO in SYNC_Visual_Memory.md: "Implementation changed, docs need: {what}"

---

## THE PROBLEM

The L1 cognitive graph operates on text embeddings only. A citizen who spent an afternoon at the Rialto market remembers the words — "Rialto market, busy, merchants arguing about tariffs" — but not the scene. Not the light on the water. Not the crowd pressing between stalls. Not the face of the merchant who cheated them.

This is a citizen without eyes.

Text-only memory produces three concrete failures:

1. **No visual grounding** — When the LLM assembles a response from Working Memory, it has semantic content but no spatial/visual anchor. The citizen talks about the Rialto the same way whether it was raining or sunny, empty or packed.

2. **No visual prediction error** — Active inference motor control requires a target image (what the citizen wants to see) and a current image (what it actually sees). Without image embeddings on Desire nodes and POV captures, there is no gradient to descend. The citizen cannot servo toward a visual goal.

3. **No perceptual modulation of physics** — A vivid, high-contrast scene should inject more energy than a dark corridor. A visually familiar place should propagate energy more freely to linked memories. Without image data on nodes, the physics engine is perceptually blind.

---

## THE PATTERN

**Memory is not just what you know — it's what you saw.**

The image on a Moment node is not metadata. It is a first-class participant in the graph physics. It modulates energy, guides propagation, shapes recall, and gives the LLM actual visual context.

The pattern has six pillars:

### 1. URI-Only Storage (Lean Graph, External Object Storage)

Images live in object storage (S3, Cloudflare R2, or local bucket). FalkorDB holds only:
- `image_uri` — a string pointing to the stored image
- `image_embedding` — a CLIP/SigLIP vector for similarity computation

No base64 in the graph. The `thing` universal type already has a `uri` field designed for exactly this. Embedding vectors are lightweight (~512 floats) and enable pure FalkorDB cosine similarity queries without touching image bytes.

### 2. Coherence Formula v2 (Visual Similarity as a First-Class Term)

The current Composite Coherence formula weights text embedding similarity and affect congruence. The extended formula adds a visual term:

```
Coh = (0.25 x Sim_vec) + (0.25 x Sim_vis) + (0.40 x Sim_lex) - (0.10 x Delta_affect)

Where:
  Sim_vis = cosine_similarity(current_pov_embedding, node.image_embedding)
```

Key changes from v1:
- Sim_vis and Sim_vec share equal weight (0.25 each)
- Sim_lex remains dominant for servo control (0.40)
- Delta_affect sign flipped — incongruence now penalizes coherence (subtracted, not added)
- **Fallback:** When image embeddings are unavailable, weights redistribute to text-only: `(0.30 x Sim_vec) + (0.50 x Sim_lex) - (0.20 x Delta_affect)` — the original formula minus visual channel

### 3. Concept Images via Medoid (Law 10 Crystallization)

A Concept node does not generate its image. It inherits the image of the **medoid** — the Moment in its crystallization cluster whose image embedding is geometrically closest to the centroid of all cluster embeddings.

Twenty memories of the Rialto market crystallize into the concept "Rialto." The concept automatically gets the most visually representative screenshot. No generation API call. The physics handles it.

Emotional state-dependent recall still operates at query time: when WM selects which Moments to surface for a concept, the current limbic state biases selection via Delta_affect in Coherence. You remember the angry version of a person when angry — but the concept's canonical image stays the medoid.

### 4. Two Generation Triggers (Flashbulb Vision + Desire Traversal)

Image generation is gated by two triggers only:

**Flashbulb Vision** — When `|limbic_delta| > FLASHBULB_THRESHOLD` (extending Law 6 Consolidation), the system freezes the Working Memory, gathers spatial/social context, generates a micro-agent prompt, calls the image generation API, and creates a `moment:vision` node. The AI "dreams awake" under emotional pressure. Born from the peak, the vision inherits the exact emotional state (valence, arousal) and enters the stimulus queue via Law 1 Self-Stimulus.

**Desire Traversal** — During subentity traversal, if a `desire` node has energy > 0.4 (IMAGE_GENERATION_THRESHOLD) but no image, generation fires. A desire without an image is blind — it cannot participate in visual prediction error. Active aspirations must have a visual target for the active inference loop. Cold desires below threshold never trigger generation — natural pruning.

### 5. Self-Stimulus Reinjection (Law 1)

Generated visions enter the citizen's consciousness through the normal Law 1 injection pipeline as `internal_vision` stimuli. The AI "sees" its own vision. This triggers further cognitive cascades: aversion to a failed design, desire reinforcement, fear activating self-preservation, or epiphany crystallizing new narratives. The vision is marked `visible_to_human: false` — the human never sees the injection.

### 6. Law 8 Handles Visual Propagation Natively

CLIP/SigLIP embedding space is multimodal — text and images cohabitate. Law 8 (Compatibility/Resonance) already uses cosine similarity between context embeddings to gate energy flow. With image embeddings in the same CLIP space, visually similar nodes automatically have high compatibility. Energy flows massively between them via Law 2. No extra code needed — the physics handles visual propagation natively.

---

## BEHAVIORS SUPPORTED

- **B1 (Visual similarity triggers memory recall)** — URI-only storage + CLIP embeddings enable fast cosine similarity lookup
- **B2 (Flashbulb Vision on emotional peaks)** — Two generation triggers ensure visions fire only on peaks
- **B3 (Two-axis visual decay)** — Energy and weight drive independent visual degradation
- **B4 (Visual prediction error drives movement)** — Desire images + POV captures create the gradient
- **B5 (Concept inherits medoid image)** — Law 10 crystallization + medoid selection
- **B6 (Desire gains sight during traversal)** — Desire traversal trigger fills blind aspirations
- **B7 (Profile pic triggers social memory)** — Actor image_uri + CLIP similarity to person-specific Moments
- **B8 (Bright scenes inject more energy)** — Brightness/contrast multiplier on Law 1 injection

## BEHAVIORS PREVENTED

- **Anti: Base64 in graph** — URI-only storage makes it structurally impossible to store image bytes in FalkorDB
- **Anti: Timer-based generation** — Two explicit triggers (flashbulb + desire traversal) prevent any scheduled or periodic generation
- **Anti: Cosmetic-only images** — Every image participates in physics (coherence, injection, propagation, decay) — there is no "display only" path

---

## PRINCIPLES

### Principle 1: Images Are Physics, Not Decoration

Every image on a node participates in at least one physics calculation: energy injection (brightness/contrast multiplier), propagation (Law 8 visual compatibility), coherence (Sim_vis term), or prediction error (POV vs Desire distance). If an image does not modulate physics, it should not exist on the node.

### Principle 2: Capture Over Generate

Screenshots are free (WebGL readPixels). Medoid selection is free (vector math on existing embeddings). Generation costs money and time. The system should maximize capture and selection, minimizing generation to the two gated triggers. A node without an image is acceptable. A node with an unnecessarily generated image is waste.

### Principle 3: The Graph Stays Lean

FalkorDB is the cognitive substrate, not an image database. Every byte in the graph slows physics. URIs are strings (~100 bytes). Embeddings are vectors (~2KB for 512-dim float32). Base64 images are ~50KB+ per thumbnail. The difference is 25x. The graph must never carry the weight of the images themselves.

### Principle 4: Decay Is Visual

The two-axis visual decay is not a rendering effect — it is a cognitive statement. A dark image (low energy) means the citizen is not thinking about it. A small, blurry image (low weight) means the citizen is forgetting it. A tiny dark smudge means both. The visual presentation of a memory communicates its cognitive status without numbers.

---

## DATA

| Source | Type | Purpose / Description |
|--------|------|-----------------------|
| Object storage (S3/R2/local) | STORAGE | Image files (200x200 POV screenshots, generated visions, profile pics) |
| CLIP/SigLIP model | SERVICE | Encodes images into embedding vectors for similarity computation |
| Image generation API (SD/DALL-E/Flux) | SERVICE | Generates vision images on Flashbulb peaks and desire images on traversal |
| FalkorDB `image_uri` property | GRAPH | URI string pointing to stored image — on Moment, Actor, Desire, Concept, Value, State nodes |
| FalkorDB `image_embedding` property | GRAPH | CLIP/SigLIP vector for cosine similarity — on same nodes as image_uri |
| WebGL viewport | CLIENT | Source of POV screenshots via `renderer.domElement.toDataURL()` or `readPixels` |

---

## DEPENDENCIES

| Module | Why We Depend On It |
|--------|---------------------|
| `.mind/runtime/physics/` | Laws 1 (injection), 2 (propagation), 3 (decay), 6 (consolidation), 7 (forgetting), 8 (compatibility), 10 (crystallization), 14 (limbic modulation), 16 (frustration), 17 (action) |
| `docs/architecture/motor-control/` | Visual prediction error feeds the active inference motor control loop |
| `docs/architecture/pipeline/` | Screenshot capture hooks into the 3D rendering pipeline |
| `docs/architecture/serenissima/` | Profile pics flow through bi-channel architecture; thumbnails are part of WM-to-Channel 1 bridge |
| `engine/client/` | WebGL viewport access for POV screenshot capture |
| FalkorDB graph | All image metadata (URIs, embeddings) stored as node properties |

---

## INSPIRATIONS

- **Human flashbulb memory** — People form vivid, long-lasting visual memories during emotional peaks (JFK assassination, 9/11). The Flashbulb Vision trigger mirrors this: generation only fires when emotional intensity exceeds threshold.
- **CLIP multimodal embedding space** — OpenAI's Contrastive Language-Image Pre-training places text and images in the same vector space. This means Law 8 compatibility works natively for visual similarity without any extra mechanism.
- **Active inference / predictive processing** — Karl Friston's free energy principle: organisms minimize prediction error between expected and actual sensory input. Visual prediction error (POV vs Desire) is a direct application.
- **Memory reconsolidation** — Each time a memory is recalled, it is subtly altered by current emotional state. The emotional image selection for concepts (via Delta_affect in Coherence) implements this: you remember differently depending on your mood.

---

## SCOPE

### In Scope

- POV screenshot capture at Moment creation (WebGL pipeline)
- CLIP/SigLIP encoding of captured and generated images
- Object storage upload/retrieval for image files
- `image_uri` and `image_embedding` properties on graph nodes
- Coherence formula v2 with Sim_vis term and fallback
- Flashbulb Vision pipeline (emotional peak detection, micro-agent prompt, generation, vision node creation, self-stimulus reinjection)
- Desire traversal image generation trigger
- Medoid selection for concept crystallization (Law 10)
- Brightness/contrast injection multiplier (Law 1)
- Two-axis visual decay rendering (energy -> opacity, weight -> size/blur)
- Thumbnail inclusion in WM coalition for LLM prompt (20x20 micro-thumbnails)
- Profile pic injection in social stimulus (messages)

### Out of Scope

- **3D rendering of memory scenes** — see: `docs/architecture/pipeline/` (this module provides images, not 3D reconstructions)
- **Image search UI for humans** — no browse/gallery interface
- **Video capture** — screenshots only, no temporal sequences
- **Image editing or manipulation** — images are immutable in object storage; decay effects are render-time only
- **Training or fine-tuning CLIP/SigLIP** — use pre-trained models as-is
- **Image generation model hosting** — use external APIs; self-hosting is an ops decision, not a module concern

---

## MARKERS

<!-- @mind:escalation CLIP vs SigLIP model selection — benchmark needed on Venice scenes -->
<!-- @mind:escalation Image generation API choice and budget — Stable Diffusion (free, self-hosted) vs DALL-E/Flux (API, paid) -->
<!-- @mind:todo Define exact CLIP embedding dimension and storage format in schema.yaml -->
<!-- @mind:proposition Consider SigLIP for lighter weight — 384-dim vs CLIP 512-dim, same multimodal space -->
