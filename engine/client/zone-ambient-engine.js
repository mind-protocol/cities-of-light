/**
 * ZoneAmbientEngine — Zone-based ambient transitions.
 *
 * Engine version: receives zones from WorldLoader manifest
 * instead of importing from shared/zones.js.
 *
 * Zones come from WorldLoader._setupZones(), which stores atmosphere
 * data with snake_case keys (fog_color, fog_density, particle_color,
 * particle_type, light_color, light_intensity). Colors are hex strings
 * ("0x8faac0" or "#8faac0"). This module handles the conversion.
 *
 * Usage:
 *   const world = await worldLoader.load(manifestPath);
 *   const zones = worldLoader.getZonesArray();
 *   const ambient = new ZoneAmbientEngine(scene, hemiLight, particleMat, zones);
 *   // each frame:
 *   ambient.update(playerPos, elapsed);
 */

import * as THREE from 'three';

/**
 * Parse a color value from manifest format to a numeric hex value.
 * Accepts: number (0xff0000), string ("0xff0000"), string ("#ff0000").
 * @param {number|string} color
 * @returns {number}
 */
function parseColor(color) {
  if (typeof color === 'number') return color;
  if (typeof color === 'string') {
    const cleaned = color.replace(/^(#|0x)/, '');
    return parseInt(cleaned, 16);
  }
  return 0x000000;
}

/**
 * Extract ambient properties from a manifest zone's atmosphere object.
 * Converts snake_case manifest format to the values the ambient system needs.
 *
 * @param {object} atmosphere — zone.atmosphere from WorldLoader
 * @returns {{ fogColor: number, fogDensity: number, particleColor: number, particleType: string, lightColor: number, lightIntensity: number }}
 */
function resolveAtmosphere(atmosphere) {
  if (!atmosphere) {
    return {
      fogColor: 0x8faac0,
      fogDensity: 0.008,
      particleColor: 0xffcc44,
      particleType: 'fireflies',
      lightColor: 0xffcc88,
      lightIntensity: 2.5,
    };
  }

  return {
    fogColor: atmosphere.fog_color != null
      ? parseColor(atmosphere.fog_color) : 0x8faac0,
    fogDensity: atmosphere.fog_density != null
      ? atmosphere.fog_density : 0.008,
    particleColor: atmosphere.particle_color != null
      ? parseColor(atmosphere.particle_color) : 0xffcc44,
    particleType: atmosphere.particle_type || 'fireflies',
    lightColor: atmosphere.light_color != null
      ? parseColor(atmosphere.light_color) : 0xffcc88,
    lightIntensity: atmosphere.light_intensity != null
      ? atmosphere.light_intensity : 2.5,
  };
}

/**
 * Find the nearest zone to a world-space position.
 * Works with zones from WorldLoader (position is a THREE.Vector3 or {x, z}).
 *
 * @param {Array} zones — array of zone objects
 * @param {{ x: number, z: number }} pos — world position (y ignored)
 * @returns {{ zone: object, distance: number }}
 */
function detectNearestZone(zones, pos) {
  let nearest = zones[0];
  let minDist = Infinity;

  for (const zone of zones) {
    const zx = zone.position.x;
    const zz = zone.position.z;
    const dx = pos.x - zx;
    const dz = pos.z - zz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < minDist) {
      minDist = dist;
      nearest = zone;
    }
  }

  return { zone: nearest, distance: minDist };
}

export class ZoneAmbientEngine {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.HemisphereLight} hemiLight
   * @param {THREE.PointsMaterial} particleMat
   * @param {Array} zones — zone objects from WorldLoader.getZonesArray()
   */
  constructor(scene, hemiLight, particleMat, zones) {
    if (!zones || zones.length === 0) {
      throw new Error('ZoneAmbientEngine requires at least one zone');
    }

    this.scene = scene;
    this.hemiLight = hemiLight;
    this.particleMat = particleMat;
    this.zones = zones;
    this.currentZone = null;

    /** @type {function(object, object): void | null} */
    this.onZoneChanged = null;

    // Lerp targets (set from zone atmosphere)
    this._targetFogColor = new THREE.Color();
    this._targetFogDensity = 0.008;
    this._targetParticleColor = new THREE.Color(0xffcc44);
    this._targetLightColor = new THREE.Color(0xffcc88);

    // Working color for lerps
    this._workColor = new THREE.Color();
  }

  /**
   * Call once per frame. Detects the nearest zone and smoothly
   * transitions fog, particle color, and hemisphere light toward
   * the target zone's atmosphere settings.
   *
   * @param {{ x: number, y: number, z: number }} playerPos — world position
   * @param {number} elapsed — seconds since start (unused for now)
   */
  update(playerPos, elapsed) {
    const { zone, distance } = detectNearestZone(this.zones, playerPos);

    // Zone change detection
    if (!this.currentZone || this.currentZone.id !== zone.id) {
      const old = this.currentZone;
      this.currentZone = zone;

      // Resolve snake_case manifest atmosphere to numeric values
      const atm = resolveAtmosphere(zone.atmosphere);

      // Set lerp targets
      this._targetFogColor.setHex(atm.fogColor);
      this._targetFogDensity = atm.fogDensity;
      this._targetParticleColor.setHex(atm.particleColor);
      this._targetLightColor.setHex(atm.lightColor);

      if (this.onZoneChanged) {
        this.onZoneChanged(old, zone);
      }
    }

    // Smooth lerp (0.02 per frame ~ 2s transition at 60fps)
    const lerpFactor = 0.02;

    // Fog color + density
    if (this.scene.fog) {
      this.scene.fog.color.lerp(this._targetFogColor, lerpFactor);
      this.scene.fog.density += (this._targetFogDensity - this.scene.fog.density) * lerpFactor;
    }

    // Particle color
    if (this.particleMat) {
      this.particleMat.color.lerp(this._targetParticleColor, lerpFactor);
    }

    // Hemisphere light sky color
    if (this.hemiLight) {
      this.hemiLight.color.lerp(this._targetLightColor, lerpFactor);
    }
  }

  /**
   * Get the current zone (for UI display, network sync).
   * @returns {object|null}
   */
  getZone() {
    return this.currentZone;
  }

  /**
   * Replace the zones array at runtime (e.g., after world transition).
   * Resets currentZone so the next update() re-detects.
   * @param {Array} zones
   */
  setZones(zones) {
    if (!zones || zones.length === 0) {
      throw new Error('ZoneAmbientEngine requires at least one zone');
    }
    this.zones = zones;
    this.currentZone = null;
  }
}
