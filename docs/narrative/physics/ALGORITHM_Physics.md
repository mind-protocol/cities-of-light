# ALGORITHM: narrative/physics -- How It Works

Pseudocode for every procedure in the physics module. The 5-minute tick with its 6 phases, energy pump, routing, decay, tension accumulation, Moment flip detection, anti-runaway homeostasis, and economic injection. Every constant is named. Every formula is explicit. Nothing is hand-waved.

---

## P1. Constants Table

All physics constants with Venice-calibrated values. Blood Ledger values shown for reference.

```
CONSTANT                        VENICE VALUE    BLOOD LEDGER    NOTES
─────────────────────────────────────────────────────────────────────────
TICK_INTERVAL_MINUTES           5               5               Sacred. Do not change.
DECAY_RATE                      0.02            0.02            Base decay per tick
DECAY_RATE_MIN                  0.005           0.005           Floor during low-pressure recovery
DECAY_RATE_MAX                  0.1             0.1             Ceiling during runaway dampening
CORE_DECAY_MULTIPLIER           0.25            0.25            Core types decay at 1/4 rate
CORE_TYPES                      [debt, grudge,  [oath, blood,   Venice-specific persistent types
                                 oath, alliance] debt]
GENERATION_RATE                 0.3             0.5             Per-character pump rate (lower for 186 citizens)
ROUTE_FACTOR_SUPPORTS           0.20            0.20            Energy flow through SUPPORTS edges
ROUTE_FACTOR_TENSION            0.30            0.30            Energy accumulation on TENSION edges
DRAW_RATE                       0.3             0.3             Moment absorption rate
BACKFLOW_RATE                   0.1             0.1             Excess energy return to characters
DEFAULT_BREAKING_POINT          3.0             0.9             Moment flip threshold (higher for 186 citizens)
MOMENT_THRESHOLD_MIN            2.0             0.5             Minimum moment threshold
MOMENT_THRESHOLD_MAX            6.0             1.5             Maximum moment threshold
CRITICALITY_TARGET_MIN          0.4             0.4             Pressure floor for homeostasis
CRITICALITY_TARGET_MAX          0.6             0.6             Pressure ceiling for homeostasis
CRITICALITY_HOT_THRESHOLD       0.7             0.7             At least one narrative should be this hot
COOLDOWN_TICKS                  3               N/A             Ticks after flip before same-district flip allowed
MAX_CONCURRENT_ACTIVE_MOMENTS   3               N/A             Hard cap on simultaneously active moments
ECONOMIC_ENERGY_FACTOR          0.001           N/A             Ducats delta -> energy conversion
MOOD_ENERGY_FACTOR              0.1             N/A             Mood delta -> belief energy boost
NIGHT_GENERATION_MULTIPLIER     0.3             N/A             Generation rate reduction at night
DAWN_GENERATION_MULTIPLIER      1.2             N/A             Generation rate boost at dawn
VISITOR_ATTENTION_BOOST         0.02            N/A             Energy boost when visitor discusses a belief
THRESHOLD_ESCALATION_FACTOR     1.5             N/A             New moments after flip get higher thresholds
LINK_DRAIN_RATE                 0.3             0.3             Link cooling: drain to connected nodes
LINK_TO_WEIGHT_RATE             0.1             0.1             Link cooling: energy converts to weight
COLD_THRESHOLD                  0.01            0.01            Links below this are excluded from physics
TOP_N_LINKS                     20              20              Max links processed per node
MIN_WEIGHT                      0.01            0.01            Narratives never decay below this weight
```

---

## P2. The Master Tick: physics_tick()

The tick runs every 5 minutes. Six phases, executed in strict order. Each phase reads graph state, computes deltas, writes new state. No intermediate state persists between phases within a single tick.

```
FUNCTION physics_tick(graph_name = "venezia", current_tick, time_of_day):
  # The heartbeat of the world. Called by physics-bridge.js every 5 minutes.
  # Returns a TickResult with stats and any moment flips.

  result = TickResult {
    tick_number:       current_tick,
    energy_generated:  0.0,
    energy_routed:     0.0,
    energy_decayed:    0.0,
    tension_delta:     0.0,
    moments_flipped:   [],
    energy_injected:   0.0,
    events_emitted:    [],
    homeostasis_action: None,
  }

  # Pre-tick: compute effective generation rate based on time of day
  generation_multiplier = get_time_multiplier(time_of_day)

  # ────────────────────────────────────────────────────────
  # PHASE 1: PUMP
  # Characters pump energy into narratives they believe.
  # This is the primary energy source in the system.
  # ────────────────────────────────────────────────────────
  result.energy_generated = phase_pump(graph_name, generation_multiplier)

  # ────────────────────────────────────────────────────────
  # PHASE 2: ROUTE
  # Energy flows through SUPPORTS and TENSION edges.
  # SUPPORTS: energy transfers from source to target.
  # TENSION: both narratives contribute to tension strength.
  # ────────────────────────────────────────────────────────
  result.energy_routed, result.tension_delta = phase_route(graph_name)

  # ────────────────────────────────────────────────────────
  # PHASE 3: DECAY
  # All nodes lose energy. Core types lose less.
  # This is narrative forgetting.
  # ────────────────────────────────────────────────────────
  effective_decay = compute_effective_decay(graph_name)
  result.energy_decayed = phase_decay(graph_name, effective_decay)

  # ────────────────────────────────────────────────────────
  # PHASE 4: FLIP
  # Check all unflipped Moments. If salience > threshold, flip.
  # Respect cooldown and concurrent limit.
  # ────────────────────────────────────────────────────────
  result.moments_flipped = phase_flip(graph_name, current_tick)

  # ────────────────────────────────────────────────────────
  # PHASE 5: INJECT
  # Economic data injects energy into the graph.
  # Only runs if economy tick has occurred since last physics tick.
  # ────────────────────────────────────────────────────────
  result.energy_injected = phase_inject(graph_name)

  # ────────────────────────────────────────────────────────
  # PHASE 6: EMIT
  # If any Moments flipped, emit event descriptors.
  # Invoke Narrator agent for narrative consequences.
  # ────────────────────────────────────────────────────────
  result.events_emitted = phase_emit(result.moments_flipped, graph_name)

  # Post-tick: homeostasis check
  result.homeostasis_action = homeostasis_check(graph_name)

  RETURN result
```

### Time-of-Day Multiplier

```
FUNCTION get_time_multiplier(time_of_day):
  # Citizens generate less narrative energy when sleeping.
  # More when waking up and starting to talk.

  multipliers = {
    "night":     NIGHT_GENERATION_MULTIPLIER,    # 0.3
    "dawn":      DAWN_GENERATION_MULTIPLIER,     # 1.2
    "morning":   1.0,
    "midday":    0.9,                            # Siesta effect
    "afternoon": 1.0,
    "evening":   0.8,                            # Winding down
  }

  RETURN multipliers.get(time_of_day, 1.0)
```

---

## P3. Phase 1: Pump (Energy Generation)

Citizens pump energy into the narratives they believe. The amount depends on the citizen's own energy (weight, activity, wealth) and how strongly they believe each narrative.

```
FUNCTION phase_pump(graph_name, generation_multiplier):
  total_generated = 0.0

  # Fetch all alive characters with their beliefs
  characters = graph.query("""
    MATCH (c:Character {alive: true})
    RETURN c.id       AS id,
           c.weight   AS weight,
           c.energy   AS energy,
           c.class    AS class,
           c.ducats   AS ducats
  """)

  FOR character in characters:
    char_id    = character.id
    char_weight = character.weight OR 1.0
    char_energy = character.energy OR 0.5

    # Compute character's generation potential
    # Higher weight = more narrative influence
    # Wealthier citizens generate more (they have more to talk about)
    wealth_factor = compute_wealth_factor(character.ducats)
    char_generation = char_weight * GENERATION_RATE * generation_multiplier * wealth_factor

    # Fetch beliefs for this character
    beliefs = graph.query("""
      MATCH (c:Character {id: $cid})-[b:BELIEVES]->(n:Narrative)
      WHERE n.energy IS NOT NULL
      RETURN n.id AS narrative_id,
             b.confidence AS confidence,
             n.energy AS current_energy
    """, {cid: char_id})

    IF beliefs IS EMPTY:
      CONTINUE

    # Distribute energy across beliefs, weighted by confidence
    total_confidence = sum(b.confidence for b in beliefs)
    IF total_confidence == 0:
      CONTINUE

    FOR belief in beliefs:
      # Energy pumped = character_generation * (this_belief_confidence / total_confidence)
      fraction = belief.confidence / total_confidence
      energy_pumped = char_generation * fraction

      # Apply to narrative
      graph.query("""
        MATCH (n:Narrative {id: $nid})
        SET n.energy = n.energy + $delta
      """, {nid: belief.narrative_id, delta: energy_pumped})

      total_generated += energy_pumped

  RETURN total_generated


FUNCTION compute_wealth_factor(ducats):
  # Logarithmic scale. Prevents the richest citizen from
  # dominating all narrative energy.
  #   0 ducats   -> 0.5
  #   100 ducats -> 1.0
  #   1000 ducats -> 1.5
  #   10000 ducats -> 2.0

  IF ducats IS None OR ducats <= 0:
    RETURN 0.5

  RETURN 0.5 + log10(max(1, ducats)) / 4.0
```

---

## P4. Phase 2: Route (Energy Flow)

Energy flows through the narrative network. SUPPORTS edges carry energy from source to target. TENSION edges accumulate strength from both connected narratives.

```
FUNCTION phase_route(graph_name):
  total_routed = 0.0
  tension_delta = 0.0

  # ── SUPPORTS routing ────────────────────────────────────
  # Energy flows from source narrative to target narrative
  # through SUPPORTS edges. One directional.

  supports = graph.query("""
    MATCH (n1:Narrative)-[s:SUPPORTS]->(n2:Narrative)
    WHERE n1.energy > $cold_threshold
    RETURN n1.id     AS source_id,
           n1.energy AS source_energy,
           n2.id     AS target_id,
           n2.energy AS target_energy,
           s.factor  AS factor
  """, {cold_threshold: COLD_THRESHOLD})

  FOR edge in supports:
    factor = edge.factor OR ROUTE_FACTOR_SUPPORTS
    flow = edge.source_energy * factor

    # Apply flow: source loses energy, target gains
    graph.query("""
      MATCH (n1:Narrative {id: $src}), (n2:Narrative {id: $tgt})
      SET n1.energy = n1.energy - $flow,
          n2.energy = n2.energy + $received
    """, {
      src: edge.source_id,
      tgt: edge.target_id,
      flow: flow,
      received: flow * sqrt(edge.target_energy + 1.0) / (sqrt(edge.target_energy + 1.0) + 1.0),
      # Reception factor: heavier targets receive proportionally more
      # but with diminishing returns (sqrt model from v1.2)
    })

    total_routed += flow

  # ── TENSION accumulation ────────────────────────────────
  # Both narratives under tension pump energy into the tension
  # edge. Tension does not decay on its own.

  tensions = graph.query("""
    MATCH (n1:Narrative)-[t:TENSION]-(n2:Narrative)
    WHERE n1.energy > $cold_threshold OR n2.energy > $cold_threshold
    RETURN n1.id       AS id_a,
           n1.energy   AS energy_a,
           n2.id       AS id_b,
           n2.energy   AS energy_b,
           t.strength  AS strength,
           id(t)       AS edge_id
  """, {cold_threshold: COLD_THRESHOLD})

  # Deduplicate (bidirectional edges appear twice)
  seen_edges = set()

  FOR edge in tensions:
    edge_key = tuple(sorted([edge.id_a, edge.id_b]))
    IF edge_key in seen_edges:
      CONTINUE
    seen_edges.add(edge_key)

    # Tension grows based on combined energy of both narratives
    delta = (edge.energy_a + edge.energy_b) * ROUTE_FACTOR_TENSION
    new_strength = edge.strength + delta

    graph.query("""
      MATCH (n1:Narrative {id: $id_a})-[t:TENSION]-(n2:Narrative {id: $id_b})
      SET t.strength = $new_strength
    """, {id_a: edge.id_a, id_b: edge.id_b, new_strength: new_strength})

    tension_delta += delta

  # ── TENSION to Moment transfer ──────────────────────────
  # Tension energy feeds into connected Moments through FEEDS edges.
  # Moments absorb energy from their feeding narratives.

  feeds = graph.query("""
    MATCH (n:Narrative)-[f:FEEDS]->(m:Moment {flipped: false})
    WHERE n.energy > $cold_threshold
    RETURN n.id      AS narrative_id,
           n.energy  AS narrative_energy,
           m.id      AS moment_id,
           m.energy  AS moment_energy,
           f.factor  AS factor
  """, {cold_threshold: COLD_THRESHOLD})

  FOR feed in feeds:
    factor = feed.factor OR 0.5
    absorption = feed.narrative_energy * DRAW_RATE * factor

    # Moment absorbs energy from narrative
    graph.query("""
      MATCH (n:Narrative {id: $nid}), (m:Moment {id: $mid})
      SET n.energy = n.energy - $drain,
          m.energy = m.energy + $absorbed
    """, {
      nid: feed.narrative_id,
      mid: feed.moment_id,
      drain: absorption * 0.5,       # Narrative loses some energy
      absorbed: absorption,           # Moment gains full absorption
    })

    total_routed += absorption

  RETURN total_routed, tension_delta
```

---

## P5. Phase 3: Decay (Narrative Forgetting)

Every node loses energy each tick. Core types (debt, grudge, oath, alliance) lose less. Decay rate is dynamically adjusted by the homeostasis system.

```
FUNCTION phase_decay(graph_name, effective_decay_rate):
  total_decayed = 0.0

  # ── Standard narratives ─────────────────────────────────
  # energy *= (1 - decay_rate) per tick
  # At decay_rate = 0.02: half-life is ~35 ticks (~3 hours)

  standard_result = graph.query("""
    MATCH (n:Narrative)
    WHERE n.energy > 0.001
      AND NOT n.type IN $core_types
    SET n.energy = n.energy * (1.0 - $rate)
    RETURN sum(n.energy * $rate) AS total_decayed
  """, {
    rate: effective_decay_rate,
    core_types: CORE_TYPES,
  })

  total_decayed += standard_result[0].total_decayed OR 0.0

  # ── Core type narratives (slow decay) ───────────────────
  # Debts, grudges, oaths, and alliances persist.
  # Decay at CORE_DECAY_MULTIPLIER (0.25x) of standard rate.

  core_rate = effective_decay_rate * CORE_DECAY_MULTIPLIER

  core_result = graph.query("""
    MATCH (n:Narrative)
    WHERE n.energy > 0.001
      AND n.type IN $core_types
    SET n.energy = n.energy * (1.0 - $rate)
    RETURN sum(n.energy * $rate) AS total_decayed
  """, {
    rate: core_rate,
    core_types: CORE_TYPES,
  })

  total_decayed += core_result[0].total_decayed OR 0.0

  # ── Character energy decay ──────────────────────────────
  # Characters also lose energy each tick.
  # This represents attention and energy fading.

  char_result = graph.query("""
    MATCH (c:Character)
    WHERE c.energy > 0.01
    SET c.energy = c.energy * (1.0 - $rate)
    RETURN sum(c.energy * $rate) AS total_decayed
  """, {rate: effective_decay_rate})

  total_decayed += char_result[0].total_decayed OR 0.0

  # ── Weight floor enforcement ────────────────────────────
  # No narrative drops below MIN_WEIGHT.
  # Low weight with any energy = historically important, may re-energize.

  graph.query("""
    MATCH (n:Narrative)
    WHERE n.weight < $min_weight
    SET n.weight = $min_weight
  """, {min_weight: MIN_WEIGHT})

  RETURN total_decayed


FUNCTION compute_effective_decay(graph_name):
  # Decay rate is adjusted by homeostasis.
  # If system pressure is too high, decay increases.
  # If pressure is too low, decay decreases.

  avg_pressure = compute_average_pressure(graph_name)

  IF avg_pressure > CRITICALITY_TARGET_MAX:
    # System is overheated. Increase decay to cool down.
    overshoot = avg_pressure - CRITICALITY_TARGET_MAX
    adjustment = overshoot * 2.0  # Aggressive damping
    effective = DECAY_RATE + adjustment
    RETURN min(effective, DECAY_RATE_MAX)

  IF avg_pressure < CRITICALITY_TARGET_MIN:
    # System is too cold. Decrease decay to preserve energy.
    undershoot = CRITICALITY_TARGET_MIN - avg_pressure
    adjustment = undershoot * 1.0  # Gentle recovery
    effective = DECAY_RATE - adjustment
    RETURN max(effective, DECAY_RATE_MIN)

  # Pressure in target range. Use base decay.
  RETURN DECAY_RATE


FUNCTION compute_average_pressure(graph_name):
  # Average pressure = mean of (moment_salience / moment_threshold)
  # across all unflipped moments. Range [0.0, unbounded] but
  # typically [0.0, 1.5].

  result = graph.query("""
    MATCH (m:Moment {flipped: false})
    WHERE m.threshold > 0
    RETURN avg(m.energy * m.weight / m.threshold) AS avg_pressure,
           max(m.energy * m.weight / m.threshold) AS max_pressure,
           count(m) AS moment_count
  """)

  IF result IS EMPTY OR result[0].moment_count == 0:
    RETURN 0.0

  RETURN result[0].avg_pressure OR 0.0
```

---

## P6. Phase 4: Flip (Moment Detection)

Check all unflipped Moments. If salience exceeds threshold, the Moment flips irreversibly. Cooldown and concurrency limits prevent runaway cascades.

```
FUNCTION phase_flip(graph_name, current_tick):
  flipped_moments = []

  # Track active (recently flipped) moments per district for cooldown
  recent_flips = load_recent_flips(graph_name)
  # Structure: { district: last_flip_tick }

  # Count currently active events (not yet resolved)
  active_event_count = count_active_events(graph_name)

  # Fetch all unflipped moments with salience above 80% of threshold
  # (optimization: skip moments far from flipping)
  candidates = graph.query("""
    MATCH (m:Moment {flipped: false})
    WHERE m.energy * m.weight > m.threshold * 0.8
    RETURN m.id          AS id,
           m.description AS description,
           m.category    AS category,
           m.threshold   AS threshold,
           m.energy      AS energy,
           m.weight      AS weight,
           m.energy * m.weight AS salience
    ORDER BY salience DESC
  """)

  FOR moment in candidates:
    # Check: salience exceeds threshold
    IF moment.salience <= moment.threshold:
      CONTINUE

    # Check: district cooldown
    district = get_moment_district(graph_name, moment.id)
    IF district in recent_flips:
      IF current_tick - recent_flips[district] < COOLDOWN_TICKS:
        CONTINUE  # District is in cooldown. Moment held at threshold.

    # Check: concurrent event limit
    IF active_event_count >= MAX_CONCURRENT_ACTIVE_MOMENTS:
      # Check if this moment can preempt the weakest active event
      weakest_active = get_weakest_active_event(graph_name)
      IF weakest_active IS NOT None:
        severity = moment.salience / moment.threshold
        IF severity > weakest_active.severity:
          # Preempt: end weakest event, allow this flip
          end_event(weakest_active.event_id)
          active_event_count -= 1
        ELSE:
          CONTINUE  # Not severe enough to preempt. Suppressed.
      ELSE:
        CONTINUE

    # ── FLIP THE MOMENT ───────────────────────────────────
    severity = compute_severity(moment.salience, moment.threshold)

    graph.query("""
      MATCH (m:Moment {id: $mid})
      SET m.flipped  = true,
          m.severity = $severity,
          m.flip_tick = $tick
    """, {mid: moment.id, severity: severity, tick: current_tick})

    # Energy consumed by the flip (homeostasis mechanism 1)
    # The Moment absorbs all its energy. It does not redistribute.
    graph.query("""
      MATCH (m:Moment {id: $mid})
      SET m.energy = 0.0
    """, {mid: moment.id})

    # Drain energy from feeding narratives (they spent their energy)
    graph.query("""
      MATCH (n:Narrative)-[:FEEDS]->(m:Moment {id: $mid})
      SET n.energy = n.energy * 0.5
    """, {mid: moment.id})

    # Record flip
    flipped_moments.append({
      id:          moment.id,
      description: moment.description,
      category:    moment.category,
      severity:    severity,
      district:    district,
      tick:        current_tick,
    })

    # Update cooldown
    recent_flips[district] = current_tick
    active_event_count += 1

  save_recent_flips(graph_name, recent_flips)

  RETURN flipped_moments


FUNCTION compute_severity(salience, threshold):
  # How far above threshold the moment went.
  # Normalized to [0.0, 1.0] range.
  #   Just above threshold: ~0.1 (MINOR)
  #   2x threshold:         ~0.5 (NOTABLE)
  #   3x threshold:         ~0.7 (MAJOR)
  #   5x threshold:         ~0.9 (CRISIS)

  ratio = salience / threshold
  # Logarithmic mapping: severity = log2(ratio) / log2(5)
  # ratio 1.0 -> 0.0, ratio 2.0 -> 0.43, ratio 5.0 -> 1.0
  severity = log2(ratio) / log2(5.0)
  RETURN clamp(severity, 0.0, 1.0)


FUNCTION get_moment_district(graph_name, moment_id):
  # Determine which district a Moment belongs to by looking at
  # the citizens connected to its feeding narratives.

  result = graph.query("""
    MATCH (c:Character)-[:BELIEVES]->(n:Narrative)-[:FEEDS]->(m:Moment {id: $mid})
    RETURN c.district AS district, count(c) AS count
    ORDER BY count DESC
    LIMIT 1
  """, {mid: moment_id})

  IF result IS NOT EMPTY:
    RETURN result[0].district

  RETURN "unknown"
```

---

## P7. Phase 5: Inject (Economic Energy)

Economic data from Serenissima's 15-minute tick is translated into graph energy. The economy is a heat source, not a narrative author.

```
FUNCTION phase_inject(graph_name):
  total_injected = 0.0

  # Check if economic data has been updated since last inject
  econ_data = load_economic_deltas(graph_name)
  # Returns: list of { citizen_username, ducats_delta, mood_delta }
  # Computed by physics-bridge.js from Airtable citizen snapshots

  IF econ_data IS EMPTY:
    RETURN 0.0

  FOR delta in econ_data:
    citizen_id = "char_" + slugify(delta.citizen_username)

    # ── DUCATS DELTA → CHARACTER ENERGY ──────────────────
    # Losing money and gaining money both generate narrative energy.
    # A citizen who just gained 100 Ducats has stories to tell.
    # A citizen who just lost 100 Ducats has grievances to voice.

    IF abs(delta.ducats_delta) > 10:  # Threshold: ignore trivial changes
      energy_boost = abs(delta.ducats_delta) * ECONOMIC_ENERGY_FACTOR
      graph.query("""
        MATCH (c:Character {id: $cid})
        SET c.energy = c.energy + $boost
      """, {cid: citizen_id, boost: energy_boost})
      total_injected += energy_boost

    # ── MOOD DELTA → BELIEF ENERGY ───────────────────────
    # When a citizen's mood changes significantly, their existing
    # beliefs receive an energy boost. A citizen who becomes angry
    # energizes their grievances.

    IF abs(delta.mood_delta) > 0.2:  # Threshold: ignore minor mood shifts
      belief_boost = abs(delta.mood_delta) * MOOD_ENERGY_FACTOR

      graph.query("""
        MATCH (c:Character {id: $cid})-[b:BELIEVES]->(n:Narrative)
        SET n.energy = n.energy + $boost * b.confidence
      """, {cid: citizen_id, boost: belief_boost})
      total_injected += belief_boost

  # ── UPDATE DUCATS SNAPSHOT ─────────────────────────────
  # Store current ducats for next delta computation
  update_ducats_snapshot(graph_name, econ_data)

  # ── VISITOR ATTENTION INJECTION ────────────────────────
  # When a visitor discusses a topic related to a narrative,
  # that narrative receives a small energy boost.
  # The visitor's curiosity shapes the world.

  visitor_topics = load_visitor_conversation_topics(graph_name)
  # Returns: list of { narrative_id, topic_match_score }
  # Populated by conversation handler in citizens/mind module

  FOR topic in visitor_topics:
    IF topic.topic_match_score > 0.5:
      graph.query("""
        MATCH (n:Narrative {id: $nid})
        SET n.energy = n.energy + $boost
      """, {nid: topic.narrative_id, boost: VISITOR_ATTENTION_BOOST})
      total_injected += VISITOR_ATTENTION_BOOST

  clear_visitor_conversation_topics(graph_name)

  RETURN total_injected
```

---

## P8. Phase 6: Emit (Event Notification)

When Moments flip, the world must change. This phase emits event descriptors and invokes the Narrator agent for narrative consequences.

```
FUNCTION phase_emit(flipped_moments, graph_name):
  events = []

  FOR moment in flipped_moments:
    # ── BUILD EVENT DESCRIPTOR ───────────────────────────
    # The event descriptor is consumed by atmosphere, citizen
    # behavior, and audio modules. Each reads only its own fields.

    affected_citizens = get_affected_citizens(graph_name, moment.id)
    location = get_moment_location(graph_name, moment.id)

    event_descriptor = {
      event_id:   "evt_" + moment.id + "_" + str(moment.tick),
      category:   moment.category,
      severity:   moment.severity,
      location:   location,
      radius:     compute_event_radius(moment.severity),
      affected_citizens: affected_citizens,
      atmosphere: compute_atmosphere_delta(moment.category, moment.severity),
      citizen_behavior: compute_citizen_behavior(moment.category, moment.severity),
      audio:      compute_audio_changes(moment.category, moment.severity, location),
      duration_minutes: compute_event_duration(moment.severity),
      created_at: iso_now(),
    }

    # ── EMIT TO 3D WORLD ────────────────────────────────
    websocket.broadcast("world_event", event_descriptor)

    # ── INVOKE NARRATOR AGENT (async) ────────────────────
    # Narrator generates narrative consequences:
    #   - New Narrative nodes (aftermath, reaction)
    #   - New TENSION edges (event created new disagreements)
    #   - Modified BELIEVES edges (some citizens change their minds)
    #   - New Moment seeds (aftermath has its own breaking points)
    #
    # This is asynchronous. 3D effects are immediate.
    # Narrative consequences take a few seconds (Claude API call).

    narrator_context = build_narrator_context(graph_name, moment)
    spawn_async(invoke_narrator, narrator_context, graph_name)

    # ── CREATE WITNESS EDGES ─────────────────────────────
    # Citizens who were in the district become witnesses
    FOR citizen_id in affected_citizens:
      graph.query("""
        MATCH (c:Character {id: $cid}), (m:Moment {id: $mid})
        MERGE (c)-[:WITNESS]->(m)
      """, {cid: citizen_id, mid: moment.id})

    events.append(event_descriptor)

  RETURN events


FUNCTION compute_event_radius(severity):
  # MINOR:   50 units (one block)
  # NOTABLE: 150 units (district)
  # MAJOR:   300 units (multi-district)
  # CRISIS:  500 units (city-wide)

  IF severity < 0.3:
    RETURN 50
  ELSE IF severity < 0.6:
    RETURN 150
  ELSE IF severity < 0.9:
    RETURN 300
  ELSE:
    RETURN 500


FUNCTION compute_event_duration(severity):
  # MINOR:   60 minutes
  # NOTABLE: 360 minutes (6 hours)
  # MAJOR:   1440 minutes (24 hours)
  # CRISIS:  indefinite (until resolved by another event)

  IF severity < 0.3:
    RETURN 60
  ELSE IF severity < 0.6:
    RETURN 360
  ELSE IF severity < 0.9:
    RETURN 1440
  ELSE:
    RETURN -1  # Indefinite


FUNCTION compute_atmosphere_delta(category, severity):
  # Maps event category to atmospheric changes.
  # Values are deltas applied to current atmosphere state.

  templates = {
    "economic_crisis": {
      fog_delta:           +0.03 * severity,
      light_delta:         -0.15 * severity,
      particle_rate_delta: +10 * severity,
      ambient_volume_delta: -0.2 * severity,
    },
    "political_uprising": {
      fog_delta:           +0.02 * severity,
      light_delta:         -0.10 * severity,
      particle_rate_delta: +20 * severity,
      ambient_volume_delta: +0.3 * severity,
    },
    "celebration": {
      fog_delta:           -0.03 * severity,
      light_delta:         +0.20 * severity,
      particle_rate_delta: +15 * severity,
      ambient_volume_delta: +0.3 * severity,
    },
    "personal_tragedy": {
      fog_delta:           +0.01 * severity,
      light_delta:         -0.05 * severity,
      particle_rate_delta: 0,
      ambient_volume_delta: -0.3 * severity,
    },
    "guild_dispute": {
      fog_delta:           +0.01 * severity,
      light_delta:         -0.05 * severity,
      particle_rate_delta: +5 * severity,
      ambient_volume_delta: -0.1 * severity,
    },
    "trade_disruption": {
      fog_delta:           +0.02 * severity,
      light_delta:         -0.10 * severity,
      particle_rate_delta: +5 * severity,
      ambient_volume_delta: -0.15 * severity,
    },
  }

  RETURN templates.get(category, {
    fog_delta: 0, light_delta: 0, particle_rate_delta: 0, ambient_volume_delta: 0
  })


FUNCTION compute_citizen_behavior(category, severity):
  templates = {
    "economic_crisis": {
      gather_point:              None,
      posture_override:          "worried",
      movement_speed_multiplier: 0.6,
      conversation_topic_inject: "The market is failing. I have seen nothing like it.",
    },
    "political_uprising": {
      gather_point:              "district_center",
      posture_override:          "agitated",
      movement_speed_multiplier: 1.3,
      conversation_topic_inject: "Something must change. This cannot continue.",
    },
    "celebration": {
      gather_point:              "district_center",
      posture_override:          "celebratory",
      movement_speed_multiplier: 0.8,
      conversation_topic_inject: "What a day! Even strangers are welcome tonight.",
    },
    "personal_tragedy": {
      gather_point:              None,
      posture_override:          "solemn",
      movement_speed_multiplier: 0.5,
      conversation_topic_inject: "Something terrible happened. I cannot speak of it.",
    },
    "guild_dispute": {
      gather_point:              "guild_hall",
      posture_override:          "tense",
      movement_speed_multiplier: 0.7,
      conversation_topic_inject: "The guild is tearing itself apart.",
    },
    "trade_disruption": {
      gather_point:              None,
      posture_override:          "idle",
      movement_speed_multiplier: 0.5,
      conversation_topic_inject: "No ships. No work. What are we to do?",
    },
  }

  RETURN templates.get(category, {
    gather_point: None,
    posture_override: None,
    movement_speed_multiplier: 1.0,
    conversation_topic_inject: None,
  })


FUNCTION compute_audio_changes(category, severity, location):
  templates = {
    "economic_crisis": {
      ambient_layer: "market_distress",
      spatial_sources: [{
        type: "argument",
        position: [location.x, 0, location.z],
        volume: 0.5 * severity,
      }],
    },
    "political_uprising": {
      ambient_layer: "crowd_unrest",
      spatial_sources: [
        { type: "chanting", position: [location.x, 0, location.z], volume: 0.8 * severity },
        { type: "shouting", position: [location.x + 10, 0, location.z], volume: 0.6 * severity },
      ],
    },
    "celebration": {
      ambient_layer: "festival",
      spatial_sources: [
        { type: "music", position: [location.x, 0, location.z], volume: 0.7 * severity },
        { type: "laughter", position: [location.x - 5, 0, location.z + 5], volume: 0.5 * severity },
      ],
    },
    "personal_tragedy": {
      ambient_layer: "silence",
      spatial_sources: [],
    },
    "guild_dispute": {
      ambient_layer: "argument",
      spatial_sources: [{
        type: "heated_debate",
        position: [location.x, 0, location.z],
        volume: 0.6 * severity,
      }],
    },
    "trade_disruption": {
      ambient_layer: "harbor_quiet",
      spatial_sources: [],
    },
  }

  RETURN templates.get(category, { ambient_layer: None, spatial_sources: [] })
```

---

## P9. Narrator Agent Invocation

Asynchronous. Called after a Moment flips. Generates narrative consequences.

```
FUNCTION invoke_narrator(narrator_context, graph_name):
  # The Narrator agent receives the context of the flipped moment
  # and generates consequences that reshape the graph.

  prompt = build_narrator_prompt(narrator_context)

  # Call Claude API
  response = claude_api.call(
    model:       "claude-sonnet-4-20250514",
    system:      NARRATOR_SYSTEM_PROMPT,
    messages:    [{ role: "user", content: prompt }],
    max_tokens:  1000,
    temperature: 0.7,
  )

  consequences = parse_narrator_response(response)

  # ── APPLY CONSEQUENCES ─────────────────────────────────

  FOR narrative in consequences.new_narratives:
    narr_id = generate_narrative_id(narrative)
    graph.query("""
      CREATE (n:Narrative {
        id:      $id,
        content: $content,
        truth:   $truth,
        energy:  $energy,
        weight:  $weight,
        type:    $type,
        source:  'narrator'
      })
    """, {
      id: narr_id,
      content: narrative.content,
      truth: narrative.truth,
      energy: narrative.initial_energy,
      weight: narrative.initial_weight,
      type: narrative.type,
    })

    # Assign belief to affected citizens
    FOR citizen_id in narrative.affected_citizens:
      graph.query("""
        MATCH (c:Character {id: $cid}), (n:Narrative {id: $nid})
        MERGE (c)-[:BELIEVES {
          confidence: $conf,
          source: 'event',
          heard_at: $now
        }]->(n)
      """, {cid: citizen_id, nid: narr_id, conf: narrative.belief_confidence, now: iso_now()})

  FOR tension in consequences.new_tensions:
    graph.query("""
      MATCH (n1:Narrative {id: $id1}), (n2:Narrative {id: $id2})
      MERGE (n1)-[:TENSION {strength: $strength}]-(n2)
    """, {id1: tension.narrative_a, id2: tension.narrative_b, strength: tension.initial_strength})

  FOR belief_change in consequences.belief_changes:
    update_belief_confidence(
      belief_change.citizen_id,
      belief_change.narrative_id,
      belief_change.new_confidence,
      "event"
    )

  # ── SEED NEW MOMENTS (with escalated thresholds) ───────
  FOR new_moment in consequences.new_moments:
    # Homeostasis mechanism 2: aftermath moments have higher thresholds
    escalated_threshold = new_moment.suggested_threshold * THRESHOLD_ESCALATION_FACTOR

    graph.query("""
      CREATE (m:Moment {
        id:          $id,
        description: $desc,
        threshold:   $threshold,
        flipped:     false,
        category:    $category,
        energy:      0.0,
        weight:      1.0
      })
    """, {
      id: generate_moment_id(new_moment),
      desc: new_moment.description,
      threshold: escalated_threshold,
      category: new_moment.category,
    })

  # Emit narrative_update so citizen context caches refresh
  websocket.broadcast("narrative_update", {
    source_moment: narrator_context.moment_id,
    new_narratives: len(consequences.new_narratives),
    new_tensions: len(consequences.new_tensions),
  })
```

---

## P10. Anti-Runaway Homeostasis

Five mechanisms prevent the system from entering runaway cascades or settling into permanent stasis.

```
FUNCTION homeostasis_check(graph_name):
  # Called after every tick. Monitors system health and applies
  # corrections if the system is drifting outside the healthy band.

  # ── MECHANISM 1: Energy Conservation (applied in phase_flip) ──
  # Moment flips consume energy. Already applied.

  # ── MECHANISM 2: Threshold Escalation (applied in invoke_narrator) ──
  # New moments after flips have higher thresholds. Already applied.

  # ── MECHANISM 3: District Cooldown (applied in phase_flip) ──
  # No same-district flip within COOLDOWN_TICKS. Already applied.

  # ── MECHANISM 4: Criticality Targeting ────────────────────
  # Dynamic decay rate adjustment. Already applied in compute_effective_decay().

  # ── MECHANISM 5: Active Moment Cap ────────────────────────
  # Maximum 3 active moments simultaneously.
  # Applied in phase_flip via MAX_CONCURRENT_ACTIVE_MOMENTS.

  # ── ADDITIONAL CHECK: Stasis Detection ────────────────────
  # If the system has been too quiet for too long, inject energy.

  avg_pressure = compute_average_pressure(graph_name)
  max_narrative_energy = graph.query("""
    MATCH (n:Narrative)
    RETURN max(n.energy) AS max_e
  """)[0].max_e OR 0.0

  action = None

  IF avg_pressure < 0.1 AND max_narrative_energy < 0.1:
    # System is in stasis. No narratives have meaningful energy.
    # No moments are approaching threshold.
    # Recommendation: trigger economic injection or Forestiere news.
    action = {
      type: "stasis_detected",
      avg_pressure: avg_pressure,
      max_energy: max_narrative_energy,
      recommendation: "inject_energy",
    }

  IF avg_pressure > CRITICALITY_TARGET_MAX * 1.5:
    # System is overheating dangerously. Multiple moments may
    # be near threshold simultaneously.
    action = {
      type: "overheat_detected",
      avg_pressure: avg_pressure,
      recommendation: "increased_decay",
    }

  # ── TENSION CLEANUP ────────────────────────────────────
  # If a tension edge's connected narratives have both decayed
  # below threshold, the tension should also weaken.
  graph.query("""
    MATCH (n1:Narrative)-[t:TENSION]-(n2:Narrative)
    WHERE n1.energy < 0.01 AND n2.energy < 0.01
    SET t.strength = t.strength * 0.9
  """)

  # Remove dead tensions
  graph.query("""
    MATCH (n1:Narrative)-[t:TENSION]-(n2:Narrative)
    WHERE t.strength < 0.01
    DELETE t
  """)

  RETURN action
```

---

## P11. Economic Bridge: Airtable to Energy

The bridge between the deterministic Serenissima economy and the emergent narrative physics. Runs every 15 minutes, aligned with economy tick.

```
FUNCTION economic_bridge_tick(graph_name = "venezia", airtable_config):
  # Called by physics-bridge.js every 15 minutes after economy tick.
  # Reads citizen economic changes and writes energy deltas
  # for the next physics tick to consume.

  # Fetch current citizen state from Airtable
  current_citizens = airtable.list_records("CITIZENS", airtable_config)

  # Load previous snapshot
  previous_snapshot = load_json("state/economic_snapshot.json")
  IF previous_snapshot IS None:
    # First run: take snapshot, no deltas
    save_economic_snapshot(current_citizens)
    RETURN []

  deltas = []

  FOR citizen in current_citizens:
    username = citizen.fields.Username
    current_ducats = citizen.fields.Ducats OR 0
    current_mood_valence = compute_mood_valence(citizen)

    previous = previous_snapshot.get(username, {})
    previous_ducats = previous.get("ducats", current_ducats)
    previous_mood = previous.get("mood_valence", current_mood_valence)

    ducats_delta = current_ducats - previous_ducats
    mood_delta = current_mood_valence - previous_mood

    IF abs(ducats_delta) > 10 OR abs(mood_delta) > 0.2:
      deltas.append({
        citizen_username: username,
        ducats_delta: ducats_delta,
        mood_delta: mood_delta,
      })

    # Update character ducats in graph (snapshot, not energy)
    graph.query("""
      MATCH (c:Character {id: $cid})
      SET c.ducats = $ducats
    """, {cid: "char_" + slugify(username), ducats: current_ducats})

  # Save deltas for next physics tick to consume
  save_json("state/economic_deltas.json", deltas)

  # Save new snapshot
  save_economic_snapshot(current_citizens)

  RETURN deltas


FUNCTION compute_mood_valence(citizen):
  # Scalar mood valence from citizen fields.
  # Positive = happy/content. Negative = angry/sad/fearful.
  # Range: [-1.0, 1.0]

  ducats = citizen.fields.Ducats OR 0
  has_home = citizen.fields.HomeBuilding IS NOT None
  has_job = citizen.fields.Workplace IS NOT None

  valence = 0.0

  IF ducats > 500:   valence += 0.3
  IF ducats < 50:    valence -= 0.3
  IF ducats < 10:    valence -= 0.4
  IF has_home:       valence += 0.2
  IF NOT has_home:   valence -= 0.4
  IF has_job:        valence += 0.1
  IF NOT has_job:    valence -= 0.3

  RETURN clamp(valence, -1.0, 1.0)
```

---

## P12. Tick Timing and Scheduling

```
FUNCTION run_physics_loop(graph_name = "venezia"):
  # Main loop. Called by physics-bridge.js or a scheduler.
  # Runs physics tick every 5 minutes. Economy bridge every 15 minutes.

  tick_count = load_tick_count(graph_name) OR 0
  last_economy_tick = 0

  LOOP FOREVER:
    start_time = now()

    # Determine time of day from Venice time
    time_of_day = get_venice_time()

    # Run physics tick
    result = physics_tick(graph_name, tick_count, time_of_day)

    # Log tick stats
    log_tick_result(result)

    # Every 3rd tick (15 minutes), run economy bridge
    IF tick_count - last_economy_tick >= 3:
      economic_bridge_tick(graph_name, airtable_config)
      last_economy_tick = tick_count

    tick_count += 1
    save_tick_count(graph_name, tick_count)

    # Sleep until next tick
    elapsed = now() - start_time
    sleep_time = max(0, TICK_INTERVAL_MINUTES * 60 - elapsed)
    sleep(sleep_time)
```

---

## P13. Diagnostic Functions

```
FUNCTION get_tick_diagnostics(graph_name = "venezia"):
  # Returns a diagnostic snapshot for developer monitoring.
  # NOT exposed to visitors.

  avg_pressure = compute_average_pressure(graph_name)
  effective_decay = compute_effective_decay(graph_name)

  energy_stats = graph.query("""
    MATCH (n)
    WHERE n.energy IS NOT NULL
    RETURN labels(n)[0] AS type,
           count(n)     AS count,
           sum(n.energy) AS total_energy,
           avg(n.energy) AS avg_energy,
           max(n.energy) AS max_energy
  """)

  tension_stats = graph.query("""
    MATCH ()-[t:TENSION]-()
    RETURN count(t) / 2  AS count,
           sum(t.strength) / 2 AS total_strength,
           max(t.strength) AS max_strength
  """)

  moment_stats = graph.query("""
    MATCH (m:Moment)
    RETURN m.flipped AS flipped,
           count(m) AS count,
           avg(m.energy * m.weight) AS avg_salience
  """)

  RETURN {
    avg_pressure:    avg_pressure,
    effective_decay: effective_decay,
    energy_by_type:  energy_stats,
    tension_summary: tension_stats[0],
    moment_summary:  moment_stats,
    homeostasis_state: {
      pressure_zone:  "low" IF avg_pressure < CRITICALITY_TARGET_MIN
                      ELSE "target" IF avg_pressure < CRITICALITY_TARGET_MAX
                      ELSE "high",
      decay_rate:     effective_decay,
      decay_vs_base:  effective_decay / DECAY_RATE,
    },
  }
```

---

## P14. Cross-Module Interfaces

```
EXPORTS TO narrative/graph:
  physics_tick()           -> called via physics-bridge.js scheduler
  economic_bridge_tick()   -> called after Serenissima economy tick
  compute_average_pressure() -> for graph health check

EXPORTS TO narrative/events:
  phase_emit()             -> event descriptors for 3D world
  invoke_narrator()        -> narrative consequences (async)

EXPORTS TO citizens/mind:
  (indirect) atmosphere deltas via WebSocket broadcast
  (indirect) citizen behavior changes via event descriptors

IMPORTS FROM narrative/graph:
  GraphQueries / GraphOps  -> all graph reads and writes
  get_citizen_beliefs()    -> for energy pump calculation
  get_active_tensions()    -> for tension routing

IMPORTS FROM Serenissima Airtable:
  CITIZENS table           -> economic deltas for injection
  Economy tick timing      -> triggers economic_bridge_tick
```
