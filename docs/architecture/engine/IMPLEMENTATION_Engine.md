# IMPLEMENTATION: architecture/engine — Code Architecture

## Current State → Target State

The codebase currently mixes engine and Venice-specific code. The migration extracts engine code into a clean structure while moving Venice content to the world repo.

### Current File Classification

| File | Currently | Target | Action |
|---|---|---|---|
| `src/client/main.js` | Mixed (scene setup + Venice zones) | Engine | Extract Venice zone config to manifest |
| `src/client/scene.js` | Mixed (procedural terrain + Venice palette) | Engine | Parameterize via manifest.terrain |
| `src/client/avatar.js` | Engine | Engine | Rename entity concepts, accept avatar descriptors |
| `src/client/network.js` | Engine | Engine | Keep, add protocol versioning |
| `src/client/voice-chat.js` | Engine | Engine | Keep, load voice config from manifest |
| `src/server/index.js` | Mixed (routes + Venice sync) | Engine | Extract Venice sync to world repo |
| `src/server/voice.js` | Engine | Engine | Parameterize prompt loading |
| `src/server/ai-citizens.js` | Venice-specific | World repo | Move to venezia world repo |
| `src/server/rooms.js` | Engine | Engine | Keep |
| `src/shared/zones.js` | Venice-specific | World repo | Replace with manifest.zones |
| `citizens/` | Venice-specific | World repo | Move to venezia world repo |

### Target Directory Structure

```
cities-of-light/
├── engine/
│   ├── client/
│   │   ├── renderer.js           — Three.js scene management
│   │   ├── terrain-generators/
│   │   │   ├── island.js         — Current procedural island
│   │   │   ├── heightmap.js      — Heightmap-based terrain
│   │   │   └── index.js          — Generator registry
│   │   ├── entity-renderer.js    — Avatar/entity rendering pipeline
│   │   ├── atmosphere.js         — Fog, sky, weather, day-night
│   │   ├── spatial-audio.js      — HRTF, mixing, priority
│   │   ├── input/
│   │   │   ├── desktop.js        — WASD + mouse
│   │   │   ├── vr.js             — WebXR hand tracking
│   │   │   └── mobile.js         — Touch controls
│   │   ├── portal.js             — World transition rendering
│   │   └── world-loader.js       — Manifest parser + world init
│   ├── server/
│   │   ├── state-server.js       — Express + WebSocket, entity state
│   │   ├── voice-pipeline.js     — STT → routing → TTS
│   │   ├── physics-bridge.js     — Plugin interface for physics engines
│   │   ├── ai-gateway.js         — Manemus ↔ engine protocol
│   │   ├── entity-manager.js     — Lifecycle, tiers, sync
│   │   └── rooms.js              — Multi-session support
│   ├── shared/
│   │   ├── protocol.js           — WebSocket message types + version
│   │   └── manifest-schema.json  — WorldManifest JSON Schema
│   └── index.js                  — Engine entry point
├── worlds/                        — Git submodules to world repos
│   └── venezia/                   — → serenissima repo (or new venezia repo)
├── src/                           — (legacy, migrating to engine/)
└── package.json
```

### Docking Points

Engine entry:
- `engine/index.js:startEngine(manifestPath)` — main entry point

World loading:
- `engine/client/world-loader.js:loadWorld(manifest)` — parses manifest, orchestrates init
- `engine/shared/manifest-schema.json` — JSON Schema for validation

Entity system:
- `engine/server/entity-manager.js:EntityManager` — lifecycle, tier assignment
- `engine/client/entity-renderer.js:renderEntity(descriptor)` — avatar pipeline

Voice:
- `engine/server/voice-pipeline.js:VoicePipeline(aiConfig)` — STT/LLM/TTS

Physics:
- `engine/server/physics-bridge.js:PhysicsBridge` — tick interface

AI integration:
- `engine/server/ai-gateway.js:AiGateway` — Manemus protocol

---

@mind:TODO Create engine/ directory structure (Phase 1 of migration)
@mind:TODO Write world-loader.js with manifest validation
@mind:TODO Classify remaining src/ files not listed above
