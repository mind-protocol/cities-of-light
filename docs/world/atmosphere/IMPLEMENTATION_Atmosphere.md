# IMPLEMENTATION: world/atmosphere -- Code Architecture

Exact file paths, exported APIs, Three.js lighting/fog/particle specifics, shader uniforms, and configuration. Maps ALGORITHM pseudocode to concrete JavaScript modules. A developer should be able to start coding from this document alone.

---

## File Map

```
src/
  client/
    atmosphere/
      day-night.js              NEW   World clock, sun position, directional light, shadows
      weather.js                NEW   Fog system (3 layers), weather state machine
      district-mood.js          NEW   Mood aggregation, mood-to-atmosphere mapping
      ground-fog.js             NEW   Ground fog particle system (billboards)
      ambient-particles.js      NEW   Per-district particle system (instanced)
      stars.js                  NEW   Star layer fade control
      window-glow.js            NEW   Building window emissive ramp
      biometric-layer.js        NEW   Garmin stress modulation (opt-in)
      atmosphere-controller.js  NEW   Master coordinator: composes all subsystems
      vignette-shader.js        NEW   GLSL vignette for VR comfort + stress overlay
    venice/
      venice-config.js          MODIFY Add atmosphere constants
    zone-ambient.js             MODIFY Delegate to atmosphere-controller in Venice mode
    scene.js                    MODIFY Expose sky/sunLight/starLayer references
    main.js                     MODIFY Wire atmosphere-controller into render loop
  server/
    venice-state.js             MODIFY Expose district mood + tension data to clients
```

---

## Data Structures

### World Clock State

```js
/**
 * @typedef {Object} WorldClockState
 * @property {number} cycleStartMs    - real timestamp of cycle epoch
 * @property {number} currentHour     - 0.0 to 23.999
 * @property {TimePhase} timePhase
 * @property {number} deltaIngameHours - change since last frame
 */

/** @enum {string} */
const TimePhase = {
  NIGHT: 'NIGHT',       // 0.0 - 5.0, 21.5 - 24.0
  DAWN: 'DAWN',         // 5.0 - 7.0
  MORNING: 'MORNING',   // 7.0 - 12.0
  AFTERNOON: 'AFTERNOON', // 12.0 - 17.0
  EVENING: 'EVENING',   // 17.0 - 20.0
  DUSK: 'DUSK',         // 20.0 - 21.5
};
```

### Sun State

```js
/**
 * @typedef {Object} SunState
 * @property {number} elevation      - degrees above horizon (negative = below)
 * @property {number} azimuth        - radians
 * @property {THREE.Vector3} direction - unit vector pointing from sun toward world
 * @property {THREE.Color} color
 * @property {number} intensity
 */
```

### Fog State

```js
/**
 * @typedef {Object} FogState
 * @property {number} groundDensity       - 0.0 to 1.0
 * @property {THREE.Color} groundColor
 * @property {number} atmosphericDensity  - FogExp2 density parameter
 * @property {THREE.Color} atmosphericColor
 * @property {number} hazeOpacity         - 0.0 to 1.0
 * @property {number} hazeSoftness        - shadow radius multiplier
 */
```

### Atmosphere Parameters (composite output)

```js
/**
 * @typedef {Object} AtmosphereParams
 * @property {SunState} sun
 * @property {FogState} fog
 * @property {{ skyColor: THREE.Color, groundColor: THREE.Color, intensity: number }} hemisphere
 * @property {number} starOpacity
 * @property {number} windowGlowIntensity
 * @property {{ fogMult: number, saturation: number, particleSpeed: number, particleCount: number, lightWarmth: number, lanternFlicker: number }} moodModifiers
 */
```

---

## Module: atmosphere/day-night.js

Maps ALGORITHM sections A1, A2, A3, A4, A5, A6.

### Constants

```js
export const CYCLE_DURATION_MS   = 96 * 60 * 1000;     // 5,760,000 ms
export const HOURS_PER_CYCLE     = 24;
export const MS_PER_INGAME_HOUR  = CYCLE_DURATION_MS / HOURS_PER_CYCLE; // 240,000
export const MS_PER_INGAME_MINUTE = MS_PER_INGAME_HOUR / 60;           // 4,000
export const CATCHUP_RATE        = 10.0;
export const CATCHUP_MAX_DURATION = 5000;

export const SUNRISE_HOUR  = 5.5;
export const SUNSET_HOUR   = 20.0;
export const NOON_HOUR     = 12.5;
export const MAX_ELEVATION = 68.0;

export const SHADOW_MAP_SIZE    = 2048;
export const SHADOW_CAMERA_SIZE = 80;
export const SHADOW_BIAS        = -0.0005;
export const SHADOW_NORMAL_BIAS = 0.02;

export const STAR_FADE_START_ELEV = 5.0;
export const STAR_FADE_END_ELEV   = -8.0;
export const STAR_MAX_OPACITY     = 0.85;

export const GLOW_START_HOUR  = 18.5;
export const GLOW_FULL_HOUR   = 20.5;
export const GLOW_END_HOUR    = 6.5;
export const GLOW_OFF_HOUR    = 7.5;
export const GLOW_COLOR       = new THREE.Color(1.0, 0.75, 0.4);
export const GLOW_MAX_EMISSIVE = 0.6;
```

### Exports

```js
import * as THREE from 'three';

export class DayNightCycle {
  /**
   * @param {number} [initialHour=8.0] - in-game hour to start at
   */
  constructor(initialHour) {
    this.cycleStartMs = Date.now() - initialHour * MS_PER_INGAME_HOUR;
    this.currentHour = initialHour;
    this.timePhase = this.classifyPhase(initialHour);
    this.deltaIngameHours = 0;
  }

  /**
   * Advance the clock. Call once per frame.
   * @param {number} realTimeMs - performance.now() or Date.now()
   * @returns {WorldClockState}
   */
  update(realTimeMs) { /* A1: update_world_clock */ }

  /**
   * Fast-forward on reconnect. Maps A1 catchup_clock.
   * @param {number} lastSessionEndMs
   * @param {number} realTimeMs
   */
  catchup(lastSessionEndMs, realTimeMs) { /* ... */ }

  /**
   * @param {number} hour
   * @returns {TimePhase}
   */
  classifyPhase(hour) { /* A1 */ }

  /**
   * @param {number} hour
   * @returns {SunState}
   */
  computeSunPosition(hour) { /* A2 */ }

  /**
   * @param {SunState} sun
   * @returns {{ color: THREE.Color, intensity: number }}
   */
  computeSunColor(sun) { /* A2 */ }

  /**
   * @param {number} hour
   * @param {TimePhase} phase
   * @returns {{ skyColor: THREE.Color, groundColor: THREE.Color, intensity: number }}
   */
  computeHemisphere(hour, phase) { /* A3 */ }

  /**
   * @param {SunState} sun
   * @returns {number} - star layer opacity 0.0 to STAR_MAX_OPACITY
   */
  computeStarOpacity(sun) { /* A5 */ }

  /**
   * @param {number} hour
   * @returns {number} - window glow emissive intensity 0.0 to GLOW_MAX_EMISSIVE
   */
  computeWindowGlow(hour) { /* A6 */ }
}
```

### Three.js Light Objects (created externally, controlled by DayNightCycle)

The atmosphere controller creates and owns these objects. `DayNightCycle` computes values; the controller applies them.

**DirectionalLight** (sun):

```js
const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 200;
sunLight.shadow.camera.left = -SHADOW_CAMERA_SIZE / 2;
sunLight.shadow.camera.right = SHADOW_CAMERA_SIZE / 2;
sunLight.shadow.camera.top = SHADOW_CAMERA_SIZE / 2;
sunLight.shadow.camera.bottom = -SHADOW_CAMERA_SIZE / 2;
sunLight.shadow.bias = SHADOW_BIAS;
sunLight.shadow.normalBias = SHADOW_NORMAL_BIAS;
```

Shadow follows visitor (updated each frame):

```js
// In atmosphere-controller update:
sunLight.position.copy(visitorPosition).addScaledVector(sunState.direction, -100);
sunLight.target.position.copy(visitorPosition);
sunLight.target.updateMatrixWorld();
```

Shadow softness modulated by sun elevation:

```js
const elevNorm = sunState.elevation / MAX_ELEVATION;
sunLight.shadow.radius = THREE.MathUtils.lerp(4.0, 1.0, elevNorm);
```

At night (`elevation <= 0`): `sunLight.castShadow = false`. Lantern point lights become the only shadow casters (if shadow budget allows).

**HemisphereLight**:

```js
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.5);
// Updated each frame:
hemiLight.color.copy(hemisphereState.skyColor);
hemiLight.groundColor.copy(hemisphereState.groundColor);
hemiLight.intensity = hemisphereState.intensity;
```

**Sky** (Preetham model, existing in scene.js):

```js
// Update sun position in sky shader:
sky.material.uniforms['sunPosition'].value.copy(
  new THREE.Vector3().setFromSphericalCoords(
    1,
    THREE.MathUtils.degToRad(90 - sunState.elevation),
    sunState.azimuth
  )
);
```

---

## Module: atmosphere/weather.js

Maps ALGORITHM sections A7, A8.

### Exports

```js
/** @enum {string} */
export const WeatherState = {
  CLEAR: 'CLEAR',
  LIGHT_FOG: 'LIGHT_FOG',
  HEAVY_FOG: 'HEAVY_FOG',
  OVERCAST_HAZE: 'OVERCAST_HAZE',
};

export class WeatherSystem {
  /**
   * @param {number} seed - for deterministic weather progression
   */
  constructor(seed) {
    this.currentWeather = WeatherState.LIGHT_FOG;
    this.activeTransition = null;
    this.holdRemaining = 2.0;
    this._rng = seededRandom(seed);
  }

  /**
   * Advance weather state machine. Call each frame.
   * @param {number} deltaIngameHours
   */
  update(deltaIngameHours) { /* A8 */ }

  /**
   * Get current fog multipliers (interpolated during transitions).
   * @returns {{ groundMult: number, atmoMult: number, hazeMult: number }}
   */
  getFogModifier() { /* A8 */ }

  /**
   * @returns {WeatherState}
   */
  getCurrentWeather() { return this.currentWeather; }
}
```

### Fog Computation (A7)

Time-driven base fog, district tint, tension modifier, and weather modifier are combined in `atmosphere-controller.js`:

```js
// Pseudocode for final fog computation:
const baseFog = computeBaseFog(hour, timePhase);           // A7.2
const tensionFog = applyTensionFog(baseFog, districtTension); // A7.4
const weatherMod = weatherSystem.getFogModifier();         // A8
const moodMod = moodModifiers.fogMult;                     // A9

const finalFog = {
  groundDensity: tensionFog.ground * weatherMod.groundMult * moodMod,
  atmosphericDensity: tensionFog.atmo * weatherMod.atmoMult * moodMod,
  hazeOpacity: tensionFog.haze * weatherMod.hazeMult,
};

const fogColor = computeFogColor(hour, timePhase, districtId); // A7.3
```

**Scene fog** is `THREE.FogExp2`:

```js
// Created once:
scene.fog = new THREE.FogExp2(0x8faac0, 0.008);

// Updated each frame via exponential lerp:
const LERP_SPEED = 2.0;
const t = 1 - Math.exp(-LERP_SPEED * deltaTime);
scene.fog.density += (finalFog.atmosphericDensity - scene.fog.density) * t;
scene.fog.color.lerp(fogColor, t);
```

---

## Module: atmosphere/ground-fog.js

Maps ALGORITHM section A7.5. Billboard particle system rendered below waist height.

### Exports

```js
export class GroundFogSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {number} maxParticles - default 200
   */
  constructor(scene, maxParticles) { /* ... */ }

  /**
   * @param {THREE.Vector3} visitorPos
   * @param {number} groundDensity   - 0.0 to 1.0
   * @param {THREE.Color} fogColor
   * @param {number} deltaTime
   */
  update(visitorPos, groundDensity, fogColor, deltaTime) { /* A7.5 */ }

  /** Remove all particles and dispose GPU resources. */
  dispose() { /* ... */ }
}
```

### Three.js Implementation

Ground fog uses `THREE.InstancedMesh` with a single `THREE.PlaneGeometry(1, 1)` billboard. Each instance has a per-instance transform (position + scale) and per-instance opacity via a custom `InstancedBufferAttribute`.

```js
const fogGeometry = new THREE.PlaneGeometry(1, 1);
const fogMaterial = new THREE.MeshBasicMaterial({
  color: 0xcccccc,
  transparent: true,
  opacity: 1.0,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.NormalBlending,
});

// Custom per-instance opacity attribute
fogMaterial.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `#include <common>
     attribute float instanceOpacity;
     varying float vOpacity;`
  );
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
     vOpacity = instanceOpacity;`
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    `#include <common>
     varying float vOpacity;`
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <output_fragment>',
    `#include <output_fragment>
     gl_FragColor.a *= vOpacity;`
  );
};

const instancedFog = new THREE.InstancedMesh(fogGeometry, fogMaterial, MAX_PARTICLES);

// Per-instance opacity buffer
const opacityArray = new Float32Array(MAX_PARTICLES);
const opacityAttr = new THREE.InstancedBufferAttribute(opacityArray, 1);
instancedFog.geometry.setAttribute('instanceOpacity', opacityAttr);
```

Each frame, particles are updated CPU-side. Instance matrices are set to face the camera (billboard) at each particle position. The `instanceOpacity` attribute is updated and `.needsUpdate = true` is set.

Billboard facing: each instance matrix is constructed to align the plane's normal with the camera direction:

```js
const _matrix = new THREE.Matrix4();
const _quat = new THREE.Quaternion();

function updateFogInstance(index, particle, cameraQuaternion) {
  _quat.copy(cameraQuaternion);
  _matrix.compose(particle.position, _quat, _scale.set(particle.size, particle.size, 1));
  instancedFog.setMatrixAt(index, _matrix);
  opacityArray[index] = particle.opacity;
}
```

### Constants

```js
const GROUND_FOG_MAX_PARTICLES = 200;
const GROUND_FOG_RADIUS        = 30.0;
const GROUND_FOG_Y_MIN         = -0.2;
const GROUND_FOG_Y_MAX         = 2.0;
const GROUND_FOG_DRIFT_SPEED   = 0.3;
const GROUND_FOG_PARTICLE_SIZE = 4.0;
```

---

## Module: atmosphere/ambient-particles.js

Maps ALGORITHM section A11. Per-district particles (dust, motes, smoke, pollen) using a single instanced buffer.

### Exports

```js
export class AmbientParticleSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {number} maxParticles - default 500
   */
  constructor(scene, maxParticles) { /* ... */ }

  /**
   * @param {THREE.Vector3} visitorPos
   * @param {string} districtId
   * @param {object} moodParams - from mood_to_atmosphere_params
   * @param {SunState} sunState
   * @param {number} deltaTime
   */
  update(visitorPos, districtId, moodParams, sunState, deltaTime) { /* A11.3 */ }

  /** Dispose GPU resources. */
  dispose() { /* ... */ }
}
```

### Three.js Implementation

Uses `THREE.Points` with a custom `THREE.BufferGeometry`. Per-particle attributes:

```js
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(MAX_PARTICLES * 3);
const colors    = new Float32Array(MAX_PARTICLES * 3);
const sizes     = new Float32Array(MAX_PARTICLES);
const opacities = new Float32Array(MAX_PARTICLES);

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
geometry.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));
geometry.setAttribute('opacity',  new THREE.BufferAttribute(opacities, 1));

const material = new THREE.ShaderMaterial({
  vertexShader: PARTICLE_VERTEX_SHADER,
  fragmentShader: PARTICLE_FRAGMENT_SHADER,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {},
  vertexColors: true,
});
```

**Vertex shader**:

```glsl
attribute float size;
attribute float opacity;
varying float vOpacity;
varying vec3 vColor;

void main() {
  vOpacity = opacity;
  vColor = color;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
```

**Fragment shader**:

```glsl
varying float vOpacity;
varying vec3 vColor;

void main() {
  float dist = length(gl_PointCoord - vec2(0.5));
  if (dist > 0.5) discard;
  float alpha = smoothstep(0.5, 0.2, dist) * vOpacity;
  gl_FragColor = vec4(vColor, alpha);
}
```

Each frame, CPU-side particle state is computed per A11.3. The `position`, `color`, `size`, and `opacity` buffer attributes are updated and `.needsUpdate = true` is set on each.

District particle configs are stored in `DISTRICT_PARTICLE_CONFIG` (A11.1). When the visitor changes district, new particles spawn with the new district's config. Existing particles from the old district continue until their `life` expires (natural crossfade, no abrupt switch).

---

## Module: atmosphere/stars.js

Maps ALGORITHM section A5. Controls opacity of the star `THREE.Points` layer already created in `scene.js`.

### Exports

```js
export class StarController {
  /**
   * @param {THREE.Points} starPoints - existing star layer from scene.js
   */
  constructor(starPoints) { /* ... */ }

  /**
   * Fade stars based on sun elevation. Call each frame.
   * @param {SunState} sunState
   */
  update(sunState) { /* A5 */ }
}
```

Implementation is a single line of opacity control:

```js
update(sunState) {
  if (sunState.elevation > STAR_FADE_START_ELEV) {
    this.starPoints.material.opacity = 0.0;
  } else if (sunState.elevation < STAR_FADE_END_ELEV) {
    this.starPoints.material.opacity = STAR_MAX_OPACITY;
  } else {
    const t = (STAR_FADE_START_ELEV - sunState.elevation)
            / (STAR_FADE_START_ELEV - STAR_FADE_END_ELEV);
    this.starPoints.material.opacity = THREE.MathUtils.lerp(0.0, STAR_MAX_OPACITY, t);
  }
}
```

---

## Module: atmosphere/window-glow.js

Maps ALGORITHM section A6.

### Exports

```js
export class WindowGlowController {
  constructor() {
    this._active = false;
  }

  /**
   * Apply window emissive to visible buildings. Call each frame.
   * @param {PlacedBuilding[]} buildings
   * @param {number} glowIntensity - from DayNightCycle.computeWindowGlow
   */
  update(buildings, glowIntensity) { /* A6 */ }
}
```

Per-building variation uses a deterministic hash:

```js
const perBuildingFactor = 0.5 + 0.5 * fract(Math.sin(building.seed * 43758.5453));
building.windowMaterial.emissive.copy(GLOW_COLOR);
building.windowMaterial.emissiveIntensity = glowIntensity * perBuildingFactor;
```

Only applies to buildings at LOD0 and LOD1 (`building.currentLod <= 1`). LOD2 billboards get a flat color tint instead.

---

## Module: atmosphere/district-mood.js

Maps ALGORITHM section A9.

### Exports

```js
/**
 * @typedef {Object} MoodModifiers
 * @property {number} fogMult
 * @property {number} saturation
 * @property {number} particleSpeed
 * @property {number} particleCount
 * @property {number} lightWarmth
 * @property {number} lanternFlicker
 */

export class DistrictMoodSystem {
  constructor() {
    /** @type {Map<string, { aggregate: number, target: number, lerpProgress: number }>} */
    this._moods = new Map();
  }

  /**
   * Called by sync handler when Airtable data arrives.
   * @param {string} districtId
   * @param {{ mood: number, tier: string }[]} citizens
   */
  setMoodTarget(districtId, citizens) { /* A9: compute_mood_aggregate */ }

  /**
   * Lerp toward target. Call each frame.
   * @param {number} deltaTime
   */
  update(deltaTime) { /* A9: update_district_moods */ }

  /**
   * Get atmosphere modifiers for current district.
   * @param {string} districtId
   * @returns {MoodModifiers}
   */
  getModifiers(districtId) { /* A9: mood_to_atmosphere_params */ }
}
```

### Constants

```js
const MOOD_LERP_DURATION = 60.0;    // real seconds
const TIER_WEIGHTS = { FULL: 3.0, ACTIVE: 1.0, AMBIENT: 0.5 };
```

---

## Module: atmosphere/biometric-layer.js

Maps ALGORITHM section A10. Optional Garmin stress integration.

### Exports

```js
/**
 * @typedef {Object} BiometricModifiers
 * @property {number} fogAdd       - additional fog density (0.0 - 0.20)
 * @property {number} colorShift   - desaturation (-0.10 - 0.0)
 * @property {number} particleSlow - speed reduction (0.0 - 0.15)
 * @property {number} vignette     - vignette intensity (0.0 - 0.12)
 */

export class BiometricLayer {
  /**
   * @param {boolean} enabled - user opt-in
   */
  constructor(enabled) {
    this.enabled = enabled;
    this.stressNormalized = 0.0;
    this.lastUpdateMs = 0;
  }

  /**
   * @param {number} rawStress - 0-100 from Garmin
   * @param {number} timestampMs
   * @param {number} currentTimeMs
   * @param {number} deltaTime
   */
  updateStress(rawStress, timestampMs, currentTimeMs, deltaTime) { /* A10 */ }

  /**
   * @returns {BiometricModifiers}
   */
  getModifiers() { /* A10: biometric_to_atmosphere */ }
}
```

### Constants

```js
const BIOMETRIC_WEIGHT     = 0.20;
const BIOMETRIC_STALE_MS   = 30 * 60 * 1000;
const BIOMETRIC_LERP_SPEED = 0.5;
```

Data arrives via WebSocket from server (which reads from `biometrics/latest.json`):

```js
// Server -> Client message
{ type: 'biometric_update', data: { stress: 45, timestamp: 1710000000000 } }
```

---

## Module: atmosphere/vignette-shader.js

GLSL shader for VR locomotion vignette and biometric stress vignette overlay.

### Exports

```js
/**
 * Create a screen-space vignette mesh for VR eye rendering.
 * @returns {{ mesh: THREE.Mesh, update: (opacity: number, innerR: number, outerR: number) => void }}
 */
export function createVignetteMesh() { /* ... */ }
```

### Shader

```glsl
// Fragment shader
uniform float uOpacity;
uniform float uInnerRadius;
uniform float uOuterRadius;
varying vec2 vUv;

void main() {
  float dist = length(vUv - vec2(0.5)) * 2.0;
  float fade = smoothstep(uInnerRadius, uOuterRadius, dist);
  gl_FragColor = vec4(0.0, 0.0, 0.0, uOpacity * fade);
}
```

Mesh is a `THREE.PlaneGeometry(2, 2)` rendered with `depthTest: false`, `depthWrite: false`, placed at the camera's near clip plane. In VR, one per eye, parented to the XR camera rig.

```js
const vignetteMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uOpacity: { value: 0.0 },
    uInnerRadius: { value: 0.40 },
    uOuterRadius: { value: 0.90 },
  },
  vertexShader: VIGNETTE_VERTEX,
  fragmentShader: VIGNETTE_FRAGMENT,
  transparent: true,
  depthTest: false,
  depthWrite: false,
});
```

---

## Module: atmosphere/atmosphere-controller.js

Master coordinator. Composes all subsystems and applies their outputs to Three.js scene objects each frame.

### Imports

```js
import * as THREE from 'three';
import { DayNightCycle } from './day-night.js';
import { WeatherSystem } from './weather.js';
import { DistrictMoodSystem } from './district-mood.js';
import { GroundFogSystem } from './ground-fog.js';
import { AmbientParticleSystem } from './ambient-particles.js';
import { StarController } from './stars.js';
import { WindowGlowController } from './window-glow.js';
import { BiometricLayer } from './biometric-layer.js';
```

### Exports

```js
export class AtmosphereController {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.WebGLRenderer} renderer
   * @param {object} sceneRefs - { sky, sunLight, hemiLight, starPoints, cloudLayer }
   * @param {object} options   - { initialHour, weatherSeed, biometricEnabled }
   */
  constructor(scene, renderer, sceneRefs, options) {
    this.scene = scene;
    this.dayNight = new DayNightCycle(options.initialHour || 8.0);
    this.weather = new WeatherSystem(options.weatherSeed || 42);
    this.mood = new DistrictMoodSystem();
    this.groundFog = new GroundFogSystem(scene);
    this.ambientParticles = new AmbientParticleSystem(scene);
    this.stars = new StarController(sceneRefs.starPoints);
    this.windowGlow = new WindowGlowController();
    this.biometric = new BiometricLayer(options.biometricEnabled || false);

    this._sunLight = sceneRefs.sunLight;
    this._hemiLight = sceneRefs.hemiLight;
    this._sky = sceneRefs.sky;
    this._cloudLayer = sceneRefs.cloudLayer;

    // District transition state (A12)
    this._activeTransition = null;
    this._currentDistrict = null;
    this._previousAtmosphere = null;
    this._currentAtmosphere = null;

    // Event overrides (A13)
    this._eventOverrides = [];
  }

  /**
   * Main per-frame update. Call from render loop.
   * @param {number} deltaTime      - seconds since last frame
   * @param {number} realTimeMs     - performance.now()
   * @param {THREE.Vector3} visitorPosition
   * @param {string} currentDistrictId
   * @param {PlacedBuilding[]} buildings
   */
  update(deltaTime, realTimeMs, visitorPosition, currentDistrictId, buildings) {
    // 1. Clock
    const clock = this.dayNight.update(realTimeMs);

    // 2. Sun
    const sun = this.dayNight.computeSunPosition(clock.currentHour);
    const sunColor = this.dayNight.computeSunColor(sun);
    sun.color = sunColor.color;
    sun.intensity = sunColor.intensity;
    this._applySun(sun, visitorPosition);

    // 3. Hemisphere
    const hemi = this.dayNight.computeHemisphere(clock.currentHour, clock.timePhase);
    this._applyHemisphere(hemi);

    // 4. Weather state machine
    this.weather.update(clock.deltaIngameHours);
    const weatherMod = this.weather.getFogModifier();

    // 5. Mood
    this.mood.update(deltaTime);
    const moodMod = this.mood.getModifiers(currentDistrictId);

    // 6. Biometric
    const bioMod = this.biometric.getModifiers();

    // 7. Fog (composed)
    this._updateFog(clock, currentDistrictId, weatherMod, moodMod, bioMod, deltaTime);

    // 8. Ground fog particles
    this.groundFog.update(visitorPosition, this._fogState.groundDensity,
                          this._fogState.groundColor, deltaTime);

    // 9. Ambient particles
    this.ambientParticles.update(visitorPosition, currentDistrictId, moodMod, sun, deltaTime);

    // 10. Stars
    this.stars.update(sun);

    // 11. Window glow
    const glowIntensity = this.dayNight.computeWindowGlow(clock.currentHour);
    this.windowGlow.update(buildings, glowIntensity);

    // 12. Sky shader uniforms
    this._updateSky(sun);

    // 13. Cloud/haze layer
    this._updateHaze(this._fogState.hazeOpacity, sun, deltaTime);

    // 14. District transition fog gate (A12)
    this._updateDistrictTransition(deltaTime);

    // 15. Event overrides (A13)
    this._updateEventOverrides(clock.deltaIngameHours, currentDistrictId);
  }

  /**
   * Called when visitor crosses a district boundary. Maps A12.
   * @param {string} fromDistrictId
   * @param {string} toDistrictId
   */
  onDistrictChanged(fromDistrictId, toDistrictId) { /* A12 */ }

  /**
   * Called when a Blood Ledger event fires. Maps A13.
   * @param {{ id: string, location: { district: string }, salience: number }} event
   */
  onWorldEvent(event) { /* A13 */ }

  /**
   * Feed biometric data from server.
   * @param {number} rawStress
   * @param {number} timestampMs
   */
  onBiometricUpdate(rawStress, timestampMs) {
    this.biometric.updateStress(rawStress, timestampMs, Date.now(), 0);
  }

  /** Dispose all GPU resources. */
  dispose() {
    this.groundFog.dispose();
    this.ambientParticles.dispose();
  }

  // --- Private methods ---

  _applySun(sun, visitorPos) { /* set sunLight position, color, intensity, shadow params */ }
  _applyHemisphere(hemi) { /* set hemiLight colors and intensity */ }
  _updateFog(clock, district, weather, mood, bio, dt) { /* compose A7.2-A7.4 + weather + mood + bio */ }
  _updateSky(sun) { /* update sky.material.uniforms.sunPosition */ }
  _updateHaze(targetOpacity, sun, dt) { /* lerp cloudLayer opacity, modulate shadow radius */ }
  _updateDistrictTransition(dt) { /* A12 fog gate bell curve */ }
  _updateEventOverrides(deltaHours, district) { /* A13 onset/peak/decay */ }
}
```

---

## Integration: main.js Modifications

### New Imports

```js
import { AtmosphereController } from './atmosphere/atmosphere-controller.js';
```

### Scene Setup

```js
// After createEnvironment and star layer creation:
const atmosphere = new AtmosphereController(scene, renderer, {
  sky: env.sky,
  sunLight: env.sunLight,
  hemiLight: hemi,
  starPoints: /* reference to star THREE.Points from scene setup */,
  cloudLayer: /* reference to cloud plane from scene setup */,
}, {
  initialHour: 8.0,
  weatherSeed: 42,
  biometricEnabled: false,
});
```

### Render Loop Addition

```js
// Inside renderer.setAnimationLoop:
const playerPos = renderer.xr.isPresenting ? nicolasAvatar.position : camera.position;
const districtId = veniceState
  ? findContainingDistrict(playerPos)?.id || 'rialto'
  : 'island';
atmosphere.update(delta, performance.now(), playerPos, districtId, veniceState?.buildings || []);
```

### Zone Ambient Coordination

The existing `ZoneAmbient` class in `zone-ambient.js` handles island-mode fog/light transitions. When Venice mode is active, `atmosphere-controller.js` takes over. The flag is:

```js
// In render loop:
if (veniceState) {
  atmosphere.update(...);
  // ZoneAmbient.update is NOT called
} else {
  zoneAmbient.update(playerPos, elapsed);
}
```

---

## Integration: scene.js Modifications

Expose references needed by `AtmosphereController`:

```js
export function createEnvironment(scene, renderer) {
  // ... existing code ...
  return { group, water, sky, sunLight, starLayer, cloudLayer };
  //                                    ^^^^^^^^^  ^^^^^^^^^^  NEW
}
```

The `starLayer` is the `THREE.Points` mesh currently created inline in `createEnvironment`. The `cloudLayer` is the `THREE.Mesh` from `buildClouds()`. Both are already in the returned group; they just need to be exposed as named references.

---

## District Transition (A12 Detail)

When `atmosphere.onDistrictChanged(from, to)` fires:

1. Store current atmosphere parameters as `_previousAtmosphere`
2. Compute target atmosphere for `to` district
3. Start a 2-second crossfade (`TRANSITION_DURATION = 2.0`)
4. Overlay a fog gate: temporary `FogExp2` density spike following a bell curve over 3 seconds

```js
_updateDistrictTransition(deltaTime) {
  if (!this._activeTransition) return;

  this._activeTransition.progress += deltaTime / TRANSITION_DURATION;
  const t = smoothstep(this._activeTransition.progress);

  // Blend all parameters
  // ... lerp previous -> current using t ...

  // Fog gate: sin bell curve
  if (this._activeTransition.fogGateActive) {
    const gateProgress = this._activeTransition.progress * (TRANSITION_DURATION / FOG_GATE_DURATION);
    if (gateProgress < 1.0) {
      const gateIntensity = Math.sin(gateProgress * Math.PI);
      this.scene.fog.density += FOG_GATE_DENSITY * gateIntensity;
    } else {
      this._activeTransition.fogGateActive = false;
    }
  }

  if (this._activeTransition.progress >= 1.0) {
    this._activeTransition = null;
  }
}
```

---

## Event Override (A13 Detail)

Blood Ledger events produce temporary atmosphere shifts with an ONSET -> PEAK -> DECAY envelope. Each override targets a specific district. Visitors in adjacent districts get a 20% sympathetic effect.

```js
onWorldEvent(event) {
  this._eventOverrides.push({
    eventId: event.id,
    districtId: event.location.district,
    severity: Math.min(event.salience, 1.0),
    fogDensityAdd: event.salience * 0.025,
    lightIntensityMult: 1.0 - event.salience * 0.15,
    durationIngameHours: 2.0 + event.salience * 4.0,
    elapsedIngameHours: 0.0,
  });
}
```

---

## Environment Variables

```
VENICE_INITIAL_HOUR      - Override starting in-game hour (default 8.0)
VENICE_WEATHER_SEED      - Override weather RNG seed (default 42)
BIOMETRIC_ENABLED        - "true" to enable Garmin stress layer
```

---

## Import Graph

```
main.js
  +-- atmosphere/atmosphere-controller.js
  |     +-- atmosphere/day-night.js
  |     +-- atmosphere/weather.js
  |     |     +-- venice/seed-utils.js
  |     +-- atmosphere/district-mood.js
  |     +-- atmosphere/ground-fog.js
  |     +-- atmosphere/ambient-particles.js
  |     +-- atmosphere/stars.js
  |     +-- atmosphere/window-glow.js
  |     +-- atmosphere/biometric-layer.js
  |     +-- atmosphere/vignette-shader.js
  +-- scene.js          (provides sky, sunLight, starLayer, cloudLayer)
  +-- zone-ambient.js   (used in island-only mode, bypassed in Venice mode)
```

---

## Performance Budget

| Resource | Budget (Quest 3) | Strategy |
|---|---|---|
| Ground fog particles | 200 | InstancedMesh, cull beyond 30m |
| Ambient particles | 500 | THREE.Points with custom shader |
| Fog density lerp | 1 call/frame | Exponential lerp, not per-building |
| Shadow map | 2048x2048 | Single directional light, follows visitor |
| Sky shader | Existing Preetham | Only update sun position uniform |
| Star layer | 800 points | Opacity-only update, no geometry change |
| Window glow | LOD0+LOD1 only | Skip LOD2 and hidden buildings |
| Total particle draw calls | 2 | 1 for ground fog (instanced), 1 for ambient (Points) |

### Shader Uniform Update Costs

| Uniform | Updated | Cost |
|---|---|---|
| `sky.sunPosition` | Every frame | 1 vec3 upload |
| `scene.fog.density` | Every frame | 1 float |
| `scene.fog.color` | Every frame | 1 vec3 |
| `waterMaterial.uTime` | Every frame | 1 float (per canal, ~10 canals) |
| `vignetteMaterial.uOpacity` | Every frame | 1 float |
| `ambientParticle.positions` | Every frame | 500 * 3 floats (buffer upload) |
| `groundFog.instanceMatrix` | Every frame | 200 * 16 floats (buffer upload) |

Total per-frame uniform/buffer overhead: < 0.5ms on Quest 3.

---

## Smoothstep Utility

Used throughout for non-linear interpolation:

```js
function smoothstep(t) {
  const c = THREE.MathUtils.clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}
```
