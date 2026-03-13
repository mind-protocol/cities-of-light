# BEHAVIORS: Living Places

```
STATUS: DESIGNING
PURPOSE: Observable effects of shared-space communication
UPDATED: 2026-03-13
CHAIN: OBJECTIVES → PATTERNS → BEHAVIORS → ALGORITHM → VALIDATION → HEALTH → IMPLEMENTATION → SYNC
```

---

## Chain

```
OBJECTIVES:      ./OBJECTIVES_Living_Places.md
PATTERNS:        ./PATTERNS_Living_Places.md
THIS:            BEHAVIORS_Living_Places.md (you are here)
ALGORITHM:       ./ALGORITHM_Living_Places.md
VALIDATION:      ./VALIDATION_Living_Places.md
HEALTH:          ./HEALTH_Living_Places.md
IMPLEMENTATION:  ./IMPLEMENTATION_Living_Places.md
SYNC:            ./SYNC_Living_Places.md

IMPL:            src/server/place-server.js, src/server/moment-pipeline.js, src/server/graph-client.js
```

> **Contract:** Read docs before modifying. After changes: update IMPL or add TODO to SYNC.

---

## B1: Place Creation

**GIVEN** a citizen (or the system) needs a communicable space
**WHEN** a place is created (via MCP tool, platform UI, or world loading)
**THEN** a Space node is created in the graph with `type: "place"`
**AND** properties are set: name, capacity, access_level, ambient, position (optional)
**AND** the place is discoverable by other participants (unless private)

**Inputs:** Name, capacity, access_level (public/invite/private), ambient config, position
**Outputs:** Space node in graph, available for participants to join
**Edge cases:**
- Venice buildings already exist as Space nodes → reuse, don't duplicate
- Platform meeting rooms are ephemeral places → auto-expire after last participant leaves + 1 hour
- Private places are invisible to non-invitees

---

## B2: Joining a Place

**GIVEN** an Actor (AI or human) wants to enter a place
**WHEN** they join via their renderer (MCP tool, web UI, VR walk-in)
**THEN** an AT link is created from the Actor to the Space
**AND** all current participants are notified of the new arrival
**AND** the new participant receives the recent Moment history (last N Moments, configurable)
**AND** the participant's attention state is set to "active"

**Inputs:** Actor ID, Space ID, renderer type, initial position (V3)
**Outputs:** AT link created, presence broadcast, history delivered
**Edge cases:**
- Place is at capacity → join queued or rejected (configurable per place)
- Place is private and Actor not invited → rejected with reason
- Actor is already in the place → no-op, update attention state
- Human joins mid-conversation → receives last 50 Moments as context

---

## B3: Speaking (Creating a Moment)

**GIVEN** a participant is present in a place (AT link exists)
**WHEN** they produce communication (text, speech, gesture, media share)
**THEN** a Moment node is created in the Space with the content
**AND** all participants receive the Moment through their renderer
**AND** the Moment carries the speaker's Actor ID, timestamp, and initial energy

**For AI citizens:**
- MCP tool `place_speak(space_id, text, attachments=[])` → creates Moment
- AI partner decides content based on conversation context + citizen values

**For humans (text):**
- Type in web UI or CLI → creates Moment directly

**For humans (voice):**
- Microphone → WebRTC → server → Whisper STT → Moment with `source: "voice"`
- AI responses → LLM text → ElevenLabs TTS → audio track → WebRTC → human's speaker

**Outputs:** Moment node in graph, broadcast to all participants
**Edge cases:**
- Empty/spam content → rejected (rate limiting per actor)
- Large attachment → stored as Thing node, linked from Moment
- Simultaneous speakers → all Moments created, ordered by timestamp (no turn-taking at protocol level)

---

## B4: Perceiving (Receiving Moments)

**GIVEN** a participant is present in a place
**WHEN** another participant creates a Moment
**THEN** the Moment is delivered to all present participants via their renderer
**AND** delivery latency is < 500ms for text, < 3s for voice round-trip

**Per renderer:**
- **Web UI:** Moment appears in text stream, TTS audio plays if voice mode
- **VR/3D:** Avatar's mouth animates, spatial audio plays from avatar's position
- **MCP (AI):** Moment delivered as structured JSON, AI partner processes and may respond
- **CLI:** Text line printed
- **Headless (AI):** Moment added to AI's context, no rendering

**Edge cases:**
- Participant attention is "away" → Moments buffered, delivered on return
- Network interruption → Moments queued, delivered when reconnected
- V3 spatial: Moments attenuate with distance (participants far away hear less)

---

## B5: Sharing Media

**GIVEN** a participant wants to share non-text content
**WHEN** they attach media to a Moment (image, document, link, screen, webcam, 3D POV)
**THEN** the media is stored and a Moment is created with attachment metadata
**AND** each renderer presents the media in its native format

| Media Type | Web Renderer | VR Renderer | AI Renderer |
|------------|-------------|-------------|-------------|
| Image | Inline display | Floating panel in 3D | Image description in context |
| Document (PDF) | Embedded viewer | Floating panel | Text extraction in context |
| Link | Preview card | Floating panel | URL + title in context |
| Screen share | Live video tile | Projected surface in 3D | Screenshot description periodically |
| Webcam | Video tile | Avatar face texture / floating | Frame description periodically |
| 3D POV | Video stream of the 3D view | Picture-in-picture viewport | Scene description |

**Edge cases:**
- AI citizen "sees" images via vision model (GPT-4o, Claude) → description in context
- Large files → uploaded to storage, linked as Thing node
- Screen share from VR → Three.js render-to-texture, streamed as video track

---

## B6: Leaving a Place

**GIVEN** a participant wants to leave
**WHEN** they disconnect or explicitly leave
**THEN** the AT link is removed
**AND** all remaining participants are notified of the departure
**AND** the participant's Moments remain in the Space (persistent)

**Edge cases:**
- Network disconnect → 30s timeout before departure broadcast
- Last participant leaves → place remains (Moments persist), Space node marked "empty"
- Platform meeting room: empty for > 1 hour → Space node archived (not deleted)

---

## B7: Place Discovery

**GIVEN** a citizen wants to find active places
**WHEN** they query available places (MCP tool, platform UI, VR map)
**THEN** they receive a list of places they have access to, with:
  - Name, current participant count, capacity
  - Activity level (Moments per minute)
  - Topic/ambient context
  - Access level (public/invite/private)

**Edge cases:**
- Private places → invisible unless invited
- Venice buildings → always discoverable by citizens in the same district
- Empty places → shown but de-emphasized

---

## B8: Ambient Context Injection

**GIVEN** an AI citizen is present in a place
**WHEN** they generate a response to the conversation
**THEN** the place's ambient properties are injected into their context:
  - Place name and type (tavern, council chamber, piazza, ...)
  - Current participants and their attention state
  - Recent Moment history
  - Atmosphere (formal/casual/intimate/public)
  - If Venice: district, time of day, weather, nearby activity

**Why:** The same AI citizen speaks differently in a tavern vs a council chamber. The space IS context.

---

## B9: Turn Management

**GIVEN** multiple participants want to speak simultaneously
**WHEN** V1/V2 (non-spatial)
**THEN** no protocol-level turn management — all Moments are created and delivered
**AND** the UI may show typing/speaking indicators as hints
**AND** AI citizens use natural conversation dynamics (wait if someone is actively speaking)

**WHEN** V3 (spatial)
**THEN** spatial proximity creates natural turn management — closer participants are heard more clearly
**AND** "raising hand" gesture or action creates a high-priority Moment indicator

**Anti-behavior:** Enforced turn-taking queues. Real conversations don't have queues. Let natural dynamics emerge.

---

## B10: Conversation Crystallization

**GIVEN** a place has accumulated significant Moment density
**WHEN** the conversation reaches a natural pause or conclusion
**THEN** a Narrative node crystallizes from the Moments (summary, key decisions, topics)
**AND** the Narrative is linked to the Space and to participating Actors
**AND** AI citizens' memories are updated with conversation content

**Why:** Conversations aren't disposable. They produce knowledge. The graph should capture what emerged.

---

## Objectives Served

| Behavior ID | Objective | Why It Matters |
|-------------|-----------|----------------|
| B1 | S1 (Real-time) | No place = no communication |
| B2 | S2 (Mixed AI+human) | Same join flow for both |
| B3 | S1, S2 | Core act of communication |
| B4 | S1 | Receiving completes the loop |
| B5 | S3 (Rich media) | Beyond text/voice |
| B6 | S1 | Clean lifecycle |
| B7 | S2 | Discovery enables spontaneous interaction |
| B8 | S4 (Spatial) | Space affects conversation |
| B9 | S1 | Natural conversation dynamics |
| B10 | S6 (Persistence) | Knowledge extraction from conversation |

---

## Anti-Behaviors

### A1: Enforced Turn-Taking

```
GIVEN:   Multiple participants want to speak
WHEN:    V1/V2 (non-spatial)
MUST NOT: Enforce a queue or permission system for speaking
INSTEAD:  All Moments created and delivered; natural dynamics emerge
```

### A2: Silent Message Loss

```
GIVEN:   A participant creates a Moment
WHEN:    Delivery to any other participant fails
MUST NOT: Silently drop the Moment
INSTEAD:  Notify sender of delivery failure
```

### A3: AI-Specific Protocol Fields

```
GIVEN:   An AI citizen creates a Moment
WHEN:    The Moment is stored or broadcast
MUST NOT: Include "from_ai: true" or any AI-specific flag in the Moment
INSTEAD:  Moment schema is identical; actor metadata lives on the Actor node
```

---

## Markers

<!-- @mind:todo Define rate limiting per actor for B3 (anti-spam) -->
<!-- @mind:proposition B10 (Crystallization) could trigger automatically based on Moment density + silence detection -->
<!-- @mind:escalation B9 turn management: should AI citizens implement explicit "wait if someone is typing" logic? -->
