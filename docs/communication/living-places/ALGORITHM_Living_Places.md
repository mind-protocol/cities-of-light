# ALGORITHM: Living Places

```
STATUS: DESIGNING
PURPOSE: How real-time multi-participant communication works through the graph
UPDATED: 2026-03-13
CHAIN: OBJECTIVES → PATTERNS → BEHAVIORS → ALGORITHM → VALIDATION → HEALTH → IMPLEMENTATION → SYNC
```

---

## Chain

```
OBJECTIVES:      ./OBJECTIVES_Living_Places.md
PATTERNS:        ./PATTERNS_Living_Places.md
BEHAVIORS:       ./BEHAVIORS_Living_Places.md
THIS:            ALGORITHM_Living_Places.md (you are here)
VALIDATION:      ./VALIDATION_Living_Places.md
HEALTH:          ./HEALTH_Living_Places.md
IMPLEMENTATION:  ./IMPLEMENTATION_Living_Places.md
SYNC:            ./SYNC_Living_Places.md

IMPL:            src/server/place-server.js
                 src/server/moment-pipeline.js
                 src/server/graph-client.js
```

> **Contract:** Read docs before modifying. After changes: update IMPL or add TODO to SYNC.

---

## Objectives and Behaviors

| Objective | Behaviors Supported | Why This Algorithm Matters |
|-----------|---------------------|----------------------------|
| S1 (Real-time) | B2, B3, B4, B6 | Place Server manages rooms + Moment Pipeline delivers in < 500ms |
| S2 (Mixed AI+human) | B2, B3, B8 | MCP Bridge + Web Bridge share identical protocol |
| S5 (Universal renderer) | B3, B4, B5 | Per-renderer delivery in Moment Pipeline |
| S6 (Persistence) | B3, B10 | Graph write in Moment Pipeline |

---

## Overview

Living Places converts spatial presence into real-time communication. The algorithm has 3 layers: the Place Server (manages rooms and WebSocket connections), the Moment Pipeline (converts input → graph Moment → renderer output), and the Bridge Layer (connects different participant types: AI via MCP, human via browser, human via VR).

V1 focuses on the first two layers with a web renderer. V3 adds spatial awareness.

---

## Data Structures

### Place (Space node)

```
{
  node_type: "space",
  type: "place",
  id: "place:{uuid}",
  name: "Council Chamber",
  content: "{description of the place}",
  synthesis: "{embedding text}",
  capacity: 7,
  access_level: "invite" | "public" | "private",
  ambient: {
    atmosphere: "formal" | "casual" | "intimate" | "public",
    sound: "quiet" | "murmur" | "lively" | "loud",
    visual: "dim" | "bright" | "natural" | "candlelit"
  },
  position: { lat: float, lng: float } | null,  // Venice coords (V3)
  building_id: "building:{id}" | null,           // linked Venice building (V3)
  status: "active" | "empty" | "archived"
}
```

### Presence (AT link from Actor to Place)

```
{
  source: "actor:{citizen_id}",
  target: "place:{uuid}",
  type: "AT",
  attention: "active" | "passive" | "away",
  renderer: "web" | "vr" | "mcp" | "cli" | "headless",
  position: { x, y, z } | null,  // position within place (V3)
  joined_at: ISO8601,
  last_active: ISO8601
}
```

### Utterance (Moment node)

```
{
  node_type: "moment",
  type: "utterance",
  id: "moment:{uuid}",
  space_id: "place:{uuid}",
  actor_id: "actor:{citizen_id}",
  content: "{text content}",
  synthesis: "{embedding text for search}",
  source: "text" | "voice" | "gesture" | "system",
  attachments: [
    {
      type: "image" | "document" | "link" | "screen" | "webcam" | "pov",
      url: "...",
      description: "...",
      size_bytes: int
    }
  ],
  position: { x, y, z } | null,  // speaker position (V3)
  energy: float,                   // initial energy from speaker weight
  timestamp: ISO8601
}
```

---

## Algorithm: V1 Place Server

### Architecture

```
                    ┌─────────────────────────────┐
                    │        Place Server          │
                    │  (Node.js + WebSocket)       │
                    │                              │
                    │  ┌──────────┐ ┌──────────┐   │
                    │  │ Room     │ │ Room     │   │
                    │  │ State    │ │ State    │   │
                    │  └──────────┘ └──────────┘   │
                    │         │           │        │
                    │    ┌────┴───────────┴────┐   │
                    │    │   Moment Pipeline   │   │
                    │    └────────────────────┘   │
                    └──────┬──────────┬──────────┘
                           │          │
              ┌────────────┤          ├────────────┐
              │            │          │            │
         ┌────┴────┐  ┌───┴────┐ ┌───┴────┐  ┌───┴────┐
         │ Web UI  │  │  MCP   │ │  VR    │  │  CLI   │
         │ (human) │  │  (AI)  │ │ (human)│  │ (dev)  │
         └─────────┘  └────────┘ └────────┘  └────────┘
```

### Room State

```
FUNCTION create_room(name, capacity, access_level, ambient, creator_id):

  // Create Space node in graph
  space = graph.create_node(
    node_type="space", type="place",
    name=name, capacity=capacity,
    access_level=access_level, ambient=ambient,
    status="active"
  )

  // In-memory room state (for real-time, not persisted)
  room = {
    space_id: space.id,
    participants: Map(),         // actor_id → { ws, renderer, attention, position }
    moment_buffer: RingBuffer(100),  // last 100 Moments for new joiners
    created_at: now()
  }

  RETURN room
```

### Join Flow

```
FUNCTION join_room(actor_id, space_id, renderer, ws_connection):

  room = get_room(space_id)

  // Access check
  IF room.access_level == "private" AND NOT is_invited(actor_id, space_id):
    REJECT "Not invited"

  IF room.participants.size >= room.capacity:
    REJECT "Room at capacity"

  // Create AT link in graph
  graph.create_link(actor_id, space_id, type="AT",
    attention="active", renderer=renderer, joined_at=now())

  // Add to in-memory state
  room.participants.set(actor_id, {
    ws: ws_connection,
    renderer: renderer,
    attention: "active",
    position: null
  })

  // Deliver history
  history = room.moment_buffer.last(50)
  send_to(ws_connection, { type: "HISTORY", moments: history })

  // Broadcast join to all participants
  broadcast(room, {
    type: "PARTICIPANT_JOINED",
    actor_id: actor_id,
    renderer: renderer,
    participant_count: room.participants.size
  })
```

### Moment Pipeline

```
FUNCTION handle_input(actor_id, space_id, input):

  room = get_room(space_id)

  // Validate presence
  IF NOT room.participants.has(actor_id):
    REJECT "Not in room"

  // Create Moment from input
  moment = {
    node_type: "moment",
    type: "utterance",
    id: generate_uuid(),
    space_id: space_id,
    actor_id: actor_id,
    timestamp: now(),
    energy: get_actor_weight(actor_id) * 0.1
  }

  SWITCH input.source:
    CASE "text":
      moment.content = input.text
      moment.source = "text"

    CASE "voice":
      // Human voice → Whisper STT
      transcription = await whisper_transcribe(input.audio_buffer)
      moment.content = transcription.text
      moment.source = "voice"

    CASE "media":
      moment.content = input.description OR ""
      moment.source = "text"
      moment.attachments = [{ type: input.media_type, url: input.url, description: input.description }]

  // Persist to graph
  graph.create_node(moment)
  graph.create_link(moment.id, space_id, type="IN")
  graph.create_link(actor_id, moment.id, type="CREATED")

  // Buffer for late joiners
  room.moment_buffer.push(moment)

  // Broadcast to all participants
  FOR each (pid, participant) in room.participants:
    IF pid == actor_id:
      CONTINUE  // don't echo back to sender (unless renderer needs it)

    SWITCH participant.renderer:
      CASE "web":
        send_to(participant.ws, { type: "MOMENT", moment: moment })
        // If voice mode: also generate TTS for AI moments
        IF moment_from_ai(actor_id) AND participant.voice_enabled:
          audio = await tts_generate(moment.content, get_voice_id(actor_id))
          send_to(participant.ws, { type: "AUDIO", moment_id: moment.id, audio: audio })

      CASE "mcp":
        // Deliver to AI citizen's MCP connection
        send_to(participant.ws, { type: "MOMENT", moment: moment })
        // AI partner will process and may respond

      CASE "vr":
        send_to(participant.ws, { type: "MOMENT", moment: moment, position: get_position(actor_id) })
        // VR renderer handles spatial audio placement

      CASE "cli":
        send_to(participant.ws, { type: "MOMENT", moment: moment })
```

### AI Citizen Participation (MCP Bridge)

```
FUNCTION ai_citizen_bridge(actor_id, space_id):

  // AI joins the room via MCP tool
  ws = create_mcp_websocket(actor_id)
  join_room(actor_id, space_id, "mcp", ws)

  // Listen for Moments
  ws.on("MOMENT", async (moment) => {

    // Build context for AI response
    context = {
      place: get_space_properties(space_id),    // ambient, atmosphere
      participants: get_participant_list(space_id),
      recent_moments: get_recent_moments(space_id, 20),
      citizen_values: get_citizen_beliefs(actor_id),  // from graph
      citizen_mood: compute_mood(actor_id)             // from POC-Mind
    }

    // AI partner decides whether to respond
    // (The AI may stay silent — not every Moment requires a response)
    response = await ai_partner_process(actor_id, context, moment)

    IF response:
      handle_input(actor_id, space_id, { source: "text", text: response.text })
  })
```

### Human Voice Bridge (WebRTC + STT/TTS)

```
FUNCTION human_voice_bridge(actor_id, space_id, webrtc_connection):

  // Human speaks → audio chunks arrive via WebRTC
  audio_buffer = new AudioBuffer(3_SECONDS)

  webrtc_connection.on("audio_chunk", (chunk) => {
    audio_buffer.append(chunk)

    // When silence detected or buffer full:
    IF detect_silence(audio_buffer) OR audio_buffer.is_full():
      // STT
      transcription = await whisper_transcribe(audio_buffer.flush())

      IF transcription.text.trim():
        handle_input(actor_id, space_id, {
          source: "voice",
          audio_buffer: audio_buffer.raw(),
          text: transcription.text
        })
  })

  // AI moments → TTS → audio to human
  ws.on("MOMENT", async (moment) => {
    IF moment_from_ai(moment.actor_id):
      voice_id = get_voice_id(moment.actor_id)
      audio = await elevenlabs_tts(moment.content, voice_id)
      webrtc_connection.send_audio(audio)
  })
```

---

## Algorithm: V3 Spatial Extensions

### Distance-Based Attenuation

```
FUNCTION spatial_broadcast(room, moment, speaker_position):

  FOR each (pid, participant) in room.participants:
    IF NOT participant.position:
      // Non-spatial participant (web, CLI) → full volume
      deliver(participant, moment, volume=1.0)
      CONTINUE

    distance = euclidean(speaker_position, participant.position)

    // Inverse-square attenuation, clamped
    volume = min(1.0, 1.0 / (1.0 + (distance / HEARING_RADIUS) ^ 2))

    IF volume < 0.05:
      CONTINUE  // too far to hear

    deliver(participant, moment, volume=volume)
```

### Ambient Context Assembly

```
FUNCTION build_ambient_context(space_id):

  space = get_space(space_id)

  context = {
    name: space.name,
    atmosphere: space.ambient.atmosphere,
    sound_level: space.ambient.sound,
    lighting: space.ambient.visual,
  }

  // Venice-specific enrichment (V3)
  IF space.position:
    context.district = get_district(space.position)
    context.time_of_day = get_venice_time()
    context.weather = get_venice_weather()
    context.nearby_activity = get_nearby_moments(space.position, radius=50)

  // Building-specific
  IF space.building_id:
    building = get_building(space.building_id)
    context.building_type = building.category
    context.building_name = building.name

  RETURN context
```

---

## Data Flow

### V1: Web Meeting Room

```
Human types or speaks
    │
    ├─ Text → WebSocket → Place Server → Moment Pipeline
    │
    └─ Voice → WebRTC → Whisper STT → text → Moment Pipeline
                                                    │
                                                    ▼
                                          Create Moment node
                                          Store in graph
                                          Buffer for history
                                                    │
                                    ┌───────────────┼───────────────┐
                                    │               │               │
                               Web humans      AI citizens      VR humans
                                    │               │               │
                               Text stream     MCP delivery    Spatial audio
                               + TTS audio     AI processes     + avatar
                                               May respond
```

### V3: Venice Tavern

```
Same pipeline as V1, plus:

Speaker position → spatial_broadcast() → distance attenuation per listener

Place ambient → ambient_context_assembly() → injected into AI prompts

3D POV sharing → Three.js render-to-texture → WebRTC video track → other participants
```

---

## Complexity

| Operation | Time | Notes |
|-----------|------|-------|
| Create Moment | O(1) | Graph write |
| Broadcast to N participants | O(N) | WebSocket send per participant |
| Spatial attenuation (V3) | O(N) | Distance calc per participant |
| Whisper STT | ~1-3s | External API call |
| ElevenLabs TTS | ~1-2s | External API call |
| Graph persistence | O(1) | Async, doesn't block delivery |
| History delivery (join) | O(H) | H = history size (default 50) |

**V1 latency budget (text):** < 500ms (WebSocket round trip)
**V1 latency budget (voice):** < 5s (STT 1-3s + LLM 1-2s + TTS 1-2s)
**V1 capacity:** 50+ participants per room (WebSocket fan-out is cheap)

---

## Helper Functions

### `get_actor_weight(actor_id)`

**Purpose:** Returns the citizen's trust-weighted energy contribution for Moment initial energy.

**Logic:** Query graph for actor's trust_score → `atan(trust_score / 50) / (π/2)` → scale to 0.0-1.0.

### `moment_from_ai(actor_id)`

**Purpose:** Determines if a Moment's author is an AI citizen (for TTS generation).

**Logic:** Check Actor node metadata for `is_ai` flag. Used only for renderer decisions, never for protocol behavior.

### `detect_silence(audio_buffer)`

**Purpose:** Determines if human has stopped speaking (for STT chunk boundary).

**Logic:** Check if RMS energy of last 500ms < threshold. Prevents cutting mid-word.

---

## Interactions

| Module | What We Call | What We Get |
|--------|--------------|-------------|
| FalkorDB | `graph.create_node()`, `graph.create_link()` | Persisted Space/Moment/AT nodes |
| Whisper (OpenAI) | `whisper_transcribe(audio)` | Text transcription of human speech |
| ElevenLabs | `tts_generate(text, voice_id)` | Audio buffer of AI speech |
| Mind Runtime | `get_actor_weight(actor_id)` | Trust-weighted energy value |

---

## Markers

<!-- @mind:todo Design the polling/long-poll mechanism for MCP bridge Moment delivery -->
<!-- @mind:proposition Consider Redis pub/sub for Moment broadcast instead of in-process WebSocket fan-out — enables horizontal scaling -->
<!-- @mind:escalation Should graph persistence be synchronous (blocks delivery) or async (risks loss)? -->
