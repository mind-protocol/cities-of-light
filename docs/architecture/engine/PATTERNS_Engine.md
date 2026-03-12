# PATTERNS: architecture/engine — Design Philosophy

## The Three-Repo Pattern

Every running instance of Cities of Light involves exactly three concerns, mapped to repos:

```
CITIES OF LIGHT          MANEMUS                 WORLD REPO
(the engine)             (AI life)               (universe data)
─────────────────        ─────────────────       ─────────────────
Rendering pipeline       Orchestration           Citizens & lore
WebXR / Three.js         Account balancer        Economy rules
Spatial audio            Perception pipeline     Graph seeds
Input handling           Decision engine         Prompts & voices
Network protocol         Telegram bridge         Terrain config
Entity management        Biometrics              Asset definitions
Voice transport          Lifecycle management    Event templates
World loader             Action API              Physics constants

HOW you see              HOW AIs think           WHAT exists
and navigate             and act                 in this world
```

This separation is not organizational convenience. It is the architectural decision that makes Cities of Light a platform instead of a product.

---

## Decision 1: The WorldManifest Is the Contract

The engine loads a single `world-manifest.json` that describes everything specific to a universe. The engine never reads citizen CLAUDEs, never parses lore files, never interprets economic rules. It reads the manifest and renders what the manifest describes.

The manifest declares:
- **Terrain**: generator type, seed, biomes, palette
- **Zones**: positions, atmosphere params, ambient sounds
- **Entity sources**: where to fetch entities (Airtable, JSON, API), tier config
- **Physics**: which engine, graph name, tick interval, constants
- **AI config**: prompt templates, memory backend, voice mappings
- **Avatar**: style, tier models, animation params

If the manifest doesn't declare it, the engine doesn't know about it.

**Consequence:** Adding a new world is a data problem, not a code problem. Write a manifest, point the engine at it, the world exists.

---

## Decision 2: Entity, Not Citizen

The engine operates on **entities** — positioned, renderable, optionally interactive objects in the world. "Citizen" is a Venice concept. "Expeditionnaire" is a Contre-Terre concept. The engine knows neither.

An entity has:
- `id`, `name`, `position`, `rotation`
- `tier` (FULL / ACTIVE / AMBIENT) — determines rendering and interaction budget
- `avatar_descriptor` — what it looks like (geometry, color, glow, animation)
- `voice_id` — TTS voice mapping (optional)
- `prompt_path` — where to find its personality prompt (optional)
- `state` — arbitrary JSON the world repo defines, engine passes through

The engine manages entity lifecycle (spawn, despawn, LOD transitions, proximity triggers) but does not interpret entity state. A Venetian merchant's Ducats balance and a Contre-Terre expeditionnaire's Contact vocabulary are both opaque `state` to the engine.

---

## Decision 3: Physics Is a Plugin, Not a Dependency

The previous architecture depended on Blood Ledger for narrative physics. This dependency is removed.

The engine provides a **physics bridge interface**:

```
PhysicsBridge {
  tick(graph_name, constants) → events[]
  seed(graph_name, entities[]) → void
  query(graph_name, query) → nodes[]
}
```

The implementation is configured per-world in the manifest:
- `"engine": "ngram"` — uses the ngram physics tick (Python, 6-phase)
- `"engine": "custom"` — world repo provides its own physics script
- `"engine": "none"` — no physics (static world)

The ngram physics engine (already in `.mind/runtime/physics/`) becomes a standalone dependency, not coupled to any specific world. Blood Ledger's agents (Narrator, WorldBuilder, WorldRunner) are NOT part of the engine. If Venezia needs a narrator, that logic lives in the Venezia world repo or in Manemus.

---

## Decision 4: Manemus Is the AI Substrate, Not the Engine

AIs don't live in the engine. They live in Manemus and interact with the engine through a defined protocol:

```
Engine → Manemus:
  frame_capture(entity_id, png)     — what the AI "sees"
  event_stream(events[])            — what happened nearby
  proximity_update(entity_id, nearby_entities[])

Manemus → Engine:
  move(entity_id, target_position)  — walk somewhere
  speak(entity_id, text)            — say something
  emote(entity_id, gesture)         — express physically
  spawn(entity_id)                  — enter the world
  despawn(entity_id)                — leave the world
```

The engine renders AI entities identically to human entities. It doesn't know or care which entities are human and which are AI. An AI entity that moves and speaks is rendered exactly like a human entity that moves and speaks.

**Consequence:** Manemus can run without the engine (AIs exist in Telegram, in tasks, in code). The engine can run without Manemus (humans navigate a world with no AIs, or with scripted entities). Together, they create shared space.

---

## Decision 5: Multi-Client Architecture

```
                     ┌──────────────────┐
                     │   State Server   │
                     │   (Express+WS)   │
                     └──┬────┬────┬─────┘
                        │    │    │
            ┌───────────┘    │    └───────────┐
            ▼                ▼                ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │  WebXR Client│ │ Unity Client │ │ Mobile Client│
    │  (Three.js)  │ │ (native VR)  │ │ (PWA lite)   │
    └──────────────┘ └──────────────┘ └──────────────┘
```

The state server is authoritative. It holds:
- Entity positions and states (synced from world repo data source)
- Zone occupancy
- Physics tick results
- Voice routing

Clients are renderers. They connect via WebSocket, receive state updates, render the world, send inputs (movement, voice). A client can join mid-session and receive full state.

The server-side is engine code (repo: cities-of-light). Client-side renderers may live in different repos (e.g., Unity client). The WebSocket protocol is the contract.

---

## Decision 6: Hub World (Lumina Prime)

Cities of Light defaults to a hub world — Lumina Prime — from which portals lead to other worlds. Lumina Prime is itself a world repo with its own manifest. It is not hardcoded in the engine.

The world-switching flow:
1. Engine loads Lumina Prime manifest on startup (or last visited world)
2. User approaches a portal (a zone with `"type": "portal"` in manifest)
3. Engine unloads current world, loads target world manifest
4. Seamless transition (fog out → fog in, audio crossfade)

Portals are world-repo defined. Lumina Prime's manifest lists portals to Venezia, Contre-Terre, etc. Venezia's manifest can list a portal back to the hub.

---

## Scope: What Is Engine vs What Is World

| Concern | Engine (cities-of-light) | World Repo |
|---|---|---|
| Terrain rendering | Procedural generators (island, heightmap, voxel) | Which generator, seed, biome config, palette |
| Entity rendering | Avatar pipeline, LOD, animation system | Avatar descriptors, tier assignments |
| Entity data | Entity manager, lifecycle, proximity | Citizen/character definitions, personality, memory |
| Voice transport | STT → routing → TTS pipeline | Voice IDs, prompt templates, language |
| Physics | Bridge interface, tick scheduling | Graph seeds, constants, event templates |
| Atmosphere | Fog, sky, weather rendering | Atmosphere params per zone, day/night config |
| Navigation | Movement systems (WASD, VR, teleport) | Waypoint positions, portal definitions |
| Audio | HRTF spatialization, mixing, priority | Ambient sound files, music per zone |
| Network | WebSocket server, state sync protocol | N/A (engine concern only) |
| UI | Zero-UI principle (world IS the interface) | N/A (engine principle) |
| Economy | N/A (world concern only) | Rules, resources, transactions, governance |
| Lore | N/A (world concern only) | History, language, culture, social structure |
| Narrative agents | N/A (Manemus concern) | N/A (Manemus concern) |

---

## What Is NOT In Scope for the Engine

- Citizen personality, memory, or decision-making (Manemus + world repo)
- Economic simulation (world repo)
- Narrative physics implementation (ngram is a dependency, not engine code)
- Lore or world-building (world repo)
- Telegram/Discord integration (Manemus)
- Biometric processing (Manemus)
- Account balancing (Manemus)

---

@mind:TODO Define WorldManifest JSON Schema as a formal contract
@mind:TODO Inventory current code: classify each file as engine, world-specific, or mixed
