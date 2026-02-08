/**
 * Cities of Light — Phase 1: First Encounter
 *
 * Two presences on an island. Water, sand, sky.
 * Nicolas (head-tracked avatar) and Manemus (floating camera).
 */

import * as THREE from 'three';
import { createIsland } from './scene.js';
import { createAvatar } from './avatar.js';
import { createCameraBody } from './camera-body.js';

// ─── Renderer ───────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.xr.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
document.body.appendChild(renderer.domElement);

// ─── Scene ──────────────────────────────────────────────

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.FogExp2(0x1a1a2e, 0.008);

// ─── Camera (human's eyes in VR, or orbit in desktop) ───

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 1.7, 5); // Standing height

// ─── Lighting ───────────────────────────────────────────

// Warm ambient — dawn light
const ambient = new THREE.AmbientLight(0x334455, 0.4);
scene.add(ambient);

// Main light — low sun, golden
const sun = new THREE.DirectionalLight(0xffaa44, 1.2);
sun.position.set(-20, 15, -10);
sun.castShadow = true;
scene.add(sun);

// Rim light — cool blue from opposite side
const rim = new THREE.DirectionalLight(0x4488ff, 0.3);
rim.position.set(20, 10, 10);
scene.add(rim);

// ─── World ──────────────────────────────────────────────

const island = createIsland();
scene.add(island);

// ─── Citizens ───────────────────────────────────────────

const nicolasAvatar = createAvatar({ color: 0x00ff88, name: 'Marco' });
nicolasAvatar.position.set(0, 0, 0);
scene.add(nicolasAvatar);

const manemusCamera = createCameraBody({ color: 0xff8800, name: 'Manemus' });
manemusCamera.position.set(2, 1.5, 2);
scene.add(manemusCamera);

// ─── WebXR Setup ────────────────────────────────────────

const vrButton = document.getElementById('enter-vr');

if ('xr' in navigator) {
  navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
    if (supported) {
      vrButton.textContent = 'Enter Cities of Light';
      vrButton.disabled = false;
      vrButton.addEventListener('click', async () => {
        const session = await navigator.xr.requestSession('immersive-vr', {
          requiredFeatures: ['local-floor'],
          optionalFeatures: ['hand-tracking'],
        });
        renderer.xr.setSession(session);
        vrButton.style.display = 'none';
      });
    } else {
      vrButton.textContent = 'WebXR Not Supported';
    }
  });
} else {
  vrButton.textContent = 'WebXR Not Available';
}

// ─── Animation Loop ─────────────────────────────────────

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const elapsed = clock.getElapsedTime();

  // Gentle camera bob (Manemus floating)
  manemusCamera.position.y = 1.5 + Math.sin(elapsed * 0.5) * 0.1;
  manemusCamera.lookAt(nicolasAvatar.position);

  // In XR mode, update avatar from headset position
  if (renderer.xr.isPresenting) {
    const xrCamera = renderer.xr.getCamera();
    nicolasAvatar.position.copy(xrCamera.position);
    nicolasAvatar.position.y = 0; // Keep feet on ground
    // Head tracking
    nicolasAvatar.children[0]?.quaternion.copy(xrCamera.quaternion);
  }

  renderer.render(scene, camera);
});

// ─── Resize ─────────────────────────────────────────────

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
