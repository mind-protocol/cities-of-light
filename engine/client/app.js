/**
 * Engine Client — Manifest-driven browser entry point.
 *
 * Replaces src/client/main.js with a parameterized version:
 *   - No hardcoded names, zones, or citizen shapes
 *   - World loaded from /api/manifest via WorldLoader
 *   - Entities arrive from engine WebSocket (entity_spawned, entity_moved)
 *   - Zone ambients and waypoints driven by manifest zones
 *   - Portal proximity detection (new)
 *
 * Reuses existing client modules from ../../src/client/:
 *   avatar, vr-controls, voice, network, zone-ambient,
 *   waypoints, teleport-transition, voice-chat
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { WorldLoader } from './world-loader.js';
import {
  SERVER_MESSAGES,
  CLIENT_MESSAGES,
} from '../shared/protocol.js';

// Reuse existing client modules (generic enough as-is)
import { createAvatar, createAICitizenAvatar, ensureHandMeshes, updateHandFromData } from '../../src/client/avatar.js';
import { VRControls } from '../../src/client/vr-controls.js';
import { SpatialVoice } from '../../src/client/voice.js';
import { Network } from '../../src/client/network.js';
import { TeleportTransition } from '../../src/client/teleport-transition.js';
import { VoiceChat } from '../../src/client/voice-chat.js';

// ─── Mode Detection ──────────────────────────────────────

const params = new URLSearchParams(location.search);
const streamMode = params.get('view') === 'manemus';
const roomCode = params.get('room') || null;
const visitorName = params.get('name') || null;
const spawnZoneId = params.get('spawn') || null;
const isQuest = /OculusBrowser|Quest/.test(navigator.userAgent);
const isPWA = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

// ─── Renderer ───────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(isQuest ? 1 : Math.min(window.devicePixelRatio, 2));
if (!streamMode) renderer.xr.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ─── Scene ──────────────────────────────────────────────

const scene = new THREE.Scene();

// ─── Camera ─────────────────────────────────────────────

const camera = new THREE.PerspectiveCamera(
  streamMode ? 90 : 70,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(8, 4, 8);

// ─── Desktop Controls (orbit + WASD) — disabled in stream mode ─

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI * 0.85;
controls.minDistance = 2;
controls.maxDistance = 50;
if (streamMode) controls.enabled = false;

// WASD movement
const keys = {};
if (!streamMode) {
  document.addEventListener('keydown', (e) => { keys[e.code] = true; });
  document.addEventListener('keyup', (e) => { keys[e.code] = false; });
}

function updateDesktopMovement(delta) {
  if (renderer.xr.isPresenting || streamMode) return;

  const speed = 8 * delta;
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  direction.y = 0;
  direction.normalize();

  const right = new THREE.Vector3();
  right.crossVectors(direction, camera.up).normalize();

  if (keys['KeyW'] || keys['ArrowUp']) {
    camera.position.addScaledVector(direction, speed);
    controls.target.addScaledVector(direction, speed);
  }
  if (keys['KeyS'] || keys['ArrowDown']) {
    camera.position.addScaledVector(direction, -speed);
    controls.target.addScaledVector(direction, -speed);
  }
  if (keys['KeyA'] || keys['ArrowLeft']) {
    camera.position.addScaledVector(right, -speed);
    controls.target.addScaledVector(right, -speed);
  }
  if (keys['KeyD'] || keys['ArrowRight']) {
    camera.position.addScaledVector(right, speed);
    controls.target.addScaledVector(right, speed);
  }
}

// ─── Lighting ───────────────────────────────────────────

const hemi = new THREE.HemisphereLight(0x87ceeb, 0xc9a96e, 0.4);
scene.add(hemi);

// ─── Atmospheric Fog (initial — overwritten by manifest) ─

scene.fog = new THREE.FogExp2(0x8faac0, 0.008);

// ─── Ambient Particles (fireflies) ──────────────────────

const particleCount = isQuest ? 30 : 60;
const particleGeom = new THREE.BufferGeometry();
const particlePositions = new Float32Array(particleCount * 3);
const particleSpeeds = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
  particlePositions[i * 3] = (Math.random() - 0.5) * 20;
  particlePositions[i * 3 + 1] = 0.5 + Math.random() * 4;
  particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 20;
  particleSpeeds[i * 3] = (Math.random() - 0.5) * 0.3;
  particleSpeeds[i * 3 + 1] = (Math.random() - 0.5) * 0.15;
  particleSpeeds[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
}
particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
const particleMat = new THREE.PointsMaterial({
  color: 0xffcc44,
  size: 0.08,
  transparent: true,
  opacity: 0.7,
  sizeAttenuation: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const fireflies = new THREE.Points(particleGeom, particleMat);
scene.add(fireflies);

// ─── WorldLoader ────────────────────────────────────────

const worldLoader = new WorldLoader(scene, renderer);

// ─── Teleport Transition ───────────────────────────────

const teleportTransition = new TeleportTransition();

// ─── VR Controls (locomotion + grab) ─────────────────────

const vrControls = new VRControls(renderer, camera, scene);

// ─── Local Avatar ───────────────────────────────────────
// Created once; color/name set after manifest + name resolution

let localAvatar = null;
let localAvatarName = 'Visitor';

// ─── Remote Entities (spawned by server) ────────────────

const remoteEntities = new Map(); // entityId -> THREE.Group

// ─── Network ────────────────────────────────────────────

const network = new Network();

// ─── Spatial Voice (STT -> LLM -> TTS) ────────────────────

const spatialVoice = new SpatialVoice();

// ─── Voice Chat (WebRTC spatial) ────────────────────────

const voiceChat = new VoiceChat(network);

// ─── Zone Ambient (wrapper for manifest zones) ──────────
// ZoneAmbient and Waypoints import from shared/zones.js. The engine
// client needs manifest-driven zones instead. We wrap them with thin
// adapters that accept zones via constructor/init.

/**
 * ManifestZoneAmbient — same logic as ZoneAmbient but takes zone
 * definitions from the manifest instead of the hardcoded ZONES array.
 */
class ManifestZoneAmbient {
  constructor(scene, hemiLight, particleMat) {
    this.scene = scene;
    this.hemiLight = hemiLight;
    this.particleMat = particleMat;
    this.currentZone = null;
    this.onZoneChanged = null;
    this._zones = [];

    this._targetFogColor = new THREE.Color();
    this._targetFogDensity = 0.008;
    this._targetParticleColor = new THREE.Color(0xffcc44);
    this._targetLightColor = new THREE.Color(0xffcc88);
    this._workColor = new THREE.Color();
  }

  /**
   * Set the zone list from the loaded manifest.
   * @param {Array} zones — array of zone objects with atmosphere fields
   */
  setZones(zones) {
    this._zones = zones;
  }

  _detectNearestZone(pos) {
    let nearest = this._zones[0];
    let minDist = Infinity;
    for (const zone of this._zones) {
      const zx = zone.position?.x ?? zone.position?.x ?? 0;
      const zz = zone.position?.z ?? zone.position?.z ?? 0;
      const dx = pos.x - zx;
      const dz = (pos.z !== undefined ? pos.z : 0) - zz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minDist) {
        minDist = dist;
        nearest = zone;
      }
    }
    return { zone: nearest, distance: minDist };
  }

  /**
   * Extract ambient colors from a manifest zone.
   * Manifest zones store atmosphere as:
   *   { fog_color, fog_density, particle_color, light_color, ... }
   * The old ZONES format used camelCase:
   *   { fogColor, fogDensity, particleColor, lightColor }
   * This normalizes both.
   */
  _getAmbient(zone) {
    // Direct ambient block (old format)
    if (zone.ambient) {
      return zone.ambient;
    }
    // Manifest atmosphere block
    const a = zone.atmosphere || {};
    return {
      fogColor: this._parseColor(a.fog_color) ?? 0x8faac0,
      fogDensity: a.fog_density ?? 0.008,
      particleColor: this._parseColor(a.particle_color) ?? 0xffcc44,
      lightColor: this._parseColor(a.light_color) ?? 0xffcc88,
    };
  }

  _parseColor(val) {
    if (val === undefined || val === null) return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseInt(val.replace('0x', ''), 16);
    return null;
  }

  update(playerPos, elapsed) {
    if (this._zones.length === 0) return;

    const { zone } = this._detectNearestZone(playerPos);
    if (!zone) return;

    if (!this.currentZone || this.currentZone.id !== zone.id) {
      const old = this.currentZone;
      this.currentZone = zone;

      const ambient = this._getAmbient(zone);
      this._targetFogColor.setHex(ambient.fogColor);
      this._targetFogDensity = ambient.fogDensity;
      this._targetParticleColor.setHex(ambient.particleColor);
      this._targetLightColor.setHex(ambient.lightColor);

      if (this.onZoneChanged) {
        this.onZoneChanged(old, zone);
      }
    }

    const lerpFactor = 0.02;

    if (this.scene.fog) {
      this.scene.fog.color.lerp(this._targetFogColor, lerpFactor);
      this.scene.fog.density += (this._targetFogDensity - this.scene.fog.density) * lerpFactor;
    }

    if (this.particleMat) {
      this.particleMat.color.lerp(this._targetParticleColor, lerpFactor);
    }

    if (this.hemiLight) {
      this.hemiLight.color.lerp(this._targetLightColor, lerpFactor);
    }
  }

  getZone() {
    return this.currentZone;
  }
}

/**
 * ManifestWaypoints — same visual logic as Waypoints but builds
 * beacons from manifest zone definitions instead of shared/zones.js.
 */
class ManifestWaypoints {
  constructor(scene) {
    this.scene = scene;
    this.beacons = [];
    this.onTeleport = null;
    this._zones = [];
    this._zonesById = new Map();
    this._interactDistance = 2.5;
    this._beaconHeight = 3;
    this._beaconRadius = 0.25;
  }

  /**
   * Set zones from the manifest and build all waypoint beacons.
   * @param {Array} zones — zone objects from manifest
   */
  setZones(zones) {
    // Clean up old beacons
    for (const b of this.beacons) {
      this.scene.remove(b.group);
    }
    this.beacons = [];

    this._zones = zones;
    this._zonesById.clear();
    for (const z of zones) {
      this._zonesById.set(z.id, z);
    }

    this._buildAll();
  }

  _getAmbient(zone) {
    if (zone.ambient) return zone.ambient;
    const a = zone.atmosphere || {};
    return {
      particleColor: this._parseColor(a.particle_color) ?? 0xffcc44,
    };
  }

  _parseColor(val) {
    if (val === undefined || val === null) return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseInt(val.replace('0x', ''), 16);
    return null;
  }

  _buildAll() {
    for (const zone of this._zones) {
      const waypointTargets = zone.waypoints || [];
      for (const targetId of waypointTargets) {
        const targetZone = this._zonesById.get(targetId);
        if (!targetZone) continue;

        const beacon = this._buildBeacon(zone, targetZone);
        this.scene.add(beacon.group);
        this.beacons.push(beacon);
      }
    }
  }

  _buildBeacon(fromZone, targetZone) {
    const group = new THREE.Group();

    const fromX = fromZone.position?.x ?? 0;
    const fromZ = fromZone.position?.z ?? 0;
    const toX = targetZone.position?.x ?? 0;
    const toZ = targetZone.position?.z ?? 0;

    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const angle = Math.atan2(dz, dx);
    const shoreRadius = 11;

    const worldX = fromX + Math.cos(angle) * shoreRadius;
    const worldZ = fromZ + Math.sin(angle) * shoreRadius;
    group.position.set(worldX, 0, worldZ);

    const ambient = this._getAmbient(targetZone);
    const color = new THREE.Color(ambient.particleColor);

    // Pillar
    const pillarGeom = new THREE.CylinderGeometry(
      this._beaconRadius * 0.6, this._beaconRadius, this._beaconHeight, 8
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
    pillar.position.y = this._beaconHeight / 2;
    pillar.castShadow = true;
    group.add(pillar);

    // Glow ring at base
    const ringGeom = new THREE.TorusGeometry(this._beaconRadius * 2, 0.06, 8, 24);
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
    light.position.y = this._beaconHeight + 0.5;
    group.add(light);

    // Label sprite
    const label = this._makeLabel(targetZone.name || targetZone.id, color);
    label.position.y = this._beaconHeight + 1;
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
    ctx.fillText(`\u2192 ${text}`, 128, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2, 0.5, 1);
    return sprite;
  }

  update(elapsed, playerPos, gripActive) {
    let nearestBeacon = null;
    let nearestDist = Infinity;

    for (const beacon of this.beacons) {
      beacon.ringMesh.rotation.z = elapsed * 0.5;
      beacon.ringMesh.material.opacity = 0.3 + Math.sin(elapsed * 2) * 0.2;
      beacon.pillarMesh.material.emissiveIntensity = 0.3 + Math.sin(elapsed * 1.5) * 0.2;

      const dist = playerPos.distanceTo(beacon.worldPosition);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestBeacon = beacon;
      }

      if (dist < this._interactDistance) {
        beacon.pillarMesh.material.emissiveIntensity = 0.8;
        beacon.ringMesh.material.opacity = 0.8;
      }
    }

    if (gripActive && nearestBeacon && nearestDist < this._interactDistance) {
      if (this.onTeleport) {
        this.onTeleport(nearestBeacon.targetZone);
      }
    }
  }
}

// ─── Instantiate manifest-driven systems ─────────────────

const zoneAmbient = new ManifestZoneAmbient(scene, hemi, particleMat);
zoneAmbient.onZoneChanged = (oldZone, newZone) => {
  console.log(`Zone: ${oldZone?.name || 'none'} -> ${newZone.name}`);
  const zoneEl = document.getElementById('zone-indicator');
  if (zoneEl) zoneEl.textContent = newZone.name;
};

const waypoints = new ManifestWaypoints(scene);
waypoints.onTeleport = (targetZone) => {
  const zx = targetZone.position?.x ?? 0;
  const zz = targetZone.position?.z ?? 0;
  console.log(`Teleporting to ${targetZone.name}`);
  teleportTransition.play(targetZone.name || targetZone.id, () => {
    const target = new THREE.Vector3(zx, 1.7, zz);
    if (renderer.xr.isPresenting) {
      vrControls.dolly.position.set(zx, 0, zz);
    } else {
      camera.position.set(zx + 8, 4, zz + 8);
      controls.target.set(zx, 1, zz);
    }
    network.sendTeleport(targetZone.id);
    network.sendPosition(target, camera.quaternion);
  });
};

// ─── Stream overlay ────────────────────────────────────

let _streamCitizenCount = null;

// ─── Portal state ──────────────────────────────────────

let _portalCooldown = 0; // prevent rapid portal re-entry

// ─── Prompt visitor name (if not supplied via URL) ──────

function resolveVisitorName() {
  if (visitorName) return visitorName;
  if (streamMode) return 'Stream Viewer';
  const stored = sessionStorage.getItem('col_visitor_name');
  if (stored) return stored;
  const prompted = prompt('Enter your name:', 'Visitor');
  const name = (prompted && prompted.trim()) || 'Visitor';
  sessionStorage.setItem('col_visitor_name', name);
  return name;
}

// ─── Manifest Load + World Init ─────────────────────────

async function initWorld() {
  // 1. Fetch manifest from engine API
  const manifestPath = '/api/manifest';
  let world;
  try {
    world = await worldLoader.load(manifestPath);
  } catch (e) {
    console.error('Failed to load world manifest:', e);
    // Fallback: try loading directly as JSON file
    try {
      world = await worldLoader.load('/worlds/venezia/world-manifest.json');
    } catch (e2) {
      console.error('World load failed completely:', e2);
      return;
    }
  }

  // 2. Extract zones as array for ambient + waypoints
  const zones = worldLoader.getZonesArray();
  zoneAmbient.setZones(zones);
  waypoints.setZones(zones);

  // 3. Resolve visitor identity
  localAvatarName = resolveVisitorName();

  // 4. Create local avatar
  localAvatar = createAvatar({ color: 0x00ff88, name: localAvatarName });
  localAvatar.position.set(0, 0, 0);
  // Remove local name label (remotes see it via network sync)
  const localLabel = localAvatar.children.find(c => c.isSprite);
  if (localLabel) localAvatar.remove(localLabel);
  scene.add(localAvatar);

  // 5. If spawn zone specified, move to it
  if (spawnZoneId) {
    const spawnZone = worldLoader.getZone(spawnZoneId);
    if (spawnZone) {
      const sx = spawnZone.position.x;
      const sz = spawnZone.position.z;
      camera.position.set(sx + 8, 4, sz + 8);
      controls.target.set(sx, 1, sz);
      localAvatar.position.set(sx, 0, sz);
    }
  }

  // 6. Hide avatar in stream mode
  if (streamMode) {
    localAvatar.visible = false;
  }

  // 7. Connect to server
  connectNetwork();

  // 8. Setup voice
  setupVoice();

  // 9. Setup WebXR
  setupWebXR();

  console.log(`World initialized: ${world.manifest.display_name || world.manifest.name}`);
  console.log(`Visitor: ${localAvatarName}, zones: ${zones.length}`);
}

// ─── Network Connection ─────────────────────────────────

function connectNetwork() {
  try {
    if (streamMode) {
      network.connect('Stream Viewer', null, { spectator: true });
    } else {
      network.connect(localAvatarName, null, { roomCode });

      network.startPositionSync(() => {
        if (renderer.xr.isPresenting && localAvatar) {
          return {
            position: {
              x: localAvatar.position.x,
              y: localAvatar.children[0]?.position.y || 1.7,
              z: localAvatar.position.z,
            },
            rotation: localAvatar.children[0]?.quaternion || camera.quaternion,
          };
        }
        return { position: camera.position, rotation: camera.quaternion };
      }, 100);

      // Init voice chat on first user gesture
      const initVoiceChat = async () => {
        if (voiceChat.enabled) return;
        await voiceChat.init();
        console.log('Voice chat ready');
        document.removeEventListener('click', initVoiceChat);
      };
      document.addEventListener('click', initVoiceChat);
      renderer.xr.addEventListener('sessionstart', initVoiceChat);
    }
  } catch (e) {
    console.log('Server not available, running offline');
  }
}

// ─── Voice Setup ────────────────────────────────────────

function setupVoice() {
  // Stream viewers: enable audio on first click (browser autoplay policy)
  if (streamMode) {
    const enableAudio = () => {
      spatialVoice._ensurePlayback();
      if (spatialVoice.audioContext?.state === 'suspended') {
        spatialVoice.audioContext.resume();
      }
      console.log('Stream audio enabled');
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('touchstart', enableAudio);
    };
    document.addEventListener('click', enableAudio);
    document.addEventListener('touchstart', enableAudio);

    // Stream mode: init audio playback (no mic)
    document.addEventListener('click', async () => {
      if (!spatialVoice.audioContext) {
        spatialVoice.audioContext = new AudioContext({ sampleRate: 44100 });
        spatialVoice.pannerNode = spatialVoice.audioContext.createPanner();
        spatialVoice.pannerNode.panningModel = 'HRTF';
        spatialVoice.pannerNode.distanceModel = 'inverse';
        spatialVoice.pannerNode.refDistance = 1;
        spatialVoice.pannerNode.maxDistance = 50;
        spatialVoice.pannerNode.rolloffFactor = 1;
        spatialVoice.pannerNode.coneInnerAngle = 360;
        spatialVoice.pannerNode.coneOuterAngle = 360;
        spatialVoice.pannerNode.connect(spatialVoice.audioContext.destination);
        console.log('Stream audio initialized');
      }
    }, { once: true });
  } else {
    // Init mic on first user gesture (browser requirement)
    async function initVoice() {
      if (spatialVoice.audioContext) return;
      const ok = await spatialVoice.init();
      if (ok) {
        spatialVoice.onRecordingComplete = (base64) => {
          network.sendVoice(base64);
        };
      }
    }

    // Push-to-talk (VR: A button on right controller)
    vrControls.onPushToTalkStart = () => {
      initVoice().then(() => spatialVoice.startRecording());
    };
    vrControls.onPushToTalkEnd = () => {
      spatialVoice.stopRecording();
    };

    // Desktop push-to-talk: hold Space bar
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat && !renderer.xr.isPresenting) {
        e.preventDefault();
        initVoice().then(() => spatialVoice.startRecording());
      }
    });
    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space' && !renderer.xr.isPresenting) {
        spatialVoice.stopRecording();
      }
    });
  }
}

// ─── Network Handlers (voice streaming) ─────────────────

// Voice streams play from the speaking entity's position
network.onVoiceStreamStart = (msg) => {
  // Find entity position to spatialize from
  const entity = remoteEntities.get(msg.entityId || msg.citizenId);
  const pos = entity ? entity.position : new THREE.Vector3(0, 1.5, 0);
  spatialVoice.handleStreamStart(msg, pos);
};
network.onVoiceStreamData = (msg) => {
  spatialVoice.handleStreamData(msg);
};
network.onVoiceStreamEnd = (msg) => {
  spatialVoice.handleStreamEnd(msg);
};

// Citizen raw voice (hear other visitors speaking)
network.onCitizenVoice = (msg) => {
  if (msg.audio) {
    const entity = remoteEntities.get(msg.citizenId);
    const pos = entity ? entity.position : (localAvatar ? localAvatar.position : new THREE.Vector3());
    spatialVoice.playRawAtPosition(msg.audio, pos);
  }
};

// Biography voice (archived answers from memorial positions)
network.onBiographyStreamStart = (msg) => {
  const entity = remoteEntities.get(msg.entityId || msg.citizenId);
  const pos = entity ? entity.position : new THREE.Vector3(0, 1.5, 0);
  spatialVoice.handleStreamStart(msg, pos);
};
network.onBiographyStreamData = (msg) => {
  spatialVoice.handleStreamData(msg);
};
network.onBiographyStreamEnd = (msg) => {
  spatialVoice.handleStreamEnd(msg);
};

// AI entity speech — subtitle + spatial audio
network.onAICitizenSpeak = (msg) => {
  console.log(`[AI] ${msg.citizenName}: "${msg.text}"`);
  const entity = remoteEntities.get(msg.citizenId);
  const pos = entity
    ? entity.position
    : new THREE.Vector3(msg.position?.x || 0, msg.position?.y || 1.2, msg.position?.z || 0);
  spatialVoice.showTranscription(`[${msg.citizenName}]`, msg.text);
};

// Legacy non-streaming fallback
network.onVoiceResponse = (msg) => {
  if (msg.audio) {
    const entity = remoteEntities.get(msg.entityId || msg.citizenId);
    const pos = entity ? entity.position : new THREE.Vector3(0, 1.5, 0);
    spatialVoice.playAtPosition(msg.audio, pos);
  }
  if (msg.transcription && msg.response) {
    spatialVoice.showTranscription(msg.transcription, msg.response);
  }
  if (msg.latency) console.log(`${msg.latency}ms round-trip`);
};

// ─── Network Handlers (entity sync) ─────────────────────

// Stream mode: receive camera position from VR client
let _lastManualCamUpdate = 0;
network.onManemusCameraUpdate = (msg) => {
  if (streamMode && msg.position) {
    _lastManualCamUpdate = performance.now();
    // In stream mode, the camera follows this broadcast position
  }
};

// Entity spawned (citizens + AI entities arrive from server)
network.onCitizenJoined = (msg) => {
  if (remoteEntities.has(msg.citizenId)) return;
  console.log(`Entity joined: ${msg.name} ${msg.persona === 'ai' ? '(AI)' : ''}`);

  let avatar;
  if (msg.persona === 'ai' && msg.aiShape) {
    avatar = createAICitizenAvatar({
      color: msg.aiColor || 0xffffff,
      name: msg.name || msg.citizenId,
      shape: msg.aiShape || 'icosahedron',
    });
    avatar.userData.isAI = true;
  } else {
    avatar = createAvatar({
      color: msg.color || 0x44aaff,
      name: msg.name || msg.citizenId,
    });
  }
  scene.add(avatar);
  remoteEntities.set(msg.citizenId, avatar);
};

// Entity moved
network.onCitizenMoved = (msg) => {
  const avatar = remoteEntities.get(msg.citizenId);
  if (avatar && msg.position) {
    avatar.position.lerp(
      new THREE.Vector3(msg.position.x, 0, msg.position.z),
      0.3
    );
    const head = avatar.children[0];
    if (head && msg.position.y) {
      head.position.y = msg.position.y;
    }
    if (msg.rotation && head) {
      head.quaternion.slerp(
        new THREE.Quaternion(msg.rotation.x, msg.rotation.y, msg.rotation.z, msg.rotation.w),
        0.3
      );
    }
  }
};

// Entity hands (hand/controller tracking data)
network.onCitizenHands = (msg) => {
  const avatar = remoteEntities.get(msg.citizenId);
  if (avatar && msg.hands) {
    const meshes = ensureHandMeshes(avatar, avatar.userData.isAI ? 0xffffff : 0x44aaff);
    if (meshes) {
      updateHandFromData(meshes.left, msg.hands.left);
      updateHandFromData(meshes.right, msg.hands.right);
    }
  }
};

// Entity left
network.onCitizenLeft = (msg) => {
  voiceChat.removePeer(msg.citizenId);
  const avatar = remoteEntities.get(msg.citizenId);
  if (avatar) {
    scene.remove(avatar);
    remoteEntities.delete(msg.citizenId);
    console.log(`Entity left: ${msg.citizenId}`);
  }
};

// ─── Network Handlers (WebRTC voice chat) ─────────────────

network.onSignaling = (msg) => {
  if (!voiceChat.enabled) return;
  switch (msg.sigType) {
    case 'webrtc_offer':
      voiceChat.handleOffer(msg.fromCitizenId, msg.sdp);
      break;
    case 'webrtc_answer':
      voiceChat.handleAnswer(msg.fromCitizenId, msg.sdp);
      break;
    case 'ice_candidate':
      voiceChat.handleIceCandidate(msg.fromCitizenId, msg.candidate);
      break;
  }
};

network.onVoicePeers = async (msg) => {
  if (!voiceChat.enabled) {
    await voiceChat.init();
  }
  if (voiceChat.enabled && msg.peers) {
    for (const peer of msg.peers) {
      voiceChat.createOffer(peer.citizenId);
    }
  }
};

network.onRoomJoined = (msg) => {
  console.log(`Joined room: ${msg.roomName} (${msg.roomCode})`);
  const roomEl = document.getElementById('room-indicator');
  if (roomEl) roomEl.textContent = `${msg.roomName} [${msg.roomCode}]`;
};

// ─── Desktop Drag (click + drag entities in 3D) ─────────

const raycaster = new THREE.Raycaster();
const mouseVec = new THREE.Vector2();
const dragPlane = new THREE.Plane();
let dragTarget = null;

if (!streamMode) {
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (renderer.xr.isPresenting) return;

    mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouseVec, camera);

    // Check all remote entities for drag
    for (const [, entity] of remoteEntities) {
      const hits = raycaster.intersectObject(entity, true);
      if (hits.length > 0) {
        dragTarget = entity;
        controls.enabled = false;
        const normal = new THREE.Vector3();
        camera.getWorldDirection(normal);
        dragPlane.setFromNormalAndCoplanarPoint(normal, entity.position);
        break;
      }
    }
  });

  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!dragTarget) return;

    mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouseVec, camera);
    const target = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(dragPlane, target)) {
      dragTarget.position.copy(target);
    }
  });

  renderer.domElement.addEventListener('pointerup', () => {
    if (dragTarget) {
      dragTarget = null;
      controls.enabled = true;
    }
  });
}

// ─── WebXR Setup ────────────────────────────────────────

function setupWebXR() {
  const vrButton = document.getElementById('enter-vr');
  const info = document.getElementById('info');

  if (streamMode) {
    // Stream mode: hide all interactive UI
    if (vrButton) vrButton.style.display = 'none';
    if (info) info.style.display = 'none';
    const status = document.getElementById('status');
    if (status) status.style.display = 'none';
    const voiceStatus = document.getElementById('voice-status');
    if (voiceStatus) voiceStatus.style.display = 'none';

    // Stream overlay: LIVE indicator + citizen count + watermark
    const overlay = document.createElement('div');
    overlay.innerHTML = `
      <div style="position:fixed;top:20px;left:20px;z-index:200;display:flex;align-items:center;gap:10px;">
        <div style="width:10px;height:10px;border-radius:50%;background:#ff0000;animation:pulse 2s infinite;box-shadow:0 0 8px rgba(255,0,0,0.6);"></div>
        <span style="color:#ff4444;font-family:'Courier New',monospace;font-size:13px;text-shadow:0 0 10px rgba(255,0,0,0.5);letter-spacing:1px;">LIVE</span>
        <span id="stream-citizen-count" style="color:rgba(0,255,136,0.6);font-family:'Courier New',monospace;font-size:11px;margin-left:8px;">Waiting for citizens...</span>
      </div>
      <div style="position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:200;color:rgba(255,255,255,0.25);font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;">
        CITIES OF LIGHT
      </div>
      <div style="position:fixed;bottom:16px;right:20px;z-index:200;color:rgba(255,255,255,0.2);font-family:'Courier New',monospace;font-size:10px;">
        mindprotocol.ai
      </div>
      <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}</style>
    `;
    document.body.appendChild(overlay);
    _streamCitizenCount = document.getElementById('stream-citizen-count');
    return;
  }

  if (!vrButton) return;

  function enableVRButton() {
    vrButton.textContent = 'Enter Cities of Light';
    vrButton.disabled = false;
    vrButton.addEventListener('click', async () => {
      try {
        const session = await navigator.xr.requestSession('immersive-vr', {
          optionalFeatures: ['local-floor', 'hand-tracking'],
        });
        renderer.xr.setSession(session);
        vrButton.style.display = 'none';
        if (info) info.style.display = 'none';
        controls.enabled = false;
        if (localAvatar) localAvatar.visible = false;
      } catch (err) {
        console.error('Failed to start XR session:', err);
        vrButton.textContent = 'XR Session Failed';
      }
    });
  }

  if ('xr' in navigator) {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn('WebXR isSessionSupported timed out -- enabling button anyway');
        enableVRButton();
      }
    }, 3000);

    navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      if (supported) {
        enableVRButton();
      } else {
        vrButton.textContent = 'Desktop Mode (WASD + Mouse)';
        vrButton.disabled = true;
        vrButton.style.opacity = '0.5';
      }
    }).catch(() => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      enableVRButton();
    });
  } else {
    vrButton.textContent = 'Desktop Mode (WASD + Mouse)';
    vrButton.disabled = true;
    vrButton.style.opacity = '0.5';
  }

  // PWA auto-enter VR (Quest considers app launch a user gesture)
  if (isPWA && 'xr' in navigator) {
    (async () => {
      try {
        const session = await navigator.xr.requestSession('immersive-vr', {
          optionalFeatures: ['local-floor', 'hand-tracking'],
        });
        renderer.xr.setSession(session);
        if (vrButton) vrButton.style.display = 'none';
        if (info) info.style.display = 'none';
        controls.enabled = false;
        if (localAvatar) localAvatar.visible = false;
        console.log('PWA auto-entered VR');
      } catch (e) {
        console.warn('PWA auto-VR failed, showing button:', e);
      }
    })();
  }
}

// ─── Animation Loop ─────────────────────────────────────

const clock = new THREE.Clock();
let _lastCamBroadcast = 0;
// Pre-allocated temporaries (zero per-frame allocs)
const _voiceFwd = new THREE.Vector3();
const _voiceCitizenPositions = new Map();
const _waypointPlayerPos = new THREE.Vector3();
const _portalCheckPos = new THREE.Vector3();

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // Desktop movement
  updateDesktopMovement(delta);
  if (!streamMode) controls.update();

  // VR locomotion + snap turn + grab
  if (!streamMode) vrControls.update(delta);

  // Foveated rendering (Quest 3)
  if (renderer.xr.isPresenting && renderer.xr.setFoveation && !renderer._foveationSet) {
    renderer.xr.setFoveation(1.0);
    renderer._foveationSet = true;
  }

  // In XR mode, track headset position (for network sync)
  if (renderer.xr.isPresenting && localAvatar) {
    vrControls.dolly.updateMatrixWorld(true);

    const xrCamera = renderer.xr.getCamera();
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    xrCamera.getWorldPosition(worldPos);
    xrCamera.getWorldQuaternion(worldQuat);

    localAvatar.position.set(worldPos.x, 0, worldPos.z);
    const head = localAvatar.children[0];
    if (head) {
      head.quaternion.copy(worldQuat);
      head.position.y = worldPos.y;
    }
    localAvatar.visible = false;

    // Broadcast camera/hand data (~10fps)
    if (elapsed - _lastCamBroadcast > 0.1) {
      const handsData = vrControls.getHandsData();
      if (handsData) network.sendHands(handsData);
      _lastCamBroadcast = elapsed;
    }
  } else if (!streamMode) {
    if (elapsed - _lastCamBroadcast > 0.1) {
      _lastCamBroadcast = elapsed;
    }
  }

  // Animate fireflies — gentle floating motion
  {
    const pos = fireflies.geometry.attributes.position;
    for (let i = 0; i < particleCount; i++) {
      const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
      pos.array[ix] += Math.sin(elapsed * particleSpeeds[ix] + i) * 0.003;
      pos.array[iy] += Math.sin(elapsed * 0.5 + i * 1.7) * 0.002;
      pos.array[iz] += Math.cos(elapsed * particleSpeeds[iz] + i) * 0.003;
    }
    pos.needsUpdate = true;
    particleMat.opacity = 0.4 + Math.sin(elapsed * 0.8) * 0.3;
  }

  // Zone ambient transitions (fog, light, particle color)
  {
    const playerPos = renderer.xr.isPresenting && localAvatar
      ? localAvatar.position
      : camera.position;
    zoneAmbient.update(playerPos, elapsed);
  }

  // Waypoint beacons (animate + check teleport interaction)
  {
    const playerPos = renderer.xr.isPresenting && localAvatar
      ? _waypointPlayerPos.copy(localAvatar.position).setY(localAvatar.children[0]?.position.y || 1.7)
      : camera.position;
    const gripActive = vrControls.isGripping?.() || false;
    waypoints.update(elapsed, playerPos, gripActive);
  }

  // Portal proximity detection
  {
    if (_portalCooldown > 0) {
      _portalCooldown -= delta;
    } else {
      const playerPos = renderer.xr.isPresenting && localAvatar
        ? _portalCheckPos.set(localAvatar.position.x, localAvatar.children[0]?.position.y || 1.7, localAvatar.position.z)
        : _portalCheckPos.copy(camera.position);

      const portal = worldLoader.checkPortalProximity(playerPos, 3);
      if (portal && !streamMode) {
        _portalCooldown = 5; // 5 second cooldown between portal triggers
        console.log(`Portal triggered: ${portal.label || portal.id} -> ${portal.targetManifest}`);

        teleportTransition.play(portal.label || 'Portal', () => {
          // Navigate to the target world
          if (portal.targetManifest) {
            const targetUrl = new URL(window.location.href);
            targetUrl.searchParams.set('world', portal.targetManifest);
            if (portal.targetSpawn) {
              targetUrl.searchParams.set('spawn', portal.targetSpawn);
            }
            if (localAvatarName && localAvatarName !== 'Visitor') {
              targetUrl.searchParams.set('name', localAvatarName);
            }
            window.location.href = targetUrl.toString();
          }
        });
      }
    }
  }

  // Animate AI entity meshes (rotation + glow pulse)
  for (const [, avatar] of remoteEntities) {
    if (avatar.userData.isAI) {
      const body = avatar.children[0];
      if (body) body.rotation.y = elapsed * 0.5;
      const ring = avatar.children.find(c => c.geometry?.type === 'TorusGeometry');
      if (ring) ring.rotation.z = elapsed * 0.3;
      if (body?.material) {
        body.material.emissiveIntensity = 0.4 + Math.sin(elapsed * 2) * 0.2;
      }
    }
  }

  // Stream mode: camera follows VR broadcast, tracks entities, or cinematic orbit
  if (streamMode) {
    const manualActive = (performance.now() - _lastManualCamUpdate) < 2000;

    if (manualActive) {
      // VR client actively controlling — follow their broadcast
      // (position arrives via onManemusCameraUpdate)
    } else if (remoteEntities.size > 0) {
      // Entities present — track nearest from a close orbit
      let nearest = null;
      let nearDist = Infinity;
      for (const [, avatar] of remoteEntities) {
        const d = new THREE.Vector3(0, 0, 0).distanceTo(avatar.position);
        if (d < nearDist) { nearDist = d; nearest = avatar; }
      }
      if (nearest) {
        const headY = nearest.children[0]?.position.y || 1.7;
        const target = new THREE.Vector3(nearest.position.x, headY, nearest.position.z);
        const orbitAngle = elapsed * 0.08;
        const orbitR = 3.5;
        camera.position.set(
          target.x + Math.cos(orbitAngle) * orbitR,
          target.y + 0.5,
          target.z + Math.sin(orbitAngle) * orbitR
        );
        camera.lookAt(target);
      }
    } else {
      // No one here — cinematic slow orbit around origin
      const orbitAngle = elapsed * 0.05;
      const orbitRadius = 8;
      const orbitHeight = 3 + Math.sin(elapsed * 0.1) * 0.8;
      camera.position.set(
        Math.cos(orbitAngle) * orbitRadius,
        orbitHeight,
        Math.sin(orbitAngle) * orbitRadius
      );
      camera.lookAt(0, 1, 0);
    }

    // Update entity counter in stream overlay
    if (_streamCitizenCount) {
      const count = remoteEntities.size;
      _streamCitizenCount.textContent = count > 0
        ? `${count} citizen${count > 1 ? 's' : ''} present`
        : 'Waiting for citizens...';
    }
  }

  // Spatial audio listener follows camera/headset
  spatialVoice.updateListener(camera);

  // Voice chat spatial positioning (WebRTC peer audio)
  if (voiceChat.enabled) {
    const listenerPos = renderer.xr.isPresenting && localAvatar
      ? { x: localAvatar.position.x, y: localAvatar.children[0]?.position.y || 1.7, z: localAvatar.position.z }
      : { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    camera.getWorldDirection(_voiceFwd);
    const fwd = { x: _voiceFwd.x, y: _voiceFwd.y, z: _voiceFwd.z };
    _voiceCitizenPositions.clear();
    for (const [cid, avatar] of remoteEntities) {
      const head = avatar.children[0];
      _voiceCitizenPositions.set(cid, {
        x: avatar.position.x,
        y: head?.position.y || 1.7,
        z: avatar.position.z,
      });
    }
    voiceChat.updatePositions(listenerPos, fwd, _voiceCitizenPositions);
  }

  renderer.render(scene, camera);
});

// ─── Resize ─────────────────────────────────────────────

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Cleanup ────────────────────────────────────────────

window.addEventListener('beforeunload', () => {
  network.disconnect();
  voiceChat.dispose();
});

// ─── Boot ───────────────────────────────────────────────

initWorld().catch((e) => {
  console.error('Engine client initialization failed:', e);
});
