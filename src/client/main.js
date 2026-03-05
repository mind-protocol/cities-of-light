/**
 * Cities of Light — Phase 1: First Encounter
 *
 * Three presences on an island:
 *   Nicolas  — human in VR headset (head-tracked avatar)
 *   Marco    — Manemus's incarnation (camera body, receives perception)
 *   Manemus  — streaming camera (stays in place, POV → browser → OBS → Telegram/X)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEnvironment, updateEnvironment } from './scene.js';
import { createAvatar, createAICitizenAvatar, ensureHandMeshes, updateHandFromData } from './avatar.js';
import { createCameraBody } from './camera-body.js';
import { Network } from './network.js';
import { VRControls } from './vr-controls.js';
import { ManemusEyes } from './perception.js';
import { SpatialVoice } from './voice.js';
import { MemorialManager } from './memorial-manager.js';
import { ZoneAmbient } from './zone-ambient.js';
import { Waypoints } from './waypoints.js';

// ─── Mode Detection ──────────────────────────────────────
// ?view=manemus → stream mode (spectator from Manemus POV)
const params = new URLSearchParams(location.search);
const streamMode = params.get('view') === 'manemus';
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

// ─── Atmospheric Fog ────────────────────────────────────
scene.fog = new THREE.FogExp2(0x8faac0, 0.008);

// ─── World (sky + water + island) ───────────────────────

const env = createEnvironment(scene, renderer);
scene.add(env.group);

// ─── Ambient Particles (fireflies) ──────────────────────

const particleCount = isQuest ? 30 : 60;
const particleGeom = new THREE.BufferGeometry();
const particlePositions = new Float32Array(particleCount * 3);
const particleSpeeds = new Float32Array(particleCount * 3); // velocity seeds
for (let i = 0; i < particleCount; i++) {
  // Scatter around island area
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

// ─── Zone Ambient (fog/light transitions between zones) ──

const zoneAmbient = new ZoneAmbient(scene, hemi, particleMat);
zoneAmbient.onZoneChanged = (oldZone, newZone) => {
  console.log(`Zone: ${oldZone?.name || 'none'} → ${newZone.name}`);
  // Update zone indicator in UI
  const zoneEl = document.getElementById('zone-indicator');
  if (zoneEl) zoneEl.textContent = newZone.name;
};

// ─── Waypoints (teleport beacons between zones) ─────────

const waypoints = new Waypoints(scene);
waypoints.onTeleport = (targetZone) => {
  console.log(`Teleporting to ${targetZone.name}`);
  const target = new THREE.Vector3(targetZone.position.x, 1.7, targetZone.position.z);
  if (renderer.xr.isPresenting) {
    // Move VR dolly
    vrControls.dolly.position.set(targetZone.position.x, 0, targetZone.position.z);
  } else {
    // Move desktop camera
    camera.position.set(targetZone.position.x + 8, 4, targetZone.position.z + 8);
    controls.target.set(targetZone.position.x, 1, targetZone.position.z);
  }
  network.sendTeleport(targetZone.id);
  network.sendPosition(target, camera.quaternion);
};

// ─── Stream overlay reference ────────────────────────────
let _streamCitizenCount = null;

// ─── Citizens ───────────────────────────────────────────

// Nicolas — human avatar (green, head-tracked in VR)
// Name label removed from local avatar — remote/stream clients see it via network sync
const nicolasAvatar = createAvatar({ color: 0x00ff88, name: 'NLR_ai' });
nicolasAvatar.position.set(0, 0, 0);
// Remove the name label sprite from local avatar (last child is the label)
const localLabel = nicolasAvatar.children.find(c => c.isSprite);
if (localLabel) nicolasAvatar.remove(localLabel);
scene.add(nicolasAvatar);

// Marco — Manemus's incarnation (orange, receives perception)
const marcoCamera = createCameraBody({ color: 0xff8800, name: 'Marco' });
marcoCamera.position.set(2, 1.5, 2);
marcoCamera.lookAt(0, 1, 0); // Face toward island center
scene.add(marcoCamera);

// Manemus — streaming camera (cyan, stays in place, POV streamed to community)
const manemusCamera = createCameraBody({ color: 0x00ccff, name: 'Manemus' });
manemusCamera.position.set(2.5, 2, 3);
manemusCamera.lookAt(0, 1.2, 0); // Face toward island center
scene.add(manemusCamera);
if (streamMode) {
  // Hide Manemus body (we ARE the camera)
  manemusCamera.visible = false;
  // Hide local Nicolas avatar — real one comes via WebSocket as remote citizen
  nicolasAvatar.visible = false;
}

// ─── VR Controls (locomotion + grab) ─────────────────────

const vrControls = new VRControls(renderer, camera, scene);
vrControls.addGrabbable(marcoCamera);
vrControls.addGrabbable(manemusCamera);

// ─── Marco Eyes (perception — 1 frame/10s from Marco's POV) ─

const marcoEyes = new ManemusEyes(renderer, scene, marcoCamera);
marcoEyes.start();

// Remote citizens (spawned when others connect)
const remoteCitizens = new Map();

// ─── Memorial Manager (donor archives) ───────────────────

const memorialManager = new MemorialManager(scene);
if (!streamMode) {
  memorialManager.init().catch(e => console.warn('Memorials:', e));
}

// ─── Network ────────────────────────────────────────────

const network = new Network();

// ─── Spatial Voice (STT → LLM → TTS) ────────────────────

const spatialVoice = new SpatialVoice();

// Stream viewers: enable audio on first click (browser autoplay policy)
if (streamMode) {
  const enableAudio = () => {
    spatialVoice._ensurePlayback();
    if (spatialVoice.audioContext?.state === 'suspended') {
      spatialVoice.audioContext.resume();
    }
    console.log('🔊 Stream audio enabled');
    document.removeEventListener('click', enableAudio);
    document.removeEventListener('touchstart', enableAudio);
  };
  document.addEventListener('click', enableAudio);
  document.addEventListener('touchstart', enableAudio);
}

if (streamMode) {
  // Stream mode: init audio playback (no mic, just playback for the audience)
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
      console.log('🔊 Stream audio initialized');
    }
  }, { once: true });
} else {
  // Init mic on first user gesture (browser requirement)
  async function initVoice() {
    if (spatialVoice.audioContext) return;
    const ok = await spatialVoice.init();
    if (ok) {
      spatialVoice.onRecordingComplete = (base64) => {
        const nearMemorial = memorialManager.getNearestActiveMemorial();
        if (nearMemorial) {
          network.sendBiographyVoice(base64, nearMemorial.donor.id);
        } else {
          network.sendVoice(base64);
        }
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

// Streaming voice — text arrives immediately, audio streams in chunks
// Voice comes from Marco's position (Manemus's incarnation speaks)
network.onVoiceStreamStart = (msg) => {
  spatialVoice.handleStreamStart(msg, marcoCamera.position);
};
network.onVoiceStreamData = (msg) => {
  spatialVoice.handleStreamData(msg);
};
network.onVoiceStreamEnd = (msg) => {
  spatialVoice.handleStreamEnd(msg);
};

// Citizen raw voice (hear other citizens speaking — e.g. Nicolas on stream)
network.onCitizenVoice = (msg) => {
  if (msg.audio) {
    // Find citizen position for spatial playback
    const citizen = remoteCitizens.get(msg.citizenId);
    const pos = citizen ? citizen.position : nicolasAvatar.position;
    spatialVoice.playRawAtPosition(msg.audio, pos);
  }
};

// Biography voice — archived answer from memorial position
network.onBiographyStreamStart = (msg) => {
  const memorial = memorialManager.getNearestActiveMemorial();
  const pos = memorial ? memorial.getAudioPosition() : marcoCamera.position;
  spatialVoice.handleStreamStart(msg, pos);
};
network.onBiographyStreamData = (msg) => {
  spatialVoice.handleStreamData(msg);
};
network.onBiographyStreamEnd = (msg) => {
  spatialVoice.handleStreamEnd(msg);
};

// AI citizen speech — display subtitle and play spatial audio from citizen position
network.onAICitizenSpeak = (msg) => {
  console.log(`🤖 ${msg.citizenName}: "${msg.text}"`);
  const citizen = remoteCitizens.get(msg.citizenId);
  const pos = citizen ? citizen.position : new THREE.Vector3(msg.position?.x || 0, msg.position?.y || 1.2, msg.position?.z || 0);
  spatialVoice.showTranscription(`[${msg.citizenName}]`, msg.text);
  // Audio will arrive via voice_stream_data with source: 'ai-citizen'
};

// Legacy non-streaming fallback
network.onVoiceResponse = (msg) => {
  if (msg.audio) {
    spatialVoice.playAtPosition(msg.audio, marcoCamera.position);
  }
  if (msg.transcription && msg.response) {
    spatialVoice.showTranscription(msg.transcription, msg.response);
  }
  if (msg.latency) console.log(`⏱️ ${msg.latency}ms round-trip`);
};

// Stream mode: receive Manemus camera position from VR client
let _lastManualCamUpdate = 0; // timestamp of last VR-sent camera update
network.onManemusCameraUpdate = (msg) => {
  if (streamMode && msg.position) {
    _lastManualCamUpdate = performance.now();
    manemusCamera.position.set(msg.position.x, msg.position.y, msg.position.z);
    if (msg.rotation) {
      manemusCamera.quaternion.set(msg.rotation.x, msg.rotation.y, msg.rotation.z, msg.rotation.w);
    }
  }
};

network.onCitizenJoined = (msg) => {
  if (remoteCitizens.has(msg.citizenId)) return;
  console.log(`Citizen joined: ${msg.name} ${msg.persona === 'ai' ? '(AI)' : ''}`);

  let avatar;
  if (msg.persona === 'ai' && msg.aiShape) {
    // AI citizen — geometric avatar with glow
    avatar = createAICitizenAvatar({
      color: msg.aiColor || 0xffffff,
      name: msg.name || msg.citizenId,
      shape: msg.aiShape || 'icosahedron',
    });
    avatar.userData.isAI = true;
  } else {
    avatar = createAvatar({
      color: 0x44aaff,
      name: msg.name || msg.citizenId,
    });
  }
  scene.add(avatar);
  remoteCitizens.set(msg.citizenId, avatar);
};

network.onCitizenMoved = (msg) => {
  const avatar = remoteCitizens.get(msg.citizenId);
  if (avatar && msg.position) {
    // Avatar group at ground, head child tracks actual height
    avatar.position.lerp(
      new THREE.Vector3(msg.position.x, 0, msg.position.z),
      0.3
    );
    const head = avatar.children[0];
    if (head && msg.position.y) {
      head.position.y = msg.position.y; // Head at actual eye height from sync
    }
    if (msg.rotation && head) {
      head.quaternion.slerp(
        new THREE.Quaternion(msg.rotation.x, msg.rotation.y, msg.rotation.z, msg.rotation.w),
        0.3
      );
    }
  }
};

network.onCitizenHands = (msg) => {
  const avatar = remoteCitizens.get(msg.citizenId);
  if (avatar && msg.hands) {
    const meshes = ensureHandMeshes(avatar, 0x44aaff);
    if (meshes) {
      updateHandFromData(meshes.left, msg.hands.left);
      updateHandFromData(meshes.right, msg.hands.right);
    }
  }
};

network.onCitizenLeft = (msg) => {
  const avatar = remoteCitizens.get(msg.citizenId);
  if (avatar) {
    scene.remove(avatar);
    remoteCitizens.delete(msg.citizenId);
    console.log(`Citizen left: ${msg.citizenId}`);
  }
};

// Connect
try {
  if (streamMode) {
    network.connect('Manemus Stream', null, { spectator: true });
  } else {
    network.connect('Nicolas', 'Marco');
    // Send world-space position — in XR, camera.position is local to dolly
    const _syncPos = new THREE.Vector3();
    const _syncQuat = new THREE.Quaternion();
    network.startPositionSync(() => {
      if (renderer.xr.isPresenting) {
        // Use nicolasAvatar position (already world-space from XR loop)
        return {
          position: { x: nicolasAvatar.position.x, y: nicolasAvatar.children[0]?.position.y || 1.7, z: nicolasAvatar.position.z },
          rotation: nicolasAvatar.children[0]?.quaternion || camera.quaternion,
        };
      }
      return { position: camera.position, rotation: camera.quaternion };
    }, 100);
  }
} catch (e) {
  console.log('Server not available, running offline');
}

// ─── Desktop Drag (click + drag to reposition cameras in 3D) ─

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

    // Check both cameras for drag
    for (const target of [marcoCamera, manemusCamera]) {
      const hits = raycaster.intersectObject(target, true);
      if (hits.length > 0) {
        dragTarget = target;
        controls.enabled = false;
        const normal = new THREE.Vector3();
        camera.getWorldDirection(normal);
        dragPlane.setFromNormalAndCoplanarPoint(normal, target.position);
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

  // Add stream overlay: LIVE indicator + citizen count + watermark
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
} else {
  // Enable the VR button — with timeout fallback if isSessionSupported hangs
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
        info.style.display = 'none';
        controls.enabled = false;
        nicolasAvatar.visible = false;
      } catch (err) {
        console.error('Failed to start XR session:', err);
        vrButton.textContent = 'XR Session Failed';
      }
    });
  }

  if ('xr' in navigator) {
    // Timeout: if isSessionSupported hangs (common on Quest through tunnels),
    // enable the button anyway after 3 seconds
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn('WebXR isSessionSupported timed out — enabling button anyway');
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
      enableVRButton(); // Try anyway on error
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
        nicolasAvatar.visible = false;
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

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // Desktop movement
  updateDesktopMovement(delta);
  if (!streamMode) controls.update();

  // VR locomotion + snap turn + grab
  if (!streamMode) vrControls.update(delta);

  // Both cameras: stay exactly where Nicolas placed them. No auto-behavior.
  // Glow ring rotation only.
  for (const cam of [marcoCamera, manemusCamera]) {
    const ring = cam.children.find(c => c.geometry?.type === 'TorusGeometry');
    if (ring) ring.rotation.z = elapsed * 0.3;
  }

  // Foveated rendering (Quest 3)
  if (renderer.xr.isPresenting && renderer.xr.setFoveation && !renderer._foveationSet) {
    renderer.xr.setFoveation(1.0);
    renderer._foveationSet = true;
  }

  // In XR mode, track headset position (for network sync) but hide local avatar
  if (renderer.xr.isPresenting) {
    vrControls.dolly.updateMatrixWorld(true);

    const xrCamera = renderer.xr.getCamera();
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    xrCamera.getWorldPosition(worldPos);
    xrCamera.getWorldQuaternion(worldQuat);
    // Update position for network sync even though avatar is hidden locally
    nicolasAvatar.position.set(worldPos.x, 0, worldPos.z);
    const head = nicolasAvatar.children[0];
    if (head) {
      head.quaternion.copy(worldQuat);
      head.position.y = worldPos.y;
    }
    // Hidden in VR — Nicolas doesn't see his own body
    // Stream/remote clients see him via WebSocket citizen sync
    nicolasAvatar.visible = false;

    // Broadcast Manemus camera position for stream clients (~10fps)
    if (elapsed - _lastCamBroadcast > 0.1) {
      network.sendManemusCameraPosition(manemusCamera.position, manemusCamera.quaternion);
      // Send hand/controller joint data at same rate
      const handsData = vrControls.getHandsData();
      if (handsData) network.sendHands(handsData);
      _lastCamBroadcast = elapsed;
    }
  } else if (!streamMode) {
    if (elapsed - _lastCamBroadcast > 0.1) {
      network.sendManemusCameraPosition(manemusCamera.position, manemusCamera.quaternion);
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
    // Pulse opacity
    particleMat.opacity = 0.4 + Math.sin(elapsed * 0.8) * 0.3;
  }

  // Zone ambient transitions (fog, light, particle color)
  {
    const playerPos = renderer.xr.isPresenting
      ? nicolasAvatar.position
      : camera.position;
    zoneAmbient.update(playerPos, elapsed);
  }

  // Waypoint beacons (animate + check teleport interaction)
  {
    const playerPos = renderer.xr.isPresenting
      ? new THREE.Vector3().copy(nicolasAvatar.position).setY(nicolasAvatar.children[0]?.position.y || 1.7)
      : camera.position;
    const gripActive = vrControls.isGripping?.() || false;
    waypoints.update(elapsed, playerPos, gripActive);
  }

  // Animate AI citizen meshes (rotation + glow pulse)
  for (const [cid, avatar] of remoteCitizens) {
    if (avatar.userData.isAI) {
      const body = avatar.children[0];
      if (body) body.rotation.y = elapsed * 0.5;
      const ring = avatar.children.find(c => c.geometry?.type === 'TorusGeometry');
      if (ring) ring.rotation.z = elapsed * 0.3;
      // Pulse emissive
      if (body?.material) {
        body.material.emissiveIntensity = 0.4 + Math.sin(elapsed * 2) * 0.2;
      }
    }
  }

  // Memorial proximity + video playback
  if (!streamMode) {
    const playerPos = renderer.xr.isPresenting
      ? nicolasAvatar.position.clone().setY(nicolasAvatar.children[0]?.position.y || 1.7)
      : camera.position;
    memorialManager.update(elapsed, playerPos);
  }

  // Stream mode: camera follows VR broadcast, tracks citizens, or cinematic orbit
  if (streamMode) {
    const manualActive = (performance.now() - _lastManualCamUpdate) < 2000;

    if (manualActive) {
      // VR client actively controlling — follow their broadcast
      camera.position.copy(manemusCamera.position);
      camera.quaternion.copy(manemusCamera.quaternion);
    } else if (remoteCitizens.size > 0) {
      // Citizens present — track nearest from a close orbit
      let nearest = null;
      let nearDist = Infinity;
      for (const [, avatar] of remoteCitizens) {
        const d = new THREE.Vector3(0, 0, 0).distanceTo(avatar.position);
        if (d < nearDist) { nearDist = d; nearest = avatar; }
      }
      if (nearest) {
        const headY = nearest.children[0]?.position.y || 1.7;
        const target = new THREE.Vector3(nearest.position.x, headY, nearest.position.z);
        // Orbit around the citizen at close range
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
      // No one here — cinematic slow orbit around the island
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

    // Update citizen counter in stream overlay
    if (_streamCitizenCount) {
      const count = remoteCitizens.size;
      _streamCitizenCount.textContent = count > 0
        ? `${count} citizen${count > 1 ? 's' : ''} present`
        : 'Waiting for citizens...';
    }
  }

  // Water shader animation
  updateEnvironment(env, elapsed);

  // Marco perception — capture frame from Marco's POV
  marcoEyes.update(elapsed);

  // Spatial audio listener follows camera/headset
  spatialVoice.updateListener(camera);

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
});
