# POST-HEADSET PLAN — Reconnection Order

**Precondition:** Quest 3 APK runs. Nicolas is inside. Hands visible. Beacons teleport between 3 zones. Nothing else until this is true.

---

## PHASE 1 — Visual Polish (no networking, no server)

### 1A. Particle Systems per Zone

**Web source:** `src/client/scene.js` lines 400-450, `src/shared/zones.js` ambient config

| Zone | Particle | Color | Behavior |
|------|----------|-------|----------|
| Island | Fireflies | Gold `#FFD700` | Slow float, pulsing opacity |
| Archive | Embers | Cyan `#00FFCC` | Rising, fade at top |
| Agora | Sparks | Orange `#FF8833` | Floating, gentle drift |

**Unity approach:** One `ParticleSystem` prefab per zone type, instantiated by `BootstrapScene`. Shader: `Universal Render Pipeline/Particles/Unlit`. Budget: 50-100 particles per zone.

**Reuse:** Zone colors and behavior params directly from `src/shared/zones.js`. Copy values, no code dependency.

**New script:** `ZoneParticles.cs` (~40 lines) — spawns particle system at zone center, configures color/lifetime/velocity from zone data.

### 1B. Ocean Shader

**Web source:** `src/client/scene.js` lines 500-520 (PlaneGeometry + vertex displacement)

**Current Unity:** `OceanSimple.cs` does Y-bob only. Flat blue plane.

**Upgrade path:** Replace with scrolling normal map on URP/Lit material. Two tiling normal maps at different speeds = convincing water at zero draw call cost. No custom shader needed.

**Reuse:** Bob amplitude/frequency values from `OceanSimple.cs` (already in Unity).

### 1C. Clouds

**Web source:** `src/client/scene.js` `buildClouds()` — 2 planes at 80m/120m, FBM canvas texture

**Unity approach:** Two quads at height, Unlit transparent material with cloud texture. Slow rotation. Budget: 2 draw calls.

---

## PHASE 2 — Asset Display (no networking, local files only)

### 2A. Sculpture Pedestals

**Web source:** `src/client/sculpture.js` (236 lines)
- Rotating geometric shapes on pedestals
- Proximity glow effect (within 5m)
- Per-zone placement

**Unity approach:**
- `SculpturePedestal.cs` — CylinderMesh base + child mesh (loaded or procedural)
- Rotation in Update, proximity check against XR Origin
- Emissive intensity lerp on approach

**Reuse:** Pedestal dimensions, rotation speed, proximity radius from `sculpture.js`. Placement positions per zone from `gallery.json`.

**What changes:** Three.js Group → Unity GameObject hierarchy. MeshStandardMaterial → URP/Lit. No functional rewrite needed.

### 2B. Wearable Display

**Web source:** `src/client/wearable-display.js` (315 lines)
- Collectible NFT items on display stands
- Collection proximity interaction

**Unity approach:**
- `WearableDisplay.cs` — instantiate stands at zone positions
- Load textures from StreamingAssets (export NFT thumbnails as PNG)
- Canvas UI panel on proximity (TextMeshPro)

**Reuse:** Stand layout logic, collection metadata from `nft-collections.json`. Display positions from zone waypoint data.

**What changes:** HTML overlay → World Space Canvas. Texture loading → `Resources.Load` or Addressables.

### 2C. Video Playback (Memorial)

**Web source:** `src/client/memorial.js` (199 lines), `memorial-manager.js` (84 lines)
- Proximity-triggered video on floating panel
- Donor biography display

**Unity approach:**
- `VideoPanel.cs` — Unity `VideoPlayer` component on a Quad
- RenderTexture target, triggered by proximity
- Videos in StreamingAssets (convert to MP4 H.264 for Android)

**Reuse:** Video catalog from `gallery.json` (30 videos, zone mappings, placement anchors). Proximity radius values.

**What changes:** HTML5 `<video>` → Unity VideoPlayer. Web URL → local StreamingAssets path. Budget concern: video decode on Quest is single-stream only — play one at a time.

---

## PHASE 3 — Ownership UI (no networking, mock data)

### 3A. Zone Info Panel

**Web source:** `src/client/ownership-ui.js` (119 lines)
- 2D panel showing zone name, owner, NFT info
- Updates on zone change

**Unity approach:**
- `ZoneInfoPanel.cs` — World Space Canvas following XR Origin
- TextMeshPro fields: zone name, lore description, owner (mock)
- Triggered by `ZoneManager.OnZoneChanged` event

**Reuse:** Zone lore text and descriptions from `src/shared/zones.js`. Panel layout logic from `ownership-ui.js`.

**What changes:** DOM manipulation → Unity Canvas/TMP. No networking — hardcode owner names initially.

---

## PHASE 4 — Networking (requires Photon Fusion)

**Dependency:** Photon Fusion SDK installed, App ID configured, Quest has WiFi.

**Web source:** `src/client/network.js` (263 lines), `src/server/index.js` (578 lines)

### 4A. Player Sync

| Web Message | Photon Equivalent |
|-------------|-------------------|
| `join` / `welcome` | `NetworkRunner.StartGame()` + `PlayerJoined` callback |
| `position` | `[Networked]` transform on `NetworkObject` |
| `citizen_joined/left` | `PlayerJoined` / `PlayerLeft` callbacks |
| `citizen_moved` | Automatic via `NetworkTransform` |
| `hands` / `citizen_hands` | Custom `[Networked]` struct (25 joints × 2 hands) |

**New scripts:**
- `NetworkPlayer.cs` — `NetworkBehaviour`, syncs head+hands
- `NetworkManager.cs` — `SimulationBehaviour`, room lifecycle
- `PlayerAvatar.cs` — visual representation (reuse `avatar.js` shapes)

**Reuse:** Avatar geometry (sphere head, cylinder body) maps directly. Hand joint structure identical. Room concept → Photon Session.

**What must be rewritten:** All WebSocket message handling → Photon RPCs and `[Networked]` properties. Server authority → Shared Mode (each client owns its player object).

### 4B. Rooms

**Web source:** `src/server/rooms.js` (150 lines)

**Photon equivalent:** Session names. `NetworkRunner.StartGame(new StartGameArgs { SessionName = roomCode })`. No custom room server needed.

### 4C. Teleport Sync

**Web source:** `teleport` message → server updates position → broadcast

**Photon approach:** Client sets `[Networked]` position directly (Shared Mode). Other clients see interpolated move. Optional: RPC to trigger fade effect on observers.

---

## PHASE 5 — Voice (requires Photon Voice + server bridge)

**Dependency:** Photon Voice 2 SDK, microphone permission, server running for LLM.

**Web source:** `src/client/voice.js` (463 lines), `src/server/voice.js` (836 lines)

### 5A. Spatial Voice Chat (player-to-player)

**Web source:** `src/client/voice-chat.js` (299 lines) — WebRTC peer connections

**Photon Voice approach:**
- `PhotonVoiceNetwork` component on NetworkManager
- `Recorder` + `Speaker` components on each player prefab
- Spatial blend = 1.0, 3D sound settings (min 1m, max 30m)
- Push-to-talk: bind to XR controller button

**Reuse:** Spatial audio distance curves, PTT button mapping from `vr-controls.js`.

**What changes:** WebRTC → Photon Voice transport. Signaling → automatic. Spatial positioning → Unity AudioSource 3D.

### 5B. LLM Voice Pipeline (player-to-Manemus)

**Web source:** `src/server/voice.js` full pipeline

**Bridge approach:**
1. Quest records audio (Photon Voice `Recorder` or raw `Microphone` class)
2. Send audio buffer to existing Express server via HTTP POST or WebSocket
3. Server runs existing STT → GPT-4o → TTS pipeline (unchanged)
4. Receive TTS audio stream back
5. Play via Unity `AudioSource` at Manemus avatar position

**New scripts:**
- `VoiceBridge.cs` — HTTP/WS client, sends audio, receives TTS stream
- `ManemusAvatar.cs` — positioned entity with AudioSource for spatial playback

**Reuse:** Entire server pipeline (`src/server/voice.js`) runs unchanged. Only transport layer changes (WebSocket binary frames instead of browser MediaRecorder).

**What changes:** Browser `MediaRecorder` → Unity `Microphone` class. Web Audio API playback → Unity `AudioClip` streaming. OpusCodec handling may need native plugin.

### 5C. AI Citizen Voice

**Web source:** `src/server/ai-citizens.js` (298 lines)

**Approach:** AI citizens run on server (unchanged). Client receives `ai_citizen_speak` message via bridge WebSocket. Plays TTS audio at citizen's 3D position.

**Reuse:** Full server-side AI citizen logic (wandering, proximity speech, LLM calls). Client just needs to receive and spatially play audio.

---

## PHASE 6 — AI Citizens (requires server bridge)

**Dependency:** WebSocket bridge to Express server operational.

**Web source:** `src/server/ai-citizens.js`, `src/client/avatar.js` `createAICitizenAvatar()`

### 6A. AI Citizen Rendering

| Citizen | Shape | Color | Home Zone |
|---------|-------|-------|-----------|
| VOX | Icosahedron | White `#FFFFFF` | Agora |
| LYRA | Octahedron | Violet `#9966FF` | Garden |
| PITCH | TorusKnot | Gold `#FFAA33` | Island |

**Unity approach:**
- `AICitizenRenderer.cs` — creates mesh (Unity primitives: `CreatePrimitive` for sphere/icosahedron, or import mesh), emissive URP/Lit material
- Glow ring (Torus mesh, counter-rotating)
- PointLight child (color-matched)
- Name label (TextMeshPro, Billboard.cs)
- Animation: body rotation 0.5 rad/s, glow pulse via emissive intensity sine wave

**Reuse:** Shape types, colors, animation speeds, glow parameters — all from `avatar.js` and `ai-citizens.js`.

### 6B. AI Citizen Position Sync

**Server sends:** `citizen_moved` every 5s with position + rotation for each AI citizen.

**Unity client:** Receives via bridge WebSocket, lerps AI citizen transforms. Same interpolation as web client (`avatar.js` remote citizen update).

### 6C. AI Citizen Interaction

**Trigger:** Player within 15m of AI citizen + speaks (voice detected).

**Flow:**
1. Unity client sends audio to server via bridge
2. Server checks proximity (AI citizen positions known server-side)
3. Server calls GPT-4o with citizen persona
4. Server streams TTS back tagged with citizen ID
5. Unity plays audio at citizen's AudioSource position

**Reuse:** Entire interaction logic server-side. Client only needs spatial audio playback.

---

## FILE MAP: Web → Unity

| Web File | Lines | Unity Equivalent | Status |
|----------|-------|-----------------|--------|
| `src/shared/zones.js` | 148 | `ZoneManager.cs` (zone data hardcoded) | **DONE** — 3 zones in ZoneManager |
| `src/client/scene.js` | 911 | `IslandBuilder.cs` + `BootstrapScene.cs` | **DONE** — procedural terrain + vegetation |
| `src/client/main.js` | 946 | `BootstrapScene.cs` + render loop (Unity native) | **DONE** — world construction |
| `src/client/zone-ambient.js` | 86 | `ZoneManager.cs` (fog/light lerp) | **DONE** — lerp in Update |
| `src/client/waypoints.js` | 161 | `TeleportBeacon.cs` | **DONE** — proximity teleport |
| `src/client/vr-controls.js` | 363 | XR Interaction Toolkit (built-in) | **DONE** — XRI handles locomotion |
| `src/client/avatar.js` | 310 | Phase 4A `PlayerAvatar.cs` | NOT STARTED |
| `src/client/network.js` | 263 | Phase 4A `NetworkPlayer.cs` | NOT STARTED |
| `src/client/voice.js` | 463 | Phase 5B `VoiceBridge.cs` | NOT STARTED |
| `src/client/voice-chat.js` | 299 | Phase 5A Photon Voice | NOT STARTED |
| `src/client/sculpture.js` | 236 | Phase 2A `SculpturePedestal.cs` | NOT STARTED |
| `src/client/wearable-display.js` | 315 | Phase 2B `WearableDisplay.cs` | NOT STARTED |
| `src/client/memorial.js` | 199 | Phase 2C `VideoPanel.cs` | NOT STARTED |
| `src/client/memorial-manager.js` | 84 | Phase 2C (merged into VideoPanel) | NOT STARTED |
| `src/client/ownership-ui.js` | 119 | Phase 3A `ZoneInfoPanel.cs` | NOT STARTED |
| `src/client/teleport-transition.js` | 91 | Phase 4C (fade canvas overlay) | NOT STARTED |
| `src/client/perception.js` | 149 | Phase 6+ (RenderTexture capture) | NOT STARTED |
| `src/client/camera-body.js` | 85 | Phase 6+ (Manemus 3D model) | NOT STARTED |
| `src/server/index.js` | 578 | Runs unchanged. Unity connects via bridge. | REUSE AS-IS |
| `src/server/voice.js` | 836 | Runs unchanged. Unity sends audio via bridge. | REUSE AS-IS |
| `src/server/ai-citizens.js` | 298 | Runs unchanged. Unity renders received positions. | REUSE AS-IS |
| `src/server/rooms.js` | 150 | Replaced by Photon Sessions (Phase 4B) | REPLACED |
| `src/server/biography-voice.js` | 195 | Runs unchanged. Unity sends queries via bridge. | REUSE AS-IS |
| `src/server/perception.js` | 104 | Phase 6+ (optional) | NOT STARTED |

---

## WHAT RUNS UNCHANGED ON THE SERVER

The entire Node.js server (`src/server/`) keeps running. Unity connects to it via WebSocket for:

1. **AI citizen positions** — server ticks every 5s, Unity receives and renders
2. **Voice pipeline** — Unity sends raw audio, server returns TTS stream
3. **AI citizen speech** — server detects proximity, calls LLM, streams response
4. **Biography queries** — Unity sends donor ID + audio, server returns answer

Only `rooms.js` is replaced (by Photon Sessions). Everything else is additive — Unity is a new client type connecting to the same server.

---

## NEW UNITY SCRIPTS PER PHASE

| Phase | Script | Lines (est.) | Depends On |
|-------|--------|-------------|------------|
| 1A | `ZoneParticles.cs` | 40 | nothing |
| 2A | `SculpturePedestal.cs` | 60 | nothing |
| 2B | `WearableDisplay.cs` | 80 | nothing |
| 2C | `VideoPanel.cs` | 70 | nothing |
| 3A | `ZoneInfoPanel.cs` | 50 | nothing |
| 4A | `NetworkPlayer.cs` | 120 | Photon Fusion |
| 4A | `NetworkManager.cs` | 80 | Photon Fusion |
| 4A | `PlayerAvatar.cs` | 90 | Photon Fusion |
| 5A | (Photon Voice config) | 0 | Photon Voice |
| 5B | `VoiceBridge.cs` | 100 | Express server |
| 5B | `ManemusAvatar.cs` | 50 | Express server |
| 6A | `AICitizenRenderer.cs` | 80 | Express server |

**Total new scripts:** 12 files, ~820 lines estimated.

---

## HARD DEPENDENCIES

```
Phase 1 (particles, ocean, clouds)     → NOTHING. Start anytime after APK works.
Phase 2 (sculptures, wearables, video) → NOTHING. Local assets only.
Phase 3 (ownership UI)                 → NOTHING. Mock data.
Phase 4 (networking)                   → Photon Fusion SDK + App ID + WiFi
Phase 5 (voice)                        → Phase 4 + Photon Voice + Express server running
Phase 6 (AI citizens)                  → Express server running (WebSocket bridge)
```

Phases 1-3 are fully offline. Phases 4-6 require infrastructure.

---

## TONIGHT: NONE OF THIS

This document exists for after the APK works. Tonight's only goal: get inside.
