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

// Nearby buildings cache — filled after buildings load
let buildingPositions = [];

// Conversation snippets — short phrases citizens say when near each other
const GREETINGS = [
  'Buongiorno!', 'Come sta?', 'Che bel tempo!', 'Avete sentito?',
  'Il Consiglio ha deciso...', 'I prezzi al Rialto...', 'Una gondola per due?',
  'Che ne pensate?', 'Andiamo al mercato?', 'Dio vi benedica!',
  'Ho sentito dire che...', 'Il Doge ha parlato!', 'Che bella giornata!',
  'Sapete la novità?', 'Al lavoro, al lavoro!', 'Un ducato per i vostri pensieri',
];

function spawnCitizens(citizens, world) {
  const projection = world.projection;
  let spawned = 0;

  // Collect building positions for wander targets
  if (world.buildings) {
    buildingPositions = world.buildings
      .filter(b => b.position && b.category !== 'bridge')
      .map(b => ({ x: b.position.x, z: b.position.z, name: b.name }));
  }

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

    // Behavior state
    const wanderRadius = citizen.wander_radius || 8;
    const moveSpeed = citizen.move_speed || 0.8;
    group.userData = {
      citizen,
      bobOffset: Math.random() * Math.PI * 2,
      homeX: pos.x,
      homeZ: pos.z,
      targetX: pos.x,
      targetZ: pos.z,
      moveSpeed,
      wanderRadius,
      state: 'idle',           // idle | walking | talking
      stateTimer: Math.random() * 5, // stagger start
      talkBubble: null,
    };

    scene.add(group);
    citizenMeshes.set(citizen.id || citizen.username, group);
    spawned++;
  }

  console.log(`Citizens spawned: ${spawned}/${citizens.length}`);
  const el = document.getElementById('status');
  if (el) el.innerHTML = `<span class="connected">${spawned} citizens alive</span>`;
}

// ─── Citizen Behavior ─────────────────────────────────

function pickWanderTarget(userData) {
  const { homeX, homeZ, wanderRadius } = userData;
  // Find a nearby building within wander radius, or random offset
  const nearby = buildingPositions.filter(b => {
    const dx = b.x - homeX;
    const dz = b.z - homeZ;
    return Math.sqrt(dx * dx + dz * dz) < wanderRadius * 3;
  });
  if (nearby.length > 0 && Math.random() < 0.7) {
    const target = nearby[Math.floor(Math.random() * nearby.length)];
    return { x: target.x + (Math.random() - 0.5) * 3, z: target.z + (Math.random() - 0.5) * 3 };
  }
  // Random wander near home
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * wanderRadius;
  return { x: homeX + Math.cos(angle) * dist, z: homeZ + Math.sin(angle) * dist };
}

function updateCitizens(delta, elapsed) {
  for (const [id, group] of citizenMeshes) {
    const ud = group.userData;

    // Bob animation
    group.position.y = 1.5 + Math.sin(elapsed * 0.8 + ud.bobOffset) * 0.1;

    // State machine
    ud.stateTimer -= delta;

    if (ud.state === 'idle' && ud.stateTimer <= 0) {
      // Pick new destination and start walking
      const target = pickWanderTarget(ud);
      ud.targetX = target.x;
      ud.targetZ = target.z;
      ud.state = 'walking';
      ud.stateTimer = 15 + Math.random() * 20; // timeout safety
    }

    if (ud.state === 'walking') {
      const dx = ud.targetX - group.position.x;
      const dz = ud.targetZ - group.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 1.0 || ud.stateTimer <= 0) {
        // Arrived — idle for a while
        ud.state = 'idle';
        ud.stateTimer = 3 + Math.random() * 8;
      } else {
        // Move toward target
        const step = Math.min(ud.moveSpeed * delta, dist);
        group.position.x += (dx / dist) * step;
        group.position.z += (dz / dist) * step;
        // Face direction of movement
        group.rotation.y = Math.atan2(dx, dz);
      }
    }

    if (ud.state === 'talking') {
      if (ud.stateTimer <= 0) {
        // Done talking, remove bubble
        removeBubble(group);
        ud.state = 'idle';
        ud.stateTimer = 2 + Math.random() * 5;
      }
    }
  }

  // Check for nearby citizen pairs → trigger conversations
  checkConversations();
}

// ─── Conversation Bubbles ─────────────────────────────

let lastConversationCheck = 0;
const CONVO_CHECK_INTERVAL = 2.0; // seconds between checks
const CONVO_DISTANCE = 6;         // meters to trigger conversation

function checkConversations() {
  const now = performance.now() / 1000;
  if (now - lastConversationCheck < CONVO_CHECK_INTERVAL) return;
  lastConversationCheck = now;

  const entries = [...citizenMeshes.entries()];
  const maxChecks = 50; // limit per frame
  let checks = 0;

  for (let i = 0; i < entries.length && checks < maxChecks; i++) {
    const [idA, groupA] = entries[i];
    const udA = groupA.userData;
    if (udA.state === 'talking') continue;

    for (let j = i + 1; j < entries.length && checks < maxChecks; j++) {
      checks++;
      const [idB, groupB] = entries[j];
      const udB = groupB.userData;
      if (udB.state === 'talking') continue;

      const dx = groupA.position.x - groupB.position.x;
      const dz = groupA.position.z - groupB.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < CONVO_DISTANCE && Math.random() < 0.15) {
        // Start conversation
        const textA = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
        const textB = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

        udA.state = 'talking';
        udA.stateTimer = 3 + Math.random() * 3;
        showBubble(groupA, textA);

        udB.state = 'talking';
        udB.stateTimer = 3 + Math.random() * 3;
        showBubble(groupB, textB);

        // Face each other
        groupA.rotation.y = Math.atan2(dx, dz) + Math.PI;
        groupB.rotation.y = Math.atan2(dx, dz);
        break;
      }
    }
  }
}

function showBubble(group, text) {
  removeBubble(group); // clean any existing
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');

  // Bubble background
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.roundRect(8, 8, 496, 72, 12);
  ctx.fill();

  // Text
  ctx.fillStyle = '#2c3e50';
  ctx.font = 'italic 24px serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, 52);

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(5, 1, 1);
  sprite.position.y = 3.2;
  sprite.name = 'bubble';
  group.add(sprite);
  group.userData.talkBubble = sprite;
}

function removeBubble(group) {
  if (group.userData.talkBubble) {
    group.remove(group.userData.talkBubble);
    group.userData.talkBubble.material.map.dispose();
    group.userData.talkBubble.material.dispose();
    group.userData.talkBubble = null;
  }
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

  try {
    if (statusEl) statusEl.innerHTML = '<span>Loading Venice...</span>';

    const world = await worldLoader.load('/worlds/venezia/world-manifest.json');

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
  updateCitizens(delta, elapsed);
  sendPosition(elapsed);
  renderer.render(scene, camera);
}

// ─── Resize ────────────────────────────────────────────

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Multiplayer (WebSocket) ───────────────────────────

const visitors = new Map(); // visitorId -> THREE.Group

const params = new URLSearchParams(location.search);
const visitorName = params.get('name') || 'Visitor_' + Math.random().toString(36).slice(2, 6);

let ws = null;
let myId = null;

function connectMultiplayer() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: 'join',
      name: visitorName,
      persona: 'visitor',
    }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    switch (msg.type) {
      case 'welcome':
        myId = msg.citizenId;
        console.log(`Connected as ${visitorName} (${myId})`);
        break;

      case 'citizen_joined': {
        if (msg.citizenId === myId) break;
        const group = createVisitorAvatar(msg.name || 'Visitor');
        scene.add(group);
        visitors.set(msg.citizenId, group);
        break;
      }

      case 'citizen_moved': {
        if (msg.citizenId === myId) break;
        const v = visitors.get(msg.citizenId);
        if (v && msg.position) {
          v.position.set(msg.position.x, msg.position.y, msg.position.z);
        }
        break;
      }

      case 'citizen_left': {
        const v = visitors.get(msg.citizenId);
        if (v) {
          scene.remove(v);
          visitors.delete(msg.citizenId);
        }
        break;
      }
    }
  };

  ws.onclose = () => {
    console.log('Disconnected, reconnecting in 3s...');
    setTimeout(connectMultiplayer, 3000);
  };
}

function createVisitorAvatar(name) {
  const group = new THREE.Group();

  // Body — teal capsule (distinct from AI citizens)
  const bodyGeo = new THREE.CapsuleGeometry(0.35, 1.2, 4, 8);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x00ddaa, roughness: 0.4, metalness: 0.3, emissive: 0x004433, emissiveIntensity: 0.3 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.0;
  group.add(body);

  // Head
  const headGeo = new THREE.SphereGeometry(0.28, 8, 6);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xf5d0a9, roughness: 0.8 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 2.1;
  group.add(head);

  // Name label
  const label = makeLabel(name);
  label.position.y = 2.7;
  group.add(label);

  // Glow ring (visitors glow teal)
  const ringGeo = new THREE.TorusGeometry(0.5, 0.03, 8, 24);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x00ffaa, emissive: 0x00ffaa, emissiveIntensity: 0.8, transparent: true, opacity: 0.6 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.1;
  group.add(ring);

  return group;
}

// Send position every 100ms
let lastSendTime = 0;
function sendPosition(elapsed) {
  if (!ws || ws.readyState !== 1 || !myId) return;
  if (elapsed - lastSendTime < 0.1) return;
  lastSendTime = elapsed;

  ws.send(JSON.stringify({
    type: 'position',
    position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    rotation: { x: 0, y: camera.rotation.y, z: 0, w: 1 },
  }));
}

// ─── Start ─────────────────────────────────────────────

init();
connectMultiplayer();
animate();
