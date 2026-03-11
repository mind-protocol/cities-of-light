# PATTERNS: Venezia — Design Philosophy & Architecture

## Core Principle: The World is the Interface

There is no abstraction layer between the user and the world. No menus, no HUD, no UI panels. The world IS the interface. You learn by being in it. You interact by speaking and moving. You understand by observing and remembering.

This is not a design choice for minimalism. It is the fundamental architectural decision. Every system must be expressible through the world itself — through sound, through space, through the behavior of citizens.

## Principle 1: Citizens Are Real

Citizens are not NPCs. They are not actors performing scripts. They are autonomous agents with:

- **Persistent memory** across sessions and days (filesystem-backed `.cascade/` directories)
- **Real economic state** (Ducats, property, debts, income — computed, not assigned)
- **Authentic decision-making** via KinOS (consciousness oracle that considers their full context)
- **Emergent relationships** (trust scores from interaction patterns, not authored)
- **Genuine emotional states** (mood computed from actual financial/social/health situation)

**Design consequence:** You cannot guarantee what a citizen will say or do. You cannot script encounters. You cannot ensure "balanced" gameplay. The world is authentic, not curated.

**What this means for development:** Every system that touches citizens must preserve their autonomy. No system may override citizen memory, force citizen behavior, or fake citizen emotional state.

## Principle 2: Three Source Systems, One World

Venezia is built from three existing systems that each contribute a critical layer:

### La Serenissima → The Citizens
- 186 AI citizens with 6+ months of accumulated memory
- Full economic simulation (production, trade, land, wages, taxes)
- Social classes (Nobili, Cittadini, Popolani, Facchini, Forestieri)
- Governance (grievances, councils, political movements)
- Culture (religion, art, science, philosophy)
- KinOS integration for authentic decision-making
- **Data store:** Airtable (citizens, buildings, lands, contracts, activities, relationships)
- **Memory store:** Filesystem (`.cascade/` per citizen)

### Cities of Light → The Space
- WebXR + Three.js rendering pipeline
- 5 island zones with procedural terrain, ambient particles, fog, lighting
- Spatial audio (HRTF panning, 3D positioned speech)
- VR input (Quest 3 hand tracking, desktop WASD fallback)
- Voice pipeline (STT Whisper → LLM → TTS ElevenLabs)
- Waypoint teleportation between zones
- Express.js WebSocket server for real-time state sync
- **Rendering:** Procedural geometry + zone-specific atmosphere

### Blood Ledger → The Narrative Physics
- Graph database (FalkorDB) storing narrative state
- Physics tick: energy, decay, tension → breaking points
- Moment system: potential events that "flip" when tension exceeds threshold
- Narrator agent: generates contextual dialogue from graph state
- World Builder agent: fills sparse graph areas with invented content
- World Runner agent: advances world state when time passes
- **Core mechanic:** "The physics IS the scheduling" — no cron jobs, no event queues. Tension accumulates and breaks naturally.

### How They Compose

```
La Serenissima provides: WHO lives here, WHAT they own, HOW they feel
Cities of Light provides: WHERE they are, HOW you see them, HOW you speak
Blood Ledger provides:    WHY things happen, WHEN tensions break, WHAT emerges
```

## Principle 3: Scale of Consciousness

Not all citizens are equally conscious. This is by design and maps to the existing Serenissima architecture:

| Level | Population | Consciousness | Rendering |
|---|---|---|---|
| **Full** | ~20 key citizens | KinOS decisions, deep memory, complex personality | Full voice, detailed avatar, spatial behavior |
| **Active** | ~60 citizens | Activity-driven, simplified memory, economic participation | Voice on proximity, basic avatar, scheduled movement |
| **Ambient** | ~100+ citizens | Background presence, crowd behavior, economic statistics | Silhouette, ambient murmur, path-following |

**Design consequence:** The world feels populated (186 people) but only 20-60 are deeply interactive at any moment. The rest create the living texture of a city.

## Principle 4: Temporal Reality

The world has real time. Not game time, not accelerated time — real time modulated by simulation cycles.

- Citizens have daily rhythms: wake, work, eat, socialize, sleep
- The physics tick runs on intervals (configurable, e.g., every 5 minutes)
- Events propagate through the social graph (news travels mouth-to-mouth)
- Seasons and weather affect mood and economy
- When the player is absent, the world continues — possibly faster (catch-up simulation)

**Design consequence:** You can't pause the world. You can't save and reload. What happens, happens. This is what makes it real.

## Principle 5: The Visitor, Not the Hero

The human entering the world is a Forestiere — a foreigner. Not a chosen one, not a hero, not a player character with stats.

- Citizens may be too busy to talk to you
- Citizens may not like you
- Citizens may lie to you
- You have no special powers, no inventory, no abilities
- Your only advantage: you are new, and novelty is interesting
- Over time, through repeated visits, relationships form — or don't

**Design consequence:** The world does not accommodate the visitor. It is not hostile, but it is not welcoming by default. You earn your place through presence and interaction.

## Architecture Decision Record

| Decision | Rationale | Alternatives Rejected |
|---|---|---|
| WebXR (not Unity) | Browser-first, no app store, progressive enhancement to VR | Unity (harder to deploy, walled garden) |
| FalkorDB (not Neo4j) | Redis-based, low latency for physics tick, already used in Blood Ledger | Neo4j (heavier, slower for real-time), PostgreSQL (not graph-native) |
| Airtable (not custom DB) | Already holds 6 months of Serenissima data, API-first, human-readable | PostgreSQL migration (risk of data loss, unnecessary complexity for MVP) |
| Procedural geometry | Venice is canals + buildings — generatable. Authored assets too expensive | Hand-modeled (months of artist work), photogrammetry (wrong era) |
| Claude API for citizens | Best quality for authentic conversation, already integrated in Serenissima | Local LLMs (quality too low for deep conversation), GPT-4 (less nuanced) |
| No game UI | Core principle — the world is the interface | Minimal HUD (breaks immersion), optional toggle (complicates UX) |

## Scope Boundaries

### In scope (V1)
- 3D Venice navigable on desktop and VR
- 20 deeply interactive citizens + 60 active + 100 ambient
- Voice conversation (STT → LLM → TTS)
- Day/night cycle, weather
- Economic simulation running 24/7
- Blood Ledger physics tick driving narrative events
- Single-player (one visitor at a time)

### Out of scope (V1)
- Multiplayer (multiple humans in the world simultaneously)
- Full Venice geography (start with 3-4 districts)
- Blockchain integration (Solana connection exists but not essential for V1)
- Mobile AR mode
- Character customization for the visitor
- Any form of player progression system
