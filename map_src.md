# Repository Map: cities-of-light/src

*Generated: 2026-03-14 17:50*

## Statistics

- **Files:** 11
- **Directories:** 3
- **Total Size:** 140.9K
- **Doc Files:** 0
- **Code Files:** 11
- **Areas:** 9 (docs/ subfolders)
- **Modules:** 22 (subfolders in areas)
- **DOCS Links:** 1 (0.09 avg per code file)

### By Language

- javascript: 10
- python: 1

## File Tree

```
├── server/ (141.7K)
│   ├── ai-citizens.js (9.5K)
│   ├── biography-voice.js (6.1K)
│   ├── graph-client.js (14.3K)
│   ├── index.js (37.3K)
│   ├── moment-pipeline.js (3.8K)
│   ├── physics-bridge.js (10.0K)
│   ├── place-server.js (13.6K)
│   ├── rooms.js (4.4K)
│   ├── run_tick.py (10.1K) →
│   ├── voice.js (28.3K)
│   └── (..2 more files)
└── shared/ (3.4K)
    └── zones.js (3.4K)
```

## File Details

### `server/ai-citizens.js`

**Imports:**
- `shared/zones.js`

**Definitions:**
- `class AICitizenManager`
- `dy()`

### `server/biography-voice.js`

**Definitions:**
- `processBiographyVoice()`

### `server/graph-client.js`

**Definitions:**
- `class GraphClient`

### `server/index.js`

**Imports:**
- `shared/zones.js`

**Definitions:**
- `thoughts()`
- `send()`
- `handleUpgrade()`
- `send()`
- `send()`
- `broadcast()`
- `shutdown()`

### `server/moment-pipeline.js`

**Definitions:**
- `class MomentPipeline`

### `server/physics-bridge.js`

**Definitions:**
- `class PhysicsBridge`

### `server/place-server.js`

**Definitions:**
- `class PlaceServer`

### `server/rooms.js`

**Definitions:**
- `generateCode()`
- `class RoomManager`

### `server/run_tick.py`

**Docs:** `docs/narrative/physics/IMPLEMENTATION_Physics.md`

**Definitions:**
- `def load_tick_number()`
- `def save_tick_number()`
- `def result_to_dict()`
- `def detect_significant_tension_changes()`
- `def detect_narrative_events()`
- `def run()`

### `server/voice.js`

**Definitions:**
- `executeInvokeSession()`
- `getSessionUpdates()`
- `buildSystemPrompt()`
- `callLLM()`
- `processVoice()`
- `processVoiceStreaming()`
- `_logDialogue()`
- `speakToWorld()`
- `speakAsAICitizen()`

### `shared/zones.js`

**Definitions:**
- `detectNearestZone()`
- `getZoneById()`
