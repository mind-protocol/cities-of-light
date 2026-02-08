/**
 * Cities of Light — Phase 1: First Encounter
 *
 * Two presences on an island. Water, sand, sky.
 * Nicolas (head-tracked avatar) and Manemus (floating camera).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEnvironment, updateEnvironment } from './scene.js';
import { createAvatar } from './avatar.js';
import { createCameraBody } from './camera-body.js';
import { Network } from './network.js';

// ─── Renderer ───────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.xr.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ─── Scene ──────────────────────────────────────────────

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x8faabe, 0.002); // Light atmospheric fog

// ─── Camera (human's eyes in VR, or orbit in desktop) ───

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(8, 4, 8);

// ─── Desktop Controls (orbit + WASD) ────────────────────

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI * 0.85;
controls.minDistance = 2;
controls.maxDistance = 50;

// WASD movement
const keys = {};
document.addEventListener('keydown', (e) => { keys[e.code] = true; });
document.addEventListener('keyup', (e) => { keys[e.code] = false; });

function updateDesktopMovement(delta) {
  if (renderer.xr.isPresenting) return; // Skip in VR

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

// ─── Lighting (ambient — sun comes from environment) ────

const hemi = new THREE.HemisphereLight(0x87ceeb, 0xc9a96e, 0.4);
scene.add(hemi);

// ─── World (sky + water + island) ───────────────────────

const env = createEnvironment(scene, renderer);
scene.add(env.group);

// ─── Citizens ───────────────────────────────────────────

const nicolasAvatar = createAvatar({ color: 0x00ff88, name: 'Marco' });
nicolasAvatar.position.set(0, 0, 0);
scene.add(nicolasAvatar);

const manemusCamera = createCameraBody({ color: 0xff8800, name: 'Manemus' });
manemusCamera.position.set(2, 1.5, 2);
scene.add(manemusCamera);

// Remote citizens (spawned when others connect)
const remoteCitizens = new Map();

// ─── Network ────────────────────────────────────────────

const network = new Network();

network.onCitizenJoined = (msg) => {
  if (remoteCitizens.has(msg.citizenId)) return;
  console.log(`Citizen joined: ${msg.name}`);
  const avatar = createAvatar({
    color: 0x44aaff,
    name: msg.name || msg.citizenId,
  });
  scene.add(avatar);
  remoteCitizens.set(msg.citizenId, avatar);
};

network.onCitizenMoved = (msg) => {
  const avatar = remoteCitizens.get(msg.citizenId);
  if (avatar && msg.position) {
    // Smooth interpolation
    avatar.position.lerp(
      new THREE.Vector3(msg.position.x, 0, msg.position.z),
      0.3
    );
    if (msg.rotation) {
      avatar.children[0]?.quaternion.slerp(
        new THREE.Quaternion(msg.rotation.x, msg.rotation.y, msg.rotation.z, msg.rotation.w),
        0.3
      );
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

// Connect (try, don't crash if server isn't running)
try {
  network.connect('Nicolas', 'Marco');
  network.startPositionSync(() => ({
    position: camera.position,
    rotation: camera.quaternion,
  }), 100);
} catch (e) {
  console.log('Server not available, running offline');
}

// ─── WebXR Setup ────────────────────────────────────────

const vrButton = document.getElementById('enter-vr');
const info = document.getElementById('info');

if ('xr' in navigator) {
  navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
    if (supported) {
      vrButton.textContent = 'Enter Cities of Light';
      vrButton.disabled = false;
      vrButton.addEventListener('click', async () => {
        try {
          const session = await navigator.xr.requestSession('immersive-vr', {
            requiredFeatures: ['local-floor'],
            optionalFeatures: ['hand-tracking'],
          });
          renderer.xr.setSession(session);
          vrButton.style.display = 'none';
          info.style.display = 'none';
          controls.enabled = false; // Disable orbit in VR
        } catch (err) {
          console.error('Failed to start XR session:', err);
          vrButton.textContent = 'XR Session Failed';
        }
      });
    } else {
      vrButton.textContent = 'Desktop Mode (WASD + Mouse)';
      vrButton.disabled = true;
      vrButton.style.opacity = '0.5';
    }
  });
} else {
  vrButton.textContent = 'Desktop Mode (WASD + Mouse)';
  vrButton.disabled = true;
  vrButton.style.opacity = '0.5';
}

// ─── Animation Loop ─────────────────────────────────────

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // Desktop movement
  updateDesktopMovement(delta);
  controls.update();

  // Gentle camera bob (Manemus floating)
  manemusCamera.position.y = 1.5 + Math.sin(elapsed * 0.5) * 0.1;

  // Manemus glow ring rotation
  const ring = manemusCamera.children.find(c => c.geometry?.type === 'TorusGeometry');
  if (ring) ring.rotation.z = elapsed * 0.3;

  // Manemus always faces Nicolas avatar
  const lookTarget = new THREE.Vector3();
  lookTarget.copy(nicolasAvatar.position);
  lookTarget.y = 1.5;
  manemusCamera.lookAt(lookTarget);

  // In XR mode, update avatar from headset
  if (renderer.xr.isPresenting) {
    const xrCamera = renderer.xr.getCamera();
    nicolasAvatar.position.copy(xrCamera.position);
    nicolasAvatar.position.y = 0;
    // Head tracking
    nicolasAvatar.children[0]?.quaternion.copy(xrCamera.quaternion);
  }

  // Water shader animation
  updateEnvironment(env, elapsed);

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
