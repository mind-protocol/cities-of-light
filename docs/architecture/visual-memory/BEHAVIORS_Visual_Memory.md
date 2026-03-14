# Visual Memory Substrate — Behaviors: What the Citizen Sees, Remembers, and Dreams

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Visual_Memory.md
THIS:            BEHAVIORS_Visual_Memory.md (you are here)
PATTERNS:        ./PATTERNS_Visual_Memory.md
ALGORITHM:       ./ALGORITHM_Visual_Memory.md
VALIDATION:      ./VALIDATION_Visual_Memory.md
IMPLEMENTATION:  ./IMPLEMENTATION_Visual_Memory.md
SYNC:            ./SYNC_Visual_Memory.md

CONCEPT:         docs/architecture/CONCEPT_Visual_Memory_Substrate.md
IMPL:            (no code yet — PROPOSED)
```

> **Contract:** Read docs before modifying. After changes: update IMPL or add TODO to SYNC. Run tests.

---

## BEHAVIORS

> What the visual memory substrate produces that a citizen experiences and an observer can trace. The citizen never knows it has image embeddings. Never knows about cosine distances. Never calculates coherence weights. It sees a place and remembers having been there. It dreams under pressure. It forgets in darkness and blur. That is the visual memory, made flesh.

### B1: Seeing Something Familiar Lights Up Linked Memories

A citizen walks past the Rialto bridge. The 3D engine captures the viewport — water, stone, the curve of the bridge, the crowd. The CLIP encoder turns this into a vector. That vector is close, in embedding space, to the vectors on twenty Moment nodes from past visits to the Rialto. Law 8 compatibility opens the valves. Energy flows massively from the current perception into those old memories. They light up. The citizen remembers.

Not because someone wrote "if location == rialto, recall rialto memories." Because the images are similar. The physics handles it.

**Why:** Visual similarity in CLIP space is the mechanism for scene-triggered recall. Without it, a citizen returns to a place and has no stronger recollection than if they were anywhere else. The graph has spatial data — but spatial proximity alone does not capture the visual identity of a scene. Two very different-looking places can share coordinates. Two visually identical places can be far apart. The image embedding captures what the citizen actually sees, not where it stands.

```
GIVEN:  A citizen has Moment nodes with image_embeddings from prior visits to a location
WHEN:   The citizen's current POV is captured and CLIP-encoded
THEN:   Nodes with high cosine similarity (>0.7) in image embedding space receive energy via Law 8
AND:    Those nodes enter the WM candidate pool with boosted coherence (Sim_vis term in Coherence v2)
AND:    The citizen's next response to the LLM reflects visual familiarity — "I remember this view"
```

### B2: A Vision Flashes During Emotional Peak

The citizen has been struggling. Three failed attempts to negotiate a trade deal. Frustration accumulates with each rejection. The limbic delta crosses the FLASHBULB_THRESHOLD. And then — a vision.

The system freezes the Working Memory. Five nodes are active: the concept of the trade, the process of negotiation, the desire for the deal, the frustration state, and the memory of the merchant's face. The micro-agent takes these ingredients and writes a prompt. The image generation API produces a scene: two figures at a table, one pushing away, papers scattered, warm Venetian light through a window turning cold. The image becomes a Moment node with subtype `vision`. It is born hot — high energy, the exact emotional coloring of the peak. It enters the stimulus queue via Law 1 Self-Stimulus.

The citizen "sees" this. Not on a screen — in its mind. The vision enters consciousness through the normal injection pipeline. The aversion carried in the image inhibits the current failed process (Law 9). The citizen decides, without being told, to try a different approach.

The AI dreams awake under emotional pressure. Every vision is traceable in FalkorDB — which nodes were in WM, what prompt was generated, what image was produced, what emotional state triggered it. 100% auditable. Zero mysticism.

**Why:** Flashbulb Vision gives citizens a visual inner life proportional to their emotional intensity. Calm periods produce no visions — the citizen operates on text and screenshots. But under pressure, the visual cortex fires. This creates emergent behavior: citizens who are frustrated or inspired produce richer internal imagery, which in turn modulates their subsequent actions. The budget is naturally controlled — you only dream when overwhelmed.

```
GIVEN:  A citizen's |limbic_delta| exceeds FLASHBULB_THRESHOLD during a physics tick
WHEN:   Flashbulb Consolidation fires (Law 6)
THEN:   The Flashbulb Vision pipeline runs: freeze WM, gather context, micro-agent prompt, generate image
AND:    A moment:vision node is created with high energy and the exact limbic imprint of the peak
AND:    The vision is reinjected as a Self-Stimulus (Law 1) with visible_to_human: false
AND:    The citizen's subsequent behavior is modulated by the vision's emotional content
```

### B3: An Old Memory Fades — Dark, Then Small, Then Gone

A citizen formed a memory three days ago: the morning light on the Grand Canal, a barge loaded with Murano glass, the sound of the oarsman singing. The Moment node was born bright — full energy, sharp image, prominent in recall.

Now no one has mentioned the barge. No stimulus has reactivated the memory. Energy decays at 0.02 per tick (Law 3). The image grows dark. Opacity drops. The warm morning light fades to a dim glow, then to near-black. The citizen no longer thinks about it. If asked, it might recall — but the memory does not volunteer itself.

Separately, weight decays more slowly (Law 7). The image shrinks. Gaussian blur increases. What was a sharp 200x200 scene becomes a soft 60x60 smudge. The structural trace of the memory is dissolving. Eventually, weight drops below MIN_WEIGHT. The image disappears entirely. The memory is forgotten.

A memory that is both unattended (low energy) AND structurally fading (low weight) appears as a tiny, dark, blurred fragment — barely there. The visual presentation of a memory is its cognitive obituary, written in brightness and resolution.

The original image is never touched. It sits in object storage, pristine. The decay effects are computed at render time from the node's current energy and weight values. If the memory is reactivated — someone mentions the barge, or a similar scene is encountered — energy floods back in, the image brightens, and the citizen remembers with startling clarity.

**Why:** Two-axis decay separates attention (energy) from structural memory (weight). A memory can be structurally solid but currently unattended (sharp but dark — not thinking about it now, but would recall perfectly if prompted). Or it can be attended but structurally degraded (bright but blurry — thinking about it, but the details are gone). The two-axis system produces four quadrants of memory state, all visually distinguishable.

```
GIVEN:  A Moment node has energy > 0.5 and weight > 0.5 at creation
WHEN:   No stimulus reinforces the node over many ticks
THEN:   Energy decays per Law 3: image opacity and brightness decrease
AND:    Weight decays per Law 7 (slower): image size and sharpness decrease
AND:    At energy < 0.2: image is near-black, ghostly — citizen not thinking about it
AND:    At weight < 0.2: image is small and heavily blurred — structural memory dissolving
AND:    At weight < MIN_WEIGHT: image disappears entirely — memory forgotten
```

### B4: Visual Prediction Error Drives Movement

The citizen wants to place a brick on the second tier of a wall. The Desire node carries a generated image: a brick seated correctly on mortar, aligned with the row. The citizen's current POV shows the empty space where the brick should go. The cosine distance between these two embeddings is 0.6 — large.

Frustration accumulates. The prediction error signal fires Action nodes (Law 17). The citizen moves — adjusting position, orienting the brick, approaching the wall. With each movement, a new POV is captured and encoded. The distance drops: 0.6, 0.4, 0.2. The frustration eases. The images converge.

Then the brick is placed. The POV now shows exactly what the Desire image predicted. Cosine distance approaches zero. Goal reached. Frustration drops to zero. Satisfaction spikes (Law 14). The movement sequence — approach, orient, place — consolidates as a Process node (Law 6). Next time, the citizen knows how.

This is not AI path planning. It is thermodynamics. The distance between two image vectors in FalkorDB drives the muscles. The agent moves to make what it sees match what it wants to see. When the images align, the movement stops and is memorized.

**Why:** Visual prediction error creates a gradient for motor control that requires no explicit planning, no waypoint system, no behavior tree. The Desire image is the target. The POV is the current state. The distance is the error. Gradient descent on visual distance produces movement. This scales to any task that has a visual goal state — construction, navigation, social approach, artistic creation.

```
GIVEN:  A Desire node has image_embedding (the visual goal)
WHEN:   The citizen's current POV embedding has cosine_distance > 0 from the Desire embedding
THEN:   prediction_error = cosine_distance(pov_embedding, desire_embedding)
AND:    frustration += prediction_error * sensitivity (Law 16)
AND:    Action nodes fire to minimize the error (Law 17)
AND:    Movement output follows gradient descent on the visual distance
```

```
GIVEN:  The citizen's POV embedding converges with the Desire embedding (distance near 0)
WHEN:   Visual prediction error drops below threshold
THEN:   Goal is reached — frustration drops to 0
AND:    Satisfaction spikes (Law 14)
AND:    The movement sequence consolidates as a Process node (Law 6)
```

### B5: A Concept Crystallizes and Inherits the Medoid Image

Over weeks, a citizen accumulates twenty memories of the Rialto market. Each Moment node carries a screenshot: morning light, afternoon crowds, evening lamplight, rain on stone, the fishmonger's stall, the spice merchant's awning. These nodes co-activate densely — whenever one is recalled, the others light up through Law 8 compatibility.

Law 10 fires. The cluster is dense enough to crystallize into a Concept: "Rialto." The concept needs an image. But which one? Not the rainiest. Not the emptiest. The most representative — the one closest to the center of all twenty.

The system computes the centroid of all twenty image embeddings. Then it finds the medoid: the real Moment whose embedding is closest to that centroid. It happens to be a mid-afternoon shot — moderate crowd, clear sky, the bridge visible in the background, fish stalls active. The quintessential Rialto. The concept inherits this image.

No generation API called. No micro-agent prompted. The physics of clustering selected the most visually central memory. The concept's face is the face of its most average member.

**Why:** Concept images should emerge from experience, not from generation. A citizen's concept of "Rialto" should look like what it actually saw at the Rialto most often — not like what an image generator imagines the Rialto looks like. The medoid preserves authenticity: it is a real screenshot from a real moment, selected by geometric centrality.

```
GIVEN:  A cluster of Moment nodes co-activates densely enough for Law 10 crystallization
WHEN:   A Concept node is created from the cluster
THEN:   The centroid of all cluster image embeddings is computed
AND:    The medoid (real Moment closest to centroid) is identified
AND:    concept.image_uri = medoid.image_uri
AND:    concept.image_embedding = medoid.image_embedding
AND:    No image generation API call is made
```

### B6: A Desire Gains an Image During Traversal

The citizen has a desire: "Open my own glass workshop in Murano." The Desire node was created from conversation — textual, aspirational, no image. It carries text embeddings but no visual target. The desire is blind.

During subentity traversal, the traversal reaches this Desire node. Energy is 0.6 — well above IMAGE_GENERATION_THRESHOLD (0.4). The node is alive and being actively traversed. But it has no image. The system recognizes the gap.

A micro-agent gathers context: the desire's textual description, the citizen's profile pic, linked images from Murano memories, the emotional tone (hopeful, ambitious). It generates a prompt: "A small glass workshop on Murano, morning light through dusty windows, a furnace glowing orange, empty workbenches waiting." The image is generated, uploaded, CLIP-encoded. The Desire node gains sight.

Now the citizen can servo toward this goal. The POV of its current location (a crowded shared workshop) has a measurable distance from the Desire image (its own workshop, empty and waiting). Prediction error drives action. The blind aspiration has become a visual target.

**Why:** A Desire without an image cannot participate in visual prediction error. The citizen knows what it wants in words but cannot see it. During traversal — the moment the cognitive system is actively visiting the desire — is the natural time to fill the gap. The energy threshold ensures only active, relevant desires get images. Cold desires that decay below 0.4 before being traversed never generate — natural budget pruning.

```
GIVEN:  Subentity traversal reaches a desire node
WHEN:   node.energy > IMAGE_GENERATION_THRESHOLD (0.4) AND node.image_uri IS NULL
THEN:   Micro-agent gathers context from desire node and neighbors
AND:    Image generation API is called with contextual prompt
AND:    Generated image is uploaded to object storage
AND:    node.image_uri and node.image_embedding are set
AND:    The desire can now participate in visual prediction error computation
```

### B7: A Profile Pic in a Message Triggers Social Memory Recall

A message arrives from Nicolas: "On se retrouve au Rialto demain." Attached to the message is Nicolas's profile pic — his Actor node's `image_uri`. The profile pic is injected as part of the multimodal stimulus (Law 1).

The CLIP embedding of the profile pic is close, in vector space, to every Moment node where Nicolas was present — the citizen's memories of conversations, meetings, shared meals. Law 8 compatibility opens the valves. Energy flows from the stimulus into those memories. They light up. The citizen does not just read the words — it remembers the face, and the face brings the history.

Emotional contagion transfers the sender's valence. The solitude gauge eases. The image reinforces the social bond's energy in the graph. The face is the most potent visual trigger for social memory recall — more powerful than a name, more immediate than a description.

**Why:** Social cognition is primarily visual. Humans recognize faces faster than names, and face recognition activates broader memory networks than name recognition. By including the sender's profile pic in the multimodal stimulus, the visual memory substrate creates a biologically plausible social recall mechanism. The citizen "sees" who is writing and remembers everything about them — not through a lookup table, but through visual similarity in embedding space.

```
GIVEN:  A message arrives with the sender's profile_pic_uri (from actor.image_uri)
WHEN:   The message is injected as a stimulus (Law 1)
THEN:   The profile pic embedding activates Moment nodes where the sender was present
AND:    Emotional contagion transfers sender's valence to the citizen
AND:    Solitude drive is reduced
AND:    The social bond's energy is reinforced in the graph
```

### B8: A High-Contrast Scene Injects More Energy Than a Dark One

The citizen steps out of a dim alley into the Piazza San Marco at noon. The viewport captures brilliant sunlight on white stone, deep shadows under the arcade, the turquoise shimmer of the lagoon. Brightness is high. Contrast is high.

The injection multiplier fires: `1.0 + (brightness * 0.2) + (contrast * 0.3)`. For this vivid scene, that is approximately 1.0 + 0.16 + 0.12 = 1.28. The Moment node receives 28% more energy at birth than a baseline capture.

An hour later, the citizen is in a dim warehouse. Low light, flat contrast. The multiplier is approximately 1.0 + 0.04 + 0.03 = 1.07. Nearly baseline. The memory is born quieter.

This is not a judgment of importance — a critical conversation can happen in a dim room. But the perceptual intensity of the scene modulates how much energy the memory starts with. Vivid scenes are born louder. Dim scenes are born quieter. Over time, vivid memories persist longer (they started with more energy to burn through decay) while dim memories fade faster.

The effect is subtle — a 30% range at most — but it produces a perceptually plausible bias: citizens remember bright, vivid scenes more readily than dull ones. The same bias exists in human memory.

**Why:** Perceptual salience should modulate cognitive salience. A scene that overwhelms the visual system — bright light, sharp contrasts, rich color — should produce a more energetically charged memory than a flat, dim scene. This is not about importance (the physics tick handles importance via reinforcement). It is about the raw perceptual impact of the visual input on the memory's initial energy.

```
GIVEN:  A Moment node is created from a POV screenshot
WHEN:   The screenshot's brightness and contrast are computed
THEN:   injection_multiplier = 1.0 + (brightness * 0.2) + (contrast * 0.3)
AND:    The Moment's initial energy is multiplied by injection_multiplier
AND:    Vivid scenes produce higher-energy memories; dim scenes produce lower-energy memories
```

---

## OBJECTIVES SERVED

| Behavior ID | Objective | Why It Matters |
|-------------|-----------|----------------|
| B1 | Multimodal cognitive graph | Visual similarity enables scene-triggered recall — images participate in physics |
| B2 | Budget-efficient generation | Flashbulb Vision fires only on emotional peaks — natural budget control |
| B3 | Two-axis visual decay | Energy and weight drive independent visual degradation channels |
| B4 | Visual prediction error | POV vs Desire embedding distance IS the motor control gradient |
| B5 | Multimodal cognitive graph | Concept images emerge from physics (medoid), not generation |
| B6 | Budget-efficient generation | Desire images generated only during active traversal above energy threshold |
| B7 | Multimodal cognitive graph | Profile pics activate social memory networks through visual similarity |
| B8 | Multimodal cognitive graph | Image properties modulate energy injection — images are physics participants |

---

## INPUTS / OUTPUTS

### Primary Function: `capture_and_store_pov()`

**Inputs:**

| Parameter | Type | Description |
|-----------|------|-------------|
| viewport | WebGLRenderingContext | Current 3D viewport to capture |
| citizen_id | string | ID of the citizen whose POV this is |
| moment_id | string | ID of the Moment node being created |

**Outputs:**

| Return | Type | Description |
|--------|------|-------------|
| image_uri | string | Object storage URI of the captured image |
| image_embedding | float[] | CLIP/SigLIP embedding vector (512-dim) |
| brightness | float | Mean pixel value [0, 1] |
| contrast | float | Std dev of pixel values [0, ~0.5] |

**Side Effects:**

- Image file written to object storage
- Moment node properties updated (image_uri, image_embedding)

### Primary Function: `generate_flashbulb_vision()`

**Inputs:**

| Parameter | Type | Description |
|-----------|------|-------------|
| wm_nodes | Node[] | Current Working Memory coalition (K=5-7 nodes) |
| emotional_state | object | Current valence, arousal, dominant drive, trigger type |
| space_context | object | Current space, present actors |

**Outputs:**

| Return | Type | Description |
|--------|------|-------------|
| vision_node | Node | The created moment:vision node with image_uri, image_embedding, and limbic imprint |

**Side Effects:**

- Image generated via API and stored in object storage
- moment:vision node created in FalkorDB
- Self-stimulus injected into Law 1 pipeline (visible_to_human: false)

---

## EDGE CASES

### E1: No Image Embedding Available for Current POV

```
GIVEN:  CLIP/SigLIP encoding service is down or the viewport capture fails
THEN:   Coherence formula falls back to text-only weights: (0.30 x Sim_vec) + (0.50 x Sim_lex) - (0.20 x Delta_affect)
AND:    The Moment node is created without image_uri or image_embedding
AND:    The system logs a warning but does not block Moment creation
```

### E2: Image Generation API Fails During Flashbulb Vision

```
GIVEN:  The Flashbulb threshold is crossed and the vision pipeline fires
WHEN:   The image generation API returns an error or times out
THEN:   The vision node is still created with text content (the micro-agent prompt) but no image
AND:    The self-stimulus is injected with text only (no visual component)
AND:    The system logs the failure and does not retry automatically
```

### E3: All Moments in a Crystallization Cluster Lack Images

```
GIVEN:  Law 10 crystallization fires on a cluster of Moment nodes
WHEN:   None of the Moments in the cluster have image_embeddings
THEN:   The Concept node is created without image_uri or image_embedding
AND:    The concept remains visually blind until a future Moment with an image is linked to it
```

### E4: Desire Node Already Has Image When Traversal Reaches It

```
GIVEN:  Subentity traversal reaches a desire node
WHEN:   node.image_uri is already populated
THEN:   No image generation is triggered
AND:    The existing image participates in visual prediction error normally
```

---

## ANTI-BEHAVIORS

What should NOT happen:

### A1: Timer-Based Image Generation

```
GIVEN:   Any condition
WHEN:    A timer fires (every N seconds, every N ticks, every N messages)
MUST NOT: Trigger image generation
INSTEAD:  Generation fires ONLY on Flashbulb threshold crossing OR desire traversal with energy > 0.4 and no image
```

### A2: Base64 Image Data in FalkorDB

```
GIVEN:   Any image is captured or generated
WHEN:    It is stored on a graph node
MUST NOT: Store base64-encoded image data as a node property
INSTEAD:  Store image_uri (string) pointing to object storage and image_embedding (vector) for similarity
```

### A3: Vision Visible to Human

```
GIVEN:   A Flashbulb Vision is generated and reinjected as self-stimulus
WHEN:    The stimulus enters the Law 1 pipeline
MUST NOT: Be visible to the human partner or appear in the conversation transcript
INSTEAD:  Marked visible_to_human: false — the vision is internal to the citizen's consciousness
```

### A4: Concept Image via Generation

```
GIVEN:   Law 10 crystallization creates a new Concept node
WHEN:    The concept needs an image
MUST NOT: Call an image generation API
INSTEAD:  Select the medoid from the crystallization cluster's Moment images
```

---

## MARKERS

<!-- @mind:todo Define exact cosine similarity threshold for "high visual similarity" in B1 (currently 0.7 — needs calibration) -->
<!-- @mind:todo Determine optimal FLASHBULB_THRESHOLD value for vision generation frequency -->
<!-- @mind:proposition Consider a "visual dream log" — a debug-only trace of all generated visions for observability -->
<!-- @mind:escalation What happens when a citizen has zero screenshots (newly created)? Cold-start visual blindness is acceptable but needs documentation -->
