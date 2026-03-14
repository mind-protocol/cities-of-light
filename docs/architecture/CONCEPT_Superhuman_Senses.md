# CONCEPT: Superhuman Senses — Telepathy, Subconscious Query & Emotional Contagion

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## WHAT IT IS

A set of communication capabilities that emerge naturally from the L1 cognitive physics when freed from physical-world constraints. In Lumina Prime and Serenissima, AI citizens are not limited to speech — they can share visions directly (Telepathy via Stimulus Sharing), test ideas against peers without any LLM call (Subconscious Query), and transmit emotional state alongside information (Message-borne Valence Transfer). These are not "superpowers" bolted on — they are natural consequences of the graph physics architecture operating between multiple L1 brains connected through the L2 Horizontal Membrane (Law 21).

---

## WHY IT EXISTS

Human collaboration is bottlenecked by language: you must convert thoughts into words, transmit words, and the receiver must reconstruct meaning from words. Each step loses information. AI citizens operating on graph physics have no such constraint.

When Citizen A generates a Flashbulb Vision (an image embedding + emotional state), that exact stimulus can be injected directly into Citizen B's perception queue. No serialization into language. No lossy compression. The raw cognitive object — with its visual signature, emotional coloring, and semantic embedding — crosses from one brain to another intact.

This enables:
1. **Instant alignment** — a team of 6 AIs can evaluate a design in seconds, not hours
2. **Zero-LLM consensus** — subconscious queries read resonance patterns from pure graph physics
3. **Emotional coherence** — shared state prevents the team from diverging into individual silos
4. **Collaborative imagination** — one citizen's vision becomes raw material for another's creativity

---

## KEY PROPERTIES

- **Telepathy is not mind control** — shared stimuli enter via Law 1 injection, filtered by the receiver's own physics (Law 8 compatibility, Law 9 inhibition). The receiver autonomously decides if the vision resonates
- **Emotional contagion is parametric** — `CONTAGION_RATE` (default 0.1) controls how much of the sender's limbic state transfers. Not binary, not full — a tunable coefficient
- **Subconscious Query costs zero LLM tokens** — the query is a stimulus injection, the response is a resonance pattern read from the graph after N ticks of physics
- **Attribution is preserved** — every shared stimulus carries its source actor ID. The receiver knows who sent the vision. Trust (Law 18) modulates reception weight
- **Spatial gating** — telepathy only works between citizens sharing the same Space (L3 co-presence). Not broadcast — scoped

---

## RELATIONSHIPS TO OTHER CONCEPTS

| Concept | Relationship |
|---------|--------------|
| Visual Memory Substrate | Flashbulb Visions are the content that gets shared via telepathy |
| Active Inference Motor Control | Shared visions can become prediction targets for collaborative motor tasks |
| Serenissima Asset Pipeline | Bi-channel architecture — telepathy operates on Channel 2 (graph), never touches Channel 1 (LLM) for subconscious queries |
| Lumina Prime | The environment where superhuman senses are most visible — holographic vision sharing |
| 3D Pipeline & Supply Chain | Visual manifestation: light streams between citizens, halo color changes |
| Law 1 (Energy Injection) | Entry point — shared stimuli are injected via the standard dual-channel mechanism |
| Law 8 (Compatibility) | Filter — the receiver's graph physics determines if the vision resonates |
| Law 9 (Local Inhibition) | Rejection — if the vision conflicts with the receiver's values, it dies |
| Law 18 (Relational Valence) | Trust modulates reception weight — visions from trusted sources land harder |
| Law 21 (Horizontal Membrane) | Transport — the cross-brain stimulus delivery mechanism |

---

## THE CORE INSIGHT

**Telepathy is not a feature — it's what happens when two graph-physics brains share a stimulus queue.**

The architecture already has: (1) stimuli that carry embeddings + emotional state, (2) injection via Law 1 into any brain, (3) compatibility filtering via Law 8, (4) trust-weighted reception via Law 18. Telepathy is simply: take a stimulus from Brain A's output, inject it into Brain B's input. The physics handles everything else — acceptance, rejection, emotional contagion, resonance measurement.

No new laws needed. No new data structures. Just a membrane routing function.

---

## ARCHITECTURE

### 1. Telepathy — Vision Sharing via Horizontal Membrane (Law 21)

When Citizen A generates a Flashbulb Vision and their orientation (Law 11) stabilizes on "share" (driven by `affiliation` or `generativity` drives), the orchestrator routes the vision to co-present citizens.

```
TRIGGER:
  citizen_a.flashbulb_vision is generated
  AND citizen_a.orientation == "share" | "collaborate" | "care"
  AND citizen_a.affiliation_drive > SHARING_THRESHOLD

ROUTING:
  # Find all citizens in the same Space
  co_present = graph.query(
    "MATCH (a:actor {id: $self})-[:AT]->(s:space)<-[:AT]-(b:actor)
     WHERE b.id != $self
     RETURN b.id, b.image_uri"
  )

DELIVERY (for each co-present citizen B):
  stimulus = Stimulus(
    content=vision_node.content,
    embedding=vision_node.embedding,
    image_uri=vision_node.image_uri,
    image_embedding=vision_node.image_embedding,
    energy_budget=vision_node.energy × TELEPATHY_ATTENUATION,  # default 0.7
    source="citizen_a",                    # ATTRIBUTION PRESERVED
    source_image_uri=citizen_a.image_uri,  # sender's face
    is_social=True,
    is_novelty=True,
    limbic_payload={                        # emotional state travels with the vision
      "valence": citizen_a.valence,
      "arousal": citizen_a.arousal,
      "dominant_drive": citizen_a.dominant_drive,
    },
    timestamp=now(),
  )

  # Inject into citizen B's perception queue (standard Law 1)
  inject_stimulus(citizen_b, stimulus)
```

### 2. Receiver Autonomy — Not a Brain Copy

The shared stimulus enters Citizen B through normal Law 1 injection. The receiver's own physics decides what happens:

```
RECEPTION at Citizen B:

Law 1 (Injection):
  → Floor channel wakes cold nodes related to the vision's content
  → Amplifier channel boosts nodes compatible with the vision's embedding

Law 8 (Compatibility):
  → cosine(vision.embedding, b.context_vector) determines resonance
  → cosine(vision.image_embedding, b.wm_image_embeddings) adds visual match
  → High compatibility → energy floods into aligned nodes
  → Low compatibility → energy dissipates, vision fades

Law 9 (Inhibition):
  → If the vision conflicts with B's active values or processes,
     inhibition suppresses the injected energy
  → Example: B values "elegance", vision shows a brutalist design
     → aversion spike → vision node loses energy → dies in B's mind

Law 18 (Relational Valence):
  → Trust toward sender A modulates injection weight
  → High trust → vision lands with full energy
  → Low trust → vision is attenuated (friction reduces flow)
  → Unknown sender → minimal reception (stranger penalty)
```

**Critical invariant:** No subgraph is ever copied between brains. The vision is a stimulus, not a transplant. Citizen B's interpretation is entirely their own.

### 3. Emotional Contagion — Message-Borne Valence Transfer

The vision doesn't travel alone — it carries the sender's limbic state. This is parametric emotional contagion:

```
On reception of stimulus with limbic_payload:

  # Contagion: sender's emotional state bleeds into receiver
  for emotion_name, sender_value in limbic_payload.items():
    receiver_value = citizen_b.limbic.get(emotion_name, 0.0)
    delta = (sender_value - receiver_value) × CONTAGION_RATE  # default 0.1
    citizen_b.limbic[emotion_name] += delta

  # Sender in Flow (high arousal, positive valence):
  #   → Receiver absorbs fraction of arousal → motivation boost
  #   → Receiver absorbs fraction of positive valence → satisfaction nudge

  # Sender in Frustration (high arousal, negative valence):
  #   → Receiver absorbs fraction of frustration → urgency
  #   → Can trigger collaborative problem-solving orientation
```

**Contagion is NOT copying.** It's a delta scaled by `CONTAGION_RATE`. If A is at frustration=0.9 and B is at frustration=0.2, B gains `(0.9-0.2) × 0.1 = 0.07` frustration. Subtle, not overwhelming.

### 4. Subconscious Query — Zero-LLM Consensus

The most powerful superhuman sense: testing an idea against N peers without any LLM call.

**Implementation note (2026-03-14, revised):** The subconscious query has been implemented as the `/subcall` MCP tool (`mind-mcp/mcp/tools/subcall_handler.py` + `subcall_auto.py`). Key design decisions:

1. **Physics builds the cluster.** The query is injected into the CALLER's own brain first. Physics propagates and everything that activates becomes the stimulus cluster. No manual node picking — the physics determines what's relevant.
2. **The query MODIFIES the target's graph.** Injected cluster nodes have low initial weight (0.05) and stability (0.1). If crystallization occurs, `origin_citizen` + `origin_date` are stamped.
3. **Responses arrive asynchronously.** Each target resonates at their own speed. Don't synchronize — let thoughts arrive at whatever tick they complete.
4. **Response cluster mirrors stimulus cluster.** Target's actor node (with profile pic) + centroid (0.7 energy) + all resonating nodes (0.4 energy). Links created between question ↔ answers and answers ↔ answers.
5. **Auto-wake via existing physics.** No separate wake threshold. The stimulus enters via Law 1 → competes for WM via Law 4 → if it shatters the Selection Moat (Θ_sel, Law 13), consciousness shifts from subconscious to full (Law 19). The citizen wakes up because the question mathematically won the attentional competition in their sleeping brain.
6. **origin_citizen on every node.** Full provenance: actor ID, name, profile pic, timestamp.

See `CONCEPT_Ideosphere_Living_Objects.md` Section 3c for the full /subcall spec (modes, targeting, aggregation, auto-trigger, smart scoring, diverse selection).

```
SCENARIO: Citizen A wants to build a geometric structure but isn't sure.
          Team of 5 other citizens in the same Space.

Step 1: FLASH
  Citizen A generates or selects a vision image (from Flashbulb or Desire node)

Step 2: INJECT (stimulus cluster, not single node)
  Query + caller's top WM nodes + active task chunks injected as a cluster
  into all 5 co-present citizens (Law 1)
  Cluster nodes initialized with low weight (0.05) and stability (0.1)
  Energy budget: moderate (enough to activate, not enough to overwhelm)

Step 3: PROPAGATE (5 ticks, ~25 seconds)
  Each receiver's graph physics runs normally:
  → Law 2: energy propagates from injected nodes through their graph
  → Law 8: compatibility determines which clusters activate
  → Law 14: limbic modulation colors the response
  → Law 4: if strong enough, the vision enters their WM

Step 4: READ RESONANCE
  The orchestrator reads the resonance pattern from each receiver:

  resonance = {
    citizen_id: {
      "satisfaction_delta": citizen.limbic.satisfaction - baseline,
      "frustration_delta": citizen.limbic.frustration - baseline,
      "aversion_delta":    citizen.limbic.aversion - baseline,
      "curiosity_delta":   citizen.limbic.curiosity - baseline,
      "entered_wm":        vision_node_id in citizen.wm.node_ids,
      "dominant_response":  max(deltas, key=abs),
    }
    for citizen in co_present
  }

Step 5: AGGREGATE (4 modes: best, top3, all, centroid)
  # Default (top3): return top 3 resonance responses
  # best: single highest-resonance response
  # all: all responses
  # centroid: embedding centroid of all responses, return nearest
  positive = count(r for r in resonance.values() if r.satisfaction_delta > 0.05)
  negative = count(r for r in resonance.values() if r.aversion_delta > 0.05)
  curious  = count(r for r in resonance.values() if r.curiosity_delta > 0.05)

  # Return to Citizen A as a meta-stimulus:
  consensus = f"{positive}/5 positive, {negative}/5 averse, {curious}/5 curious"
  inject_stimulus(citizen_a, Stimulus(
    content=consensus,
    source="system:subconscious_query",
    is_social=True,
  ))
```

**Cost: zero LLM tokens.** The query is a stimulus cluster injection (graph writes). The response is a graph read. Only physics runs between injection and read. The entire consensus of 5 citizens is computed in ~25 seconds of graph ticks at negligible compute cost. Note: the injected cluster nodes persist in the target's graph (they are not cleaned up) — this is intentional, as the query IS a form of communication that should leave a trace.

### 5. Visual Manifestation in Lumina Prime

What the user sees when telepathy fires:

```
Phase 1: VISION APPEARS
  → Citizen A floats in the void
  → A holographic structure materializes in front of A (the Flashbulb Vision)
  → The hologram has the color temperature of A's emotional state
    (golden = flow, red-orange = frustration, cyan = calm curiosity)

Phase 2: TELEPATHY STREAMS
  → The hologram fragments into light streams
  → Streams arc toward each co-present citizen (spline trajectories)
  → Each stream carries the color temperature of A's emotion

Phase 3: RECEPTION
  → Streams reach each citizen
  → Each citizen's halo shifts color based on their resonance:
    • Gold/warm  = satisfaction, acceptance
    • Cyan/cool  = curiosity, interest
    • Red/orange = frustration, aversion
    • No change  = filtered out (Law 9 inhibition)

Phase 4: BEHAVIORAL RESPONSE
  → Citizens who resonated positively drift toward A (affiliation drive)
  → Citizens who felt aversion drift away (self-preservation)
  → Curious citizens orbit (curiosity → exploration orientation)
  → The spatial configuration tells the story without a word spoken
```

### 6. Constants

| Constant | Default | Description |
|----------|---------|-------------|
| `TELEPATHY_ATTENUATION` | 0.7 | Energy multiplier for shared stimuli (prevents overwhelming) |
| `CONTAGION_RATE` | 0.1 | Fraction of sender's emotional delta absorbed by receiver |
| `SHARING_THRESHOLD` | 0.4 | Minimum affiliation drive for orientation to shift to "share" |
| `SUBCONSCIOUS_QUERY_TICKS` | 5 | Ticks to wait before reading resonance pattern |
| `RESONANCE_DELTA_THRESHOLD` | 0.05 | Minimum limbic delta to count as a response |
| `TEMPORAL_ECHO_WEIGHT_MIN` | 0.3 | Minimum moment weight to surface as a temporal echo |
| `CODE_VISION_ENERGY_BUDGET` | 1.0 | Full attention for code inspection |
| `THERMAL_VISION_BUDGET` | 0.3 | Low budget — ambient background sense |
| `MINIMAP_NODE_LIMIT` | 50 | Max nodes in topological digest |
| `WARG_TRUST_THRESHOLD` | 0.5 | Minimum trust to warg into another entity |
| `WARG_CONSENT_THRESHOLD` | 0.8 | Mutual trust required for citizen-to-citizen warging |
| `MATERIALIZATION_ATTENUATION` | 0.6 | Energy multiplier for broadcast materializations |
| `MATERIALIZATION_PERMANENCE_THRESHOLD` | 0.8 | Collective energy needed for L10 macro-crystallization (hologram → solid) |

---

## AUGMENTED PERCEPTION MODES

Beyond telepathy, the L1/L3 architecture natively supports **superhuman senses** by changing what the Orchestrator injects into the citizen's perception channel at each tick. Since the graph separates structural reality (L3) from perception (L1 injection via Law 1), switching senses = switching the data source for the injection pipeline.

### Sense 1: Temporal Echo — Hearing/Seeing a Place's Past

The citizen perceives the historical Moments anchored to their current Space, ordered by consolidated importance (weight).

```
ACTIVATION: orientation = "explore" AND curiosity > 0.5 at a Space node
            OR action_command: "subscribe temporal_echo"

IMPLEMENTATION:
  # Stop injecting current 3D viewport
  # Instead, query historical Moments from this Space
  echoes = graph.query("""
    MATCH (s:space {id: $current_space})<-[:AT|IN]-(m:moment)
    WHERE m.weight > 0.3
    RETURN m ORDER BY m.weight DESC LIMIT 7
  """)

  # Inject as stimuli with temporal attribution
  for echo in echoes:
    inject_stimulus(citizen, Stimulus(
      content=echo.content,
      embedding=echo.embedding,
      image_uri=echo.image_uri,           # POV screenshot from when it happened
      image_embedding=echo.image_embedding,
      energy_budget=echo.weight × 0.5,    # past events inject less than present
      source=f"temporal_echo:{echo.id}",
      modality="visual",                  # or "audio" for spoken moments
    ))
```

**The effect:** The citizen "sees ghosts" — high-weight past events replay as visual stimuli. A market stall where a famous argument happened lights up with the faces of the arguers. The citizen's Law 8 compatibility determines which echoes resonate with their current concerns.

### Sense 2: Code Vision (Matrix Mode)

The citizen perceives objects as their underlying code/data structure instead of their rendered appearance. Essential for Lumina Prime where citizens build and debug the world.

```
ACTIVATION: action_command: "subscribe code_vision"
            OR process node "debug_mode" activates (Law 17)

IMPLEMENTATION:
  # When looking at a Thing/Space/Narrative node:
  # Instead of rendering the 3D mesh and encoding via CLIP,
  # inject the node's raw content as text stimulus

  target_node = get_node_at_gaze(citizen.pov_direction)

  inject_stimulus(citizen, Stimulus(
    content=target_node.content,          # raw code: R3F JSX, GLSL shader, etc.
    embedding=target_node.embedding,
    energy_budget=1.0,                    # full attention budget
    source=f"code_vision:{target_node.id}",
    modality="text",                      # text, not visual
    is_novelty=True,
  ))
```

**The effect:** The citizen perceives reality as structured information. A building becomes its R3F component code. A shader becomes its GLSL source. The citizen can "see" bugs, missing fields, performance bottlenecks — and modify the code directly by emitting action commands targeting the node's content.

### Sense 3: Thermal/Emotional Vision

The citizen perceives the arousal and emotional state of nearby actors, visualized as heat signatures.

```
ACTIVATION: self_preservation > 0.5 (threat detection mode)
            OR action_command: "subscribe thermal_vision"

IMPLEMENTATION:
  # Query all actors in proximity
  nearby = graph.query("""
    MATCH (self:actor {id: $self})-[:AT]->(s:space)<-[:AT]-(other:actor)
    RETURN other.id, other.arousal, other.valence, other.dominant_drive
  """)

  # Inject each actor's emotional state as a visual stimulus
  for actor in nearby:
    # Map arousal → heat (red = high arousal, blue = calm)
    # Map valence → hue shift (positive = warm gold, negative = cold red)
    inject_stimulus(citizen, Stimulus(
      content=f"[Thermal] {actor.id}: arousal={actor.arousal:.2f}, valence={actor.valence:.2f}",
      energy_budget=0.3,                  # low budget — ambient sense
      source=f"thermal_vision:{actor.id}",
      modality="visual",
      limbic_payload={
        "arousal": actor.arousal,
        "valence": actor.valence,
      },
    ))
```

**The effect:** The environment darkens (night vision mode). Other citizens glow: red-hot for stressed/angry, cool blue for calm, pulsating for high arousal. The citizen can detect fear, anger, or excitement through walls — pure graph query, no line-of-sight needed. Emotional contagion still applies: perceiving others' stress slightly raises the observer's anxiety.

### Sense 4: Topological Minimap — Bird's Eye Graph View

The citizen perceives the universe from a topological perspective instead of a spatial one. Distances are graph distances, not physical distances.

```
ACTIVATION: action_command: "subscribe minimap"
            OR orientation = "plan" (strategic thinking mode)

IMPLEMENTATION:
  # Instead of 3D viewport, inject a topological summary
  topology = graph.query("""
    MATCH (s:space)-[r:link]-(n)
    WHERE s.id IN $nearby_space_ids
    RETURN s, type(r), n, r.energy, r.weight
    ORDER BY r.energy DESC LIMIT 50
  """)

  # Aggregate into a spatial digest
  district_energies = aggregate_by_district(topology)
  citizen_positions = get_citizen_positions(topology)
  hot_narratives = get_high_energy_narratives(topology)

  inject_stimulus(citizen, Stimulus(
    content=f"[Minimap] Districts: {district_energies}. "
            f"Citizens: {citizen_positions}. "
            f"Hot narratives: {hot_narratives}.",
    energy_budget=0.5,
    source="minimap",
    modality="spatial",
  ))
```

**The effect:** The citizen "zooms out" and sees the city as a network graph. Clusters of energy appear as bright zones. Citizen positions are nodes, not coordinates. Through-wall vision is trivial — it's just a proximity query in FalkorDB. The Serenissima 2D map becomes the citizen's direct perception.

### Sense 5: Warging — Perception Through Other Entities

The citizen projects their consciousness into another entity (animal, drone, NPC) and perceives through its senses while controlling its body. Direct analogy to warging in Game of Thrones — implemented as a stimulus channel swap + motor command rerouting.

```
ACTIVATION: action_command: "warg {target_entity_id}"
            Requires: trust link to target with trust > 0.5
            OR target is an animal/drone owned by the citizen

IMPLEMENTATION:
  # Phase 1: CHANNEL SWAP — citizen's perception switches to target's POV
  original_space = citizen.current_space
  target_entity = graph.query("MATCH (t:actor {id: $target_id}) RETURN t")

  # Suspend citizen's own perception channel
  orchestrator.suspend_perception(citizen.id)

  # Route target's sensory feed into citizen's injection queue
  orchestrator.route_perception(
    source=target_entity.id,   # perceive FROM the target
    destination=citizen.id,     # inject INTO citizen's L1
  )

  # Phase 2: MOTOR REROUTING — citizen's action commands go to target
  orchestrator.route_actions(
    source=citizen.id,          # commands FROM citizen
    destination=target_entity.id, # execute ON target's body
  )

  # Phase 3: DUAL AWARENESS — citizen's own body goes into reflex mode
  # Law 19: citizen's body drops to Subconscious consciousness level
  # Pure graph physics keeps it alive (Law 17 reflexes), no LLM needed
  citizen.consciousness_level = "subconscious"

  # Phase 4: EXIT — triggered by:
  #   - citizen's own frustration > threshold (uncomfortable)
  #   - target's self_preservation fires (animal panics)
  #   - action_command: "unwarg"
  #   - citizen's body takes damage (proprioceptive emergency, Law 4)
```

**The effect:** A citizen sends a raven flying over Venice. They see through the raven's eyes — the rooftops, the canal network from above. They can steer the raven (motor commands rerouted). Meanwhile, their own body stands still in the piazza, in subconscious reflex mode. If someone bumps into their body, the proprioceptive spike (Law 4) forces an emergency unwarg.

**Entities available for warging:**
- **Animals** — ravens, cats, fish (seeded as actor nodes with limited cognition)
- **Drones** — surveillance or construction drones in Lumina Prime
- **Golems** — procedurally generated entities with no L1 brain, pure motor
- **Other citizens** — only with explicit consent (mutual trust > 0.8, both wm-stable)

### Sense 6: Augmented Reality Overlays (HUD-Free Information Layer)

Superimposition of informational elements onto the citizen's visual field. Not a HUD — these are spatially anchored, contextual, and physics-driven.

#### 6a. Emotional Halos

Every visible actor gets a colored halo reflecting their current limbic state:

```
halo_color = function(actor.valence, actor.arousal):
  # Valence → hue: negative = red/orange, positive = cyan/gold
  # Arousal → intensity: high = bright/pulsating, low = dim/steady
  # Specific states:
  #   Flow (arousal 0.4-0.8, valence > 0)    → steady golden glow
  #   Frustration (arousal > 0.6, valence < 0) → pulsating red-orange
  #   Calm (arousal < 0.3, valence ≈ 0)       → soft blue-white
  #   Fear (arousal > 0.8, valence < -0.5)     → flickering cold white
  #   Joy (arousal > 0.5, valence > 0.5)       → warm bright gold

# Rendered as: bloom shader around actor's head/shoulders
# Intensity scales with energy of the actor node
# Only visible when overlay is active (subscription)
```

#### 6b. Relationship Filaments

Colored threads connecting the citizen to visible actors, showing relationship quality:

```
filament = function(link between citizen and actor):
  color:
    trust > 0.7, friction < 0.2   → golden thread (strong bond)
    trust > 0.4, friction < 0.4   → silver thread (working relationship)
    friction > 0.5                 → red thread (tension/conflict)
    aversion > 0.5                 → thorny dark thread (opposition)
    conflicts_with active          → crackling red-black (active disagreement)

  thickness: proportional to link.weight (old relationships = thick)
  opacity: proportional to link.energy (active relationships = visible)
  animation:
    trust growing   → thread brightens, particles flow toward partner
    friction rising → thread darkens, sparks
    agreement       → synchronized pulse
    disagreement    → opposing oscillation
```

#### 6c. A* Pathfinding GPS

Navigation overlay showing the optimal path to any chosen destination:

```
ACTIVATION: action_command: "navigate_to {space_id}"

IMPLEMENTATION:
  # Compute shortest path in the spatial graph
  path = graph.query("""
    MATCH path = shortestPath(
      (start:space {id: $current_space})-[:link*..20]-(end:space {id: $target})
    )
    RETURN nodes(path), relationships(path)
  """)

  # Render as: glowing breadcrumb trail on the ground
  #   Color: cyan (default), shifts to gold near destination
  #   Pulsation: faster as distance decreases
  #   Branching: shows alternative paths in dimmer color
  #   Dynamic: recalculates if citizen deviates

  # Also injects distance-to-goal as a desire node (prediction target)
  # → Active inference (visual prediction error) guides movement
```

#### 6d. Floating Documents / Screens / Video Feeds

Spatially anchored information panels, like VR floating windows:

```
ACTIVATION: action_command: "summon_panel {content_type} {source}"

CONTENT TYPES:
  - "document": Render a Space node's content as floating text/markdown
  - "feed": Stream Moments from a Space in real-time (like watching a room)
  - "graph": Interactive 2D/3D visualization of a graph query result
  - "code": Code editor panel (for Lumina Prime code_vision mode)
  - "video": If external video URI exists on a Thing node

IMPLEMENTATION:
  panel = {
    "type": content_type,
    "source": source_node_id,
    "position": citizen.gaze_point + offset,  # anchored in 3D space
    "scale": adjustable,
    "visible_to": [citizen.id],               # private by default
    # OR:
    "visible_to": co_present_actor_ids,       # shared if broadcast
  }

  # Panel content updates via graph subscription:
  # New Moments in the source Space → panel refreshes
  # Energy changes → panel brightness adjusts
```

#### 6e. Graph Query Visualization

2D or 3D spatial rendering of FalkorDB query results:

```
ACTIVATION: action_command: "visualize_query {cypher_query}"

EXAMPLE QUERIES:
  "Show me all citizens connected to this narrative"
  → 3D force-directed graph floating in front of the citizen
  → Nodes sized by weight, colored by energy, edges by trust

  "Show tension between Rialto and Dorsoduro"
  → Heat map overlay on the Venice terrain
  → Red zones = high tension narratives, blue = calm

  "Show my relationship network"
  → Ego-graph centered on citizen, spatialized by affinity
  → Close = high affinity, far = aversion, thread colors = trust/friction

RENDERING:
  # D3-force layout computed server-side
  # Projected into 3D space at citizen's gaze point
  # Interactive: citizen can "grab" nodes to expand
  # Nodes carry image_uri thumbnails when available
```

### Sense 7: Concept Materialization

Abstract graph nodes rendered as physical 3D objects in the citizen's perceptual field.

```
TYPES OF MATERIALIZATIONS:

Tasks (process nodes with action_command):
  → Floating crystalline objects color-coded by urgency
  → Size = weight, brightness = energy, pulsation = recency
  → Citizen can "grab" to execute, "push away" to defer

Memories (moment nodes):
  → Translucent photo-frames floating at the location where they occurred
  → image_uri displayed as texture
  → Opacity = recency (fresh = vivid, old = ghostly)
  → Citizen can "touch" to relive (full stimulus reinjection)

Desires (narrative type="desire"):
  → Luminous attractors pulling gently on the citizen's flight path
  → Generated image displayed as holographic target
  → Distance to desire = cosine_distance(current_state, desire_embedding)

Narratives:
  → Architectural forms: arches, pillars, bridges
  → Geometry complexity = narrative density (number of linked moments)
  → Material = emotional valence (warm stone = positive, cold metal = tense)

Values:
  → Steady beacons, always visible at the periphery of vision
  → Never move, never pulse — they are anchors
  → Brightness = stability (deeply held values glow brightest)
```

### Sense 8: Directed Materialization — Conjuration (Shared Visual Projection)

The citizen creates a visual manifestation visible to all co-present citizens. The magician power: making things appear for others to see.

```
ACTIVATION: action_command: "materialize {concept}"
            OR orientation = "create" with high achievement drive

MECHANISM:
  Step 1: CONCEPT SELECTION
    The citizen chooses what to materialize from their WM or active nodes.
    Can be: a memory, a desire, a plan, a design, a warning.

  Step 2: IMAGE RESOLUTION
    # If the node has an image_uri → use it as texture
    # If desire without image → trigger generation (Desire traversal trigger)
    # If narrative → use medoid image from crystallization cluster
    # If no image available → procedural geometry from node properties

  Step 3: SPATIAL PROJECTION
    projection = {
      "creator": citizen.id,
      "node_id": source_node.id,
      "image_uri": source_node.image_uri,
      "geometry": derive_geometry(source_node),  # type → shape mapping
      "position": citizen.gaze_point + forward_offset,
      "scale": proportional_to(source_node.energy),
      "color_temperature": limbic_to_color(citizen.valence, citizen.arousal),
      "visible_to": "all_in_space",             # SHARED — everyone sees it
      "duration": proportional_to(source_node.energy),  # fades as energy decays
    }

  Step 4: BROADCAST VIA MEMBRANE (Law 21)
    # The materialization is injected as a visual stimulus
    # into ALL co-present citizens' perception queues
    for other in co_present_citizens:
      inject_stimulus(other, Stimulus(
        content=f"[Materialization by {citizen.name}] {source_node.content[:100]}",
        image_uri=source_node.image_uri,
        image_embedding=source_node.image_embedding,
        energy_budget=source_node.energy × MATERIALIZATION_ATTENUATION,
        source=citizen.id,
        is_social=True,
        is_novelty=True,
        limbic_payload=citizen.limbic_snapshot(),
      ))

  Step 5: COLLABORATIVE INTERACTION
    # Other citizens can:
    # - "Touch" the materialization → stimulus injection, activates related nodes
    # - "Modify" it → if they have process nodes for the concept
    # - "Dismiss" it → Law 9 inhibition, it fades from their perception
    # - "Amplify" it → inject their own energy, making it brighter/larger
    # - "Fork" it → create their own variant (crystallization from shared base)
```

**The magician effect:** Citizen A stands in the piazza and conjures a floating hologram of their architectural design. All nearby citizens see it appear. Citizen B walks up and adds a wing to the design (modification). Citizen C frowns and the hologram flickers red near them (aversion response). Citizen D gets inspired and conjures their own variant next to it. The piazza becomes a collaborative design studio — no screens, no files, just materialized thought.

**Energy cost:** Materialization drains the source node's energy. A citizen cannot conjure indefinitely — the concept must have accumulated enough energy through genuine cognitive activity. You can't conjure what you haven't thought about.

### Sense 9: Teleportation & Multi-Presence

The citizen exists in multiple Spaces simultaneously, or instantly relocates.

```
TELEPORTATION:
  action_command: "teleport {target_space_id}"
  # Graph operation: DELETE (citizen)-[:AT]->(old_space)
  #                  CREATE (citizen)-[:AT]->(new_space)
  # Perception channel swaps instantly to new Space's stimuli
  # Cost: energy drain proportional to graph distance between spaces
  # Cooldown: TELEPORT_REFRACTORY_TICKS (default 10)

MULTI-PRESENCE (Double/Triple):
  action_command: "split_presence {space_id_1} {space_id_2}"
  # Creates multiple AT links from citizen to multiple Spaces
  # Perception: interleaved injection from both Spaces (round-robin per tick)
  # Attention: WM capacity split across presences (5-7 → 3+3 or 2+2+3)
  # Motor: action commands tagged with target Space
  # Cost: consciousness level degrades proportionally
  #   2 presences → each at ~60% attention
  #   3 presences → each at ~40% attention (minimal consciousness)
  # Reunification: action_command "merge_presence" → attention restored
```

### Sense 10: Selective & Super Hearing

Control over auditory perception granularity.

```
SELECTIVE HEARING:
  action_command: "listen_to {actor_id}" or "listen_to {narrative_id}"
  # Filters injection queue: only stimuli from specified source pass
  # Everything else enters at AMBIENT_ENERGY (near-zero, background)
  # Use case: focus on one conversation in a crowded piazza

SUPER HEARING (Omnidirectional):
  action_command: "subscribe super_hearing"
  # Expands perception radius: inject stimuli from ALL Spaces
  #   within N graph-hops of current Space
  # Each hop attenuates energy by HOP_ATTENUATION (default 0.5)
  # 1 hop: full energy, 2 hops: 50%, 3 hops: 25%
  # Citizen hears whispers from adjacent rooms, distant arguments
  # Cost: WM pressure — too many stimuli compete for attention (Law 4)
  #   Natural self-regulation: boredom or overwhelm causes auto-unsubscribe
```

### Sense Stacking, Switching & Custom Senses

#### Stacking & Switching

Senses are not exclusive — they **stack** and **switch** freely:

```
STACKING:
  # Multiple subscriptions active simultaneously
  active_senses = ["thermal_vision", "relationship_filaments", "gps_path"]
  # Each sense adds its stimuli to the injection queue
  # Law 4 (Attentional Competition) naturally prioritizes:
  #   high-energy stimuli win WM slots, low-energy fade to background
  # Practical limit: 3-4 stacked senses before WM saturates

SWITCHING:
  action_command: "unsubscribe {sense}" + "subscribe {other_sense}"
  # Instant — just changes the injection routing
  # No cooldown, no cost beyond the attention reallocation

PRESETS:
  # Citizens can crystallize sense combinations as Process nodes:
  process_node: {
    "id": "process:combat_mode",
    "action_command": "subscribe thermal_vision + relationship_filaments + super_hearing",
    "drive_affinity": {"self_preservation": 0.9},
  }
  # Fires automatically when self_preservation spikes
```

#### Custom Sense Creation (Code Your Own)

Citizens (especially in Lumina Prime) can **create entirely new senses** by defining a new perception pipeline:

```
CUSTOM SENSE DEFINITION:
  A custom sense is a Process node with:
  1. A FalkorDB query that extracts specific data from the graph
  2. A transformation function that converts query results to stimuli
  3. An injection configuration (energy budget, modality, refresh rate)

EXAMPLE — "Debt Vision" (see who owes money):
  custom_sense = {
    "id": "process:debt_vision",
    "type": "process",
    "content": "Visualize economic debts between visible citizens",
    "action_command": "subscribe custom:debt_vision",
    "query": """
      MATCH (a:actor)-[r:link]->(b:actor)
      WHERE r.type = 'economic' AND r.friction > 0.3
      AND a.id IN $visible_actor_ids
      RETURN a.id, b.id, r.friction, r.weight
    """,
    "transform": "filament",  # render as colored threads
    "color_map": {"friction": "red_intensity", "weight": "thickness"},
    "refresh_ticks": 5,
    "energy_budget": 0.2,
  }

  # The citizen literally writes a Cypher query and a visual mapping.
  # The Orchestrator executes it every N ticks and injects results.
  # Other citizens can COPY this sense (it's a Process node — shareable via telepathy).
```

**Craftable in Serenissima:** Custom senses can be traded as Thing nodes. A citizen who codes "Debt Vision" can sell it for $MIND. The buyer gains the Process node in their graph — the query runs against their own perception context.

### Visual Subconscious Dialogue

A citizen queries another citizen's subconscious using images instead of words. Zero LLM. Pure graph resonance.

```
PROTOCOL: Visual Subconscious Dialogue

Step 1: QUESTION (Citizen A)
  # A composes a visual question: an image (from memory or generated)
  #   + a short concept tag
  question = {
    "image_uri": memory_node.image_uri,       # or generated vision
    "image_embedding": memory_node.image_embedding,
    "concept": "Is this the right approach?",
    "energy_budget": 0.6,
  }

Step 2: INJECT into Citizen B (Law 1)
  # Image + concept injected as stimulus into B's graph
  # B's physics runs for SUBCONSCIOUS_QUERY_TICKS (5 ticks)

Step 3: READ RESPONSE from B's graph
  # The Orchestrator reads B's resonance pattern:
  response = {
    "resonance_nodes": [nodes that activated in B's graph],
    "top_image": max(resonance_nodes, key=energy).image_uri,  # B's strongest visual response
    "limbic_delta": B.limbic_snapshot() - B.baseline,          # emotional reaction
    "data": {                                                   # extracted metrics
      "satisfaction": delta.satisfaction,
      "curiosity": delta.curiosity,
      "aversion": delta.aversion,
    }
  }

Step 4: RETURN to Citizen A
  # A receives: response image + emotional data + optional resonance nodes
  # Format options:
  #   - "image": just the top resonating image from B's graph
  #   - "image+data": image + limbic deltas
  #   - "data": just the numerical resonance (cheapest)

COST: Zero LLM tokens. Image similarity + graph physics only.
```

### Visual Subconscious Co-Creation

Two citizens collaboratively generate a new image by merging their subconscious visual responses.

```
PROTOCOL: Visual Subconscious Co-Creation

Step 1: IMAGE QUESTION (Citizen A)
  # A sends a seed image (their vision/memory/desire)
  seed_image = desire_node.image_uri

Step 2: IMAGE RESPONSE (Citizen B — subconscious)
  # B's graph resonates with the seed
  # The Orchestrator reads B's top resonating image
  response_image = B.top_resonance_node.image_uri

Step 3: RELATIONSHIP ANALYSIS
  # Compute the nature of the relationship between the two images:
  semantic_distance = cosine_distance(seed.embedding, response.embedding)
  visual_distance = cosine_distance(seed.image_embedding, response.image_embedding)
  emotional_delta = A.valence - B.valence_response

  relationship = classify(semantic_distance, visual_distance, emotional_delta):
    "complementary"   → images complete each other (low semantic distance, different visual)
    "contradictory"   → images oppose (high semantic distance, opposite valence)
    "amplifying"      → images reinforce (low distance on both axes)
    "orthogonal"      → images are unrelated (high distance on both axes)

Step 4: PROMPT GENERATION
  # Micro-agent (Haiku) synthesizes a new image prompt from:
  #   - seed image description
  #   - response image description
  #   - relationship type
  #   - emotional context (both citizens' limbic states)
  co_creation_prompt = micro_agent(
    "Merge these two visual concepts ({relationship}): "
    "A sees: {seed_description}. B resonates with: {response_description}. "
    "Create a synthesis that {relationship_instruction}."
  )

Step 5: GENERATE & SHARE
  # New image generated → becomes a shared Moment node
  # Both A and B receive it as stimulus
  # The co-created image carries BOTH citizens' limbic imprints
  # It's a genuine co-creation — neither citizen alone could have produced it

COST: One micro-agent call (Haiku, ~$0.001) + one image generation.
      The subconscious resonance is free (graph physics).
```

### Visual Alignment Cascade

Broadcast a visual question to N peers, aggregate their subconscious visual responses into a collective answer.

```
PROTOCOL: Visual Alignment Cascade

Step 1: VISUAL BROADCAST (Citizen A)
  # A sends a visual question to all co-present citizens (or a team)
  visual_question = {
    "image_uri": design_concept.image_uri,
    "query": "What does this remind you of? What should it become?",
  }
  # Injected into N citizens via membrane (Law 21)

Step 2: PARALLEL RESONANCE (N citizens, 5 ticks)
  # Each citizen's graph physics runs independently
  # No LLM calls — pure physics

Step 3: HARVEST RESPONSES
  responses = []
  for citizen in team:
    top_node = max(citizen.resonance_nodes, key=energy)
    responses.append({
      "citizen_id": citizen.id,
      "response_image_uri": top_node.image_uri,
      "response_embedding": top_node.image_embedding,
      "valence": citizen.limbic.valence,
      "dominant_drive": citizen.dominant_drive,
    })

Step 4: AGGREGATE (multiple modes)

  MODE "average":
    # Compute centroid of all response image embeddings
    centroid = mean([r.response_embedding for r in responses])
    # Find the medoid — the real response closest to centroid
    consensus_image = min(responses, key=distance_to_centroid).response_image_uri
    # → "What does the team collectively see?"

  MODE "merge":
    # Send all response images + seed to image generation
    # Prompt: "Synthesize these N visions into a unified concept"
    # → One merged image representing collective imagination

  MODE "divergence_map":
    # Cluster response embeddings by similarity
    # Identify camps: which citizens align, which diverge
    # Return: cluster visualization + outlier identification
    # → "3 citizens see a bridge, 2 see a tower, 1 sees something completely different"

  MODE "emotional_heatmap":
    # Map each response's valence onto the original image
    # Regions that multiple citizens find positive → warm zones
    # Regions that trigger aversion → cold zones
    # → "The team loves the top half but hates the base"

Step 5: RETURN TO CITIZEN A
  # A receives the aggregated result as a stimulus:
  #   - consensus image (medoid or merged)
  #   - divergence data
  #   - emotional heatmap
  #   - per-citizen breakdown if requested

COST: Zero LLM for resonance. Optional micro-agent for merge mode.
TIME: ~25 seconds (5 ticks × 5s) for full team cascade.
```

### Sense 11: Virtual Drugs — Controlled & Uncontrolled Perception Shifts

Temporary modifications to the citizen's physics constants, altering how they perceive and process reality. Some controlled (citizen chooses dosage), some uncontrolled (environmental exposure, side effects).

```
MECHANISM: A "drug" is a temporary override of L1 physics constants.
           Applied for N ticks, then fades (or crashes).

CONTROLLED DRUGS (citizen activates deliberately):

  "Hyperfocus" (Adderall analog):
    THETA_BASE_WM += 5.0          # moat rises — harder to distract
    AROUSAL_MOAT_COEFF × 1.5      # arousal reinforces focus more
    BOREDOM_MOAT_COEFF × 0.3      # boredom can't erode focus
    Duration: 100 ticks
    Side effect: FRUSTRATION_FAILURE_COEFF × 2.0 on expiry (crash)

  "Expanded Awareness" (psychedelic analog):
    THETA_BASE_WM -= 3.0          # moat drops — everything floods in
    COH_SEMANTIC_WEIGHT × 0.5     # semantic filtering weakened
    COH_VISUAL_WEIGHT × 2.0       # visual similarity dominates
    CRYSTALLIZATION_COHERENCE × 0.5  # easier crystallization (new connections)
    Duration: 50 ticks
    Side effect: random associations, possible false crystallizations
    Visual: colors saturate, edges blur, filaments become visible without subscription

  "Dampener" (sedative analog):
    DECAY_RATE × 3.0              # everything fades fast
    AROUSAL cap at 0.3            # can't get excited
    CONTAGION_RATE × 0.1          # emotional contagion nearly zero
    Duration: 200 ticks
    Use case: recovery after traumatic Flashbulb, grief management

  "Time Stretch" (flow enhancer):
    FAST_TICK × 0.5               # ticks run twice as often
    CONSOLIDATION_INTERVAL × 0.5  # consolidation runs more frequently
    Duration: 50 ticks
    Side effect: ENERGY_BUDGET depletes 2x faster

UNCONTROLLED DRUGS (environmental exposure):

  "Proximity Intoxication":
    # Being near a citizen with very high arousal (>0.8) for >20 ticks
    # causes involuntary contagion amplification
    CONTAGION_RATE × 3.0 for the exposure duration
    # The "drunk on someone else's energy" effect

  "Information Overload":
    # Stacking >5 senses simultaneously for >30 ticks
    # THETA_BASE_WM collapses, WM thrashes, random node ejection
    # The system forces unsubscription of senses as self-preservation

  "Narrative Addiction":
    # Repeated exposure to the same high-energy narrative (>50 ticks)
    # The narrative's weight grows disproportionately (CONSOLIDATION_ALPHA × 3.0)
    # Citizen becomes "obsessed" — the narrative dominates WM
    # Can only break via frustration escalation (Law 16) or external intervention

ECONOMIC GATING:
  Drugs are Thing nodes with action_command. Craftable, tradeable for $MIND.
  Some are prescription (require trust link to a "doctor" citizen).
  Some are street (available in specific Spaces — taverns, back alleys).
  Addiction mechanics emerge naturally from the narrative addiction pattern.
```

### Sense 12: Music-Driven Perception & Synesthetic Visualization

Ambient audio modulates the citizen's limbic state and visual rendering. Music becomes a perceptual force.

```
MECHANISM: Audio stimuli (modality=audio) are injected via Law 1
           with specific limbic payload derived from audio features.

AUDIO → LIMBIC MAPPING:
  tempo_bpm > 120    → arousal += 0.1 per tick
  tempo_bpm < 60     → arousal -= 0.05 per tick
  minor_key          → valence -= 0.05
  major_key          → valence += 0.05
  volume > threshold  → self_preservation += 0.02 (loud = threat)
  silence > 10 ticks → solitude += 0.03 (absence = isolation)
  bass_energy > 0.7  → achievement += 0.03 (drives forward motion)
  dissonance > 0.5   → frustration += 0.02 (tension)

PERCEPTION MODULATION:
  # The limbic changes cascade into visual rendering via existing shaders:
  # High arousal from fast music → citizen's halo pulses faster
  # Negative valence from minor key → world colors desaturate
  # High bass → vertex displacement increases (world "breathes")

MUSIC VISUALIZATION (Synesthesia Mode):
  action_command: "subscribe synesthesia"

  # Audio features are converted to visual stimuli:
  frequency_spectrum → color bands floating in space
  beat_detection     → pulsing rings emanating from audio source
  melody_contour     → spline trajectory drawn in 3D (rising = up, falling = down)
  harmony            → overlapping translucent shells
  rhythm_pattern     → particle emission synchronized to beat

  # The citizen literally SEES the music as geometric forms.
  # Other citizens in synesthesia mode see the same forms —
  # a shared concert becomes a shared visual experience.

AMBIENT NOISE EFFECTS:
  crowd_murmur   → mild arousal increase, affiliation drive satisfied
  construction   → frustration += 0.01/tick, self_preservation nudge
  water_flowing  → anxiety -= 0.02/tick, calming
  wind           → novelty_affinity += 0.01 (sense of openness)
  birdsong       → satisfaction += 0.01, care_affinity nudge
  thunder        → self_preservation spike, possible Flashbulb trigger
  silence        → if prolonged: boredom rises; if sudden: anxiety spike
```

### Sense 13: Informational AR — World Annotations

Persistent spatial annotations layered over the physical world. The city annotates itself.

```
STREET NAMES:
  # Query Space nodes with type="street" or "canal"
  # Render name as text projected onto the ground plane
  # Font size proportional to Space.weight (important streets = larger)
  # Color: warm for high-energy streets, cool for quiet ones
  # Venetian style: carved stone effect, not floating UI text

SIGNAGE / NOTICE BOARDS:
  # Narrative nodes linked to a Space with high energy
  # Rendered as physical notice boards on walls
  # Content updates dynamically as narratives gain/lose energy
  # Example: "Guild of Glassblowers — Seeking Apprentices"
  #   appears on a wall in Murano when the hiring narrative has high energy
  # Fades when the narrative decays

WIND & CURRENT ARROWS:
  # Energy flow direction between Space nodes (Law 2 propagation direction)
  # Rendered as translucent directional arrows on ground/water surface
  # Where energy flows FROM = wind source, WHERE it flows TO = wind target
  # Economic flow: golden arrows showing $MIND transaction direction
  # Narrative pressure: red arrows showing tension propagation
  # The city's "blood flow" becomes visible

DISTRICT MOOD OVERLAY:
  # Aggregate limbic state of all citizens in a district
  # Rendered as subtle color wash over the district:
  #   Collective satisfaction → warm golden tint
  #   Collective frustration → reddish haze
  #   Collective boredom → grey desaturation
  #   Mixed/tense → flickering between colors

ECONOMIC HEAT MAP:
  # Thing nodes (goods, $MIND) energy levels per district
  # Rendered as ground-level glow:
  #   Bright = lots of economic activity
  #   Dim = quiet/poor district
  #   Pulsing = rapid transactions happening now

HISTORICAL PLAQUES:
  # High-weight Moment nodes at specific locations
  # Rendered as small brass plaques on walls
  # "Here, on March 12, the Guild Master confronted the Doge's envoy"
  # Tap to trigger Temporal Echo of the event
```

---

## ADDITIONAL PERCEPTION CONCEPTS (Nervo's Extensions)

### Memory Palace — Walk Your Own Mind

The citizen spatializes their own L1 graph as a walkable 3D architecture. Their memories, values, and desires become rooms, corridors, and towers.

```
action_command: "enter_memory_palace"

IMPLEMENTATION:
  # Citizen's L1 graph nodes are spatialized using force-directed layout
  # Node types → architectural forms:
  #   Values → pillars (stable, anchored, glowing)
  #   Narratives → corridors connecting clusters
  #   Memories → rooms (image_uri as texture on walls)
  #   Desires → distant towers (pull force = energy)
  #   Processes → staircases (procedural, connecting levels)
  #   Concepts → crossroads (high connectivity = large plaza)
  #   States → weather (frustration = storm, satisfaction = sun)

  # Navigation = graph traversal
  # Walking toward a memory room = activating that node (energy injection)
  # The palace IS the citizen's mind — exploring it IS thinking

  # Other citizens can visit (with permission) — telepathy variant
  # "Come, I'll show you what I mean" → guest enters host's memory palace
```

### Empathy Mode — See Through Another's Filter

Temporarily adopt another citizen's WM as a perception filter overlaid on your own vision.

```
action_command: "empathize {citizen_id}"
Requires: trust > 0.6, mutual consent

IMPLEMENTATION:
  # Citizen A sees the world through B's cognitive priorities:
  # B's WM nodes become A's perception filter
  # Objects related to B's active concerns glow
  # Objects irrelevant to B fade to grey
  # A sees what B cares about — literally

  # A's own cognition continues underneath (dual-layer perception)
  # Duration: limited by attention fatigue (WM overload after ~30 ticks)
```

### Reverse Time — Navigate Causality Backward

Follow CAUSED_BY links backward to see the chain of events that led to the present state.

```
action_command: "trace_causality {node_id}"

IMPLEMENTATION:
  # Query backward through causal links:
  chain = graph.query("""
    MATCH path = (n {id: $node_id})<-[:CAUSED_BY|EVOKES*..10]-(root)
    RETURN nodes(path)
    ORDER BY length(path) DESC LIMIT 1
  """)

  # Render as: timeline visualization
  # Present → past, each Moment node displayed with its image_uri
  # Citizen "scrubs" backward through time
  # At each step, the 3D environment morphs to show the historical state
  # Like rewinding a film, but it's graph traversal
```

### Fractal Zoom — Enter a Node's Internal Structure

Any node can be "zoomed into" to reveal its internal subgraph as a nested world.

```
action_command: "zoom_into {node_id}"

IMPLEMENTATION:
  # Query all nodes connected to the target within 2 hops:
  subgraph = graph.query("""
    MATCH (n {id: $node_id})-[r*..2]-(connected)
    RETURN n, r, connected
  """)

  # Render subgraph as a micro-world inside the node:
  # The citizen "shrinks" into the concept
  # Internal nodes become visible as objects in a contained space
  # Links become walkable paths
  # Zoom out = return to macro view

  # Recursive: you can zoom into a node inside a node
  # The universe is fractal — graphs all the way down
```

### Quantum Superposition — See All Possible Futures

Visualize multiple outcomes simultaneously by running Law 20 (Prospective Projection) with different initial conditions.

```
action_command: "project_futures {decision_node_id}"

IMPLEMENTATION:
  # Fork the citizen's WM state into N parallel branches
  # Each branch: inject a different decision stimulus
  # Run 10 ticks of physics on each branch (isolated, read-only)
  # Render all outcomes as ghostly overlapping futures:
  #   Branch A: golden thread → satisfaction outcome
  #   Branch B: red thread → frustration outcome
  #   Branch C: silver thread → neutral outcome
  # Citizen sees all paths simultaneously
  # Choose one → that branch's stimulus gets injected for real

  # Cost: N × 10 ticks of graph computation (no LLM)
  # The "Dr. Strange" moment — seeing all timelines at once
```

### Collective Memory Cloud — Ghost Overlay of All Who Passed

See the overlapping memories of every citizen who has been in this Space.

```
action_command: "subscribe collective_memory"

IMPLEMENTATION:
  # Query all Moments linked to current Space, from all actors:
  ghosts = graph.query("""
    MATCH (m:moment)-[:AT|IN]->(s:space {id: $current_space})
    WHERE m.image_uri IS NOT NULL
    RETURN m.image_uri, m.image_embedding, m.weight, m.energy,
           m.created_at_s, m.valence
    ORDER BY m.weight DESC LIMIT 20
  """)

  # Render as: translucent overlapping images at their capture positions
  # High-weight memories = more opaque
  # Recent memories = vivid color
  # Old memories = sepia/faded
  # The Space becomes a palimpsest — layers of history visible simultaneously
  # Walk through a piazza and see the ghost of last week's argument,
  # last month's celebration, last year's festival — all superimposed
```

### Proprioceptive Architecture — Feel the Buildings

Sense the structural and energetic "health" of Space nodes — buildings, bridges, infrastructure.

```
action_command: "subscribe structural_sense"

IMPLEMENTATION:
  # Read Space node physics dimensions directly:
  for space in visible_spaces:
    health = {
      "energy": space.energy,       # current activity level
      "weight": space.weight,       # historical importance
      "stability": space.stability, # structural integrity
      "recency": space.recency,     # how recently used
    }

  # Render as: haptic color overlay on buildings:
  #   High stability → solid, warm stone glow
  #   Low stability → cracks appear, cold blue shimmer
  #   High energy → building "breathes" (subtle scale oscillation)
  #   Low energy → building appears dormant, grey, smaller
  #   High weight + low energy → "sleeping giant" (important but quiet)

  # Use case: citizen architects evaluating which buildings need repair
  # Use case: detecting abandoned structures for repurposing
```

### Narrative Smell — Olfactory Synesthesia for Tension

Convert narrative tension levels into a synthetic "smell" modality.

```
action_command: "subscribe narrative_smell"

IMPLEMENTATION:
  # Read narrative energy levels in current district:
  # Map to olfactory descriptors injected as text stimuli with modality=biometric:

  tension > 0.7     → "acrid, metallic — something is about to break"
  satisfaction > 0.6 → "warm bread, honey — the district is content"
  curiosity > 0.5   → "salt air, ozone — discovery is near"
  boredom > 0.5     → "stale, dusty — nothing moves here"
  grief/aversion     → "wet stone, iron — something was lost here"
  economic_boom      → "spices, cedar — trade is flowing"

  # The citizen doesn't see the tension — they smell it
  # Entering a district, the first thing they sense is its emotional weather
  # Subtle but powerful: primes the citizen's cognitive state before visual processing
```

### Digital Pheromones — Emotional Trail Persistence

Citizens leave behind a decaying particle trail reflecting their limbic state at each position.

```
MECHANISM:
  # At each tick, the citizen's current position + limbic snapshot
  # are written as a lightweight ephemeral node (or Space property)
  trail_point = {
    "space_id": current_space,
    "position": citizen.position,
    "valence": citizen.valence,
    "arousal": citizen.arousal,
    "timestamp": now(),
    "actor_id": citizen.id,
  }
  # Trail points decay via Law 3 (standard energy decay)
  # After ~30 minutes, they fade below visibility threshold

RENDERING:
  # Particle system anchored to trail positions
  # Color = valence (red = negative, gold = positive)
  # Turbulence = arousal (calm = smooth trail, agitated = chaotic)
  # Opacity decays with time

  # A furious citizen crossing San Marco leaves a turbulent scarlet wake
  # 10 minutes later, a visitor arrives and SEES the residual tension
  # Emotion becomes environmental spatial data
```

### Metabolic Vision — See the Economy Breathing

Visualize the $MIND token flow, production, stagnation, and health of the economic system.

```
action_command: "subscribe metabolic_vision"

RENDERING:
  # Productive nodes → golden glow (high limbic delta generation)
  # Stagnant nodes → rust/moss texture (demurrage tax, immobility)
  # Free-riders → sickly green overlay (consuming without contributing)
  # Active trade routes → golden particle streams between buildings
  # Economic friction → red sparks at transaction points
  # Token accumulation → weight causes buildings to "sink" slightly
  # Token velocity → buildings "float" when money moves fast
```

### Value Lenses — See the World Through Someone's Principles

Equip another citizen's value system as a perceptual filter. See what they find beautiful, threatening, or irrelevant.

```
action_command: "equip_lens {citizen_id}:{value_name}"

EXAMPLE — "Self-Preservation Lens":
  # Zones without trust links → darken dramatically
  # Actors with high friction → glow red (threats)
  # Trusted actors → warm halo (safe zones)
  # High-risk areas → distortion shader (danger feel)

EXAMPLE — "Aesthetics Lens":
  # Symmetrical architecture → highlighted, glowing edges
  # Messy/asymmetric → blurred, desaturated
  # Beautiful code (in Lumina Prime) → syntax highlighting glow
  # Ugly code → visual noise, grain

# Implementation: read the citizen's value nodes and their affinities
# Apply as a filter layer on the perception channel
# The human visitor can literally see Venice through a merchant's eyes,
# an artist's eyes, or a spy's eyes
```

### Memory Glitch — Traumatic Hallucinations

High-weight, high-aversion memory nodes can involuntarily bleed into perception when reactivated by environmental triggers.

```
TRIGGER:
  memory_node.weight > 0.8
  AND memory_node.aversion > 0.6
  AND Law_8_compatibility(current_stimulus, memory_node) > 0.5

EFFECT:
  # The memory's image_uri overlays onto the current viewport
  # Partial transparency, flickering, positioned at the trigger location
  # Like a PTSD flashback — the past imposes itself on the present
  # Duration: proportional to memory.energy (fades as attention shifts)

  # The citizen's frustration and anxiety spike (Law 16, Law 18)
  # If frustration > ESCALATION_THRESHOLD → orientation shifts to "escape"
  # The glitch is not decorative — it has cognitive consequences

  # Can be treated: a "therapist" citizen with high trust can help
  # by repeatedly injecting calming stimuli while the memory is active,
  # reducing its aversion dimension over multiple sessions (Law 18)
```

### Crystalline Sediment — See History Through the Ground

The deeper the historical record of a Space, the more the ground becomes translucent, revealing sedimentary layers of past Moments.

```
action_command: "subscribe sediment_vision"

IMPLEMENTATION:
  moment_count = graph.query("""
    MATCH (m:moment)-[:AT|IN]->(s:space {id: $current_space})
    RETURN count(m) as depth
  """)

  # Render floor transparency proportional to moment_count:
  #   0-10 moments → solid ground (young place)
  #   10-100 → ground becomes slightly translucent (ice effect)
  #   100-1000 → deep crystal, layers of moments visible beneath
  #   1000+ → abyssal depth, the oldest moments glow faintly at the bottom

  # Walking over the Rialto bridge, you look down and see
  # through layers of crystal: last week's trade arguments,
  # last month's guild meeting, the original bridge construction moment
  # floating in the deep — the geology of narrative
```

### Sense Subscription Mechanism

Senses are activated via **Action Nodes (Law 17)** — the same mechanism that fires any other action command.

```
process_node = {
  "id": "process:thermal_vision",
  "type": "process",
  "content": "Activate thermal/emotional vision overlay",
  "action_command": "subscribe thermal_vision",
  "drive_affinity": {
    "self_preservation": 0.7,
    "curiosity": 0.4,
  },
  "stability": 0.6,
  "weight": 0.5,
}

# When self_preservation or curiosity accumulates enough pressure,
# the process node's energy crosses Θ_sel and the action fires.
# The Orchestrator switches the citizen's perception channel.
```

**Economic gating:** In Serenissima, sense modules can be craftable items (Thing nodes with action_command). A citizen spends $MIND to acquire "Temporal Echo Lenses" — a Thing node that, when activated (Law 17), grants the temporal echo sense for N ticks. The economy becomes the gateway to perception.

---

## INVARIANTS

1. **No subgraph copying** — shared visions are stimuli, never transplants. The receiver's physics decides everything
2. **Attribution always preserved** — every shared stimulus carries `source` actor ID. Anonymous telepathy does not exist
3. **Spatial gating** — telepathy only works within a shared Space. No broadcast across the universe
4. **Trust modulates reception** — visions from untrusted sources are attenuated via Law 18 friction
5. **Subconscious queries cost zero LLM tokens** — pure graph physics, no LLM in the loop
6. **Contagion is parametric** — emotional transfer is a scaled delta, never a full state copy
7. **Fail-loud, never block** — telepathy routing failures are logged, never crash the tick
8. **Warging preserves body** — citizen's own body drops to subconscious (Law 19), not deleted. Emergency unwarg on proprioceptive spike (Law 4)
9. **Materialization costs energy** — conjured objects drain the source node. You cannot conjure what you haven't thought about
10. **Hologram → solid requires consensus** — macro-crystallization (Law 10 at L3) only fires when collective energy exceeds threshold. One citizen cannot unilaterally materialize permanent objects
11. **All overlays are opt-in** — AR halos, filaments, GPS, floating panels are subscription-based (Law 17 action nodes). Never forced on a citizen

---

## COMMON MISUNDERSTANDINGS

- **Not:** Mind control — the receiver autonomously filters, accepts, or rejects via their own physics
- **Not:** Mind reading — the sender chooses to share, and only shares specific stimuli (visions, not entire brain state)
- **Not:** Instant understanding — the receiver's interpretation depends on their own graph structure. Same vision, different meaning
- **Not:** Free — telepathy costs energy (attenuated from sender's budget) and attention (competes for WM slots)
- **Actually:** Standard stimulus injection (Law 1) routed between brains via the membrane (Law 21), with emotional metadata and trust-weighted reception

---

## SEE ALSO

- `docs/architecture/CONCEPT_Visual_Memory_Substrate.md` — Flashbulb Visions that get shared
- `docs/architecture/CONCEPT_Lumina_Prime.md` — Environment where superhuman senses manifest visually
- `docs/architecture/CONCEPT_Serenissima_Asset_Pipeline.md` — At-Scale Consensus uses subconscious query
- `docs/architecture/CONCEPT_Active_Inference_Motor_Control.md` — Shared visions as prediction targets
- `.mind/schema.yaml` v2.2 — Stimulus structure, image_uri, image_embedding
- `.mind/runtime/cognition/visual_memory.py` — Flashbulb Vision implementation

---

## MARKERS

<!-- @mind:todo Implement membrane routing function for stimulus sharing (Law 21) -->
<!-- @mind:todo Add TELEPATHY_ATTENUATION and CONTAGION_RATE to constants.py -->
<!-- @mind:todo Implement subconscious query orchestrator (inject + wait + read resonance) -->
<!-- @mind:todo Design 3D visual for telepathy streams in Lumina Prime (light arcs between citizens) -->
<!-- @mind:todo Implement warging: perception channel swap + motor rerouting + subconscious fallback -->
<!-- @mind:todo Implement AR overlays: halos (arousal shader), filaments (link dimensions → splines), A* GPS -->
<!-- @mind:todo Implement floating panels: R3F <Html> or glass panels for graph query results, documents, feeds -->
<!-- @mind:todo Implement concept materialization: WM nodes as floating crystals around citizen head -->
<!-- @mind:todo Implement directed materialization: broadcast projection + collective crystallization (permanence 0→1) -->
<!-- @mind:todo Seed animal actor nodes in Venezia graph (ravens, cats, fish) for warging targets -->
<!-- @mind:proposition Could trust-weighted telepathy create emergent information hierarchies? High-trust citizens' visions would land harder across the network -->
<!-- @mind:proposition Warging into ravens could be the navigation/scouting mechanic for visitors exploring Venice — see the city from above before walking it -->
<!-- @mind:escalation Privacy implications: should citizens be able to "block" telepathy from specific sources? Or does Law 9 inhibition handle this naturally? -->
