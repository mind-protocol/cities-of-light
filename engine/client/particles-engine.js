/**
 * ParticlesEngine — Zone-specific ambient particles.
 *
 * Parameterized by manifest zone atmosphere config.
 * Supports: fireflies, embers, pollen, sparks, snow, rain
 *
 * Each particle type has distinct motion, color behavior, and density.
 * When the player moves between zones, the particle system crossfades
 * to the new zone's particle type and color.
 *
 * Handles Quest hardware by reducing particle count when detected.
 *
 * Usage:
 *   const particles = new ParticlesEngine(scene, {
 *     type: 'fireflies',
 *     color: 0xffcc44,
 *     count: 300,
 *     isQuest: false,
 *   });
 *   // each frame:
 *   particles.update(elapsed, playerPos);
 *   // on zone change:
 *   particles.setZoneAtmosphere(zone.atmosphere);
 */

import * as THREE from 'three';

// ─── Particle Type Definitions ──────────────────────────

const PARTICLE_TYPES = {
  fireflies: {
    speed: 0.3,
    spread: 20,
    verticalRange: [0.5, 4],
    sizeRange: [0.08, 0.18],
    opacityRange: [0.3, 1.0],
    blinkRate: 2.0,      // fireflies blink on/off
    driftStrength: 0.5,
    gravity: 0,
    lifetime: Infinity,
  },
  embers: {
    speed: 0.8,
    spread: 15,
    verticalRange: [0, 8],
    sizeRange: [0.04, 0.12],
    opacityRange: [0.5, 1.0],
    blinkRate: 0,
    driftStrength: 0.3,
    gravity: -0.02,      // embers rise
    lifetime: 4.0,
  },
  pollen: {
    speed: 0.15,
    spread: 25,
    verticalRange: [0.5, 3],
    sizeRange: [0.03, 0.07],
    opacityRange: [0.4, 0.8],
    blinkRate: 0,
    driftStrength: 0.8,
    gravity: 0.005,      // pollen drifts down very slowly
    lifetime: Infinity,
  },
  sparks: {
    speed: 1.5,
    spread: 12,
    verticalRange: [0, 6],
    sizeRange: [0.02, 0.08],
    opacityRange: [0.6, 1.0],
    blinkRate: 5.0,      // sparks flicker fast
    driftStrength: 0.2,
    gravity: -0.05,      // sparks rise fast
    lifetime: 2.0,
  },
  snow: {
    speed: 0.4,
    spread: 30,
    verticalRange: [0, 12],
    sizeRange: [0.03, 0.06],
    opacityRange: [0.5, 0.9],
    blinkRate: 0,
    driftStrength: 0.6,
    gravity: 0.03,       // snow falls gently
    lifetime: Infinity,
  },
  rain: {
    speed: 3.0,
    spread: 25,
    verticalRange: [0, 15],
    sizeRange: [0.01, 0.03],
    opacityRange: [0.3, 0.6],
    blinkRate: 0,
    driftStrength: 0.1,
    gravity: 0.15,       // rain falls fast
    lifetime: Infinity,
  },
};

// Quest hardware runs at reduced particle count
const QUEST_COUNT_MULTIPLIER = 0.4;

/**
 * Parse a color value from manifest format to a numeric hex value.
 * @param {number|string} color
 * @returns {number}
 */
function parseColor(color) {
  if (typeof color === 'number') return color;
  if (typeof color === 'string') {
    const cleaned = color.replace(/^(#|0x)/, '');
    return parseInt(cleaned, 16);
  }
  return 0xffcc44;
}

/**
 * Simple seeded random for deterministic particle placement.
 * @param {number} seed
 * @returns {function(): number}
 */
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export class ParticlesEngine {
  /**
   * @param {THREE.Scene} scene
   * @param {object} config
   * @param {string}  config.type     — particle type (fireflies, embers, etc.)
   * @param {number|string} config.color — particle color (hex number or string)
   * @param {number}  [config.count=300] — base particle count
   * @param {boolean} [config.isQuest=false] — reduce count for Quest hardware
   */
  constructor(scene, config = {}) {
    this.scene = scene;
    this.isQuest = config.isQuest || false;

    // Resolve particle count (Quest gets reduced)
    const baseCount = config.count || 300;
    this.count = this.isQuest
      ? Math.floor(baseCount * QUEST_COUNT_MULTIPLIER)
      : baseCount;

    // Current particle type config
    this.particleType = config.type || 'fireflies';
    this.typeConfig = PARTICLE_TYPES[this.particleType] || PARTICLE_TYPES.fireflies;

    // Color
    this.targetColor = new THREE.Color(parseColor(config.color || 0xffcc44));
    this.currentColor = this.targetColor.clone();

    // Per-particle state arrays
    this._velocities = new Float32Array(this.count * 3);
    this._lifetimes = new Float32Array(this.count);
    this._phases = new Float32Array(this.count);   // random phase offset for blink/drift

    // Build the particle system
    this._buildParticles();

    // Transition state
    this._transitioning = false;
    this._transitionProgress = 0;
    this._pendingType = null;
    this._pendingTypeConfig = null;
  }

  /**
   * Build the THREE.Points geometry and material.
   */
  _buildParticles() {
    const positions = new Float32Array(this.count * 3);
    const rand = seededRandom(42);

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;

      // Scatter particles around the origin (they follow the player)
      const angle = rand() * Math.PI * 2;
      const radius = rand() * this.typeConfig.spread;
      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = this.typeConfig.verticalRange[0] +
        rand() * (this.typeConfig.verticalRange[1] - this.typeConfig.verticalRange[0]);
      positions[i3 + 2] = Math.sin(angle) * radius;

      // Random velocity
      this._velocities[i3] = (rand() - 0.5) * this.typeConfig.speed;
      this._velocities[i3 + 1] = (rand() - 0.5) * this.typeConfig.speed * 0.5;
      this._velocities[i3 + 2] = (rand() - 0.5) * this.typeConfig.speed;

      // Random lifetime offset
      this._lifetimes[i] = this.typeConfig.lifetime === Infinity
        ? Infinity
        : rand() * this.typeConfig.lifetime;

      // Random phase for blink/drift variation
      this._phases[i] = rand() * Math.PI * 2;
    }

    this._geometry = new THREE.BufferGeometry();
    this._geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Particle size range: average of min and max
    const avgSize = (this.typeConfig.sizeRange[0] + this.typeConfig.sizeRange[1]) / 2;

    this._material = new THREE.PointsMaterial({
      color: this.currentColor,
      size: avgSize,
      transparent: true,
      opacity: (this.typeConfig.opacityRange[0] + this.typeConfig.opacityRange[1]) / 2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this._points = new THREE.Points(this._geometry, this._material);
    this._points.frustumCulled = false; // particles surround the player
    this.scene.add(this._points);
  }

  /**
   * Update particle positions and effects each frame.
   *
   * @param {number} elapsed — time since start (seconds)
   * @param {{ x: number, y: number, z: number }} playerPos — world position
   */
  update(elapsed, playerPos) {
    const positions = this._geometry.attributes.position.array;
    const tc = this.typeConfig;
    const dt = 1 / 60; // approximate frame delta

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      const phase = this._phases[i];

      // Drift motion (organic wandering)
      const driftX = Math.sin(elapsed * 0.7 + phase) * tc.driftStrength * dt;
      const driftZ = Math.cos(elapsed * 0.5 + phase * 1.3) * tc.driftStrength * dt;

      // Apply velocity + drift + gravity
      positions[i3] += this._velocities[i3] * dt + driftX;
      positions[i3 + 1] += this._velocities[i3 + 1] * dt - tc.gravity * dt;
      positions[i3 + 2] += this._velocities[i3 + 2] * dt + driftZ;

      // Lifetime handling for finite-lifetime particles
      if (tc.lifetime !== Infinity) {
        this._lifetimes[i] -= dt;
        if (this._lifetimes[i] <= 0) {
          // Respawn at random position near player
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * tc.spread;
          positions[i3] = Math.cos(angle) * radius;
          positions[i3 + 1] = tc.verticalRange[0] +
            Math.random() * (tc.verticalRange[1] - tc.verticalRange[0]);
          positions[i3 + 2] = Math.sin(angle) * radius;

          // Reset velocity
          this._velocities[i3] = (Math.random() - 0.5) * tc.speed;
          this._velocities[i3 + 1] = (Math.random() - 0.5) * tc.speed * 0.5;
          this._velocities[i3 + 2] = (Math.random() - 0.5) * tc.speed;

          this._lifetimes[i] = tc.lifetime;
        }
      }

      // Wrap particles that drift too far from origin
      const dx = positions[i3];
      const dz = positions[i3 + 2];
      const distSq = dx * dx + dz * dz;
      if (distSq > tc.spread * tc.spread) {
        const angle = Math.atan2(dz, dx) + Math.PI; // flip to opposite side
        const radius = tc.spread * 0.5;
        positions[i3] = Math.cos(angle) * radius;
        positions[i3 + 2] = Math.sin(angle) * radius;
      }

      // Vertical bounds
      if (positions[i3 + 1] < tc.verticalRange[0]) {
        positions[i3 + 1] = tc.verticalRange[1];
        this._velocities[i3 + 1] = Math.abs(this._velocities[i3 + 1]) * -0.5;
      }
      if (positions[i3 + 1] > tc.verticalRange[1]) {
        positions[i3 + 1] = tc.verticalRange[0];
        this._velocities[i3 + 1] = -Math.abs(this._velocities[i3 + 1]) * 0.5;
      }
    }

    this._geometry.attributes.position.needsUpdate = true;

    // Center the particle field on the player
    this._points.position.set(playerPos.x, 0, playerPos.z);

    // Blink effect (affects global opacity)
    if (tc.blinkRate > 0) {
      const blink = 0.5 + 0.5 * Math.sin(elapsed * tc.blinkRate);
      this._material.opacity = tc.opacityRange[0] +
        blink * (tc.opacityRange[1] - tc.opacityRange[0]);
    }

    // Color transition
    if (!this.currentColor.equals(this.targetColor)) {
      this.currentColor.lerp(this.targetColor, 0.02);
      this._material.color.copy(this.currentColor);
    }

    // Type transition: fade out, switch, fade in
    if (this._transitioning) {
      this._transitionProgress += dt * 2; // ~0.5s per phase
      if (this._transitionProgress < 1.0) {
        // Phase 1: fade out
        this._material.opacity *= (1.0 - this._transitionProgress);
      } else if (this._transitionProgress < 1.05) {
        // Phase 2: switch type config
        this.particleType = this._pendingType;
        this.typeConfig = this._pendingTypeConfig;
        this._pendingType = null;
        this._pendingTypeConfig = null;

        // Update material size
        const avgSize = (this.typeConfig.sizeRange[0] + this.typeConfig.sizeRange[1]) / 2;
        this._material.size = avgSize;

        // Redistribute particles for new type
        this._redistributeParticles();
      } else if (this._transitionProgress < 2.0) {
        // Phase 3: fade in
        const fadeIn = this._transitionProgress - 1.0;
        const baseOpacity = (this.typeConfig.opacityRange[0] + this.typeConfig.opacityRange[1]) / 2;
        this._material.opacity = baseOpacity * fadeIn;
      } else {
        // Transition complete
        this._transitioning = false;
        this._transitionProgress = 0;
      }
    }
  }

  /**
   * Redistribute existing particles for the current type config.
   * Called during a type transition.
   */
  _redistributeParticles() {
    const positions = this._geometry.attributes.position.array;
    const tc = this.typeConfig;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * tc.spread;

      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = tc.verticalRange[0] +
        Math.random() * (tc.verticalRange[1] - tc.verticalRange[0]);
      positions[i3 + 2] = Math.sin(angle) * radius;

      this._velocities[i3] = (Math.random() - 0.5) * tc.speed;
      this._velocities[i3 + 1] = (Math.random() - 0.5) * tc.speed * 0.5;
      this._velocities[i3 + 2] = (Math.random() - 0.5) * tc.speed;

      this._lifetimes[i] = tc.lifetime === Infinity
        ? Infinity
        : Math.random() * tc.lifetime;

      this._phases[i] = Math.random() * Math.PI * 2;
    }

    this._geometry.attributes.position.needsUpdate = true;
  }

  /**
   * Update the particle system when the player enters a new zone.
   * Reads the zone's atmosphere config (manifest snake_case format)
   * and transitions the particle type and color.
   *
   * @param {object} atmosphere — zone.atmosphere from WorldLoader
   *   atmosphere.particle_type: string (fireflies, embers, pollen, sparks, snow, rain)
   *   atmosphere.particle_color: string|number (hex color)
   */
  setZoneAtmosphere(atmosphere) {
    if (!atmosphere) return;

    // Update color target
    if (atmosphere.particle_color != null) {
      this.targetColor.setHex(parseColor(atmosphere.particle_color));
    }

    // Switch particle type if different
    const newType = atmosphere.particle_type || 'fireflies';
    if (newType !== this.particleType && PARTICLE_TYPES[newType]) {
      this._pendingType = newType;
      this._pendingTypeConfig = PARTICLE_TYPES[newType];
      this._transitioning = true;
      this._transitionProgress = 0;
    }
  }

  /**
   * Get the underlying PointsMaterial (for use with ZoneAmbientEngine
   * which also lerps particle color).
   *
   * @returns {THREE.PointsMaterial}
   */
  getMaterial() {
    return this._material;
  }

  /**
   * Remove the particle system from the scene and free resources.
   */
  dispose() {
    this.scene.remove(this._points);
    this._geometry.dispose();
    this._material.dispose();
    this._points = null;
  }
}
