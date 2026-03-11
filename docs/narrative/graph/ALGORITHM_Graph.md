# ALGORITHM: narrative/graph -- How It Works

Pseudocode for every procedure in the graph module. FalkorDB schema creation, Airtable seeding pipeline, query functions, belief management, and graph maintenance. Nothing is hand-waved. Every function is implementable from this document alone.

---

## G1. FalkorDB Schema Definition

The Venice graph uses the `venezia` namespace within a shared FalkorDB instance. Schema creation is idempotent -- safe to run multiple times.

### Node Types

```
FUNCTION create_venezia_schema(graph_name = "venezia"):

  # ── NODE: Character ─────────────────────────────────────
  # Represents a citizen of Venice. Maps 1:1 to Airtable CITIZENS.
  # Energy and weight are physics properties. All other fields
  # are identity and query properties.

  graph.query("""
    CREATE INDEX FOR (c:Character) ON (c.id)
  """)

  graph.query("""
    CREATE INDEX FOR (c:Character) ON (c.name)
  """)

  graph.query("""
    CREATE INDEX FOR (c:Character) ON (c.district)
  """)

  # Character node properties:
  #   id:        STRING   unique identifier (e.g., "char_elena_rossi")
  #   name:      STRING   display name (e.g., "Elena Rossi")
  #   energy:    FLOAT    current narrative energy (physics)
  #   weight:    FLOAT    narrative importance (physics)
  #   class:     STRING   social class: Nobili | Cittadini | Popolani | Facchini | Forestieri
  #   mood:      STRING   current mood state (from citizen mind module)
  #   district:  STRING   home district (Rialto | Dorsoduro | Cannaregio | San_Marco | ...)
  #   ducats:    INTEGER  current wealth (snapshot from last economic sync)
  #   alive:     BOOLEAN  always TRUE for active citizens

  # ── NODE: Narrative ─────────────────────────────────────
  # A belief, rumor, grievance, or piece of information that
  # citizens can hold. The atomic unit of narrative state.

  graph.query("""
    CREATE INDEX FOR (n:Narrative) ON (n.id)
  """)

  graph.query("""
    CREATE INDEX FOR (n:Narrative) ON (n.type)
  """)

  # Narrative node properties:
  #   id:        STRING   unique identifier (e.g., "narr_tariff_grievance_042")
  #   content:   STRING   human-readable description of the belief
  #   truth:     FLOAT    objective truth value [0.0, 1.0] (not visible to citizens)
  #   energy:    FLOAT    current narrative energy (physics)
  #   weight:    FLOAT    narrative importance / permanence (physics)
  #   type:      STRING   grievance | rumor | belief | debt | alliance | grudge | oath |
  #                       forestiere_news | event_aftermath
  #   source:    STRING   origin: "seed" | "physics" | "narrator" | "forestiere" | "economy"

  # ── NODE: Place ─────────────────────────────────────────
  # A location in Venice. Districts, piazzas, docks, markets.

  graph.query("""
    CREATE INDEX FOR (p:Place) ON (p.id)
  """)

  graph.query("""
    CREATE INDEX FOR (p:Place) ON (p.district)
  """)

  # Place node properties:
  #   id:          STRING   unique identifier (e.g., "place_rialto_market")
  #   name:        STRING   display name (e.g., "Rialto Market")
  #   district:    STRING   which of the 7 Venice districts
  #   position_x:  FLOAT    3D world X coordinate
  #   position_z:  FLOAT    3D world Z coordinate

  # ── NODE: Moment ────────────────────────────────────────
  # A potential event. Accumulates energy from connected narratives.
  # When salience exceeds threshold, the Moment flips and becomes
  # an actual event. Flipped Moments are historical record.

  graph.query("""
    CREATE INDEX FOR (m:Moment) ON (m.id)
  """)

  graph.query("""
    CREATE INDEX FOR (m:Moment) ON (m.flipped)
  """)

  # Moment node properties:
  #   id:          STRING   unique identifier (e.g., "mom_rialto_market_crash")
  #   description: STRING   what the event would be if it happens
  #   threshold:   FLOAT    salience value required to flip [2.0, 5.0] for Venice
  #   flipped:     BOOLEAN  TRUE once the moment has become an event
  #   category:    STRING   economic_crisis | political_uprising | celebration |
  #                         personal_tragedy | guild_dispute | trade_disruption
  #   severity:    FLOAT    computed at flip time (salience / threshold)
  #   energy:      FLOAT    accumulated narrative energy (physics)
  #   weight:      FLOAT    narrative importance (physics)

  RETURN "Schema created for graph: " + graph_name
```

### Edge Types

```
FUNCTION create_venezia_edges(graph_name = "venezia"):

  # ── EDGE: BELIEVES ──────────────────────────────────────
  # Character -> Narrative
  # A citizen holds a belief. Confidence determines how strongly.
  # Source tracks how the citizen acquired the belief.

  # BELIEVES edge properties:
  #   confidence:  FLOAT    how strongly the citizen holds this belief [0.0, 1.0]
  #   source:      STRING   "personal" | "witness" | "hearsay" | "news" | "seed"
  #   heard_at:    STRING   ISO timestamp of when belief was acquired

  # ── EDGE: AT ────────────────────────────────────────────
  # Character -> Place
  # Where a citizen currently is. Updated by economy tick and
  # citizen movement system. One AT edge per character at a time.

  # AT edge properties:
  #   since:       STRING   ISO timestamp of arrival

  # ── EDGE: TENSION ───────────────────────────────────────
  # Narrative <-> Narrative (bidirectional)
  # Two narratives that contradict each other. Energy accumulates
  # on TENSION edges and feeds into Moments.

  # TENSION edge properties:
  #   strength:    FLOAT    accumulated tension [0.0, unbounded]

  # ── EDGE: SUPPORTS ──────────────────────────────────────
  # Narrative -> Narrative (directional)
  # One narrative reinforces another. Energy flows from source
  # to target through SUPPORTS edges.

  # SUPPORTS edge properties:
  #   factor:      FLOAT    flow multiplier [0.0, 1.0] (default 0.2)

  # ── EDGE: WITNESS ───────────────────────────────────────
  # Character -> Moment
  # A citizen who was present when a Moment flipped.
  # Witnesses have confidence 1.0 when the event propagates.

  # WITNESS edge properties:
  #   (none -- presence is the only information)

  # ── EDGE: ABOUT ─────────────────────────────────────────
  # Narrative -> Character | Place
  # A narrative that concerns a specific person or location.
  # Used for query context: "what do people say about this place?"

  # ABOUT edge properties:
  #   (none -- the relationship itself is the information)

  # ── EDGE: FEEDS ─────────────────────────────────────────
  # Narrative -> Moment
  # A narrative whose energy contributes to a Moment's salience.
  # Created during seeding and by the Narrator agent after flips.

  # FEEDS edge properties:
  #   factor:      FLOAT    energy transfer multiplier [0.0, 1.0] (default 0.5)

  RETURN "Edges defined for graph: " + graph_name
```

---

## G2. Seeding Pipeline: Airtable to FalkorDB

One-time transform. Not a sync loop. After seeding, the graph evolves through physics only.

### Master Seeding Procedure

```
FUNCTION seed_venice_graph(airtable_config, graph_name = "venezia"):

  # ── STEP 0: Initialize ──────────────────────────────────
  create_venezia_schema(graph_name)
  create_venezia_edges(graph_name)

  citizens = airtable.list_records("CITIZENS", airtable_config)
  districts = airtable.list_records("DISTRICTS", airtable_config)
  relationships = airtable.list_records("RELATIONSHIPS", airtable_config)

  stats = {
    characters_created: 0,
    narratives_created: 0,
    places_created: 0,
    moments_created: 0,
    believes_edges: 0,
    tension_edges: 0,
    feeds_edges: 0,
  }

  # ── STEP 1: Seed Place nodes from districts ─────────────
  FOR district in districts:
    place_id = "place_" + slugify(district.fields.Name)
    graph.query("""
      MERGE (p:Place {id: $place_id})
      SET p.name       = $name,
          p.district   = $district_name,
          p.position_x = $pos_x,
          p.position_z = $pos_z
    """, {
      place_id: place_id,
      name: district.fields.Name,
      district_name: district.fields.Name,
      pos_x: geo_to_world_x(district.fields.Longitude),
      pos_z: geo_to_world_z(district.fields.Latitude),
    })
    stats.places_created += 1

  # ── STEP 2: Seed Character nodes from citizens ──────────
  FOR citizen in citizens:
    char_id = "char_" + slugify(citizen.fields.Username)

    graph.query("""
      MERGE (c:Character {id: $char_id})
      SET c.name     = $name,
          c.energy   = 0.5,
          c.weight   = $weight,
          c.class    = $social_class,
          c.mood     = 'neutral',
          c.district = $district,
          c.ducats   = $ducats,
          c.alive    = true
    """, {
      char_id: char_id,
      name: citizen.fields.Name,
      weight: compute_initial_weight(citizen),
      social_class: citizen.fields.SocialClass,
      district: citizen.fields.HomeDistrict,
      ducats: citizen.fields.Ducats OR 0,
    })
    stats.characters_created += 1

    # Place character at their home district
    home_place_id = "place_" + slugify(citizen.fields.HomeDistrict)
    graph.query("""
      MATCH (c:Character {id: $char_id}), (p:Place {id: $place_id})
      MERGE (c)-[:AT {since: $now}]->(p)
    """, {
      char_id: char_id,
      place_id: home_place_id,
      now: iso_now(),
    })

  # ── STEP 3: Seed Narrative nodes from grievances ────────
  FOR citizen in citizens:
    char_id = "char_" + slugify(citizen.fields.Username)
    grievances = extract_grievances(citizen, relationships)

    FOR grievance in grievances:
      narr_id = generate_narrative_id(grievance)

      graph.query("""
        MERGE (n:Narrative {id: $narr_id})
        SET n.content = $content,
            n.truth   = $truth,
            n.energy  = 0.3,
            n.weight  = 0.5,
            n.type    = $type,
            n.source  = 'seed'
      """, {
        narr_id: narr_id,
        content: grievance.description,
        truth: grievance.truth_value,
        type: grievance.type,
      })
      stats.narratives_created += 1

      # Create BELIEVES edge
      graph.query("""
        MATCH (c:Character {id: $char_id}), (n:Narrative {id: $narr_id})
        MERGE (c)-[:BELIEVES {
          confidence: $confidence,
          source: 'seed',
          heard_at: $now
        }]->(n)
      """, {
        char_id: char_id,
        narr_id: narr_id,
        confidence: grievance.initial_confidence,
        now: iso_now(),
      })
      stats.believes_edges += 1

  # ── STEP 4: Seed TENSION edges between contradicting narratives
  stats.tension_edges = seed_initial_tensions(graph_name)

  # ── STEP 5: Seed initial Moments from conflict patterns
  stats.moments_created = seed_initial_moments(graph_name)
  stats.feeds_edges = stats.moments_created * 2  # Each moment has ~2 feeding narratives

  RETURN stats
```

### Helper: Initial Weight Computation

```
FUNCTION compute_initial_weight(citizen):
  # Weight reflects narrative importance. Wealthy and politically
  # connected citizens carry more narrative weight.

  base = 1.0

  # Social class modifier
  class_weights = {
    "Nobili":     1.5,    # Aristocracy: high narrative influence
    "Cittadini":  1.2,    # Professionals: moderate influence
    "Popolani":   1.0,    # Common people: baseline
    "Facchini":   0.8,    # Laborers: lower individual influence
    "Forestieri": 0.6,    # Foreigners: minimal initial influence
  }
  base *= class_weights.get(citizen.fields.SocialClass, 1.0)

  # Wealth modifier (logarithmic, prevents runaway)
  IF citizen.fields.Ducats > 0:
    base *= (1.0 + log10(citizen.fields.Ducats) / 10.0)

  RETURN clamp(base, 0.3, 3.0)
```

### Helper: Grievance Extraction

```
FUNCTION extract_grievances(citizen, all_relationships):
  grievances = []

  # Direct grievances from citizen description and personality
  IF citizen.fields.Flaw:
    grievances.append({
      description: infer_grievance_from_flaw(citizen.fields.Flaw, citizen.fields.SocialClass),
      type: "grievance",
      truth_value: 0.5,
      initial_confidence: 0.7,
    })

  # Relationship-derived grievances
  citizen_relationships = [r for r in all_relationships
                            if r.fields.Citizen1 == citizen.id
                            OR r.fields.Citizen2 == citizen.id]

  FOR rel in citizen_relationships:
    IF rel.fields.Trust < 20:
      other = rel.fields.Citizen2 if rel.fields.Citizen1 == citizen.id else rel.fields.Citizen1
      grievances.append({
        description: f"distrust toward {other.fields.Name}",
        type: "grudge",
        truth_value: 0.8,
        initial_confidence: 0.9,
      })

  # Class-based grievances (systemic)
  IF citizen.fields.SocialClass in ["Popolani", "Facchini"]:
    IF citizen.fields.Ducats < 50:
      grievances.append({
        description: "the wealthy exploit the poor of Venice",
        type: "grievance",
        truth_value: 0.6,
        initial_confidence: 0.6,
      })

  IF citizen.fields.SocialClass == "Nobili":
    grievances.append({
      description: "the common people do not understand the burden of governance",
      type: "belief",
      truth_value: 0.3,
      initial_confidence: 0.5,
    })

  RETURN grievances
```

### Helper: Tension Seeding

```
FUNCTION seed_initial_tensions(graph_name):
  tension_count = 0

  # Find narrative pairs that contradict each other.
  # Two narratives contradict when:
  #   1. They are the same type (both "grievance" or both "belief")
  #   2. Their believers are in different social classes or factions
  #   3. Their content is semantically opposed

  # Strategy 1: Class-based contradictions
  # Fetch all narratives held by Nobili
  nobili_narratives = graph.query("""
    MATCH (c:Character {class: 'Nobili'})-[:BELIEVES]->(n:Narrative)
    RETURN DISTINCT n.id AS id, n.content AS content
  """)

  # Fetch all narratives held by Popolani and Facchini
  worker_narratives = graph.query("""
    MATCH (c:Character)-[:BELIEVES]->(n:Narrative)
    WHERE c.class IN ['Popolani', 'Facchini']
    RETURN DISTINCT n.id AS id, n.content AS content
  """)

  # Create TENSION edges between narratives from opposing classes
  # that address the same topic (governance, wealth, labor, trade)
  FOR nobili_narr in nobili_narratives:
    FOR worker_narr in worker_narratives:
      IF topics_overlap(nobili_narr.content, worker_narr.content):
        IF nobili_narr.id != worker_narr.id:
          graph.query("""
            MATCH (n1:Narrative {id: $id1}), (n2:Narrative {id: $id2})
            MERGE (n1)-[:TENSION {strength: 0.3}]-(n2)
          """, {id1: nobili_narr.id, id2: worker_narr.id})
          tension_count += 1

  # Strategy 2: District-based contradictions
  # Citizens in the same district with opposing beliefs create local tension
  districts = graph.query("MATCH (p:Place) RETURN DISTINCT p.district AS d")

  FOR district in districts:
    district_narratives = graph.query("""
      MATCH (c:Character {district: $dist})-[:BELIEVES]->(n:Narrative)
      RETURN n.id AS id, n.content AS content, c.class AS believer_class
    """, {dist: district.d})

    # Find pairs where different classes believe different things
    # about the same topic in the same district
    pairs = find_contradicting_pairs(district_narratives)
    FOR pair in pairs:
      graph.query("""
        MATCH (n1:Narrative {id: $id1}), (n2:Narrative {id: $id2})
        MERGE (n1)-[:TENSION {strength: 0.2}]-(n2)
      """, {id1: pair.id1, id2: pair.id2})
      tension_count += 1

  RETURN tension_count
```

### Helper: Moment Seeding

```
FUNCTION seed_initial_moments(graph_name):
  moment_count = 0

  # Moments are seeded from observed tension clusters.
  # Each district with significant tension gets 1-3 latent Moments.

  districts = graph.query("MATCH (p:Place) RETURN DISTINCT p.district AS d")

  FOR district in districts:
    # Count tensions in this district
    tensions = graph.query("""
      MATCH (c1:Character {district: $dist})-[:BELIEVES]->(n1:Narrative)
            -[t:TENSION]-(n2:Narrative)<-[:BELIEVES]-(c2:Character {district: $dist})
      RETURN count(DISTINCT t) AS tension_count,
             collect(DISTINCT n1.type) AS types,
             sum(t.strength) AS total_strength
    """, {dist: district.d})

    IF tensions[0].tension_count == 0:
      CONTINUE

    # Determine moment categories from tension types
    categories = determine_moment_categories(tensions[0].types, tensions[0].total_strength)

    FOR category in categories:
      moment_id = "mom_" + slugify(district.d) + "_" + category + "_" + str(moment_count)
      threshold = compute_moment_threshold(category, tensions[0].total_strength)

      graph.query("""
        MERGE (m:Moment {id: $moment_id})
        SET m.description = $description,
            m.threshold   = $threshold,
            m.flipped     = false,
            m.category    = $category,
            m.energy      = 0.0,
            m.weight      = 1.0
      """, {
        moment_id: moment_id,
        description: generate_moment_description(category, district.d),
        threshold: threshold,
        category: category,
      })

      # Connect feeding narratives to the Moment
      feeding_narratives = graph.query("""
        MATCH (n:Narrative)<-[:BELIEVES]-(c:Character {district: $dist})
        WHERE n.type IN $relevant_types
        RETURN DISTINCT n.id AS id
        LIMIT 5
      """, {dist: district.d, relevant_types: CATEGORY_NARRATIVE_TYPES[category]})

      FOR narr in feeding_narratives:
        graph.query("""
          MATCH (n:Narrative {id: $narr_id}), (m:Moment {id: $moment_id})
          MERGE (n)-[:FEEDS {factor: 0.5}]->(m)
        """, {narr_id: narr.id, moment_id: moment_id})

      moment_count += 1

  RETURN moment_count


FUNCTION compute_moment_threshold(category, existing_tension_strength):
  # Venice thresholds are higher than Blood Ledger (186 citizens vs ~15)
  base_thresholds = {
    "economic_crisis":     3.0,
    "political_uprising":  4.0,
    "celebration":         2.0,
    "personal_tragedy":    2.5,
    "guild_dispute":       2.5,
    "trade_disruption":    3.5,
  }
  base = base_thresholds.get(category, 3.0)

  # Scale up if existing tension is already high (prevent instant flip)
  IF existing_tension_strength > 2.0:
    base *= 1.0 + (existing_tension_strength - 2.0) * 0.2

  RETURN clamp(base, 2.0, 6.0)


# Maps event categories to narrative types that feed them
CATEGORY_NARRATIVE_TYPES = {
  "economic_crisis":     ["grievance", "debt", "belief"],
  "political_uprising":  ["grievance", "grudge", "belief"],
  "celebration":         ["alliance", "belief"],
  "personal_tragedy":    ["grudge", "debt"],
  "guild_dispute":       ["grievance", "belief", "alliance"],
  "trade_disruption":    ["belief", "debt", "forestiere_news"],
}
```

---

## G3. Graph Query Functions

Every query is designed for citizen conversation context assembly, physics tick computation, or event propagation. Not for analytics or dashboards.

### Get Citizen Beliefs

```
FUNCTION get_citizen_beliefs(citizen_id, min_energy = 0.05, limit = 5):
  # Returns the top active beliefs for a citizen, ranked by
  # how strongly they believe them weighted by narrative energy.
  # Used by: citizen context assembly (mind module)

  results = graph.query("""
    MATCH (c:Character {id: $citizen_id})-[b:BELIEVES]->(n:Narrative)
    WHERE n.energy > $min_energy
    RETURN n.id        AS narrative_id,
           n.content   AS content,
           n.type      AS type,
           n.energy    AS energy,
           b.confidence AS confidence,
           n.energy * b.confidence AS salience
    ORDER BY salience DESC
    LIMIT $limit
  """, {
    citizen_id: citizen_id,
    min_energy: min_energy,
    limit: limit,
  })

  beliefs = []
  FOR row in results:
    beliefs.append({
      narrative_id: row.narrative_id,
      content:      row.content,
      type:         row.type,
      energy:       row.energy,
      confidence:   row.confidence,
      salience:     row.salience,
    })

  RETURN beliefs
```

### Get Active Tensions

```
FUNCTION get_active_tensions(district = None, min_strength = 0.1, limit = 10):
  # Returns the hottest tensions in the graph, optionally filtered
  # by district. Used by: physics tick, event prediction, district
  # atmosphere computation.

  IF district IS NOT None:
    results = graph.query("""
      MATCH (c1:Character {district: $district})-[:BELIEVES]->(n1:Narrative)
            -[t:TENSION]-(n2:Narrative)<-[:BELIEVES]-(c2:Character {district: $district})
      WHERE t.strength > $min_strength
      RETURN DISTINCT n1.id      AS narrative_a_id,
             n1.content           AS narrative_a_content,
             n2.id                AS narrative_b_id,
             n2.content           AS narrative_b_content,
             t.strength           AS strength,
             count(DISTINCT c1)   AS believers_a,
             count(DISTINCT c2)   AS believers_b
      ORDER BY t.strength DESC
      LIMIT $limit
    """, {
      district: district,
      min_strength: min_strength,
      limit: limit,
    })
  ELSE:
    results = graph.query("""
      MATCH (n1:Narrative)-[t:TENSION]-(n2:Narrative)
      WHERE t.strength > $min_strength
      RETURN n1.id      AS narrative_a_id,
             n1.content AS narrative_a_content,
             n2.id      AS narrative_b_id,
             n2.content AS narrative_b_content,
             t.strength AS strength
      ORDER BY t.strength DESC
      LIMIT $limit
    """, {
      min_strength: min_strength,
      limit: limit,
    })

  tensions = []
  FOR row in results:
    tensions.append({
      narrative_a: { id: row.narrative_a_id, content: row.narrative_a_content },
      narrative_b: { id: row.narrative_b_id, content: row.narrative_b_content },
      strength:    row.strength,
      believers_a: row.believers_a OR None,
      believers_b: row.believers_b OR None,
    })

  RETURN tensions
```

### Get District Narratives

```
FUNCTION get_district_narratives(district, min_energy = 0.05, limit = 10):
  # Returns the most energetic narratives in a district.
  # Used by: district atmosphere, ambient conversation topics,
  # event context.

  results = graph.query("""
    MATCH (c:Character {district: $district})-[b:BELIEVES]->(n:Narrative)
    WHERE n.energy > $min_energy
    RETURN n.id          AS narrative_id,
           n.content     AS content,
           n.type        AS type,
           n.energy      AS energy,
           n.weight      AS weight,
           count(DISTINCT c) AS believer_count,
           avg(b.confidence) AS avg_confidence
    ORDER BY n.energy * count(DISTINCT c) DESC
    LIMIT $limit
  """, {
    district: district,
    min_energy: min_energy,
    limit: limit,
  })

  narratives = []
  FOR row in results:
    narratives.append({
      id:              row.narrative_id,
      content:         row.content,
      type:            row.type,
      energy:          row.energy,
      weight:          row.weight,
      believer_count:  row.believer_count,
      avg_confidence:  row.avg_confidence,
    })

  RETURN narratives
```

### Get Moment Proximity

```
FUNCTION get_citizen_moment_proximity(citizen_id, limit = 3):
  # Returns unflipped Moments that a citizen is connected to,
  # ranked by proximity to threshold. Used by: citizen context
  # (a citizen near a breaking point is anxious and preoccupied).

  results = graph.query("""
    MATCH (c:Character {id: $citizen_id})-[:BELIEVES]->(n:Narrative)
          -[:FEEDS]->(m:Moment {flipped: false})
    RETURN DISTINCT m.id          AS moment_id,
           m.description          AS description,
           m.category             AS category,
           m.threshold            AS threshold,
           m.energy               AS energy,
           m.weight               AS weight,
           m.energy * m.weight    AS salience,
           m.energy * m.weight / m.threshold AS proximity_ratio
    ORDER BY proximity_ratio DESC
    LIMIT $limit
  """, {citizen_id: citizen_id, limit: limit})

  moments = []
  FOR row in results:
    moments.append({
      id:              row.moment_id,
      description:     row.description,
      category:        row.category,
      salience:        row.salience,
      threshold:       row.threshold,
      proximity_ratio: row.proximity_ratio,  # 1.0 = at threshold, >1.0 = past threshold
    })

  RETURN moments
```

### Get Citizens Who Believe

```
FUNCTION get_narrative_believers(narrative_id):
  # Returns all citizens who hold a specific belief.
  # Used by: news propagation, event consequence application,
  # narrator agent context.

  results = graph.query("""
    MATCH (c:Character)-[b:BELIEVES]->(n:Narrative {id: $narr_id})
    RETURN c.id         AS citizen_id,
           c.name       AS citizen_name,
           c.class      AS social_class,
           c.district   AS district,
           b.confidence AS confidence,
           b.source     AS source
    ORDER BY b.confidence DESC
  """, {narr_id: narrative_id})

  RETURN results
```

### Get District Tension Level

```
FUNCTION get_district_tension_level(district):
  # Returns a scalar tension level for a district [0.0, 1.0].
  # Used by: atmosphere computation, citizen mood modifier.

  result = graph.query("""
    MATCH (c1:Character {district: $dist})-[:BELIEVES]->(n1:Narrative)
          -[t:TENSION]-(n2:Narrative)
    RETURN sum(t.strength) AS total_tension,
           count(DISTINCT t) AS tension_count
  """, {dist: district})

  IF result IS EMPTY OR result[0].tension_count == 0:
    RETURN 0.0

  total = result[0].total_tension
  count = result[0].tension_count

  # Normalize to [0, 1] using sigmoid-like function
  # At total_tension = 5.0, level is approximately 0.5
  level = total / (total + 5.0)

  RETURN clamp(level, 0.0, 1.0)
```

### Get Citizen Social Graph for Propagation

```
FUNCTION get_citizen_trust_network(citizen_id, min_trust = 20):
  # Returns citizens connected through shared beliefs with
  # implicit trust derived from belief overlap.
  # Used by: news propagation BFS.

  results = graph.query("""
    MATCH (c1:Character {id: $cid})-[:BELIEVES]->(n:Narrative)
          <-[:BELIEVES]-(c2:Character)
    WHERE c2.id != $cid
    RETURN c2.id          AS citizen_id,
           c2.name        AS citizen_name,
           c2.district    AS district,
           count(n)       AS shared_beliefs,
           avg(n.energy)  AS avg_shared_energy
    ORDER BY shared_beliefs DESC
  """, {cid: citizen_id})

  # Convert shared belief count to implicit trust score
  network = []
  FOR row in results:
    # More shared beliefs = higher implicit trust
    # 1 shared belief = 20 trust, 5+ = 80+
    implicit_trust = min(100, row.shared_beliefs * 15 + 5)
    IF implicit_trust >= min_trust:
      network.append({
        citizen_id:     row.citizen_id,
        citizen_name:   row.citizen_name,
        district:       row.district,
        trust:          implicit_trust,
        shared_beliefs: row.shared_beliefs,
      })

  RETURN network
```

---

## G4. Belief Creation and Update

Beliefs enter the graph through five channels: seeding, physics propagation, narrator agent, forestiere news, and visitor conversation reinforcement. Each channel creates or updates BELIEVES edges differently.

### Create New Belief

```
FUNCTION create_belief(citizen_id, narrative_id, confidence, source):
  # Creates a new BELIEVES edge. If the citizen already believes
  # this narrative, the existing edge is updated instead.

  # Check if narrative exists
  narrative = graph.query("""
    MATCH (n:Narrative {id: $narr_id})
    RETURN n.id AS id, n.energy AS energy
  """, {narr_id: narrative_id})

  IF narrative IS EMPTY:
    RETURN ERROR("Narrative does not exist: " + narrative_id)

  # Check for existing belief
  existing = graph.query("""
    MATCH (c:Character {id: $cid})-[b:BELIEVES]->(n:Narrative {id: $nid})
    RETURN b.confidence AS confidence, b.source AS source
  """, {cid: citizen_id, nid: narrative_id})

  IF existing IS NOT EMPTY:
    # Update existing belief (see G4.2)
    RETURN update_belief_confidence(citizen_id, narrative_id, confidence, source)

  # Create new BELIEVES edge
  graph.query("""
    MATCH (c:Character {id: $cid}), (n:Narrative {id: $nid})
    CREATE (c)-[:BELIEVES {
      confidence: $confidence,
      source: $source,
      heard_at: $now
    }]->(n)
  """, {
    cid: citizen_id,
    nid: narrative_id,
    confidence: confidence,
    source: source,
    now: iso_now(),
  })

  # Boost narrative energy slightly when a new believer joins
  graph.query("""
    MATCH (n:Narrative {id: $nid})
    SET n.energy = n.energy + 0.05
  """, {nid: narrative_id})

  RETURN {
    citizen_id:   citizen_id,
    narrative_id: narrative_id,
    confidence:   confidence,
    source:       source,
    is_new:       TRUE,
  }
```

### Update Belief Confidence

```
FUNCTION update_belief_confidence(citizen_id, narrative_id, new_confidence, source):
  # Updates the confidence of an existing belief. Confidence changes
  # are asymptotic: it is easier to reinforce a weak belief than to
  # strengthen an already strong one.

  existing = graph.query("""
    MATCH (c:Character {id: $cid})-[b:BELIEVES]->(n:Narrative {id: $nid})
    RETURN b.confidence AS old_confidence, b.source AS old_source
  """, {cid: citizen_id, nid: narrative_id})

  IF existing IS EMPTY:
    RETURN ERROR("No existing belief to update")

  old_confidence = existing[0].old_confidence

  # Asymptotic confidence update:
  # The closer confidence is to 1.0, the harder it is to increase.
  # The closer confidence is to 0.0, the harder it is to decrease.
  IF new_confidence > old_confidence:
    # Reinforcement: diminishing returns as confidence grows
    room = 1.0 - old_confidence
    delta = (new_confidence - old_confidence) * room * 0.5
    final_confidence = old_confidence + delta
  ELSE:
    # Erosion: beliefs resist being weakened
    room = old_confidence
    delta = (old_confidence - new_confidence) * room * 0.3
    final_confidence = old_confidence - delta

  final_confidence = clamp(final_confidence, 0.01, 0.99)

  graph.query("""
    MATCH (c:Character {id: $cid})-[b:BELIEVES]->(n:Narrative {id: $nid})
    SET b.confidence = $conf,
        b.source     = $source,
        b.heard_at   = $now
  """, {
    cid: citizen_id,
    nid: narrative_id,
    conf: final_confidence,
    source: source,
    now: iso_now(),
  })

  RETURN {
    citizen_id:     citizen_id,
    narrative_id:   narrative_id,
    old_confidence: old_confidence,
    new_confidence: final_confidence,
    delta:          final_confidence - old_confidence,
    is_new:         FALSE,
  }
```

### Belief Propagation Between Citizens

```
FUNCTION propagate_belief(source_citizen_id, target_citizen_id, narrative_id):
  # When a citizen "tells" another citizen about a belief,
  # the target may adopt it. Adoption depends on:
  #   1. Source citizen's confidence in the belief
  #   2. Implicit trust between the two citizens
  #   3. Target citizen's existing stance (if any)

  # Get source belief
  source_belief = graph.query("""
    MATCH (c:Character {id: $src})-[b:BELIEVES]->(n:Narrative {id: $nid})
    RETURN b.confidence AS confidence
  """, {src: source_citizen_id, nid: narrative_id})

  IF source_belief IS EMPTY:
    RETURN None  # Source does not hold this belief

  source_confidence = source_belief[0].confidence

  # Compute implicit trust from shared beliefs
  trust = compute_implicit_trust(source_citizen_id, target_citizen_id)

  # Adoption confidence degrades with each hop
  # confidence_received = source_confidence * trust_factor * HOP_DECAY
  HOP_DECAY = 0.8
  trust_factor = trust / 100.0
  received_confidence = source_confidence * trust_factor * HOP_DECAY

  # Minimum confidence to even create the belief
  IF received_confidence < 0.1:
    RETURN None  # Not convincing enough

  # Check if target already has a contradicting belief
  # (a belief connected via TENSION to this narrative)
  contradictions = graph.query("""
    MATCH (c:Character {id: $tgt})-[b:BELIEVES]->(n1:Narrative)
          -[:TENSION]-(n2:Narrative {id: $nid})
    RETURN n1.id AS contradicting_id, b.confidence AS contradicting_confidence
  """, {tgt: target_citizen_id, nid: narrative_id})

  IF contradictions IS NOT EMPTY:
    # Target holds a contradicting belief.
    # Adoption is blocked if contradiction is strong.
    strongest_contradiction = max(contradictions, by=contradicting_confidence)
    IF strongest_contradiction.contradicting_confidence > received_confidence:
      RETURN None  # Existing belief is stronger. Rejection.
    ELSE:
      # Weaken the existing contradiction slightly
      update_belief_confidence(
        target_citizen_id,
        strongest_contradiction.contradicting_id,
        strongest_contradiction.contradicting_confidence - 0.05,
        "social_pressure"
      )

  # Create or update the belief
  result = create_belief(target_citizen_id, narrative_id, received_confidence, "hearsay")

  RETURN result


FUNCTION compute_implicit_trust(citizen_a_id, citizen_b_id):
  # Trust derived from shared beliefs. More overlap = more trust.

  result = graph.query("""
    MATCH (a:Character {id: $a})-[:BELIEVES]->(n:Narrative)
          <-[:BELIEVES]-(b:Character {id: $b})
    RETURN count(n) AS shared
  """, {a: citizen_a_id, b: citizen_b_id})

  shared = result[0].shared IF result ELSE 0
  RETURN min(100, shared * 15 + 5)
```

---

## G5. Graph Maintenance

### Cold Pruning (Daily Cycle)

```
FUNCTION cold_prune_narratives(graph_name = "venezia"):
  # Remove narrative nodes that are narratively dead:
  #   - Energy below threshold
  #   - Weight below minimum
  #   - No active TENSION edges (structurally unimportant)
  #   - Not a Moment (Moments are never pruned)
  #
  # Runs every 24 hours. Safe to run more often but unnecessary.

  MIN_PRUNE_ENERGY = 0.001
  MIN_PRUNE_WEIGHT = 0.01

  # Step 1: Identify cold narratives
  cold = graph.query("""
    MATCH (n:Narrative)
    WHERE n.energy < $min_energy
      AND n.weight < $min_weight
      AND NOT EXISTS { (n)-[:TENSION]-() }
    RETURN n.id AS id, n.content AS content, n.energy AS energy, n.weight AS weight
  """, {min_energy: MIN_PRUNE_ENERGY, min_weight: MIN_PRUNE_WEIGHT})

  pruned_count = 0

  FOR narrative in cold:
    # Double-check: do not prune if any citizen still believes it
    # (even at low confidence -- the belief edge is the citizen's memory)
    believers = graph.query("""
      MATCH (c:Character)-[:BELIEVES]->(n:Narrative {id: $nid})
      RETURN count(c) AS count
    """, {nid: narrative.id})

    IF believers[0].count > 0:
      # Citizens still hold this belief. Remove the narrative
      # only if ALL believes edges also have negligible confidence.
      strong_believers = graph.query("""
        MATCH (c:Character)-[b:BELIEVES]->(n:Narrative {id: $nid})
        WHERE b.confidence > 0.05
        RETURN count(c) AS count
      """, {nid: narrative.id})

      IF strong_believers[0].count > 0:
        CONTINUE  # At least one citizen still meaningfully believes this

    # Safe to prune: detach delete removes all connected edges
    graph.query("""
      MATCH (n:Narrative {id: $nid})
      DETACH DELETE n
    """, {nid: narrative.id})
    pruned_count += 1

  RETURN {
    candidates: len(cold),
    pruned: pruned_count,
    retained: len(cold) - pruned_count,
  }
```

### Energy Normalization

```
FUNCTION normalize_graph_energy(graph_name = "venezia"):
  # Prevents energy from growing without bound across the graph.
  # Called after economic injection or after a cascade of events.
  #
  # Strategy: soft cap with redistribution.
  # If total energy exceeds MAX_TOTAL_ENERGY, scale all energies
  # proportionally to bring total back to target.

  MAX_TOTAL_ENERGY = 100.0     # For 186-citizen graph
  TARGET_ENERGY    = 80.0      # Normalize to 80% of max

  # Compute total energy across all nodes
  result = graph.query("""
    MATCH (n)
    WHERE n.energy IS NOT NULL AND n.energy > 0
    RETURN sum(n.energy) AS total_energy, count(n) AS node_count
  """)

  total = result[0].total_energy
  count = result[0].node_count

  IF total <= MAX_TOTAL_ENERGY:
    RETURN { action: "none", total: total, count: count }

  # Compute scale factor
  scale = TARGET_ENERGY / total

  # Apply to all nodes with energy
  graph.query("""
    MATCH (n)
    WHERE n.energy IS NOT NULL AND n.energy > 0
    SET n.energy = n.energy * $scale
  """, {scale: scale})

  # Apply to all TENSION edge strengths proportionally
  graph.query("""
    MATCH ()-[t:TENSION]-()
    WHERE t.strength IS NOT NULL AND t.strength > 0
    SET t.strength = t.strength * $scale
  """, {scale: scale})

  RETURN {
    action: "normalized",
    total_before: total,
    total_after: TARGET_ENERGY,
    scale_factor: scale,
    nodes_affected: count,
  }
```

### Orphan Cleanup

```
FUNCTION cleanup_orphaned_edges(graph_name = "venezia"):
  # Remove edges that point to deleted nodes.
  # Should not happen in normal operation but guards against
  # race conditions between pruning and physics tick.

  # Remove BELIEVES edges where narrative was pruned
  result_believes = graph.query("""
    MATCH (c:Character)-[b:BELIEVES]->(n)
    WHERE NOT n:Narrative
    DELETE b
    RETURN count(b) AS deleted
  """)

  # Remove FEEDS edges where narrative or moment was removed
  result_feeds = graph.query("""
    MATCH (n)-[f:FEEDS]->(m)
    WHERE NOT n:Narrative OR NOT m:Moment
    DELETE f
    RETURN count(f) AS deleted
  """)

  # Remove AT edges where place was removed (should never happen)
  result_at = graph.query("""
    MATCH (c:Character)-[a:AT]->(p)
    WHERE NOT p:Place
    DELETE a
    RETURN count(a) AS deleted
  """)

  RETURN {
    believes_cleaned: result_believes[0].deleted,
    feeds_cleaned: result_feeds[0].deleted,
    at_cleaned: result_at[0].deleted,
  }
```

### Graph Health Check

```
FUNCTION graph_health_check(graph_name = "venezia"):
  # Run on startup and periodically (every hour).
  # Returns a health report identifying potential problems.

  report = { healthy: TRUE, warnings: [], stats: {} }

  # Count all node types
  counts = graph.query("""
    MATCH (n)
    RETURN labels(n)[0] AS label, count(n) AS count
  """)
  FOR row in counts:
    report.stats[row.label] = row.count

  # Expected ranges for a 186-citizen Venice graph
  expected = {
    "Character": { min: 180, max: 200 },     # ~186 citizens
    "Narrative": { min: 50, max: 2000 },      # Bounded by pruning
    "Place":     { min: 7, max: 50 },         # 7 districts + sub-locations
    "Moment":    { min: 5, max: 100 },        # Seeded + generated
  }

  FOR label, range in expected:
    actual = report.stats.get(label, 0)
    IF actual < range.min:
      report.warnings.append(f"Low {label} count: {actual} (expected >= {range.min})")
      report.healthy = FALSE
    IF actual > range.max:
      report.warnings.append(f"High {label} count: {actual} (expected <= {range.max})")

  # Check for characters with no beliefs (narratively dead citizens)
  no_beliefs = graph.query("""
    MATCH (c:Character)
    WHERE NOT EXISTS { (c)-[:BELIEVES]->() }
    RETURN count(c) AS count
  """)
  IF no_beliefs[0].count > 50:
    report.warnings.append(f"{no_beliefs[0].count} characters have no beliefs")

  # Check for energy anomalies
  energy_stats = graph.query("""
    MATCH (n)
    WHERE n.energy IS NOT NULL
    RETURN max(n.energy) AS max_energy,
           avg(n.energy) AS avg_energy,
           sum(n.energy) AS total_energy
  """)
  IF energy_stats[0].max_energy > 50.0:
    report.warnings.append(f"Energy spike: max = {energy_stats[0].max_energy}")
  IF energy_stats[0].total_energy < 1.0:
    report.warnings.append("Total energy near zero. World may be narratively dead.")
    report.healthy = FALSE

  # Check for unflipped moments near threshold
  near_flip = graph.query("""
    MATCH (m:Moment {flipped: false})
    WHERE m.energy * m.weight > m.threshold * 0.8
    RETURN count(m) AS count
  """)
  report.stats["moments_near_flip"] = near_flip[0].count

  # Check for tension count
  tension_count = graph.query("""
    MATCH ()-[t:TENSION]-()
    RETURN count(t) / 2 AS count
  """)
  report.stats["active_tensions"] = tension_count[0].count

  IF tension_count[0].count == 0:
    report.warnings.append("No active tensions. No drama can emerge.")
    report.healthy = FALSE

  RETURN report
```

---

## G6. Constants Table

```
CONSTANT                        VALUE       NOTES
────────────────────────────────────────────────────────────────
GRAPH_NAME                      "venezia"   FalkorDB graph namespace
MIN_PRUNE_ENERGY                0.001       Cold pruning energy threshold
MIN_PRUNE_WEIGHT                0.01        Cold pruning weight threshold
MAX_TOTAL_ENERGY                100.0       Normalization ceiling (186 citizens)
TARGET_ENERGY                   80.0        Normalization target
HOP_DECAY                       0.8         Confidence loss per propagation hop
MIN_ADOPTION_CONFIDENCE         0.1         Below this, belief propagation rejected
CONFIDENCE_REINFORCE_FACTOR     0.5         Asymptotic reinforcement rate
CONFIDENCE_EROSION_FACTOR       0.3         Asymptotic erosion rate
NEW_BELIEVER_ENERGY_BOOST       0.05        Energy injected when new citizen believes
PRUNE_CYCLE_HOURS               24          How often cold pruning runs
HEALTH_CHECK_INTERVAL_MINUTES   60          How often health check runs
INITIAL_CHARACTER_ENERGY        0.5         Starting energy for seeded characters
INITIAL_NARRATIVE_ENERGY        0.3         Starting energy for seeded narratives
INITIAL_NARRATIVE_WEIGHT        0.5         Starting weight for seeded narratives
INITIAL_TENSION_STRENGTH        0.2 - 0.3   Starting tension between contradictions
MOMENT_THRESHOLD_RANGE          2.0 - 6.0   Range of Venice moment thresholds
CATEGORY_NARRATIVE_TYPES        (see G2)     Maps event categories to feeding types
```

---

## G7. Cross-Module Interfaces

```
EXPORTS TO citizens/mind:
  get_citizen_beliefs(citizen_id)         -> belief list for conversation context
  get_citizen_moment_proximity(citizen_id) -> approaching moments for anxiety cues
  get_district_tension_level(district)    -> scalar for mood computation

EXPORTS TO narrative/physics:
  Full graph read/write via GraphQueries and GraphOps
  get_active_tensions(district)           -> for tension computation
  get_narrative_believers(narrative_id)    -> for energy pump calculation

EXPORTS TO narrative/events:
  get_citizen_trust_network(citizen_id)   -> for news propagation BFS
  get_narrative_believers(narrative_id)    -> for event consequence targeting
  get_district_narratives(district)       -> for event context

IMPORTS FROM Serenissima Airtable:
  CITIZENS table                          -> Character nodes (seeding)
  DISTRICTS table                         -> Place nodes (seeding)
  RELATIONSHIPS table                     -> Grievance extraction (seeding)
  Economic deltas (15-min cycle)          -> Energy injection (via physics bridge)
```
