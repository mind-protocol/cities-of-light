# SYNC -- Spatial Audio

> Current state of spatial audio infrastructure in Cities of Light.
> What exists, what needs Venice-specific work, what must be built new.

---

## What Exists in Cities of Light

The codebase has functional spatial audio for two use cases: TTS voice playback
and WebRTC peer-to-peer voice. Both use Web Audio API with HRTF panning.

### Client-Side Spatial Playback

| File                         | Status  | Function                                    |
|------------------------------|---------|---------------------------------------------|
| `src/client/voice.js`        | Working | SpatialVoice: HRTF PannerNode, listener update, streaming TTS playback, crossfade |
| `src/client/voice-chat.js`   | Working | VoiceChat: WebRTC peer audio, per-peer HRTF PannerNode, per-frame position updates |
| `src/client/zone-ambient.js` | Working | ZoneAmbient: fog/light transitions per zone. **No audio.** Visual only. |

**`voice.js` (SpatialVoice) spatial capabilities:**
- Single shared PannerNode for TTS playback (HRTF, inverse distance, rolloff 1.0)
- Per-frame listener position/orientation update from camera
- Crossfade: 300ms fade-out of previous audio, 200ms fade-in of new
- `playAtPosition()`: decode base64 audio, position PannerNode, play through buffer source
- `playRawAtPosition()`: citizen voice playback, creates per-call PannerNode (HRTF, rolloff 1.0)
- Resume-on-interaction for AudioContext (browser autoplay policy)

**`voice-chat.js` (VoiceChat) spatial capabilities:**
- Per-peer PannerNode (HRTF, inverse distance, rolloff 1.5, maxDistance 50m)
- Per-frame position update from avatar transforms
- Listener position/orientation from camera
- Both modern (AudioParam) and legacy (setPosition/setOrientation) API paths

**`zone-ambient.js` (ZoneAmbient) capabilities:**
- Detects nearest zone from player position each frame
- Lerps fog color, fog density, particle color, hemisphere light color
- `onZoneChanged` callback fires on zone transitions
- **Has no audio component.** It only handles visual atmosphere (fog, light, particles).

### Server-Side Audio

| File                         | Status  | Function                                    |
|------------------------------|---------|---------------------------------------------|
| `src/server/voice.js`        | Working | TTS generation (ElevenLabs streaming, OpenAI fallback) |
| `src/server/ai-citizens.js`  | Working | 3 AI citizens with position-based proximity checks |

The server has no concept of spatial audio. It generates TTS audio and sends
raw bytes over WebSocket. All spatialization happens client-side.

### Zone Definitions

| File                         | Status  | Function                                    |
|------------------------------|---------|---------------------------------------------|
| `src/shared/zones.js`        | Working | 5 island zones with positions, radii, ambient visual settings |

Zones define: id, name, position (x,y,z), radius, ambient (fogColor, fogDensity,
particleColor, lightColor). These are the original Cities of Light island zones,
not Venice districts. Each zone has visual ambient but **no audio ambient data**.

---

## What Needs Venice-Specific Work

### 1. District Audio Profiles

The zone system handles 5 generic island zones. Venice needs district-specific
audio profiles with ambient sound definitions.

**Current state:** `zone-ambient.js` transitions visual fog/light. It has the
zone-detection infrastructure (player position -> nearest zone) and the
transition-smoothing pattern (lerp per frame). But it has zero audio fields.

**Required:**
- Extend zone definitions in `src/shared/zones.js` (or new `districts.js`) to
  include audio profiles: primary loop URL, secondary loop URL, accent sounds,
  reverb IR reference, crowd density level
- Add ambient audio playback to `zone-ambient.js` or create a new
  `district-audio.js` that subscribes to zone change events
- Crossfade audio loops on district transitions (3s fade, matching the visual
  transition timing)
- Time-of-day modulation: night reduces crowd/market volumes, increases
  water/wind volumes

**Asset requirements:**
- 10-15 ambient audio loops (30-60s each, seamless loop points)
- 5 impulse response files for reverb presets (~100KB each)
- Format: OGG/Vorbis (smaller than MP3, supported everywhere including Quest)

**Estimated effort:** 3-4 days (code + asset sourcing/editing)

### 2. Audio Priority System

The codebase currently creates PannerNodes without any budget tracking. Each
`playRawAtPosition()` call creates a new PannerNode. Each VoiceChat peer gets
a PannerNode. There is no upper bound on simultaneous sources.

**Current state:** Works fine with 3 AI citizens and a handful of peers. Will
break at 186 citizens. Even with tier-based culling reducing the number of
speaking citizens, ambient loops + event sounds + citizen voices can easily
exceed 32 sources.

**Required:**
- Central audio source manager that tracks all active sources
- Priority tiers (CRITICAL, FOREGROUND, ACTIVE, AMBIENT) with hard caps
- Eviction policy: lowest priority + farthest distance gets stopped
- Integration points: SpatialVoice, VoiceChat, and the new district audio
  system must all request sources through the manager

**Estimated effort:** 2-3 days

### 3. Reverb Per District

No reverb processing exists anywhere in the codebase. All audio plays dry.

**Required:**
- ConvolverNode per district type (piazza, calle, canal-side, church, bridge)
- Wet/dry mix control per audio layer (voice vs. ambient vs. events)
- Crossfade between reverb profiles on district transition
- Load impulse responses on demand (do not preload all 5 at startup)

**Estimated effort:** 2-3 days

### 4. Occlusion Model

No occlusion exists. Sound passes through all geometry. A citizen behind a
building sounds exactly the same as one in the open.

**Required:**
- Define acoustic zones (aligned with walkable areas)
- Zone connectivity graph (which zones hear each other)
- Per-source occlusion check: same zone = clear, adjacent = muffled, separated = culled
- Low-pass filter (BiquadFilterNode) for muffled sources
- Zone membership computed from player position (reuse zone detection logic)

**Estimated effort:** 3-4 days (depends on zone authoring complexity)

---

## What Must Be Built New

These capabilities have no precedent in the current codebase.

### 1. AudioSourceManager (Central Budget Controller)

Nothing in the codebase tracks total audio source count or enforces limits.
This is the single most important new system for Quest 3 performance.

```
AudioSourceManager:
  - registerSource(id, tier, position) -> AudioSourceHandle | null
  - releaseSource(id)
  - updatePosition(id, position)
  - getActiveSources() -> count per tier
  - setMaxSources(n)  // default 32
```

All audio-producing code (SpatialVoice, VoiceChat, district-audio, events)
must route through this manager. Direct AudioContext.createPanner() calls
outside the manager are a bug.

### 2. DistrictAudioEngine

The ambient audio system that replaces the visual-only `zone-ambient.js` with
a full audioscape per district.

```
DistrictAudioEngine:
  - constructor(audioContext, audioSourceManager)
  - setDistrict(districtId)  // triggers crossfade
  - setTimeOfDay(hour)       // modulates volumes
  - update(playerPosition)   // per-frame: adjusts panning bias
  - dispose()
```

Owns 2-4 audio loop sources per district, requests them through
AudioSourceManager as AMBIENT tier. On district transition, fades out old
loops over 3 seconds while fading in new ones.

### 3. ReverbEngine

Manages ConvolverNode loading and switching.

```
ReverbEngine:
  - constructor(audioContext)
  - loadProfile(districtType) -> Promise  // lazy load IR
  - setActiveProfile(districtType)        // crossfade reverb
  - createSend(wetDryRatio) -> GainNode   // audio routes through this
```

### 4. OcclusionSystem

Zone-based occlusion lookups.

```
OcclusionSystem:
  - constructor(zoneGraph)
  - getAttenuation(listenerZone, sourceZone) -> { gain: number, lowPassFreq: number }
```

Returns gain multiplier (1.0, 0.25, 0.0) and low-pass filter frequency
(20000, 2000, 0) based on zone connectivity.

---

## Architecture Comparison

```
CURRENT (Cities of Light)              TARGET (Venezia)
=========================              =================

SpatialVoice                           AudioSourceManager (budget)
  - 1 shared PannerNode                   |
  - No budget tracking                    +-- SpatialVoice (citizen voices)
  - No reverb                             |     - 1 PannerNode per active citizen
  - No occlusion                          |     - Routes through reverb send
                                          |
VoiceChat                                +-- VoiceChat (peer-to-peer)
  - 1 PannerNode per peer                |     - Unchanged spatial model
  - No budget tracking                    |     - Registers with manager
                                          |
ZoneAmbient                              +-- DistrictAudioEngine (ambient)
  - Visual only (fog, light)              |     - 2-4 loops per district
  - No audio                              |     - Crossfade on transition
                                          |     - Time-of-day modulation
(nothing)                                 |
                                          +-- ReverbEngine (ConvolverNode)
                                          |     - 1 active profile at a time
                                          |     - Wet/dry per audio layer
                                          |
                                          +-- OcclusionSystem (zone lookup)
                                                - Gain + low-pass per source
```

---

## File Map (Planned)

```
src/client/
  audio/
    audio-source-manager.js    # NEW: central budget controller (32 sources)
    district-audio.js          # NEW: ambient loops per Venice district
    reverb-engine.js           # NEW: ConvolverNode per district type
    occlusion.js               # NEW: zone-based attenuation lookup
  voice.js                     # EXTEND: register sources with manager
  voice-chat.js                # EXTEND: register peers with manager
  zone-ambient.js              # EXTEND: hook district-audio on zone change

src/shared/
  districts.js                 # NEW: Venice district definitions with audio profiles
  acoustic-zones.js            # NEW: zone connectivity graph for occlusion

data/audio/
  ambient/                     # Ambient loops (OGG, 30-60s each)
  impulse-responses/           # Reverb IRs (WAV, 16-bit, 44.1kHz)
```

---

## Priority Roadmap

| Priority | Task                          | Blocks                          | Effort  |
|----------|-------------------------------|---------------------------------|---------|
| P0       | AudioSourceManager            | All other spatial audio work    | 2-3 days |
| P1       | District ambient loops        | World feels silent between voices | 3-4 days |
| P1       | Reverb per district           | All spaces sound identical      | 2-3 days |
| P2       | Occlusion (zone-based)        | Sound leaks through buildings   | 3-4 days |
| P3       | Time-of-day ambient modulation | Night sounds same as day       | 1 day    |
| P3       | Event sound effects           | Narrative moments have no audio | 2-3 days |
