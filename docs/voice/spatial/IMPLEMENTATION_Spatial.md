# IMPLEMENTATION -- Spatial Audio

> Concrete Web Audio API code, node graphs, HRTF configuration, impulse
> response management, priority queue implementation, and zone-ambient
> integration for Venezia.
> Reference source: `src/client/voice.js`, `src/client/voice-chat.js`,
> `src/client/zone-ambient.js`, `src/client/main.js`.

---

## 1. Current Audio Architecture

The existing codebase has three independent audio systems that each manage
their own `AudioContext` and `PannerNode` instances:

| System | File | AudioContext | Purpose |
|--------|------|-------------|---------|
| SpatialVoice | `voice.js` | 44100 Hz | TTS playback (Manemus + AI citizens) |
| VoiceChat | `voice-chat.js` | 48000 Hz | WebRTC peer-to-peer spatial voice |
| ZoneAmbient | `zone-ambient.js` | none | Fog/light transitions only (no audio yet) |

For Venezia, these must unify under a single `AudioContext` with a shared
priority queue and budget manager. This document specifies that unified
architecture using the existing code as the starting point.

---

## 2. AudioContext Initialization

### 2.1 Single Shared Context

```javascript
// src/client/audio-manager.js — new unified audio manager

const SAMPLE_RATE = 48000;  // Quest 3 native rate, avoids resampling

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sources = new Map();      // id -> AudioSource
    this.activeCount = 0;
    this.budgets = new Map();
    this._initialized = false;
  }

  /**
   * Must be called from a user gesture (click, XR session start).
   * Creates the AudioContext and master gain node.
   */
  async init() {
    if (this._initialized) return;

    this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    // Master gain for global volume control
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;
    this.masterGain.connect(this.ctx.destination);

    // Initialize tier budgets
    this.budgets.set('CRITICAL',   { max: 2,  current: 0 });
    this.budgets.set('FOREGROUND', { max: 6,  current: 0 });
    this.budgets.set('ACTIVE',     { max: 8,  current: 0 });
    this.budgets.set('AMBIENT',    { max: 16, current: 0 });

    this._initialized = true;
  }

  get audioContext() { return this.ctx; }
  get listener() { return this.ctx?.listener; }
}
```

### 2.2 AudioContext State Management

```javascript
// Browser autoplay policy requires user gesture to start AudioContext.
// Quest 3 OculusBrowser resumes on XR session start.

async ensureRunning() {
  if (!this.ctx) return false;
  if (this.ctx.state === 'suspended') {
    await this.ctx.resume();
  }
  return this.ctx.state === 'running';
}
```

### 2.3 Integration with Existing SpatialVoice

The existing `SpatialVoice` class creates its own `AudioContext({ sampleRate: 44100 })`.
To unify, modify `SpatialVoice` to accept an external context:

```javascript
// Modified SpatialVoice constructor
constructor(audioManager) {
  this.audioManager = audioManager;
  this.audioContext = null;   // Set from audioManager.ctx after init
  this.pannerNode = null;
  // ... rest unchanged
}

_ensurePlayback() {
  if (this.audioContext) return true;
  if (!this.audioManager?.ctx) return false;
  this.audioContext = this.audioManager.ctx;

  this.pannerNode = this.audioContext.createPanner();
  this.pannerNode.panningModel = 'HRTF';
  this.pannerNode.distanceModel = 'inverse';
  this.pannerNode.refDistance = 1;
  this.pannerNode.maxDistance = 50;
  this.pannerNode.rolloffFactor = 1;
  this.pannerNode.coneInnerAngle = 360;
  this.pannerNode.coneOuterAngle = 360;
  this.pannerNode.connect(this.audioManager.masterGain);
  return true;
}
```

---

## 3. PannerNode Configuration

### 3.1 HRTF Panner Factory

```javascript
// Creates a configured PannerNode for a given tier and position.

function createPanner(ctx, position, tier, destination) {
  const panner = ctx.createPanner();

  // HRTF: binaural rendering for headphones (Quest 3 default output)
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';

  // Distance parameters
  panner.refDistance = 1.0;
  panner.maxDistance = 50.0;
  panner.rolloffFactor = ROLLOFF_BY_TIER[tier];

  // Omnidirectional emission
  panner.coneInnerAngle = 360;
  panner.coneOuterAngle = 360;
  panner.coneOuterGain = 1.0;

  // Initial position
  panner.positionX.value = position.x;
  panner.positionY.value = position.y;
  panner.positionZ.value = position.z;

  panner.connect(destination);
  return panner;
}

const ROLLOFF_BY_TIER = {
  CRITICAL:   1.0,   // Citizen responses stay audible at medium range
  FOREGROUND: 1.5,   // Standard voice falloff
  ACTIVE:     2.0,   // Background chatter drops faster
  AMBIENT:    1.0,   // Ambient loops need reach
};
```

### 3.2 Existing PannerNode Configurations

The codebase already has two PannerNode configurations:

**SpatialVoice (voice.js):**
```javascript
this.pannerNode = this.audioContext.createPanner();
this.pannerNode.panningModel = 'HRTF';
this.pannerNode.distanceModel = 'inverse';
this.pannerNode.refDistance = 1;
this.pannerNode.maxDistance = 50;
this.pannerNode.rolloffFactor = 1;
this.pannerNode.coneInnerAngle = 360;
this.pannerNode.coneOuterAngle = 360;
```

**VoiceChat (voice-chat.js):**
```javascript
peer.panner = this.audioCtx.createPanner();
peer.panner.panningModel = 'HRTF';
peer.panner.distanceModel = 'inverse';
peer.panner.refDistance = 1;
peer.panner.maxDistance = 50;
peer.panner.rolloffFactor = 1.5;
peer.panner.coneInnerAngle = 360;
peer.panner.coneOuterAngle = 360;
```

The VoiceChat rolloff (1.5) is steeper than SpatialVoice (1.0) because
peer voice should drop faster -- you should not hear someone clearly from
across the island. TTS playback (CRITICAL tier) uses gentler rolloff so
responses to your speech remain audible.

### 3.3 Distance Attenuation Curve (inverse model)

```
gain = refDistance / (refDistance + rolloffFactor * (distance - refDistance))

For refDistance=1, rolloffFactor=1.5:

  1m  -> 1.000   (full volume)
  2m  -> 0.400
  5m  -> 0.143
  10m -> 0.069
  15m -> 0.045
  25m -> 0.027
  50m -> 0.013   (barely perceptible)
```

---

## 4. Listener Update (Per Frame)

### 4.1 Existing Implementation in SpatialVoice

```javascript
// src/client/voice.js — updateListener()
updateListener(camera) {
  if (!this.audioContext) return;

  const listener = this.audioContext.listener;
  const pos = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  camera.getWorldPosition(pos);
  camera.getWorldDirection(fwd);
  up.applyQuaternion(camera.quaternion);

  if (listener.positionX) {
    // Modern API (AudioParam)
    listener.positionX.value = pos.x;
    listener.positionY.value = pos.y;
    listener.positionZ.value = pos.z;
    listener.forwardX.value = fwd.x;
    listener.forwardY.value = fwd.y;
    listener.forwardZ.value = fwd.z;
    listener.upX.value = up.x;
    listener.upY.value = up.y;
    listener.upZ.value = up.z;
  } else {
    // Legacy API
    listener.setPosition(pos.x, pos.y, pos.z);
    listener.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
  }
}
```

### 4.2 Existing Implementation in VoiceChat

```javascript
// src/client/voice-chat.js — updatePositions()
// Uses the same dual-API pattern (modern AudioParam + legacy fallback)
if (listener.positionX) {
  listener.positionX.value = listenerPos.x;
  // ...
} else {
  listener.setPosition(listenerPos.x, listenerPos.y, listenerPos.z);
  listener.setOrientation(listenerFwd.x, listenerFwd.y, listenerFwd.z, 0, 1, 0);
}
```

### 4.3 Unified Listener Update

With a shared AudioContext, only one listener update per frame is needed.
The call in `main.js` animation loop becomes:

```javascript
// In the animation loop, after all position updates:
audioManager.updateListener(camera);

// Where audioManager.updateListener avoids per-frame allocations:
const _listenerPos = new THREE.Vector3();
const _listenerFwd = new THREE.Vector3();
const _listenerUp = new THREE.Vector3();

updateListener(camera) {
  if (!this.ctx) return;
  const listener = this.ctx.listener;

  camera.getWorldPosition(_listenerPos);
  camera.getWorldDirection(_listenerFwd);
  _listenerUp.set(0, 1, 0).applyQuaternion(camera.quaternion);

  if (listener.positionX) {
    listener.positionX.value = _listenerPos.x;
    listener.positionY.value = _listenerPos.y;
    listener.positionZ.value = _listenerPos.z;
    listener.forwardX.value = _listenerFwd.x;
    listener.forwardY.value = _listenerFwd.y;
    listener.forwardZ.value = _listenerFwd.z;
    listener.upX.value = _listenerUp.x;
    listener.upY.value = _listenerUp.y;
    listener.upZ.value = _listenerUp.z;
  } else {
    listener.setPosition(_listenerPos.x, _listenerPos.y, _listenerPos.z);
    listener.setOrientation(
      _listenerFwd.x, _listenerFwd.y, _listenerFwd.z,
      _listenerUp.x, _listenerUp.y, _listenerUp.z
    );
  }
}
```

---

## 5. Priority Queue and Budget Enforcement

### 5.1 Audio Source Data Structure

```javascript
class AudioSource {
  constructor(id, tier, position) {
    this.id = id;
    this.tier = tier;          // 'CRITICAL' | 'FOREGROUND' | 'ACTIVE' | 'AMBIENT'
    this.position = position;  // { x, y, z }
    this.pannerNode = null;
    this.gainNode = null;
    this.sourceNode = null;
    this.distance = 0;         // Cached distance to listener
    this.active = false;
    this.createdAt = 0;
    this.fadeState = 'NONE';   // 'NONE' | 'FADING_IN' | 'FADING_OUT'
    this.fadeEndTime = 0;
    this.lowPassFilter = null;
  }
}
```

### 5.2 Budget Constants

```javascript
const TIER_BUDGETS = {
  CRITICAL:   { max: 2 },     // Direct responses to visitor
  FOREGROUND: { max: 6 },     // Nearby citizen conversations
  ACTIVE:     { max: 8 },     // Background chatter
  AMBIENT:    { max: 16 },    // Zone loops, environmental
};
const TOTAL_BUDGET = 32;       // Quest 3 practical limit
```

### 5.3 Request and Eviction

```javascript
requestSource(id, tier, position, audioBuffer) {
  if (this.sources.has(id)) {
    const existing = this.sources.get(id);
    this._updatePosition(existing, position);
    return existing;
  }

  if (this.activeCount < TOTAL_BUDGET) {
    const source = this._createSource(id, tier, position, audioBuffer);
    this._activate(source);
    return source;
  }

  // Budget full -- evict farthest source at same or lower priority
  const victim = this._findEvictionCandidate(tier);
  if (!victim) return null;

  this._deactivate(victim, true);
  const source = this._createSource(id, tier, position, audioBuffer);
  this._activate(source);
  return source;
}

_findEvictionCandidate(requestingTier) {
  const tierOrder = ['CRITICAL', 'FOREGROUND', 'ACTIVE', 'AMBIENT'];
  const requestIdx = tierOrder.indexOf(requestingTier);

  let farthest = null;
  let farthestDist = -1;

  for (const source of this.sources.values()) {
    if (!source.active) continue;
    const sourceIdx = tierOrder.indexOf(source.tier);
    if (sourceIdx >= requestIdx && source.distance > farthestDist) {
      farthestDist = source.distance;
      farthest = source;
    }
  }
  return farthest;
}
```

### 5.4 Tier Volume Levels

```javascript
const TIER_VOLUME = {
  CRITICAL:   1.0,    // Full volume
  FOREGROUND: 0.85,   // Slightly reduced
  ACTIVE:     0.5,    // -6dB: background chatter
  AMBIENT:    0.35,   // Texture, not intelligible
};
```

---

## 6. GainNode Fade Operations

### 6.1 Fade In (200ms)

```javascript
_activate(source) {
  const t = this.ctx.currentTime;
  source.gainNode.gain.setValueAtTime(0, t);
  source.gainNode.gain.linearRampToValueAtTime(
    TIER_VOLUME[source.tier], t + 0.2
  );
  source.fadeState = 'FADING_IN';
  source.fadeEndTime = t + 0.2;

  if (source.sourceNode instanceof AudioBufferSourceNode) {
    source.sourceNode.start();
  }

  source.active = true;
  this.activeCount++;
  this.budgets.get(source.tier).current++;
}
```

### 6.2 Fade Out (200ms) and Disposal

```javascript
_deactivate(source, fadeOut = true) {
  if (!source.active) return;

  if (fadeOut) {
    const t = this.ctx.currentTime;
    source.gainNode.gain.setValueAtTime(source.gainNode.gain.value, t);
    source.gainNode.gain.linearRampToValueAtTime(0, t + 0.2);
    source.fadeState = 'FADING_OUT';
    source.fadeEndTime = t + 0.2;
    setTimeout(() => this._dispose(source), 250);
  } else {
    this._dispose(source);
  }
}

_dispose(source) {
  try {
    if (source.sourceNode instanceof AudioBufferSourceNode) {
      source.sourceNode.stop();
    }
  } catch {}
  source.sourceNode.disconnect();
  source.gainNode.disconnect();
  source.pannerNode.disconnect();
  if (source.lowPassFilter) source.lowPassFilter.disconnect();
  source.active = false;
  this.activeCount--;
  this.budgets.get(source.tier).current--;
  this.sources.delete(source.id);
}
```

### 6.3 Existing Crossfade in SpatialVoice

The current `voice.js` already implements crossfade for TTS playback:

```javascript
// Existing: fade out over 300ms, fade in over 200ms
// Route: BufferSource -> GainNode -> PannerNode -> destination
const gainNode = this.audioContext.createGain();
gainNode.gain.value = 0;
gainNode.connect(this.pannerNode);

const source = this.audioContext.createBufferSource();
source.buffer = audioBuffer;
source.connect(gainNode);

const now = this.audioContext.currentTime;
gainNode.gain.setValueAtTime(0, now);
gainNode.gain.linearRampToValueAtTime(1, now + 0.2);
```

---

## 7. ConvolverNode Reverb System

### 7.1 Impulse Response Files

```
assets/audio/ir/
  ir_piazza.wav       ~120KB   RT60=2.5s   Open square reverb
  ir_calle.wav        ~40KB    RT60=0.8s   Narrow street, short
  ir_canal.wav        ~80KB    RT60=1.5s   Water reflections
  ir_church.wav       ~160KB   RT60=4.0s   Indoor cathedral
  ir_bridge.wav       ~60KB    RT60=1.2s   Stone arch reverb
```

Total IR budget: ~460KB. All mono, 44.1kHz, 16-bit WAV, 2-4 seconds.

### 7.2 ConvolverNode Setup

```javascript
class ReverbSystem {
  constructor(ctx, masterGain) {
    this.ctx = ctx;
    this.convolvers = new Map();  // zoneType -> ConvolverNode
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.dryGain.connect(masterGain);
    this.activeConvolver = null;
    this.crossfadeProgress = 1.0;
  }

  async loadImpulseResponse(zoneType, filename) {
    const response = await fetch(`/assets/audio/ir/${filename}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

    const convolver = this.ctx.createConvolver();
    convolver.buffer = audioBuffer;
    convolver.normalize = true;
    this.convolvers.set(zoneType, convolver);
  }

  async initAll() {
    await this.loadImpulseResponse('PIAZZA', 'ir_piazza.wav');
    await this.loadImpulseResponse('CALLE',  'ir_calle.wav');
    await this.loadImpulseResponse('CANAL',  'ir_canal.wav');
    await this.loadImpulseResponse('INDOOR', 'ir_church.wav');
    await this.loadImpulseResponse('BRIDGE', 'ir_bridge.wav');
  }
}
```

### 7.3 Wet/Dry Ratio by Zone Type and Tier

```javascript
const ZONE_WET_DRY = {
  PIAZZA: { voice: 0.2, chatter: 0.5, event: 0.7 },
  CALLE:  { voice: 0.15, chatter: 0.4, event: 0.6 },
  CANAL:  { voice: 0.2, chatter: 0.5, event: 0.65 },
  INDOOR: { voice: 0.25, chatter: 0.6, event: 0.8 },
  BRIDGE: { voice: 0.2, chatter: 0.45, event: 0.6 },
};

function getWetDry(zoneType, tier) {
  const config = ZONE_WET_DRY[zoneType] || ZONE_WET_DRY.PIAZZA;
  switch (tier) {
    case 'CRITICAL':
    case 'FOREGROUND':
      return { wet: config.voice, dry: 1.0 - config.voice };
    case 'ACTIVE':
      return { wet: config.chatter, dry: 1.0 - config.chatter };
    case 'AMBIENT':
      return { wet: config.event, dry: 1.0 - config.event };
  }
}
```

### 7.4 Reverb Crossfade on Zone Change

Equal-power crossfade over 2 seconds between convolver nodes:

```javascript
updateReverb(zoneType, deltaTime) {
  const target = this.convolvers.get(zoneType);
  if (!target || target === this.activeConvolver) return;

  if (this.crossfadeProgress >= 1.0) {
    this.targetConvolver = target;
    this.crossfadeProgress = 0.0;
    target.connect(this.ctx.destination);
  }

  this.crossfadeProgress += deltaTime / 2.0;
  this.crossfadeProgress = Math.min(this.crossfadeProgress, 1.0);

  const t = this.crossfadeProgress;
  const fadeOut = Math.cos(t * Math.PI / 2);
  const fadeIn  = Math.sin(t * Math.PI / 2);
  // Apply via output gain nodes on each convolver

  if (this.crossfadeProgress >= 1.0) {
    if (this.activeConvolver) this.activeConvolver.disconnect();
    this.activeConvolver = this.targetConvolver;
    this.targetConvolver = null;
  }
}
```

---

## 8. Zone-Ambient Audio Integration

### 8.1 Current ZoneAmbient (Visual Only)

The existing `zone-ambient.js` handles fog color, fog density, particle color,
and hemisphere light color transitions. It has no audio component.

```javascript
// Current: visual-only zone transitions
export class ZoneAmbient {
  constructor(scene, hemiLight, particleMat) {
    this.scene = scene;
    this.hemiLight = hemiLight;
    this.particleMat = particleMat;
    this.currentZone = null;
  }

  update(playerPos, elapsed) {
    const { zone, distance } = detectNearestZone(playerPos);
    // ... lerp fog, light, particle colors
  }
}
```

### 8.2 District Ambient Audio Extension

```javascript
// Extended ZoneAmbient with audio layers
// Each district has 2-3 looping ambient audio layers

const DISTRICT_AUDIO = {
  rialto: [
    { file: 'market-crowd.ogg',  volume: 0.7, positional: null },
    { file: 'water-lapping.ogg', volume: 0.4, positional: { x: -10, z: 5 } },
    { file: 'merchant-calls.ogg', volume: 0.25, positional: { x: 3, z: -2 } },
  ],
  san_marco: [
    { file: 'piazza-echo.ogg',   volume: 0.5, positional: null },
    { file: 'pigeons.ogg',        volume: 0.3, positional: null },
    { file: 'distant-bells.ogg',  volume: 0.2, positional: { x: 20, z: -15 } },
  ],
  // ... per district
};
```

### 8.3 Ambient Layer Implementation

```javascript
class AmbientLayer {
  constructor(ctx, layerDef, masterGain) {
    this.audio = new Audio(`/assets/audio/ambient/${layerDef.file}`);
    this.audio.loop = true;
    this.audio.preload = 'auto';
    this.targetVolume = layerDef.volume;

    this.source = ctx.createMediaElementSource(this.audio);
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;  // Start silent

    if (layerDef.positional) {
      this.panner = ctx.createPanner();
      this.panner.panningModel = 'HRTF';
      this.panner.distanceModel = 'inverse';
      this.panner.refDistance = 5;
      this.panner.maxDistance = 80;
      this.panner.rolloffFactor = 0.5;
      this.source.connect(this.gain);
      this.gain.connect(this.panner);
      this.panner.connect(masterGain);
      this.positionalBias = layerDef.positional;
    } else {
      this.source.connect(this.gain);
      this.gain.connect(masterGain);
      this.panner = null;
      this.positionalBias = null;
    }
  }

  play()  { this.audio.play().catch(() => {}); }
  pause() { this.audio.pause(); this.audio.currentTime = 0; }

  updatePosition(zoneCenter) {
    if (!this.panner || !this.positionalBias) return;
    this.panner.positionX.value = zoneCenter.x + this.positionalBias.x;
    this.panner.positionZ.value = zoneCenter.z + (this.positionalBias.z || 0);
    this.panner.positionY.value = 1.0;
  }
}
```

### 8.4 Equal-Power Crossfade Between Districts

```javascript
// Called per frame during zone transition
updateAmbientCrossfade(engine, deltaTime) {
  if (engine.crossfadeProgress >= 1.0) return;

  engine.crossfadeProgress += deltaTime / engine.crossfadeDuration;
  engine.crossfadeProgress = Math.min(engine.crossfadeProgress, 1.0);

  const t = engine.crossfadeProgress;
  // Equal-power: prevents volume dip at midpoint
  const fadeOut = Math.cos(t * Math.PI / 2);
  const fadeIn  = Math.sin(t * Math.PI / 2);

  for (const layer of engine.currentLayers) {
    layer.gain.gain.value = layer.targetVolume * fadeOut;
  }
  for (const layer of engine.targetLayers) {
    layer.gain.gain.value = layer.targetVolume * fadeIn;
  }

  if (engine.crossfadeProgress >= 1.0) {
    for (const layer of engine.currentLayers) layer.pause();
    engine.currentLayers = engine.targetLayers;
    engine.targetLayers = null;
  }
}
```

---

## 9. Zone-Based Occlusion

### 9.1 Occlusion Graph from Zone Waypoints

```javascript
// Zones are defined in src/shared/zones.js with positions and waypoints.
// Waypoints define connectivity: which zones can hear each other.

class ZoneOcclusionGraph {
  constructor(zones) {
    this.zones = new Map();
    this.edges = new Map();

    for (const zone of zones) {
      this.zones.set(zone.id, {
        id: zone.id,
        bounds: this._computeBounds(zone),
        zoneType: zone.type || 'PIAZZA',
      });
      this.edges.set(zone.id, new Set());
    }

    // Build adjacency from zone waypoints
    for (const zone of zones) {
      if (zone.waypoints) {
        for (const wpId of zone.waypoints) {
          this.edges.get(zone.id)?.add(wpId);
          this.edges.get(wpId)?.add(zone.id);
        }
      }
    }
  }
}
```

### 9.2 Occlusion Check (Same Zone, Adjacent, 2-Hop, Culled)

```javascript
checkOcclusion(listenerZoneId, sourceZoneId) {
  // Same zone: no occlusion
  if (listenerZoneId === sourceZoneId) {
    return { attenuation: 0, lowPassFreq: 20000 };
  }

  // Adjacent: partial occlusion
  const listenerEdges = this.edges.get(listenerZoneId);
  if (listenerEdges?.has(sourceZoneId)) {
    return { attenuation: -6, lowPassFreq: 2000 };
  }

  // 2-hop: heavily occluded
  if (listenerEdges) {
    for (const neighborId of listenerEdges) {
      if (this.edges.get(neighborId)?.has(sourceZoneId)) {
        return { attenuation: -18, lowPassFreq: 800 };
      }
    }
  }

  // 3+ zones away: fully culled
  return { attenuation: -Infinity, lowPassFreq: 0 };
}
```

### 9.3 BiquadFilterNode for Muffled Sound

```javascript
applyOcclusion(source, occlusion) {
  if (occlusion.attenuation === -Infinity) {
    this._deactivate(source, true);
    return;
  }

  const targetGain = TIER_VOLUME[source.tier] * Math.pow(10, occlusion.attenuation / 20);
  const t = this.ctx.currentTime;
  source.gainNode.gain.setTargetAtTime(targetGain, t, 0.1);

  // Insert low-pass filter for muffling effect
  if (!source.lowPassFilter && occlusion.lowPassFreq < 20000) {
    source.lowPassFilter = this.ctx.createBiquadFilter();
    source.lowPassFilter.type = 'lowpass';
    // Re-route: gainNode -> lowPass -> pannerNode
    source.gainNode.disconnect();
    source.gainNode.connect(source.lowPassFilter);
    source.lowPassFilter.connect(source.pannerNode);
  }

  if (source.lowPassFilter) {
    source.lowPassFilter.frequency.setTargetAtTime(occlusion.lowPassFreq, t, 0.1);
  }
}
```

---

## 10. Raw Voice Spatial Playback (Existing)

### 10.1 playRawAtPosition (Citizen Voice Broadcast)

The existing `voice.js` has a method for playing raw webm/opus audio
spatially, used when hearing other visitors speak:

```javascript
// src/client/voice.js — playRawAtPosition()
async playRawAtPosition(base64Audio, position) {
  this._ensurePlayback();

  const binary = atob(base64Audio);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/webm;codecs=opus' });
  const url = URL.createObjectURL(blob);

  // Spatial via MediaElementSource + PannerNode
  const audio = new Audio(url);
  audio.crossOrigin = 'anonymous';
  const source = this.audioContext.createMediaElementSource(audio);

  const panner = this.audioContext.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = 1;
  panner.maxDistance = 50;
  panner.rolloffFactor = 1;
  panner.positionX.value = position.x;
  panner.positionY.value = position.y;
  panner.positionZ.value = position.z;
  panner.connect(this.audioContext.destination);

  source.connect(panner);
  audio.onended = () => { panner.disconnect(); URL.revokeObjectURL(url); };
  await audio.play();
}
```

This creates a new PannerNode per playback (not pooled). Acceptable for
the current visitor count (2-3) but needs pooling for 200+ citizens.

---

## 11. WebRTC Peer Voice Integration

### 11.1 Existing VoiceChat Per-Peer Audio Graph

```
MediaStreamSource(remoteStream)
  -> PannerNode (HRTF, inverse, rolloff 1.5)
    -> AudioContext.destination
```

Each peer has its own PannerNode, updated per frame in `updatePositions()`.

### 11.2 Per-Frame Peer Position Update

From `main.js` animation loop:

```javascript
if (voiceChat.enabled) {
  const listenerPos = renderer.xr.isPresenting
    ? { x: nicolasAvatar.position.x, y: head?.position.y || 1.7, z: nicolasAvatar.position.z }
    : { x: camera.position.x, y: camera.position.y, z: camera.position.z };

  camera.getWorldDirection(_voiceFwd);
  const fwd = { x: _voiceFwd.x, y: _voiceFwd.y, z: _voiceFwd.z };

  _voiceCitizenPositions.clear();
  for (const [cid, avatar] of remoteCitizens) {
    const head = avatar.children[0];
    _voiceCitizenPositions.set(cid, {
      x: avatar.position.x,
      y: head?.position.y || 1.7,
      z: avatar.position.z,
    });
  }

  voiceChat.updatePositions(listenerPos, fwd, _voiceCitizenPositions);
}
```

Note the pre-allocated `_voiceFwd` (THREE.Vector3) and `_voiceCitizenPositions`
(Map) at module level to avoid per-frame allocations.

---

## 12. Per-Frame Audio Update Integration

The animation loop in `main.js` currently calls:

```javascript
spatialVoice.updateListener(camera);
voiceChat.updatePositions(listenerPos, fwd, citizenPositions);
```

For Venezia, the unified per-frame update becomes:

```javascript
// In renderer.setAnimationLoop():
audioManager.updateListener(camera);
audioManager.updateAmbient(playerPos, delta);
audioManager.updateReverb(currentZoneType, delta);
audioManager.updateSourceDistances(playerPos);
audioManager.applyOcclusionAll(listenerZoneId);

// Budget rebalance every ~500ms (36 frames at 72fps)
if (frameCount % 36 === 0) {
  audioManager.rebalanceBudget();
}
```

Total audio CPU budget: 2ms per frame (part of the 4ms JS logic budget).
