# Repository Map: cities-of-light/src

*Generated: 2026-03-12 13:29*

## Statistics

- **Files:** 18
- **Directories:** 5
- **Total Size:** 218.4K
- **Doc Files:** 0
- **Code Files:** 18
- **Areas:** 7 (docs/ subfolders)
- **Modules:** 20 (subfolders in areas)
- **DOCS Links:** 0 (0.0 avg per code file)

### By Language

- javascript: 18

## File Tree

```
├── client/ (172.9K)
│   ├── public/ (1.6K)
│   │   └── sw.js (1.6K)
│   ├── avatar.js (9.5K)
│   ├── main.js (35.4K)
│   ├── memorial.js (6.3K)
│   ├── network.js (8.4K)
│   ├── scene.js (30.4K)
│   ├── sculpture.js (6.7K)
│   ├── voice-chat.js (8.8K)
│   ├── voice.js (15.3K)
│   ├── vr-controls.js (12.7K)
│   ├── wearable-display.js (8.6K)
│   └── (..8 more files)
├── server/ (71.3K)
│   ├── ai-citizens.js (9.5K)
│   ├── biography-voice.js (6.1K)
│   ├── index.js (19.7K)
│   ├── perception.js (3.2K)
│   ├── rooms.js (4.4K)
│   └── voice.js (28.3K)
└── shared/ (3.4K)
    └── zones.js (3.4K)
```

## File Details

### `client/avatar.js`

**Definitions:**
- `createAvatar()`
- `createAICitizenAvatar()`
- `ensureHandMeshes()`
- `updateHandFromData()`

### `client/main.js`

**Definitions:**
- `updateDesktopMovement()`
- `enableAudio()`
- `initVoice()`
- `initVoiceChat()`
- `enableVRButton()`
- `manualActive()`

### `client/memorial.js`

**Definitions:**
- `class Memorial`

### `client/network.js`

**Definitions:**
- `class Network`

### `client/scene.js`

**Imports:**
- `shared/zones.js`

**Definitions:**
- `hash2D()`
- `smoothNoise()`
- `fbm()`
- `getSunPosition()`
- `createEnvironment()`
- `updateEnvironment()`
- `buildCompleteIsland()`
- `createIslandLabel()`
- `buildIsland()`
- `t()`
- `generateSandNormalMap()`
- `idx()`
- `buildPalmTrees()`
- `buildSinglePalm()`
- `angle()`
- `angle()`
- `buildFrond()`
- `buildRockFormation()`
- `buildCrystals()`
- `buildColumns()`
- `angle()`
- `buildFlowers()`
- `petalAngle()`
- `buildClouds()`
- `idx()`

### `client/sculpture.js`

**Definitions:**
- `class Sculpture`
- `createWorldSculptures()`

### `client/voice-chat.js`

**Definitions:**
- `class VoiceChat`

### `client/voice.js`

**Definitions:**
- `class SpatialVoice`

### `client/vr-controls.js`

**Definitions:**
- `class VRControls`

### `client/wearable-display.js`

**Definitions:**
- `class WearableDisplay`
- `angle()`
- `createWorldWearables()`

### `server/ai-citizens.js`

**Imports:**
- `shared/zones.js`

**Definitions:**
- `class AICitizenManager`
- `dy()`

### `server/biography-voice.js`

**Definitions:**
- `processBiographyVoice()`

### `server/index.js`

**Imports:**
- `shared/zones.js`

**Definitions:**
- `send()`
- `handleUpgrade()`
- `send()`
- `send()`
- `broadcast()`

### `server/perception.js`

**Definitions:**
- `storeFrame()`
- `perceptionRoutes()`

### `server/rooms.js`

**Definitions:**
- `generateCode()`
- `class RoomManager`

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
