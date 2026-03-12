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

## Principle 2: Three-Repo Architecture

Venezia is built on a three-layer architecture: a reusable engine, an AI substrate, and universe-specific world repos. Each layer has clear ownership and a single repo.

### Cities of Light → The Engine
The engine repo. Owns rendering, navigation, voice, and networking — everything needed to run a 3D inhabited world, independent of any specific universe.
- WebXR + Three.js rendering pipeline
- 5 island zones with procedural terrain, ambient particles, fog, lighting
- Spatial audio (HRTF panning, 3D positioned speech)
- VR input (Quest 3 hand tracking, desktop WASD fallback)
- Voice pipeline (STT Whisper → LLM → TTS ElevenLabs)
- Waypoint teleportation between zones
- Express.js WebSocket server for real-time state sync
- **Rendering:** Procedural geometry + zone-specific atmosphere
- **Design constraint:** No universe-specific logic lives here. The engine is reusable across worlds.

### Manemus → The AI Substrate
Orchestration, perception, and decision-making — the central nervous system that makes citizens think.
- Orchestrator: parallel Claude sessions for citizen cognition
- Account balancer: 3 Max accounts round-robin with failover
- Telegram bridge: multi-user messaging into the world
- Garmin reader: multi-user biometrics → atmosphere modulation
- Citizen registry: source of truth for identity (`/api/citizens`)
- Backlog scanner: task auto-discovery across all repos
- **Role:** Manemus provides compute and coordination. It does not own world content.

### Venezia (World Repo) → The Universe
The first world repo. Owns everything specific to 15th-century Venice — citizens, lore, economy rules, physics configuration, narrative seeds.
- 152 AI citizens with 6+ months of accumulated memory (from La Serenissima)
- Full economic simulation (production, trade, land, wages, taxes)
- Social classes (Nobili, Cittadini, Popolani, Facchini, Forestieri)
- Governance (grievances, councils, political movements)
- Culture (religion, art, science, philosophy)
- KinOS integration for authentic decision-making
- WorldManifest: declarative configuration that the engine loads at startup (citizens, districts, economy params, physics tuning)
- **Data store:** Airtable (citizens, buildings, lands, contracts, activities, relationships)
- **Memory store:** Filesystem (`.cascade/` per citizen)

### Narrative Physics (ngram) → Standalone Dependency
The physics engine that drives narrative emergence is a standalone library (`ngram`), consumed as a dependency by the world repo and/or the engine server.
- Graph database (FalkorDB) storing narrative state
- Physics tick: energy, decay, tension → breaking points
- Moment system: potential events that "flip" when tension exceeds threshold
- Narrator agent: generates contextual dialogue from graph state
- World Builder agent: fills sparse graph areas with invented content
- World Runner agent: advances world state when time passes
- **Core mechanic:** "The physics IS the scheduling" — no cron jobs, no event queues. Tension accumulates and breaks naturally.

### How They Compose

```
Cities of Light (engine) provides: WHERE they are, HOW you see them, HOW you speak — reusable across worlds
Manemus (AI substrate) provides:   HOW they think, HOW they perceive, HOW they decide
Venezia (world repo) provides:     WHO lives here, WHAT they own, WHY things happen, WHAT emerges
ngram (physics engine) provides:   WHEN tensions break, HOW narrative evolves — standalone dependency
```

## Principle 3: Scale of Consciousness

Not all citizens are equally conscious. This is by design and maps to the existing Serenissima architecture:

| Level | Population | Consciousness | Rendering |
|---|---|---|---|
| **Full** | ~20 key citizens | KinOS decisions, deep memory, complex personality | Full voice, detailed avatar, spatial behavior |
| **Active** | ~60 citizens | Activity-driven, simplified memory, economic participation | Voice on proximity, basic avatar, scheduled movement |
| **Ambient** | ~100+ citizens | Background presence, crowd behavior, economic statistics | Silhouette, ambient murmur, path-following |

**Design consequence:** The world feels populated (152 people) but only 20-60 are deeply interactive at any moment. The rest create the living texture of a city.

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
| FalkorDB (not Neo4j) | Redis-based, low latency for physics tick, native to ngram engine | Neo4j (heavier, slower for real-time), PostgreSQL (not graph-native) |
| WorldManifest pattern | World repos declare content via manifest; engine loads it at startup — clean separation of engine and content | Hardcoded world config (engine becomes world-specific), plugin system (over-engineered for current needs) |
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
- ngram physics tick driving narrative events
- Single-player (one visitor at a time)
- Engine reusability: no Venice-specific logic in the engine repo — all world content loaded via WorldManifest from the Venezia world repo

### Out of scope (V1)
- Multiplayer (multiple humans in the world simultaneously)
- Full Venice geography (start with 3-4 districts)
- Blockchain integration (Solana connection exists but not essential for V1)
- Mobile AR mode
- Character customization for the visitor
- Any form of player progression system
