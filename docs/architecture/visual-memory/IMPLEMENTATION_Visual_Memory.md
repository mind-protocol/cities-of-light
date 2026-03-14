# Visual Memory Substrate — Implementation: Code Architecture and Structure

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
ALGORITHM:       ./ALGORITHM_Visual_Memory.md
VALIDATION:      ./VALIDATION_Visual_Memory.md
THIS:            IMPLEMENTATION_Visual_Memory.md (you are here)
SYNC:            ./SYNC_Visual_Memory.md

CONCEPT:         docs/architecture/CONCEPT_Visual_Memory_Substrate.md
IMPL:            (no code yet — PROPOSED)
```

> **Contract:** Read docs before modifying. After changes: update IMPL or add TODO to SYNC. Run tests.

---

## CODE STRUCTURE

**Current state: PROPOSED — 0% implemented.** No source files exist. The structure below is the target architecture.

```
engine/
├── client/
│   ├── visual-memory/
│   │   ├── pov-capture.js          # WebGL viewport capture + resize + brightness/contrast
│   │   └── decay-renderer.js       # Two-axis visual decay (energy→opacity, weight→size/blur)
│   └── app.js                      # Existing — needs screenshot hook at Moment creation

src/server/
├── visual-memory/
│   ├── image-store.js              # Object storage adapter (S3/R2/local)
│   ├── clip-encoder.js             # CLIP/SigLIP encoding bridge (calls Python service or ONNX)
│   ├── flashbulb-vision.js         # Flashbulb Vision pipeline (freeze→context→prompt→generate→reinject)
│   └── coherence-v2.js             # Coherence formula v2 with Sim_vis term + fallback

.mind/runtime/
├── cognition/
│   └── flashbulb_vision.py         # Python alternative: Flashbulb Vision pipeline
├── traversal/
│   └── desire_image.py             # Desire traversal image generation trigger
├── physics/
│   └── coherence_v2.py             # Coherence v2 formula (Python side, for tick-integrated scoring)
│   └── crystallization_image.py    # Medoid selection on Law 10 concept crystallization

services/
└── clip-service/
    ├── server.py                   # FastAPI/Flask microservice for CLIP/SigLIP encoding
    ├── encode.py                   # CLIP model loading + forward pass
    └── requirements.txt            # torch, transformers, Pillow
```

### File Responsibilities

| File | Purpose | Key Functions/Classes | Lines | Status |
|------|---------|----------------------|-------|--------|
| `engine/client/visual-memory/pov-capture.js` | WebGL viewport capture, resize to 200x200, brightness/contrast computation | `capturePov()`, `computeBrightnessContrast()` | ~120 | TODO |
| `engine/client/visual-memory/decay-renderer.js` | Render-time visual decay: opacity (energy), scale/blur (weight) | `applyVisualDecay()`, `computeDecayParams()` | ~80 | TODO |
| `src/server/visual-memory/image-store.js` | Object storage upload/fetch (S3/R2/local adapter) | `upload()`, `fetch()`, `generateUri()` | ~150 | TODO |
| `src/server/visual-memory/clip-encoder.js` | Bridge to CLIP/SigLIP encoding service | `encode()`, `batchEncode()` | ~100 | TODO |
| `src/server/visual-memory/flashbulb-vision.js` | Full Flashbulb Vision pipeline: freeze WM, gather context, micro-agent prompt, generate, create vision node, reinject | `generateFlashbulbVision()`, `buildVisionPrompt()`, `createVisionNode()`, `reinjectSelfStimulus()` | ~250 | TODO |
| `src/server/visual-memory/coherence-v2.js` | Coherence formula v2 with visual similarity term + text-only fallback | `computeCoherence()`, `computeSimVis()` | ~80 | TODO |
| `.mind/runtime/traversal/desire_image.py` | Desire traversal trigger: check conditions, gather context, generate, update node | `trigger_desire_image()`, `should_generate_desire_image()` | ~120 | TODO |
| `.mind/runtime/physics/crystallization_image.py` | Medoid selection for Law 10 concept crystallization | `select_medoid()`, `crystallize_concept_image()` | ~60 | TODO |
| `services/clip-service/server.py` | HTTP microservice for CLIP/SigLIP encoding | `POST /encode`, `POST /batch-encode` | ~80 | TODO |
| `services/clip-service/encode.py` | CLIP model loading + forward pass | `load_model()`, `encode_image()`, `encode_batch()` | ~100 | TODO |

**Size Thresholds:**
- **OK** (<400 lines): Healthy size, easy to understand
- **WATCH** (400-700 lines): Getting large, consider extraction opportunities
- **SPLIT** (>700 lines): Too large, must split before adding more code

---

## DESIGN PATTERNS

### Architecture Pattern

**Pattern:** Pipeline + Event-Driven

**Why this pattern:** Visual memory operates as a series of pipelines (capture→encode→store, stimulus→freeze→generate→inject) triggered by events (Moment creation, emotional peaks, desire traversal). Each pipeline step is independent and testable. Event triggers come from the physics engine (Law 6 threshold, Law 10 crystallization) and the cognition loop (subentity traversal).

### Code Patterns in Use

| Pattern | Applied To | Purpose |
|---------|------------|---------|
| Adapter | `image-store.js` | Abstract S3/R2/local storage behind a single `upload()`/`fetch()` interface — storage backend can change without affecting callers |
| Bridge | `clip-encoder.js` | Bridge between JS server and Python CLIP service — encoding implementation can change (ONNX JS, Python service, remote API) without affecting callers |
| Pipeline | `flashbulb-vision.js` | Each step (freeze, context, prompt, generate, create, reinject) is a function that takes input and returns output — the pipeline is composable and testable per step |
| Strategy (implicit) | `coherence-v2.js` | Two formula strategies (visual + text-only fallback) selected at runtime based on embedding availability |

### Anti-Patterns to Avoid

- **Base64 in graph nodes**: The most tempting shortcut — "just store the image as a property." The graph will bloat. The physics will slow. The invariant is absolute.
- **Synchronous encoding in capture**: CLIP encoding takes 50-200ms. If capture blocks on encoding, Moment creation stalls. Encoding must be async — the Moment node is created immediately, embedding is set when encoding completes.
- **Per-tick image generation**: Any proposal to "generate images every tick" or "generate on every stimulus" must be rejected. The two triggers (flashbulb + desire traversal) are the only gates.
- **God pipeline**: Don't merge flashbulb-vision.js and desire_image.py into one "image-generator" module. They have different triggers, different contexts, different output types. Keep them separate.

### Boundaries

| Boundary | Inside | Outside | Interface |
|----------|--------|---------|-----------|
| Visual memory module | Image capture, storage, encoding, generation triggers, coherence v2, decay rendering | Physics laws (1,3,6,7,8,10,14,16,17), WM assembly, motor control | `image_uri` + `image_embedding` on graph nodes |
| CLIP encoding service | Model loading, forward pass, vector output | Image capture, storage, prompt generation | HTTP API: `POST /encode` → `float[512]` |
| Object storage | File upload/download, URI generation | Embedding computation, graph mutations, physics | `upload(key, blob)` → `uri`, `fetch(uri)` → `blob` |

---

## SCHEMA

### Moment Node (extended with image fields)

```yaml
Moment:
  existing:
    - id: string                    # "moment:{timestamp}" or "moment:vision_{timestamp}"
    - type: "moment"
    - subtype: string               # "observation", "conversation", "vision" (new)
    - content: string               # Text content
    - energy: float                 # [0, 1]
    - weight: float                 # [0, 1]
    - valence: float                # Emotional valence
    - arousal: float                # Emotional arousal
    - stability: float              # [0, 1]
    - recency: float                # [0, 1]
  new (visual memory):
    - image_uri: string             # Object storage URI (e.g., "s3://bucket/moments/123.jpg")
    - image_embedding: float[512]   # CLIP/SigLIP embedding vector
  constraints:
    - image_uri must be a valid URI or NULL — never base64
    - image_embedding must be exactly 512 floats or NULL
    - subtype "vision" indicates a Flashbulb Vision (generated, not captured)
```

### Desire Node (extended with image fields)

```yaml
Desire:
  existing:
    - id: string
    - type: "desire"
    - content: string
    - energy: float
    - valence: float
  new (visual memory):
    - image_uri: string             # Generated desire visualization
    - image_embedding: float[512]   # CLIP/SigLIP embedding for prediction error
  constraints:
    - image_uri generated only when energy > 0.4 during traversal
    - Once set, image_uri is immutable (no regeneration)
```

### Concept Node (extended with inherited image)

```yaml
Concept:
  existing:
    - id: string
    - type: "concept"
    - content: string
  new (visual memory):
    - image_uri: string             # Inherited from medoid at crystallization
    - image_embedding: float[512]   # Inherited from medoid at crystallization
  constraints:
    - image_uri comes from medoid Moment, NEVER from generation
    - If no cluster Moments have images, concept remains imageless
```

### Actor Node (profile image)

```yaml
Actor:
  existing:
    - id: string
    - type: "actor"
    - name: string
  existing (already has uri field):
    - image_uri: string             # Profile pic from citizen registry / avatar file
  new (visual memory):
    - image_embedding: float[512]   # CLIP/SigLIP embedding of profile pic
  constraints:
    - Profile pic uploaded at citizen creation, not generated
```

---

## ENTRY POINTS

| Entry Point | File:Line | Triggered By |
|-------------|-----------|--------------|
| POV screenshot capture | `engine/client/visual-memory/pov-capture.js:capturePov()` | Moment creation event from the cognition loop |
| Flashbulb Vision | `src/server/visual-memory/flashbulb-vision.js:generateFlashbulbVision()` | Law 6: `\|limbic_delta\| > FLASHBULB_THRESHOLD` |
| Desire image generation | `.mind/runtime/traversal/desire_image.py:trigger_desire_image()` | Subentity traversal reaching a desire with energy > 0.4 and no image |
| Medoid selection | `.mind/runtime/physics/crystallization_image.py:crystallize_concept_image()` | Law 10 crystallization event |
| Coherence v2 scoring | `src/server/visual-memory/coherence-v2.js:computeCoherence()` | WM assembly / node scoring during cognition cycle |
| Visual decay rendering | `engine/client/visual-memory/decay-renderer.js:applyVisualDecay()` | Client render loop (per-frame for visible memory nodes) |

---

## DATA FLOW AND DOCKING (FLOW-BY-FLOW)

### POV Capture Flow: Viewport Pixels to Graph Properties

This flow transforms raw WebGL pixels into graph-native image properties on Moment nodes. It runs at every Moment creation and is the most frequent image operation.

```yaml
flow:
  name: pov_capture
  purpose: Convert citizen's viewport into stored image + embedding on Moment node
  scope: WebGL viewport → object storage + FalkorDB
  steps:
    - id: capture
      description: Read pixels from WebGL rendering context
      file: engine/client/visual-memory/pov-capture.js
      function: capturePov()
      input: WebGLRenderingContext
      output: ImageData (raw pixels)
      trigger: Moment creation event
      side_effects: none
    - id: resize
      description: Downscale to 200x200 thumbnail
      file: engine/client/visual-memory/pov-capture.js
      function: capturePov() (internal step)
      input: ImageData
      output: Blob (JPEG, 200x200)
      trigger: previous step
      side_effects: none
    - id: brightness_contrast
      description: Compute brightness/contrast from pixel values
      file: engine/client/visual-memory/pov-capture.js
      function: computeBrightnessContrast()
      input: ImageData (200x200)
      output: { brightness: float, contrast: float }
      trigger: previous step
      side_effects: none
    - id: upload
      description: Upload thumbnail to object storage
      file: src/server/visual-memory/image-store.js
      function: upload()
      input: Blob + key
      output: URI string
      trigger: previous step (async)
      side_effects: file written to object storage
    - id: encode
      description: Compute CLIP/SigLIP embedding
      file: src/server/visual-memory/clip-encoder.js
      function: encode()
      input: Blob
      output: float[512]
      trigger: previous step (async, can parallel with upload)
      side_effects: none
    - id: store_on_node
      description: Set image_uri and image_embedding on Moment node
      file: src/server/visual-memory/ (graph mutation)
      function: graph.query SET
      input: URI + embedding + moment_id
      output: updated Moment node
      trigger: upload + encode complete
      side_effects: FalkorDB mutation
```

### Flashbulb Vision Flow: Emotional Peak to Self-Stimulus

This flow transforms an emotional peak into a generated image, a vision node, and a self-stimulus injection. It is rare (only on threshold crossings) and latency-tolerant.

```yaml
flow:
  name: flashbulb_vision
  purpose: Generate spontaneous visual experience during emotional peak
  scope: limbic state → image generation API → FalkorDB + Law 1 stimulus queue
  steps:
    - id: detect_threshold
      description: Check if limbic_delta exceeds FLASHBULB_THRESHOLD
      file: .mind/runtime/physics/ (Law 6)
      function: check_flashbulb()
      input: limbic_delta
      output: boolean
      trigger: physics tick
      side_effects: none
    - id: freeze_wm
      description: Capture current Working Memory coalition
      file: src/server/visual-memory/flashbulb-vision.js
      function: generateFlashbulbVision() step 1
      input: citizen_id
      output: wm_nodes[], wm_images[], wm_keywords[]
      trigger: threshold crossed
      side_effects: none
    - id: gather_context
      description: Query spatial and social context from graph
      file: src/server/visual-memory/flashbulb-vision.js
      function: generateFlashbulbVision() step 2
      input: citizen_id
      output: current_space, present_actors[]
      trigger: previous step
      side_effects: FalkorDB read query
    - id: micro_agent_prompt
      description: LLM generates image prompt from context
      file: src/server/visual-memory/flashbulb-vision.js
      function: buildVisionPrompt()
      input: wm_images, keywords, emotional_state, actors, space
      output: vision_prompt (string)
      trigger: previous step
      side_effects: LLM API call (cheap model)
    - id: generate_image
      description: Call image generation API
      file: src/server/visual-memory/flashbulb-vision.js
      function: generateFlashbulbVision() step 4
      input: vision_prompt
      output: image blob
      trigger: previous step
      side_effects: image generation API call
    - id: upload_and_encode
      description: Upload to storage + CLIP encode
      file: src/server/visual-memory/image-store.js + clip-encoder.js
      function: upload() + encode()
      input: image blob
      output: vision_uri + vision_embedding
      trigger: previous step
      side_effects: file written to object storage
    - id: create_vision_node
      description: Create moment:vision node in graph
      file: src/server/visual-memory/flashbulb-vision.js
      function: createVisionNode()
      input: vision_uri, vision_embedding, limbic state
      output: vision node
      trigger: previous step
      side_effects: FalkorDB mutation
    - id: reinject
      description: Inject vision as self-stimulus via Law 1
      file: src/server/visual-memory/flashbulb-vision.js
      function: reinjectSelfStimulus()
      input: vision node
      output: self_stimulus
      trigger: previous step
      side_effects: stimulus added to Law 1 queue (visible_to_human: false)
```

---

## LOGIC CHAINS

### LC1: Screenshot to Coherence Participation

**Purpose:** A captured POV screenshot becomes a first-class participant in WM assembly scoring.

```
Viewport pixels (WebGL readPixels)
  → pov-capture.js:capturePov()        # resize to 200x200, compute brightness/contrast
    → image-store.js:upload()           # store JPEG in object storage → URI
    → clip-encoder.js:encode()          # CLIP forward pass → float[512]
      → graph SET image_uri, image_embedding on Moment node
        → coherence-v2.js:computeCoherence()  # Sim_vis term uses image_embedding
          → WM assembly ranks this node with visual similarity included
```

### LC2: Emotional Peak to Behavioral Change

**Purpose:** An emotional peak produces a vision that changes the citizen's behavior.

```
Physics tick detects |limbic_delta| > FLASHBULB_THRESHOLD
  → flashbulb-vision.js:generateFlashbulbVision()  # freeze WM, gather context
    → micro-agent LLM call                          # generate image prompt
      → image generation API                        # produce vision image
        → createVisionNode()                        # moment:vision in graph
          → reinjectSelfStimulus()                   # Law 1 internal stimulus
            → citizen processes vision               # may inhibit (Law 9), reinforce, or redirect
```

---

## MODULE DEPENDENCIES

### Internal Dependencies

```
engine/client/visual-memory/pov-capture.js
    └── depends on → engine/client/app.js (WebGL renderer access)

src/server/visual-memory/flashbulb-vision.js
    └── depends on → src/server/visual-memory/image-store.js (upload)
    └── depends on → src/server/visual-memory/clip-encoder.js (encoding)
    └── depends on → src/server/graph-client.js (FalkorDB queries)
    └── depends on → .mind/runtime/physics/ (Law 1 inject_stimulus)

src/server/visual-memory/coherence-v2.js
    └── depends on → src/server/graph-client.js (node queries)

.mind/runtime/traversal/desire_image.py
    └── depends on → services/clip-service/ (encoding)
    └── depends on → .mind/runtime/physics/graph/ (graph queries)

.mind/runtime/physics/crystallization_image.py
    └── depends on → .mind/runtime/physics/ (Law 10 crystallization hook)
```

### External Dependencies

| Package | Used For | Imported By |
|---------|----------|-------------|
| `torch` + `transformers` | CLIP/SigLIP model loading and inference | `services/clip-service/encode.py` |
| `Pillow` | Image preprocessing for CLIP input | `services/clip-service/encode.py` |
| `@aws-sdk/client-s3` or `wrangler` | S3/R2 object storage upload/fetch | `src/server/visual-memory/image-store.js` |
| `onnxruntime-web` (alternative) | Client-side CLIP encoding if Python service unavailable | `engine/client/visual-memory/` (optional) |
| Image generation API SDK | DALL-E / Stable Diffusion / Flux API client | `src/server/visual-memory/flashbulb-vision.js` |

---

## STATE MANAGEMENT

### Where State Lives

| State | Location | Scope | Lifecycle |
|-------|----------|-------|-----------|
| Image files | Object storage (S3/R2/local) | Persistent | Created at capture/generation, never modified, deleted only on node deletion |
| image_uri | FalkorDB node property | Per-node | Set once at capture/generation, immutable |
| image_embedding | FalkorDB node property | Per-node | Set once at encoding, immutable |
| Brightness/contrast | Computed at capture, used for injection multiplier | Per-Moment, transient | Applied once at Moment creation, not stored separately |
| Visual decay params | Computed at render time | Per-frame, ephemeral | Derived from node.energy and node.weight each frame |

### State Transitions

```
Node created (no image) ──[capture/generate]──> Node with image_uri + image_embedding
                                                         |
                                         [energy decay (Law 3)] ──> opacity/brightness decrease
                                         [weight decay (Law 7)] ──> size/blur decrease
                                                         |
                                         [weight < MIN_WEIGHT] ──> image hidden (forgotten)
                                                         |
                                         [reactivation] ──> energy restored, image brightens
```

---

## RUNTIME BEHAVIOR

### Initialization

```
1. Verify object storage connectivity (S3/R2/local bucket exists)
2. Verify CLIP encoding service is reachable (health check on /encode endpoint)
3. Register Flashbulb Vision trigger with physics engine (subscribe to Law 6 threshold events)
4. Register desire image trigger with traversal engine (subscribe to subentity traversal events)
5. Register medoid selection with Law 10 crystallization hook
6. System ready — visual memory captures begin on next Moment creation
```

### Main Loop / Request Cycle

```
1. Moment creation event fires
2. POV capture pipeline runs async (capture → resize → upload → encode → store on node)
3. Brightness/contrast computed, injection multiplier applied to initial energy
4. Moment node available for coherence scoring (with Sim_vis when encoding completes)
```

### Shutdown

```
1. Drain any in-flight upload/encoding operations
2. No cleanup needed — images in object storage are persistent, graph properties are persistent
```

---

## CONCURRENCY MODEL

| Component | Model | Notes |
|-----------|-------|-------|
| POV capture | Async (non-blocking) | Capture is sync (readPixels), resize is sync, upload + encode are async |
| CLIP encoding | Async HTTP | Calls to Python microservice are non-blocking; batching possible |
| Flashbulb Vision | Async pipeline | Entire pipeline (freeze→prompt→generate→store→inject) is async; must not block physics tick |
| Desire image generation | Async | Triggered during traversal but runs in background; traversal continues |
| Coherence v2 scoring | Sync | Fast computation (dot products), runs inline during WM assembly |
| Visual decay rendering | Sync per-frame | Trivial computation (multiply/clamp), runs in render loop |

---

## CONFIGURATION

| Config | Location | Default | Description |
|--------|----------|---------|-------------|
| `IMAGE_STORAGE_BUCKET` | env var | `mind-visual-memory` | Object storage bucket name |
| `IMAGE_STORAGE_PROVIDER` | env var | `local` | One of: `s3`, `r2`, `local` |
| `CLIP_SERVICE_URL` | env var | `http://localhost:8100` | URL of CLIP/SigLIP encoding service |
| `CLIP_MODEL` | env var | `openai/clip-vit-base-patch32` | CLIP model identifier |
| `FLASHBULB_THRESHOLD` | `.mind/runtime/physics/constants.py` | TBD | Limbic delta threshold for vision generation |
| `IMAGE_GENERATION_THRESHOLD` | `.mind/runtime/physics/constants.py` | `0.4` | Minimum desire energy for image generation |
| `IMAGE_GENERATION_API` | env var | TBD | One of: `dalle`, `stable-diffusion`, `flux` |
| `POV_THUMBNAIL_SIZE` | config | `200` | POV screenshot thumbnail dimension (square) |
| `WM_THUMBNAIL_SIZE` | config | `20` | Micro-thumbnail size for LLM prompt inclusion |
| `MIN_WEIGHT` | `.mind/runtime/physics/constants.py` | TBD | Weight below which memory image disappears (forgotten) |

---

## BIDIRECTIONAL LINKS

### Code → Docs

No code exists yet. When implemented, files should reference:

| File | Line | Reference |
|------|------|-----------|
| `engine/client/visual-memory/pov-capture.js` | top | `// DOCS: docs/architecture/visual-memory/ALGORITHM_Visual_Memory.md#pov-screenshot-capture-pipeline` |
| `src/server/visual-memory/flashbulb-vision.js` | top | `// DOCS: docs/architecture/visual-memory/ALGORITHM_Visual_Memory.md#flashbulb-vision-pipeline` |
| `src/server/visual-memory/coherence-v2.js` | top | `// DOCS: docs/architecture/visual-memory/ALGORITHM_Visual_Memory.md#coherence-formula-v2-with-sim_vis` |

### Docs → Code

| Doc Section | Implemented In |
|-------------|----------------|
| ALGORITHM: POV Screenshot Capture | `engine/client/visual-memory/pov-capture.js` (TODO) |
| ALGORITHM: Coherence v2 | `src/server/visual-memory/coherence-v2.js` (TODO) |
| ALGORITHM: Flashbulb Vision | `src/server/visual-memory/flashbulb-vision.js` (TODO) |
| ALGORITHM: Desire Traversal | `.mind/runtime/traversal/desire_image.py` (TODO) |
| ALGORITHM: Medoid Selection | `.mind/runtime/physics/crystallization_image.py` (TODO) |
| ALGORITHM: Two-Axis Decay | `engine/client/visual-memory/decay-renderer.js` (TODO) |
| BEHAVIOR B1-B8 | All TODO |
| VALIDATION V1-V6 | All TODO |

---

## EXTRACTION CANDIDATES

No code exists yet — no extraction needed. When `flashbulb-vision.js` is implemented, watch its line count. The pipeline has 6 steps; if it exceeds 400 lines, extract `buildVisionPrompt()` and `createVisionNode()` into separate modules.

---

## MARKERS

<!-- @mind:todo All files are TODO — this is a PROPOSED module with 0% implementation -->
<!-- @mind:escalation CLIP service deployment: Python microservice vs ONNX-in-browser vs remote API -->
<!-- @mind:escalation Object storage choice: S3 (AWS) vs R2 (Cloudflare) vs local filesystem for POC -->
<!-- @mind:escalation Image generation API: Stable Diffusion (free, self-host) vs DALL-E (paid, API) vs Flux (fast, API) -->
<!-- @mind:proposition Consider onnxruntime-web for client-side CLIP encoding to avoid Python service dependency -->
<!-- @mind:todo Define FLASHBULB_THRESHOLD constant — needs calibration against limbic delta distribution -->
