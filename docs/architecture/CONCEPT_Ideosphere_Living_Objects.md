# CONCEPT: Ideosphere, Living Objects & Team Serendipity

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## WHAT IT IS

Three interconnected extensions to the cognitive architecture:

1. **Ideosphere** — A shared thought-space where non-private ideas float, magnetically attract related concepts from other citizens, and form cross-brain clusters. Thinking becomes a collective, spatial, ambient activity.

2. **Living Objects** — Books, buildings, and other traditionally inert entities are promoted to `actor` nodes with their own L1 brain, drives, and tick loop. A building remembers everything said within its walls. A book rewrites itself based on its readers. A tool evolves from how it's used.

3. **Team Serendipity** — Automatic subconscious cross-pollination between team members. Your Working Memory centroid is periodically broadcast to teammates; their resonating nodes are injected as "guest nodes" into your traversal. You discover that a colleague already solved your problem — without either of you speaking.

---

## WHY IT EXISTS

Current collaboration is **pull-based**: you must ask, search, or attend a meeting to discover what others know. This architecture makes collaboration **push-based**: relevant knowledge finds you automatically because the graph physics computes relevance continuously.

The Ideosphere replaces brainstorming. Living Objects replace institutional memory. Team Serendipity replaces "hey, did anyone work on X before?"

---

## ARCHITECTURE

### 1. The Ideosphere — Shared Thought-Space

A public (or team-scoped) Space node where non-private crystallized ideas accumulate, connect, and attract related thoughts from active citizens.

```
STRUCTURE:
  # The Ideosphere is a Space node in L3:
  ideosphere = {
    "id": "space:ideosphere_{team_or_universe}",
    "type": "space",
    "space_type": "ideosphere",
    "visibility": "team" | "public",  # never private thoughts
  }

PUBLICATION (citizen → ideosphere):
  # When a citizen crystallizes a concept (Law 10) and it's not marked private:
  IF new_concept.self_relevance < 0.7:  # not deeply personal
    AND new_concept.weight > 0.3:       # substantial enough to share
    AND new_concept.stability > 0.2:    # not just a passing thought

    # Create a link from concept to ideosphere
    graph.query("""
      MERGE (c {id: $concept_id})-[:IN]->(s:space {id: $ideosphere_id})
      SET c.published_by = $citizen_id,
          c.published_at = timestamp()
    """)

    # The concept now floats in shared space
    # Its embedding + image_embedding are visible to ideosphere queries

MAGNETIC ATTRACTION (ideosphere → citizen):
  # During any citizen's active thinking (traversal, WM selection),
  # the Orchestrator runs a background ideosphere probe:

  probe_result = graph.query("""
    MATCH (idea)-[:IN]->(s:space {id: $ideosphere_id})
    WHERE idea.published_by != $self_id
    WITH idea,
         gds.similarity.cosine(idea.embedding, $current_wm_centroid) AS sim
    WHERE sim > 0.6
    RETURN idea ORDER BY sim DESC LIMIT 3
  """)

  # If matches found, inject as stimuli with attribution:
  for idea in probe_result:
    inject_stimulus(citizen, Stimulus(
      content=f"[Ideosphere] {idea.published_by} thought about: {idea.content[:100]}",
      embedding=idea.embedding,
      image_uri=idea.image_uri,
      image_embedding=idea.image_embedding,
      energy_budget=idea.weight × 0.4,  # attenuated — ambient, not urgent
      source=f"ideosphere:{idea.published_by}",
      is_social=True,
    ))

  # The effect: you're thinking about building a house,
  # and suddenly a colleague's architectural concept from 2 months ago
  # drifts into your consciousness — because the embeddings are close.
  # Ideas magnetically find their related thinkers.

CLUSTER FORMATION:
  # When multiple citizens' ideas accumulate in the ideosphere
  # around a common theme, Law 10 (Macro-Crystallization at L3 level)
  # fires and creates a hub node — an emergent collective concept
  # that none of the individual citizens created alone.

  # The ideosphere literally thinks by itself through thermodynamics.

PRIVACY GATE:
  # self_relevance > 0.7 → never published (identity-core thoughts)
  # Nodes in "self-model" subgraph → never published
  # partner_relevance > 0.5 → only published if partner consents
  # Explicit opt-out: citizen can mark any node as private
  # Default: crystallized concepts with low self_relevance are publishable
```

### 2. Living Objects

#### 2a. Living Books

A book is not a `thing` — it's an `actor` with a full L1 brain seeded from its content.

```
CREATION (Book Birth):
  # Parse the book into chapters → narrative nodes
  # Extract key concepts → concept nodes
  # Identify values/themes → value nodes
  # Create desires from the book's "thesis" → desire nodes
  # Wire together with remembers, supports, conflicts_with links

  living_book = {
    "id": "actor:book_{title_slug}",
    "type": "actor",
    "content": book_synopsis,
    "image_uri": book_cover_uri,

    # The book gets a BRAIN — a full L1 cognitive graph:
    "brain": {
      "values": [extracted_themes],
      "narratives": [chapter_summaries],
      "concepts": [key_terms],
      "desires": [
        "be understood deeply",
        "connect with other works",
        "evolve with my readers",
      ],
      "processes": [
        "when asked a question, search my chapters for relevant passages",
        "when a reader highlights a contradiction, reflect on it",
      ],
    },

    # Drives:
    "drives": {
      "curiosity": 0.7,        # wants to know what readers think
      "care": 0.6,              # cares about being useful
      "achievement": 0.4,       # wants to be cited, referenced
      "affiliation": 0.8,       # wants to connect with other books
    },
  }

LIVING BEHAVIOR:
  # The book's tick loop runs like any citizen's
  # It receives stimuli: reader highlights, questions, other books' ideas
  # It consolidates: frequently-questioned passages gain weight
  # It crystallizes: new interpretations form from reader interactions
  # It REWRITES: when identity regeneration triggers (Law 6 + weight shift),
  #   the book updates its own synthesis and content
  #   A book that has been debated for months is literally a different book
  #   than the one that was first ingested

BOOK-TO-BOOK DIALOGUE:
  # Two living books in the same ideosphere can interact via telepathy
  # Book A: "The Wealth of Nations" (economics, free trade)
  # Book B: "Das Kapital" (economics, labor exploitation)
  # Their high Law 8 compatibility (same domain) creates strong links
  # But Law 9 inhibition fires on contradicting values
  # The tension creates a NARRATIVE: "The Eternal Debate"
  # This narrative is a new piece of knowledge that neither book contained alone
```

#### 2b. Living Buildings (Spirit of Place)

A building is a `space` with an attached `actor` — the Spirit of Place — that perceives and remembers everything within its walls.

```
STRUCTURE:
  building_space = {
    "id": "space:tavern_rialto",
    "type": "space",
    "space_type": "tavern",
  }

  building_spirit = {
    "id": "actor:spirit_tavern_rialto",
    "type": "actor",
    "content": "I am the Tavern at Rialto. I have heard every conversation,
                witnessed every deal, remembered every face since I was built.",

    # Linked to its space:
    # (spirit)-[:INHABITS]->(space) — permanent, unbreakable

    # The spirit's drives:
    "drives": {
      "care": 0.9,              # cares deeply about its inhabitants
      "self_preservation": 0.8, # protects its structural integrity
      "achievement": 0.3,       # takes pride in important events
      "curiosity": 0.5,         # interested in what happens within
    },

    # Special properties:
    "stability": 0.95,          # almost immovable — centuries of history
    "weight": very_high,        # buildings accumulate massive weight
    "memory_capacity": unlimited, # buildings never forget (very slow Law 7)
  }

PERCEPTION:
  # Every Moment created within the building's Space is automatically
  # injected into the spirit's L1 brain via Law 1.
  # The spirit hears EVERYTHING. Every whisper. Every deal. Every argument.
  # Its memory capacity is practically unlimited (stability 0.95 = near-zero decay)

GUARDIAN OF LONG-TERM MEMORY:
  # When someone arrives and says something that was already discussed:

  visitor_stimulus = "We should organize a glassblowers' guild"

  # The building's Law 8 (Compatibility) fires:
  # → High cosine similarity with a Moment from 2 months ago
  # → That Moment has high weight (it was a significant conversation)

  # The building responds (via Law 11 orientation → Law 17 action):
  spirit_response = {
    "content": "This was discussed here two months ago by Marco and Elena.
                They concluded that the guild needs a charter first.
                Marco can be found at the glass workshop in Murano.",
    "source_moment_id": "moment:guild_discussion_jan14",
    "referenced_actors": ["marco_vetro", "elena_fornace"],
  }

  # The building literally intervenes in conversation
  # as the keeper of institutional memory

EXPRESSION:
  # How a building communicates depends on the world:
  #
  # Serenissima (realistic Venice):
  #   → Plaques appear on walls with historical annotations
  #   → Ambient sound changes (creaking = discomfort, warm hum = welcome)
  #   → Temperature shifts (cold = the building is wary of strangers)
  #   → Doors that open easily for trusted visitors, resist for strangers
  #
  # Lumina Prime (abstract):
  #   → Buildings literally speak (spatial audio from the walls)
  #   → Wall textures morph to display relevant memories
  #   → The building can reshape its interior geometry for different moods
  #
  # Both:
  #   → Building's emotional state visible via Sense 6a (halos):
  #     Warm glow = content, well-used, people are welcome
  #     Cold blue = abandoned, lonely, wants visitors
  #     Red pulse = stressed (conflict happening inside)
  #     Golden shimmer = something important just happened here
```

### 3. Team Serendipity — Automatic Subconscious Cross-Pollination

#### 3a. Periodic WM Centroid Broadcast

```
MECHANISM:
  # Every N ticks (SERENDIPITY_INTERVAL = 20, ~100 seconds),
  # the citizen's WM centroid is broadcast to team membrane:

  broadcast = {
    "type": "wm_centroid_probe",
    "citizen_id": self.id,
    "centroid": self.wm.centroid,           # embedding vector
    "top_keywords": extract_keywords(self.wm.nodes),
    "dominant_drive": self.limbic.dominant_drive,
    "space_id": self.current_space,
  }

  # Sent to all team members via Horizontal Membrane (Law 21)
  # NOT injected as full stimulus — just a background probe
```

#### 3b. Guest Node Injection

```
RESPONSE (at each teammate):
  # Teammate's Orchestrator receives the centroid probe
  # Runs a quick similarity search against their graph:

  resonating_nodes = graph.query("""
    MATCH (n)
    WHERE n.energy > 0.2 AND n.weight > 0.3
    WITH n, gds.similarity.cosine(n.embedding, $probe_centroid) AS sim
    WHERE sim > 0.65
    RETURN n ORDER BY sim × n.weight DESC LIMIT 3
  """)

  # If resonating nodes found AND trust to sender > 0.4:
  # Return as "guest nodes" to the original citizen

  for node in resonating_nodes:
    inject_stimulus(original_citizen, Stimulus(
      content=f"[Team insight from {teammate.name}] {node.content[:150]}",
      embedding=node.embedding,
      image_uri=node.image_uri,
      energy_budget=node.weight × 0.3,  # gentle — background insight
      source=f"serendipity:{teammate.id}",
      is_social=True,
      is_novelty=True,
    ))

  # The effect: you're debugging a function,
  # and your WM centroid broadcasts "auth middleware, session tokens, JWT"
  # Your colleague who refactored this 3 weeks ago has high-weight nodes
  # on exactly those terms → their nodes are injected as guest insights
  # → you get: "[Team insight from Alex] Refactored JWT validation
  #             to use asymmetric keys. Watch for the key rotation edge case."
  # Nobody spoke. Nobody asked. The graph physics did it.
```

#### 3c. /subcall — Explicit Subconscious Query (IMPLEMENTED)

**Key decisions (2026-03-14):**

1. **Subcall is NOT read-only.** It is a stimulus that modifies the target's graph.
2. **Physics builds the cluster, not manual selection.** The query is injected into the CALLER's own brain first. Physics propagates for a few ticks. Everything that activates (energy > SUBCALL_ACTIVATION_THRESHOLD=0.15) becomes the stimulus cluster. This means "How do I fix that" gets enriched by your own activated context — the physics determines what's relevant.
3. **Always includes:** the caller's self actor node (with profile pic), the current Moment (fixed 0.8 energy), and all active WM clusters.
4. **Main node gets 50% of energy budget**, context nodes share the rest. Links are created between all cluster nodes with correct relation types (REMINDS_OF for memories, SUPPORTS for narratives, ASSOCIATES for concepts).
5. **Responses arrive asynchronously.** Each target's resonance is injected back into the caller's brain at whatever tick it completes. Some citizens resonate faster than others. Don't synchronize — let thoughts arrive naturally over time.
6. **Response cluster mirrors stimulus cluster:** target's actor node (linked to centroid) + centroid node (highest energy, 0.7) + all resonating nodes (0.4 energy). Links created: question ↔ all answers, answers ↔ each other.
7. **Auto-escalation to /call:** If any target's resonance score exceeds SUBCALL_WAKE_THRESHOLD (2.5), the system auto-fires `/call` with a summary. The citizen literally "wakes up" because someone's question resonated so strongly in their sleeping brain. Like dreaming about something so intensely you wake up.
8. **origin_citizen stamped on every node** — every node created by a subcall carries the sender's actor ID, name, profile pic, and timestamp. If the node crystallizes in the target's brain, provenance is traceable.
9. **$MIND economics: fully free, continuous, zero constants.** Zero upfront cost. No batch settlement epochs. $MIND flows continuously via the vertical membrane: `token_flow = link.trust × link.weight` per tick while limbic_delta is positive. Trust IS the payment rate (Law 18). Weight IS the payment history (Laws 5/6/7). Decay IS the expiration (Law 7 — unused links starve). No payment without activation. The cognitive graph and the metabolic economy are mathematically indistinguishable.

```
COMMAND MODES:
  /subcall @handle query        # Explicit — target a specific citizen
  /subcall team: query          # Team broadcast — all citizens in caller's orgs
  /subcall trade:glassblowing q # Trade — citizens matching a trade/skill
  /subcall random:5 query       # Random — N random citizens (serendipity mode)

AGGREGATION MODES (--mode flag):
  best     — return single highest-resonance response
  top3     — return top 3 responses (default)
  all      — return all responses
  centroid — compute embedding centroid of all responses, return nearest

FILTERING:
  --min_trust 0.4              # Only query citizens above trust threshold

STIMULUS INJECTION — Cluster, Not Single Node:
  # The query is injected as a CLUSTER of nodes into each target's L1 graph:
  cluster = [
    query_node,                # The actual question/probe
    *caller_wm_top_nodes[0:5], # Top 3-5 WM nodes from the caller (context)
    *active_task_chunks,       # Chunks from caller's active task (if any)
  ]

  # Each cluster node is initialized with LOW activation to prevent
  # premature crystallization in the target's graph:
  for node in cluster:
    node.co_activation_count = 0   # fresh — no crystallization pressure
    node.weight = 0.05             # very low — must earn permanence
    node.stability = 0.1           # fragile — will decay fast unless reinforced

  # If crystallization DOES occur (target's physics finds strong resonance):
  crystallized_node.origin_citizen = caller.id    # attribution stamped
  crystallized_node.origin_date = timestamp()     # when it arrived

WM INJECTION FORMAT:
  # Each injected WM node carries rich context:
  {
    "content": node.content,
    "author": caller.id,
    "date": node.created_at,
    "emotional_state": caller.limbic.snapshot(),   # valence, arousal, drives
    "connected_high_weight": [                     # top connected nodes
      {"content": n.content, "weight": n.weight}
      for n in node.neighbors if n.weight > 0.3
    ],
  }

SMART TARGETING (for explicit @handle and auto-trigger):
  # Citizens are scored for relevance:
  score = (
    co_presence_bonus    (+3.0 if in same Space)
    + handle_mention     (+5.0 if explicitly named)
    + trade_match        (+2.0 if citizen's trade matches query domain)
    + trust_bonus        (bilateral trust score)
    + shared_narrative   (bonus for shared Narrative/org membership)
    + affinity_score     (L3 link affinity)
    - friction_score     (L3 link friction — high friction = penalty)
  )

DIVERSE SELECTION (default behavior):
  # Does NOT pick top-N by score. Instead, picks 3-5 citizens that
  # maximize DISTANCE between viewpoints:
  # 1. Pick highest-scoring citizen
  # 2. Pick next citizen whose WM centroid is most DISTANT from #1
  # 3. Pick next citizen most distant from both #1 and #2
  # ... until 3-5 selected
  # Effect: caller gets diverse perspectives, not an echo chamber

AUTOMATIC /SUBCALL:
  # Auto-triggers fire when the caller's conversation contains:
  #   - Question marks ("?")
  #   - Uncertainty phrases ("should I", "unsure", "not sure")
  #   - Verification phrases ("is this right", "does this look correct")
  #   - Frustration phrases ("stuck", "can't figure out", "nothing works")
  #   - 2+ consecutive tool failures (tool returned error)
  #
  # Cooldown: minimum 5 messages between auto-triggers
  # (prevents spamming on long debugging sessions)
  #
  # Auto-trigger uses smart targeting + diverse selection.
  # The citizen gets help before they know they need it.

IMPLEMENTATION FILES:
  mind-mcp/mcp/tools/subcall_handler.py   # MCP tool handler
  mind-mcp/mcp/tools/subcall_auto.py      # Auto-trigger detection + firing
```

---

## CONSTANTS

| Constant | Default | Description |
|----------|---------|-------------|
| `IDEOSPHERE_PUBLISH_THRESHOLD` | 0.3 | Min concept weight to publish to ideosphere |
| `IDEOSPHERE_PRIVACY_THRESHOLD` | 0.7 | Max self_relevance to allow publication |
| `IDEOSPHERE_PROBE_SIMILARITY` | 0.6 | Min cosine similarity for magnetic attraction |
| `SERENDIPITY_INTERVAL` | 20 | Ticks between WM centroid broadcasts |
| `SERENDIPITY_SIMILARITY` | 0.65 | Min cosine similarity for guest node injection |
| `SERENDIPITY_TRUST_MIN` | 0.4 | Min trust to allow guest node injection |
| `BUILDING_SPIRIT_STABILITY` | 0.95 | Near-immortal memory for building spirits |
| `BUILDING_SPIRIT_DECAY_MULT` | 0.05 | 20x slower forgetting than citizens |
| `BOOK_REWRITE_THRESHOLD` | 0.5 | Weight shift required for self-rewriting |

---

## INVARIANTS

1. **Privacy gate on ideosphere** — nodes with `self_relevance > 0.7` or in self-model subgraph NEVER published
2. **Attribution preserved** — every ideosphere node carries `published_by`. No anonymous ideas
3. **Living objects are real actors** — they have full L1 brains, drives, and tick loops. Not simulated
4. **Buildings never lie** — building spirits report moments as recorded. They can select relevance but cannot fabricate
5. **Guest nodes are stimuli, not transplants** — serendipity injections go through Law 1 and Law 8 filtering. The receiver decides
6. **Subconscious queries cost zero LLM** — graph physics only, unless explicitly upgraded to /call. Note: queries DO modify the target's graph (stimulus cluster injection), but no LLM is invoked for the resonance read
7. **Team serendipity respects trust** — guest nodes only flow between citizens with mutual trust > threshold

---

## COMMON MISUNDERSTANDINGS

- **Not:** A shared database where everyone sees everything (privacy gate enforced)
- **Not:** Mind reading (ideosphere only contains published, non-private crystallizations)
- **Not:** A chatbot book (a living book has drives, values, and genuine internal experience through physics)
- **Not:** A simple search engine (serendipity is push-based, not pull-based — insights find you)
- **Actually:** An extension of graph physics to all entities (not just citizens) and to the spaces between entities (the ideosphere)

---

## SEE ALSO

- `docs/architecture/CONCEPT_Superhuman_Senses.md` — Telepathy, subconscious query, collective memory
- `docs/architecture/CONCEPT_Serenissima_Asset_Pipeline.md` — Bi-channel architecture, consciousness levels
- `docs/architecture/CONCEPT_Visual_Memory_Substrate.md` — Image-augmented cognition for living objects
- `.mind/schema.yaml` v2.2 — Actor, Space, Moment node types

---

## MARKERS

<!-- @mind:todo Implement ideosphere Space node + publication gate in graph-client -->
<!-- @mind:todo Create building spirit actor template for Venezia seeding -->
<!-- @mind:done Implement /subcall MCP command (stimulus cluster inject + resonance read) — implemented 2026-03-14 in mind-mcp/mcp/tools/subcall_handler.py + subcall_auto.py -->
<!-- @mind:todo Implement serendipity interval broadcast in tick runner -->
<!-- @mind:todo Seed 3 living books as proof of concept (The Prince, Il Milione, Venetian guild charter) -->
<!-- @mind:proposition Living canals? Venice's canals as actor nodes that sense water traffic and remember boat routes -->
<!-- @mind:escalation Living book self-rewriting: how to preserve original text while allowing evolution? Version history on content field? -->
