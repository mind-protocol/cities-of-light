/**
 * WaypointsEngine — Teleport beacon system.
 *
 * Engine version: receives zones from WorldLoader manifest
 * instead of importing from shared/zones.js.
 *
 * Zones come from WorldLoader._setupZones(), which stores atmosphere
 * data with snake_case keys. Waypoints are zone ID arrays, positions
 * are THREE.Vector3 or {x, y, z} objects.
 *
 * Usage:
 *   const world = await worldLoader.load(manifestPath);
 *   const zones = worldLoader.getZonesArray();
 *   const waypoints = new WaypointsEngine(scene, zones);
 *   waypoints.onTeleport = (targetZone) => { ... };
 *   // each frame:
 *   waypoints.update(elapsed, playerPos, gripActive);
 */

import * as THREE from 'three';

const INTERACT_DISTANCE = 2.5; // meters
const BEACON_HEIGHT = 3;
const BEACON_RADIUS = 0.25;

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
  return 0xffcc44;
}

/**
 * Get the particle color from a zone's atmosphere, handling both
 * the original shared/zones.js format (ambient.particleColor as number)
 * and the manifest format (atmosphere.particle_color as string).
 *
 * @param {object} zone
 * @returns {number} — hex color value
 */
function getZoneParticleColor(zone) {
  // Manifest format (snake_case atmosphere)
  if (zone.atmosphere && zone.atmosphere.particle_color != null) {
    return parseColor(zone.atmosphere.particle_color);
  }
  // Original format (camelCase ambient) — fallback for compatibility
  if (zone.ambient && zone.ambient.particleColor != null) {
    return parseColor(zone.ambient.particleColor);
  }
  return 0xffcc44;
}

export class WaypointsEngine {
  /**
   * @param {THREE.Scene} scene
   * @param {Array} zones — zone objects from WorldLoader.getZonesArray()
   */
  constructor(scene, zones) {
    if (!zones || zones.length === 0) {
      throw new Error('WaypointsEngine requires at least one zone');
    }

    this.scene = scene;
    this.zones = zones;
    this.beacons = []; // { group, targetZone, fromZone, ringMesh, pillarMesh, worldPosition }

    /** @type {function(object): void | null} */
    this.onTeleport = null;

    // Build a zone lookup map for resolving waypoint IDs
    this._zoneMap = new Map();
    for (const zone of zones) {
      this._zoneMap.set(zone.id, zone);
    }

    this._buildAll();
  }

  /**
   * Build all waypoint beacons for every zone's waypoint connections.
   * Each zone lists target zone IDs in its waypoints array.
   */
  _buildAll() {
    for (const zone of this.zones) {
      const waypointIds = zone.waypoints || [];

      for (const targetId of waypointIds) {
        const targetZone = this._zoneMap.get(targetId);
        if (!targetZone) continue;

        const beacon = this._buildBeacon(zone, targetZone);
        this.scene.add(beacon.group);
        this.beacons.push(beacon);
      }
    }
  }

  /**
   * Build a single waypoint beacon pillar between two zones.
   * Placed on the shore of fromZone, facing targetZone.
   *
   * @param {object} fromZone
   * @param {object} targetZone
   * @returns {object} — beacon descriptor
   */
  _buildBeacon(fromZone, targetZone) {
    const group = new THREE.Group();

    // Get positions (handle both plain objects and THREE.Vector3)
    const fromX = fromZone.position.x;
    const fromZ = fromZone.position.z;
    const toX = targetZone.position.x;
    const toZ = targetZone.position.z;

    // Place beacon on the shore facing the target zone
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const angle = Math.atan2(dz, dx);
    const shoreRadius = 11; // just inside island edge

    const worldX = fromX + Math.cos(angle) * shoreRadius;
    const worldZ = fromZ + Math.sin(angle) * shoreRadius;
    group.position.set(worldX, 0, worldZ);

    // Target zone color
    const colorHex = getZoneParticleColor(targetZone);
    const color = new THREE.Color(colorHex);

    // Pillar
    const pillarGeom = new THREE.CylinderGeometry(
      BEACON_RADIUS * 0.6, BEACON_RADIUS, BEACON_HEIGHT, 8
    );
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

  /**
   * Create a text label sprite for a beacon.
   *
   * @param {string} text — target zone display name
   * @param {THREE.Color} color — label color
   * @returns {THREE.Sprite}
   */
  _makeLabel(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = `#${color.getHexString()}`;
    ctx.textAlign = 'center';
    ctx.fillText(`\u2192 ${text}`, 128, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2, 0.5, 1);
    return sprite;
  }

  /**
   * Call every frame. Animates beacon rings and checks proximity
   * for teleport interaction.
   *
   * @param {number} elapsed — time since start (seconds)
   * @param {THREE.Vector3} playerPos — world position of player
   * @param {boolean} gripActive — true if player is gripping/pinching
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

  /**
   * Remove all beacons from the scene and dispose geometry/materials.
   * Call before replacing zones or unloading the world.
   */
  dispose() {
    for (const beacon of this.beacons) {
      this.scene.remove(beacon.group);
      beacon.group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
    }
    this.beacons = [];
    this._zoneMap.clear();
  }

  /**
   * Replace the zones array at runtime (e.g., after world transition).
   * Rebuilds all beacons.
   * @param {Array} zones
   */
  setZones(zones) {
    if (!zones || zones.length === 0) {
      throw new Error('WaypointsEngine requires at least one zone');
    }
    this.dispose();
    this.zones = zones;
    this._zoneMap = new Map();
    for (const zone of zones) {
      this._zoneMap.set(zone.id, zone);
    }
    this._buildAll();
  }
}
