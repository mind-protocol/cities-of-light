# IMPLEMENTATION: world/navigation -- Code Architecture

Exact file paths, exported APIs, WebXR specifics, collision implementation, event system, and configuration. Maps ALGORITHM pseudocode to concrete JavaScript modules. A developer should be able to start coding from this document alone.

---

## File Map

```
src/
  client/
    navigation/
      desktop-controls.js       NEW   WASD + mouse pointer lock movement
      collision-system.js        NEW   Ground raycasts, wall slides, water barrier
      district-transition.js     NEW   Boundary detection, fog gate trigger, audio crossfade
      gondola-system.js          NEW   Dock proximity, boarding, spline travel, disembark
      bridge-traversal.js        NEW   Bridge surface detection, navmesh connectivity
      comfort-system.js          NEW   VR vignette, screen fade, height calibration
      nav-controller.js          NEW   Master coordinator, per-frame dispatch
    vr-controls.js               MODIFY Extract collision integration, add teleport arc
    main.js                      MODIFY Replace inline WASD with nav-controller
  shared/
    districts.js                 EXISTING Point-in-polygon, district boundary data
```

---

## Data Structures

### Collision World

```js
/**
 * @typedef {Object} CollisionWorld
 * @property {THREE.Mesh[]} fondamenta       - walkable canal-side paths
 * @property {THREE.Mesh[]} bridges          - walkable arched bridge decks
 * @property {THREE.Mesh[]} piazzas          - large open walkable areas
 * @property {THREE.Mesh[]} buildingWalls    - vertical faces for horizontal collision
 * @property {THREE.Mesh[]} bridgeParapets   - low walls on bridge edges
 * @property {THREE.Mesh} waterSurface       - for teleport rejection
 * @property {THREE.Raycaster} _walkableRaycaster - reused raycaster instance
 * @property {THREE.Raycaster} _wallRaycaster     - reused raycaster instance
 * @property {THREE.Object3D[]} _walkableGroup    - flat array for raycaster.intersectObjects
 * @property {THREE.Object3D[]} _wallGroup         - flat array for raycaster.intersectObjects
 */
```

### Visitor State

```js
/**
 * @typedef {Object} VisitorState
 * @property {THREE.Vector3} position          - world position (ground level)
 * @property {THREE.Vector3} lastValidPosition - most recent position on walkable surface
 * @property {number} yaw                      - radians, horizontal rotation (desktop)
 * @property {number} pitch                    - radians, vertical rotation (desktop)
 * @property {boolean} pointerLocked
 * @property {boolean} isVR
 * @property {boolean} locomotionDisabled       - true during gondola ride
 * @property {string|null} currentDistrictId
 */
```

### Gondola Instance

```js
/**
 * @typedef {Object} GondolaInstance
 * @property {GondolaRoute} route
 * @property {THREE.Group} mesh
 * @property {number} t                   - 0.0 to 1.0 along spline
 * @property {GondolaState} state
 */

/** @enum {string} */
const GondolaState = {
  IDLE: 'IDLE',
  BOARDING: 'BOARDING',
  MOVING: 'MOVING',
  ARRIVING: 'ARRIVING',
  DISEMBARKING: 'DISEMBARKING',
};
```

### Gondola Route

```js
/**
 * @typedef {Object} GondolaRoute
 * @property {string} id
 * @property {string} originDock
 * @property {string} destinationDock
 * @property {THREE.CatmullRomCurve3} spline
 * @property {number} totalLength       - meters
 * @property {number} duration          - seconds at GONDOLA_SPEED
 */
```

### Gondola Dock

```js
/**
 * @typedef {Object} GondolaDock
 * @property {string} id
 * @property {THREE.Vector3} position
 * @property {string} district
 * @property {number} triggerRadius
 * @property {string[]} linkedRoutes
 */
```

### Bridge Connection

```js
/**
 * @typedef {Object} BridgeConnection
 * @property {string} bridgeId
 * @property {string} fondamentaA
 * @property {string} fondamentaB
 * @property {number} peakHeight
 * @property {string} districtA
 * @property {string} districtB
 */
```

### Position Transition (smooth animation)

```js
/**
 * @typedef {Object} PositionTransition
 * @property {THREE.Vector3} from
 * @property {THREE.Vector3} to
 * @property {number} elapsed     - seconds
 * @property {number} duration    - seconds
 * @property {Function|null} onComplete
 */
```

### Screen Fade

```js
/**
 * @typedef {Object} ScreenFade
 * @property {number} opacity
 * @property {number} target       - 0.0 (clear) or 1.0 (black)
 * @property {number} duration     - seconds
 * @property {number} elapsed
 * @property {Function|null} onComplete
 * @property {boolean} active
 */
```

---

## Module: navigation/desktop-controls.js

Maps ALGORITHM sections A1.1, A1.2. Desktop WASD + mouse pointer lock. Replaces the inline WASD handler in `main.js`.

### Constants

```js
export const WALK_SPEED       = 2.5;       // meters per second
export const RUN_SPEED        = 3.75;      // 1.5x walk (Shift held)
export const MOUSE_SENSITIVITY = 0.002;    // radians per pixel
export const PITCH_MIN        = -Math.PI / 3;
export const PITCH_MAX        = Math.PI / 3;
```

### Exports

```js
import * as THREE from 'three';

export class DesktopControls {
  /**
   * @param {HTMLElement} domElement - renderer.domElement
   */
  constructor(domElement) {
    this.yaw = 0;
    this.pitch = 0;
    this.keysHeld = new Set();
    this.shiftHeld = false;
    this.pointerLocked = false;

    this._domElement = domElement;
    this._bindEvents();
  }

  /**
   * Compute world-space displacement vector for this frame. Maps A1.2.
   * @param {number} deltaTime - seconds
   * @returns {THREE.Vector3} - horizontal displacement in world space
   */
  computeMovement(deltaTime) { /* ... */ }

  /**
   * Apply yaw/pitch to a camera. Call after position is updated.
   * @param {THREE.PerspectiveCamera} camera
   * @param {THREE.Vector3} groundPosition - visitor position at ground level
   * @param {number} eyeHeight
   */
  applyToCamera(camera, groundPosition, eyeHeight) {
    camera.position.set(groundPosition.x, groundPosition.y + eyeHeight, groundPosition.z);
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  /** Unbind all event listeners. */
  dispose() { /* ... */ }

  // --- Private ---

  _bindEvents() {
    this._onMouseMove = (e) => {
      if (!this.pointerLocked) return;
      this.yaw -= e.movementX * MOUSE_SENSITIVITY;
      this.pitch -= e.movementY * MOUSE_SENSITIVITY;
      this.pitch = THREE.MathUtils.clamp(this.pitch, PITCH_MIN, PITCH_MAX);
    };

    this._onKeyDown = (e) => {
      this.keysHeld.add(e.code.toLowerCase());
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.shiftHeld = true;
    };

    this._onKeyUp = (e) => {
      this.keysHeld.delete(e.code.toLowerCase());
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.shiftHeld = false;
    };

    this._onClick = () => {
      if (!this.pointerLocked) {
        this._domElement.requestPointerLock();
      }
    };

    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    this._domElement.addEventListener('click', this._onClick);
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = (document.pointerLockElement === this._domElement);
    });
  }
}
```

### computeMovement Implementation

```js
computeMovement(deltaTime) {
  const input = new THREE.Vector3(0, 0, 0);
  if (this.keysHeld.has('keyw') || this.keysHeld.has('arrowup'))    input.z -= 1;
  if (this.keysHeld.has('keys') || this.keysHeld.has('arrowdown'))  input.z += 1;
  if (this.keysHeld.has('keya') || this.keysHeld.has('arrowleft'))  input.x -= 1;
  if (this.keysHeld.has('keyd') || this.keysHeld.has('arrowright')) input.x += 1;

  if (input.lengthSq() < 0.001) return input;
  input.normalize();

  const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  const right   = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  const worldDir = new THREE.Vector3()
    .addScaledVector(forward, input.z)
    .addScaledVector(right, input.x)
    .normalize();

  const speed = this.shiftHeld ? RUN_SPEED : WALK_SPEED;
  return worldDir.multiplyScalar(speed * deltaTime);
}
```

---

## Module: navigation/collision-system.js

Maps ALGORITHM sections A1.3, A3, A3.2, A3.3, A3.4. Handles ground raycasts, wall slides, water barrier, and fall recovery.

### Constants

```js
export const RAYCAST_HEIGHT     = 5.0;
export const RAYCAST_MAX_DIST   = 7.0;
export const STEP_HEIGHT        = 0.3;
export const VISITOR_RADIUS     = 0.3;
export const VISITOR_EYE_HEIGHT = 1.65;
export const FALL_THRESHOLD     = -2.0;
export const RECOVERY_SEARCH_RADIUS = 15.0;
export const WATER_Y            = 0.0;
export const FONDAMENTA_HEIGHT  = 0.8;
```

### Exports

```js
import * as THREE from 'three';

export class CollisionSystem {
  /**
   * Build collision data from generated Venice geometry. Maps A3.1.
   * @param {VeniceState} veniceState
   * @returns {CollisionWorld}
   */
  static buildCollisionWorld(veniceState) { /* ... */ }

  /**
   * @param {CollisionWorld} world
   */
  constructor(world) {
    this._world = world;
    this._raycaster = new THREE.Raycaster();
    this._probeOrigin = new THREE.Vector3();
    this._probeDir = new THREE.Vector3();
  }

  /**
   * Full collision pipeline: wall slide + water barrier + ground snap.
   * Maps the combined A1.3 + A3.2 + A3.3 logic.
   *
   * @param {THREE.Vector3} fromPos       - current position (ground level)
   * @param {THREE.Vector3} displacement  - desired movement vector
   * @returns {{ position: THREE.Vector3, onGround: boolean }}
   */
  resolveMovement(fromPos, displacement) { /* ... */ }

  /**
   * Validate a teleport landing point. Used by teleport arc.
   * @param {THREE.Vector3} point
   * @returns {boolean} - true if point is on walkable surface
   */
  isValidLanding(point) { /* ... */ }

  /**
   * Check if visitor has fallen through geometry. Maps A3.4.
   * @param {THREE.Vector3} position
   * @returns {THREE.Vector3|null} - recovery position, or null if fine
   */
  checkFallRecovery(position) { /* ... */ }

  /**
   * Get default spawn point (Rialto fondamenta).
   * @returns {THREE.Vector3}
   */
  getDefaultSpawnPosition() { /* ... */ }

  // --- Private ---

  /**
   * Horizontal wall collision with slide. Maps A3.3.
   * @param {THREE.Vector3} from
   * @param {THREE.Vector3} to
   * @returns {THREE.Vector3}
   */
  _resolveWallCollision(from, to) { /* ... */ }

  /**
   * Prevent walking over water. Maps A3.2.
   * @param {THREE.Vector3} from
   * @param {THREE.Vector3} to
   * @returns {THREE.Vector3}
   */
  _enforceWaterBarrier(from, to) { /* ... */ }

  /**
   * Downward raycast to find walkable surface.
   * @param {THREE.Vector3} pos
   * @returns {THREE.Intersection|null}
   */
  _groundRaycast(pos) { /* ... */ }
}
```

### resolveMovement Implementation

```js
resolveMovement(fromPos, displacement) {
  if (displacement.lengthSq() < 0.00001) {
    return { position: fromPos.clone(), onGround: true };
  }

  let proposed = fromPos.clone().add(displacement);

  // 1. Wall collision (horizontal)
  proposed = this._resolveWallCollision(fromPos, proposed);

  // 2. Water barrier
  proposed = this._enforceWaterBarrier(fromPos, proposed);

  // 3. Ground raycast (vertical)
  const hit = this._groundRaycast(proposed);

  if (hit) {
    const groundY = hit.point.y;
    const heightDiff = groundY - fromPos.y;

    if (heightDiff > STEP_HEIGHT) {
      // Too high -- re-resolve as wall
      proposed = this._resolveWallCollision(fromPos, proposed);
      const retryHit = this._groundRaycast(proposed);
      if (retryHit) {
        return { position: new THREE.Vector3(proposed.x, retryHit.point.y, proposed.z), onGround: true };
      }
      return { position: fromPos.clone(), onGround: true };
    }

    return { position: new THREE.Vector3(proposed.x, groundY, proposed.z), onGround: true };
  }

  // No ground -- clamp to last valid
  return { position: fromPos.clone(), onGround: false };
}
```

### _resolveWallCollision Implementation

```js
_resolveWallCollision(from, to) {
  const moveDir = new THREE.Vector3(to.x - from.x, 0, to.z - from.z);
  const moveDist = moveDir.length();
  if (moveDist < 0.001) return to.clone();
  moveDir.normalize();

  // Three probe rays: center, front-right, front-left
  const probes = [
    moveDir.clone(),
    moveDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * 0.3),
    moveDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI * 0.3),
  ];

  let closestDist = Infinity;
  let wallNormal = null;

  this._probeOrigin.set(from.x, from.y + 0.5, from.z);

  for (const probeDir of probes) {
    this._raycaster.set(this._probeOrigin, probeDir);
    this._raycaster.far = moveDist + VISITOR_RADIUS;
    const hits = this._raycaster.intersectObjects(this._world._wallGroup, false);
    if (hits.length > 0 && hits[0].distance < closestDist) {
      closestDist = hits[0].distance;
      wallNormal = hits[0].face.normal.clone();
      wallNormal.y = 0;
      wallNormal.normalize();
    }
  }

  if (!wallNormal) return to.clone();

  // Slide: remove wall-penetrating component
  const disp = new THREE.Vector3(to.x - from.x, 0, to.z - from.z);
  const dot = disp.dot(wallNormal);
  if (dot < 0) {
    disp.addScaledVector(wallNormal, -dot);
  }

  return new THREE.Vector3(from.x + disp.x, to.y, from.z + disp.z);
}
```

### _enforceWaterBarrier Implementation

```js
_enforceWaterBarrier(from, to) {
  const hit = this._groundRaycast(to);
  if (hit) return to.clone(); // ground exists

  // No ground -- find nearest walkable edge
  const SAMPLE_COUNT = 8;
  let bestEdge = null;
  let bestDist = 3.0; // max search radius

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const angle = (i / SAMPLE_COUNT) * Math.PI * 2;
    this._probeOrigin.set(
      to.x + Math.cos(angle) * 0.5,
      to.y + RAYCAST_HEIGHT,
      to.z + Math.sin(angle) * 0.5
    );
    this._raycaster.set(this._probeOrigin, new THREE.Vector3(0, -1, 0));
    this._raycaster.far = RAYCAST_MAX_DIST;
    const hits = this._raycaster.intersectObjects(this._world._walkableGroup, false);
    if (hits.length > 0) {
      const dist = new THREE.Vector2(to.x - hits[0].point.x, to.z - hits[0].point.z).length();
      if (dist < bestDist) {
        bestDist = dist;
        bestEdge = hits[0].point;
      }
    }
  }

  if (!bestEdge) return from.clone();

  // Slide along edge
  // ... (compute edge tangent and project displacement, see A3.2)
  return from.clone(); // fallback
}
```

### Static buildCollisionWorld

```js
static buildCollisionWorld(veniceState) {
  const world = {
    fondamenta: [],
    bridges: [],
    piazzas: [],
    buildingWalls: [],
    bridgeParapets: [],
    waterSurface: null,
    _walkableGroup: [],
    _wallGroup: [],
  };

  for (const cg of veniceState.canals) {
    for (const f of cg.fondamenta) {
      f.userData.walkable = true;
      world.fondamenta.push(f);
      world._walkableGroup.push(f);
    }
  }

  for (const bridge of veniceState.bridges) {
    bridge.traverse((child) => {
      if (child.isMesh && child.userData.walkable) {
        world.bridges.push(child);
        world._walkableGroup.push(child);
      }
      if (child.isMesh && child.userData.parapet) {
        world.bridgeParapets.push(child);
        world._wallGroup.push(child);
      }
    });
  }

  for (const building of veniceState.buildings) {
    // Extract AABB walls from building bounding box
    const box = new THREE.Box3().setFromObject(building.mesh);
    const walls = createAABBWallMeshes(box);
    world.buildingWalls.push(...walls);
    world._wallGroup.push(...walls);
  }

  return world;
}
```

Wall meshes from AABBs are invisible `THREE.Mesh` objects with `THREE.PlaneGeometry` oriented on each vertical face of the bounding box. They exist solely for raycasting:

```js
function createAABBWallMeshes(box) {
  const walls = [];
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  // Front and back (Z faces)
  for (const zSign of [-1, 1]) {
    const plane = new THREE.PlaneGeometry(size.x, size.y);
    const mesh = new THREE.Mesh(plane);
    mesh.position.set(center.x, center.y, center.z + zSign * size.z / 2);
    if (zSign === -1) mesh.rotation.y = Math.PI;
    mesh.visible = false;
    mesh.updateMatrixWorld(true);
    walls.push(mesh);
  }

  // Left and right (X faces)
  for (const xSign of [-1, 1]) {
    const plane = new THREE.PlaneGeometry(size.z, size.y);
    const mesh = new THREE.Mesh(plane);
    mesh.position.set(center.x + xSign * size.x / 2, center.y, center.z);
    mesh.rotation.y = xSign * Math.PI / 2;
    mesh.visible = false;
    mesh.updateMatrixWorld(true);
    walls.push(mesh);
  }

  return walls;
}
```

---

## Module: navigation/district-transition.js

Maps ALGORITHM section A4.

### Constants

```js
export const HYSTERESIS_DISTANCE = 10.0;
export const ZONE_CHECK_INTERVAL = 10;   // frames between checks
export const FOG_GATE_DURATION   = 3.0;
export const AUDIO_CROSSFADE_DURATION = 2.0;
export const AUDIO_OVERLAP_FACTOR     = 0.3;
```

### Exports

```js
import { findContainingDistrict } from '../../shared/districts.js';

export class DistrictTransitionSystem {
  constructor() {
    this.currentDistrict = null;
    this._transitionLocked = false;
    this._lockEntryPoint = new THREE.Vector3();
    this._frameCounter = 0;

    /** @type {Map<string, { source: AudioBufferSourceNode, volume: number, target: number }>} */
    this._activeAudio = new Map();

    /** @type {Function|null} */
    this.onDistrictChanged = null;
  }

  /**
   * Check for district transition. Call each frame.
   * @param {THREE.Vector3} position
   */
  update(position) { /* A4.1 */ }

  /**
   * Update audio crossfade volumes. Call each frame.
   * @param {number} deltaTime
   */
  updateAudio(deltaTime) { /* A4.3 */ }

  /**
   * @returns {string|null}
   */
  getCurrentDistrictId() { return this.currentDistrict; }
}
```

### District Detection (A4.1)

```js
update(position) {
  this._frameCounter++;
  if (this._frameCounter % ZONE_CHECK_INTERVAL !== 0) return;

  const detected = findContainingDistrict({ x: position.x, z: position.z });
  const detectedId = detected ? detected.id : null;

  if (detectedId === this.currentDistrict) {
    // Check hysteresis release
    if (this._transitionLocked) {
      const dist = position.distanceTo(this._lockEntryPoint);
      if (dist >= HYSTERESIS_DISTANCE) {
        this._transitionLocked = false;
      }
    }
    return;
  }

  if (this._transitionLocked) return;

  const previousDistrict = this.currentDistrict;
  this.currentDistrict = detectedId;
  this._lockEntryPoint.copy(position);
  this._transitionLocked = true;

  // Trigger transition
  if (this.onDistrictChanged) {
    this.onDistrictChanged(previousDistrict, detectedId);
  }
  this._startAudioCrossfade(previousDistrict, detectedId);
}
```

### Audio Crossfade (A4.3)

District ambient audio is loaded as `AudioBuffer` objects. Each district has a unique ambient loop (water lapping, market noise, shipyard hammering, etc.).

```js
const DISTRICT_AUDIO_URLS = {
  rialto: '/audio/ambient/rialto.ogg',
  san_marco: '/audio/ambient/san_marco.ogg',
  castello: '/audio/ambient/castello.ogg',
  dorsoduro: '/audio/ambient/dorsoduro.ogg',
  cannaregio: '/audio/ambient/cannaregio.ogg',
  santa_croce: '/audio/ambient/santa_croce.ogg',
  certosa: '/audio/ambient/certosa.ogg',
};
```

Crossfade uses Web Audio API `GainNode` per district:

```js
_startAudioCrossfade(fromId, toId) {
  if (fromId && this._activeAudio.has(fromId)) {
    this._activeAudio.get(fromId).target = 0.0;
  }

  if (toId && !this._activeAudio.has(toId)) {
    const audio = this._loadAndPlayAmbient(toId);
    this._activeAudio.set(toId, { ...audio, volume: 0.0, target: 1.0 });
  } else if (toId) {
    this._activeAudio.get(toId).target = 1.0;
  }
}
```

---

## Module: navigation/gondola-system.js

Maps ALGORITHM section A5. Full gondola ride state machine.

### Constants

```js
export const GONDOLA_SPEED      = 4.0;
export const GONDOLA_BOARD_TIME = 1.5;
export const GONDOLA_IDLE_BOB   = 0.05;
export const DOCK_TRIGGER_RADIUS = 4.0;
export const GONDOLA_BOB_FREQUENCY = 0.8;
export const GONDOLA_BOB_AMPLITUDE = 0.04;
export const GONDOLA_ROLL_AMPLITUDE = 0.015;
export const GONDOLA_DECEL_ZONE    = 0.05;
export const DISEMBARK_DURATION    = 1.2;
```

### Exports

```js
import * as THREE from 'three';

export class GondolaSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {GondolaDock[]} docks
   * @param {GondolaRoute[]} routes
   */
  constructor(scene, docks, routes) {
    this._scene = scene;
    this._docks = docks;
    this._routes = routes;
    this._activeGondola = null;
    this._nearestDock = null;
    this._promptVisible = false;
    this._positionTransition = null;
  }

  /**
   * Check dock proximity and show boarding prompt. Call each frame.
   * @param {THREE.Vector3} visitorPosition
   */
  updateDockProximity(visitorPosition) { /* A5.2 */ }

  /**
   * Attempt to board a gondola at the nearest dock.
   * @returns {boolean} - true if boarding started
   */
  board() { /* A5.3 */ }

  /**
   * Update gondola movement, bob, and camera tracking. Call each frame.
   * @param {number} deltaTime
   * @param {number} realTimeMs
   * @param {THREE.PerspectiveCamera} camera
   * @param {THREE.Group} dolly - VR camera rig
   * @param {boolean} isVR
   */
  update(deltaTime, realTimeMs, camera, dolly, isVR) { /* A5.4 */ }

  /**
   * Update any active smooth position transition (boarding/disembarking).
   * @param {number} deltaTime
   * @returns {THREE.Vector3|null} - current interpolated position, or null if no transition
   */
  updatePositionTransition(deltaTime) { /* A5.5 */ }

  /**
   * @returns {boolean}
   */
  isRiding() { return this._activeGondola !== null; }

  /**
   * @returns {GondolaDock|null}
   */
  getNearestDock() { return this._nearestDock; }

  /**
   * @returns {boolean}
   */
  isPromptVisible() { return this._promptVisible; }
}
```

### Spline Travel Update (A5.4)

```js
// Inside update(), when state === MOVING:
const g = this._activeGondola;
let speed = GONDOLA_SPEED;

// Decelerate near end
const remaining = 1.0 - g.t;
if (remaining < GONDOLA_DECEL_ZONE) {
  speed *= Math.max(remaining / GONDOLA_DECEL_ZONE, 0.1);
}

const dt = (speed * deltaTime) / g.route.totalLength;
g.t = Math.min(g.t + dt, 1.0);

const pos = g.route.spline.getPointAt(g.t);
const tangent = g.route.spline.getTangentAt(g.t);

// Water bob and roll
const bobY = Math.sin(realTimeMs * 0.001 * GONDOLA_BOB_FREQUENCY * Math.PI * 2) * GONDOLA_BOB_AMPLITUDE;
const roll = Math.sin(realTimeMs * 0.001 * GONDOLA_BOB_FREQUENCY * 0.7 * Math.PI * 2) * GONDOLA_ROLL_AMPLITUDE;

g.mesh.position.set(pos.x, pos.y + bobY, pos.z);
g.mesh.rotation.y = Math.atan2(tangent.x, tangent.z);
g.mesh.rotation.z = roll;

// Camera follows gondola
const SEATED_EYE_HEIGHT = 1.1;
if (isVR) {
  dolly.position.copy(g.mesh.position);
} else {
  camera.position.set(g.mesh.position.x, g.mesh.position.y + SEATED_EYE_HEIGHT, g.mesh.position.z);
}
```

### Gondola Mesh (reused from props.js)

```js
import { generateGondola } from '../venice/props.js';

function spawnGondola(route) {
  const mesh = generateGondola();
  // Add gondolier silhouette: thin cylinder + sphere (placeholder)
  const gondolierBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 1.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
  );
  gondolierBody.position.set(-3.5, 1.0, 0);
  mesh.add(gondolierBody);

  const startPos = route.spline.getPointAt(0);
  mesh.position.copy(startPos);
  this._scene.add(mesh);

  return { route, mesh, t: 0, state: GondolaState.IDLE };
}
```

### Boarding Prompt

World-anchored text using `THREE.Sprite` with a canvas texture:

```js
function createBoardPrompt() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 32px sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.textAlign = 'center';
  ctx.fillText('Board', 128, 40);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2, 0.5, 1);
  sprite.visible = false;
  return sprite;
}
```

---

## Module: navigation/bridge-traversal.js

Maps ALGORITHM section A6. Bridge surface detection and navmesh connectivity.

### Exports

```js
export class BridgeTraversalSystem {
  /**
   * Build connectivity data for all bridges. Maps A6.2.
   * @param {THREE.Group[]} bridges
   * @param {THREE.Mesh[]} fondamentaSegments
   * @param {DistrictDefinition[]} districts
   * @returns {BridgeConnection[]}
   */
  static buildBridgeNavmesh(bridges, fondamentaSegments, districts) { /* ... */ }

  /**
   * @param {BridgeConnection[]} connections
   */
  constructor(connections) {
    this._connections = connections;
    this._currentBridge = null;
  }

  /**
   * Called when ground raycast hits a bridge deck mesh. Maps A6.1.
   * @param {THREE.Intersection} hit
   * @param {THREE.Vector3} visitorPosition
   * @param {Function} checkDistrictTransition - callback from district-transition.js
   */
  onBridgeSurfaceDetected(hit, visitorPosition, checkDistrictTransition) { /* ... */ }
}
```

Bridge detection integrates with the collision system. When `_groundRaycast` hits a mesh with `userData.walkable && userData.bridgeRef`, the bridge traversal system is notified:

```js
// In collision-system.js, after a successful ground raycast:
if (hit.object.userData.bridgeRef) {
  bridgeTraversal.onBridgeSurfaceDetected(hit, proposed, districtTransition.update.bind(districtTransition));
}
```

---

## Module: navigation/comfort-system.js

Maps ALGORITHM section A7. VR comfort features: vignette, screen fade, height calibration.

### Constants

```js
export const VIGNETTE_MAX_OPACITY  = 0.30;
export const VIGNETTE_FADE_IN_MS   = 150;
export const VIGNETTE_FADE_OUT_MS  = 200;
export const VIGNETTE_INNER_RADIUS = 0.40;
export const VIGNETTE_OUTER_RADIUS = 0.90;

export const DEFAULT_EYE_HEIGHT    = 1.65;
export const CALIBRATION_SAMPLES   = 30;
export const MIN_EYE_HEIGHT        = 0.8;
export const MAX_EYE_HEIGHT        = 2.1;
```

### Exports

```js
import { createVignetteMesh } from '../atmosphere/vignette-shader.js';

export class ComfortSystem {
  /**
   * @param {THREE.Camera} camera
   * @param {THREE.Group} dolly
   */
  constructor(camera, dolly) {
    this._camera = camera;
    this._dolly = dolly;
    this._vignetteOpacity = 0;
    this._vignetteTarget = 0;
    this._vignette = createVignetteMesh();
    this._screenFade = { opacity: 0, target: 0, duration: 0, elapsed: 0, onComplete: null, active: false };
    this._calibrationSamples = [];
    this._calibratedHeight = DEFAULT_EYE_HEIGHT;
    this._calibrationComplete = false;
  }

  /** Show locomotion vignette. */
  activateVignette() { this._vignetteTarget = VIGNETTE_MAX_OPACITY; }

  /** Hide locomotion vignette. */
  deactivateVignette() { this._vignetteTarget = 0; }

  /**
   * Flash vignette briefly on snap turn. Maps A7.3.
   */
  snapTurnFlash() {
    this._vignetteOpacity = VIGNETTE_MAX_OPACITY * 0.5;
    this._vignetteTarget = 0;
  }

  /**
   * Start screen fade for teleport. Maps A7.2.
   * @param {boolean} toBlack
   * @param {number} durationMs
   * @param {Function} onComplete
   */
  startScreenFade(toBlack, durationMs, onComplete) { /* ... */ }

  /**
   * Collect height calibration sample. Maps A7.4.
   * @param {number} headsetYLocal - headset Y in dolly-local space
   */
  calibrateSample(headsetYLocal) { /* ... */ }

  /**
   * @returns {number} - calibrated or default eye height
   */
  getCalibratedHeight() { return this._calibratedHeight; }

  /**
   * Update vignette + screen fade. Call each frame.
   * @param {number} deltaTime
   */
  update(deltaTime) { /* A7.1, A7.2 */ }
}
```

### Screen Fade Implementation

The fade quad is a full-screen `THREE.PlaneGeometry(2, 2)` placed at the camera near clip distance, rendered with `depthTest: false`:

```js
const fadeGeometry = new THREE.PlaneGeometry(2, 2);
const fadeMaterial = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0,
  depthTest: false,
  depthWrite: false,
});
const fadeQuad = new THREE.Mesh(fadeGeometry, fadeMaterial);
fadeQuad.renderOrder = 9999;
fadeQuad.frustumCulled = false;
```

In VR: the fade quad is parented to each eye camera within the XR camera rig, positioned at `z = -camera.near - 0.001`.

---

## Module: navigation/nav-controller.js

Master coordinator. Dispatches to all navigation subsystems each frame.

### Imports

```js
import * as THREE from 'three';
import { DesktopControls } from './desktop-controls.js';
import { CollisionSystem } from './collision-system.js';
import { DistrictTransitionSystem } from './district-transition.js';
import { GondolaSystem } from './gondola-system.js';
import { BridgeTraversalSystem } from './bridge-traversal.js';
import { ComfortSystem } from './comfort-system.js';
```

### Exports

```js
export class NavController {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.PerspectiveCamera} camera
   * @param {VeniceState} veniceState
   * @param {object} options - { docks, routes }
   */
  constructor(scene, renderer, camera, veniceState, options) {
    this.visitor = {
      position: new THREE.Vector3(),
      lastValidPosition: new THREE.Vector3(),
      locomotionDisabled: false,
    };

    this.desktop = new DesktopControls(renderer.domElement);
    this.collision = new CollisionSystem(CollisionSystem.buildCollisionWorld(veniceState));
    this.districtTransition = new DistrictTransitionSystem();
    this.gondola = new GondolaSystem(scene, options.docks || [], options.routes || []);
    this.bridge = new BridgeTraversalSystem(
      BridgeTraversalSystem.buildBridgeNavmesh(veniceState.bridges, veniceState.canals.flatMap(c => c.fondamenta), veniceState.districts)
    );
    this.comfort = new ComfortSystem(camera, /* dolly from vr-controls */);

    this._renderer = renderer;
    this._camera = camera;
  }

  /**
   * Per-frame navigation update. Maps A8 master loop.
   * @param {number} deltaTime     - seconds
   * @param {number} realTimeMs    - performance.now()
   * @param {object} vrInput       - { leftStick, rightStick, rightTrigger, rightController } or null
   * @param {THREE.Group} dolly    - VR camera rig
   */
  update(deltaTime, realTimeMs, vrInput, dolly) {
    const isVR = this._renderer.xr.isPresenting;

    // 1. Gondola
    if (this.gondola.isRiding()) {
      this.gondola.update(deltaTime, realTimeMs, this._camera, dolly, isVR);
      const transPos = this.gondola.updatePositionTransition(deltaTime);
      if (isVR) this.comfort.update(deltaTime);
      return;
    }

    // 2. Compute displacement
    let displacement;
    if (isVR) {
      displacement = this._computeVRDisplacement(vrInput, dolly, deltaTime);
      // Snap turn
      if (vrInput) {
        this._handleSnapTurn(vrInput.rightStick.x, dolly, realTimeMs);
      }
      // Teleport
      if (vrInput) {
        this._handleTeleport(vrInput.rightController, vrInput.rightTrigger, dolly);
      }
    } else {
      displacement = this.desktop.computeMovement(deltaTime);
    }

    // 3. Collision resolve
    const fromPos = isVR ? dolly.position : this.visitor.position;
    const result = this.collision.resolveMovement(fromPos, displacement);

    // 4. Apply position
    if (isVR) {
      dolly.position.copy(result.position);
    } else {
      this.visitor.position.copy(result.position);
      this.desktop.applyToCamera(this._camera, this.visitor.position, VISITOR_EYE_HEIGHT);
    }

    if (result.onGround) {
      this.visitor.lastValidPosition.copy(result.position);
    }

    // 5. Fall recovery
    const recovery = this.collision.checkFallRecovery(result.position);
    if (recovery) {
      if (isVR) dolly.position.copy(recovery);
      else this.visitor.position.copy(recovery);
    }

    // 6. District transition
    this.districtTransition.update(result.position);
    this.districtTransition.updateAudio(deltaTime);

    // 7. Gondola dock proximity
    this.gondola.updateDockProximity(result.position);

    // 8. Comfort
    if (isVR) {
      this.comfort.update(deltaTime);
      // Height calibration
      if (!this.comfort._calibrationComplete) {
        const xrCam = this._renderer.xr.getCamera();
        this.comfort.calibrateSample(xrCam.position.y);
      }
    }
  }

  /**
   * @returns {string|null}
   */
  getCurrentDistrictId() { return this.districtTransition.getCurrentDistrictId(); }

  /** Dispose all resources. */
  dispose() {
    this.desktop.dispose();
  }

  // --- Private ---

  _computeVRDisplacement(vrInput, dolly, deltaTime) { /* A2.1 */ }
  _handleSnapTurn(stickX, dolly, realTimeMs) { /* A2.2 */ }
  _handleTeleport(controller, trigger, dolly) { /* A2.3 */ }
}
```

---

## VR Controls Modifications (vr-controls.js)

The existing `VRControls` class retains its grab system and hand tracking export. Locomotion logic moves to `NavController._computeVRDisplacement`. The connection point is:

```js
// In main.js:
const vrControls = new VRControls(renderer, camera, scene);
const navController = new NavController(scene, renderer, camera, veniceState, { docks, routes });

// In render loop:
if (!streamMode) {
  vrControls.update(delta); // handles grab, hand pinch only
  const vrInput = extractVRInput(renderer); // { leftStick, rightStick, rightTrigger, rightController }
  navController.update(delta, performance.now(), vrInput, vrControls.dolly);
}
```

VR input extraction function:

```js
function extractVRInput(renderer) {
  if (!renderer.xr.isPresenting) return null;
  const session = renderer.xr.getSession();
  if (!session) return null;

  const result = { leftStick: { x: 0, y: 0 }, rightStick: { x: 0, y: 0 }, rightTrigger: 0, rightController: null };

  for (const source of session.inputSources) {
    if (!source.gamepad) continue;
    const axes = source.gamepad.axes;
    const off = axes.length >= 4 ? 2 : 0;
    const stickX = axes[off] || 0;
    const stickY = axes[off + 1] || 0;

    if (source.handedness === 'left') {
      result.leftStick = { x: stickX, y: stickY };
    } else if (source.handedness === 'right') {
      result.rightStick = { x: stickX, y: stickY };
      result.rightTrigger = source.gamepad.buttons[0]?.value || 0;
      result.rightController = renderer.xr.getController(1);
    }
  }

  return result;
}
```

---

## Teleport Arc Rendering (A2.3, A2.4)

The teleport arc is a `THREE.Line` with dashed material, updated each frame while the trigger is half-pressed.

```js
const ARC_MAX_STEPS = 20;
const arcPositions = new Float32Array(ARC_MAX_STEPS * 3);
const arcGeometry = new THREE.BufferGeometry();
arcGeometry.setAttribute('position', new THREE.BufferAttribute(arcPositions, 3));
const arcMaterial = new THREE.LineDashedMaterial({
  color: 0x3388ff,
  dashSize: 0.3,
  gapSize: 0.15,
  linewidth: 1,
});
const arcLine = new THREE.Line(arcGeometry, arcMaterial);
arcLine.computeLineDistances();
arcLine.visible = false;
scene.add(arcLine);

// Landing indicator: torus ring
const landingRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.4, 0.02, 8, 32),
  new THREE.MeshBasicMaterial({ color: 0x3388ff })
);
landingRing.rotation.x = -Math.PI / 2;
landingRing.visible = false;
scene.add(landingRing);
```

### Teleport Constants

```js
const TELEPORT_MAX_RANGE   = 15.0;
const TELEPORT_ARC_GRAVITY = 9.8;
const TELEPORT_INITIAL_VEL = 8.0;
const TELEPORT_FADE_MS     = 200;
const TELEPORT_COOLDOWN_MS = 300;
const TELEPORT_VALID_COLOR = 0x3388ff;
const TELEPORT_INVALID_COLOR = 0xff3333;
```

---

## Integration: main.js Modifications

### Replace Inline WASD

Remove the existing `updateDesktopMovement()` function, `keys` object, and keydown/keyup listeners. Replace with `NavController`:

```js
// Remove:
// const keys = {};
// function updateDesktopMovement(delta) { ... }
// document.addEventListener('keydown/keyup', ...)

// Replace in render loop:
if (veniceState && navController) {
  const vrInput = extractVRInput(renderer);
  navController.update(delta, performance.now(), vrInput, vrControls.dolly);
}
```

### Gondola Board Trigger

Desktop: press `E` key near a dock. VR: pinch or grip near a dock.

```js
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && navController && navController.gondola.isPromptVisible()) {
    navController.gondola.board();
  }
});

// VR: detect grip near dock in vrControls update
vrControls.onGripNearDock = () => {
  if (navController && navController.gondola.isPromptVisible()) {
    navController.gondola.board();
  }
};
```

---

## WebXR API Specifics

### XRInputSource (controller input)

```js
// Gamepad axes layout on Quest 3:
// axes[0]: left touchpad X (often unused)
// axes[1]: left touchpad Y (often unused)
// axes[2]: thumbstick X
// axes[3]: thumbstick Y
// Fallback: if axes.length === 2, use axes[0] and axes[1] directly.

// Buttons:
// buttons[0]: trigger
// buttons[1]: grip/squeeze
// buttons[3]: thumbstick click
// buttons[4]: A button (right) / X button (left)
// buttons[5]: B button (right) / Y button (left)
```

### XRReferenceSpace

The dolly pattern uses `local-floor` reference space. The dolly `THREE.Group` is the world-space anchor. The headset position within the dolly is in tracking-relative coordinates.

```js
const session = await navigator.xr.requestSession('immersive-vr', {
  optionalFeatures: ['local-floor', 'hand-tracking'],
});
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setSession(session);
```

### XRHand (hand tracking)

Hand tracking is handled by the existing `VRControls` class. Navigation uses hand data only for:
- Pinch detection (gondola boarding)
- Joint positions exported for network sync

---

## Event System

Navigation emits events consumed by atmosphere and network:

```js
// DistrictTransitionSystem.onDistrictChanged callback:
navController.districtTransition.onDistrictChanged = (fromId, toId) => {
  // Atmosphere: fog gate + crossfade
  atmosphere.onDistrictChanged(fromId, toId);
  // Network: notify server
  network.send({ type: 'visitor_entered_district', data: { districtId: toId } });
};
```

---

## Import Graph

```
main.js
  +-- navigation/nav-controller.js
  |     +-- navigation/desktop-controls.js
  |     +-- navigation/collision-system.js
  |     +-- navigation/district-transition.js
  |     |     +-- shared/districts.js
  |     +-- navigation/gondola-system.js
  |     |     +-- venice/props.js (generateGondola)
  |     +-- navigation/bridge-traversal.js
  |     +-- navigation/comfort-system.js
  |     |     +-- atmosphere/vignette-shader.js
  +-- vr-controls.js  (grab + hand tracking, unchanged)
```

---

## Environment Variables

```
VENICE_SPAWN_DISTRICT    - Override spawn location (default "rialto")
GONDOLA_ENABLED          - "false" to disable gondola system
TELEPORT_ENABLED         - "false" to disable VR teleport
```

---

## Performance Budget

| Resource | Budget | Strategy |
|---|---|---|
| Ground raycasts per frame | 1-4 | Single downward ray + 3 wall probes |
| Wall raycasts per frame | 3 | Probe fan (center + 2 flanks) |
| Teleport arc raycasts | 20 | Only while trigger held, parabolic segments |
| District polygon checks | 7 | Every 10 frames, simple point-in-polygon |
| Audio sources | 2 active | Crossfade: only departing + arriving |
| Gondola spline eval | 2 | getPointAt + getTangentAt per frame |
| Collision mesh | < 50K vertices | Simplified fondamenta + bridge decks only |

### Raycaster Reuse

All raycasts use pre-allocated `THREE.Raycaster` instances stored on the `CollisionSystem`. Origin and direction vectors are reused via `.set()` to avoid per-frame allocation:

```js
this._raycaster.set(this._probeOrigin, this._probeDir);
this._raycaster.far = maxDist;
const hits = this._raycaster.intersectObjects(targetGroup, false);
```

The second argument `false` disables recursive traversal (meshes are flat in the collision groups, not nested in hierarchies).
