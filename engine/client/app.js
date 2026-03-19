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

// Conversation snippets — fallback, replaced by real graph thoughts when available
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

    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5d0a9, roughness: 0.8 });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.2), mat);
    torso.position.y = 1.3;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), skinMat);
    head.position.y = 1.85;
    group.add(head);

    // Arms (will swing when walking)
    const armGeo = new THREE.BoxGeometry(0.1, 0.5, 0.1);
    const leftArm = new THREE.Mesh(armGeo, mat);
    leftArm.position.set(-0.3, 1.2, 0);
    leftArm.name = 'leftArm';
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, mat);
    rightArm.position.set(0.3, 1.2, 0);
    rightArm.name = 'rightArm';
    group.add(rightArm);

    // Legs (will swing when walking)
    const legGeo = new THREE.BoxGeometry(0.12, 0.5, 0.12);
    const leftLeg = new THREE.Mesh(legGeo, mat);
    leftLeg.position.set(-0.1, 0.5, 0);
    leftLeg.name = 'leftLeg';
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, mat);
    rightLeg.position.set(0.1, 0.5, 0);
    rightLeg.name = 'rightLeg';
    group.add(rightLeg);

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

    // Limb animation
    const leftArm = group.getObjectByName('leftArm');
    const rightArm = group.getObjectByName('rightArm');
    const leftLeg = group.getObjectByName('leftLeg');
    const rightLeg = group.getObjectByName('rightLeg');

    if (ud.state === 'walking') {
      // Walking swing
      const swing = Math.sin(elapsed * 6 + ud.bobOffset) * 0.5;
      if (leftArm) leftArm.rotation.x = swing;
      if (rightArm) rightArm.rotation.x = -swing;
      if (leftLeg) leftLeg.rotation.x = -swing * 0.7;
      if (rightLeg) rightLeg.rotation.x = swing * 0.7;
      // Slight bob while walking
      group.position.y = 1.5 + Math.abs(Math.sin(elapsed * 6 + ud.bobOffset)) * 0.08;
    } else if (ud.state === 'talking') {
      // Gesturing — arms move gently
      if (leftArm) leftArm.rotation.x = Math.sin(elapsed * 3 + ud.bobOffset) * 0.3;
      if (rightArm) rightArm.rotation.x = Math.sin(elapsed * 2.5 + ud.bobOffset + 1) * 0.4;
      if (leftLeg) leftLeg.rotation.x = 0;
      if (rightLeg) rightLeg.rotation.x = 0;
      group.position.y = 1.5;
    } else {
      // Idle — subtle breathing
      if (leftArm) leftArm.rotation.x = 0;
      if (rightArm) rightArm.rotation.x = 0;
      if (leftLeg) leftLeg.rotation.x = 0;
      if (rightLeg) rightLeg.rotation.x = 0;
      group.position.y = 1.5 + Math.sin(elapsed * 0.8 + ud.bobOffset) * 0.05;
    }

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
        // Start conversation — try real thoughts from graph, fallback to greetings
        udA.state = 'talking';
        udA.stateTimer = 5 + Math.random() * 4;
        udB.state = 'talking';
        udB.stateTimer = 5 + Math.random() * 4;

        // Show real thoughts from graph (async)
        fetchThoughts(idA, idB, groupA, groupB);

        // Face each other
        groupA.rotation.y = Math.atan2(dx, dz) + Math.PI;
        groupB.rotation.y = Math.atan2(dx, dz);
        break;
      }
    }
  }
}

async function fetchThoughts(idA, idB, groupA, groupB) {
  const fallbackA = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  const fallbackB = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

  try {
    const resp = await fetch('/api/citizens/thoughts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ citizen_ids: [idA, idB] }),
    });

    if (resp.ok) {
      const data = await resp.json();
      const textA = data.thoughts?.[idA] || fallbackA;
      const textB = data.thoughts?.[idB] || fallbackB;
      // Truncate for bubble display
      showBubble(groupA, textA.length > 60 ? textA.slice(0, 57) + '...' : textA);
      showBubble(groupB, textB.length > 60 ? textB.slice(0, 57) + '...' : textB);
      return;
    }
  } catch (e) {
    // Graph not available — use fallback
  }

  showBubble(groupA, fallbackA);
  showBubble(groupB, fallbackB);
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

// ─── Click to Select Citizen ──────────────────────────

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedCitizen = null;
let activeBuildingRenderer = null; // set after init

window.addEventListener('click', (event) => {
  // Don't raycast if clicking on UI
  if (event.target.closest('#citizen-panel')) return;
  if (event.target.closest('#stele-reader')) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // Collect all citizen body meshes
  const citizenObjects = [];
  for (const [, group] of citizenMeshes) {
    group.traverse((child) => {
      if (child.isMesh) {
        child.userData._citizenGroup = group;
        citizenObjects.push(child);
      }
    });
  }

  const intersects = raycaster.intersectObjects(citizenObjects, false);
  if (intersects.length > 0) {
    const hit = intersects[0].object;
    const group = hit.userData._citizenGroup;
    if (group?.userData?.citizen) {
      showCitizenPanel(group.userData.citizen);
      selectedCitizen = group;
      return;
    }
  }

  // Check building clicks (monuments / steles)
  if (activeBuildingRenderer) {
    const buildingObjects = [];
    for (const [, entry] of activeBuildingRenderer.buildings) {
      entry.mesh.traverse((child) => {
        if (child.isMesh) {
          child.userData._buildingEntry = entry;
          buildingObjects.push(child);
        }
      });
    }

    const bIntersects = raycaster.intersectObjects(buildingObjects, false);
    if (bIntersects.length > 0) {
      const entry = bIntersects[0].object.userData._buildingEntry;
      if (entry?.data?.category === 'Monument') {
        openSteleReader(entry.data);
        return;
      }
    }
  }

  // Clicked empty space — close panels
  const panel = document.getElementById('citizen-panel');
  if (panel) panel.style.display = 'none';
  selectedCitizen = null;
});

// ─── Stele Reader ────────────────────────────────────

const STELE_CATALOG = {
  'stele:contre-terre': {
    title: 'Contre-Terre',
    meta: 'NLR & MIND — 2026',
    files: {
      fr: '/world/steles/contre_terre_fr.md',
      en: '/world/steles/counter_earth_en.md',
    },
    buy: {
      fr: 'https://www.amazon.fr/dp/B0GT4H4R18',
      en: 'https://www.amazon.co.uk/dp/B0GT4FCS6X',
    },
  },
};

let currentSteleLang = 'fr';
let currentSteleId = null;

async function openSteleReader(buildingData) {
  const stele = STELE_CATALOG[buildingData.id];
  if (!stele) return;

  currentSteleId = buildingData.id;
  currentSteleLang = 'fr';

  document.getElementById('sr-title').textContent = stele.title;
  document.getElementById('sr-meta').textContent = stele.meta;

  await loadSteleContent(stele, 'fr');

  const reader = document.getElementById('stele-reader');
  reader.style.display = 'flex';
}

async function loadSteleContent(stele, lang) {
  const body = document.getElementById('sr-body');
  body.textContent = 'Loading...';

  // Update language buttons
  document.getElementById('sr-lang-fr').classList.toggle('active', lang === 'fr');
  document.getElementById('sr-lang-en').classList.toggle('active', lang === 'en');

  // Update buy link
  const buyLink = document.getElementById('sr-buy-link');
  buyLink.href = stele.buy[lang] || stele.buy.fr;

  try {
    const resp = await fetch(stele.files[lang]);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const md = await resp.text();
    body.innerHTML = renderMarkdown(md);
    body.scrollTop = 0;
  } catch (e) {
    body.textContent = `Could not load manuscript: ${e.message}`;
  }
}

window.switchSteleLanguage = function(lang) {
  if (!currentSteleId) return;
  const stele = STELE_CATALOG[currentSteleId];
  if (!stele) return;
  currentSteleLang = lang;
  loadSteleContent(stele, lang);
};

/** Minimal markdown → HTML (headings, italics, bold, hr, paragraphs) */
function renderMarkdown(md) {
  return md
    .split('\n')
    .map(line => {
      if (line.match(/^---+$/)) return '<hr>';
      if (line.match(/^### /)) return `<h3>${line.slice(4)}</h3>`;
      if (line.match(/^## /)) return `<h2>${line.slice(3)}</h2>`;
      if (line.match(/^# /)) return `<h1>${line.slice(2)}</h1>`;
      if (line.trim() === '') return '<br>';
      // Bold + italic
      line = line.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');
      return `<p>${line}</p>`;
    })
    .join('\n');
}

async function showCitizenPanel(citizen) {
  const panel = document.getElementById('citizen-panel');
  if (!panel) return;

  document.getElementById('cp-name').textContent = citizen.name || citizen.handle || 'Unknown';
  document.getElementById('cp-class').textContent = citizen.social_class || '';
  document.getElementById('cp-desc').textContent = citizen.description || citizen.personality || 'A citizen of Venice.';
  document.getElementById('cp-ducats').textContent = citizen.ducats ? Math.floor(citizen.ducats).toLocaleString() + ' ₫' : '—';
  document.getElementById('cp-influence').textContent = citizen.influence ? Math.floor(citizen.influence).toLocaleString() : '—';
  document.getElementById('cp-guild').textContent = citizen.guild || '—';
  document.getElementById('cp-motto').textContent = citizen.family_motto || '—';

  const btn = document.getElementById('cp-partner-btn');
  btn.classList.remove('chosen');
  btn.textContent = 'Choisir comme partenaire';

  panel.style.display = 'block';

  // Fetch real context from graph
  const citizenId = citizen.id || citizen.username;
  const connectionsEl = document.getElementById('cp-connections');
  if (connectionsEl && citizenId) {
    connectionsEl.textContent = 'Loading...';
    try {
      const resp = await fetch(`/api/citizen/${encodeURIComponent(citizenId)}/context`);
      if (resp.ok) {
        const data = await resp.json();
        const connTexts = (data.connections || [])
          .filter(c => c.synthesis)
          .map(c => c.synthesis)
          .slice(0, 5);
        connectionsEl.textContent = connTexts.length > 0
          ? connTexts.join(' • ')
          : data.synthesis || 'A citizen of Venice.';
      } else {
        connectionsEl.textContent = '';
      }
    } catch {
      connectionsEl.textContent = '';
    }
  }
}

window.choosePartner = function() {
  if (!selectedCitizen?.userData?.citizen) return;
  const citizen = selectedCitizen.userData.citizen;
  const btn = document.getElementById('cp-partner-btn');
  btn.classList.add('chosen');
  btn.textContent = `${citizen.first_name || citizen.name} est votre partenaire`;

  // Store choice
  localStorage.setItem('venice_partner', JSON.stringify({
    id: citizen.id,
    name: citizen.name,
    social_class: citizen.social_class,
    chosen_at: new Date().toISOString(),
  }));

  console.log(`Partner chosen: ${citizen.name} (${citizen.id})`);
};

// ─── Labels ───────────────────────────────────────────

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
    const params = new URLSearchParams(window.location.search);
    const worldName = params.get('world') || 'venezia';
    if (statusEl) statusEl.innerHTML = `<span>Loading ${worldName}...</span>`;

    const world = await worldLoader.load(`/worlds/${worldName}/world-manifest.json`);

    // Render buildings
    if (world.buildings && world.buildings.length > 0) {
      const buildingRenderer = new BuildingRenderer(scene, {
        nameLabels: world.manifest.buildings?.name_labels ?? true,
        labelHeight: world.manifest.buildings?.label_height ?? 3.0,
      });
      buildingRenderer.render(world.buildings);
      activeBuildingRenderer = buildingRenderer;
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
  checkPlayerProximity(elapsed);
  sendPosition(elapsed);
  renderer.render(scene, camera);
}

// ─── Resize ────────────────────────────────────────────

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Voice (push-to-talk) ─────────────────────────────

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let micStream = null;

const voiceStatusEl = document.getElementById('voice-status');

async function startRecording() {
  if (isRecording) return;
  try {
    if (!micStream) {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    audioChunks = [];
    mediaRecorder = new MediaRecorder(micStream, { mimeType: 'audio/webm;codecs=opus' });
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = () => sendVoice();
    mediaRecorder.start();
    isRecording = true;
    if (voiceStatusEl) {
      voiceStatusEl.style.display = 'block';
      voiceStatusEl.style.color = '#ff4444';
      voiceStatusEl.textContent = '🎤 Recording...';
    }
  } catch (e) {
    console.warn('Mic access denied:', e.message);
  }
}

function stopRecording() {
  if (!isRecording || !mediaRecorder) return;
  mediaRecorder.stop();
  isRecording = false;
  if (voiceStatusEl) {
    voiceStatusEl.style.color = '#ffcc44';
    voiceStatusEl.textContent = '⏳ Processing...';
  }
}

async function sendVoice() {
  if (audioChunks.length === 0) return;
  const blob = new Blob(audioChunks, { type: 'audio/webm' });
  const buffer = await blob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

  // Find nearest citizen to route the speech to
  let nearestId = null;
  let nearestGroup = null;
  let nearestDist = Infinity;
  for (const [id, group] of citizenMeshes) {
    const dx = camera.position.x - group.position.x;
    const dz = camera.position.z - group.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestId = id;
      nearestGroup = group;
    }
  }

  if (!nearestId || nearestDist > 15) {
    if (voiceStatusEl) {
      voiceStatusEl.textContent = 'No citizen nearby';
      setTimeout(() => { voiceStatusEl.style.display = 'none'; }, 2000);
    }
    return;
  }

  // Show thinking bubble on the citizen
  if (nearestGroup) {
    showBubble(nearestGroup, '...');
    nearestGroup.userData.state = 'talking';
    nearestGroup.userData.stateTimer = 20;
    // Face the player
    const dx = camera.position.x - nearestGroup.position.x;
    const dz = camera.position.z - nearestGroup.position.z;
    nearestGroup.rotation.y = Math.atan2(dx, dz);
  }

  try {
    // Send to server — STT + route to citizen
    const resp = await fetch('/api/citizen/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio_base64: base64,
        citizen_id: nearestId,
        player_name: visitorName,
        player_position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      if (nearestGroup && data.text) {
        removeBubble(nearestGroup);
        showBubble(nearestGroup, data.text.length > 80 ? data.text.slice(0, 77) + '...' : data.text);
        nearestGroup.userData.stateTimer = 8;
        console.log(`[Voice] ${data.citizen_name}: "${data.text}"`);
      }
      if (voiceStatusEl) {
        voiceStatusEl.textContent = `💬 ${data.citizen_name || 'Citizen'} responded`;
        setTimeout(() => { voiceStatusEl.style.display = 'none'; }, 3000);
      }
    } else {
      if (voiceStatusEl) {
        voiceStatusEl.textContent = '❌ No response';
        setTimeout(() => { voiceStatusEl.style.display = 'none'; }, 2000);
      }
      if (nearestGroup) {
        removeBubble(nearestGroup);
        nearestGroup.userData.state = 'idle';
      }
    }
  } catch (e) {
    console.warn('[Voice] Send failed:', e.message);
    if (voiceStatusEl) {
      voiceStatusEl.style.display = 'none';
    }
    if (nearestGroup) {
      removeBubble(nearestGroup);
      nearestGroup.userData.state = 'idle';
    }
  }
}

// Push-to-talk: V key or mic button
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyV' && !e.repeat) startRecording();
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'KeyV') stopRecording();
});

// Mic button (for mobile/touch)
const micBtn = document.getElementById('mic-btn');
if (micBtn) {
  micBtn.addEventListener('pointerdown', startRecording);
  micBtn.addEventListener('pointerup', stopRecording);
  micBtn.addEventListener('pointerleave', stopRecording);
}

// ─── Citizen Perception (AI sees you approach) ────────

const PERCEPTION_DISTANCE = 8;  // meters — citizen "sees" you
const PERCEPTION_COOLDOWN = 30; // seconds — don't re-trigger same citizen
const perceivedRecently = new Map(); // citizenId -> timestamp
let perceiving = false; // prevent concurrent calls

// Secondary camera for citizen POV screenshots
const citizenCamera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
const citizenRenderTarget = new THREE.WebGLRenderTarget(256, 256);

function checkPlayerProximity(elapsed) {
  if (perceiving) return;

  for (const [id, group] of citizenMeshes) {
    const dx = camera.position.x - group.position.x;
    const dz = camera.position.z - group.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > PERCEPTION_DISTANCE) continue;
    if (dist < 1) continue; // too close, already interacting

    // Cooldown check
    const lastPerceived = perceivedRecently.get(id) || 0;
    if (elapsed - lastPerceived < PERCEPTION_COOLDOWN) continue;

    // Don't trigger if citizen is already talking
    if (group.userData.state === 'talking') continue;

    // Trigger perception!
    perceivedRecently.set(id, elapsed);
    perceiving = true;

    triggerPerception(id, group).finally(() => { perceiving = false; });
    break; // one at a time
  }
}

async function triggerPerception(citizenId, group) {
  const citizen = group.userData.citizen;
  if (!citizen) return;

  // Citizen turns to face the player
  const dx = camera.position.x - group.position.x;
  const dz = camera.position.z - group.position.z;
  group.rotation.y = Math.atan2(dx, dz);

  // Render a frame from the citizen's POV (looking at the player)
  let screenshot_base64 = null;
  try {
    citizenCamera.position.copy(group.position);
    citizenCamera.position.y += 1.7; // eye height
    citizenCamera.lookAt(camera.position.x, camera.position.y, camera.position.z);

    renderer.setRenderTarget(citizenRenderTarget);
    renderer.render(scene, citizenCamera);
    renderer.setRenderTarget(null);

    // Read pixels to canvas -> JPEG base64
    const pixels = new Uint8Array(256 * 256 * 4);
    renderer.readRenderTargetPixels(citizenRenderTarget, 0, 0, 256, 256, pixels);

    const cvs = document.createElement('canvas');
    cvs.width = 256;
    cvs.height = 256;
    const ctx = cvs.getContext('2d');
    const imgData = ctx.createImageData(256, 256);
    // Flip Y (WebGL is bottom-up)
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const srcIdx = ((255 - y) * 256 + x) * 4;
        const dstIdx = (y * 256 + x) * 4;
        imgData.data[dstIdx] = pixels[srcIdx];
        imgData.data[dstIdx + 1] = pixels[srcIdx + 1];
        imgData.data[dstIdx + 2] = pixels[srcIdx + 2];
        imgData.data[dstIdx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    screenshot_base64 = cvs.toDataURL('image/jpeg', 0.7).split(',')[1];
  } catch (e) {
    console.warn('Screenshot capture failed:', e.message);
  }

  // Show thinking indicator
  showBubble(group, '...');
  group.userData.state = 'talking';
  group.userData.stateTimer = 30; // long timer while waiting for AI

  // Find nearest building name
  let nearestBuilding = '';
  let minBldDist = Infinity;
  for (const pos of buildingPositions) {
    const bdx = group.position.x - pos.x;
    const bdz = group.position.z - pos.z;
    const bdist = Math.sqrt(bdx * bdx + bdz * bdz);
    if (bdist < minBldDist) {
      minBldDist = bdist;
      nearestBuilding = pos.name || '';
    }
  }

  try {
    const resp = await fetch(`/api/citizen/${encodeURIComponent(citizenId)}/perceive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screenshot_base64,
        player_name: visitorName,
        location_name: nearestBuilding ? `near ${nearestBuilding}` : 'Venice',
        nearby_building: nearestBuilding,
        time_of_day: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      removeBubble(group);
      showBubble(group, data.text.length > 80 ? data.text.slice(0, 77) + '...' : data.text);
      group.userData.stateTimer = 8 + Math.random() * 4;
      console.log(`[Perception] ${data.citizen_name}: "${data.text}"`);
    } else {
      removeBubble(group);
      group.userData.state = 'idle';
    }
  } catch (e) {
    console.warn(`[Perception] Failed for ${citizenId}:`, e.message);
    removeBubble(group);
    group.userData.state = 'idle';
  }
}

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

      case 'citizen_pose': {
        // Idle pose update from L1 drive state — animate body language
        const v = visitors.get(msg.citizenId);
        if (v && msg.pose) {
          // Store pose data on the group for the animation loop to read
          v.userData.idlePose = msg.pose;
          v.userData.poseReceivedAt = performance.now();
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
