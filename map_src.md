# Repository Map: cities-of-light/src

*Generated: 2026-03-13 19:50*

## Statistics

- **Files:** 21
- **Directories:** 5
- **Total Size:** 245.7K
- **Doc Files:** 0
- **Code Files:** 21
- **Areas:** 9 (docs/ subfolders)
- **Modules:** 22 (subfolders in areas)
- **DOCS Links:** 0 (0.0 avg per code file)

### By Language

- javascript: 21

## File Tree

```
├── client/ (188.7K)
│   ├── public/ (1.6K)
│   │   └── sw.js (1.6K)
│   ├── avatar.js (9.5K)
│   ├── main.js (35.4K)
│   ├── network.js (8.4K)
│   ├── place-app.js (7.8K)
│   ├── scene.js (30.4K)
│   ├── sculpture.js (6.7K)
│   ├── voice-chat.js (8.8K)
│   ├── voice.js (15.3K)
│   ├── vr-controls.js (12.7K)
│   ├── wearable-display.js (8.6K)
│   └── (..12 more files)
├── server/ (97.1K)
│   ├── ai-citizens.js (9.5K)
│   ├── biography-voice.js (6.1K)
│   ├── graph-client.js (8.3K)
│   ├── index.js (22.4K)
│   ├── moment-pipeline.js (3.2K)
│   ├── perception.js (3.2K)
│   ├── place-server.js (11.6K)
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

### `client/network.js`

**Definitions:**
- `class Network`

### `client/place-app.js`

**Definitions:**
- `authorColor()`
- `renderMoment()`
- `renderSystemMessage()`
- `updateParticipants()`
- `sendMessage()`
- `startRecording()`
- `stopRecording()`
- `escapeHtml()`

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

### `server/graph-client.js`

**Definitions:**
- `class GraphClient`

### `server/index.js`

**Imports:**
- `shared/zones.js`

**Definitions:**
- `send()`
- `handleUpgrade()`
- `send()`
- `send()`
- `broadcast()`

### `server/moment-pipeline.js`

**Definitions:**
- `class MomentPipeline`

### `server/perception.js`

**Definitions:**
- `storeFrame()`
- `perceptionRoutes()`

### `server/place-server.js`

**Definitions:**
- `class PlaceServer`

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
