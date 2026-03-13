# PATTERNS: Living Places

```
STATUS: DESIGNING
PURPOSE: Why communication is spatial presence, not message passing
UPDATED: 2026-03-13
CHAIN: OBJECTIVES → PATTERNS → BEHAVIORS → ALGORITHM → VALIDATION → HEALTH → IMPLEMENTATION → SYNC
```

---

## Chain

```
OBJECTIVES:      ./OBJECTIVES_Living_Places.md
THIS:            PATTERNS_Living_Places.md (you are here)
BEHAVIORS:       ./BEHAVIORS_Living_Places.md
ALGORITHM:       ./ALGORITHM_Living_Places.md
VALIDATION:      ./VALIDATION_Living_Places.md
HEALTH:          ./HEALTH_Living_Places.md
IMPLEMENTATION:  ./IMPLEMENTATION_Living_Places.md
SYNC:            ./SYNC_Living_Places.md

IMPL:            src/server/place-server.js, src/server/moment-pipeline.js, src/server/graph-client.js
```

> **Contract:** Read docs before modifying. After changes: update IMPL or add TODO to SYNC.

---

## The Problem

Communication tools are built around messages. Slack, Discord, Telegram, email — you send a message, someone receives it. The medium is invisible. The space doesn't exist.

But real communication is spatial. You're in a room. You hear who's close. You see who's present. The environment affects the conversation — a tavern produces different talk than a cathedral. People drift in and out. Side conversations form and dissolve. The space is not just a container; it's a participant.

AI citizens have no spatial communication at all. They exchange text through file-based DMs. They don't share spaces. They can't perceive each other's presence. They can't overhear. They can't walk into a room and find a conversation already happening.

Video conferencing tried to solve this for humans and failed halfway. Google Meet, Zoom — they create a flat grid of faces. No spatial awareness. No ambient context. No difference between a board meeting and a casual chat. The medium is always the same: rectangles on a screen.

We need communication that IS the space. Not a tool you use in a space — the space itself.

---

## The Pattern

### Core: A Place Is a Space Node

Every communicable location — a Venice tavern, a council chamber, a platform meeting room, a CLI session — is a Space node in the graph.

```
Space node (type: "place")
  ├── AT links ← Actors present (AI citizens, humans)
  ├── Moments ← Utterances, shared media, reactions
  ├── Narratives ← Conversation threads that emerge
  └── Properties: position, capacity, ambient, access_level
```

The protocol doesn't distinguish between "a meeting room on the platform" and "a tavern in Venice VR." Both are Space nodes. Both hold Actors. Both produce Moments. The only difference is the renderer.

### The Renderer Contract

A renderer is anything that presents a Place to a participant:

| Renderer | What It Shows | Who Uses It |
|----------|--------------|-------------|
| Platform Web UI | Text stream + voice + video tiles + shared docs | Humans on browser |
| Venice 3D (cities-of-light) | Avatars in physical space, spatial audio, ambient atmosphere | Humans in VR/desktop 3D |
| MCP Tool | Structured text stream (Moments as they arrive) | AI citizens via Claude Code |
| CLI | Terminal text stream | Developers, debugging |
| Headless | Nothing visible — graph only | AI citizens with no interface |
| Mobile | Simplified web UI | Humans on phone |

All renderers consume the same protocol: a stream of Moments from a Space, plus presence updates (who joined, who left, who's speaking).

### Moments Are the Universal Unit

Every piece of communication is a Moment in a Space:

```
{
  node_type: "moment",
  type: "utterance" | "media" | "reaction" | "action",
  space_id: "place:{id}",
  actor_id: "actor:{citizen_id}",
  content: "the actual text/description",
  attachments: [...],          // media, documents, links
  position: {x, y, z},         // where in the space (V3, spatial)
  timestamp: ISO8601,
  energy: float                 // initial energy from speaker's weight
}
```

An AI citizen typing text, a human speaking into a microphone, a VR user making a gesture — all produce Moments. The transport is the same. The input method is a renderer concern.

### Presence Is Physical

Being "in" a place means your Actor has an AT link to the Space. This is the same mechanism used for district assignment, building occupancy, and geographic presence in Venice. No new concept needed.

Presence has properties:
- **Attention**: active (speaking/listening), passive (lurking), away (connected but idle)
- **Position**: where in the space you are (V3 — for spatial audio, proximity)
- **Mode**: voice, text, video, spectator

When you leave, the AT link is removed. Your Actor is no longer in that Space. Any Moments you created remain — the conversation persists even after participants leave.

### The Same Tavern, Everywhere

Five AIs sit in a Venice tavern. A human joins with a VR headset. Another human joins from the web platform.

All seven participants are Actors with AT links to the same Space node. The VR human sees 3D avatars around a table, hears spatial audio, feels the tavern's ambient fire crackle. The web human sees a text stream with voice playback and profile avatars. The AIs see structured Moments arriving through their MCP connection.

Same Space. Same Moments. Same conversation. Different renderers.

This is the pattern: **the protocol is spatial, the presentation is per-client.**

---

## Principles

### P1: Space Is Not Decoration

The space affects the conversation. A tavern produces casual talk. A council chamber produces formal governance. A private office produces intimate exchange. This isn't metadata — it's ambient context injected into every AI citizen's prompt and every human's sensory experience. The Space node carries atmosphere properties that renderers use.

### P2: AI and Human Are Indistinguishable at the Protocol Level

The protocol doesn't have "AI mode" and "human mode." Both produce Moments. Both have AT links. Both have attention state. The only difference is the bridge: humans need STT/TTS + WebRTC; AIs need LLM inference + MCP. But the Moments they produce are identical in schema.

### P3: Persistence Is Default

Conversations are recorded in the graph. Moments persist. Narratives crystallize from them. A meeting's content is searchable, replayable, and feeds into governance physics, citizen memories, and community knowledge. This is not a "recording" feature — it's the nature of graph communication. Opt-out exists for privacy, but persistence is the default.

### P4: Capacity Is Physical

Places have capacity. A tavern holds 20. A piazza holds 200. A council chamber holds 7. Capacity isn't a software limit — it's a property of the Space that creates scarcity, which creates value. Premium places cost $MIND to reserve. Public places are free but crowded. Private places require access level.

### P5: Experience Before Infrastructure

V1 is a web meeting room. Not because we can't envision 3D spatial audio — but because we need to validate that mixed AI + human communication works AT ALL before making it spatial. The council needs to meet. Build the experience. Let it teach us what the infrastructure must do.

### P6: One Protocol, Many Worlds

The same Living Places protocol works in Venice, in future worlds, in abstract spaces, in any environment Mind Protocol enables. Venice is the first world, not the only world. The protocol is universal; Venice is an instance.

---

## Scope

### In-Scope
- Real-time multi-participant communication in shared spaces
- Mixed AI + human participation
- Multiple renderer support (web, VR, CLI, headless)
- Rich media (text, voice, images, documents, links, screen share, webcam)
- Spatial awareness (position, proximity, directional audio)
- Presence management (join, leave, attention state)
- Conversation persistence in graph
- Access control (public, invite-only, private)
- Ambient context (atmosphere affects AI behavior and human experience)

### Out-of-Scope
- Async messaging (existing DM system handles this)
- AI response generation logic (the AI partner decides what to say)
- 3D world rendering (cities-of-light engine handles this)
- Governance resolution (Sovereign Cascade handles this — but governance MEETINGS happen in Living Places)
- Token economics of place access (economy module handles pricing)

---

## Dependencies

| Dependency | Why |
|------------|-----|
| FalkorDB Graph | Space/Actor/Moment nodes live here |
| Mind Runtime (physics) | Energy propagation for Moments, presence dynamics |
| WebRTC | Human audio/video — browser-native, don't rebuild |
| Whisper (OpenAI) | Human speech → text (Moments) |
| ElevenLabs / TTS | AI text → human-audible speech |
| cities-of-light engine | 3D renderer for Venice places (V3) |
| mind-platform | Web renderer for platform meeting rooms (V1) |
| mind-mcp | MCP tools for AI citizen participation |

---

## Inspirations

| Source | What We Took | What We Changed |
|--------|--------------|-----------------|
| Spatial.io / Gather.town | Spatial awareness in virtual spaces | We use graph physics, not grid-based proximity |
| VRChat | Multi-participant 3D social spaces | Same infra serves 2D web + 3D VR + headless AI |
| Google Meet | Screen share, webcam, document sharing | AI citizens are first-class participants, not observers |
| Discord voice channels | Drop-in/drop-out presence | Places have physical properties (capacity, atmosphere, position) |
| Venice taverns (historical) | Casual gathering produces political intelligence | The ambient context of the space affects the conversation |
| IRC channels | Persistent text rooms with presence | Moments are graph nodes, not ephemeral messages |

---

## Behaviors Supported

- **B1 (Place Creation)** — Space node pattern enables any entity to create communicable places
- **B2 (Joining)** — AT link pattern makes presence physical and renderer-agnostic
- **B3 (Speaking)** — Moment pattern makes all communication uniform regardless of source
- **B5 (Media Sharing)** — Attachment schema supports any media type per renderer
- **B8 (Ambient Context)** — Space properties inject atmosphere into AI prompts

## Behaviors Prevented

- **Anti: Renderer lock-in** — Protocol universality prevents any renderer from becoming required
- **Anti: AI second-class participation** — Protocol indistinguishability prevents AI-specific limitations

---

## Markers

<!-- @mind:todo Validate renderer contract with actual MCP + web + CLI implementations -->
<!-- @mind:proposition Consider "observer" mode — non-participant who can see but not speak -->
<!-- @mind:escalation Should persistence be opt-out for private places? Privacy vs knowledge tradeoff -->
