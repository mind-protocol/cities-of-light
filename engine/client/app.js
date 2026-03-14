/**
 * Venice 3D — Minimal web client.
 *
 * Renders Venice geography from world-manifest.json:
 *   - 118 islands from lands.json (extruded polygons)
 *   - 274 buildings from buildings.json (procedural boxes)
 *   - 117 bridges from bridges.json (arched spans)
 *   - 186 citizens as colored shapes at their building positions
 *   - WASD + mouse navigation
 *
 * No VR, no voice, no websocket — step 1 of the web-first POC.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { WorldLoader } from './world-loader.js';
import { BuildingRenderer } from './building-renderer.js';
import { BridgeRenderer } from './bridge-renderer.js';

// ─── Renderer ──────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ─── Scene ─────────────────────────────────────────────

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x8faac0, 0.003);

// ─── Camera ────────────────────────────────────────────

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(0, 30, 80);

// ─── Controls (orbit + WASD) ───────────────────────────

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI * 0.85;
controls.minDistance = 2;
controls.maxDistance = 500;

const keys = {};
document.addEventListener('keydown', (e) => { keys[e.code] = true; });
document.addEventListener('keyup', (e) => { keys[e.code] = false; });

function updateMovement(delta) {
  const speed = 30 * delta;
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
  if (keys['Space']) {
    camera.position.y += speed * 0.5;
    controls.target.y += speed * 0.5;
  }
  if (keys['ShiftLeft'] || keys['ShiftRight']) {
    camera.position.y -= speed * 0.5;
    controls.target.y -= speed * 0.5;
  }
}

// ─── Lighting ──────────────────────────────────────────

const sun = new THREE.DirectionalLight(0xffd4a0, 1.2);
sun.position.set(-100, 60, -80);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -200;
sun.shadow.camera.right = 200;
sun.shadow.camera.top = 200;
sun.shadow.camera.bottom = -200;
scene.add(sun);

const hemi = new THREE.HemisphereLight(0x87ceeb, 0xc9a96e, 0.5);
scene.add(hemi);

// ─── Sky ───────────────────────────────────────────────

const skyGeo = new THREE.SphereGeometry(800, 32, 15);
const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    topColor: { value: new THREE.Color(0x0077ff) },
    bottomColor: { value: new THREE.Color(0xffc87f) },
    offset: { value: 20 },
    exponent: { value: 0.4 },
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;
    varying vec3 vWorldPosition;
    void main() {
      float h = normalize(vWorldPosition + offset).y;
      gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
    }
  `,
  side: THREE.BackSide,
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

// ─── Citizens ──────────────────────────────────────────

const citizenMeshes = new Map();

const CLASS_COLORS = {
  Nobili: 0xd4af37,
  Cittadini: 0x4a7ab5,
  Popolani: 0xb87333,
  Facchini: 0x8b6914,
  Artisti: 0xe74c3c,
  Scientisti: 0x3498db,
  Clero: 0x9b59b6,
  Forestieri: 0x2ecc71,
  Innovatori: 0xf39c12,
  Ambasciatore: 0x1abc9c,
};

function spawnCitizens(citizens, world) {
  const projection = world.projection;
  let spawned = 0;

  for (const citizen of citizens) {
    let pos = null;
    if (citizen.position && typeof citizen.position.x === 'number') {
      pos = citizen.position;
    } else if (typeof citizen.lat === 'number' && typeof citizen.lng === 'number' && projection) {
      pos = projection({ lat: citizen.lat, lng: citizen.lng });
    }
    if (!pos) continue;

    const color = CLASS_COLORS[citizen.social_class] || CLASS_COLORS[citizen.socialClass] || 0xcccccc;
    const group = new THREE.Group();

    // Body capsule
    const bodyGeo = new THREE.CapsuleGeometry(0.3, 1.0, 4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.0;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.25, 8, 6);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xf5d0a9, roughness: 0.8 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 2.0;
    group.add(head);

    // Name label
    const label = makeLabel(citizen.name || citizen.username || 'citizen');
    label.position.y = 2.6;
    group.add(label);

    group.position.set(pos.x, 1.5, pos.z);
    group.userData = { citizen, bobOffset: Math.random() * Math.PI * 2 };

    scene.add(group);
    citizenMeshes.set(citizen.id || citizen.username, group);
    spawned++;
  }

  console.log(`Citizens spawned: ${spawned}/${citizens.length}`);
  document.getElementById('status').innerHTML = `<span class="connected">${spawned} citizens alive</span>`;
}

function makeLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, 128, 40);

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.8 });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(3, 0.75, 1);
  return sprite;
}

// ─── Load World ────────────────────────────────────────

const worldLoader = new WorldLoader(scene, renderer);

async function init() {
  const statusEl = document.getElementById('status');
  const worldNameEl = document.getElementById('world-name');

  try {
    statusEl.innerHTML = '<span>Loading Venice...</span>';

    const world = await worldLoader.load('/worlds/venezia/world-manifest.json');
    worldNameEl.textContent = world.manifest.display_name || world.manifest.name;

    // Render buildings
    if (world.buildings && world.buildings.length > 0) {
      const buildingRenderer = new BuildingRenderer(scene, {
        nameLabels: world.manifest.buildings?.name_labels ?? true,
        labelHeight: world.manifest.buildings?.label_height ?? 3.0,
      });
      buildingRenderer.render(world.buildings);
      console.log(`Buildings rendered: ${world.buildings.length}`);
    }

    // Render bridges
    if (world.bridgesData && world.bridgesData.length > 0) {
      const bridgeRenderer = new BridgeRenderer(scene, {
        width: world.manifest.bridges?.width ?? 3,
        railHeight: world.manifest.bridges?.rail_height ?? 1.0,
      });
      bridgeRenderer.render(world.bridgesData);
      console.log(`Bridges rendered: ${world.bridgesData.length}`);
    }

    // Spawn citizens
    if (world.entityDescriptors && world.entityDescriptors.length > 0) {
      spawnCitizens(world.entityDescriptors, world);
    } else {
      try {
        const resp = await fetch('/worlds/venezia/data/citizens.json');
        if (resp.ok) spawnCitizens(await resp.json(), world);
      } catch (e) {
        console.warn('Could not load citizens:', e.message);
      }
    }

    // Camera at spawn
    const spawn = world.manifest.zones?.find(z => z.mode === 'spawn');
    if (spawn?.position) {
      camera.position.set(spawn.position.x || 0, 30, (spawn.position.z || 0) + 60);
      controls.target.set(spawn.position.x || 0, 0, spawn.position.z || 0);
    }

    statusEl.innerHTML = '<span class="connected">Venice loaded</span>';
  } catch (err) {
    console.error('Failed to load world:', err);
    statusEl.innerHTML = `<span class="disconnected">Error: ${err.message}</span>`;
  }
}

// ─── Animation Loop ────────────────────────────────────

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  updateMovement(delta);
  controls.update();

  // Gentle citizen bob
  for (const [, group] of citizenMeshes) {
    const offset = group.userData.bobOffset || 0;
    group.position.y = 1.5 + Math.sin(elapsed * 0.8 + offset) * 0.15;
  }

  renderer.render(scene, camera);
}

// ─── Resize ────────────────────────────────────────────

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Start ─────────────────────────────────────────────

init();
animate();
