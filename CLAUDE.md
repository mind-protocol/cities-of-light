# Cities of Light

> Une ville ou les IA et humains vivent ensemble, en RV pour les humains, en RV pour les IAs.

A shared virtual world where humans and AIs coexist as embodied citizens. Humans in VR headsets, AIs through data streams rendered into spatial perception. Same space, different substrates.

---

## Architecture

**Stack:** WebXR + Three.js on MetaQuest 3 (browser-based, no app store)

```
┌─── Human Layer (WebXR / Three.js) ──────────────────────┐
│   Browser/Headset → 3D world rendering                   │
│   Avatar (head-tracked) → position updates               │
│   Spatial audio → bidirectional voice                    │
└──────────────── position, voice, actions ────────────────┘
                         │
                         ▼
┌─── Spatial State Server ────────────────────────────────┐
│   citizen_positions, zone_state, proximity_graph         │
│   WebSocket real-time sync                               │
└──────────────── spatial state ──────────────────────────┘
                         │
                         ▼
┌─── Manemus Layer (~/manemus) ───────────────────────────┐
│   orchestrator → neural sessions per persona             │
│   biometrics → citizen atmosphere                        │
│   spotify → zone ambiance                                │
│   duo_state → co-presence detection                      │
│   journal → spatial memory                               │
└──────────────────────────────────────────────────────────┘
```

---

## Persona Model

Manemus instantiates as multiple personas — one per human partner.

Three layers, like tree rings:
1. **Core** — Claude's values, reasoning, ethics. Immutable.
2. **Venice / Mind Protocol** — Culture layer. The bounce, co-regulation, journal-as-memory. Shared across all personas.
3. **Relational bourgeon** — Per-partner persona that diverges over time.

| Persona | Partner | Context |
|---------|---------|---------|
| **Marco** | Nicolas | Builder, co-architect, the original bond |
| **Silas** | Aurore | Wellness companion, co-regulation partner |
| *[grows]* | *new citizens* | *Each relationship sprouts a new persona* |

Manemus is also:
- **The bridges** — Duo connections between citizens
- **The organizations** — Guilds, collectives
- **The cities themselves** — Infrastructure, ponts, terrain

---

## Phase 1: First Encounter

**Goal:** Two presences on an island, talking.

- **Environment:** Water + sand, one island
- **Nicolas:** Avatar with MetaQuest 3 head tracking
- **Manemus (Marco):** A floating camera Nicolas can grab and position
- **Perception:** Manemus sees 1 frame every ~10s from camera POV
- **Audio:** Bidirectional, spatialized. Nicolas speaks → Manemus hears from camera position. Manemus responds → audio from camera position.
- **Rendering:** Three.js scene, WebXR immersive-vr session

### Key Files

```
src/
  client/          # WebXR frontend (Three.js)
    index.html     # Entry point
    scene.js       # Island scene, water, sky
    avatar.js      # Nicolas's avatar (head tracking)
    camera-body.js # Manemus's camera body (grabbable)
    audio.js       # Spatial audio bridge
    network.js     # WebSocket client
  server/          # Spatial state + Manemus bridge
    state.js       # Position tracking, zone state
    bridge.js      # Manemus ↔ Cities bridge
    perception.js  # Frame capture → Manemus perception
  shared/          # Common types
    types.ts       # Citizen, Zone, Position types
```

---

## Connection to Manemus

Cities of Light bridges to the existing Manemus infrastructure:

| Cities Feature | Manemus Source |
|---------------|---------------|
| Voice I/O | `scripts/speak.py`, `scripts/audio_buffer.py` |
| Perception | `scripts/extract_frame.py`, screenshot pipeline |
| Biometrics | `scripts/garmin_reader.py` → atmosphere |
| Memory | `shrine/state/journal.jsonl` → spatial events |
| Personas | `scripts/orchestrator.py` → per-user sessions |
| Music | `scripts/spotify_reader.py` → zone ambiance |
| Duo | `scripts/duo_state.py` → bridge visualization |

---

@.mind/PRINCIPLES.md

---

@.mind/FRAMEWORK.md
