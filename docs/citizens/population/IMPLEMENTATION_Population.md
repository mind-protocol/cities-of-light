# IMPLEMENTATION: citizens/population -- Managing 152 Citizens at 72fps

```
STATUS: DRAFT
CREATED: 2026-03-11
VERIFIED: Not yet implemented
```

---

## CHAIN

```
OBJECTIVES:      ../../../docs/01_OBJECTIFS_Venezia.md
BEHAVIORS:       ./BEHAVIORS_Population.md
PATTERNS:        ./PATTERNS_Population.md
ALGORITHM:       ./ALGORITHM_Population.md
THIS:            IMPLEMENTATION_Population.md (you are here)
SYNC:            ./SYNC_Population.md

FILES:           src/client/citizens/citizen-manager.js (primary — client-side)
                 src/server/venice-state.js (primary — server-side)
                 src/server/serenissima-sync.js (data feed)
                 src/client/citizens/citizen-avatar.js (embodiment calls)
```

---

## FILE MAP

```
src/client/citizens/
  citizen-manager.js       ← THIS MODULE (client). Tier scoring, spawn/despawn,
                              transition lifecycle, position interpolation.
  citizen-avatar.js        ← Embodiment module. Called by citizen-manager for
                              mesh creation, disposal, animation, instancing.
  citizen-voice.js         ← Spatial TTS. Reads tier/position from citizen-manager.
  citizen-awareness.js     ← Gaze/proximity. Reads tier from citizen-manager.

src/server/
  venice-state.js          ← THIS MODULE (server). In-memory world state cache.
                              Schedule resolution, off-screen simulation, density management.
  serenissima-sync.js      ← Airtable fetch loop. Feeds venice-state.js.
  citizen-router.js        ← Mind module. Reads state from venice-state.js.
  physics-bridge.js        ← Blood Ledger integration. Updates from venice-state.

src/client/
  network.js               ← EXISTING. Extended with new message types for
                              citizen_state_batch, tier_change, schedule_update.
  main.js                  ← EXISTING. Initializes citizen-manager in animation loop.
```

---

## NPM PACKAGES

No additional packages beyond what is already in package.json. The population module uses:
- `three` (Vector3, Matrix4, Scene for add/remove)
- `ws` (WebSocket messages, already in server)

---

## IMPORT GRAPH

```
citizen-manager.js (client)
  <- three (Vector3, Scene)
  <- ./citizen-avatar.js (createFullMesh, createActiveMesh, setAmbientInstance,
                           removeAmbientInstance, disposeMesh, updateFullAnimation,
                           computePostureOffset, applyActivePosture, mapActivityToAnim,
                           initAmbientInstancing, checkMemoryPressure, meshLibrary)
  <- ../network.js (receives WebSocket messages)

venice-state.js (server)
  <- (no external imports — plain JS data structures)

serenissima-sync.js (server)
  <- airtable (Airtable SDK)
  <- ./venice-state.js (updateFromSync)

index.js (server)
  <- ./venice-state.js (getState, startTickLoop)
  <- ./serenissima-sync.js (startSync)
  <- ws (WebSocket — broadcast citizen_state_batch)
```

---

## DATA STRUCTURES (JS Classes)

### CitizenPopulationState (client-side)

One instance per citizen, managed by `CitizenPopulationManager`.

```js
// citizen-manager.js

class CitizenPopulationState {
  /**
   * @param {string} citizenId - Airtable record ID
   * @param {import('./citizen-avatar.js').CitizenConfig} config
   */
  constructor(citizenId, config) {
    this.citizenId = citizenId;
    this.config = config;

    // ── Server-authoritative state ──────────────────────
    /** @type {{ x: number, y: number, z: number }} */
    this.serverPosition = { x: 0, y: 0, z: 0 };
    /** @type {number} radians */
    this.serverHeading = 0;
    /** @type {string} */
    this.activity = 'idle';
    /** @type {string} */
    this.mood = 'neutral';
    /** @type {number} -1.0 to +1.0 */
    this.moodValence = 0;
    /** @type {number} 0.0 to 1.0 */
    this.moodArousal = 0;
    /** @type {string} */
    this.socialClass = config.socialClass || 'Popolani';
    /** @type {boolean} */
    this.isOutdoors = true;
    /** @type {boolean} */
    this.isAlive = true;

    // ── Client-side interpolation ───────────────────────
    /** @type {{ x: number, y: number, z: number }} */
    this.interpolatedPos = { x: 0, y: 0, z: 0 };
    /** @type {number} */
    this.interpolatedHead = 0;

    // ── Tier state ──────────────────────────────────────
    /** @type {'FULL'|'ACTIVE'|'AMBIENT'|'HIDDEN'} */
    this.tier = 'HIDDEN';
    /** @type {'FULL'|'ACTIVE'|'AMBIENT'|'HIDDEN'} */
    this.prevTier = 'HIDDEN';
    /** @type {'FULL'|'ACTIVE'|'AMBIENT'|'HIDDEN'} */
    this.desiredTier = 'HIDDEN';
    /** @type {number} 0.0-1.0 */
    this.compositeScore = 0;
    /** @type {number} meters, adjusted for relationship + activity */
    this.effectiveDistance = Infinity;
    /** @type {number} frames at current tier (hysteresis counter) */
    this.tierStableFrames = 0;

    // ── Transition state ────────────────────────────────
    /** @type {number} 0.0-1.0 crossfade progress */
    this.transitionT = 1.0;
    /** @type {'up'|'down'|null} */
    this.transitionDir = null;

    // ── Timestamps ──────────────────────────────────────
    /** @type {number} */
    this.lastServerUpdate = 0;
    /** @type {number} */
    this.lastTierRecalc = 0;

    // ── Schedule ────────────────────────────────────────
    /** @type {ScheduleEntry|null} */
    this.scheduleSlot = null;
    /** @type {EventOverride|null} */
    this.eventOverride = null;
  }
}
```

### TierAssignment (ephemeral, per scoring pass)

```js
// citizen-manager.js

/**
 * @typedef {Object} TierAssignment
 * @property {string} citizenId
 * @property {number} compositeScore - 0.0-1.0 (higher = closer tier)
 * @property {number} rawDistance - meters to visitor
 * @property {number} distanceFactor - 0.0-1.0
 * @property {number} relationFactor - 0.0-1.0
 * @property {number} activityFactor - 0.0-1.0
 * @property {'FULL'|'ACTIVE'|'AMBIENT'|'HIDDEN'} desiredTier
 * @property {'FULL'|'ACTIVE'|'AMBIENT'|'HIDDEN'} finalTier
 */
```

### ScheduleEntry (server-side, from Airtable ACTIVITIES)

```js
// venice-state.js

class ScheduleEntry {
  /**
   * @param {Object} fields - Airtable ACTIVITIES record fields
   */
  constructor(fields) {
    /** @type {string} */
    this.citizenId = fields.Citizen;
    /** @type {number} 0-23 world time */
    this.startHour = fields.StartHour || 0;
    /** @type {number} 0-23 (wraps midnight if start > end) */
    this.endHour = fields.EndHour || 24;
    /** @type {string} */
    this.activity = fields.ActivityType || 'idle';
    /** @type {{ x: number, y: number, z: number }} world-space destination */
    this.location = geoToWorld(fields.Location) || { x: 0, y: 0, z: 0 };
    /** @type {string} */
    this.districtId = fields.District || 'unknown';
    /** @type {boolean} */
    this.indoors = fields.Indoor || false;
    /** @type {number} 0.0-1.0, feeds tier scoring */
    this.priority = (fields.Importance || 5) / 10;
    /** @type {string|null} */
    this.groupId = fields.GroupID || null;
  }
}
```

### EventOverride (temporary, applied during world events)

```js
// venice-state.js

class EventOverride {
  constructor(params) {
    /** @type {string} */
    this.eventId = params.eventId;
    /** @type {'gathering'|'dispersal'|'procession'|'crisis'} */
    this.eventType = params.eventType;
    /** @type {{ x: number, y: number, z: number }} */
    this.targetPosition = params.targetPosition;
    /** @type {number} timestamp */
    this.startTime = params.startTime;
    /** @type {number} seconds world time */
    this.duration = params.duration;
    /** @type {number} overrides schedule if higher */
    this.priority = params.priority;
    /** @type {number} multiplier: 1.0 normal, 2.0 running */
    this.movementSpeed = params.movementSpeed || 1.0;
    /** @type {boolean} */
    this.holdAtTarget = params.holdAtTarget || false;
  }
}
```

### DensityTarget (per district, per time slot)

```js
// venice-state.js

/**
 * @typedef {Object} DensityTarget
 * @property {string} districtId
 * @property {'dawn'|'morning'|'midday'|'afternoon'|'evening'|'night'} timeSlot
 * @property {number} targetCount
 * @property {number} minCount
 * @property {number} maxCount
 * @property {{ Nobili: number, Cittadini: number, Popolani: number, Facchini: number, Forestieri: number }} classMix
 */
```

### PopulationManagerState (singleton, client-side)

```js
// citizen-manager.js

class PopulationManagerState {
  constructor() {
    /** @type {Map<string, CitizenPopulationState>} */
    this.citizens = new Map();
    /** @type {{ x: number, y: number, z: number }} */
    this.visitorPosition = { x: 0, y: 0, z: 0 };
    /** @type {number} 0.0-24.0 */
    this.worldTimeHour = 12.0;
    /** @type {string} */
    this.currentTimeSlot = 'midday';
    /** @type {{ FULL: number, ACTIVE: number, AMBIENT: number, HIDDEN: number }} */
    this.tierCounts = { FULL: 0, ACTIVE: 0, AMBIENT: 0, HIDDEN: 0 };
    this.frameBudget = {
      maxFull: 20,
      maxActive: 60,
      maxAmbient: 120,
      maxTierChanges: 3,
      maxSpawns: 5,
      tierChangesUsed: 0,
      spawnsUsed: 0,
    };
    /** @type {number} round-robin cursor for amortized scoring */
    this.scoringCursor = 0;
    /** @type {number} */
    this.frameNumber = 0;
    /** @type {Set<string>} citizens spoken to this session (for session interaction boost) */
    this.sessionInteractions = new Set();
  }
}
```

---

## TIER COMPUTATION

### Constants

```js
// citizen-manager.js

const W_DISTANCE = 0.60;
const W_RELATIONSHIP = 0.25;
const W_ACTIVITY = 0.15;
const MAX_RENDER_DIST = 200.0;
const RELATIONSHIP_DIST_BONUS = 5.0;
const ACTIVITY_DIST_BONUS = 3.0;
const SESSION_INTERACTION_BOOST = 0.3;
const SCORING_BUDGET_PER_FRAME = 20;
const POSITION_LERP_FACTOR = 0.12;
const HEADING_LERP_FACTOR = 0.15;

const TIER_THRESHOLDS = {
  FULL: 20,
  ACTIVE: 80,
  AMBIENT: 200,
};

const HYSTERESIS_BAND = {
  FULL: 5.0,    // FULL->ACTIVE at 25m
  ACTIVE: 5.0,  // ACTIVE->AMBIENT at 85m
  AMBIENT: 10.0, // AMBIENT->HIDDEN at 210m
};

const MIN_STABLE_FRAMES = 15; // ~250ms at 60fps before allowing downgrade

const TRANSITION_DURATION = {
  'HIDDEN_AMBIENT': 0.8,
  'AMBIENT_HIDDEN': 1.0,
  'AMBIENT_ACTIVE': 0.5,
  'ACTIVE_AMBIENT': 0.5,
  'ACTIVE_FULL': 0.3,
  'FULL_ACTIVE': 0.4,
};

const ACTIVITY_PRIORITY = {
  trading: 0.8,
  working: 0.6,
  socializing: 0.5,
  patrolling: 0.5,
  praying: 0.4,
  eating: 0.3,
  walking: 0.2,
  idle: 0.1,
  resting: 0.05,
};

const TIER_ORDER = { HIDDEN: 0, AMBIENT: 1, ACTIVE: 2, FULL: 3 };
```

### computeTierScore

```js
// citizen-manager.js

/**
 * Compute composite tier score for a single citizen.
 * Called for SCORING_BUDGET_PER_FRAME citizens each frame (amortized).
 *
 * @param {CitizenPopulationState} citizen
 * @param {{ x: number, y: number, z: number }} visitorPos
 * @param {Set<string>} sessionInteractions
 * @returns {TierAssignment}
 */
function computeTierScore(citizen, visitorPos, sessionInteractions) {
  const dx = citizen.serverPosition.x - visitorPos.x;
  const dy = citizen.serverPosition.y - visitorPos.y;
  const dz = citizen.serverPosition.z - visitorPos.z;
  const rawDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Early exit
  if (rawDistance > MAX_RENDER_DIST + 20) {
    return {
      citizenId: citizen.citizenId,
      compositeScore: 0,
      rawDistance,
      distanceFactor: 0,
      relationFactor: 0,
      activityFactor: 0,
      desiredTier: 'HIDDEN',
      finalTier: 'HIDDEN',
    };
  }

  // Distance factor: 1.0 at 0m, 0.0 at 200m
  const distanceFactor = Math.max(0, Math.min(1, 1.0 - rawDistance / MAX_RENDER_DIST));

  // Relationship factor
  const trustScore = getRelationshipTrust(citizen.citizenId);
  const sessionBonus = sessionInteractions.has(citizen.citizenId) ? SESSION_INTERACTION_BOOST : 0;
  const relationFactor = Math.max(0, Math.min(1, trustScore + sessionBonus));

  // Activity factor
  let activityFactor;
  if (citizen.scheduleSlot) {
    activityFactor = citizen.scheduleSlot.priority;
  } else {
    activityFactor = ACTIVITY_PRIORITY[citizen.activity] || 0.1;
  }
  if (!citizen.isOutdoors) activityFactor = 0;

  // Composite score
  const compositeScore = W_DISTANCE * distanceFactor
    + W_RELATIONSHIP * relationFactor
    + W_ACTIVITY * activityFactor;

  // Effective distance
  const effectiveDistance = Math.max(
    rawDistance - relationFactor * RELATIONSHIP_DIST_BONUS - activityFactor * ACTIVITY_DIST_BONUS,
    0
  );

  // Desired tier
  let desiredTier;
  if (!citizen.isAlive || !citizen.isOutdoors) {
    desiredTier = 'HIDDEN';
  } else if (effectiveDistance < TIER_THRESHOLDS.FULL) {
    desiredTier = 'FULL';
  } else if (effectiveDistance < TIER_THRESHOLDS.ACTIVE) {
    desiredTier = 'ACTIVE';
  } else if (effectiveDistance < TIER_THRESHOLDS.AMBIENT) {
    desiredTier = 'AMBIENT';
  } else {
    desiredTier = 'HIDDEN';
  }

  return {
    citizenId: citizen.citizenId,
    compositeScore,
    rawDistance,
    distanceFactor,
    relationFactor,
    activityFactor,
    desiredTier,
    finalTier: desiredTier, // Overwritten by hysteresis + budget
  };
}
```

### applyHysteresis

```js
// citizen-manager.js

/**
 * Apply hysteresis bands to prevent tier flicker at boundaries.
 * Upgrades are immediate. Downgrades require wider threshold + stability.
 *
 * @param {CitizenPopulationState} citizen
 * @param {TierAssignment} assignment
 * @returns {'FULL'|'ACTIVE'|'AMBIENT'|'HIDDEN'}
 */
function applyHysteresis(citizen, assignment) {
  const current = TIER_ORDER[citizen.tier];
  const desired = TIER_ORDER[assignment.desiredTier];
  const dist = citizen.effectiveDistance;

  // Conversation lock: never downgrade while talking to visitor
  if (citizen.activity === 'talking') {
    return citizen.tier === 'HIDDEN' ? 'FULL' : citizen.tier;
  }

  // Upgrade: apply immediately
  if (desired > current) {
    citizen.tierStableFrames = 0;
    return assignment.desiredTier;
  }

  // Same tier: accumulate stability
  if (desired === current) {
    citizen.tierStableFrames += 1;
    return citizen.tier;
  }

  // Downgrade: require stability + hysteresis band
  if (citizen.tierStableFrames < MIN_STABLE_FRAMES) {
    return citizen.tier;
  }

  if (citizen.tier === 'FULL' && dist < TIER_THRESHOLDS.FULL + HYSTERESIS_BAND.FULL) {
    return 'FULL';
  }
  if (citizen.tier === 'ACTIVE' && dist < TIER_THRESHOLDS.ACTIVE + HYSTERESIS_BAND.ACTIVE) {
    return 'ACTIVE';
  }
  if (citizen.tier === 'AMBIENT' && dist < TIER_THRESHOLDS.AMBIENT + HYSTERESIS_BAND.AMBIENT) {
    return 'AMBIENT';
  }

  citizen.tierStableFrames = 0;
  return assignment.desiredTier;
}
```

### enforceBudget

```js
// citizen-manager.js

/**
 * Cap citizens per tier. Citizens compete by composite score.
 * Mutates assignment.finalTier in place.
 *
 * @param {Array<TierAssignment>} assignments
 * @param {{ maxFull: number, maxActive: number, maxAmbient: number }} budget
 */
function enforceBudget(assignments, budget) {
  const fullCandidates = assignments.filter(a => a.finalTier === 'FULL');
  let activeCandidates = assignments.filter(a => a.finalTier === 'ACTIVE');

  fullCandidates.sort((a, b) => b.compositeScore - a.compositeScore);
  activeCandidates.sort((a, b) => b.compositeScore - a.compositeScore);

  // Demote excess FULL to ACTIVE
  if (fullCandidates.length > budget.maxFull) {
    for (let i = budget.maxFull; i < fullCandidates.length; i++) {
      fullCandidates[i].finalTier = 'ACTIVE';
      activeCandidates.push(fullCandidates[i]);
    }
    activeCandidates.sort((a, b) => b.compositeScore - a.compositeScore);
  }

  // Demote excess ACTIVE to AMBIENT
  if (activeCandidates.length > budget.maxActive) {
    for (let i = budget.maxActive; i < activeCandidates.length; i++) {
      activeCandidates[i].finalTier = 'AMBIENT';
    }
  }

  // Demote excess AMBIENT to HIDDEN (only under memory pressure)
  const ambientCandidates = assignments.filter(a => a.finalTier === 'AMBIENT');
  if (ambientCandidates.length > budget.maxAmbient) {
    ambientCandidates.sort((a, b) => b.compositeScore - a.compositeScore);
    for (let i = budget.maxAmbient; i < ambientCandidates.length; i++) {
      ambientCandidates[i].finalTier = 'HIDDEN';
    }
  }
}
```

---

## SPAWN/DESPAWN WITH THREE.js scene.add/scene.remove

### Transition Initiation

```js
// citizen-manager.js

import {
  createFullMesh,
  createActiveMesh,
  setAmbientInstance,
  removeAmbientInstance,
  disposeMesh,
  initAmbientInstancing,
} from './citizen-avatar.js';

/** @type {THREE.Scene} */
let scene = null;

/** @type {Map<string, import('./citizen-avatar.js').CitizenRenderState>} */
const renderStates = new Map();

/**
 * Bind the population manager to the Three.js scene.
 * Called once at startup after MeshLibrary loads.
 *
 * @param {THREE.Scene} threeScene
 */
export function initPopulationManager(threeScene) {
  scene = threeScene;
  initAmbientInstancing(scene);
}

/**
 * Initiate a tier transition for a citizen.
 * Creates the mesh for the new tier via scene.add().
 * Multi-step jumps (HIDDEN->ACTIVE) chain through intermediates.
 *
 * @param {CitizenPopulationState} citizen
 * @param {'FULL'|'ACTIVE'|'AMBIENT'|'HIDDEN'} newTier
 * @param {{ tierChangesUsed: number, spawnsUsed: number, maxTierChanges: number, maxSpawns: number }} budget
 * @returns {boolean} true if transition was initiated
 */
function initiateTransition(citizen, newTier, budget) {
  // Check per-frame budget
  if (newTier === 'AMBIENT' && citizen.tier === 'HIDDEN') {
    if (budget.spawnsUsed >= budget.maxSpawns) return false;
    budget.spawnsUsed += 1;
  } else {
    if (budget.tierChangesUsed >= budget.maxTierChanges) return false;
    budget.tierChangesUsed += 1;
  }

  // Multi-step jump: only advance one tier at a time
  const currentOrder = TIER_ORDER[citizen.tier];
  const targetOrder = TIER_ORDER[newTier];
  if (Math.abs(targetOrder - currentOrder) > 1) {
    const step = targetOrder > currentOrder ? 1 : -1;
    const intermediateOrder = currentOrder + step;
    newTier = Object.keys(TIER_ORDER).find(k => TIER_ORDER[k] === intermediateOrder);
  }

  citizen.prevTier = citizen.tier;
  citizen.tier = newTier;
  citizen.transitionT = 0.0;
  citizen.transitionDir = TIER_ORDER[newTier] > TIER_ORDER[citizen.prevTier] ? 'up' : 'down';
  citizen.tierStableFrames = 0;

  // ── Create mesh for new tier via embodiment module ─────
  const rs = getOrCreateRenderState(citizen);

  switch (newTier) {
    case 'FULL':
      if (!rs.meshFull) {
        rs.meshFull = createFullMesh(citizen.config);
        scene.add(rs.meshFull);
      }
      rs.meshFull.visible = true;
      setGroupOpacity(rs.meshFull, 0.0); // Start transparent, fade in
      break;

    case 'ACTIVE':
      if (!rs.meshActive) {
        rs.meshActive = createActiveMesh(citizen.config);
        scene.add(rs.meshActive);
      }
      rs.meshActive.visible = true;
      setGroupOpacity(rs.meshActive, 0.0);
      break;

    case 'AMBIENT':
      setAmbientInstance(
        citizen.citizenId,
        citizen.interpolatedPos,
        citizen.config.colorPrimary,
        citizen.config.heightScale
      );
      break;

    case 'HIDDEN':
      // No mesh creation needed. Old meshes cleaned up in finishTransition.
      break;
  }

  return true;
}
```

### Transition Update (per-frame crossfade)

```js
// citizen-manager.js

import { setAmbientInstanceOpacity } from './citizen-avatar.js';

/**
 * Update transition crossfade for a citizen.
 * Called every frame for citizens with active transitions.
 *
 * @param {CitizenPopulationState} citizen
 * @param {number} deltaTime - seconds
 */
function updateTransition(citizen, deltaTime) {
  if (!citizen.transitionDir) return;

  const key = `${citizen.prevTier}_${citizen.tier}`;
  const duration = TRANSITION_DURATION[key] || 0.5;

  citizen.transitionT += deltaTime / duration;
  const t = smoothstep(0, 1, Math.min(citizen.transitionT, 1));

  const rs = renderStates.get(citizen.citizenId);
  if (!rs) return;

  // Fade in new tier
  if (citizen.tier === 'FULL' && rs.meshFull) {
    setGroupOpacity(rs.meshFull, t);
  }
  if (citizen.tier === 'ACTIVE' && rs.meshActive) {
    setGroupOpacity(rs.meshActive, t);
  }

  // Fade out old tier
  if (citizen.prevTier === 'FULL' && rs.meshFull && citizen.tier !== 'FULL') {
    setGroupOpacity(rs.meshFull, 1.0 - t);
  }
  if (citizen.prevTier === 'ACTIVE' && rs.meshActive && citizen.tier !== 'ACTIVE') {
    setGroupOpacity(rs.meshActive, 1.0 - t);
  }
  if (citizen.prevTier === 'AMBIENT') {
    setAmbientInstanceOpacity(citizen.citizenId, 1.0 - t);
  }

  // Transition complete
  if (citizen.transitionT >= 1.0) {
    citizen.transitionT = 1.0;
    citizen.transitionDir = null;
    citizen.prevTier = citizen.tier;
    finishTransition(citizen);
  }
}

/**
 * Called when a crossfade completes. Hides and schedules disposal of old tier meshes.
 *
 * @param {CitizenPopulationState} citizen
 */
function finishTransition(citizen) {
  const rs = renderStates.get(citizen.citizenId);
  if (!rs) return;

  // Hide meshes not in current tier
  if (citizen.tier !== 'FULL' && rs.meshFull) {
    rs.meshFull.visible = false;
    rs.lastFullUse = performance.now();
  }
  if (citizen.tier !== 'ACTIVE' && rs.meshActive) {
    rs.meshActive.visible = false;
    rs.lastActiveUse = performance.now();
  }
  if (citizen.tier !== 'AMBIENT') {
    removeAmbientInstance(citizen.citizenId);
  }
  if (citizen.tier === 'HIDDEN') {
    // Remove all meshes from scene immediately
    if (rs.meshFull) {
      scene.remove(rs.meshFull);
      disposeMesh(rs.meshFull);
      rs.meshFull = null;
    }
    if (rs.meshActive) {
      scene.remove(rs.meshActive);
      disposeMesh(rs.meshActive);
      rs.meshActive = null;
    }
    removeAmbientInstance(citizen.citizenId);
  }
}

/**
 * Deferred disposal: remove meshes unused for > 5 seconds.
 * Called once per second from the main update loop.
 */
function deferredDisposal() {
  const now = performance.now();
  const DISPOSAL_DELAY_MS = 5000;

  for (const [id, rs] of renderStates) {
    const citizen = managerState.citizens.get(id);
    if (!citizen) continue;

    if (citizen.tier !== 'FULL' && rs.meshFull && now - rs.lastFullUse > DISPOSAL_DELAY_MS) {
      scene.remove(rs.meshFull);
      disposeMesh(rs.meshFull);
      rs.meshFull = null;
    }
    if (citizen.tier !== 'ACTIVE' && rs.meshActive && now - rs.lastActiveUse > DISPOSAL_DELAY_MS) {
      scene.remove(rs.meshActive);
      disposeMesh(rs.meshActive);
      rs.meshActive = null;
    }
  }
}
```

### Helper Functions

```js
// citizen-manager.js

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function setGroupOpacity(group, opacity) {
  group.traverse((child) => {
    if (child.material && child.material.transparent !== undefined) {
      child.material.opacity = opacity;
      child.material.transparent = true;
    }
  });
}

function wrapAngle(angle) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

function getOrCreateRenderState(citizen) {
  let rs = renderStates.get(citizen.citizenId);
  if (!rs) {
    const { CitizenRenderState } = require('./citizen-avatar.js');
    rs = new CitizenRenderState(citizen.config);
    renderStates.set(citizen.citizenId, rs);
  }
  return rs;
}
```

---

## SCHEDULE DATA FORMAT FROM AIRTABLE

### Airtable ACTIVITIES Table Schema

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| Citizen | Link (CITIZENS) | rec_abc123 | Single citizen |
| ActivityType | Single Select | working, trading, praying, ... | Maps to animation state |
| StartHour | Number | 8 | 0-23, Venice world time |
| EndHour | Number | 12 | 0-23, wraps midnight |
| Location | JSON | {"lat": 45.43, "lng": 12.33} | Geo coords, converted to world-space |
| District | Single Select | San Marco, Dorsoduro, ... | District ID |
| Indoor | Checkbox | true/false | Indoor = not renderable |
| Importance | Number | 7 | 0-10, scaled to 0.0-1.0 priority |
| GroupID | Single Line Text | guild_meeting_001 | Citizens with same GroupID cluster |

### Server-Side Schedule Building

```js
// venice-state.js

/**
 * Build daily schedule for a citizen from Airtable ACTIVITIES records.
 *
 * @param {string} citizenId
 * @param {Array<{ id: string, fields: Object }>} activities - from Airtable
 * @param {{ x: number, y: number, z: number }} homePosition
 * @param {string} homeDistrict
 * @returns {Array<ScheduleEntry>}
 */
function buildDailySchedule(citizenId, activities, homePosition, homeDistrict) {
  // Filter to this citizen's activities
  const citizenActivities = activities
    .filter(a => a.fields.Citizen === citizenId)
    .map(a => new ScheduleEntry(a.fields))
    .sort((a, b) => a.startHour - b.startHour);

  // Fill gaps with "resting at home" entries
  const schedule = [];
  let lastEnd = 0;

  for (const entry of citizenActivities) {
    if (entry.startHour > lastEnd) {
      // Gap: resting at home
      schedule.push(new ScheduleEntry({
        Citizen: citizenId,
        StartHour: lastEnd,
        EndHour: entry.startHour,
        ActivityType: 'resting',
        Location: homePosition,
        District: homeDistrict,
        Indoor: true,
        Importance: 0,
        GroupID: null,
      }));
    }
    schedule.push(entry);
    lastEnd = entry.endHour;
  }

  // Fill remaining time until midnight/next day
  if (lastEnd < 24) {
    schedule.push(new ScheduleEntry({
      Citizen: citizenId,
      StartHour: lastEnd,
      EndHour: 24,
      ActivityType: 'resting',
      Location: homePosition,
      District: homeDistrict,
      Indoor: true,
      Importance: 0,
      GroupID: null,
    }));
  }

  return schedule;
}

/**
 * Convert Airtable geo coordinates to world-space position.
 * Venice coordinate system: origin at Piazza San Marco.
 * 1 world unit = ~10 meters.
 *
 * @param {{ lat: number, lng: number }} geo
 * @returns {{ x: number, y: number, z: number }}
 */
function geoToWorld(geo) {
  if (!geo || !geo.lat || !geo.lng) return { x: 0, y: 0, z: 0 };

  const ORIGIN_LAT = 45.4341;
  const ORIGIN_LNG = 12.3388;
  const METERS_PER_DEGREE_LAT = 111320;
  const METERS_PER_DEGREE_LNG = 111320 * Math.cos(ORIGIN_LAT * Math.PI / 180);
  const WORLD_SCALE = 0.1; // 1 world unit = 10 meters

  const x = (geo.lng - ORIGIN_LNG) * METERS_PER_DEGREE_LNG * WORLD_SCALE;
  const z = -(geo.lat - ORIGIN_LAT) * METERS_PER_DEGREE_LAT * WORLD_SCALE;

  return { x, y: 0, z };
}

export { ScheduleEntry, EventOverride, geoToWorld, buildDailySchedule };
```

---

## WEBSOCKET MESSAGES FOR TIER CHANGES

### Server -> Client: Citizen State Batch

Sent at tier-stratified intervals. FULL citizens update every 33ms (30Hz). ACTIVE every 500ms (2Hz). AMBIENT every 2s (0.5Hz). HIDDEN citizens are never sent.

```js
// Server-side broadcast (venice-state.js tick loop)

/**
 * @typedef {Object} CitizenStateBatchMessage
 * @property {'citizen_state_batch'} type
 * @property {Array<CitizenStateUpdate>} updates
 * @property {number} worldTimeHour
 * @property {string} timeSlot
 */

/**
 * @typedef {Object} CitizenStateUpdate
 * @property {string} id - citizen Airtable ID
 * @property {{ x: number, y: number, z: number }} position
 * @property {number} heading - radians
 * @property {string} activity
 * @property {string} mood
 * @property {number} moodValence
 * @property {number} moodArousal
 * @property {boolean} isOutdoors
 * @property {boolean} isAlive
 * @property {string|null} talkingTo
 */

// Example message:
{
  type: 'citizen_state_batch',
  updates: [
    {
      id: 'rec_abc123',
      position: { x: 45.2, y: 0, z: -12.8 },
      heading: 1.57,
      activity: 'trading',
      mood: 'content',
      moodValence: 0.3,
      moodArousal: 0.2,
      isOutdoors: true,
      isAlive: true,
      talkingTo: null,
    },
    // ... up to 152 entries per batch
  ],
  worldTimeHour: 14.5,
  timeSlot: 'afternoon',
}
```

### Server -> Client: Tier Override (schedule event)

Sent when a world event (gathering, dispersal) overrides citizen movement.

```js
{
  type: 'citizen_event_override',
  data: {
    citizenId: 'rec_abc123',
    eventId: 'evt_market_fire',
    eventType: 'dispersal',
    targetPosition: { x: 80.0, y: 0, z: -20.0 },
    movementSpeed: 1.8,
    duration: 120,
  }
}
```

### Server -> Client: Schedule Update

Sent when a citizen's schedule changes (new Airtable sync or density rebalance).

```js
{
  type: 'citizen_schedule_update',
  data: {
    citizenId: 'rec_abc123',
    activity: 'praying',
    districtId: 'san_marco',
    indoors: false,
    priority: 0.4,
  }
}
```

### Client -> Server: Time Slot Changed

```js
{
  type: 'time_slot_changed',
  data: {
    slot: 'evening',
  }
}
```

---

## MASTER POPULATION UPDATE LOOP

```js
// citizen-manager.js

import {
  updateFullAnimation,
  computePostureOffset,
  applyActivePosture,
  mapActivityToAnim,
  setAmbientInstance,
  checkMemoryPressure,
} from './citizen-avatar.js';

/** @type {PopulationManagerState} */
const managerState = new PopulationManagerState();

let _lastDisposalCheck = 0;
let _lastMemoryCheck = 0;

/**
 * Main population update. Called every frame from main.js animation loop.
 *
 * @param {number} deltaTime - seconds since last frame
 * @param {{ x: number, y: number, z: number }} visitorPos - world-space visitor position
 */
export function populationUpdate(deltaTime, visitorPos) {
  const state = managerState;
  state.frameNumber += 1;
  state.visitorPosition = visitorPos;
  state.frameBudget.tierChangesUsed = 0;
  state.frameBudget.spawnsUsed = 0;

  const citizenArray = Array.from(state.citizens.values());

  // ── Phase 1: Amortized Scoring ────────────────────────
  const batch = [];
  for (let i = 0; i < SCORING_BUDGET_PER_FRAME; i++) {
    const idx = (state.scoringCursor + i) % citizenArray.length;
    if (idx >= citizenArray.length) break;

    const citizen = citizenArray[idx];
    const assignment = computeTierScore(citizen, visitorPos, state.sessionInteractions);
    citizen.compositeScore = assignment.compositeScore;
    citizen.effectiveDistance = Math.max(
      assignment.rawDistance
        - assignment.relationFactor * RELATIONSHIP_DIST_BONUS
        - assignment.activityFactor * ACTIVITY_DIST_BONUS,
      0
    );
    citizen.desiredTier = assignment.desiredTier;
    batch.push(assignment);
  }
  state.scoringCursor = (state.scoringCursor + SCORING_BUDGET_PER_FRAME) % citizenArray.length;

  // ── Phase 2: Hysteresis (batch only) ──────────────────
  for (const assignment of batch) {
    const citizen = state.citizens.get(assignment.citizenId);
    if (citizen) {
      assignment.finalTier = applyHysteresis(citizen, assignment);
    }
  }

  // ── Phase 3: Budget Enforcement (once per full scoring cycle) ──
  const fullCycleComplete = state.scoringCursor < SCORING_BUDGET_PER_FRAME;

  if (fullCycleComplete) {
    // Build assignments for ALL citizens
    const allAssignments = citizenArray.map(c => ({
      citizenId: c.citizenId,
      compositeScore: c.compositeScore,
      rawDistance: c.effectiveDistance,
      distanceFactor: 0,
      relationFactor: 0,
      activityFactor: 0,
      desiredTier: c.desiredTier,
      finalTier: applyHysteresis(c, { desiredTier: c.desiredTier }),
    }));
    enforceBudget(allAssignments, state.frameBudget);

    for (const assignment of allAssignments) {
      const citizen = state.citizens.get(assignment.citizenId);
      if (citizen && assignment.finalTier !== citizen.tier) {
        initiateTransition(citizen, assignment.finalTier, state.frameBudget);
      }
    }

    // Update tier counts
    state.tierCounts = { FULL: 0, ACTIVE: 0, AMBIENT: 0, HIDDEN: 0 };
    for (const citizen of citizenArray) {
      state.tierCounts[citizen.tier] += 1;
    }
  } else {
    // Partial cycle: apply batch transitions only
    for (const assignment of batch) {
      const citizen = state.citizens.get(assignment.citizenId);
      if (citizen && assignment.finalTier !== citizen.tier) {
        initiateTransition(citizen, assignment.finalTier, state.frameBudget);
      }
    }
  }

  // ── Phase 4: Transition Updates ───────────────────────
  for (const citizen of citizenArray) {
    if (citizen.transitionDir) {
      updateTransition(citizen, deltaTime);
    }
  }

  // ── Phase 5: Position Interpolation ───────────────────
  for (const citizen of citizenArray) {
    if (citizen.tier === 'HIDDEN') continue;

    citizen.interpolatedPos.x += (citizen.serverPosition.x - citizen.interpolatedPos.x) * POSITION_LERP_FACTOR;
    citizen.interpolatedPos.y += (citizen.serverPosition.y - citizen.interpolatedPos.y) * POSITION_LERP_FACTOR;
    citizen.interpolatedPos.z += (citizen.serverPosition.z - citizen.interpolatedPos.z) * POSITION_LERP_FACTOR;

    const headDiff = wrapAngle(citizen.serverHeading - citizen.interpolatedHead);
    citizen.interpolatedHead += headDiff * HEADING_LERP_FACTOR;

    // Update mesh position via embodiment
    const rs = renderStates.get(citizen.citizenId);
    if (!rs) continue;

    if (citizen.tier === 'FULL' && rs.meshFull) {
      rs.meshFull.position.set(
        citizen.interpolatedPos.x,
        citizen.interpolatedPos.y,
        citizen.interpolatedPos.z
      );
      rs.meshFull.rotation.y = citizen.interpolatedHead;

      // Animation update
      const targetAnim = mapActivityToAnim(citizen.activity, citizen.mood);
      updateFullAnimation(rs, targetAnim, deltaTime);
    }

    if (citizen.tier === 'ACTIVE' && rs.meshActive) {
      rs.meshActive.position.set(
        citizen.interpolatedPos.x,
        citizen.interpolatedPos.y,
        citizen.interpolatedPos.z
      );
      rs.meshActive.rotation.y = citizen.interpolatedHead;

      // Posture update (cheaper than animation)
      const posture = computePostureOffset(citizen.moodValence, citizen.moodArousal);
      applyActivePosture(rs.meshActive, posture);
    }

    if (citizen.tier === 'AMBIENT') {
      setAmbientInstance(
        citizen.citizenId,
        citizen.interpolatedPos,
        citizen.config.colorPrimary,
        citizen.config.heightScale
      );
    }
  }

  // ── Phase 6: Periodic Checks ──────────────────────────
  const now = performance.now();

  // Deferred disposal every 1 second
  if (now - _lastDisposalCheck > 1000) {
    _lastDisposalCheck = now;
    deferredDisposal();
  }

  // Memory pressure every 10 seconds
  if (now - _lastMemoryCheck > 10000) {
    _lastMemoryCheck = now;
    checkMemoryPressure(renderStates, scene, state.frameBudget);
  }
}
```

---

## INTEGRATION WITH MAIN.JS

```js
// main.js — additions

import { populationUpdate, initPopulationManager, handleCitizenStateBatch } from './citizens/citizen-manager.js';
import { meshLibrary } from './citizens/mesh-library.js';

// ── At startup (after scene creation) ───────────────────
async function initVenezia() {
  await meshLibrary.load();
  initPopulationManager(scene);
  console.log('Venezia citizen system initialized');
}
initVenezia().catch(e => console.warn('Venezia init:', e));

// ── In animation loop ───────────────────────────────────
// Inside renderer.setAnimationLoop(() => { ... })

// After existing desktop movement and VR controls:
{
  const playerPos = renderer.xr.isPresenting
    ? nicolasAvatar.position
    : camera.position;
  populationUpdate(delta, {
    x: playerPos.x,
    y: playerPos.y,
    z: playerPos.z,
  });
}

// ── WebSocket message handler ───────────────────────────
network.onCitizenStateBatch = (msg) => {
  handleCitizenStateBatch(msg);
};
```

### Handling Incoming State Batches

```js
// citizen-manager.js

/**
 * Handle incoming citizen_state_batch message from server.
 * Updates server-authoritative state for each citizen.
 *
 * @param {{ updates: Array<CitizenStateUpdate>, worldTimeHour: number, timeSlot: string }} msg
 */
export function handleCitizenStateBatch(msg) {
  managerState.worldTimeHour = msg.worldTimeHour;

  if (msg.timeSlot !== managerState.currentTimeSlot) {
    managerState.currentTimeSlot = msg.timeSlot;
  }

  for (const update of msg.updates) {
    let citizen = managerState.citizens.get(update.id);

    if (!citizen) {
      // New citizen — create population state
      // Config comes from a separate citizen_config message or is pre-loaded
      const config = citizenConfigs.get(update.id);
      if (!config) continue; // Config not yet loaded
      citizen = new CitizenPopulationState(update.id, config);
      citizen.interpolatedPos = { ...update.position };
      managerState.citizens.set(update.id, citizen);
    }

    citizen.serverPosition = update.position;
    citizen.serverHeading = update.heading;
    citizen.activity = update.activity;
    citizen.mood = update.mood;
    citizen.moodValence = update.moodValence;
    citizen.moodArousal = update.moodArousal;
    citizen.isOutdoors = update.isOutdoors;
    citizen.isAlive = update.isAlive;
    citizen.lastServerUpdate = performance.now();
  }
}

/** @type {Map<string, CitizenConfig>} Pre-loaded citizen configs */
const citizenConfigs = new Map();

/**
 * Load citizen configs from server. Called once at startup.
 * @param {Array<CitizenConfig>} configs
 */
export function loadCitizenConfigs(configs) {
  for (const config of configs) {
    citizenConfigs.set(config.id, config);
  }
}
```

---

## INTEGRATION WITH EMBODIMENT AND MIND MODULES

### Embodiment Integration

The population module is the primary consumer of the embodiment module. Every tier transition, position update, and animation tick flows through the embodiment API:

```
populationUpdate() [every frame]
  |
  |-- Phase 3: initiateTransition()
  |     |-- createFullMesh(config) --> scene.add(group)
  |     |-- createActiveMesh(config) --> scene.add(group)
  |     |-- setAmbientInstance(id, pos, color, scale) --> InstancedMesh
  |
  |-- Phase 4: updateTransition()
  |     |-- setGroupOpacity() --> material.opacity
  |     |-- setAmbientInstanceOpacity() --> InstancedMesh position hack
  |
  |-- Phase 5: Position Interpolation
  |     |-- meshFull.position.set() --> THREE.Group transform
  |     |-- meshActive.position.set() --> THREE.Group transform
  |     |-- setAmbientInstance() --> InstancedMesh matrix update
  |     |-- updateFullAnimation(rs, anim, dt) --> AnimationMixer
  |     |-- applyActivePosture(group, posture) --> Bone rotation
  |
  |-- Periodic: deferredDisposal()
  |     |-- scene.remove(group) --> THREE.Scene
  |     |-- disposeMesh(group) --> GPU resource release
  |
  |-- Periodic: checkMemoryPressure()
        |-- scene.remove() + disposeMesh() under pressure
        |-- Reduce maxFull/maxActive in frameBudget
```

### Mind Module Integration

The population module provides tier information to the mind module. The mind module reads tier state to determine which citizens can be spoken to (only FULL-tier citizens are conversable):

```
Client: citizen-awareness.js
  |-- Reads citizen.tier from citizen-manager.js
  |-- Only citizens at FULL tier get awareness/gaze tracking
  |-- Sends 'citizen_awareness' message via WebSocket

Server: citizen-router.js
  |-- findNearestFullTierCitizen() queries venice-state.js
  |-- venice-state.js knows citizen positions (not tiers — those are client-side)
  |-- Proximity check at 15m serves as implicit FULL-tier filter
  |-- When conversation starts, server sends citizen_conversation_state
  |-- Client receives it and locks citizen to FULL tier (conversation lock in hysteresis)
```

### Mind -> Population feedback: conversation lock

```js
// citizen-manager.js — handling conversation state from server

network.onCitizenConversationState = (msg) => {
  const citizen = managerState.citizens.get(msg.data.citizenId);
  if (!citizen) return;

  if (msg.data.state === 'SPEAKING' || msg.data.state === 'CONVERSING' || msg.data.state === 'THINKING') {
    // Lock citizen activity to 'talking' — prevents tier downgrade
    citizen.activity = 'talking';
    // If citizen spoke to us, mark for session interaction boost
    if (msg.data.visitorId === network.citizenId) {
      managerState.sessionInteractions.add(citizen.citizenId);
    }
  } else if (msg.data.state === 'IDLE') {
    // Conversation ended — release lock
    // Activity will be updated by next citizen_state_batch
  }
};
```

---

## SERVER-SIDE TICK LOOP

```js
// venice-state.js

const CLASS_WALK_SPEED = {
  Nobili: 0.9,
  Cittadini: 1.1,
  Popolani: 1.2,
  Facchini: 1.4,
  Forestieri: 1.0,
};

const CLASS_BASELINE_MOOD = {
  Nobili: 0.2,
  Cittadini: 0.1,
  Popolani: -0.1,
  Facchini: -0.2,
  Forestieri: 0.0,
};

class VeniceState {
  constructor() {
    /** @type {Map<string, Object>} citizenId -> { fields, schedule, position, ... } */
    this.citizens = new Map();
    /** @type {Map<string, Object>} */
    this.buildings = new Map();
    /** @type {Map<string, Object>} key -> { trust, notes } */
    this.relationships = new Map();
    /** @type {Map<string, Object>} username -> ledger data */
    this.ledgers = new Map();
    /** @type {number} */
    this.worldTimeHour = 12.0;
    /** @type {number} world time speed multiplier (1.0 = real-time, 24.0 = 1 world day = 1 real hour) */
    this.timeScale = 24.0;

    this._tickInterval = null;
    this._broadcastInterval = null;
  }

  /**
   * Start the server-side tick loops.
   * @param {function} broadcast - broadcast(msg) to all WebSocket clients
   */
  startTickLoop(broadcast) {
    // Off-screen simulation: every 30 seconds
    this._tickInterval = setInterval(() => {
      this._offScreenTick(30);
    }, 30000);

    // State broadcast: every 3 seconds (ACTIVE/AMBIENT citizens)
    // FULL citizens are broadcast at higher frequency in a separate loop
    this._broadcastInterval = setInterval(() => {
      const updates = [];
      for (const [id, citizen] of this.citizens) {
        if (!citizen.fields.IsAlive) continue;
        updates.push({
          id,
          position: citizen.serverPosition || { x: 0, y: 0, z: 0 },
          heading: citizen.serverHeading || 0,
          activity: citizen.currentActivity || 'idle',
          mood: citizen.fields.Mood || 'neutral',
          moodValence: citizen.moodValence || 0,
          moodArousal: citizen.moodArousal || 0,
          isOutdoors: citizen.isOutdoors !== false,
          isAlive: citizen.fields.IsAlive !== false,
          talkingTo: citizen.talkingTo || null,
        });
      }

      broadcast({
        type: 'citizen_state_batch',
        updates,
        worldTimeHour: this.worldTimeHour,
        timeSlot: this.getVeniceTimeSlot(),
      });
    }, 3000);

    // Density rebalance: every 5 minutes
    setInterval(() => {
      this._rebalanceDistrictPopulation();
    }, 5 * 60 * 1000);

    // Event override expiry: every 30 seconds
    setInterval(() => {
      this._expireEventOverrides();
    }, 30000);

    // World time advance
    setInterval(() => {
      this.worldTimeHour += (1 / 3600) * this.timeScale; // 1 second real = timeScale seconds world
      if (this.worldTimeHour >= 24) this.worldTimeHour -= 24;
    }, 1000);
  }

  /** @private */
  _offScreenTick(tickDelta) {
    for (const [id, citizen] of this.citizens) {
      if (!citizen.fields.IsAlive) continue;
      if (!citizen.schedule || citizen.schedule.length === 0) continue;

      const entry = this._resolveSchedule(id, this.worldTimeHour, citizen.schedule);
      if (!entry) continue;

      citizen.isOutdoors = !entry.indoors;
      citizen.scheduleSlot = entry;

      if (!citizen.isOutdoors) {
        citizen.serverPosition = { ...entry.location };
        citizen.currentActivity = entry.activity;
        continue;
      }

      // Walk toward schedule location
      const dx = entry.location.x - (citizen.serverPosition?.x || 0);
      const dz = entry.location.z - (citizen.serverPosition?.z || 0);
      const dist = Math.sqrt(dx * dx + dz * dz);
      const walkSpeed = CLASS_WALK_SPEED[citizen.fields.SocialClass] || 1.0;
      const maxStep = walkSpeed * tickDelta;

      if (dist > 1.0) {
        const factor = Math.min(maxStep / dist, 1.0);
        citizen.serverPosition = citizen.serverPosition || { x: 0, y: 0, z: 0 };
        citizen.serverPosition.x += dx * factor;
        citizen.serverPosition.z += dz * factor;
        citizen.serverHeading = Math.atan2(dx, dz);
        citizen.currentActivity = 'walking';
      } else {
        citizen.serverPosition = { ...entry.location };
        citizen.currentActivity = entry.activity;
      }

      // Mood drift toward class baseline
      const baseline = CLASS_BASELINE_MOOD[citizen.fields.SocialClass] || 0;
      citizen.moodValence = (citizen.moodValence || 0) + (baseline - (citizen.moodValence || 0)) * 0.05 * tickDelta;
    }
  }

  /** @private */
  _resolveSchedule(citizenId, worldTimeHour, schedule) {
    for (const entry of schedule) {
      if (entry.startHour <= entry.endHour) {
        if (worldTimeHour >= entry.startHour && worldTimeHour < entry.endHour) return entry;
      } else {
        if (worldTimeHour >= entry.startHour || worldTimeHour < entry.endHour) return entry;
      }
    }
    return null;
  }

  getVeniceTimeSlot() {
    const h = this.worldTimeHour;
    if (h >= 5 && h < 7) return 'dawn';
    if (h >= 7 && h < 10) return 'morning';
    if (h >= 10 && h < 14) return 'midday';
    if (h >= 14 && h < 18) return 'afternoon';
    if (h >= 18 && h < 22) return 'evening';
    return 'night';
  }

  getVeniceTimeOfDay() {
    return this.getVeniceTimeSlot();
  }

  getDistrictForPosition(position) {
    // District lookup from position. Implementation depends on district boundary data.
    // Placeholder: return based on x-z quadrant.
    return 'san_marco';
  }

  getDistrictEvents(district, lastHours) {
    // TODO: Pull from event log
    return [];
  }

  getDistrictTensionLevel(district) {
    // TODO: Compute from FalkorDB or event history
    return 0;
  }

  getTrustScore(citizenUsername, visitorId) {
    const key = `${citizenUsername}:${visitorId}`;
    const rel = this.relationships.get(key);
    return rel?.trust || 50;
  }

  updateFromSync({ citizens, relationships, buildings, activities }) {
    // Update citizens
    for (const [id, record] of citizens) {
      const existing = this.citizens.get(id);
      if (existing) {
        existing.fields = record.fields;
      } else {
        this.citizens.set(id, {
          fields: record.fields,
          serverPosition: geoToWorld(record.fields.Position) || { x: 0, y: 0, z: 0 },
          serverHeading: 0,
          currentActivity: record.fields.CurrentActivity || 'idle',
          moodValence: 0,
          moodArousal: 0,
          isOutdoors: true,
          talkingTo: null,
          schedule: [],
          scheduleSlot: null,
          eventOverride: null,
        });
      }
    }

    // Update relationships
    for (const [key, rel] of relationships) {
      this.relationships.set(key, rel);
    }

    // Update buildings
    for (const [id, record] of buildings) {
      this.buildings.set(id, record);
    }

    // Build daily schedules
    for (const [id, citizen] of this.citizens) {
      const homePos = geoToWorld(citizen.fields.Position) || { x: 0, y: 0, z: 0 };
      const homeDistrict = citizen.fields.HomeDistrict || 'unknown';
      citizen.schedule = buildDailySchedule(id, activities, homePos, homeDistrict);
    }
  }

  /** @private */
  _rebalanceDistrictPopulation() {
    // Implementation per ALGORITHM_Population.md
    // Omitted here for brevity — see algorithm doc for full pseudocode.
  }

  /** @private */
  _expireEventOverrides() {
    const now = Date.now();
    for (const [id, citizen] of this.citizens) {
      if (citizen.eventOverride && (now - citizen.eventOverride.startTime) >= citizen.eventOverride.duration * 1000) {
        citizen.eventOverride = null;
      }
    }
  }
}

export { VeniceState };
```

---

## INTERACTIONS

| Module | Import From | Function Called | Purpose |
|--------|-------------|----------------|---------|
| `main.js` | `citizen-manager.js` | `populationUpdate(dt, pos)` | Per-frame population tick |
| `main.js` | `citizen-manager.js` | `initPopulationManager(scene)` | Bind to Three.js scene |
| `main.js` | `citizen-manager.js` | `handleCitizenStateBatch(msg)` | Process server state updates |
| `citizen-manager.js` | `citizen-avatar.js` | `createFullMesh()`, `createActiveMesh()` | Mesh creation on tier upgrade |
| `citizen-manager.js` | `citizen-avatar.js` | `setAmbientInstance()`, `removeAmbientInstance()` | Instanced mesh management |
| `citizen-manager.js` | `citizen-avatar.js` | `disposeMesh()` | GPU resource release |
| `citizen-manager.js` | `citizen-avatar.js` | `updateFullAnimation()` | Per-frame skeletal animation |
| `citizen-manager.js` | `citizen-avatar.js` | `computePostureOffset()`, `applyActivePosture()` | Mood-driven bone offsets |
| `citizen-manager.js` | `citizen-avatar.js` | `checkMemoryPressure()` | Adaptive quality under memory pressure |
| `citizen-manager.js` | `network.js` | `onCitizenStateBatch`, `onCitizenConversationState` | WebSocket message handlers |
| `index.js` | `venice-state.js` | `VeniceState`, `startTickLoop()` | Server-side population simulation |
| `index.js` | `serenissima-sync.js` | `startSync()` | Airtable data feed |
| `venice-state.js` | `serenissima-sync.js` | `updateFromSync()` | Receive Airtable data |
| `citizen-router.js` | `venice-state.js` | `getState()`, `getTrustScore()` | Mind module reads population state |
