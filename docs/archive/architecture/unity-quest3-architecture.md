# Cities of Light — Unity Quest 3 Architecture

**Platform target:** Native Meta Quest 3 APK (Meta Quest Store)
**Engine:** Unity 6 LTS (6000.1.x)
**Render pipeline:** URP (Universal Render Pipeline)
**XR backend:** OpenXR + Meta XR SDK
**Framerate target:** 90 fps locked (Quest 3 native)
**Decision date:** 2026-03-05

---

## 1. Engine Decision: Unity + URP + OpenXR

### Why Unity over Unreal / Godot / Web

| Criterion | Unity | Unreal | Godot | Web (current) |
|-----------|-------|--------|-------|---------------|
| Quest 3 store maturity | 1000+ shipped titles | ~200 | <10 | N/A (no store) |
| Hand tracking SDK | XR Hands (1st party) | OXR plugin (3rd party) | Experimental | WebXR (limited) |
| Foveated rendering | SRP Foveation API (1 line) | Built-in but HDRP-like | None | setFoveation(1.0) |
| APK size control | IL2CPP + LZ4, 50-80MB typical | 150-300MB minimum | 30-60MB | N/A |
| Spatial audio | Built-in + Meta Spatializer | Wwise/FMOD required | Basic | Web Audio HRTF |
| C# vs Blueprints | C# (matches server logic) | BP/C++ (heavier) | GDScript | JavaScript |
| Shader authoring | Shader Graph (URP) | Material Editor | Limited | GLSL/custom |
| Build iteration | 45s hot reload, 2min Quest deploy | 5-15min full cook | Fast but immature | Instant (Vite HMR) |

**Decision: Unity 6 LTS + URP.** Unreal's minimum APK size and cook times kill iteration. Godot's XR stack is too young for store submission. Web stays as secondary build via WebGL (same Unity project, different build target).

### Why NOT HDRP

HDRP does not support Quest 3. Period. It targets desktop/console GPUs with tile-based deferred rendering. Quest 3 uses tile-based forward rendering (Adreno 740). URP's forward+ path is the only viable pipeline.

---

## 2. Package List

### Unity Package Manager (manifest.json)

```json
{
  "dependencies": {
    "com.unity.xr.openxr": "1.13.x",
    "com.unity.xr.hands": "1.5.x",
    "com.unity.xr.interaction.toolkit": "3.1.x",
    "com.unity.inputsystem": "1.11.x",
    "com.unity.render-pipelines.universal": "17.x",
    "com.unity.textmeshpro": "4.0.x",
    "com.unity.nuget.newtonsoft-json": "3.2.x",
    "com.unity.addressables": "2.3.x",
    "com.unity.burst": "1.8.x",
    "com.unity.collections": "2.5.x",
    "com.unity.mathematics": "1.3.x"
  }
}
```

### Meta-Specific (via .tgz or scoped registry)

| Package | Version | Purpose |
|---------|---------|---------|
| `com.meta.xr.sdk.core` | 72.x | OVRManager, foveation API, Guardian |
| `com.meta.xr.sdk.interaction` | 72.x | Hand grab, poke, ray — replaces XRI for hands |
| `com.meta.xr.sdk.audio` | 72.x | Meta Spatializer (HRTF, room model) |
| `com.meta.xr.sdk.platform` | 72.x | Entitlement check (store requirement) |

### NuGet / .dll (vendored in Plugins/)

| Library | Purpose |
|---------|---------|
| `NativeWebSocket` | WebSocket client (no Unity built-in) |
| `NAudio.Core` | MP3 decode for streaming TTS chunks |

### NOT included (deliberate omissions)

- **No Photon/Mirror/Netcode** — we keep the existing Node.js WebSocket server. It works. The protocol is 14 message types of JSON. No need for a networking framework.
- **No FMOD/Wwise** — Meta Spatializer + Unity AudioSource covers spatial audio. Voice TTS is MP3 streaming, decoded client-side.
- **No XR Interaction Toolkit** for hands — Meta Interaction SDK handles hand tracking better on Quest. XRI used only for controller fallback.

---

## 3. Scene Architecture

### Scene Hierarchy

```
Scenes/
├── Bootstrap.unity          (entitlement check, load settings, → Main)
├── Main.unity               (the world — never unloaded)
└── UI/
    └── StreamOverlay.unity  (additive, stream-mode HUD)
```

### Main.unity GameObject Tree

```
[Main Scene]
├── --- XR ---
│   ├── XR Origin (XR Origin + Camera Offset)
│   │   ├── Main Camera (TrackedPoseDriver, AudioListener, Meta Spatializer Listener)
│   │   ├── Left Hand (XR Hand, Meta Hand Tracking, GrabInteractor)
│   │   ├── Right Hand (XR Hand, Meta Hand Tracking, GrabInteractor)
│   │   ├── Left Controller (XR Controller, fallback ray)
│   │   └── Right Controller (XR Controller, fallback ray)
│   └── Locomotion System
│       ├── ThumbstickMove (continuous, speed 3.0, head-relative)
│       └── SnapTurn (right stick, 30° increments, threshold 0.6)
│
├── --- Environment ---
│   ├── Sky (Procedural Skybox material, Preetham model)
│   │   └── Directional Light (color #FFCC88, intensity 2.5, shadows)
│   ├── Ocean
│   │   └── WaterPlane (custom URP shader, 500×500, scrolling normals)
│   ├── Zones [parent, static]
│   │   ├── Zone_Island (pos 0,0,0)
│   │   │   ├── Terrain (mesh, vertex colors, LOD Group)
│   │   │   ├── Shore (ring mesh, transparent)
│   │   │   ├── Vegetation_Palms (instanced prefabs)
│   │   │   ├── Rocks_Beach (instanced, 25 instances)
│   │   │   ├── Rocks_Boulders (5 deformed icospheres)
│   │   │   ├── Waypoint_Archive (beacon prefab)
│   │   │   ├── Waypoint_Garden (beacon prefab)
│   │   │   ├── Waypoint_Agora (beacon prefab)
│   │   │   ├── Waypoint_Bassel (beacon prefab)
│   │   │   └── Label (TextMeshPro, billboard)
│   │   ├── Zone_Bassel (pos 42,0,18)
│   │   │   └── ... (palms variant)
│   │   ├── Zone_Archive (pos -30,0,-25)
│   │   │   └── Vegetation_Crystals (emissive icosahedra, point lights)
│   │   ├── Zone_Garden (pos 25,0,-35)
│   │   │   └── Vegetation_Flowers (instanced spheres + stems)
│   │   └── Zone_Agora (pos -20,0,40)
│   │       └── Vegetation_Columns (instanced cylinders)
│   ├── Clouds (2 planes at y=80, y=120)
│   └── Stars (particle system or point mesh, 400 points)
│
├── --- Citizens ---
│   ├── LocalAvatar (hidden in VR, synced to headset)
│   │   ├── Head (sphere r=0.15)
│   │   ├── Body (cylinder)
│   │   └── Glow (point light)
│   ├── RemoteCitizens [dynamic parent]
│   │   └── [spawned at runtime per citizen_joined]
│   ├── AICitizens [dynamic parent]
│   │   ├── VOX (icosahedron, white, spawns at Agora)
│   │   ├── LYRA (octahedron, violet, spawns at Garden)
│   │   └── PITCH (torusknot, gold, spawns at Island)
│   ├── Marco (camera body, orange octahedron + lens)
│   └── Manemus (camera body, cyan, stream POV)
│
├── --- Audio ---
│   ├── VoiceCapture (Microphone input, VAD, push-to-talk)
│   ├── VoicePlayback (AudioSource pool, Meta Spatializer)
│   └── AmbientAudio (per-zone ambient loops, crossfade)
│
├── --- Particles ---
│   ├── Fireflies (particle system, additive, zone-colored)
│   └── ZoneParticles (embers/pollen/sparks per zone)
│
├── --- Managers --- [singletons]
│   ├── NetworkManager (WebSocket, JSON serialize/deserialize)
│   ├── ZoneManager (detect zone, lerp ambient, fire events)
│   ├── VoicePipeline (record → POST → stream decode → spatial play)
│   ├── AICitizenRenderer (animate rotation, glow, bob)
│   ├── WaypointManager (proximity check, teleport)
│   ├── PerceptionCapture (offscreen render → POST frame)
│   └── MemorialManager (video surfaces, proximity trigger)
│
└── --- UI ---
    ├── WorldCanvas (zone indicator, subtitles — world-space)
    └── HUDCanvas (voice status, connection indicator — screen-space)
```

### Prefabs

```
Prefabs/
├── Citizens/
│   ├── HumanAvatar.prefab        (head + body + glow + label + hands)
│   ├── AICitizen_VOX.prefab      (icosahedron + ring + light)
│   ├── AICitizen_LYRA.prefab     (octahedron + ring + light)
│   ├── AICitizen_PITCH.prefab    (torusknot + ring + light)
│   └── CameraBody.prefab         (octahedron + lens + ring + light)
├── Environment/
│   ├── PalmTree.prefab           (trunk segments + fronds + coconuts)
│   ├── Crystal.prefab            (stretched icosahedron + base light)
│   ├── Column.prefab             (shaft + capital + base)
│   ├── Flower.prefab             (stem + petals + center)
│   ├── WaypointBeacon.prefab     (pillar + ring + light + label)
│   ├── BeachRock.prefab          (deformed dodecahedron)
│   └── Boulder.prefab            (deformed icosphere)
├── Audio/
│   └── SpatialVoiceSource.prefab (AudioSource + Meta Spatializer)
└── UI/
    ├── SubtitlePanel.prefab      (world-space TMP)
    └── ZoneIndicator.prefab      (fade-in zone name)
```

---

## 4. Performance Budget (90 fps on Snapdragon XR2 Gen 2)

### Triangle Budget

| Component | Triangles | Draw Calls | Notes |
|-----------|-----------|------------|-------|
| 5 island terrains | 40,960 | 5 | 64×64 grid each, GPU instanced |
| Shore rings | 1,280 | 5 | 64-segment rings |
| Palm trees (~40 total) | 12,000 | 8 | GPU instanced, LOD at 30m |
| Crystals (10) | 800 | 2 | Instanced |
| Columns (12) | 2,400 | 3 | Instanced |
| Flowers (35) | 1,400 | 2 | Instanced |
| Beach rocks (125 total) | 3,000 | 5 | Instanced |
| Boulders (25 total) | 5,000 | 5 | Instanced |
| Water plane | 2 | 1 | Single quad, shader handles waves |
| Clouds | 4 | 2 | 2 planes |
| Stars | 400 | 1 | Points/particle |
| 3 AI citizens | 600 | 6 | Body + ring each |
| 2 camera bodies | 200 | 4 | Octahedron + lens each |
| 5 human avatars (max) | 2,500 | 15 | Head + body + hands |
| Waypoint beacons (~15) | 1,500 | 5 | Instanced |
| Particles (fireflies) | points | 1 | 30 particles |
| Memorial (1) | 500 | 3 | Plinth + frame + screen |
| **TOTAL** | **~72,000** | **~71** | |

### Frame Budget (90 fps = 11.1ms per frame)

| Phase | Budget | Notes |
|-------|--------|-------|
| CPU main thread | 4.0ms | Scripts, physics, animation |
| CPU render thread | 2.0ms | Command buffer, draw call submission |
| GPU | 5.0ms | Vertex + fragment + post |
| **Headroom** | **0.1ms** | Thermal throttle buffer |

### Memory Budget (Quest 3: 12GB shared, app gets ~3-4GB)

| Asset | Budget |
|-------|--------|
| Meshes | 20 MB |
| Textures (LZ4) | 60 MB |
| Audio clips | 10 MB |
| Scripts (IL2CPP) | 30 MB |
| Runtime (GC heap) | 100 MB |
| Voice buffers | 20 MB |
| Video texture (memorial) | 30 MB |
| **Total target** | **< 300 MB** |

### Key Optimizations

1. **GPU Instancing** — all repeated geometry (rocks, palms, crystals, columns, flowers, beacons) uses `Graphics.DrawMeshInstanced` or MaterialPropertyBlock
2. **SRP Batcher** — all unique materials use SRP-compatible shaders (URP/Lit, URP/Unlit)
3. **LOD** — islands beyond 30m swap to single-mesh low-poly (100 tris each)
4. **Occlusion** — only render islands within 60m (disable renderer component beyond)
5. **Shadow distance** — 30m max, 512px shadow map, single cascade
6. **Water** — single-pass vertex displacement shader, no reflection probe, no planar reflection
7. **No real-time GI** — baked light probes only, placed per zone center + waypoints
8. **Object pooling** — remote citizen avatars pooled (max 10), hand joint spheres pre-allocated
9. **Foveated rendering** — `OVRManager.foveatedRenderingLevel = OVRManager.FoveatedRenderingLevel.HighTop`
10. **Fixed timestep** — physics at 45Hz (every other frame), not 90Hz

---

## 5. Build Target Settings

### Player Settings (Android)

```
Company Name: Mind Protocol
Product Name: Cities of Light
Bundle Identifier: ai.mindprotocol.citiesoflight
Version: 0.1.0
Bundle Version Code: 1

Minimum API Level: Android 12 (API 32)
Target API Level: Android 14 (API 34)
Install Location: Auto

Architecture: ARM64 only
Scripting Backend: IL2CPP
API Compatibility: .NET Standard 2.1
IL2CPP Code Generation: Faster (smaller) builds
C++ Compiler Configuration: Release

Managed Stripping Level: High
Strip Engine Code: true
```

### Graphics Settings

```
Color Space: Linear
Graphics APIs: Vulkan only (remove OpenGLES)
Rendering Path: Forward+
HDR: off
MSAA: 4x (Quest 3 handles this efficiently)
Dynamic Batching: off (use GPU instancing instead)
Static Batching: on (for environment meshes)
GPU Skinning: on (for hand meshes)
```

### URP Asset Settings

```
Main Light: Per Pixel
Additional Lights: Per Vertex, max 4
Shadow Distance: 30
Shadow Cascade: 1
Shadow Resolution: 512
Shadow Depth Bias: 1.5
Depth Texture: off
Opaque Texture: off
Post-Processing: off (no bloom, no color grading on Quest)
SRP Foveation: Enabled
SSAO: off
Decals: off
```

### XR Settings

```
OpenXR Runtime: Meta Quest
Render Mode: Multi-pass (safer) or Single Pass Instanced (perf)
  → Start with Multi-pass, optimize to Single Pass Instanced later
Depth Submission Mode: Depth 16 Bit
```

### OVR Settings

```
Target Devices: Quest 3
Hand Tracking Support: Controllers and Hands
Hand Tracking Version: V2
Foveated Rendering: on
Foveated Rendering Level: HighTop
Foveated Rendering Dynamic: on
Quest Features:
  - Hand Tracking: Required
  - Passthrough: Supported (not required)
  - Spatial Anchors: Not Used
  - Scene Understanding: Not Used
```

### Texture Settings (Import defaults)

```
Max Size: 512 (override to 256 for mobile)
Compression: ASTC 6×6 (Quest standard)
Mip Maps: on, Streaming Mip Maps: on
Read/Write: off
```

---

## 6. Migration Steps (from Web Prototype)

### Phase 0: Unity Project Setup (Day 1)

1. Create Unity 6 project with URP template (3D Mobile)
2. Import packages: OpenXR, XR Hands, Input System, Meta XR SDK
3. Configure Player Settings per section 5 above
4. Set up Android build target, connect Quest 3 via USB
5. Deploy empty scene — confirm 90fps with foveated rendering
6. Set up Git: `.gitignore` for Library/, Temp/, Logs/, obj/

### Phase 1: Environment (Days 2-4)

**Port order: things that don't move first.**

1. **Sky** — create Procedural Skybox material: turbidity 4, rayleigh 1.5, sun elevation 12, azimuth 220. Assign to Lighting > Skybox Material.
2. **Directional Light** — color #FFCC88, intensity 2.5, shadow resolution 512, shadow distance 30m, 1 cascade.
3. **Water** — write `WaterShader.shader` (URP compatible):
   - Vertex displacement: 2 sine waves (amplitude 0.3, frequency 0.5)
   - Fragment: base color #001E4D, normal map scroll (reuse Three.js water normals texture)
   - No reflection, no refraction. Quest can't afford planar reflections.
4. **Island meshes** — export from Three.js or regenerate:
   - Option A: Run Node.js script to dump vertex positions/colors to .obj files
   - Option B: Rewrite procedural generation in C# (same fbm noise, same palette)
   - **Recommendation: Option B** — C# procedural gen means we can iterate in-editor
   - `IslandGenerator.cs`: takes zone config, outputs Mesh with vertex colors
5. **Zone vegetation** — create prefabs, place with `VegetationPlacer.cs`:
   - `PalmTree.prefab`: 8 cylinder trunk segments + 7 frond meshes + 3 coconut spheres
   - `Crystal.prefab`: stretched icosahedron, emissive URP/Lit + point light
   - `Column.prefab`: cylinder shaft + capital + base, marble material
   - `Flower.prefab`: thin cylinder stem + sphere petals + center sphere
6. **Rocks** — deformed dodecahedrons/icospheres, GPU instanced
7. **Clouds** — 2 transparent quads at y=80 and y=120, procedural cloud texture
8. **Stars** — VFX Graph or legacy particle system, 400 points, additive
9. **Fog** — URP fog settings per zone, managed by `ZoneManager.cs`

### Phase 2: XR + Input (Days 5-6)

1. **XR Origin** — set up with Camera Offset, TrackedPoseDriver
2. **Hand tracking** — XR Hands package + Meta hand tracking:
   - 25 joint spheres per hand (pre-allocated, pooled)
   - Pinch detection: thumb-tip to index-tip < 0.03m
3. **Controller fallback** — XR Controller with Input System bindings:
   - Left thumbstick: continuous locomotion (speed 3.0 m/s, head-relative, strafe)
   - Right thumbstick X: snap turn 30° (threshold 0.6, reset 0.3)
   - Right A button: push-to-talk
   - Grip: grab
4. **Grab system** — Meta Interaction SDK `HandGrabInteractable` on camera bodies
5. **Locomotion** — `ContinuousMoveProvider` + `SnapTurnProvider` from XRI

### Phase 3: Citizens + Multiplayer (Days 7-9)

1. **NetworkManager.cs** — WebSocket client (NativeWebSocket):
   - Same JSON protocol, same 14 message types
   - Same server (Node.js on port 8800) — no server changes needed
   - Position sync at 100ms interval
   - Reconnect on close (3s backoff)
2. **CitizenSpawner.cs** — handles `citizen_joined`:
   - Pool of 10 `HumanAvatar.prefab` instances
   - AI citizens: detect `persona === "ai"`, spawn matching prefab
3. **CitizenMover.cs** — handles `citizen_moved`:
   - `Vector3.Lerp(current, target, 0.3)` for position
   - `Quaternion.Slerp(current, target, 0.3)` for rotation
4. **AICitizenAnimator.cs** — per-frame:
   - Body Y rotation: `elapsed * 0.5` rad/s (28.6°/s)
   - Ring Z rotation: `elapsed * 0.3` rad/s
   - Emissive pulse: `0.4 + sin(elapsed * 2) * 0.2` via MaterialPropertyBlock
5. **Camera bodies** — grabbable, draggable, ring rotation animation

### Phase 4: Voice Pipeline (Days 10-12)

1. **VoiceCapture.cs** — `Microphone.Start()`, push-to-talk:
   - A button (controller) or pinch gesture (hands) starts recording
   - Release → encode to WAV (or Opus via native plugin)
   - POST base64 to server `/ws` (voice message) OR HTTP endpoint
2. **VoicePlayback.cs** — streaming MP3 decode + spatial play:
   - Receive `voice_stream_data` chunks → NAudio decode to PCM
   - Feed PCM to `AudioSource.clip` via `AudioClip.Create` + `OnAudioRead`
   - Position AudioSource at speaker's world position (Marco or AI citizen)
   - Meta Spatializer: HRTF, inverse distance, refDistance=1, maxDistance=50
3. **SubtitleDisplay.cs** — world-space TextMeshPro:
   - Show transcription + response on `voice_stream_start`
   - 20s display, 2s fade out
4. **AI citizen speak** — `ai_citizen_speak` message → show subtitle + queue audio from AI position

### Phase 5: Zones + Teleport (Days 13-14)

1. **ZoneManager.cs** — port `detectNearestZone()`:
   - Per-frame: compute nearest zone from XR Origin position
   - On zone change: lerp fog, directional light color, particle color
   - Lerp: `0.02 * 60 * deltaTime` (time-based, frame-rate independent)
   - Fire `OnZoneChanged` event
2. **WaypointBeacon.cs** — prefab at shore (11m from zone center):
   - Pillar + ring + light + label (TextMeshPro billboard)
   - Pulse animation: ring rotation, opacity sine
   - Proximity check: < 2.5m + grip → teleport
3. **Teleport** — instant reposition XR Origin to target zone center

### Phase 6: Polish + Store (Days 15-18)

1. **Memorial system** — video surface, proximity-triggered `VideoPlayer`
2. **Perception camera** — offscreen `Camera.Render()` at 256×256, POST to server
3. **Entitlement check** — `Platform.InitializeAsync()` in Bootstrap scene
4. **Store metadata** — screenshots, video, description, privacy policy
5. **Performance profiling** — Unity Profiler on Quest, verify:
   - Consistent 90fps
   - No GC spikes > 1ms
   - GPU time < 5ms
   - Memory < 300MB
6. **APK build** — `Build Settings > Android > Build` → `.apk`
7. **Submit to Meta Quest Store** (or App Lab for testing)

---

## 7. Unity Project Folder Structure

```
CitiesOfLight/
├── Assets/
│   ├── _Project/                    # All our code and assets
│   │   ├── Scripts/
│   │   │   ├── Core/
│   │   │   │   ├── Bootstrap.cs            # Entitlement, scene load
│   │   │   │   ├── GameManager.cs          # Singleton, app lifecycle
│   │   │   │   └── Constants.cs            # Ports, URLs, magic numbers
│   │   │   ├── Network/
│   │   │   │   ├── NetworkManager.cs       # WebSocket client
│   │   │   │   ├── MessageTypes.cs         # JSON serialization classes
│   │   │   │   └── NetworkMessages.cs      # Send/receive helpers
│   │   │   ├── Citizens/
│   │   │   │   ├── LocalAvatar.cs          # Track headset, sync position
│   │   │   │   ├── RemoteCitizen.cs        # Lerp position/rotation
│   │   │   │   ├── CitizenSpawner.cs       # Pool + spawn/despawn
│   │   │   │   ├── AICitizenAnimator.cs    # Rotation, glow, bob
│   │   │   │   ├── CameraBody.cs           # Grabbable camera entity
│   │   │   │   └── HandVisualizer.cs       # 25 joint spheres + lines
│   │   │   ├── Environment/
│   │   │   │   ├── IslandGenerator.cs      # Procedural mesh from zone config
│   │   │   │   ├── VegetationPlacer.cs     # Instanced placement
│   │   │   │   ├── ZoneManager.cs          # Zone detect, ambient lerp
│   │   │   │   ├── ZoneDefinitions.cs      # Port of zones.js (ScriptableObject)
│   │   │   │   ├── WaterAnimator.cs        # Water shader time uniform
│   │   │   │   ├── SkyController.cs        # Procedural skybox params
│   │   │   │   ├── ParticleController.cs   # Fireflies, zone particles
│   │   │   │   └── CloudAnimator.cs        # Drift + opacity
│   │   │   ├── Interaction/
│   │   │   │   ├── GrabSystem.cs           # Hand/controller grab
│   │   │   │   ├── WaypointInteraction.cs  # Proximity + grip = teleport
│   │   │   │   ├── PushToTalk.cs           # A button / pinch → record
│   │   │   │   └── MemorialInteraction.cs  # Proximity → video play
│   │   │   ├── Voice/
│   │   │   │   ├── VoiceCapture.cs         # Mic → buffer → encode
│   │   │   │   ├── VoicePlayback.cs        # Streaming MP3 → AudioSource
│   │   │   │   ├── SpatialAudioPool.cs     # Pool of positioned AudioSources
│   │   │   │   └── SubtitleDisplay.cs      # World-space TMP text
│   │   │   ├── Perception/
│   │   │   │   ├── PerceptionCapture.cs    # Offscreen render → POST
│   │   │   │   └── PerceptionCamera.cs     # Camera component config
│   │   │   └── UI/
│   │   │       ├── ZoneIndicatorUI.cs      # Current zone name
│   │   │       ├── ConnectionStatusUI.cs   # WS connected/offline
│   │   │       ├── VoiceStatusUI.cs        # Recording indicator
│   │   │       └── StreamOverlayUI.cs      # LIVE badge, citizen count
│   │   │
│   │   ├── Shaders/
│   │   │   ├── Water.shader               # URP vertex displacement water
│   │   │   ├── EmissiveTransparent.shader  # Crystals, AI citizens, beacons
│   │   │   ├── VertexColor.shader          # Island terrain (URP + vertex colors)
│   │   │   └── Additive.shader            # Particles, star points
│   │   │
│   │   ├── Materials/
│   │   │   ├── Environment/
│   │   │   │   ├── Water.mat
│   │   │   │   ├── Sand_WarmSand.mat
│   │   │   │   ├── Sand_Tropical.mat
│   │   │   │   ├── Sand_DeepBlue.mat
│   │   │   │   ├── Sand_GreenMoss.mat
│   │   │   │   ├── Sand_Marble.mat
│   │   │   │   ├── Rock.mat (×5 color variants)
│   │   │   │   ├── PalmTrunk.mat
│   │   │   │   ├── PalmFrond.mat
│   │   │   │   ├── Cloud.mat
│   │   │   │   └── Shore.mat
│   │   │   ├── Citizens/
│   │   │   │   ├── HumanAvatar_Green.mat
│   │   │   │   ├── HumanAvatar_Blue.mat
│   │   │   │   ├── AI_VOX_White.mat
│   │   │   │   ├── AI_LYRA_Violet.mat
│   │   │   │   ├── AI_PITCH_Gold.mat
│   │   │   │   └── CameraBody_Orange.mat
│   │   │   └── FX/
│   │   │       ├── Firefly.mat
│   │   │       ├── Crystal_Emissive.mat
│   │   │       ├── Beacon_Emissive.mat
│   │   │       └── Star.mat
│   │   │
│   │   ├── Textures/
│   │   │   ├── WaterNormals.png           # 256×256 (from Three.js)
│   │   │   ├── SandNormal.png             # 256×256 procedural
│   │   │   ├── CloudAlpha.png             # 512×512 procedural
│   │   │   └── Icons/
│   │   │       ├── icon-192.png
│   │   │       └── icon-512.png
│   │   │
│   │   ├── Prefabs/
│   │   │   ├── Citizens/
│   │   │   │   ├── HumanAvatar.prefab
│   │   │   │   ├── AICitizen_VOX.prefab
│   │   │   │   ├── AICitizen_LYRA.prefab
│   │   │   │   ├── AICitizen_PITCH.prefab
│   │   │   │   └── CameraBody.prefab
│   │   │   ├── Environment/
│   │   │   │   ├── PalmTree.prefab
│   │   │   │   ├── Crystal.prefab
│   │   │   │   ├── Column.prefab
│   │   │   │   ├── Flower.prefab
│   │   │   │   ├── WaypointBeacon.prefab
│   │   │   │   ├── BeachRock.prefab
│   │   │   │   └── Boulder.prefab
│   │   │   ├── Audio/
│   │   │   │   └── SpatialVoiceSource.prefab
│   │   │   └── UI/
│   │   │       ├── SubtitlePanel.prefab
│   │   │       └── ZoneIndicator.prefab
│   │   │
│   │   ├── Scenes/
│   │   │   ├── Bootstrap.unity
│   │   │   ├── Main.unity
│   │   │   └── StreamOverlay.unity
│   │   │
│   │   ├── ScriptableObjects/
│   │   │   ├── ZoneData/
│   │   │   │   ├── Zone_Island.asset
│   │   │   │   ├── Zone_Bassel.asset
│   │   │   │   ├── Zone_Archive.asset
│   │   │   │   ├── Zone_Garden.asset
│   │   │   │   └── Zone_Agora.asset
│   │   │   ├── AICitizenData/
│   │   │   │   ├── AICitizen_VOX.asset
│   │   │   │   ├── AICitizen_LYRA.asset
│   │   │   │   └── AICitizen_PITCH.asset
│   │   │   └── Settings/
│   │   │       ├── NetworkSettings.asset   # Server URL, ports
│   │   │       └── PerformanceSettings.asset # LOD distances, counts
│   │   │
│   │   └── Audio/
│   │       └── Ambient/
│   │           └── (placeholder for zone ambient loops)
│   │
│   ├── Plugins/
│   │   ├── NativeWebSocket/              # WebSocket .dll
│   │   └── NAudio/                       # MP3 decoder .dll
│   │
│   └── Settings/
│       ├── UniversalRenderPipelineAsset.asset
│       ├── ForwardRenderer.asset
│       └── InputActions.inputactions
│
├── Packages/
│   └── manifest.json
│
├── ProjectSettings/
│   ├── ProjectSettings.asset
│   ├── QualitySettings.asset
│   └── ...
│
├── .gitignore
├── .gitattributes                    # LFS for textures, audio
└── README.md
```

### ScriptableObject: ZoneData

```csharp
[CreateAssetMenu(fileName = "Zone", menuName = "Cities/Zone Data")]
public class ZoneData : ScriptableObject
{
    public string id;
    public string displayName;
    public string loreName;
    public Vector2 position;        // XZ world position
    public int seed;
    public string mode;

    [Header("Terrain")]
    public string palette;          // warm-sand, tropical, deep-blue, green-moss, marble
    public string vegetation;       // palms, crystals, columns, flowers
    public float rockDensity;

    [Header("Ambient")]
    public Color fogColor;
    public float fogDensity;
    public Color particleColor;
    public string particleType;     // fireflies, embers, pollen, sparks
    public Color lightColor;
    public float lightIntensity;

    [Header("Connectivity")]
    public string[] waypointTargets; // zone IDs this zone connects to
}
```

---

## Summary: What Changes, What Stays

| Component | Change? | Notes |
|-----------|---------|-------|
| Server (Node.js) | **No change** | Same WebSocket server, same protocol, same port |
| Voice pipeline (server) | **No change** | Same STT→GPT-4o→TTS, same streaming |
| AI citizen logic (server) | **No change** | Same tick loop, same LLM calls |
| FastAPI services | **No change** | Same consent/vault/audit |
| Client rendering | **Full rewrite** | Three.js → Unity URP |
| Client input | **Full rewrite** | WebXR → OpenXR + Meta SDK |
| Client networking | **Rewrite transport** | Same protocol, different WebSocket library |
| Client voice capture | **Rewrite** | Web MediaRecorder → Unity Microphone |
| Client voice playback | **Rewrite** | Web Audio → Unity AudioSource + Meta Spatializer |
| Zone data | **Port** | zones.js → ZoneData ScriptableObjects |
| Build/deploy | **New** | Vite → Unity Build Pipeline → APK |
