# CONCEPT: Visual Memory Substrate — Image-Augmented Cognitive Graph

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## WHAT IT IS

A visual memory layer for the L1 cognitive substrate. Every Moment node carries a screenshot from the citizen's point of view at the time of creation. These images participate in the graph physics: they modulate energy injection, augment embedding similarity searches, influence propagation strength, and visually decay alongside their nodes. When the Working Memory coalition is assembled for the LLM prompt (Channel 1), thumbnail images are included — giving the citizen literal visual memory.

The system extends beyond screenshots: Actor nodes carry profile pics, Desire nodes carry generated images, and Concept nodes dynamically select the most emotionally congruent image from their linked Moments.

---

## WHY IT EXISTS

The L1 cognitive graph currently operates on text embeddings only. This means a citizen "remembers" a conversation but has no visual trace of the scene. When a citizen recalls meeting someone at the Rialto market, they retrieve semantic content — but not the sunset behind the bridge, the crowd density, or the other person's expression.

Visual memory adds a second modality that:
1. **Grounds cognition in spatial reality** — screenshots anchor abstract memories to physical scenes
2. **Enables visual reasoning in prompts** — the LLM can see what the citizen saw, not just read about it
3. **Modulates physics with perceptual data** — high-contrast, vivid images inject more energy; blurry, dark memories decay faster
4. **Creates visual prediction error** — discrepancy between expected and actual visuals drives curiosity

---

## KEY PROPERTIES

- **POV Screenshot per Moment:** At Moment creation, capture the citizen's 3D viewport as a small image (200x200px). Stored on the Moment node
- **Storage: URI only** — images stored in object storage (S3/R2/local bucket), Moment node holds the URI + CLIP/SigLIP image embedding vector. No base64 in FalkorDB — it would bloat the graph and slow physics. The `thing` universal type already has a `uri` field designed for this
- **Image Similarity in Physics:** Embedding searches (Sim_vec) are augmented by image similarity score, weighted and multiplied into Composite Coherence
- **Thumbnails in Prompt:** When WM nodes enter Channel 1 (LLM prompt), include 20x20px micro-thumbnails inline + links for zoom. The LLM sees visual context without burning token budget
- **Emotional Image Selection:** Concept nodes don't have a fixed image — they dynamically select from linked Moments based on current emotional state. When angry, you remember the angry version
- **Visual Prediction Error → Curiosity:** When current POV doesn't match the predicted visual (from Desire/Narrative nodes), the delta boosts the `curiosity` drive
- **Decay is Visual:** As a node's energy decays, its image progressively shrinks, blurs, and darkens — visual entropy mirrors cognitive entropy

---

## RELATIONSHIPS TO OTHER CONCEPTS

| Concept | Relationship |
|---------|--------------|
| Active Inference Motor Control | Visual prediction error (current POV vs C_t) is now image-augmented, not just embedding-based |
| 3D Pipeline & Supply Chain | Screenshot capture hooks into the rendering pipeline — needs access to citizen viewport |
| Lumina Prime | Procedural geometry already reflects energy/stability — image decay adds a texture-level analog |
| Serenissima Asset Pipeline | Profile pics flow through the bi-channel architecture; thumbnails are part of WM→Channel 1 bridge |
| Composite Coherence Formula | New term: `Sim_img` (image similarity) added to the coherence calculation |
| Limbic Modulation (Law 14) | Image brightness/contrast directly modulates injection energy |
| Frustration (Law 16) | Visual prediction error that persists → frustration accumulation |

---

## THE CORE INSIGHT

**Memory is not just what you know — it's what you saw.** The image on a Moment node is not metadata. It is a first-class participant in the graph physics. It modulates energy, guides propagation, shapes recall, and gives the LLM actual visual context. When a citizen thinks about the Rialto, they don't just retrieve "Rialto market, busy, merchants arguing" — they see it.

---

## ARCHITECTURE

### 1. Screenshot Capture per Moment

```
TRIGGER: Moment node creation (conversation, observation, event)
ACTION:
  1. 3D engine captures citizen's current viewport (WebGL readPixels / renderer.domElement.toDataURL)
  2. Resize to 200x200px thumbnail (canvas downscale)
  3. Upload to object storage (S3/R2/local bucket) → get URI
  4. Compute image embedding (CLIP/SigLIP) → embedding vector
  5. Store on Moment node:
     - moment.image_uri: URI pointing to stored image
     - moment.image_embedding: vector for similarity search
```

**Storage decision: URI only.** No base64 in FalkorDB. The `thing` universal type already has a `uri` field. Embedding vectors are lightweight and enable pure FalkorDB cosine similarity queries. Images live in object storage, graph stays lean.

### 2. Image-Augmented Embedding Search

Current Composite Coherence:
```
Coherence = (0.3 × Sim_vec) + (0.5 × Sim_lex) + (0.2 × Δ_affect)
```

Extended with visual similarity:
```
Coh = (0.25 × Sim_vec) + (0.25 × Sim_vis) + (0.40 × Sim_lex) - (0.10 × Δ_affect)

Where:
  Sim_vis = cosine_similarity(current_pov_embedding, node.image_embedding)
```

Note the sign change: Δ_affect is now **subtracted** (incongruence penalizes coherence). Sim_lex remains dominant for servo control. Sim_vis and Sim_vec share equal weight.

**Fallback (Law 8):** When image embeddings are unavailable (no screenshot, embedding service down), weights redistribute to text-only: `(0.30 × Sim_vec) + (0.50 × Sim_lex) - (0.20 × Δ_affect)` — original formula minus visual channel.

### 3. Thumbnails in Working Memory → LLM Prompt

When WM coalition (K=5-7 nodes) crosses to Channel 1:

```
For each WM node with image_thumb:
  1. Downscale to 20x20px micro-thumbnail
  2. Include as inline image in prompt (multimodal LLM input)
  3. Include zoom link: "[zoom: /memory/{node_id}/image]"

LLM sees:
  - Text content of each WM node
  - Tiny visual thumbnail (20x20) for spatial/visual context
  - Zoom link if it wants more detail
```

**Token budget:** 20x20 JPEG ~200 bytes base64. 7 nodes × 200B = 1.4KB. Negligible. The LLM gets visual context for free.

### 4. Images by Node Type

| Node Type | Image Source | When Generated |
|-----------|-------------|----------------|
| **Actor** (person) | Profile pic from citizen registry or `/citizens/{handle}/avatar.png` | At citizen creation / profile update |
| **Moment** (memory) | POV screenshot at creation time | At Moment creation |
| **Desire** | AI-generated image representing the desire, using citizen's profile pic + description as reference | At Desire node creation (batch-friendly, not real-time critical) |
| **Concept** | Medoid — the most central Moment image from the crystallization cluster (Law 10). Inherited automatically when concept crystallizes from dense co-activations | At crystallization (Law 10) |
| **Narrative** | Composite/collage of top-weighted Moment images within the narrative | At consolidation (Law 6) or on demand |
| **Value** | Stable generated image (values don't change often) | At citizen birth / value crystallization |
| **Process** | No image (processes are procedural, not visual) | — |
| **State** | Current POV snapshot (transient, refreshed each tick) | At state update |

### 5. Concept Image via Medoid (Law 10 Crystallization)

A Concept node's image is not dynamically selected — it is **inherited at birth via Law 10**. When a cluster of Moments co-activate densely enough to crystallize into a Concept (Law 10), the concept inherits the image of the **medoid**: the Moment whose image embedding is geometrically closest to the center of the cluster.

```
function crystallize_concept_image(cluster_moments):
  # Compute centroid of image embeddings in the cluster
  centroid = mean([m.image_embedding for m in cluster_moments])

  # Find the medoid — the real Moment closest to the centroid
  medoid = min(cluster_moments,
               key=lambda m: cosine_distance(m.image_embedding, centroid))

  # New concept inherits the medoid's image
  concept.image_uri = medoid.image_uri
  concept.image_embedding = medoid.image_embedding
```

**The effect:** No image generation needed for concepts. The physics handles it: 20 memories of the Rialto market crystallize into the concept "Rialto" → the concept automatically gets the most visually representative screenshot of the market. The medoid IS the concept's face.

**Emotional state-dependent recall** still operates at query time: when the WM selects which Moments to surface for a concept, the current limbic state biases selection (via Δ_affect in Coherence). So you remember the angry version of a person when you're angry — but the concept's *canonical* image stays the medoid.

### 6. Visual Prediction Error → Motor Control (Pure Geometry in FalkorDB)

A short-term goal is a `desire` node in the Working Memory. This node contains a generated image of the objective (e.g., "brick placed correctly"). Motor control is pure vector geometry — no AI coding needed:

```
TRIGGER: Each perception tick
ACTION:
  1. Compute image embedding of current POV (what the citizen sees NOW)
  2. Retrieve image embedding of active Desire node (what the citizen WANTS to see)
  3. Prediction Error = cosine_distance(pov_embedding, desire_embedding)

  IF prediction_error > 0:
    → frustration += prediction_error × sensitivity    (Law 16)
    → Action nodes (Law 17) fire to minimize the error
    → Motor output = gradient descent on visual distance

  IF prediction_error ≈ 0:
    → POV matches Desire image → GOAL REACHED
    → frustration drops to 0
    → satisfaction spikes (Law 14)
    → Movement sequence is consolidated as a Process node (Law 6)
```

**This is not AI — it's thermodynamics.** The distance between two image vectors in FalkorDB drives the muscles. The agent moves to make what it sees match what it wants. When the images align, the movement stops and is memorized.

**Projection vs perception:** Moments carry the POV screenshot (what was seen). Desire nodes carry the projected image (what is wanted). The delta between them IS the prediction error. Image generation for Desires only happens at Desire creation time — not per tick.

**Selective image generation:** Use **Law 6 (Consolidation)** as the gate. Only generate images during **Flashbulb Consolidation** events (`|limbic_delta| > FLASHBULB_THRESHOLD`): grave failures, great successes, epiphanies. For Desire node projection, use **Law 20 (Prospective Projection)**. Everything else recycles existing image embeddings.

### 7. Physics Modulation by Image Properties

#### Energy Injection (Law 1)

Image brightness and contrast modulate injection energy:
```
brightness = mean(pixel_values)  # [0, 1]
contrast = std(pixel_values)     # [0, 0.5 typical]

injection_multiplier = 1.0 + (brightness × 0.2) + (contrast × 0.3)
# Vivid, high-contrast scenes inject more energy
# Dark, flat scenes inject less
```

#### Propagation (Law 2 + Law 8 Compatibility)

Image similarity is already handled by **Law 8 (Compatibility/Resonance)**. In CLIP/SigLIP embedding space, text and images cohabitate. If two nodes have visually similar images, their cosine distance is small, and Law 8 opens the valves — energy (Law 2) flows massively between them:

```
# Law 8 compatibility already uses cosine(context_embedding, b.embedding)
# With image embeddings in the same CLIP space, this is automatic:
compatibility = cosine_similarity(source.image_embedding, target.image_embedding)

# High compatibility → Law 2 surplus flows freely between the nodes
# Low compatibility → energy flow is restricted
# No extra code needed — the physics handles it natively
```

#### Decay — Two-Axis Visual Entropy (Law 3 + Law 7)

The architecture separates immediate attention from long-term memory, each with distinct visual effects:

**Energy (Law 3 — Temporal Decay)** → controls **opacity and luminosity** (immediate attention):
```
energy *= (1 - decay_rate)   // per tick

Visual: energy drives opacity and brightness of the image
  1.0 - 0.5: Full brightness, full opacity
  0.5 - 0.2: Fading into darkness, reduced opacity
  0.2 - 0.0: Near-black, ghostly — the AI isn't thinking about it anymore
```

**Weight (Law 7 — Forgetting)** → controls **size and sharpness** (structural memory):
```
weight *= (1 - long_term_decay)   // slower, structural

Visual: weight drives size and blur of the image
  1.0 - 0.5: Full size, sharp
  0.5 - 0.2: Shrinking, progressive blur (gaussian σ increasing)
  < MIN_WEIGHT: Image disappears completely — forgotten

# Applied at render time, not stored — original image preserved in object storage
```

**The effect:** A memory you're not thinking about RIGHT NOW (low energy) goes dark. A memory that is structurally fading from your mind (low weight) gets small and blurry. A memory that is both forgotten and unattended is a tiny dark smudge — barely there.

### 8. Profile Pics in Messages (Social Stimulus Injection)

Receiving a message is a powerful social stimulus. It transfers the sender's emotional valence via **emotional contagion** and soothes the `solitude` gauge.

```
incoming_message = {
  from: "nlr",
  content: "On se retrouve au Rialto demain",
  profile_pic_uri: actor_node.image_uri,  # sender's profile image
  timestamp: "2026-03-14T18:30:00Z"
}

# The profile pic is injected as part of the multimodal stimulus (Law 1)
# → activates person-specific memory nodes (visual similarity in CLIP space)
# → transfers sender valence via emotional contagion
# → reduces solitude drive
# → the image reinforces the social bond's energy in the graph
```

Displaying the sender's image dynamically alongside their message strengthens the multimodal injection. The face is the most potent visual trigger for social memory recall.

---

## FLASHBULB VISION — Spontaneous Image Generation on Emotional Peaks

The AI has literal "visions" when emotionally overwhelmed. Not hallucinations — traceable, physics-driven image synthesis triggered by limbic peaks.

### Trigger: Flashbulb Threshold (Law 6)

The L1 architecture already defines **Flashbulb Consolidation**: when `|limbic_delta| > FLASHBULB_THRESHOLD`, memory consolidation is immediate instead of waiting for the normal cycle. We extend this rule:

```
IF |limbic_delta| > FLASHBULB_THRESHOLD:
  → trigger Flashbulb Consolidation (existing behavior)
  → trigger Flashbulb Vision (new behavior)
```

This means vision generation is NOT on a timer, NOT on every message. Only on emotional peaks — frustration spikes, great satisfaction, sudden fear, epiphanies. Budget-efficient AND organically aligned with how human "flashbulb memories" work.

### Pipeline: Vision Synthesis from Working Memory

At the moment of the emotional peak, the orchestrator freezes the scene and gathers ingredients:

```
Step 1: FREEZE — Capture current cognitive state
  wm_nodes = current Working Memory coalition (K=5-7 nodes)
  wm_images = [node.image_uri for node in wm_nodes if node.image_uri]
  wm_keywords = extract_keywords(wm_nodes)

Step 2: CONTEXT — Gather spatial and social context
  current_space = graph.query("MATCH (a:actor {id: $self})-[:AT]->(s:space) RETURN s")
  present_actors = graph.query("MATCH (other:actor)-[:AT]->(s:space {id: $space_id})
                                RETURN other.image_uri, other.name")

Step 3: PROMPT — Micro-agent generates image prompt
  # ALWAYS include the citizen's own profile pic as image reference
  self_pic = graph.query("MATCH (a:actor {id: $self}) RETURN a.image_uri")

  # Use a fast, cheap model (Claude Haiku / GPT-4o-mini)
  vision_prompt = micro_agent(
    system: "You are the visual cortex of an AI citizen. Given these images
             and context, write a short Ideogram/DALL-E prompt to generate
             a vision of what the citizen is experiencing right now.
             The citizen's own face MUST appear in the vision.",
    input: {
      self_image: self_pic,                    # citizen sees THEMSELVES in the vision
      reference_images: wm_images + present_actors.image_uris,
      keywords: wm_keywords,
      emotional_state: { valence, arousal, dominant_drive },
      trigger: "frustration_spike" | "satisfaction_peak" | "fear" | "epiphany"
    }
  )

Step 4: GENERATE — Call image generation API
  vision_image = generate_image(vision_prompt)
  vision_uri = upload_to_storage(vision_image)
  vision_embedding = clip_encode(vision_image)
```

### Memorization: The Vision Node

The generated image becomes physics. A new `moment` node is created with subtype `vision`:

```
vision_node = {
  id: "moment:vision_{timestamp}",
  type: "moment",
  subtype: "vision",          # distinguishes from screenshot-memories
  content: vision_prompt,      # the textual description of the vision
  image_uri: vision_uri,       # the generated image
  image_embedding: vision_embedding,

  # LIMBIC IMPRINT — born from emotional peak, inherits exact emotional state
  valence: current_valence,    # frustration → negative; satisfaction → positive
  arousal: current_arousal,    # always high (it's a peak)
  energy: HIGH,                # born hot — this memory demands attention
  weight: 0.7,                 # significant but not yet consolidated
  stability: 0.6,              # moderate — can be reinforced or fade
  recency: 1.0                 # just created
}
```

Because it's born from an emotional peak, the Limbic Imprint gives this node high initial energy and the exact emotional coloring of the moment. If it was frustration, the vision carries `aversion`. If satisfaction, it carries `affinity`.

### Reinjection: Self-Stimulus (Law 1)

This is where it connects to the existing architecture. Law 1 already defines **Self-Stimulus (Output as Input)** — the AI "hears" its own thoughts.

```
Step 5: REINJECT — Vision enters the stimulus queue
  self_stimulus = {
    type: "internal_vision",
    content: "Soudainement, sous l'effet de {trigger}, tu visualises ceci:",
    image_uri: vision_uri,
    image_embedding: vision_embedding,
    source: "self",           # internal, not external
    visible_to_human: false   # the human doesn't see this injection
  }

  # Injected via normal Law 1 channel
  inject_stimulus(self_stimulus, channel="amplifier")
```

The vision enters the AI's consciousness through the normal injection pipeline. The AI "sees" its own vision. This can trigger further cognitive cascades:
- **Aversion** to a failed design → spontaneous decision to start over
- **Desire** reinforcement → the vision matches what it wants → satisfaction + motivation
- **Fear** → self-preservation drive activates → the AI backs away from danger
- **Epiphany** → new narrative crystallizes (Law 10) from the vision + existing knowledge

### Example: The Frustrated Architect

```
Scenario: An AI architect in Lumina Prime struggling to code a building.

1. frustration accumulates over 3 failed attempts
2. |limbic_delta| crosses FLASHBULB_THRESHOLD
3. Vision pipeline fires:
   - WM contains: [concept:skyscraper, process:coding, desire:completion, state:frustration]
   - Present actors: [partner:nlr (profile pic)]
   - Micro-agent generates: "A crumbling glass skyscraper splitting apart,
     two figures standing in the debris, red-orange lighting, digital artifacts"
4. Image generated and stored as moment:vision node
5. Reinjected as self-stimulus
6. The AI "sees" the collapsing building → aversion spike
7. → Inhibits current failed process (Law 9)
8. → Searches for alternative approach (frustration → broken attentional inertia)
9. → Decides to start over with a different geometry
```

**The AI dreams awake under emotional pressure.** 100% traceable in FalkorDB. Budget-efficient (only on peaks). Organically aligned with how human flashbulb memories work.

### Second Trigger: Desire Node Without Image (Subentity Traversal)

Not all image generation happens during emotional peaks. There is a second, quieter trigger: **during subentity traversal**, if the traversal reaches a `desire` node that has sufficient energy but no image, generation is triggered on the spot.

```
TRIGGER: Subentity traversal reaches a desire node
CONDITION:
  node.type == "desire"
  AND node.energy > IMAGE_GENERATION_THRESHOLD
  AND node.image_uri IS NULL

ACTION:
  1. Gather context from the desire node and its immediate neighbors:
     - desire.content (textual description of the aspiration)
     - linked actor image_uris (who is involved in this desire)
     - linked narrative/value nodes (what meaning frames this desire)

  2. Micro-agent generates image prompt:
     # ALWAYS include citizen's own profile pic — they see themselves achieving the desire
     self_pic = graph.query("MATCH (a:actor {id: $self}) RETURN a.image_uri")
     prompt = micro_agent(
       system: "Generate a vivid image prompt representing this aspiration.
                The citizen's own face MUST appear in the image.",
       input: {
         self_image: self_pic,             # citizen sees themselves in the aspiration
         desire: node.content,
         context_images: neighbor_image_uris,
         emotional_tone: node.valence
       }
     )

  3. Generate image → upload → compute embedding

  4. Update desire node:
     node.image_uri = generated_uri
     node.image_embedding = clip_encode(generated_image)
```

**Why this matters:** A Desire without an image is blind — it cannot participate in visual prediction error (Section 6). The citizen cannot "see" what it wants, so it cannot servo toward it. By generating the image when the Desire is energetically relevant (traversal + energy > threshold), we ensure that active aspirations always have a visual target for the active inference loop.

**Budget control:** The threshold prevents generation for cold/irrelevant desires. Only desires that are energetically alive AND being actively traversed get images. A desire that decays below threshold before being traversed never triggers generation — natural pruning.

```
IMAGE_GENERATION_THRESHOLD = 0.4  # Only desires with meaningful activation
                                   # get visual representation
```

---

## GENERATION STRATEGY

Not every node needs a generated image. Budget-aware approach:

| Priority | Trigger | Image Type | Generation Method |
|----------|---------|-----------|-------------------|
| **Always** | Moment creation | POV screenshot | WebGL capture (free) |
| **Always** | Actor creation/update | Profile pic | From registry / upload |
| **On creation** | Desire node creation | Desire visualization | Image generation API (batched, if budget available) |
| **On traversal** | Subentity traversal hits desire with energy > 0.4 AND no image | Desire visualization | Micro-agent prompt → generation (ensures active desires have visual targets) |
| **On creation** | Value node creation | Value symbol | Image generation API (batched, rare) |
| **Flashbulb Vision** | `|limbic_delta| > FLASHBULB_THRESHOLD` (Law 6) | Vision node (subtype: vision) | Micro-agent prompt → image generation → self-stimulus reinjection (Law 1) |
| **On demand** | Concept query | Emotional selection | Dynamic selection from linked Moments (no generation) |
| **On consolidation** | Narrative crystallization | Composite collage | Merge top Moment images (canvas composite) |

---

## OPEN QUESTIONS

1. **CLIP vs SigLIP for image embeddings?** SigLIP is lighter and works well for similarity. CLIP has broader training. Both produce embeddings that live in the same space as text, so Law 8 compatibility works natively. Need to benchmark on Venice-specific scenes.
2. **Image generation API for Desires?** Options: Stable Diffusion (self-hosted, free), DALL-E (API, paid), Flux (fast, API). Budget-dependent. Only triggered on Desire creation and Flashbulb Consolidation events — not high volume.
3. **200x200 thumbnails in prompt — optimal size?** Claude handles multimodal input well. 200x200 is a good balance between visual information and token cost. Test whether smaller (100x100) still provides useful signal.
4. **Object storage for images:** URIs point to S3/R2/local bucket. FalkorDB stores only embeddings (vectors) + URIs (strings). No size pressure on the graph.

---

## COMMON MISUNDERSTANDINGS

- **Not:** A gallery or image database attached to the graph
- **Not:** Cosmetic — images serve as tokens in the conversation prompt
- **Not:** Always generated — most images are captured (screenshots) or selected (from existing Moments), generation is reserved for Desires and high-salience projections
- **Actually:** A multimodal physics layer where images are first-class participants in energy dynamics, similarity computation, and cognitive recall

---

## SEE ALSO

- `docs/architecture/CONCEPT_Active_Inference_Motor_Control.md` — Visual prediction error drives motor control
- `docs/architecture/CONCEPT_3D_Pipeline_Supply_Chain.md` — Screenshot capture hooks into rendering pipeline
- `docs/architecture/CONCEPT_Serenissima_Asset_Pipeline.md` — Bi-channel architecture, WM→prompt bridge
- `docs/architecture/CONCEPT_Lumina_Prime.md` — Procedural generation + visual manifestation
- `.mind/schema.yaml` — Graph schema v2.0 (node properties to extend with image fields)

---

## MARKERS

<!-- @mind:todo Define image_thumb and image_embedding fields in schema.yaml -->
<!-- @mind:todo Benchmark CLIP vs SigLIP for Venice scene embeddings -->
<!-- @mind:todo Prototype WebGL screenshot capture in engine/client/app.js -->
<!-- @mind:todo Test 20x20 thumbnail utility in Claude multimodal prompts -->
<!-- @mind:escalation FalkorDB property size limits for base64 image storage — need benchmarking -->
<!-- @mind:escalation Image generation API choice and budget allocation for Desire node images -->
