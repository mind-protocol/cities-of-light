# IMPLEMENTATION: citizens/embodiment -- Rendering 186 Citizens on Quest 3

```
STATUS: DRAFT
CREATED: 2026-03-11
VERIFIED: Not yet implemented
```

---

## CHAIN

```
OBJECTIVES:      ../../../docs/01_OBJECTIFS_Venezia.md
BEHAVIORS:       ./BEHAVIORS_Embodiment.md
PATTERNS:        ./PATTERNS_Embodiment.md
ALGORITHM:       ./ALGORITHM_Embodiment.md
THIS:            IMPLEMENTATION_Embodiment.md (you are here)
SYNC:            ./SYNC_Embodiment.md

FILES:           src/client/citizens/citizen-avatar.js (primary)
                 src/client/citizens/citizen-manager.js (tier/spawn integration)
                 src/client/avatar.js (existing, Phase 1 reference)
```

---

## FILE MAP

```
src/client/citizens/
  citizen-avatar.js        ← This module. SkinnedMesh, AnimationMixer, LOD, materials.
  citizen-manager.js       ← Tier assignment, spawn/despawn lifecycle (see IMPLEMENTATION_Population).
                              Calls into citizen-avatar.js for mesh creation/disposal.
  citizen-voice.js         ← Spatial TTS playback per citizen (depends on avatar position).
  citizen-awareness.js     ← Proximity detection, gaze tracking (reads avatar head bone).

assets/citizens/
  meshes/
    base/                  ← glTF base body meshes (male_young_01.glb, female_elder_01.glb, ...)
    clothing/              ← glTF clothing overlays (nobili_male_robe_01.glb, ...)
    lod/                   ← Decimated ACTIVE-tier variants (_lod1 suffix)
    ambient/               ← Single capsule mesh for instancing (ambient_capsule.glb)
  textures/
    face_atlas.png         ← 4096x4096 atlas, all 186 faces (build-time generated)
    class_nobili.png       ← Per-class clothing atlas
    class_cittadini.png
    class_popolani.png
    class_facchini.png
    class_forestieri.png
  animations/
    idle.glb               ← Shared animation clips (exported with skeleton only)
    walking.glb
    walking_slow.glb
    working.glb
    eating.glb
    socializing.glb
    resting.glb
    praying.glb
    talking.glb
    distressed.glb
    idle_agitated.glb

scripts/
  generate-face-atlas.js   ← Build-time: Stable Diffusion -> face atlas PNG
  generate-citizen-configs.js  ← Build-time: Airtable CITIZENS -> citizen configs JSON
```

---

## NPM PACKAGES

```json
{
  "three": "^0.170.0",
  "three-mesh-bvh": "^0.7.0"
}
```

`three` is already in package.json. `three-mesh-bvh` is optional (raycasting optimization for citizen click-to-talk; not needed for rendering).

No additional packages are required. The embodiment module uses only Three.js core classes: `SkinnedMesh`, `AnimationMixer`, `AnimationAction`, `InstancedMesh`, `LOD`, `Skeleton`, `Bone`, `BufferGeometry`, `MeshStandardMaterial`, `CanvasTexture`, `TextureLoader`, `Group`, `Matrix4`, `Vector3`, `Color`, `Quaternion`.

---

## IMPORT GRAPH

```
citizen-avatar.js
  <- three (SkinnedMesh, AnimationMixer, InstancedMesh, LOD, Group, Matrix4, ...)
  <- ./mesh-library.js (singleton loader, shared geometries + skeletons + clips)
  <- ./citizen-material.js (material factory, class palettes, face atlas UV)

citizen-manager.js
  <- ./citizen-avatar.js (createFullMesh, createActiveMesh, setAmbientInstance, disposeMesh)
  <- ../network.js (receives citizen_update WebSocket messages)

mesh-library.js
  <- three (GLTFLoader, AnimationClip, BufferGeometry, Skeleton, Texture)
  <- three/addons/loaders/GLTFLoader.js

citizen-material.js
  <- three (MeshStandardMaterial, CanvasTexture, Color)
```

---

## DATA STRUCTURES (JS Classes)

### CitizenConfig

Loaded once from server at startup. Immutable per session.

```js
// citizen-avatar.js

/**
 * @typedef {Object} CitizenConfig
 * @property {string} id              - Airtable citizen record ID
 * @property {string} firstName
 * @property {string} lastName
 * @property {'male'|'female'} gender
 * @property {'young'|'middle'|'elder'} ageGroup
 * @property {'Nobili'|'Cittadini'|'Popolani'|'Facchini'|'Forestieri'} socialClass
 * @property {string} baseMeshId      - e.g. 'male_middle_01'
 * @property {string} clothingId      - e.g. 'nobili_male_robe_02'
 * @property {number} colorPrimary    - hex, e.g. 0x8B0000
 * @property {number} colorSecondary  - hex
 * @property {{ u: number, v: number, w: number, h: number }} faceAtlasUV
 * @property {number} heightScale     - 0.9 - 1.1
 * @property {number} buildScale      - 0.85 - 1.15
 * @property {number} walkSpeedMult   - 0.85 - 1.15
 * @property {number} animPhaseOffset - 0.0 - 1.0
 */
```

### CitizenRenderState

Per-citizen mutable state, managed by the client rendering system.

```js
// citizen-avatar.js

class CitizenRenderState {
  /** @param {CitizenConfig} config */
  constructor(config) {
    this.id = config.id;
    this.config = config;

    /** @type {'FULL'|'ACTIVE'|'AMBIENT'|'HIDDEN'} */
    this.tier = 'HIDDEN';
    /** @type {'FULL'|'ACTIVE'|'AMBIENT'|'HIDDEN'} */
    this.prevTier = 'HIDDEN';
    /** @type {number} 0.0 (start) to 1.0 (complete) */
    this.transitionT = 1.0;

    /** @type {THREE.Group|null} */
    this.meshFull = null;
    /** @type {THREE.Group|null} */
    this.meshActive = null;
    /** @type {number|null} index into InstancedMesh */
    this.ambientIndex = null;

    /** @type {THREE.AnimationMixer|null} */
    this.mixer = null;
    /** @type {Map<string, THREE.AnimationAction>} */
    this.actions = new Map();
    /** @type {string} current animation state name */
    this.animState = 'idle';
    /** @type {number} elapsed time in current animation */
    this.animTime = 0;

    /** @type {number} spine curve offset (radians, mood-driven) */
    this.spineOffset = 0;
    /** @type {THREE.Vector3|null} head IK target for conversation */
    this.headLookAt = null;

    /** @type {number} timestamp of last frame rendered */
    this.lastVisible = 0;
    /** @type {number} timestamp of last FULL tier use */
    this.lastFullUse = 0;
    /** @type {number} timestamp of last ACTIVE tier use */
    this.lastActiveUse = 0;
  }
}
```

### MeshLibrary

Singleton. Loaded at startup. All geometries and skeletons are shared (never cloned). Only materials are cloned per citizen.

```js
// mesh-library.js

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';

class MeshLibrary {
  constructor() {
    /** @type {Map<string, { geometry: THREE.BufferGeometry, skeleton: THREE.Skeleton, bindPose: THREE.Matrix4[] }>} */
    this.baseBodies = new Map();

    /** @type {Map<string, { geometry: THREE.BufferGeometry }>} */
    this.clothing = new Map();

    /** @type {Map<string, { geometry: THREE.BufferGeometry }>} */
    this.bodiesLOD1 = new Map();

    /** @type {Map<string, { geometry: THREE.BufferGeometry }>} */
    this.clothingLOD1 = new Map();

    /** @type {Map<string, THREE.AnimationClip>} */
    this.animations = new Map();

    /** @type {Map<string, THREE.Texture>} */
    this.classAtlases = new Map();

    /** @type {THREE.Texture|null} */
    this.faceAtlas = null;

    /** @type {THREE.BufferGeometry|null} */
    this.ambientGeo = null;

    /** @type {Set<THREE.BufferGeometry>} geometries owned by this library (never dispose externally) */
    this.sharedGeometries = new Set();

    /** @type {Set<THREE.Texture>} textures owned by this library */
    this.sharedTextures = new Set();

    this._loader = new GLTFLoader();
    this._loaded = false;
  }

  /**
   * Load all assets. Call once at startup.
   * @returns {Promise<void>}
   */
  async load() { /* see Loading section below */ }

  /**
   * Check whether a geometry is shared (library-owned, do not dispose).
   * @param {THREE.BufferGeometry} geo
   * @returns {boolean}
   */
  isShared(geo) {
    return this.sharedGeometries.has(geo);
  }

  /**
   * Check whether a texture is shared.
   * @param {THREE.Texture} tex
   * @returns {boolean}
   */
  isSharedTexture(tex) {
    return this.sharedTextures.has(tex);
  }
}

/** @type {MeshLibrary} */
export const meshLibrary = new MeshLibrary();
```

---

## MESH LIBRARY LOADING

```js
// mesh-library.js — load() method

async load() {
  if (this._loaded) return;

  const BASE_PATH = '/assets/citizens';
  const textureLoader = new THREE.TextureLoader();

  // ── Base Bodies ───────────────────────────────────────
  const bodyIds = [
    'male_young_01', 'male_young_02', 'male_middle_01', 'male_elder_01',
    'female_young_01', 'female_middle_01', 'female_elder_01',
  ];
  const bodyPromises = bodyIds.map(async (id) => {
    const gltf = await this._loadGLTF(`${BASE_PATH}/meshes/base/${id}.glb`);
    const skinnedMesh = this._findSkinnedMesh(gltf.scene);
    if (!skinnedMesh) throw new Error(`No SkinnedMesh in ${id}.glb`);

    this.sharedGeometries.add(skinnedMesh.geometry);
    this.baseBodies.set(id, {
      geometry: skinnedMesh.geometry,
      skeleton: skinnedMesh.skeleton,
      bindPose: skinnedMesh.skeleton.boneInverses.map(m => m.clone()),
    });
  });

  // ── Clothing ──────────────────────────────────────────
  const clothingIds = [
    'nobili_male_robe_01', 'nobili_male_robe_02', 'nobili_female_gown_01',
    'cittadini_male_coat_01', 'cittadini_female_dress_01',
    'popolani_male_tunic_01', 'popolani_female_tunic_01',
    'facchini_male_work_01', 'facchini_female_work_01',
    'forestieri_ottoman_01', 'forestieri_germanic_01', 'forestieri_moorish_01',
  ];
  const clothingPromises = clothingIds.map(async (id) => {
    const gltf = await this._loadGLTF(`${BASE_PATH}/meshes/clothing/${id}.glb`);
    const skinnedMesh = this._findSkinnedMesh(gltf.scene);
    if (!skinnedMesh) return; // graceful skip for missing assets
    this.sharedGeometries.add(skinnedMesh.geometry);
    this.clothing.set(id, { geometry: skinnedMesh.geometry });
  });

  // ── Animations ────────────────────────────────────────
  const animNames = [
    'idle', 'walking', 'walking_slow', 'working', 'eating',
    'socializing', 'resting', 'praying', 'talking', 'distressed', 'idle_agitated',
  ];
  const animPromises = animNames.map(async (name) => {
    const gltf = await this._loadGLTF(`${BASE_PATH}/animations/${name}.glb`);
    if (gltf.animations.length > 0) {
      this.animations.set(name, gltf.animations[0]);
    }
  });

  // ── Textures ──────────────────────────────────────────
  const faceAtlasPromise = new Promise((resolve) => {
    textureLoader.load(`${BASE_PATH}/textures/face_atlas.png`, (tex) => {
      tex.flipY = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      this.faceAtlas = tex;
      this.sharedTextures.add(tex);
      resolve();
    });
  });

  const classNames = ['nobili', 'cittadini', 'popolani', 'facchini', 'forestieri'];
  const classAtlasPromises = classNames.map((cls) => {
    return new Promise((resolve) => {
      textureLoader.load(`${BASE_PATH}/textures/class_${cls}.png`, (tex) => {
        tex.flipY = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        this.classAtlases.set(cls, tex);
        this.sharedTextures.add(tex);
        resolve();
      });
    });
  });

  // ── Ambient Capsule ───────────────────────────────────
  const ambientPromise = new Promise((resolve) => {
    // Procedural capsule: cylinder + hemisphere caps, ~50 tris
    const radius = 0.15;
    const height = 1.4;
    const capsule = new THREE.CapsuleGeometry(radius, height - 2 * radius, 4, 6);
    this.ambientGeo = capsule;
    this.sharedGeometries.add(capsule);
    resolve();
  });

  // ── Parallel Load ─────────────────────────────────────
  await Promise.all([
    ...bodyPromises,
    ...clothingPromises,
    ...animPromises,
    faceAtlasPromise,
    ...classAtlasPromises,
    ambientPromise,
  ]);

  this._loaded = true;
  console.log(`MeshLibrary loaded: ${this.baseBodies.size} bodies, ${this.clothing.size} clothing, ${this.animations.size} anims`);
}

/** @private */
_loadGLTF(url) {
  return new Promise((resolve, reject) => {
    this._loader.load(url, resolve, undefined, reject);
  });
}

/** @private */
_findSkinnedMesh(scene) {
  let found = null;
  scene.traverse((child) => {
    if (child.isSkinnedMesh && !found) found = child;
  });
  return found;
}
```

---

## MATERIAL SYSTEM

```js
// citizen-material.js

import * as THREE from 'three';
import { meshLibrary } from './mesh-library.js';

/**
 * Social class color palettes.
 * Primary = robe/clothing main color. Secondary = trim/accent.
 */
const CLASS_PALETTES = {
  Nobili:     { primary: 0x8B0000, secondary: 0xDAA520 },  // crimson + gold
  Cittadini:  { primary: 0x2F4F4F, secondary: 0x8B8682 },  // dark slate + warm gray
  Popolani:   { primary: 0x8B7355, secondary: 0x6B4226 },  // burlap + brown
  Facchini:   { primary: 0x5C4033, secondary: 0x3E2723 },  // dark brown + earth
  Forestieri: { primary: 0x4A148C, secondary: 0xFF6F00 },  // deep purple + orange
};

/**
 * Create a FULL-tier material for a citizen.
 * Uses face atlas UV, class atlas, and per-citizen color variation.
 *
 * @param {import('./citizen-avatar.js').CitizenConfig} config
 * @returns {THREE.MeshStandardMaterial}
 */
export function createFullMaterial(config) {
  const palette = CLASS_PALETTES[config.socialClass] || CLASS_PALETTES.Popolani;
  const classAtlas = meshLibrary.classAtlases.get(config.socialClass.toLowerCase());

  const mat = new THREE.MeshStandardMaterial({
    map: classAtlas || null,
    color: new THREE.Color(config.colorPrimary || palette.primary),
    metalness: 0.15,
    roughness: 0.75,
    transparent: true,
    opacity: 1.0,
    side: THREE.FrontSide,
  });

  // Face sub-texture: custom onBeforeCompile to remap UV in face region
  // Uses config.faceAtlasUV to sample from the shared 4096x4096 face atlas.
  if (meshLibrary.faceAtlas && config.faceAtlasUV) {
    mat.userData.faceAtlas = meshLibrary.faceAtlas;
    mat.userData.faceUV = config.faceAtlasUV;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.faceAtlas = { value: meshLibrary.faceAtlas };
      shader.uniforms.faceUVRect = {
        value: new THREE.Vector4(
          config.faceAtlasUV.u,
          config.faceAtlasUV.v,
          config.faceAtlasUV.w,
          config.faceAtlasUV.h
        ),
      };
      // Inject face atlas sampling in fragment shader after map sampling
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
        #include <map_fragment>
        // Face atlas overlay: blend face texture into head UV region
        // Vertex attribute 'a_isFace' flags face vertices (set in geometry)
        #ifdef USE_FACE_ATLAS
          vec2 faceCoord = vec2(
            faceUVRect.x + vMapUv.x * faceUVRect.z,
            faceUVRect.y + vMapUv.y * faceUVRect.w
          );
          vec4 faceColor = texture2D(faceAtlas, faceCoord);
          diffuseColor.rgb = mix(diffuseColor.rgb, faceColor.rgb, faceColor.a);
        #endif
        `
      );
    };
  }

  return mat;
}

/**
 * Create an ACTIVE-tier material. Cheaper: vertex color + flat class tint, no face.
 *
 * @param {import('./citizen-avatar.js').CitizenConfig} config
 * @returns {THREE.MeshStandardMaterial}
 */
export function createActiveMaterial(config) {
  const palette = CLASS_PALETTES[config.socialClass] || CLASS_PALETTES.Popolani;

  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.colorPrimary || palette.primary),
    metalness: 0.1,
    roughness: 0.85,
    transparent: true,
    opacity: 1.0,
    vertexColors: false,
    side: THREE.FrontSide,
  });
}

/**
 * Create the shared AMBIENT-tier material. One instance, used by InstancedMesh.
 * Vertex color enabled so each instance can have its own class tint.
 *
 * @returns {THREE.MeshStandardMaterial}
 */
export function createAmbientMaterial() {
  return new THREE.MeshStandardMaterial({
    vertexColors: false,
    metalness: 0.0,
    roughness: 1.0,
    transparent: true,
    opacity: 0.85,
    side: THREE.FrontSide,
  });
}

export { CLASS_PALETTES };
```

---

## THREE.js LOD IMPLEMENTATION

The LOD system uses `THREE.LOD` for FULL and ACTIVE tiers, with AMBIENT handled separately via `THREE.InstancedMesh`. LOD objects are not used directly because AMBIENT citizens share a single instanced draw call. Instead, the tier system acts as a manual LOD.

### LOD Object Creation (FULL + ACTIVE tiers only)

```js
// citizen-avatar.js

import * as THREE from 'three';
import { meshLibrary } from './mesh-library.js';
import { createFullMaterial, createActiveMaterial } from './citizen-material.js';

/**
 * Create a THREE.LOD object containing FULL and ACTIVE meshes.
 * The LOD thresholds match the tier distance thresholds.
 *
 * NOTE: This is an alternative to manual tier switching. If used,
 * the LOD object auto-switches between FULL and ACTIVE based on camera
 * distance. The population manager still handles AMBIENT and HIDDEN.
 *
 * @param {CitizenConfig} config
 * @returns {THREE.LOD}
 */
export function createCitizenLOD(config) {
  const lod = new THREE.LOD();

  // LOD 0: FULL mesh (< 20m from camera)
  const fullGroup = createFullMesh(config);
  lod.addLevel(fullGroup, 0);

  // LOD 1: ACTIVE mesh (20m - 80m from camera)
  const activeGroup = createActiveMesh(config);
  lod.addLevel(activeGroup, 20);

  // LOD 2: Empty group (> 80m) -- AMBIENT is instanced separately
  const emptyGroup = new THREE.Group();
  lod.addLevel(emptyGroup, 80);

  return lod;
}
```

In practice, the population manager (`citizen-manager.js`) uses manual tier switching instead of `THREE.LOD` because:
1. AMBIENT tier uses `InstancedMesh`, which cannot be a LOD level.
2. Budget caps require global scoring across all citizens, not per-citizen distance checks.
3. Hysteresis and conversation locks need per-citizen logic that LOD.autoUpdate does not support.

The `THREE.LOD` pattern is documented here for reference. The actual implementation uses manual mesh creation/disposal as described below.

---

## FULL-TIER MESH CREATION (SkinnedMesh + AnimationMixer)

```js
// citizen-avatar.js

/**
 * Build the FULL-tier Three.js Group for a citizen.
 *
 * Uses SkinnedMesh with shared geometry from MeshLibrary.
 * Skeleton is cloned (each citizen needs independent bone transforms).
 * Geometry is shared (referenced, not cloned -- saves GPU memory).
 * Material is cloned per citizen (unique colors, face atlas UV).
 * AnimationMixer is set up with all animation clips.
 *
 * @param {CitizenConfig} config
 * @returns {THREE.Group} Group containing body + clothing + mixer reference.
 */
export function createFullMesh(config) {
  const group = new THREE.Group();
  group.name = `citizen_full_${config.id}`;

  const bodyEntry = meshLibrary.baseBodies.get(config.baseMeshId);
  if (!bodyEntry) {
    console.warn(`Missing base mesh: ${config.baseMeshId}`);
    return group;
  }

  // Clone skeleton (each citizen animates independently)
  const skeleton = bodyEntry.skeleton.clone();
  skeleton.bones = skeleton.bones.map(bone => bone.clone());

  // Rebuild parent-child relationships in cloned bones
  const boneMap = new Map();
  bodyEntry.skeleton.bones.forEach((origBone, i) => {
    boneMap.set(origBone.uuid, skeleton.bones[i]);
  });
  for (const bone of skeleton.bones) {
    // Clear children, re-attach from cloned set
    const origBone = bodyEntry.skeleton.bones.find(
      b => b.name === bone.name
    );
    if (origBone?.parent && boneMap.has(origBone.parent.uuid)) {
      boneMap.get(origBone.parent.uuid).add(bone);
    }
  }

  // Root bone container
  const rootBone = skeleton.bones[0];
  group.add(rootBone);

  // ── Body SkinnedMesh ───────────────────────────────
  const bodyMaterial = createFullMaterial(config);
  const bodyMesh = new THREE.SkinnedMesh(bodyEntry.geometry, bodyMaterial);
  bodyMesh.bind(skeleton);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.frustumCulled = true;
  group.add(bodyMesh);

  // ── Clothing SkinnedMesh (same skeleton) ───────────
  const clothingEntry = meshLibrary.clothing.get(config.clothingId);
  if (clothingEntry) {
    const clothingMaterial = createFullMaterial(config);
    // Clothing uses secondary color
    clothingMaterial.color.set(config.colorSecondary || 0x888888);
    const clothingMesh = new THREE.SkinnedMesh(clothingEntry.geometry, clothingMaterial);
    clothingMesh.bind(skeleton);
    clothingMesh.castShadow = true;
    clothingMesh.frustumCulled = true;
    group.add(clothingMesh);
  }

  // ── Parametric Variation ───────────────────────────
  group.scale.set(
    config.buildScale,
    config.heightScale,
    config.buildScale
  );

  // ── AnimationMixer ─────────────────────────────────
  const mixer = new THREE.AnimationMixer(group);
  const actions = new Map();

  for (const [name, clip] of meshLibrary.animations) {
    const action = mixer.clipAction(clip);
    action.setEffectiveWeight(0);
    actions.set(name, action);
  }

  // Start with idle
  const idleAction = actions.get('idle');
  if (idleAction) {
    idleAction.setEffectiveWeight(1);
    idleAction.play();
  }

  // Store mixer + actions on group for external access
  group.userData.mixer = mixer;
  group.userData.actions = actions;
  group.userData.skeleton = skeleton;
  group.userData.tier = 'FULL';

  return group;
}
```

---

## ACTIVE-TIER MESH CREATION

```js
// citizen-avatar.js

/**
 * Build the ACTIVE-tier Three.js Group.
 *
 * Uses decimated (LOD1) geometry. Single SkinnedMesh (body + clothing
 * are pre-merged at lower LOD in the asset pipeline).
 * Simpler material: flat class color, no face texture.
 * No AnimationMixer -- posture is applied via direct bone transforms.
 *
 * @param {CitizenConfig} config
 * @returns {THREE.Group}
 */
export function createActiveMesh(config) {
  const group = new THREE.Group();
  group.name = `citizen_active_${config.id}`;

  // Try LOD1 body; fall back to full-res if LOD1 not available
  const lod1Key = `${config.baseMeshId}_lod1`;
  const bodyEntry = meshLibrary.bodiesLOD1.get(lod1Key)
    || meshLibrary.baseBodies.get(config.baseMeshId);

  if (!bodyEntry) return group;

  const skeleton = bodyEntry.skeleton.clone();
  skeleton.bones = skeleton.bones.map(bone => bone.clone());
  const rootBone = skeleton.bones[0];
  group.add(rootBone);

  const material = createActiveMaterial(config);
  const mesh = new THREE.SkinnedMesh(bodyEntry.geometry, material);
  mesh.bind(skeleton);
  mesh.castShadow = false;      // No shadows at ACTIVE range (perf)
  mesh.receiveShadow = false;
  mesh.frustumCulled = true;
  group.add(mesh);

  group.scale.set(config.buildScale, config.heightScale, config.buildScale);

  group.userData.skeleton = skeleton;
  group.userData.tier = 'ACTIVE';

  return group;
}
```

---

## AMBIENT-TIER INSTANCING (InstancedMesh)

```js
// citizen-avatar.js

import { createAmbientMaterial } from './citizen-material.js';

const MAX_AMBIENT_INSTANCES = 150;

/** @type {THREE.InstancedMesh|null} */
let ambientMesh = null;

/** @type {Map<string, number>} citizenId -> instance index */
const ambientIndexMap = new Map();

/** @type {number} next free instance slot */
let ambientNextIndex = 0;

/**
 * Initialize the ambient instanced mesh. Called once after MeshLibrary loads.
 * @param {THREE.Scene} scene
 */
export function initAmbientInstancing(scene) {
  const geo = meshLibrary.ambientGeo;
  const mat = createAmbientMaterial();

  ambientMesh = new THREE.InstancedMesh(geo, mat, MAX_AMBIENT_INSTANCES);
  ambientMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ambientMesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_AMBIENT_INSTANCES * 3), 3
  );
  ambientMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  ambientMesh.count = 0;
  ambientMesh.frustumCulled = false; // Instances span large area
  ambientMesh.castShadow = false;
  ambientMesh.receiveShadow = false;
  scene.add(ambientMesh);
}

/**
 * Set (or update) an ambient citizen instance.
 *
 * @param {string} citizenId
 * @param {{ x: number, y: number, z: number }} position
 * @param {number} colorHex - class primary color
 * @param {number} heightScale
 */
export function setAmbientInstance(citizenId, position, colorHex, heightScale = 1.0) {
  if (!ambientMesh) return;

  let idx = ambientIndexMap.get(citizenId);
  if (idx === undefined) {
    idx = ambientNextIndex++;
    ambientIndexMap.set(citizenId, idx);
    if (idx >= MAX_AMBIENT_INSTANCES) {
      console.warn('Ambient instance limit reached');
      return;
    }
  }

  // Transform matrix: translate + scale
  const matrix = new THREE.Matrix4();
  matrix.makeTranslation(position.x, position.y, position.z);
  const scaleMatrix = new THREE.Matrix4().makeScale(1, heightScale, 1);
  matrix.multiply(scaleMatrix);

  ambientMesh.setMatrixAt(idx, matrix);
  ambientMesh.setColorAt(idx, new THREE.Color(colorHex));

  // Update count to include this index
  if (idx >= ambientMesh.count) {
    ambientMesh.count = idx + 1;
  }

  ambientMesh.instanceMatrix.needsUpdate = true;
  ambientMesh.instanceColor.needsUpdate = true;
}

/**
 * Remove a citizen from the ambient instanced mesh.
 * Swaps with the last active instance to keep the buffer compact.
 *
 * @param {string} citizenId
 */
export function removeAmbientInstance(citizenId) {
  if (!ambientMesh) return;

  const idx = ambientIndexMap.get(citizenId);
  if (idx === undefined) return;

  const lastIdx = ambientMesh.count - 1;

  if (idx !== lastIdx) {
    // Swap with last instance
    const tempMatrix = new THREE.Matrix4();
    const tempColor = new THREE.Color();

    ambientMesh.getMatrixAt(lastIdx, tempMatrix);
    ambientMesh.setMatrixAt(idx, tempMatrix);

    ambientMesh.getColorAt(lastIdx, tempColor);
    ambientMesh.setColorAt(idx, tempColor);

    // Update index map for the swapped citizen
    for (const [cid, cidIdx] of ambientIndexMap) {
      if (cidIdx === lastIdx) {
        ambientIndexMap.set(cid, idx);
        break;
      }
    }
  }

  ambientIndexMap.delete(citizenId);
  ambientMesh.count = Math.max(0, ambientMesh.count - 1);
  ambientMesh.instanceMatrix.needsUpdate = true;
  ambientMesh.instanceColor.needsUpdate = true;
}

/**
 * Set opacity on a specific ambient instance (for crossfade transitions).
 * InstancedMesh does not natively support per-instance opacity.
 * Workaround: encode opacity in the alpha channel of instance color
 * and use a custom material with vertexAlphas enabled.
 *
 * @param {string} citizenId
 * @param {number} opacity - 0.0 to 1.0
 */
export function setAmbientInstanceOpacity(citizenId, opacity) {
  // Per-instance opacity requires custom shader attribute.
  // For V1, skip per-instance opacity: snap visibility instead.
  // TODO: Add InstancedBufferAttribute for per-instance opacity in V2.
  if (!ambientMesh) return;
  const idx = ambientIndexMap.get(citizenId);
  if (idx === undefined) return;

  if (opacity < 0.01) {
    // Move off-screen instead of true transparency
    const matrix = new THREE.Matrix4();
    matrix.makeTranslation(0, -1000, 0);
    ambientMesh.setMatrixAt(idx, matrix);
    ambientMesh.instanceMatrix.needsUpdate = true;
  }
}
```

---

## ANIMATION STATE MACHINE

```js
// citizen-avatar.js

/**
 * Activity-to-animation mapping.
 * @param {string} activity - from CitizenState
 * @param {string} mood - from CitizenState
 * @returns {string} animation clip name
 */
export function mapActivityToAnim(activity, mood) {
  // Mood overrides
  if (mood === 'desperate' && activity !== 'walking') return 'distressed';
  if (activity === 'idle' && (mood === 'angry' || mood === 'furious')) return 'idle_agitated';

  // Activity mapping
  const map = {
    idle: 'idle',
    walking: mood === 'sad' ? 'walking_slow' : 'walking',
    working: 'working',
    eating: 'eating',
    socializing: 'socializing',
    resting: 'resting',
    praying: 'praying',
    talking: 'talking',
  };

  return map[activity] || 'idle';
}

/**
 * Update animation state for a FULL-tier citizen.
 * Handles crossfading between animation clips.
 *
 * @param {CitizenRenderState} renderState
 * @param {string} targetAnim - from mapActivityToAnim()
 * @param {number} deltaTime - seconds
 */
export function updateFullAnimation(renderState, targetAnim, deltaTime) {
  const mixer = renderState.meshFull?.userData.mixer;
  const actions = renderState.meshFull?.userData.actions;
  if (!mixer || !actions) return;

  // Apply phase offset to prevent synchronized animation across citizens
  renderState.animTime += deltaTime * renderState.config.walkSpeedMult;

  if (targetAnim !== renderState.animState) {
    // Crossfade from current to target
    const currentAction = actions.get(renderState.animState);
    const targetAction = actions.get(targetAnim);

    if (targetAction) {
      targetAction.reset();
      targetAction.setEffectiveWeight(1);
      targetAction.play();

      if (currentAction) {
        currentAction.crossFadeTo(targetAction, 0.4, true);
      }
    }

    renderState.animState = targetAnim;
  }

  // Update mixer
  mixer.update(deltaTime);
}

/**
 * Compute posture offset for ACTIVE-tier citizens.
 * Applied via direct bone transforms (no AnimationMixer).
 *
 * @param {number} moodValence - -1.0 to +1.0
 * @param {number} moodArousal - 0.0 to 1.0
 * @returns {{ spineOffset: number, speedMult: number, headPitch: number }}
 */
export function computePostureOffset(moodValence, moodArousal) {
  const spineOffset = moodValence * 0.15;
  const speedMult = 0.8 + moodArousal * 0.4;
  const headPitch = moodValence < -0.3 ? moodValence * 0.2 : 0.0;
  return { spineOffset, speedMult, headPitch };
}

/**
 * Apply posture to an ACTIVE-tier citizen's skeleton.
 * Finds the spine and head bones and applies rotation offsets.
 *
 * @param {THREE.Group} activeGroup - the ACTIVE-tier mesh group
 * @param {{ spineOffset: number, headPitch: number }} posture
 */
export function applyActivePosture(activeGroup, posture) {
  const skeleton = activeGroup?.userData.skeleton;
  if (!skeleton) return;

  const spineBone = skeleton.bones.find(b => b.name === 'Spine' || b.name === 'spine');
  if (spineBone) {
    spineBone.rotation.x = posture.spineOffset;
  }

  const headBone = skeleton.bones.find(b => b.name === 'Head' || b.name === 'head');
  if (headBone) {
    headBone.rotation.x = posture.headPitch;
  }
}
```

---

## MESH DISPOSAL

```js
// citizen-avatar.js

/**
 * Dispose a citizen mesh group, releasing GPU resources.
 *
 * Rules:
 * - Shared geometries (from MeshLibrary) are NEVER disposed.
 * - Shared textures (atlas textures) are NEVER disposed.
 * - Cloned materials ARE disposed.
 * - AnimationMixer is stopped and uncached.
 *
 * @param {THREE.Group} group
 */
export function disposeMesh(group) {
  if (!group) return;

  // Stop animation mixer
  const mixer = group.userData.mixer;
  if (mixer) {
    mixer.stopAllAction();
    mixer.uncacheRoot(group);
  }

  group.traverse((child) => {
    if (child.isMesh || child.isSkinnedMesh) {
      // Dispose geometry only if not shared
      if (child.geometry && !meshLibrary.isShared(child.geometry)) {
        child.geometry.dispose();
      }

      // Dispose material (always cloned per citizen)
      if (child.material) {
        if (Array.isArray(child.material)) {
          for (const mat of child.material) {
            disposeOneMaterial(mat);
          }
        } else {
          disposeOneMaterial(child.material);
        }
      }
    }
  });
}

/** @private */
function disposeOneMaterial(mat) {
  // Dispose non-shared textures
  if (mat.map && !meshLibrary.isSharedTexture(mat.map)) {
    mat.map.dispose();
  }
  if (mat.normalMap && !meshLibrary.isSharedTexture(mat.normalMap)) {
    mat.normalMap.dispose();
  }
  mat.dispose();
}
```

---

## BUILD-TIME ASSET PIPELINE

### Face Atlas Generation

```js
// scripts/generate-face-atlas.js
// Run with: node scripts/generate-face-atlas.js
// Requires: Stable Diffusion API endpoint (SDXL or similar)

/**
 * Generates a 4096x4096 face atlas for all 186 citizens.
 *
 * Grid: 14 columns x 14 rows = 196 slots (186 used + 10 spare).
 * Each face: 256x256 pixels.
 *
 * Process:
 * 1. Fetch all citizens from Airtable CITIZENS table.
 * 2. For each citizen, build a portrait prompt from their attributes.
 * 3. Generate via Stable Diffusion API.
 * 4. Composite into the atlas grid.
 * 5. Write atlas PNG + UV mapping JSON.
 *
 * Output:
 *   assets/citizens/textures/face_atlas.png
 *   assets/citizens/textures/face_atlas_uvs.json
 */

// Prompt template:
function buildFacePrompt(citizen) {
  const ageDescriptor = {
    young: '25-year-old',
    middle: '45-year-old',
    elder: '65-year-old',
  }[citizen.ageGroup] || '40-year-old';

  const classDescriptor = {
    Nobili: 'wealthy Venetian nobleman',
    Cittadini: 'respectable Venetian merchant',
    Popolani: 'common Venetian laborer',
    Facchini: 'Venetian dockworker',
    Forestieri: 'foreign trader in Venice',
  }[citizen.socialClass] || 'Venetian citizen';

  return `Portrait of a ${ageDescriptor} ${citizen.gender} ${classDescriptor}, ` +
    `Renaissance oil painting style, ${citizen.Description || ''}, ` +
    `neutral expression, neutral background, square crop, 256x256`;
}

// UV mapping output format:
// {
//   "rec_abc123": { "u": 0.0, "v": 0.0, "w": 0.0625, "h": 0.0625 },
//   "rec_def456": { "u": 0.0625, "v": 0.0, "w": 0.0625, "h": 0.0625 },
//   ...
// }
// u, v are normalized (0.0 - 1.0). w = h = 256/4096 = 0.0625.
```

### Citizen Config Generation

```js
// scripts/generate-citizen-configs.js
// Run with: node scripts/generate-citizen-configs.js
// Fetches CITIZENS from Airtable, outputs citizen-configs.json.

/**
 * Output format: Array<CitizenConfig> serialized as JSON.
 *
 * Deterministic hash function used for parametric variation:
 * hash(citizenId, salt) -> float 0.0-1.0
 * Uses FNV-1a hash of (citizenId + salt) mod 2^32, normalized.
 *
 * This ensures the same citizen always gets the same height,
 * build, walk speed, and phase offset across regenerations.
 */
function deterministicHash(id, salt) {
  let hash = 2166136261; // FNV offset basis
  const str = id + salt;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  return ((hash >>> 0) / 4294967295); // normalize to 0.0-1.0
}
```

---

## INTEGRATION WITH CITIZEN-MANAGER

The population module (`citizen-manager.js`) calls into the embodiment module at four points during the tier lifecycle:

```js
// Called by citizen-manager.js — interface contract

import {
  createFullMesh,
  createActiveMesh,
  setAmbientInstance,
  removeAmbientInstance,
  setAmbientInstanceOpacity,
  disposeMesh,
  updateFullAnimation,
  computePostureOffset,
  applyActivePosture,
  mapActivityToAnim,
  initAmbientInstancing,
} from './citizen-avatar.js';
import { meshLibrary } from './mesh-library.js';

// ── At startup ──────────────────────────────────────────
// await meshLibrary.load();
// initAmbientInstancing(scene);

// ── prepareTier(citizenId, newTier) ─────────────────────
// Called when a tier transition begins. Creates the mesh for the new tier.
function prepareTier(citizenId, newTier) {
  const rs = renderStates.get(citizenId);
  if (!rs) return;

  switch (newTier) {
    case 'FULL':
      if (!rs.meshFull) {
        rs.meshFull = createFullMesh(rs.config);
        scene.add(rs.meshFull);
      }
      rs.meshFull.visible = true;
      break;

    case 'ACTIVE':
      if (!rs.meshActive) {
        rs.meshActive = createActiveMesh(rs.config);
        scene.add(rs.meshActive);
      }
      rs.meshActive.visible = true;
      break;

    case 'AMBIENT':
      setAmbientInstance(
        citizenId,
        rs.currentPosition,
        rs.config.colorPrimary,
        rs.config.heightScale
      );
      break;

    case 'HIDDEN':
      // No mesh needed
      break;
  }
}

// ── setCrossfade(citizenId, fromTier, toTier, t) ────────
// Called every frame during transition. t goes 0.0 -> 1.0.
function setCrossfade(citizenId, fromTier, toTier, t) {
  const rs = renderStates.get(citizenId);
  if (!rs) return;

  // Fade in new tier
  if (toTier === 'FULL' && rs.meshFull) {
    setGroupOpacity(rs.meshFull, t);
  }
  if (toTier === 'ACTIVE' && rs.meshActive) {
    setGroupOpacity(rs.meshActive, t);
  }
  if (toTier === 'AMBIENT') {
    // Ambient fades in by position (snap at t > 0.5)
  }

  // Fade out old tier
  if (fromTier === 'FULL' && rs.meshFull) {
    setGroupOpacity(rs.meshFull, 1.0 - t);
  }
  if (fromTier === 'ACTIVE' && rs.meshActive) {
    setGroupOpacity(rs.meshActive, 1.0 - t);
  }
  if (fromTier === 'AMBIENT') {
    setAmbientInstanceOpacity(citizenId, 1.0 - t);
  }
}

// ── setPosition(citizenId, position, heading) ───────────
// Called every frame. Updates mesh world transform.
function setPosition(citizenId, position, heading) {
  const rs = renderStates.get(citizenId);
  if (!rs) return;

  if (rs.tier === 'FULL' && rs.meshFull) {
    rs.meshFull.position.set(position.x, position.y, position.z);
    rs.meshFull.rotation.y = heading;
  }
  if (rs.tier === 'ACTIVE' && rs.meshActive) {
    rs.meshActive.position.set(position.x, position.y, position.z);
    rs.meshActive.rotation.y = heading;
  }
  if (rs.tier === 'AMBIENT') {
    setAmbientInstance(citizenId, position, rs.config.colorPrimary, rs.config.heightScale);
  }
}

// ── finishTransition(citizenId, finalTier) ──────────────
// Called when crossfade reaches 1.0. Hides/disposes old tier meshes.
function finishTransition(citizenId, finalTier) {
  const rs = renderStates.get(citizenId);
  if (!rs) return;

  // Hide meshes not in use
  if (finalTier !== 'FULL' && rs.meshFull) {
    rs.meshFull.visible = false;
    rs.lastFullUse = performance.now();
  }
  if (finalTier !== 'ACTIVE' && rs.meshActive) {
    rs.meshActive.visible = false;
    rs.lastActiveUse = performance.now();
  }
  if (finalTier !== 'AMBIENT') {
    removeAmbientInstance(citizenId);
  }

  // Deferred disposal: meshes unused for > 5s are disposed
  // (handled in the per-frame cleanup pass in citizen-manager.js)
}

// ── Helper ──────────────────────────────────────────────
function setGroupOpacity(group, opacity) {
  group.traverse((child) => {
    if (child.material && child.material.transparent) {
      child.material.opacity = opacity;
    }
  });
}
```

---

## MEMORY BUDGET MONITORING

```js
// citizen-avatar.js

/**
 * Memory pressure check. Called every 10 seconds by citizen-manager.js.
 * Aggressively disposes cached meshes under pressure.
 *
 * @param {Map<string, CitizenRenderState>} renderStates
 * @param {THREE.Scene} scene
 * @param {{ maxFull: number, maxActive: number }} budget - mutable, reduced under pressure
 */
export function checkMemoryPressure(renderStates, scene, budget) {
  // performance.memory is Chrome/Quest-only
  const mem = performance.memory;
  if (!mem) return;

  const heapUsedMB = mem.usedJSHeapSize / (1024 * 1024);

  if (heapUsedMB > 1800) {
    // EMERGENCY: reduce active tier cache
    console.warn(`Memory emergency: ${heapUsedMB.toFixed(0)}MB heap`);
    for (const [id, rs] of renderStates) {
      if (rs.tier !== 'ACTIVE' && rs.meshActive) {
        scene.remove(rs.meshActive);
        disposeMesh(rs.meshActive);
        rs.meshActive = null;
      }
      if (rs.tier !== 'FULL' && rs.meshFull) {
        scene.remove(rs.meshFull);
        disposeMesh(rs.meshFull);
        rs.meshFull = null;
      }
    }
    budget.maxFull = 10;
    budget.maxActive = 30;
  } else if (heapUsedMB > 1500) {
    // Aggressive: dispose FULL cache for non-FULL citizens
    for (const [id, rs] of renderStates) {
      if (rs.tier !== 'FULL' && rs.meshFull) {
        scene.remove(rs.meshFull);
        disposeMesh(rs.meshFull);
        rs.meshFull = null;
      }
    }
  }
}
```

---

## INTERACTIONS

| Module | Import From | Function Called | Purpose |
|--------|-------------|----------------|---------|
| `citizen-manager.js` | `citizen-avatar.js` | `createFullMesh(config)` | Allocate FULL-tier SkinnedMesh + AnimationMixer |
| `citizen-manager.js` | `citizen-avatar.js` | `createActiveMesh(config)` | Allocate ACTIVE-tier decimated mesh |
| `citizen-manager.js` | `citizen-avatar.js` | `setAmbientInstance(id, pos, color, scale)` | Write instance to InstancedMesh buffer |
| `citizen-manager.js` | `citizen-avatar.js` | `removeAmbientInstance(id)` | Remove from InstancedMesh buffer |
| `citizen-manager.js` | `citizen-avatar.js` | `disposeMesh(group)` | Free GPU resources for unused tier |
| `citizen-manager.js` | `citizen-avatar.js` | `updateFullAnimation(rs, anim, dt)` | Drive AnimationMixer each frame |
| `citizen-manager.js` | `citizen-avatar.js` | `applyActivePosture(group, posture)` | Set bone rotations for mood |
| `citizen-manager.js` | `citizen-avatar.js` | `checkMemoryPressure(states, scene, budget)` | Adapt quality under memory pressure |
| `citizen-voice.js` | `citizen-avatar.js` | reads `meshFull.position` | Spatial audio source position |
| `citizen-awareness.js` | `citizen-avatar.js` | reads `skeleton.bones['Head']` | Gaze direction for proximity detection |
| `citizen-avatar.js` | `mesh-library.js` | `meshLibrary.load()`, `meshLibrary.baseBodies` | Shared geometry/skeleton/clip pool |
| `citizen-avatar.js` | `citizen-material.js` | `createFullMaterial(config)` | Per-citizen material with face atlas |
