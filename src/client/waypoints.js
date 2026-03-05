/**
 * Waypoints — glowing beacon pillars for fast travel between zones.
 *
 * Each zone has waypoint beacons pointing to connected zones.
 * Grip/pinch within 2m triggers teleport to target zone center.
 */

import * as THREE from 'three';
import { ZONES, getZoneById } from '../shared/zones.js';

const INTERACT_DISTANCE = 2.5; // meters
const BEACON_HEIGHT = 3;
const BEACON_RADIUS = 0.25;

export class Waypoints {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.beacons = []; // { mesh, targetZone, ringMesh, label }
    this.onTeleport = null; // callback(targetZone)

    this._buildAll();
  }

  _buildAll() {
    for (const zone of ZONES) {
      for (const targetId of zone.waypoints) {
        const targetZone = getZoneById(targetId);
        if (!targetZone) continue;

        const beacon = this._buildBeacon(zone, targetZone);
        this.scene.add(beacon.group);
        this.beacons.push(beacon);
      }
    }
  }

  _buildBeacon(fromZone, targetZone) {
    const group = new THREE.Group();

    // Place beacon on the shore facing the target zone
    const dx = targetZone.position.x - fromZone.position.x;
    const dz = targetZone.position.z - fromZone.position.z;
    const angle = Math.atan2(dz, dx);
    const shoreRadius = 11; // just inside island edge

    const worldX = fromZone.position.x + Math.cos(angle) * shoreRadius;
    const worldZ = fromZone.position.z + Math.sin(angle) * shoreRadius;
    group.position.set(worldX, 0, worldZ);

    // Target zone color
    const color = new THREE.Color(targetZone.ambient.particleColor);

    // Pillar
    const pillarGeom = new THREE.CylinderGeometry(BEACON_RADIUS * 0.6, BEACON_RADIUS, BEACON_HEIGHT, 8);
    const pillarMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.5,
      metalness: 0.3,
      roughness: 0.4,
      transparent: true,
      opacity: 0.8,
    });
    const pillar = new THREE.Mesh(pillarGeom, pillarMat);
    pillar.position.y = BEACON_HEIGHT / 2;
    pillar.castShadow = true;
    group.add(pillar);

    // Glow ring at base
    const ringGeom = new THREE.TorusGeometry(BEACON_RADIUS * 2, 0.06, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.5,
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    group.add(ring);

    // Point light
    const light = new THREE.PointLight(color.getHex(), 0.5, 6);
    light.position.y = BEACON_HEIGHT + 0.5;
    group.add(light);

    // Label sprite
    const label = this._makeLabel(targetZone.name, color);
    label.position.y = BEACON_HEIGHT + 1;
    group.add(label);

    return {
      group,
      targetZone,
      fromZone,
      ringMesh: ring,
      pillarMesh: pillar,
      worldPosition: new THREE.Vector3(worldX, 0, worldZ),
    };
  }

  _makeLabel(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = `#${color.getHexString()}`;
    ctx.textAlign = 'center';
    ctx.fillText(`→ ${text}`, 128, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2, 0.5, 1);
    return sprite;
  }

  /**
   * Call every frame. Animates rings and checks proximity for interaction.
   * @param {number} elapsed - time since start
   * @param {THREE.Vector3} playerPos - world position of player
   * @param {boolean} gripActive - true if player is gripping/pinching
   */
  update(elapsed, playerPos, gripActive) {
    let nearestBeacon = null;
    let nearestDist = Infinity;

    for (const beacon of this.beacons) {
      // Animate ring rotation + pulse
      beacon.ringMesh.rotation.z = elapsed * 0.5;
      beacon.ringMesh.material.opacity = 0.3 + Math.sin(elapsed * 2) * 0.2;
      beacon.pillarMesh.material.emissiveIntensity = 0.3 + Math.sin(elapsed * 1.5) * 0.2;

      // Check proximity
      const dist = playerPos.distanceTo(beacon.worldPosition);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestBeacon = beacon;
      }

      // Visual feedback: brighten when player is close
      if (dist < INTERACT_DISTANCE) {
        beacon.pillarMesh.material.emissiveIntensity = 0.8;
        beacon.ringMesh.material.opacity = 0.8;
      }
    }

    // Teleport on grip when close enough
    if (gripActive && nearestBeacon && nearestDist < INTERACT_DISTANCE) {
      if (this.onTeleport) {
        this.onTeleport(nearestBeacon.targetZone);
      }
    }
  }
}
