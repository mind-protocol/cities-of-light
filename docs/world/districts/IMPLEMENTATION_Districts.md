# IMPLEMENTATION: world/districts -- Code Architecture

Exact file paths, exported APIs, data structures, Three.js specifics, and import graphs. Maps ALGORITHM pseudocode to concrete JavaScript modules. A developer should be able to start coding from this document alone.

---

## File Map

```
src/
  client/
    venice/
      district-generator.js     NEW   Main pipeline: generate_venice()
      canal-system.js            NEW   Canal Bezier paths, water/wall/fondamenta geometry
      building-generator.js      NEW   Procedural Venetian building meshes
      occupancy-grid.js          NEW   2D grid for gap-fill placement
      props.js                   NEW   Market stalls, gondolas, lanterns, crates
      lod-manager.js             NEW   Per-building LOD transitions + cache
      venice-config.js           NEW   All constants, district definitions, palettes
    scene.js                     MODIFY Add venice generation call alongside islands
    main.js                      MODIFY Import VeniceWorld, wire into render loop
  shared/
    districts.js                 NEW   District boundary polygons, shared by client+server
  server/
    venice-state.js              NEW   In-memory world state cache
    serenissima-sync.js          NEW   Airtable fetch + diff + broadcast
```

---

## Data Structures

### District Definition (shared/districts.js)

```js
/**
 * @typedef {Object} DistrictConfig
 * @property {[number, number]} buildingHeightRange - [min, max] in meters
 * @property {number} buildingDecoration          - 0.0 (plain) to 1.0 (ornate)
 * @property {number} streetWidth                 - meters
 * @property {[number, number]} canalWidthRange   - [min, max] in meters
 * @property {string[]} propTypes                 - allowed prop identifiers
 * @property {string[]} materialPalette           - palette key names
 * @property {number} fogTint                     - hex color for district fog blend
 * @property {number} ambientDensity              - 0.0-1.0 citizen crowd factor
 */

/**
 * @typedef {Object} DistrictDefinition
 * @property {string} id
 * @property {string} name
 * @property {{ x: number, y: number, z: number }} center - world coords
 * @property {{ x: number, z: number }[]} boundary        - convex polygon, world coords
 * @property {DistrictConfig} config
 */

/**
 * @typedef {Object} Vec3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */
```

### Building Record (from Airtable via server)

```js
/**
 * @typedef {Object} AirtableBuildingRecord
 * @property {string} id             - Airtable record ID
 * @property {number} lat
 * @property {number} lng
 * @property {'small'|'medium'|'large'} sizeTier
 * @property {'home'|'business'|'transport'|'storage'|'maritime'} category
 * @property {string|null} owner     - citizen record ID
 * @property {number|null} ownerDucats
 */
```

### Placed Building (runtime)

```js
/**
 * @typedef {Object} PlacedBuilding
 * @property {string} id              - source record ID or generated hash
 * @property {THREE.Group} mesh       - LOD0 full mesh
 * @property {THREE.Vector3} position
 * @property {string} districtId
 * @property {number} footprintWidth
 * @property {number} footprintDepth
 * @property {number} totalHeight
 * @property {number} baseColor       - hex
 * @property {number} seed
 * @property {number} currentLod      - -1 (hidden), 0, 1, 2
 * @property {(THREE.Object3D|null)[]} lodCache - [lod0, lod1, lod2]
 * @property {string} category
 * @property {THREE.MeshStandardMaterial|null} windowMaterial
 */
```

### Canal Sample

```js
/**
 * @typedef {Object} CanalSample
 * @property {THREE.Vector3} center
 * @property {THREE.Vector3} left
 * @property {THREE.Vector3} right
 */
```

### Venice State (returned by generate_venice)

```js
/**
 * @typedef {Object} VeniceState
 * @property {DistrictDefinition[]} districts
 * @property {CanalGeometrySet[]} canals
 * @property {PlacedBuilding[]} buildings
 * @property {THREE.Group[]} bridges
 * @property {THREE.Group[]} props
 * @property {THREE.Mesh} collisionMesh
 * @property {number} lodCursor - amortized LOD scan index
 */
```

---

## Module: venice-config.js

All magic numbers from ALGORITHM sections A1-A12. No external dependencies.

### Exports

```js
// --- Coordinate mapping (A1) ---
export const VENICE_LAT_MIN = 45.4250;
export const VENICE_LAT_MAX = 45.4480;
export const VENICE_LNG_MIN = 12.3080;
export const VENICE_LNG_MAX = 12.3680;
export const WORLD_WIDTH    = 1500;    // Three.js units (1 unit = 1 meter)
export const WORLD_DEPTH    = 1200;
export const WORLD_SCALE    = 1.0;
export const WORLD_Y        = 0.5;

// --- Canal geometry (A3, A4) ---
export const FONDAMENTA_HEIGHT = 0.8;  // meters above water (y=0)
export const FONDAMENTA_WIDTH  = 3.0;
export const WATER_Y           = 0.0;
export const CANAL_SAMPLE_COUNT = 100;

// --- Building generation (A5, A6) ---
export const STORY_HEIGHT_BASE = 3.2;
export const STORY_HEIGHT_VARIANCE = 0.5;
export const BUILDING_SIZE_MAP = {
  small:  { widthRange: [5, 8],   depthRange: [6, 10]  },
  medium: { widthRange: [8, 12],  depthRange: [10, 16] },
  large:  { widthRange: [12, 18], depthRange: [15, 22] },
};

// --- LOD thresholds (A10) ---
export const LOD0_DISTANCE = 40;
export const LOD1_DISTANCE = 120;
export const LOD2_DISTANCE = 300;
export const LOD_HYSTERESIS = 2;         // meters buffer to prevent oscillation
export const BUILDINGS_PER_FRAME = 20;   // amortized LOD checks per frame

// --- Gap fill (A8) ---
export const OCCUPANCY_CELL_SIZE = 5;    // meters
export const GAP_FILL_MIN_WIDTH  = 5;
export const GAP_FILL_MIN_DEPTH  = 8;
export const GAP_FILL_MAX_WIDTH  = 15;
export const GAP_FILL_MAX_DEPTH  = 20;

// --- Prop scattering (A9) ---
export const PROP_SPACING_MIN = 8;
export const PROP_SPACING_MAX = 16;

// --- Material palettes ---
export const PALETTE_COLORS = {
  ochre:        0xC89A48,
  faded_red:    0xA35240,
  grey_stone:   0x7A7570,
  worn_plaster: 0xC8B89A,
  white_marble: 0xE8E0D0,
  pale_gold:    0xD8C888,
  rose_marble:  0xD8A0A0,
};

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {Vec3}
 */
export function geoToWorld(lat, lng) { /* A1 linear projection */ }

/**
 * @param {number} x
 * @param {number} z
 * @returns {{ lat: number, lng: number }}
 */
export function worldToGeo(x, z) { /* A1 inverse */ }
```

---

## Module: shared/districts.js

Shared between client and server. Pure data, no Three.js imports.

### Exports

```js
import { geoToWorld } from '../client/venice/venice-config.js';

/** @type {DistrictDefinition[]} */
export const VENICE_DISTRICTS = [
  {
    id: 'rialto',
    name: 'Rialto',
    center: geoToWorld(45.4381, 12.3358),
    boundary: [
      geoToWorld(45.4405, 12.3305),
      geoToWorld(45.4405, 12.3420),
      geoToWorld(45.4355, 12.3420),
      geoToWorld(45.4355, 12.3305),
    ],
    config: {
      buildingHeightRange: [8, 16],
      buildingDecoration: 0.3,
      streetWidth: 2.5,
      canalWidthRange: [5, 10],
      propTypes: ['market_stall', 'crate', 'barrel', 'awning', 'rope_coil'],
      materialPalette: ['ochre', 'faded_red', 'grey_stone', 'worn_plaster'],
      fogTint: 0x8a7a60,
      ambientDensity: 0.8,
    },
  },
  {
    id: 'san_marco',
    name: 'San Marco',
    center: geoToWorld(45.4340, 12.3388),
    boundary: [ /* 4+ vertices */ ],
    config: {
      buildingHeightRange: [12, 22],
      buildingDecoration: 0.9,
      streetWidth: 5.0,
      canalWidthRange: [15, 30],
      propTypes: ['column', 'bench', 'well_head', 'flagpole', 'guard_post'],
      materialPalette: ['white_marble', 'pale_gold', 'rose_marble'],
      fogTint: 0xc0b090,
      ambientDensity: 0.4,
    },
  },
  // castello, dorsoduro, cannaregio, santa_croce, certosa follow same shape
];

/**
 * Point-in-polygon (ray casting). Maps A4.1.
 * @param {number} px
 * @param {number} pz
 * @param {{ x: number, z: number }[]} polygon
 * @returns {boolean}
 */
export function pointInPolygon(px, pz, polygon) { /* ... */ }

/**
 * @param {{ x: number, z: number }} pos
 * @returns {DistrictDefinition|null}
 */
export function findContainingDistrict(pos) { /* ... */ }
```

---

## Module: canal-system.js

Maps ALGORITHM sections A3, A4, A7. Generates canal Bezier paths, then builds water surface, canal wall, and fondamenta geometry.

### Imports

```js
import * as THREE from 'three';
import {
  WATER_Y, FONDAMENTA_HEIGHT, FONDAMENTA_WIDTH,
  CANAL_SAMPLE_COUNT, geoToWorld,
} from './venice-config.js';
import { VENICE_DISTRICTS } from '../../shared/districts.js';
import { seededRandom } from './seed-utils.js';
```

### Exports

```js
/**
 * @typedef {Object} CanalPath
 * @property {THREE.Curve3} path
 * @property {number} width
 * @property {string} districtId
 */

/**
 * @typedef {Object} CanalGeometrySet
 * @property {THREE.Mesh} water          - water surface mesh
 * @property {THREE.Mesh[]} walls        - left + right canal walls
 * @property {THREE.Mesh[]} fondamenta   - left + right walkable strips
 */

/**
 * Grand Canal: cubic Bezier S-curve through Venice. Maps A3.
 * @returns {CanalSample[]}
 */
export function generateGrandCanal() { /* ... */ }

/**
 * Major district canals branching from Grand Canal. Maps A3.
 * @param {DistrictDefinition} district
 * @returns {CanalPath[]}
 */
export function generateDistrictCanals(district) { /* ... */ }

/**
 * Minor canals (rii). Maps A3.
 * @param {DistrictDefinition} district
 * @param {CanalPath[]} majorCanals
 * @returns {CanalPath[]}
 */
export function generateMinorCanals(district, majorCanals) { /* ... */ }

/**
 * Converts a CanalPath into renderable geometry. Maps A4.
 * @param {CanalSample[]} samples
 * @returns {CanalGeometrySet}
 */
export function buildCanalGeometry(samples) { /* ... */ }

/**
 * Sample a CanalPath into evenly-spaced CanalSamples.
 * @param {CanalPath} canal
 * @param {number} [count=CANAL_SAMPLE_COUNT]
 * @returns {CanalSample[]}
 */
export function sampleCanalPath(canal, count) { /* ... */ }
```

### Three.js Specifics

**Water surface**: Built as a `THREE.Mesh` with `THREE.BufferGeometry`. Vertices are interleaved left/right pairs from canal samples. Index buffer creates quads (2 tris per pair). Material is `THREE.MeshStandardMaterial` with:

```js
const waterMaterial = new THREE.MeshStandardMaterial({
  color: 0x1a4a3a,
  metalness: 0.6,
  roughness: 0.2,
  transparent: true,
  opacity: 0.85,
  envMapIntensity: 1.5,
});
// Custom uniform injected for time-based wave animation:
waterMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = { value: 0.0 };
  // Vertex shader: displace Y by sin(position.x * 2.0 + uTime) * 0.03
};
```

Alternatively, use the `Water` addon from Three.js (as in the existing `scene.js`) for canals that face the camera. For narrow rii, the simpler custom material suffices.

**Canal walls**: `THREE.BufferGeometry` triangle strip. Two rows of vertices per side: bottom at `WATER_Y`, top at `WATER_Y + FONDAMENTA_HEIGHT`. Normal faces outward from canal center.

**Fondamenta**: `THREE.BufferGeometry` flat ribbon at `y = FONDAMENTA_HEIGHT`. Each strip is `FONDAMENTA_WIDTH` wide. `userData.walkable = true` is set on the mesh for collision detection.

```js
fondamentaMesh.userData.walkable = true;
fondamentaMesh.receiveShadow = true;
fondamentaMesh.material = new THREE.MeshStandardMaterial({
  color: 0x8a8070,
  roughness: 0.9,
  metalness: 0.02,
});
```

---

## Module: building-generator.js

Maps ALGORITHM sections A5, A6. Generates one Venetian building as a `THREE.Group`.

### Imports

```js
import * as THREE from 'three';
import {
  PALETTE_COLORS, STORY_HEIGHT_BASE, STORY_HEIGHT_VARIANCE,
  BUILDING_SIZE_MAP, FONDAMENTA_HEIGHT,
} from './venice-config.js';
import { seededRandom, hashString } from './seed-utils.js';
```

### Exports

```js
/**
 * @typedef {Object} BuildingParams
 * @property {number} footprintWidth
 * @property {number} footprintDepth
 * @property {[number, number]} stories   - [min, max] story count
 * @property {string} category
 * @property {number} decoration          - 0.0 to 1.0
 * @property {number} seed
 * @property {string[]} palette           - palette key names
 */

/**
 * Generate a full-detail (LOD0) Venetian building. Maps A6.
 * @param {BuildingParams} params
 * @returns {THREE.Group}
 */
export function generateVenetianBuilding(params) { /* ... */ }

/**
 * Generate LOD1: simplified box with correct footprint, height, and color.
 * Mapped from A10 generate_lod1.
 * @param {PlacedBuilding} building
 * @returns {THREE.Mesh}
 */
export function generateBuildingLOD1(building) { /* ... */ }

/**
 * Generate LOD2: billboard plane with silhouette color.
 * Mapped from A10 generate_lod2.
 * @param {PlacedBuilding} building
 * @returns {THREE.Mesh}
 */
export function generateBuildingLOD2(building) { /* ... */ }

/**
 * Convert Airtable size_tier to footprint width. Maps A5.
 * @param {'small'|'medium'|'large'} sizeTier
 * @param {function} rng - seeded random
 * @returns {number}
 */
export function buildingSizeToWidth(sizeTier, rng) { /* ... */ }

/**
 * Convert Airtable size_tier to footprint depth.
 * @param {'small'|'medium'|'large'} sizeTier
 * @param {function} rng
 * @returns {number}
 */
export function buildingSizeToDepth(sizeTier, rng) { /* ... */ }
```

### Geometry Construction Details

Each `generateVenetianBuilding` call produces a `THREE.Group` composed of:

| Child | Geometry | Triangles (typical) |
|---|---|---|
| Ground floor wall | BoxGeometry or custom | 12-50 |
| Door (1) | BoxGeometry + arch ShapeGeometry | 10-30 |
| Upper floor walls (N) | BoxGeometry per story | 12 * N |
| Windows (W per floor) | ShapeGeometry per window | 8-20 * W * N |
| Balconies (optional) | BoxGeometry + CylinderGeometry rails | 20-40 each |
| Stringcourses | BoxGeometry | 12 each |
| Roof | BoxGeometry flat | 12 |
| Chimney pots (1-3) | CylinderGeometry (8 sides) | 16-48 |
| Side/back walls | BoxGeometry | 24 |

Total LOD0 per building: 200-2000 triangles.

**Window styles** use `THREE.ShapeGeometry` for arched and pointed types:

```js
// Arched window (Venetian standard)
function createArchedWindowShape(width, height, archRatio) {
  const shape = new THREE.Shape();
  const archHeight = height * archRatio;
  const bodyHeight = height - archHeight;
  shape.moveTo(-width / 2, 0);
  shape.lineTo(-width / 2, bodyHeight);
  shape.quadraticCurveTo(-width / 2, height, 0, height);
  shape.quadraticCurveTo(width / 2, height, width / 2, bodyHeight);
  shape.lineTo(width / 2, 0);
  shape.closePath();
  return shape;
}
```

**Window material** is shared across all windows in a building. Reference stored in `PlacedBuilding.windowMaterial` for emissive glow control by the atmosphere system:

```js
const windowMaterial = new THREE.MeshStandardMaterial({
  color: 0x1a1a2a,
  roughness: 0.3,
  metalness: 0.1,
  emissive: 0x000000,
  emissiveIntensity: 0.0,
});
```

**Color shifting** from base palette:

```js
function shiftColor(baseHex, hueShift, brightnessShift) {
  const color = new THREE.Color(baseHex);
  const hsl = {};
  color.getHSL(hsl);
  hsl.h = (hsl.h + hueShift + 1.0) % 1.0;
  hsl.l = THREE.MathUtils.clamp(hsl.l + brightnessShift, 0, 1);
  color.setHSL(hsl.h, hsl.s, hsl.l);
  return color;
}
```

---

## Module: occupancy-grid.js

Maps ALGORITHM section A8. 2D grid for gap-fill building placement.

### Exports

```js
/**
 * @typedef {Object} EmptyLot
 * @property {number} x      - world X of lot center
 * @property {number} z      - world Z of lot center
 * @property {number} width
 * @property {number} depth
 */

export class OccupancyGrid {
  /**
   * @param {{ x: number, z: number }[]} boundary - district polygon
   * @param {number} cellSize - meters per cell (default 5)
   */
  constructor(boundary, cellSize) { /* ... */ }

  /**
   * Mark cells occupied by a building footprint.
   * @param {{ center: THREE.Vector3, width: number, depth: number }} footprint
   */
  markOccupied(footprint) { /* ... */ }

  /**
   * Mark cells covered by water (canal ribbons).
   * @param {CanalSample[]} ribbon
   */
  markWater(ribbon) { /* ... */ }

  /**
   * Find rectangular empty regions suitable for gap-fill buildings.
   * @param {{ minWidth: number, minDepth: number, maxWidth: number, maxDepth: number }} constraints
   * @returns {EmptyLot[]}
   */
  findEmptyRectangles(constraints) { /* ... */ }
}
```

Internal representation: a `Uint8Array` where 0 = empty, 1 = occupied, 2 = water. Grid dimensions derived from district bounding box divided by `cellSize`.

---

## Module: props.js

Maps ALGORITHM section A9. Generates low-poly district props.

### Exports

```js
/**
 * @param {object} goodsType - from Airtable building current_goods
 * @returns {THREE.Group} - ~50 triangles
 */
export function generateMarketStall(goodsType) { /* ... */ }

/**
 * @returns {THREE.Group} - hull + ferro + forcola, ~100 triangles
 */
export function generateGondola() { /* ... */ }

/**
 * @returns {THREE.Group} - octagonal housing + candle + PointLight, ~30 tris
 */
export function generateLantern() { /* ... */ }

/**
 * @returns {THREE.Mesh} - BoxGeometry with wood material, ~12 triangles
 */
export function generateCrate() { /* ... */ }

/**
 * Scatter props along fondamenta segments for a district. Maps A9.
 * @param {DistrictDefinition} district
 * @param {THREE.Mesh[]} fondamentaSegments
 * @param {PlacedBuilding[]} buildings
 * @returns {THREE.Group[]}
 */
export function scatterProps(district, fondamentaSegments, buildings) { /* ... */ }
```

**Lantern PointLight** parameters:

```js
const light = new THREE.PointLight(0xffaa44, 0.6, 8);
// intensity: 0.6, distance: 8m falloff
// Flicker handled in per-frame update: intensity = 0.5 + sin(t * 3 + seed) * 0.15
```

**Gondola hull**: `THREE.ExtrudeGeometry` from an elliptical `THREE.Shape`:

```js
const hullShape = new THREE.Shape();
hullShape.ellipse(0, 0, 5.0, 0.7, 0, Math.PI * 2);
const hullGeom = new THREE.ExtrudeGeometry(hullShape, { depth: 0.4, bevelEnabled: false });
```

---

## Module: lod-manager.js

Maps ALGORITHM section A10. Manages LOD transitions across all buildings with amortized per-frame processing.

### Exports

```js
export class LODManager {
  /**
   * @param {PlacedBuilding[]} buildings
   * @param {THREE.Scene} scene
   */
  constructor(buildings, scene) { /* ... */ }

  /**
   * Process up to BUILDINGS_PER_FRAME LOD transitions. Call once per frame.
   * @param {THREE.Vector3} visitorPosition
   */
  update(visitorPosition) { /* ... */ }

  /**
   * Force all buildings to a specific LOD (for debugging/testing).
   * @param {number} lod - -1, 0, 1, or 2
   */
  forceAllLOD(lod) { /* ... */ }

  /**
   * Dispose all cached LOD geometry. Call on world unload.
   */
  dispose() { /* ... */ }
}
```

### LOD Transition Logic

Distance thresholds with hysteresis to prevent oscillation:

```
LOD0 -> LOD1:  at LOD0_DISTANCE + LOD_HYSTERESIS  (42m)
LOD1 -> LOD0:  at LOD0_DISTANCE - LOD_HYSTERESIS  (38m)
LOD1 -> LOD2:  at LOD1_DISTANCE + LOD_HYSTERESIS  (122m)
LOD2 -> LOD1:  at LOD1_DISTANCE - LOD_HYSTERESIS  (118m)
LOD2 -> hidden: at LOD2_DISTANCE + LOD_HYSTERESIS (302m)
hidden -> LOD2: at LOD2_DISTANCE - LOD_HYSTERESIS (298m)
```

Cache strategy: each `PlacedBuilding.lodCache` holds `[lod0Mesh, lod1Mesh, lod2Mesh]`. LOD0 is generated during `place_buildings()`. LOD1 and LOD2 are generated lazily on first transition. Cache entries are NOT disposed until the building itself is unloaded. `renderer.info.memory.geometries` is monitored; if it exceeds 5000, evict LOD2 cache entries for buildings > 400m away.

---

## Module: district-generator.js

Maps ALGORITHM section A11 (master pipeline) and A12 (per-frame update). Top-level orchestrator.

### Imports

```js
import * as THREE from 'three';
import { VENICE_DISTRICTS, findContainingDistrict } from '../../shared/districts.js';
import { generateGrandCanal, generateDistrictCanals, generateMinorCanals, sampleCanalPath, buildCanalGeometry } from './canal-system.js';
import { generateVenetianBuilding, buildingSizeToWidth, buildingSizeToDepth } from './building-generator.js';
import { OccupancyGrid } from './occupancy-grid.js';
import { scatterProps } from './props.js';
import { LODManager } from './lod-manager.js';
import { geoToWorld, FONDAMENTA_HEIGHT, FONDAMENTA_WIDTH } from './venice-config.js';
import { hashString, seededRandom } from './seed-utils.js';
```

### Exports

```js
/**
 * One-time world generation. Maps A11.
 * @param {AirtableBuildingRecord[]} airtableBuildings
 * @returns {VeniceState}
 */
export function generateVenice(airtableBuildings) { /* ... */ }

/**
 * Per-frame update: LOD, water animation, lantern flicker, boat bob. Maps A12.
 * @param {VeniceState} veniceState
 * @param {THREE.Vector3} visitorPosition
 * @param {number} elapsedTime - seconds since start
 * @param {number} deltaTime   - seconds since last frame
 */
export function updateDistricts(veniceState, visitorPosition, elapsedTime, deltaTime) { /* ... */ }

/**
 * Place buildings from Airtable data. Maps A5.
 * @param {AirtableBuildingRecord[]} records
 * @param {DistrictDefinition[]} districts
 * @param {CanalPath[]} allCanals
 * @returns {PlacedBuilding[]}
 */
export function placeBuildings(records, districts, allCanals) { /* ... */ }

/**
 * Fill empty lots with procedural buildings. Maps A8.
 * @param {DistrictDefinition} district
 * @param {PlacedBuilding[]} placed
 * @param {CanalPath[]} canals
 * @returns {PlacedBuilding[]}
 */
export function fillBuildingGaps(district, placed, canals) { /* ... */ }

/**
 * Generate bridges across all canals. Maps A7.
 * @param {CanalPath[]} canals
 * @returns {THREE.Group[]}
 */
export function generateBridges(canals) { /* ... */ }
```

### generateVenice Pipeline (A11)

```
1. districts       = VENICE_DISTRICTS
2. grandCanal      = generateGrandCanal()
3. districtCanals  = districts.map(d => generateDistrictCanals(d))
4. allCanals       = [grandCanal, ...districtCanals.flat()]
5. canalGeometry   = allCanals.map(c => buildCanalGeometry(sampleCanalPath(c)))
6. placed          = placeBuildings(airtableBuildings, districts, allCanals)
7. For each district: placed.push(...fillBuildingGaps(district, placed, canals))
8. bridges         = generateBridges(allCanals)
9. props           = districts.flatMap(d => scatterProps(d, fondamenta, placed))
10. collisionMesh  = mergeWalkableSurfaces(canalGeometry, bridges)
11. lodManager     = new LODManager(placed, scene)
12. Return VeniceState
```

### updateDistricts Per-Frame (A12)

```
1. lodManager.update(visitorPosition)                 // amortized, N buildings/frame
2. For each canal water mesh: material.uniforms.uTime.value = elapsed * 0.5
3. For each lantern prop: light.intensity = 0.5 + sin(elapsed * 3 + seed) * 0.15
4. For each boat prop: position.y = 0.1 + sin(elapsed * 0.8 + seed) * 0.05
                        rotation.z = sin(elapsed * 0.5 + seed) * 0.03
```

---

## Module: seed-utils.js (NEW utility)

Deterministic randomness. No `Math.random()` allowed in the generation pipeline.

```js
/**
 * Hash a string to a 32-bit integer.
 * @param {string} str
 * @returns {number}
 */
export function hashString(str) { /* FNV-1a or similar */ }

/**
 * Hash two numbers to a float in [0, 1).
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function hash2D(x, y) { /* same as scene.js hash2D */ }

/**
 * Create a seeded PRNG (Mulberry32 or SplitMix32).
 * @param {number} seed
 * @returns {() => number} - returns float in [0, 1) on each call
 */
export function seededRandom(seed) { /* ... */ }

/**
 * @param {[number, number]} range
 * @param {() => number} rng
 * @returns {number}
 */
export function randomInRange(range, rng) {
  return range[0] + rng() * (range[1] - range[0]);
}
```

---

## Integration: main.js Modifications

### New Imports

```js
import { generateVenice, updateDistricts } from './venice/district-generator.js';
```

### Scene Setup (after existing environment creation)

```js
// ── Venice World (when Airtable data is available) ──
let veniceState = null;

async function initVenice() {
  try {
    const res = await fetch('/api/venice/buildings');
    const buildings = await res.json();
    veniceState = generateVenice(buildings);
    // Add all geometry groups to scene
    for (const cg of veniceState.canals) {
      scene.add(cg.water);
      cg.walls.forEach(w => scene.add(w));
      cg.fondamenta.forEach(f => scene.add(f));
    }
    for (const b of veniceState.buildings) scene.add(b.mesh);
    for (const br of veniceState.bridges) scene.add(br);
    for (const p of veniceState.props) scene.add(p);
  } catch (e) {
    console.warn('Venice data not available, running island-only mode');
  }
}

initVenice();
```

### Render Loop Addition

```js
// Inside renderer.setAnimationLoop:
if (veniceState) {
  const playerPos = renderer.xr.isPresenting ? nicolasAvatar.position : camera.position;
  updateDistricts(veniceState, playerPos, elapsed, delta);
}
```

---

## Integration: scene.js Modifications

No structural changes. The existing `createEnvironment` continues to produce islands. Venice geometry lives in the `venice/` module tree and is added to the same scene. The shared water plane from `scene.js` serves as the lagoon under Venice canals (the canal water meshes sit at `y = 0` on top of it).

---

## Bridge Geometry (A7 Detail)

```js
function generateBridgeMesh(span, width, archHeight) {
  const group = new THREE.Group();

  // Parabolic arch deck
  const STEPS = 20;
  const vertices = [];
  const indices = [];

  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const x = (t - 0.5) * span;
    const y = archHeight * (1 - Math.pow(2 * t - 1, 2));

    // Left edge and right edge
    vertices.push(x, y, -width / 2);
    vertices.push(x, y,  width / 2);

    if (i > 0) {
      const base = (i - 1) * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }

  const deckGeom = new THREE.BufferGeometry();
  deckGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  deckGeom.setIndex(indices);
  deckGeom.computeVertexNormals();

  const deckMesh = new THREE.Mesh(deckGeom, new THREE.MeshStandardMaterial({
    color: 0x8a8070,
    roughness: 0.9,
  }));
  deckMesh.userData.walkable = true;
  group.add(deckMesh);

  // Parapets: thin boxes along each edge, following the arch
  // ... (omitted for brevity, same vertex positions offset in Y by 0.7m)

  return group;
}
```

---

## Collision Mesh Construction

The collision mesh is a merged `THREE.BufferGeometry` from all fondamenta strips and bridge decks. It is NOT rendered (visible = false). Used exclusively for raycasting.

```js
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function mergeWalkableSurfaces(canalGeometries, bridges) {
  const geometries = [];

  for (const cg of canalGeometries) {
    for (const f of cg.fondamenta) {
      const cloned = f.geometry.clone();
      cloned.applyMatrix4(f.matrixWorld);
      geometries.push(cloned);
    }
  }

  for (const bridge of bridges) {
    bridge.traverse((child) => {
      if (child.isMesh && child.userData.walkable) {
        const cloned = child.geometry.clone();
        cloned.applyMatrix4(child.matrixWorld);
        geometries.push(cloned);
      }
    });
  }

  const merged = mergeGeometries(geometries, false);
  const collisionMesh = new THREE.Mesh(merged);
  collisionMesh.visible = false;
  collisionMesh.userData.walkable = true;
  return collisionMesh;
}
```

---

## Server-Side: serenissima-sync.js

Maps the sync strategy from `06_IMPLEMENTATION_Venezia.md`. Runs every 15 minutes.

```js
import Airtable from 'airtable';

const SYNC_INTERVAL_MS = 15 * 60 * 1000;

export class SerenissimaSync {
  constructor(veniceState, wsBroadcast) { /* ... */ }

  async sync() {
    const citizens = await this._fetchTable('CITIZENS');
    const buildings = await this._fetchTable('BUILDINGS');
    const contracts = await this._fetchTable('CONTRACTS');
    const activities = await this._fetchTable('ACTIVITIES');
    const relationships = await this._fetchTable('RELATIONSHIPS');

    const diff = this._computeDiff(buildings);
    this.veniceState.update(citizens, buildings);

    if (diff.changed.length > 0) {
      this.wsBroadcast({
        type: 'citizen_update',
        data: diff.changed,
      });
    }
  }

  start() {
    this.sync();
    setInterval(() => this.sync(), SYNC_INTERVAL_MS);
  }
}
```

---

## Environment Variables

```
AIRTABLE_API_KEY       - Airtable personal access token
AIRTABLE_BASE_ID       - Serenissima base ID (appkLmnbsEFAZM5rB)
VENICE_SYNC_INTERVAL   - Override sync interval (default 900000 ms)
VENICE_ENABLED         - Set to "false" to skip Venice generation (island-only mode)
```

---

## Configuration Files

### data/district-overrides.json (optional)

Runtime overrides for district configs. Loaded by `venice-config.js` at startup. Allows tuning without code changes.

```json
{
  "rialto": {
    "buildingDecoration": 0.4,
    "ambientDensity": 0.9
  }
}
```

---

## Import Graph

```
main.js
  +-- venice/district-generator.js
  |     +-- venice/canal-system.js
  |     |     +-- venice/venice-config.js
  |     |     +-- venice/seed-utils.js
  |     |     +-- shared/districts.js
  |     +-- venice/building-generator.js
  |     |     +-- venice/venice-config.js
  |     |     +-- venice/seed-utils.js
  |     +-- venice/occupancy-grid.js
  |     +-- venice/props.js
  |     |     +-- venice/venice-config.js
  |     +-- venice/lod-manager.js
  |     |     +-- venice/venice-config.js
  |     |     +-- venice/building-generator.js
  |     +-- shared/districts.js
  +-- scene.js
  |     +-- shared/zones.js   (existing, unchanged)
  +-- zone-ambient.js
        +-- shared/zones.js
```

Server side:

```
server/index.js
  +-- server/venice-state.js
  +-- server/serenissima-sync.js
  |     +-- shared/districts.js
  +-- server/citizen-router.js
  +-- server/physics-bridge.js
```

---

## Performance Constraints

| Constraint | Target | Enforcement |
|---|---|---|
| LOD0 triangles in view | < 60K | LODManager radius contraction |
| LOD1 draw calls | < 7 | InstancedMesh per district (all LOD1 buildings share 1 BoxGeometry) |
| LOD2 draw calls | < 7 | InstancedMesh per district |
| Total draw calls | < 200 | Geometry merging, atlas textures |
| Collision mesh vertices | < 50K | Simplified fondamenta strips (low segment count) |
| Generation time | < 5s for one district | Lazy gap-fill, deferred LOD cache |
| Memory (Quest 3) | < 512MB JS heap | LOD cache eviction at 5000 geometries |

### InstancedMesh for LOD1 and LOD2

All LOD1 buildings within a district share a single `THREE.BoxGeometry(1, 1, 1)`. Per-instance transforms encode position, footprint scale, and height. Per-instance color via `InstancedBufferAttribute`:

```js
const lod1Geometry = new THREE.BoxGeometry(1, 1, 1);
const lod1Material = new THREE.MeshStandardMaterial({ roughness: 0.85 });
const instanceCount = districtBuildings.length;
const instancedMesh = new THREE.InstancedMesh(lod1Geometry, lod1Material, instanceCount);

const matrix = new THREE.Matrix4();
const color = new THREE.Color();

districtBuildings.forEach((building, i) => {
  matrix.makeScale(building.footprintWidth, building.totalHeight, building.footprintDepth);
  matrix.setPosition(
    building.position.x,
    building.position.y + building.totalHeight / 2,
    building.position.z
  );
  instancedMesh.setMatrixAt(i, matrix);
  instancedMesh.setColorAt(i, color.setHex(building.baseColor));
});

instancedMesh.instanceMatrix.needsUpdate = true;
instancedMesh.instanceColor.needsUpdate = true;
```

This reduces LOD1 draw calls from N buildings to 1 call per district (7 districts = 7 draw calls).

---

## Determinism Guarantee

All procedural generation uses `seededRandom(seed)` where `seed` is derived from Airtable record IDs or district IDs via `hashString()`. The generation pipeline makes zero calls to `Math.random()`. Given identical Airtable data + district definitions, `generateVenice()` produces byte-identical geometry on every invocation.
