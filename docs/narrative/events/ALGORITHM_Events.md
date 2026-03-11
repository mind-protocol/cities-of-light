# ALGORITHM: narrative/events -- How It Works

Pseudocode for every procedure in the events module. Event generation from Moment flips, event descriptor structure, 3D effect mapping, news propagation through the social graph, Forestiere news pipeline, event lifecycle state machine, concurrent event management, and the master event tick. Every procedure is implementable from this document alone.

---

## E1. Event Generation Pipeline

When a Moment flips in the physics tick, the events module takes ownership. The flip is raw physics. The event is what the world sees.

### Moment Flip to Event Classification

```
FUNCTION generate_event_from_flip(moment, graph_name):
  # Receives a flipped Moment from phase_flip().
  # Classifies, builds descriptor, and enters lifecycle.

  # ── STEP 1: Classify ───────────────────────────────────
  # Classification is determined by the Moment's category property
  # (set during seeding or by the Narrator agent). The category
  # directly maps to a response template.

  category = moment.category
  severity = moment.severity

  # Validate category
  VALID_CATEGORIES = [
    "economic_crisis",
    "political_uprising",
    "celebration",
    "personal_tragedy",
    "guild_dispute",
    "trade_disruption",
  ]
  IF category NOT in VALID_CATEGORIES:
    category = classify_from_context(moment, graph_name)

  # ── STEP 2: Determine affected area ────────────────────
  district = get_moment_district(graph_name, moment.id)
  location = get_district_center(graph_name, district)
  radius = compute_event_radius(severity)

  # ── STEP 3: Determine affected citizens ────────────────
  affected = get_citizens_in_radius(graph_name, location, radius)
  witnesses = get_moment_witnesses(graph_name, moment.id)

  # ── STEP 4: Build event descriptor ─────────────────────
  descriptor = build_event_descriptor(
    moment_id:  moment.id,
    category:   category,
    severity:   severity,
    district:   district,
    location:   location,
    radius:     radius,
    affected:   affected,
    witnesses:  witnesses,
    description: moment.description,
  )

  # ── STEP 5: Register in event manager ──────────────────
  event_id = descriptor.event_id
  register_event(event_id, descriptor)

  # ── STEP 6: Initialize lifecycle ───────────────────────
  initialize_lifecycle(event_id, severity)

  # ── STEP 7: Start news propagation ─────────────────────
  start_propagation(event_id, witnesses, graph_name)

  RETURN descriptor


FUNCTION classify_from_context(moment, graph_name):
  # Fallback classification when Moment has no category or an
  # unrecognized one. Infers category from feeding narratives.

  feeding_types = graph.query("""
    MATCH (n:Narrative)-[:FEEDS]->(m:Moment {id: $mid})
    RETURN collect(DISTINCT n.type) AS types
  """, {mid: moment.id})

  types = feeding_types[0].types IF feeding_types ELSE []

  # Heuristic mapping
  IF "debt" in types AND "grievance" in types:
    RETURN "economic_crisis"
  IF "grudge" in types AND "grievance" in types:
    RETURN "political_uprising"
  IF "alliance" in types:
    RETURN "celebration"
  IF "grudge" in types AND len(types) == 1:
    RETURN "personal_tragedy"
  IF "belief" in types AND "alliance" in types:
    RETURN "guild_dispute"
  IF "forestiere_news" in types:
    RETURN "trade_disruption"

  # Default
  RETURN "economic_crisis"
```

---

## E2. Event Descriptor Structure

The event descriptor is the contract between the events module and all consuming modules. Each consumer reads only the fields it needs.

```
STRUCTURE EventDescriptor:
  # ── Identity ────────────────────────────────────────────
  event_id:          STRING     # Unique: "evt_{moment_id}_{tick}"
  moment_id:         STRING     # Source Moment that flipped
  category:          STRING     # One of 6 valid categories
  description:       STRING     # Human-readable event description

  # ── Spatial ─────────────────────────────────────────────
  severity:          FLOAT      # [0.0, 1.0] computed from salience/threshold ratio
  district:          STRING     # Primary affected district
  location:          {          # 3D world coordinates of event center
    x: FLOAT,
    z: FLOAT,
  }
  radius:            INTEGER    # Effect radius in world units

  # ── Population ──────────────────────────────────────────
  affected_citizens: [STRING]   # List of character IDs in radius
  witnesses:         [STRING]   # List of character IDs with WITNESS edges

  # ── Atmosphere (consumed by atmosphere module) ──────────
  atmosphere: {
    fog_delta:            FLOAT   # Change in fog density [-0.05, +0.05]
    light_delta:          FLOAT   # Change in light intensity [-0.20, +0.20]
    particle_rate_delta:  FLOAT   # Change in particle count [-10, +20]
    ambient_volume_delta: FLOAT   # Change in ambient volume [-0.3, +0.3]
  }

  # ── Citizen Behavior (consumed by citizen manager) ──────
  citizen_behavior: {
    gather_point:              STRING OR NULL  # Where citizens converge
    posture_override:          STRING OR NULL  # Body language override
    movement_speed_multiplier: FLOAT           # 1.0 = normal, 0.5 = slow, 1.3 = hurried
    conversation_topic_inject: STRING OR NULL  # Forced topic for affected citizens
  }

  # ── Audio (consumed by spatial audio system) ────────────
  audio: {
    ambient_layer:   STRING OR NULL  # Audio layer to activate
    spatial_sources: [{              # Positioned audio sources
      type:     STRING,              # Sound type identifier
      position: [FLOAT, FLOAT, FLOAT],  # 3D position
      volume:   FLOAT,              # [0.0, 1.0]
    }]
  }

  # ── Lifecycle ───────────────────────────────────────────
  duration_minutes:  INTEGER     # Total event duration (-1 = indefinite)
  created_at:        STRING      # ISO timestamp
  lifecycle_phase:   STRING      # Current phase: emerging | active | settling | aftermath | resolved
  phase_started_at:  STRING      # When current phase began

  # ── Propagation State ───────────────────────────────────
  propagation: {
    aware_citizens:    {STRING: FLOAT}  # citizen_id -> confidence
    propagation_front: [STRING]         # Citizens who will propagate next tick
    hops_completed:    INTEGER          # How many propagation hops have occurred
  }
```

---

## E3. 3D Effect Mapping

Complete mapping from event type and severity to atmosphere, citizen behavior, and audio changes. Each category has a parametric template scaled by severity.

### Effect Template Table

```
CONSTANT EFFECT_TEMPLATES:

  "economic_crisis": {
    atmosphere: {
      fog_delta:           FUNCTION(s) -> +0.03 * s,
      light_delta:         FUNCTION(s) -> -0.15 * s,
      particle_rate_delta: FUNCTION(s) -> +10 * s,
      ambient_volume_delta: FUNCTION(s) -> -0.2 * s,
    },
    citizen_behavior: {
      gather_point:     NULL,
      posture_override: "worried",
      movement_speed:   FUNCTION(s) -> 1.0 - 0.4 * s,
      topic:            "The market is failing. I have seen nothing like it.",
    },
    audio: {
      ambient_layer:  "market_distress",
      sources: [
        { type: "argument", offset: [0, 0, 0], volume: FUNCTION(s) -> 0.5 * s },
        { type: "worried_murmur", offset: [-10, 0, 5], volume: FUNCTION(s) -> 0.3 * s },
      ],
    },
  },

  "political_uprising": {
    atmosphere: {
      fog_delta:           FUNCTION(s) -> +0.02 * s,
      light_delta:         FUNCTION(s) -> -0.10 * s,
      particle_rate_delta: FUNCTION(s) -> +20 * s,
      ambient_volume_delta: FUNCTION(s) -> +0.3 * s,
    },
    citizen_behavior: {
      gather_point:     "district_center",
      posture_override: "agitated",
      movement_speed:   FUNCTION(s) -> 1.0 + 0.3 * s,
      topic:            "Something must change. This cannot continue.",
    },
    audio: {
      ambient_layer:  "crowd_unrest",
      sources: [
        { type: "chanting", offset: [0, 0, 0], volume: FUNCTION(s) -> 0.8 * s },
        { type: "shouting", offset: [10, 0, 0], volume: FUNCTION(s) -> 0.6 * s },
        { type: "stamping", offset: [-5, 0, -5], volume: FUNCTION(s) -> 0.4 * s },
      ],
    },
  },

  "celebration": {
    atmosphere: {
      fog_delta:           FUNCTION(s) -> -0.03 * s,
      light_delta:         FUNCTION(s) -> +0.20 * s,
      particle_rate_delta: FUNCTION(s) -> +15 * s,
      ambient_volume_delta: FUNCTION(s) -> +0.3 * s,
    },
    citizen_behavior: {
      gather_point:     "district_center",
      posture_override: "celebratory",
      movement_speed:   FUNCTION(s) -> 1.0 - 0.2 * s,
      topic:            "What a day! Even strangers are welcome tonight.",
    },
    audio: {
      ambient_layer:  "festival",
      sources: [
        { type: "music", offset: [0, 0, 0], volume: FUNCTION(s) -> 0.7 * s },
        { type: "laughter", offset: [-5, 0, 5], volume: FUNCTION(s) -> 0.5 * s },
        { type: "glasses_clinking", offset: [5, 0, -3], volume: FUNCTION(s) -> 0.3 * s },
      ],
    },
  },

  "personal_tragedy": {
    atmosphere: {
      fog_delta:           FUNCTION(s) -> +0.01 * s,
      light_delta:         FUNCTION(s) -> -0.05 * s,
      particle_rate_delta: FUNCTION(s) -> 0,
      ambient_volume_delta: FUNCTION(s) -> -0.3 * s,
    },
    citizen_behavior: {
      gather_point:     NULL,
      posture_override: "solemn",
      movement_speed:   FUNCTION(s) -> 1.0 - 0.5 * s,
      topic:            "Something terrible happened. I cannot speak of it.",
    },
    audio: {
      ambient_layer:  "silence",
      sources: [],
    },
  },

  "guild_dispute": {
    atmosphere: {
      fog_delta:           FUNCTION(s) -> +0.01 * s,
      light_delta:         FUNCTION(s) -> -0.05 * s,
      particle_rate_delta: FUNCTION(s) -> +5 * s,
      ambient_volume_delta: FUNCTION(s) -> -0.1 * s,
    },
    citizen_behavior: {
      gather_point:     "guild_hall",
      posture_override: "tense",
      movement_speed:   FUNCTION(s) -> 1.0 - 0.3 * s,
      topic:            "The guild is tearing itself apart.",
    },
    audio: {
      ambient_layer:  "argument",
      sources: [
        { type: "heated_debate", offset: [0, 0, 0], volume: FUNCTION(s) -> 0.6 * s },
      ],
    },
  },

  "trade_disruption": {
    atmosphere: {
      fog_delta:           FUNCTION(s) -> +0.02 * s,
      light_delta:         FUNCTION(s) -> -0.10 * s,
      particle_rate_delta: FUNCTION(s) -> +5 * s,
      ambient_volume_delta: FUNCTION(s) -> -0.15 * s,
    },
    citizen_behavior: {
      gather_point:     NULL,
      posture_override: "idle",
      movement_speed:   FUNCTION(s) -> 1.0 - 0.5 * s,
      topic:            "No ships for three days. Some say pirates. Some say politics.",
    },
    audio: {
      ambient_layer:  "harbor_quiet",
      sources: [],
    },
  },
```

### Effect Application

```
FUNCTION apply_event_effects(event_id, intensity_multiplier = 1.0):
  # Reads the event descriptor and applies effects to the 3D world.
  # Called on each render cycle while event is active.
  # intensity_multiplier varies by lifecycle phase:
  #   EMERGING:  0.5
  #   ACTIVE:    1.0
  #   SETTLING:  lerp(1.0, 0.0, phase_progress)
  #   AFTERMATH: 0.0
  #   RESOLVED:  0.0

  event = get_event(event_id)
  IF event IS None OR intensity_multiplier == 0:
    RETURN

  # Scale all atmosphere deltas by intensity
  atmosphere_update = {
    fog_delta:            event.atmosphere.fog_delta * intensity_multiplier,
    light_delta:          event.atmosphere.light_delta * intensity_multiplier,
    particle_rate_delta:  event.atmosphere.particle_rate_delta * intensity_multiplier,
    ambient_volume_delta: event.atmosphere.ambient_volume_delta * intensity_multiplier,
  }

  # Apply atmosphere changes to the affected district
  atmosphere_module.apply_delta(event.district, atmosphere_update)

  # Apply citizen behavior changes
  IF intensity_multiplier > 0.3:  # Only apply behavior during EMERGING and ACTIVE
    FOR citizen_id in event.affected_citizens:
      citizen_manager.apply_behavior_override(citizen_id, {
        posture:       event.citizen_behavior.posture_override,
        speed:         event.citizen_behavior.movement_speed_multiplier,
        gather_target: event.citizen_behavior.gather_point,
      })

      # Inject conversation topic for affected citizens
      IF event.citizen_behavior.conversation_topic_inject IS NOT None:
        citizen_manager.inject_topic(
          citizen_id,
          event.citizen_behavior.conversation_topic_inject,
          priority = event.severity,
        )

  # Apply audio changes
  IF intensity_multiplier > 0.1:
    audio_module.set_ambient_layer(event.district, event.audio.ambient_layer, intensity_multiplier)
    FOR source in event.audio.spatial_sources:
      audio_module.set_spatial_source(
        source.type,
        position = [
          event.location.x + source.position[0],
          source.position[1],
          event.location.z + source.position[2],
        ],
        volume = source.volume * intensity_multiplier,
      )
```

---

## E4. News Propagation Algorithm

News travels through the social graph at realistic speed. A citizen in Cannaregio does not instantly know about a crisis in Rialto. Information moves hop by hop, constrained by trust and geography.

### BFS Propagation Engine

```
FUNCTION start_propagation(event_id, witnesses, graph_name):
  # Initialize the propagation state for a new event.
  # Witnesses are the seed nodes of the BFS.

  state = PropagationState {
    event_id:       event_id,
    aware_citizens: {},
    propagation_queue: [],
    hops_completed: 0,
    started_at:     now(),
  }

  # Seed: witnesses know immediately at confidence 1.0
  FOR witness_id in witnesses:
    state.aware_citizens[witness_id] = {
      confidence: 1.0,
      source:     "witness",
      learned_at: now(),
      hop:        0,
    }

  # Initialize first propagation front:
  # All citizens in the same district who trust a witness
  FOR witness_id in witnesses:
    neighbors = get_citizen_trust_network(witness_id, min_trust = 50)
    witness_district = get_citizen_district(graph_name, witness_id)

    FOR neighbor in neighbors:
      IF neighbor.citizen_id NOT in state.aware_citizens:
        IF neighbor.district == witness_district:
          # Same district: propagate in next cycle (15 minutes)
          state.propagation_queue.append({
            citizen_id: neighbor.citizen_id,
            source_id:  witness_id,
            trust:      neighbor.trust,
            hop:        1,
            scheduled_tick: current_tick + 1,  # 5 minutes
          })

  save_propagation_state(event_id, state)


FUNCTION propagation_tick(event_id, current_tick, graph_name):
  # Called every event_tick (every 5 minutes, aligned with physics tick).
  # Processes the propagation queue and advances the BFS.

  state = load_propagation_state(event_id)
  IF state IS None:
    RETURN

  event = get_event(event_id)
  newly_aware = []

  # Process queue entries scheduled for this tick or earlier
  ready = [q for q in state.propagation_queue if q.scheduled_tick <= current_tick]
  remaining = [q for q in state.propagation_queue if q.scheduled_tick > current_tick]
  state.propagation_queue = remaining

  FOR entry in ready:
    citizen_id = entry.citizen_id

    # Skip if already aware
    IF citizen_id in state.aware_citizens:
      CONTINUE

    # Confidence degrades with each hop
    HOP_CONFIDENCE_DECAY = {
      0: 1.0,    # Witness: total confidence
      1: 0.8,    # Same district, trusted source
      2: 0.6,    # Adjacent district
      3: 0.4,    # Two districts away
      4: 0.3,    # City-wide (heard it third-hand)
    }
    hop = entry.hop
    base_confidence = HOP_CONFIDENCE_DECAY.get(hop, 0.2)

    # Trust factor: higher trust = more confidence
    trust_factor = entry.trust / 100.0
    confidence = base_confidence * trust_factor

    # Minimum confidence to count as "aware"
    IF confidence < 0.1:
      CONTINUE

    # Citizen becomes aware
    state.aware_citizens[citizen_id] = {
      confidence: confidence,
      source:     "hearsay",
      source_id:  entry.source_id,
      learned_at: now(),
      hop:        hop,
    }
    newly_aware.append(citizen_id)

    # Create BELIEVES edge for the event narrative
    # (The event description becomes a narrative in the graph)
    event_narrative_id = "narr_event_" + event.event_id
    ensure_event_narrative_exists(event_narrative_id, event, graph_name)

    graph.query("""
      MATCH (c:Character {id: $cid}), (n:Narrative {id: $nid})
      MERGE (c)-[:BELIEVES {
        confidence: $conf,
        source: 'hearsay',
        heard_at: $now
      }]->(n)
    """, {
      cid: citizen_id,
      nid: event_narrative_id,
      conf: confidence,
      now: iso_now(),
    })

  # Advance BFS: newly aware citizens propagate to their networks
  FOR citizen_id in newly_aware:
    citizen_hop = state.aware_citizens[citizen_id].hop
    citizen_district = get_citizen_district(graph_name, citizen_id)
    neighbors = get_citizen_trust_network(citizen_id, min_trust = 20)

    FOR neighbor in neighbors:
      IF neighbor.citizen_id in state.aware_citizens:
        CONTINUE  # Already knows

      # Determine delay based on geographic distance
      IF neighbor.district == citizen_district:
        delay_ticks = 1                     # Same district: 5 minutes
      ELSE IF districts_adjacent(citizen_district, neighbor.district):
        delay_ticks = 4                     # Adjacent: ~20 minutes
      ELSE:
        delay_ticks = 12                    # Distant: ~1 hour

      state.propagation_queue.append({
        citizen_id: neighbor.citizen_id,
        source_id:  citizen_id,
        trust:      neighbor.trust,
        hop:        citizen_hop + 1,
        scheduled_tick: current_tick + delay_ticks,
      })

  # Update hop count
  IF newly_aware:
    state.hops_completed = max(
      state.hops_completed,
      max(state.aware_citizens[c].hop for c in newly_aware)
    )

  save_propagation_state(event_id, state)

  RETURN {
    newly_aware: len(newly_aware),
    total_aware: len(state.aware_citizens),
    queue_size:  len(state.propagation_queue),
    hops:        state.hops_completed,
  }


FUNCTION ensure_event_narrative_exists(narrative_id, event, graph_name):
  # Create a Narrative node representing the event if it does not exist.
  # This is the narrative that citizens "believe" when they hear about the event.

  existing = graph.query("""
    MATCH (n:Narrative {id: $nid})
    RETURN n.id
  """, {nid: narrative_id})

  IF existing IS NOT EMPTY:
    RETURN

  graph.query("""
    CREATE (n:Narrative {
      id:      $nid,
      content: $content,
      truth:   1.0,
      energy:  0.5,
      weight:  1.0,
      type:    'event_aftermath',
      source:  'event'
    })
  """, {nid: narrative_id, content: event.description})


FUNCTION districts_adjacent(district_a, district_b):
  # Venice district adjacency map (simplified)
  ADJACENCY = {
    "San_Marco":   ["Rialto", "Dorsoduro", "Castello"],
    "Rialto":      ["San_Marco", "Cannaregio", "San_Polo"],
    "Dorsoduro":   ["San_Marco", "San_Polo", "Giudecca"],
    "Cannaregio":  ["Rialto", "Castello"],
    "Castello":    ["San_Marco", "Cannaregio"],
    "San_Polo":    ["Rialto", "Dorsoduro", "Santa_Croce"],
    "Santa_Croce": ["San_Polo", "Cannaregio"],
    "Giudecca":    ["Dorsoduro"],
  }

  RETURN district_b in ADJACENCY.get(district_a, [])
```

---

## E5. Forestiere News Pipeline

Venice is not narratively isolated. Ships arrive with news from Constantinople, Genoa, the Holy Land. Real-world RSS feeds are translated to 15th century context and injected as new narratives.

### RSS Fetch and Translation

```
FUNCTION forestiere_news_tick(graph_name = "venezia"):
  # Called once per 24 hours (daily cycle).
  # Fetches RSS, translates, injects one news item into the graph.

  MAX_NEWS_PER_DAY = 1

  # ── STEP 1: Check if news was already injected today ───
  last_injection = load_json("state/forestiere_last_injection.json")
  IF last_injection IS NOT None:
    IF date(last_injection.timestamp) == date(now()):
      RETURN None  # Already injected today

  # ── STEP 2: Fetch RSS headlines ────────────────────────
  configured_feeds = [
    "https://feeds.reuters.com/reuters/worldNews",
    "https://feeds.reuters.com/reuters/businessNews",
    "https://feeds.bbci.co.uk/news/world/rss.xml",
  ]

  headlines = []
  FOR feed_url in configured_feeds:
    feed = fetch_rss(feed_url)
    FOR entry in feed.entries[:5]:  # Top 5 per feed
      headlines.append({
        title: entry.title,
        summary: entry.summary[:200],
        source: feed_url,
      })

  IF headlines IS EMPTY:
    RETURN None

  # ── STEP 3: Select and translate ───────────────────────
  # Pick the most narratively interesting headline
  selected = select_most_translatable(headlines)

  translation_prompt = f"""
    Translate this modern news headline into a plausible event that
    a 15th century Venetian merchant arriving by ship might report.

    Modern headline: "{selected.title}"
    Summary: "{selected.summary}"

    Rules:
    - Use the language and concerns of 15th century Venice.
    - Reference real places of the era: Constantinople, Genoa,
      the Levant, the Silk Road, the Holy Land, Egypt, Flanders.
    - Do not mention anything that could not exist in 1450.
    - Keep it to one sentence.
    - It should feel like something overheard at the docks.

    Output only the translated sentence.
  """

  translated = claude_api.call(
    model:       "claude-sonnet-4-20250514",
    messages:    [{ role: "user", content: translation_prompt }],
    max_tokens:  100,
    temperature: 0.8,
  )

  translated_text = translated.content.strip()

  # ── STEP 4: Inject into graph ──────────────────────────
  narr_id = "narr_forestiere_" + slugify(date_str(now())) + "_" + str(hash(translated_text) % 10000)

  graph.query("""
    CREATE (n:Narrative {
      id:      $nid,
      content: $content,
      truth:   0.5,
      energy:  0.5,
      weight:  0.5,
      type:    'forestiere_news',
      source:  'forestiere'
    })
  """, {nid: narr_id, content: translated_text})

  # ── STEP 5: Select a Forestiere carrier ────────────────
  # A randomly selected Forestiere citizen "arrives" with this news
  forestieri = graph.query("""
    MATCH (c:Character {class: 'Forestieri'})
    RETURN c.id AS id, c.name AS name
  """)

  IF forestieri IS EMPTY:
    # No Forestieri citizens. Assign to a dock worker instead.
    carrier = graph.query("""
      MATCH (c:Character)-[:AT]->(p:Place)
      WHERE p.name CONTAINS 'dock' OR p.name CONTAINS 'port'
      RETURN c.id AS id, c.name AS name
      LIMIT 1
    """)
    IF carrier IS EMPTY:
      # Last resort: any citizen
      carrier = graph.query("MATCH (c:Character) RETURN c.id AS id LIMIT 1")
    carrier_id = carrier[0].id
  ELSE:
    carrier_id = random.choice(forestieri).id

  # Carrier believes the news at full confidence
  graph.query("""
    MATCH (c:Character {id: $cid}), (n:Narrative {id: $nid})
    CREATE (c)-[:BELIEVES {
      confidence: 0.9,
      source: 'personal',
      heard_at: $now
    }]->(n)
  """, {cid: carrier_id, nid: narr_id, now: iso_now()})

  # Place carrier at the docks
  dock_place = graph.query("""
    MATCH (p:Place)
    WHERE p.name CONTAINS 'dock' OR p.name CONTAINS 'port'
    RETURN p.id AS id
    LIMIT 1
  """)
  IF dock_place IS NOT EMPTY:
    graph.query("""
      MATCH (c:Character {id: $cid}), (p:Place {id: $pid})
      MERGE (c)-[:AT {since: $now}]->(p)
    """, {cid: carrier_id, pid: dock_place[0].id, now: iso_now()})

  # ── STEP 6: Start propagation from the docks ──────────
  # News propagates through the social graph like any event,
  # but seeded from a single citizen instead of witnesses.

  propagation_state = PropagationState {
    event_id:       "news_" + narr_id,
    aware_citizens: {
      carrier_id: {
        confidence: 0.9,
        source: "personal",
        learned_at: now(),
        hop: 0,
      }
    },
    propagation_queue: [],
    hops_completed: 0,
    started_at: now(),
  }

  # Seed propagation from carrier's network
  neighbors = get_citizen_trust_network(carrier_id, min_trust = 20)
  FOR neighbor in neighbors:
    propagation_state.propagation_queue.append({
      citizen_id: neighbor.citizen_id,
      source_id:  carrier_id,
      trust:      neighbor.trust,
      hop:        1,
      scheduled_tick: current_tick + 3,  # 15 minutes (news spreads slower)
    })

  save_propagation_state("news_" + narr_id, propagation_state)

  # Record injection
  save_json("state/forestiere_last_injection.json", {
    timestamp: iso_now(),
    narrative_id: narr_id,
    content: translated_text,
    original_headline: selected.title,
    carrier: carrier_id,
  })

  RETURN {
    narrative_id: narr_id,
    content: translated_text,
    carrier: carrier_id,
    original: selected.title,
  }


FUNCTION select_most_translatable(headlines):
  # Score headlines by how well they translate to 15th century context.
  # Prefer: geopolitics, trade, conflict, disease, weather.
  # Avoid: technology, entertainment, sports.

  HIGH_SCORE_KEYWORDS = [
    "trade", "sanctions", "war", "conflict", "embargo",
    "economy", "crisis", "alliance", "treaty", "famine",
    "plague", "storm", "shipwreck", "piracy", "rebellion",
    "election", "overthrow", "tax", "tariff", "debt",
  ]

  LOW_SCORE_KEYWORDS = [
    "tech", "software", "AI", "app", "social media",
    "film", "movie", "celebrity", "sport", "game",
    "vaccine", "satellite", "internet", "crypto",
  ]

  scored = []
  FOR headline in headlines:
    text = headline.title.lower() + " " + headline.summary.lower()
    score = 0
    FOR keyword in HIGH_SCORE_KEYWORDS:
      IF keyword in text:
        score += 1
    FOR keyword in LOW_SCORE_KEYWORDS:
      IF keyword in text:
        score -= 2
    scored.append((headline, score))

  scored.sort(key=lambda x: x[1], reverse=True)
  RETURN scored[0][0]  # Return highest-scoring headline
```

---

## E6. Event Lifecycle State Machine

Events have five phases. Transitions are time-based, driven by the event tick.

### State Definitions

```
STATES:

  EMERGING    (0 to 5 minutes):
    Effects at 50% intensity.
    Only witnesses and nearby citizens are reacting.
    The visitor senses something starting but cannot yet identify it.
    Atmospheric changes are subtle.
    Propagation has not yet begun beyond witnesses.

  ACTIVE      (5 minutes to 1-6 hours):
    Full intensity. All effects applied at 100%.
    All affected citizens have behavior overrides.
    Atmospheric changes are complete.
    Propagation is actively spreading through the social graph.
    Narrator agent has generated consequences.
    Citizens reference the event in conversation.

  SETTLING    (1-6 hours):
    Effects fade linearly from 100% to 0% over the phase duration.
    Citizens begin returning to normal behavior.
    Conversation references persist but are no longer dominant.
    Atmospheric changes gradually revert.
    Audio sources fade.

  AFTERMATH   (6-24 hours):
    No atmospheric effects. No audio changes.
    Citizens still discuss the event in conversation.
    BELIEVES edges to the event narrative persist.
    New tensions born from the event are active in the graph.
    Visible scars remain (closed stalls, boarded windows).
    The economic simulation may or may not have restored normal state.

  RESOLVED    (24+ hours):
    Event fully absorbed into narrative state.
    Exists only as citizen memories (BELIEVES edges) and
    graph consequences (new Narratives, new Tensions, new Moments).
    No visual, audio, or behavioral effects.
    Event record archived but not deleted.
```

### Transition Logic

```
FUNCTION advance_lifecycle(event_id, current_tick):
  event = get_event(event_id)
  IF event IS None:
    RETURN

  phase = event.lifecycle_phase
  phase_age_minutes = minutes_since(event.phase_started_at)
  severity = event.severity

  # Compute phase durations based on severity
  phase_durations = compute_phase_durations(severity)

  # ── EMERGING -> ACTIVE ──────────────────────────────────
  IF phase == "emerging":
    IF phase_age_minutes >= phase_durations.emerging:
      transition_to(event_id, "active")

  # ── ACTIVE -> SETTLING ──────────────────────────────────
  ELSE IF phase == "active":
    IF phase_age_minutes >= phase_durations.active:
      transition_to(event_id, "settling")

  # ── SETTLING -> AFTERMATH ───────────────────────────────
  ELSE IF phase == "settling":
    IF phase_age_minutes >= phase_durations.settling:
      transition_to(event_id, "aftermath")
      # Remove all atmospheric and audio effects
      remove_event_effects(event_id)
      # Remove citizen behavior overrides
      FOR citizen_id in event.affected_citizens:
        citizen_manager.remove_behavior_override(citizen_id)

  # ── AFTERMATH -> RESOLVED ───────────────────────────────
  ELSE IF phase == "aftermath":
    IF phase_age_minutes >= phase_durations.aftermath:
      transition_to(event_id, "resolved")
      # Archive event. Free the concurrent event slot.
      archive_event(event_id)


FUNCTION compute_phase_durations(severity):
  # Duration in minutes for each phase, scaled by severity.
  #
  # MINOR (0.0-0.3):   5 / 30 / 30 / 360 / resolved
  # NOTABLE (0.3-0.6): 5 / 60 / 180 / 720 / resolved
  # MAJOR (0.6-0.9):   5 / 360 / 360 / 1440 / resolved
  # CRISIS (0.9-1.0):  5 / indefinite / ... / ... / resolved

  RETURN {
    emerging:  5,                                     # Always 5 minutes
    active:    lerp(30, 360, severity),               # 30 min to 6 hours
    settling:  lerp(30, 360, severity),               # 30 min to 6 hours
    aftermath: lerp(360, 1440, severity),             # 6 hours to 24 hours
  }

  # Note: CRISIS events (severity >= 0.9) have indefinite active phase.
  # They transition to settling only when resolved by another event
  # or when the economic simulation restores normal conditions.


FUNCTION transition_to(event_id, new_phase):
  event = get_event(event_id)
  old_phase = event.lifecycle_phase

  event.lifecycle_phase = new_phase
  event.phase_started_at = iso_now()

  save_event(event_id, event)

  # Emit phase transition for consumers
  websocket.broadcast("event_phase_change", {
    event_id: event_id,
    old_phase: old_phase,
    new_phase: new_phase,
    severity: event.severity,
  })


FUNCTION get_lifecycle_intensity(event):
  # Returns the current effect intensity multiplier [0.0, 1.0]
  # based on lifecycle phase and progress within that phase.

  phase = event.lifecycle_phase
  phase_age = minutes_since(event.phase_started_at)
  durations = compute_phase_durations(event.severity)

  IF phase == "emerging":
    RETURN 0.5   # Constant 50% during emergence

  IF phase == "active":
    RETURN 1.0   # Full intensity

  IF phase == "settling":
    # Linear fade from 1.0 to 0.0
    progress = clamp(phase_age / durations.settling, 0.0, 1.0)
    RETURN 1.0 - progress

  IF phase == "aftermath":
    RETURN 0.0   # No effects

  IF phase == "resolved":
    RETURN 0.0

  RETURN 0.0
```

---

## E7. Concurrent Event Management

At most 3 events can be active simultaneously. A priority queue manages slots.

```
STRUCTURE EventSlot:
  event_id:  STRING
  severity:  FLOAT
  category:  STRING
  district:  STRING
  phase:     STRING
  started_at: STRING


FUNCTION get_active_events():
  # Returns all events in EMERGING or ACTIVE phase.
  # Maximum 3.

  all_events = load_all_events()
  active = [e for e in all_events
            if e.lifecycle_phase in ["emerging", "active"]]

  # Sort by severity descending
  active.sort(key=lambda e: e.severity, reverse=True)

  RETURN active


FUNCTION can_accept_event(new_severity):
  # Checks if a new event can be accepted.
  # Returns: (can_accept, preempt_event_id or None)

  active = get_active_events()

  IF len(active) < MAX_CONCURRENT_ACTIVE_MOMENTS:
    RETURN (TRUE, None)

  # Find weakest active event
  weakest = min(active, key=lambda e: e.severity)

  IF new_severity > weakest.severity:
    RETURN (TRUE, weakest.event_id)  # Can preempt
  ELSE:
    RETURN (FALSE, None)  # Suppressed


FUNCTION preempt_event(event_id):
  # Immediately end an active event to make room for a higher-severity one.
  # The preempted event skips directly to SETTLING.

  event = get_event(event_id)

  # Force transition to settling
  transition_to(event_id, "settling")

  # Emit preemption notice
  websocket.broadcast("event_preempted", {
    event_id: event_id,
    category: event.category,
    severity: event.severity,
    reason: "preempted_by_higher_severity",
  })


FUNCTION register_event(event_id, descriptor):
  # Registers a new event. Handles slot management.

  can_accept, preempt_id = can_accept_event(descriptor.severity)

  IF NOT can_accept:
    # Event is suppressed. Moment is still flipped but effects are delayed.
    descriptor.lifecycle_phase = "suppressed"
    save_event(event_id, descriptor)
    add_to_suppressed_queue(event_id, descriptor.severity)
    RETURN

  IF preempt_id IS NOT None:
    preempt_event(preempt_id)

  descriptor.lifecycle_phase = "emerging"
  descriptor.phase_started_at = iso_now()
  save_event(event_id, descriptor)


FUNCTION check_suppressed_queue():
  # Called every event tick. Checks if a suppressed event
  # can now be activated (a slot has opened).

  active = get_active_events()
  IF len(active) >= MAX_CONCURRENT_ACTIVE_MOMENTS:
    RETURN

  suppressed = load_suppressed_queue()
  IF suppressed IS EMPTY:
    RETURN

  # Activate highest-severity suppressed event
  suppressed.sort(key=lambda e: e.severity, reverse=True)
  next_event = suppressed[0]

  # Check if still relevant (not too old)
  age_hours = hours_since(next_event.created_at)
  IF age_hours > 6:
    # Too old. Discard.
    remove_from_suppressed_queue(next_event.event_id)
    RETURN

  # Activate
  remove_from_suppressed_queue(next_event.event_id)
  event = get_event(next_event.event_id)
  event.lifecycle_phase = "emerging"
  event.phase_started_at = iso_now()
  save_event(next_event.event_id, event)
```

---

## E8. Master Event Tick: event_tick()

The event tick runs every 5 minutes, aligned with the physics tick. It manages all active events, advances lifecycles, processes propagation, and checks the suppressed queue.

```
FUNCTION event_tick(current_tick, graph_name = "venezia"):
  # Called by the main scheduler every 5 minutes, after physics_tick.

  result = EventTickResult {
    events_advanced:     0,
    events_resolved:     0,
    events_activated:    0,
    propagation_updates: [],
    forestiere_injected: FALSE,
  }

  # ── STEP 1: Advance lifecycle for all active events ────
  all_events = load_all_events()
  active_events = [e for e in all_events
                   if e.lifecycle_phase in ["emerging", "active", "settling", "aftermath"]]

  FOR event in active_events:
    old_phase = event.lifecycle_phase

    advance_lifecycle(event.event_id, current_tick)

    event = get_event(event.event_id)  # Reload after potential transition
    IF event.lifecycle_phase != old_phase:
      result.events_advanced += 1
    IF event.lifecycle_phase == "resolved":
      result.events_resolved += 1

  # ── STEP 2: Apply effects for active events ────────────
  FOR event in active_events:
    IF event.lifecycle_phase in ["emerging", "active", "settling"]:
      intensity = get_lifecycle_intensity(event)
      apply_event_effects(event.event_id, intensity)

  # ── STEP 3: Process news propagation ───────────────────
  propagation_states = load_all_propagation_states()

  FOR state in propagation_states:
    update = propagation_tick(state.event_id, current_tick, graph_name)
    IF update IS NOT None AND update.newly_aware > 0:
      result.propagation_updates.append(update)

    # Clean up completed propagations (all citizens aware or queue empty)
    IF update IS NOT None AND update.queue_size == 0:
      IF len(state.aware_citizens) > 150:  # Most of 186 citizens
        archive_propagation_state(state.event_id)

  # ── STEP 4: Check suppressed queue ─────────────────────
  activated = check_suppressed_queue()
  IF activated:
    result.events_activated += 1

  # ── STEP 5: Forestiere news (daily check) ──────────────
  # Only runs if 24 hours have passed since last injection
  news_result = forestiere_news_tick(graph_name)
  IF news_result IS NOT None:
    result.forestiere_injected = TRUE

  # ── STEP 6: Clean up resolved events ───────────────────
  FOR event in all_events:
    IF event.lifecycle_phase == "resolved":
      age_hours = hours_since(event.phase_started_at)
      IF age_hours > 48:
        # Fully resolved and aged out. Remove from active tracking.
        # Event consequences live on in the graph.
        delete_event_record(event.event_id)

  RETURN result
```

---

## E9. Visitor as Newsbearer

The visitor carries information faster than the social graph propagates it. When a visitor who witnessed an event speaks to a citizen who has not heard, the citizen reacts.

```
FUNCTION check_visitor_newsbearer(visitor_id, citizen_id, graph_name):
  # Called during conversation context assembly.
  # Checks if the visitor knows about events the citizen does not.
  # Returns news items to inject into conversation context.

  visitor_witnessed_events = get_visitor_witnessed_events(visitor_id)
  news_to_share = []

  FOR event in visitor_witnessed_events:
    # Check if citizen is aware of this event
    propagation_state = load_propagation_state(event.event_id)
    IF propagation_state IS None:
      CONTINUE

    IF citizen_id NOT in propagation_state.aware_citizens:
      # Citizen does not know. Visitor is a newsbearer.
      news_to_share.append({
        event_id:    event.event_id,
        description: event.description,
        category:    event.category,
        district:    event.district,
      })

      # When the visitor mentions the event in conversation,
      # the citizen becomes aware (confidence 0.7, source "forestiere")
      propagation_state.aware_citizens[citizen_id] = {
        confidence: 0.7,
        source:     "forestiere_visitor",
        learned_at: now(),
        hop:        1,  # Direct from witness equivalent
      }
      save_propagation_state(event.event_id, propagation_state)

  RETURN news_to_share
```

---

## E10. Constants Table

```
CONSTANT                          VALUE          NOTES
──────────────────────────────────────────────────────────────────────
MAX_CONCURRENT_ACTIVE_MOMENTS     3              Hard cap on simultaneous active events
COOLDOWN_TICKS                    3              Ticks after flip before same-district flip
HOP_CONFIDENCE_DECAY              {0:1.0, 1:0.8, 2:0.6, 3:0.4, 4:0.3}
PROPAGATION_DELAY_SAME_DISTRICT   1 tick         5 minutes
PROPAGATION_DELAY_ADJACENT        4 ticks        20 minutes
PROPAGATION_DELAY_DISTANT         12 ticks       1 hour
FORESTIERE_NEWS_PER_DAY           1              Maximum news injections per day
FORESTIERE_INITIAL_ENERGY         0.5            Starting energy for news narratives
FORESTIERE_CARRIER_CONFIDENCE     0.9            How strongly the carrier believes the news
SUPPRESSED_EVENT_MAX_AGE_HOURS    6              After this, suppressed events are discarded
RESOLVED_EVENT_RETENTION_HOURS    48             How long resolved events stay in tracking
EMERGING_INTENSITY                0.5            Effect intensity during EMERGING phase
ACTIVE_INTENSITY                  1.0            Effect intensity during ACTIVE phase
VISITOR_NEWSBEARER_CONFIDENCE     0.7            Confidence when visitor shares news
EVENT_NARRATIVE_INITIAL_ENERGY    0.5            Energy of narrative created for event
EVENT_NARRATIVE_INITIAL_WEIGHT    1.0            Weight of narrative created for event
SEVERITY_MINOR                    0.0 - 0.3     Local, brief, subtle
SEVERITY_NOTABLE                  0.3 - 0.6     District-wide, hours, noticeable
SEVERITY_MAJOR                    0.6 - 0.9     Multi-district, day, transformative
SEVERITY_CRISIS                   0.9 - 1.0     City-wide, indefinite, fundamental
```

---

## E11. Event Descriptor Lifecycle Summary

```
FLOW: moment_flip_to_resolution

  1. PHYSICS TICK detects salience > threshold
     -> flip_moment() sets flipped=true, consumes energy
     -> returns flipped moment to event module

  2. EVENT GENERATION
     -> classify event category from Moment properties
     -> determine affected area (district, radius, citizens)
     -> build EventDescriptor with atmosphere/behavior/audio templates
     -> register event in manager (check slot availability)

  3. LIFECYCLE: EMERGING (5 minutes)
     -> effects at 50% intensity
     -> witnesses create WITNESS edges
     -> propagation seeds from witnesses

  4. LIFECYCLE: ACTIVE (30 min - 6 hours)
     -> effects at 100% intensity
     -> narrator agent generates consequences (async)
     -> new narratives, tensions, moments created in graph
     -> propagation spreads through social graph (BFS)
     -> citizens reference event in conversation

  5. LIFECYCLE: SETTLING (30 min - 6 hours)
     -> effects fade linearly to 0%
     -> citizen behavior overrides gradually removed
     -> conversation references persist

  6. LIFECYCLE: AFTERMATH (6 - 24 hours)
     -> no atmospheric/audio effects
     -> citizens still discuss event
     -> new tensions from event are active
     -> visible scars persist (closed stalls, etc.)

  7. LIFECYCLE: RESOLVED (24+ hours)
     -> event absorbed into graph state
     -> exists only as BELIEVES edges and consequences
     -> event record archived after 48 hours
     -> slot freed for new events
```

---

## E12. Cross-Module Interfaces

```
EXPORTS TO 3D world (via WebSocket):
  "world_event"        -> EventDescriptor for immediate effects
  "event_phase_change" -> lifecycle transitions
  "event_preempted"    -> slot preemption notice
  "narrative_update"   -> citizen context cache refresh

EXPORTS TO citizens/mind:
  check_visitor_newsbearer() -> news items for conversation context
  event.citizen_behavior     -> conversation topic injection

EXPORTS TO narrative/graph:
  New Narrative nodes         (event aftermath, forestiere news)
  New BELIEVES edges          (propagation, witness)
  New TENSION edges           (from narrator consequences)
  New Moment nodes            (from narrator consequences)

IMPORTS FROM narrative/physics:
  phase_flip() output         -> flipped Moments trigger event generation
  current_tick                -> timing for lifecycle and propagation

IMPORTS FROM narrative/graph:
  get_citizen_trust_network() -> for BFS propagation
  get_moment_witnesses()      -> for seeding propagation
  get_citizens_in_radius()    -> for affected citizen list

IMPORTS FROM external:
  RSS feeds                   -> Forestiere news pipeline
  Claude API                  -> headline translation, narrator agent
```
