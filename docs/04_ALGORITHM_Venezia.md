# ALGORITHM: Venezia — How It Works

Procedural descriptions of every system. No code — pseudocode and data flows.

---

## A1. World Tick (Master Loop)

The world runs on overlapping cycles. No single clock — each system has its own rhythm.

```
EVERY 3 SECONDS:
  - Sync citizen positions to all connected clients (WebSocket broadcast)
  - Update ambient audio mix based on nearby citizens and events

EVERY 30 SECONDS:
  - Evaluate citizen proximity to visitor → trigger awareness/conversation if threshold met
  - AI citizen wander: update paths for ambient citizens within loaded districts

EVERY 5 MINUTES (Physics Tick):
  - Run Blood Ledger physics: propagate energy, apply decay, compute tension
  - Check for Moment flips (tension > threshold)
  - If flip: trigger event → notify affected citizens → update world state

EVERY 15 MINUTES (Economy Tick):
  - Process pending Serenissima activities (production, trade, movement)
  - Compute citizen mood updates (financial + social + health → emotional state)
  - Execute pending stratagems
  - Update market prices

EVERY 1 HOUR (World Advance):
  - Advance time-of-day (dawn/morning/midday/afternoon/evening/night)
  - Process news propagation (events spread through social graph)
  - Run World Runner agent: advance background storylines
  - Spawn/despawn ambient citizens based on time of day

EVERY 24 HOURS (Daily Reset):
  - Process daily income/expenses for all citizens
  - Compute daily mood baseline
  - Archive old activities, prune stale graph nodes
  - Forestiere arrival: new external news injected
```

---

## A2. Citizen Rendering Pipeline

### Tier Assignment
```
FOR each citizen:
  distance = distance_to_visitor(citizen.position, visitor.position)
  relationship = get_trust_score(citizen, visitor)
  activity_importance = citizen.current_activity.priority

  IF distance < 20m AND (relationship > 0 OR activity_importance > HIGH):
    tier = FULL          # Deep interaction possible
  ELSE IF distance < 80m:
    tier = ACTIVE         # Visible, audible, basic interaction
  ELSE IF distance < 200m:
    tier = AMBIENT        # Silhouette, murmur
  ELSE:
    tier = HIDDEN          # Not rendered
```

### Rendering by Tier
```
FULL:
  - 3D avatar with personality-appropriate appearance
  - Lip sync on speech (viseme-driven)
  - Facial expression mapped to mood (happy, worried, angry, sad)
  - Hand gestures during conversation
  - Full spatial audio (voice, footsteps, activity sounds)
  - Shadow and lighting interaction

ACTIVE:
  - Simplified avatar (lower poly, fewer animations)
  - Spatial audio (ambient voice, not intelligible until closer)
  - Path-following movement (scheduled activity routes)
  - Basic mood expression (posture: upright=happy, slouched=sad)

AMBIENT:
  - Silhouette or minimal geometry
  - Crowd murmur audio contribution
  - Drift movement (random walk within district bounds)
  - No individual identity visible (just "a person")
```

---

## A3. Encounter & Conversation

### Proximity Trigger
```
WHEN visitor enters 15m radius of FULL/ACTIVE citizen:
  1. citizen.awareness = TRUE
  2. citizen rotates slightly toward visitor
  3. IF citizen is in conversation with another citizen:
       conversation continues but may acknowledge visitor
  4. IF citizen is idle:
       citizen may initiate greeting (probability based on personality.openness)

WHEN visitor enters 3m AND speaks (STT detected):
  1. Transcribe visitor speech (Whisper STT)
  2. Build citizen context:
     context = {
       citizen_identity: citizen.personality + citizen.backstory,
       citizen_memory: last 10 interactions with this visitor,
       citizen_mood: current_mood(),
       citizen_economic: { ducats, income, debts, employment },
       citizen_relationships: relevant trust scores,
       citizen_beliefs: active narratives from Blood Ledger graph,
       citizen_activity: what they were doing before visitor spoke,
       visitor_history: what visitor said in previous encounters,
       world_state: recent events in this district,
       visitor_speech: transcribed text
     }
  3. Send to KinOS (Claude API) with citizen's CLAUDE.md system prompt
  4. Receive response text
  5. Synthesize speech (ElevenLabs TTS, citizen-specific voice)
  6. Play spatially positioned audio at citizen's 3D location
  7. Store interaction in citizen.cascade/memories/
  8. Update trust score: trust += f(conversation_quality, visitor_history)
```

### Multi-Turn Conversation
```
WHILE visitor remains within 5m AND conversation active:
  - Each visitor utterance → full context rebuild → response
  - Context includes full conversation so far (up to 10 turns)
  - Citizen may end conversation: "I need to get back to work" (based on activity schedule)
  - Citizen may shift topic based on internal preoccupation
  - Citizen may reference previous visits naturally
```

---

## A4. Blood Ledger Physics (Narrative Engine)

### Graph Structure (FalkorDB)
```
NODES:
  Character(id, name, energy, weight, class, mood)    ← maps 1:1 to Serenissima citizens
  Narrative(id, content, truth, energy, weight)        ← beliefs, rumors, events, debts
  Place(id, name, district, position)                  ← maps to 3D locations
  Moment(id, description, threshold, flipped)          ← potential events waiting to happen

EDGES:
  BELIEVES(character → narrative, confidence, source)  ← who believes what
  AT(character → place)                                ← where they are
  TENSION(narrative ↔ narrative, strength)             ← contradicting beliefs under pressure
  SUPPORTS(narrative → narrative)                       ← reinforcing beliefs
  WITNESS(character → moment)                           ← who was there when it happened
```

### Physics Tick Procedure
```
FUNCTION physics_tick():
  # 1. Characters pump energy into what they believe
  FOR each character C:
    FOR each narrative N where C BELIEVES N:
      N.energy += C.energy * confidence(C, N) * PUMP_RATE

  # 2. Energy routes through narrative network
  FOR each narrative N:
    FOR each narrative M where N SUPPORTS M:
      M.energy += N.energy * ROUTE_FACTOR
    FOR each narrative M where N TENSION M:
      tension_strength(N, M) += (N.energy + M.energy) * TENSION_FACTOR

  # 3. Decay all energy
  FOR each node:
    node.energy *= (1 - DECAY_RATE)   # DECAY_RATE = 0.02

  # 4. Check for Moment flips
  FOR each moment M where M.flipped == FALSE:
    salience = M.weight * M.energy
    IF salience > M.threshold:
      flip_moment(M)

FUNCTION flip_moment(M):
  # A potential event becomes actual
  M.flipped = TRUE
  # Trigger narrative consequences via Narrator agent
  consequences = narrator_agent.generate_consequences(M, graph_context)
  # Apply consequences: new narratives, changed beliefs, citizen reactions
  FOR each consequence in consequences:
    apply_to_graph(consequence)
  # Notify 3D world of event
  broadcast_event(M, affected_citizens, location)
```

---

## A5. World State → 3D Rendering Bridge

### Event Broadcast
```
WHEN flip_moment(M) occurs:
  event = {
    type: M.category,          # "economic_crisis", "political_uprising", "personal_tragedy"
    location: M.place.position, # 3D coordinates
    severity: M.salience,
    affected_citizens: [...],
    description: M.description
  }

  # Send via WebSocket to all connected clients
  ws.broadcast("world_event", event)

CLIENT-SIDE RESPONSE:
  SWITCH event.type:
    "economic_crisis":
      - Reduce goods on nearby market stalls
      - Citizens in area become agitated (movement speed up, gestures change)
      - Ambient audio: worried murmurs, market sounds reduce
    "political_uprising":
      - Citizens gather at event location
      - Shouting audio plays spatially
      - Ambient lighting shifts (torches if night)
    "personal_tragedy":
      - Affected citizen changes posture (sits, crouches, covers face)
      - Nearby citizens approach or avoid depending on relationship
      - Audio: silence spreading outward from the event
```

### Mood → Atmosphere Mapping
```
FUNCTION compute_district_atmosphere(district):
  citizens_in_district = get_citizens_in(district)
  avg_mood = mean(c.mood.valence for c in citizens_in_district)
  tension_level = sum(active_tensions in district) / max_tensions

  atmosphere = {
    fog_density: lerp(0.01, 0.08, tension_level),
    fog_color: lerp(WARM_GOLD, COLD_GREY, 1 - avg_mood),
    light_intensity: lerp(0.6, 1.0, avg_mood),
    particle_rate: lerp(5, 50, tension_level),    # more particles = more tension
    ambient_volume: lerp(0.3, 0.8, len(citizens_in_district) / 50),
  }

  return atmosphere
```

---

## A6. Visitor Identity & Persistence

### First Visit
```
visitor_id = generate_uuid()
store in localStorage (browser) or headset storage (VR)

Entry point: random dock in first available district
No name assigned — citizens call you "Forestiere" or "stranger"

After first meaningful conversation (> 3 exchanges):
  citizen may ask: "What should I call you?"
  visitor's spoken name → stored as visitor.name
  future encounters with this citizen use the name
  name propagates: citizens who talk about visitor use it
```

### Return Visit
```
LOAD visitor_id from storage
QUERY all citizen memories containing visitor_id
Reconstruct visitor reputation:
  - Which citizens know them (by id)
  - Trust scores per citizen
  - Last known location
  - Accumulated narrative connections (visitor beliefs in graph)

Place visitor at last departure location
Citizens within awareness range may acknowledge return
```

---

## A7. Serenissima Data → 3D World Mapping

### Position Translation
```
Serenissima citizen positions: {"lat": 45.4371, "lng": 12.3358}
Venice real coordinates → 3D world coordinates:

FUNCTION geo_to_world(lat, lng):
  # Venice bounding box: lat [45.42, 45.45], lng [12.30, 12.38]
  x = (lng - 12.30) / (12.38 - 12.30) * WORLD_WIDTH   # e.g., 1000 units
  z = (lat - 45.42) / (45.45 - 45.42) * WORLD_DEPTH    # e.g., 800 units
  y = terrain_height(x, z)                                # above water/ground
  return (x, y, z)
```

### Building Placement
```
FOR each building in Serenissima.BUILDINGS:
  position = geo_to_world(building.lat, building.lng)
  type = building.category   # home, business, transport, storage
  size = building.size_tier  # small, medium, large

  mesh = generate_venetian_building(type, size, building.seed)
  place_at(position, mesh)

  IF building.has_market_stall:
    add_market_display(position, building.current_goods)
```

### District Generation
```
FOR each district:
  polygon = district.boundary_coordinates → world coordinates

  FILL polygon with:
    - Water (canals): procedural Bezier curves within district
    - Ground (fondamenta): walkable paths along canal edges
    - Buildings: placed from Serenissima data + procedural fill
    - Bridges: connecting ground segments across canals
    - Vegetation: sparse (Venice has little greenery)
    - Props: market stalls, crates, boats, laundry lines, lanterns
```
