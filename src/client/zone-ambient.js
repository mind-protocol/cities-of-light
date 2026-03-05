/**
 * Zone Ambient — smooth fog/light transitions as player moves between zones.
 *
 * Tracks the nearest zone and lerps scene fog, hemisphere light,
 * and particle color toward the target zone's ambient settings.
 */

import * as THREE from 'three';
import { detectNearestZone } from '../shared/zones.js';

export class ZoneAmbient {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.HemisphereLight} hemiLight
   * @param {THREE.PointsMaterial} particleMat
   */
  constructor(scene, hemiLight, particleMat) {
    this.scene = scene;
    this.hemiLight = hemiLight;
    this.particleMat = particleMat;
    this.currentZone = null;
    this.onZoneChanged = null;

    // Lerp targets (set from zone ambient)
    this._targetFogColor = new THREE.Color();
    this._targetFogDensity = 0.008;
    this._targetParticleColor = new THREE.Color(0xffcc44);
    this._targetLightColor = new THREE.Color(0xffcc88);

    // Working color for lerps
    this._workColor = new THREE.Color();
  }

  /**
   * Call once per frame. Detects zone + smoothly transitions ambient.
   * @param {{ x: number, y: number, z: number }} playerPos - World position
   * @param {number} elapsed - Seconds since start (unused for now)
   */
  update(playerPos, elapsed) {
    const { zone, distance } = detectNearestZone(playerPos);

    // Zone change detection
    if (!this.currentZone || this.currentZone.id !== zone.id) {
      const old = this.currentZone;
      this.currentZone = zone;

      // Set lerp targets
      this._targetFogColor.setHex(zone.ambient.fogColor);
      this._targetFogDensity = zone.ambient.fogDensity;
      this._targetParticleColor.setHex(zone.ambient.particleColor);
      this._targetLightColor.setHex(zone.ambient.lightColor);

      if (this.onZoneChanged) {
        this.onZoneChanged(old, zone);
      }
    }

    // Smooth lerp (0.02 per frame ≈ 2s transition at 60fps)
    const lerpFactor = 0.02;

    // Fog color
    if (this.scene.fog) {
      this.scene.fog.color.lerp(this._targetFogColor, lerpFactor);
      // Fog density lerp
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
}
