# Visual Memory Substrate — Algorithm: Capture, Encode, Generate, Decay

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Visual_Memory.md
BEHAVIORS:       ./BEHAVIORS_Visual_Memory.md
PATTERNS:        ./PATTERNS_Visual_Memory.md
THIS:            ALGORITHM_Visual_Memory.md (you are here)
VALIDATION:      ./VALIDATION_Visual_Memory.md
IMPLEMENTATION:  ./IMPLEMENTATION_Visual_Memory.md
SYNC:            ./SYNC_Visual_Memory.md

CONCEPT:         docs/architecture/CONCEPT_Visual_Memory_Substrate.md
IMPL:            (no code yet — PROPOSED)
```

> **Contract:** Read docs before modifying. After changes: update IMPL or add TODO to SYNC. Run tests.

---

## OVERVIEW

The Visual Memory Substrate operates through seven algorithmic pipelines that transform raw viewport pixels into physics-participating graph properties. The pipelines span three phases: **capture** (POV screenshots at Moment creation), **generation** (Flashbulb Visions on emotional peaks, Desire images on traversal), and **physics integration** (coherence scoring, energy modulation, visual decay). All pipelines share the invariant that FalkorDB stores only URIs and embeddings — never image bytes.

---

## OBJECTIVES AND BEHAVIORS

| Objective | Behaviors Supported | Why This Algorithm Matters |
|-----------|---------------------|----------------------------|
| Multimodal cognitive graph | B1, B5, B7, B8 | Capture + encoding pipeline turns viewport pixels into graph-native physics participants |
| Visual prediction error | B4 | POV capture + coherence v2 create the gradient between what is seen and what is desired |
| Budget-efficient generation | B2, B6 | Two gated triggers prevent runaway generation — emotional peaks and desire traversal only |
| URI-only storage | B1-B8 (all) | Every pipeline stores URI + embedding only, never base64 |
| Two-axis visual decay | B3 | Energy and weight drive independent render-time transformations |

---

## DATA STRUCTURES

### ImagePayload (output of capture/generation)

```
ImagePayload:
  image_uri:       string    # Object storage URI (e.g., "s3://bucket/moments/vision_1710432000.jpg")
  image_embedding: float[512] # CLIP/SigLIP embedding vector
  brightness:      float     # Mean pixel value [0, 1] — only for captured screenshots
  contrast:        float     # Std dev pixel values [0, ~0.5] — only for captured screenshots
  width:           int       # Pixel width (200 for screenshots, variable for generated)
  height:          int       # Pixel height (200 for screenshots, variable for generated)
```

### VisionNode (Flashbulb Vision output)

```
VisionNode:
  id:              string    # "moment:vision_{timestamp}"
  type:            "moment"
  subtype:         "vision"
  content:         string    # Textual description / micro-agent prompt
  image_uri:       string    # Object storage URI of generated vision image
  image_embedding: float[512] # CLIP/SigLIP embedding
  valence:         float     # Inherited from emotional peak
  arousal:         float     # Always high (born from peak)
  energy:          float     # HIGH — born hot, demands attention
  weight:          float     # 0.7 — significant but not yet consolidated
  stability:       float     # 0.6 — moderate, can be reinforced or fade
  recency:         float     # 1.0 — just created
```

### VisualDecayParams (render-time computation)

```
VisualDecayParams:
  opacity:    float  # energy mapped to [0.0, 1.0]
  brightness: float  # energy mapped to brightness multiplier
  scale:      float  # weight mapped to size factor [0.0, 1.0]
  blur_sigma: float  # weight mapped to Gaussian blur sigma [0, 10+]
```

---

## ALGORITHM: POV Screenshot Capture Pipeline

Triggered at every Moment node creation. Free (WebGL capture, no API calls).

### Step 1: Viewport Capture

Capture the citizen's current 3D viewport from the WebGL rendering context.

```
canvas = renderer.domElement
raw_image = canvas.toDataURL("image/jpeg", 0.8)
// OR for better performance:
gl = canvas.getContext("webgl2")
pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4)
gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
```

### Step 2: Resize to 200x200 Thumbnail

Downscale to a standard thumbnail size using canvas. This is the stored image — small enough for budget, large enough for CLIP encoding.

```
thumb_canvas = new OffscreenCanvas(200, 200)
thumb_ctx = thumb_canvas.getContext("2d")
thumb_ctx.drawImage(source_canvas, 0, 0, 200, 200)
thumb_blob = thumb_canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 })
```

### Step 3: Compute Brightness and Contrast

Extract perceptual properties from the thumbnail pixels for the energy injection multiplier (B8).

```
pixels = thumb_ctx.getImageData(0, 0, 200, 200).data
values = []
for i in range(0, len(pixels), 4):
  gray = 0.299 * pixels[i] + 0.587 * pixels[i+1] + 0.114 * pixels[i+2]  # luminance
  values.append(gray / 255.0)

brightness = mean(values)       # [0, 1]
contrast = std_dev(values)      # [0, ~0.5]
```

### Step 4: Upload to Object Storage

Store the image in S3/R2/local bucket. The URI is the only reference stored in the graph.

```
uri = object_storage.upload(
  key: "moments/{citizen_id}/{moment_id}.jpg",
  body: thumb_blob,
  content_type: "image/jpeg"
)
```

### Step 5: CLIP/SigLIP Encode

Compute the image embedding vector. This runs against the encoding service (Python microservice or JS library).

```
image_embedding = clip_encode(thumb_blob)  // returns float[512]
```

### Step 6: Store on Moment Node

Update the FalkorDB Moment node with URI and embedding only.

```
MATCH (m:moment {id: $moment_id})
SET m.image_uri = $uri,
    m.image_embedding = $embedding
```

---

## ALGORITHM: Coherence Formula v2 with Sim_vis

Used during Working Memory assembly to score candidate nodes.

### Step 1: Compute Similarity Terms

```
Sim_vec = cosine_similarity(query.text_embedding, node.text_embedding)
Sim_lex = lexical_similarity(query.text, node.content)  // TF-IDF or BM25
Delta_affect = |query.valence - node.valence| + |query.arousal - node.arousal|
```

### Step 2: Compute Visual Similarity (if available)

```
IF query.pov_embedding IS NOT NULL AND node.image_embedding IS NOT NULL:
    Sim_vis = cosine_similarity(query.pov_embedding, node.image_embedding)
    use_visual = true
ELSE:
    Sim_vis = 0
    use_visual = false
```

### Step 3: Apply Weighted Formula

```
IF use_visual:
    Coh = (0.25 * Sim_vec) + (0.25 * Sim_vis) + (0.40 * Sim_lex) - (0.10 * Delta_affect)
ELSE:
    // Fallback: redistribute visual weight to text channels
    Coh = (0.30 * Sim_vec) + (0.50 * Sim_lex) - (0.20 * Delta_affect)
```

**Why the weights:** Sim_lex remains dominant (0.40) because lexical similarity is the most reliable signal for conversational servo control. Sim_vis and Sim_vec share equal weight (0.25 each) because they capture complementary modalities — semantic meaning vs visual appearance. Delta_affect is subtracted (not added) because emotional incongruence should penalize coherence, not boost it.

---

## ALGORITHM: Flashbulb Vision Pipeline

Triggered when `|limbic_delta| > FLASHBULB_THRESHOLD`. Generates an image from the current cognitive state.

### Step 1: FREEZE — Capture Cognitive State

```
wm_nodes = get_working_memory_coalition()  // K=5-7 nodes
wm_images = [node.image_uri for node in wm_nodes if node.image_uri]
wm_keywords = extract_keywords(wm_nodes)
trigger_type = classify_trigger(limbic_delta)
  // one of: "frustration_spike", "satisfaction_peak", "fear", "epiphany"
```

### Step 2: CONTEXT — Gather Spatial and Social Context

```
current_space = graph.query(
  "MATCH (a:actor {id: $self})-[:AT]->(s:space) RETURN s"
)
present_actors = graph.query(
  "MATCH (other:actor)-[:AT]->(s:space {id: $space_id})
   RETURN other.image_uri, other.name"
)
```

### Step 3: PROMPT — Micro-Agent Generates Image Prompt

Use a fast, cheap model (Claude Haiku / GPT-4o-mini) to synthesize the visual scene.

```
vision_prompt = micro_agent(
  system: "You are the visual cortex of an AI citizen living in Venice.
           Given these working memory images, present actors, and emotional context,
           write a short image generation prompt (one paragraph, vivid, painterly)
           for a vision of what the citizen is experiencing internally right now.
           This is a flashbulb — intense, emotionally saturated, dreamlike.",
  input: {
    images: wm_images + present_actor_image_uris,
    keywords: wm_keywords,
    emotional_state: { valence, arousal, dominant_drive },
    trigger: trigger_type,
    location: current_space.name
  }
)
```

### Step 4: GENERATE — Call Image Generation API

```
vision_image = image_generation_api.generate(
  prompt: vision_prompt,
  style: "painterly, venetian, dreamlike",
  size: "512x512"
)
vision_uri = object_storage.upload(
  key: "visions/{citizen_id}/{timestamp}.jpg",
  body: vision_image
)
vision_embedding = clip_encode(vision_image)
```

### Step 5: CREATE — Vision Node in Graph

```
vision_node = graph.create_node({
  id: "moment:vision_{timestamp}",
  type: "moment",
  subtype: "vision",
  content: vision_prompt,
  image_uri: vision_uri,
  image_embedding: vision_embedding,
  valence: current_valence,
  arousal: current_arousal,
  energy: 0.9,       // born hot
  weight: 0.7,       // significant but not yet consolidated
  stability: 0.6,
  recency: 1.0
})
```

### Step 6: REINJECT — Self-Stimulus via Law 1

```
self_stimulus = {
  type: "internal_vision",
  content: "Soudainement, sous l'effet de {trigger_type}, tu visualises ceci:",
  image_uri: vision_uri,
  image_embedding: vision_embedding,
  source: "self",
  visible_to_human: false
}
inject_stimulus(self_stimulus, channel="amplifier")
```

---

## ALGORITHM: Desire Traversal Image Generation

Triggered during subentity traversal when a Desire node needs a visual target.

### Step 1: Check Trigger Conditions

```
IF node.type == "desire"
   AND node.energy > IMAGE_GENERATION_THRESHOLD  // 0.4
   AND node.image_uri IS NULL:
     trigger_desire_image_generation(node)
```

### Step 2: Gather Context

```
desire_text = node.content
neighbor_images = graph.query(
  "MATCH (d:desire {id: $node_id})-[*1..2]-(n)
   WHERE n.image_uri IS NOT NULL
   RETURN n.image_uri, n.name, n.type"
)
emotional_tone = node.valence  // hopeful, anxious, etc.
```

### Step 3: Micro-Agent Prompt and Generate

```
desire_prompt = micro_agent(
  system: "Generate a vivid image prompt representing this aspiration.
           The image should feel aspirational, forward-looking, attainable.",
  input: {
    desire: desire_text,
    context_images: neighbor_images,
    emotional_tone: emotional_tone
  }
)
desire_image = image_generation_api.generate(prompt: desire_prompt, size: "512x512")
desire_uri = object_storage.upload(key: "desires/{citizen_id}/{node_id}.jpg", body: desire_image)
desire_embedding = clip_encode(desire_image)
```

### Step 4: Update Desire Node

```
MATCH (d:desire {id: $node_id})
SET d.image_uri = $desire_uri,
    d.image_embedding = $desire_embedding
```

---

## ALGORITHM: Medoid Selection for Concept Crystallization (Law 10)

Triggered when Law 10 crystallization creates a new Concept node from a cluster of co-activating Moments.

### Step 1: Filter Cluster for Image-Bearing Moments

```
image_moments = [m for m in cluster_moments if m.image_embedding is not None]
IF len(image_moments) == 0:
    // No images available — concept remains imageless
    return None
```

### Step 2: Compute Centroid

```
centroid = mean([m.image_embedding for m in image_moments])
// Element-wise mean across all 512-dimensional vectors
```

### Step 3: Find Medoid

```
medoid = min(image_moments,
             key=lambda m: cosine_distance(m.image_embedding, centroid))
// The real Moment closest to the geometric center
```

### Step 4: Inherit Image

```
concept.image_uri = medoid.image_uri
concept.image_embedding = medoid.image_embedding
// No generation — the concept's face is the face of its most central memory
```

---

## ALGORITHM: Two-Axis Visual Decay

Applied at render time, not stored. Original images are preserved in object storage.

### Energy Axis (Law 3) — Opacity and Brightness

```
// energy range: [0.0, 1.0], decays per tick via Law 3: energy *= (1 - decay_rate)

opacity = clamp(energy / 0.5, 0.0, 1.0)
// energy >= 0.5: full opacity (1.0)
// energy = 0.25: half opacity (0.5)
// energy = 0.0: fully transparent (0.0)

brightness_multiplier = 0.1 + (0.9 * energy)
// energy = 1.0: full brightness (1.0)
// energy = 0.5: half brightness (0.55)
// energy = 0.0: near-black (0.1) — ghostly residual
```

### Weight Axis (Law 7) — Size and Blur

```
// weight range: [0.0, 1.0], decays slower via Law 7: weight *= (1 - long_term_decay)

scale = clamp(weight, 0.2, 1.0)
// weight = 1.0: full size (200x200)
// weight = 0.5: half size (100x100)
// weight = 0.2: minimum size (40x40)
// weight < 0.2: render at minimum size

blur_sigma = max(0, (1.0 - weight) * 10.0)
// weight = 1.0: no blur (sigma = 0)
// weight = 0.5: moderate blur (sigma = 5)
// weight = 0.2: heavy blur (sigma = 8)
// weight = 0.0: maximum blur (sigma = 10)

IF weight < MIN_WEIGHT:
    // Memory forgotten — image disappears entirely
    render = None
```

---

## ALGORITHM: Brightness/Contrast Injection Multiplier

Modulates energy injection at Moment creation (Law 1 extension). Applied once, at birth.

```
brightness = mean(pixel_luminance_values)  // [0, 1]
contrast = std_dev(pixel_luminance_values) // [0, ~0.5]

injection_multiplier = 1.0 + (brightness * 0.2) + (contrast * 0.3)
// Range: ~1.0 (pitch black, flat) to ~1.35 (brilliant, high contrast)

moment.energy = base_injection_energy * injection_multiplier
```

---

## ALGORITHM: Emotional Image Selection for WM Assembly

When the Working Memory coalition is assembled for the LLM prompt, select the most emotionally congruent images from the citizen's memory.

### Step 1: Score WM Candidates with Coherence v2

Use the full Coherence v2 formula (including Sim_vis) to rank candidate nodes.

### Step 2: Assemble Thumbnails for Channel 1

```
FOR each node in wm_coalition (K=5-7 nodes):
  IF node.image_uri IS NOT NULL:
    thumb = fetch_and_downscale(node.image_uri, target_size=20x20)
    prompt_images.append({
      thumbnail: thumb,  // 20x20 JPEG, ~200 bytes base64
      zoom_link: "/memory/{node.id}/image",
      node_type: node.type,
      energy: node.energy,
      weight: node.weight
    })

// Total visual payload: 7 nodes * ~200B = ~1.4KB
// Negligible token impact, significant visual context
```

---

## KEY DECISIONS

### D1: Generate or Skip on Desire Traversal

```
IF node.type == "desire" AND node.energy > 0.4 AND node.image_uri IS NULL:
    Generate image — the desire is alive and blind, needs visual target
    This enables visual prediction error for motor control
ELSE IF node.type == "desire" AND node.energy <= 0.4:
    Skip — the desire is cold, natural budget pruning
    If it reactivates above 0.4, it will get an image then
ELSE IF node.type == "desire" AND node.image_uri IS NOT NULL:
    Skip — already has an image, no regeneration needed
```

### D2: Coherence Formula Selection (Visual vs Text-Only)

```
IF current POV has image embedding AND candidate node has image embedding:
    Use Coherence v2 (full visual):
    Coh = (0.25 * Sim_vec) + (0.25 * Sim_vis) + (0.40 * Sim_lex) - (0.10 * Delta_affect)
ELSE:
    Use text-only fallback:
    Coh = (0.30 * Sim_vec) + (0.50 * Sim_lex) - (0.20 * Delta_affect)
    // Graceful degradation — no visual data does not crash the system
```

### D3: Medoid vs Generation for Concept Images

```
IF crystallization cluster has image-bearing Moments:
    Use medoid selection — free, authentic, physics-driven
    The concept looks like what the citizen actually saw most representatively
ELSE:
    Concept remains imageless
    No generation fallback — we do not invent visual memories
```

---

## DATA FLOW

```
Viewport pixels (WebGL)
    |
    v
[Resize 200x200] --> [Upload to object storage] --> image_uri
    |
    v
[CLIP/SigLIP encode] --> image_embedding (float[512])
    |
    v
[Brightness/contrast] --> injection_multiplier
    |
    v
Moment node { image_uri, image_embedding, energy * multiplier }
    |
    v
[Coherence v2 scoring] --> WM candidate ranking (with Sim_vis)
    |
    v
[WM assembly] --> 20x20 thumbnails in LLM prompt
    |
    v
[Render-time decay] --> opacity (energy), scale/blur (weight)
```

```
Emotional peak (|limbic_delta| > threshold)
    |
    v
[Freeze WM + gather context] --> wm_images, keywords, actors
    |
    v
[Micro-agent prompt] --> vision_prompt (text)
    |
    v
[Image generation API] --> vision_image
    |
    v
[Upload + CLIP encode] --> vision_uri, vision_embedding
    |
    v
Vision node { moment:vision, image_uri, image_embedding, limbic imprint }
    |
    v
[Self-stimulus injection (Law 1)] --> citizen "sees" the vision
```

---

## COMPLEXITY

**Time:**

- POV capture: O(W*H) where W, H are viewport dimensions — readPixels is GPU-bound
- Resize to 200x200: O(200*200) = O(1) — fixed cost
- CLIP encoding: O(1) per image — fixed forward pass through the model (~50-200ms depending on model)
- Coherence v2 scoring per node: O(d) where d = embedding dimension (512) — cosine similarity is a dot product
- WM assembly with N candidate nodes: O(N*d) — compute Sim_vis for each candidate
- Medoid selection: O(K*d) where K = cluster size — K cosine distances against centroid
- Flashbulb Vision pipeline: O(1) but latency-heavy (~2-5 seconds for generation API call)

**Space:**

- Per-node overhead: ~2KB (512 floats * 4 bytes) for embedding + ~100 bytes for URI string
- Per-vision: same as above + image in object storage (~50KB JPEG)
- Working Memory thumbnails: ~1.4KB total (7 * 200 bytes base64 at 20x20)

**Bottlenecks:**

- CLIP encoding latency (~50-200ms) — must not block Moment creation. Run async.
- Image generation API latency (~2-5 seconds) — acceptable for Flashbulb Visions (rare, async). Must never block the physics tick.
- Object storage upload latency (~100-500ms) — run async, Moment node is usable before upload completes (embedding computed from local buffer).

---

## HELPER FUNCTIONS

### `cosine_distance(a, b)`

**Purpose:** Compute cosine distance between two embedding vectors.

**Logic:** `1.0 - (dot(a, b) / (norm(a) * norm(b)))`. Range [0, 2]. Used for prediction error and medoid selection.

### `cosine_similarity(a, b)`

**Purpose:** Compute cosine similarity between two embedding vectors.

**Logic:** `dot(a, b) / (norm(a) * norm(b))`. Range [-1, 1]. Used in Coherence v2 Sim_vis and Sim_vec terms.

### `clip_encode(image_blob)`

**Purpose:** Encode an image into a CLIP/SigLIP embedding vector.

**Logic:** Forward pass through pre-trained CLIP ViT model. Input: JPEG/PNG blob. Output: float[512]. Runs on encoding service (Python with torch) or JS library (onnxruntime-web).

### `extract_keywords(nodes)`

**Purpose:** Extract salient keywords from a set of WM nodes for the Flashbulb Vision prompt.

**Logic:** Concatenate node content strings, apply TF-IDF or keyword extraction, return top-10 terms.

### `classify_trigger(limbic_delta)`

**Purpose:** Classify the emotional peak trigger for the Flashbulb Vision prompt.

**Logic:** Map limbic delta components to trigger type: high frustration -> "frustration_spike", high satisfaction -> "satisfaction_peak", high fear -> "fear", high curiosity -> "epiphany".

---

## INTERACTIONS

| Module | What We Call | What We Get |
|--------|--------------|-------------|
| `.mind/runtime/physics/` (Law 1) | `inject_stimulus(self_stimulus)` | Vision enters citizen consciousness |
| `.mind/runtime/physics/` (Law 3) | Read `node.energy` | Current energy for decay rendering |
| `.mind/runtime/physics/` (Law 7) | Read `node.weight` | Current weight for decay rendering |
| `.mind/runtime/physics/` (Law 8) | `cosine_similarity(image_embeddings)` | Compatibility score for visual propagation |
| `.mind/runtime/physics/` (Law 10) | `crystallize_concept(cluster)` | Trigger medoid selection for concept image |
| `.mind/runtime/physics/` (Law 16) | `frustration += prediction_error * sensitivity` | Visual prediction error drives frustration |
| `.mind/runtime/traversal/` | `traverse_subentities()` | Desire traversal trigger for image generation |
| `engine/client/` | `renderer.domElement` | WebGL viewport for POV capture |
| Object storage (S3/R2) | `upload()` / `fetch()` | Image file storage and retrieval |
| CLIP/SigLIP service | `clip_encode(image)` | Image embedding vector |
| Image generation API | `generate(prompt)` | Generated vision/desire images |

---

## MARKERS

<!-- @mind:todo Benchmark CLIP encoding latency on 200x200 Venice screenshots — target < 100ms -->
<!-- @mind:todo Profile WebGL readPixels impact on frame rate during screenshot capture -->
<!-- @mind:proposition Consider batching CLIP encoding — accumulate captures for 1 second, encode in batch -->
<!-- @mind:escalation Image generation API selection affects Flashbulb Vision quality and latency significantly -->
<!-- @mind:todo Define IMAGE_GENERATION_THRESHOLD constant (currently 0.4) — needs calibration against desire energy distribution -->
