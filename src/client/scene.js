/**
 * The Island — first piece of land in Cities of Light.
 *
 * Sky: Preetham atmospheric scattering (golden hour)
 * Water: Reflective ocean with animated waves
 * Land: Procedural sand island with shore transition
 */

import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';

// ─── Procedural Noise (hash-based, deterministic) ─────────

function hash2D(ix, iy) {
  let n = ix * 1087 + iy * 2749;
  n = ((n >> 13) ^ n) * 1274126177;
  return ((n >> 16) ^ n & 0x7fffff) / 0x7fffff;
}

function smoothNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x, y, octaves = 4) {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * smoothNoise(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2;
  }
  return val;
}

// ─── Sun Configuration (golden hour) ──────────────────────

const SUN_ELEVATION = 12;
const SUN_AZIMUTH = 220;

function getSunPosition() {
  const phi = THREE.MathUtils.degToRad(90 - SUN_ELEVATION);
  const theta = THREE.MathUtils.degToRad(SUN_AZIMUTH);
  return new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
}

// ─── Island Registry (archipelago) ────────────────────────

const ISLANDS = [
  { name: "Nicolas", x: 0, z: 0, seed: 0 },
  { name: "Bassel", x: 42, z: 18, seed: 777 },
  { name: "The Archive", x: -30, z: -25, seed: 333 },
  { name: "The Garden", x: 25, z: -35, seed: 555 },
  { name: "The Agora", x: -20, z: 40, seed: 888 },
];

export { ISLANDS };

// ─── Main Environment Builder ─────────────────────────────

export function createEnvironment(scene, renderer) {
  const group = new THREE.Group();
  const sunPosition = getSunPosition();

  // ── Sky (Preetham atmospheric model) ──────────────────

  const sky = new Sky();
  sky.scale.setScalar(450); // Within camera frustum (far=1000)

  const skyUniforms = sky.material.uniforms;
  skyUniforms['turbidity'].value = 4;
  skyUniforms['rayleigh'].value = 1.5;
  skyUniforms['mieCoefficient'].value = 0.005;
  skyUniforms['mieDirectionalG'].value = 0.85;
  skyUniforms['sunPosition'].value.copy(sunPosition);

  scene.add(sky); // Added to scene directly — acts as background

  // ── Sun light (matches sky) ───────────────────────────

  const sunLight = new THREE.DirectionalLight(0xffcc88, 2.5);
  sunLight.position.copy(sunPosition).multiplyScalar(100);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 200;
  sunLight.shadow.camera.left = -50;
  sunLight.shadow.camera.right = 50;
  sunLight.shadow.camera.top = 50;
  sunLight.shadow.camera.bottom = -50;
  group.add(sunLight);

  // ── Ocean ─────────────────────────────────────────────

  const waterGeom = new THREE.PlaneGeometry(2000, 2000);
  const water = new Water(waterGeom, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load(
      'https://threejs.org/examples/textures/waternormals.jpg',
      (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      }
    ),
    sunDirection: sunPosition.clone().normalize(),
    sunColor: 0xfff5e0,
    waterColor: 0x001e4d,
    distortionScale: 2.0,
    clipBias: 0.001,
    fog: false,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  group.add(water);

  // ── Islands (archipelago) ─────────────────────────────

  for (const islandConfig of ISLANDS) {
    const fullIsland = buildCompleteIsland(islandConfig);
    group.add(fullIsland);
  }

  // ── Stars (varied sizes, colors, twinkling via shader) ──

  const starCount = 800;
  const starGeom = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  const starColors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const t = Math.random() * Math.PI * 2;
    const p = Math.random() * Math.PI * 0.35; // wider spread
    const r = 420;
    starPos[i * 3] = r * Math.sin(p) * Math.cos(t);
    starPos[i * 3 + 1] = r * Math.cos(p);
    starPos[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
    // Size variation: most small, few bright
    starSizes[i] = 0.5 + Math.pow(Math.random(), 3) * 3.0;
    // Color variation: warm whites, pale blues, soft ambers
    const warmth = Math.random();
    if (warmth < 0.6) {
      starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 1.0; starColors[i * 3 + 2] = 0.95;
    } else if (warmth < 0.8) {
      starColors[i * 3] = 0.85; starColors[i * 3 + 1] = 0.9; starColors[i * 3 + 2] = 1.0;
    } else {
      starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 0.9; starColors[i * 3 + 2] = 0.7;
    }
  }
  starGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeom.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
  starGeom.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  const starMat = new THREE.PointsMaterial({
    vertexColors: true,
    size: 1.5,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.4,
  });
  group.add(new THREE.Points(starGeom, starMat));

  // ── Clouds (procedural cloud layer) ─────────────────────

  const cloudLayer = buildClouds();
  group.add(cloudLayer);

  // ── Environment map from sky ──────────────────────────

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const sceneEnv = new THREE.Scene();
  sceneEnv.add(sky.clone());
  const renderTarget = pmremGenerator.fromScene(sceneEnv);
  scene.environment = renderTarget.texture;
  pmremGenerator.dispose();
  sceneEnv.clear();

  return { group, water, sky, sunLight };
}

// ─── Water animation (call every frame) ───────────────────

export function updateEnvironment(env, elapsed) {
  if (env.water?.material?.uniforms?.['time']) {
    env.water.material.uniforms['time'].value = elapsed * 0.5;
  }
}

// ─── Complete Island (terrain + palms + rocks, positioned) ─

function buildCompleteIsland({ name, x, z, seed }) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.userData.islandName = name;

  const island = buildIsland(seed);
  group.add(island);

  const palms = buildPalmTrees(seed);
  group.add(palms);

  const rocks = buildRockFormation(seed);
  group.add(rocks);

  // Island name marker (floating text visible from distance)
  const label = createIslandLabel(name);
  label.position.set(0, 8, 0);
  group.add(label);

  return group;
}

function createIslandLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.font = 'bold 48px Arial';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(8, 2, 1);
  return sprite;
}

// ─── Island Construction ──────────────────────────────────

function buildIsland(seed = 0) {
  const island = new THREE.Group();
  const radius = 14;
  const size = radius * 2 + 6;
  const segments = 64;

  // PlaneGeometry gives a proper vertex grid for terrain displacement
  const geom = new THREE.PlaneGeometry(size, size, segments, segments);
  const pos = geom.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const wetSand = new THREE.Color(0x8a7550);
  const drySand = new THREE.Color(0xd4b87a);
  const darkPatch = new THREE.Color(0x6b5a3e);
  const shoreWater = new THREE.Color(0x1a4a5a);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const dist = Math.sqrt(x * x + y * y);
    const normalized = dist / radius;

    let height;
    const color = new THREE.Color();

    if (normalized > 1.1) {
      // Beyond island — below water
      height = -0.5;
      color.copy(shoreWater);
    } else if (normalized > 0.85) {
      // Shore transition
      const t = (normalized - 0.85) / 0.25;
      const smooth = t * t * (3 - 2 * t);
      height = (1 - smooth) * 0.15;
      color.copy(wetSand).lerp(shoreWater, smooth);
    } else {
      // Island body — dome shape + noise
      const falloff = 1 - Math.pow(normalized, 2);
      const noise = fbm(x * 0.12 + 50 + seed, y * 0.12 + 50 + seed, 4);
      height = falloff * (1.0 + (noise - 0.5) * 0.6);
      height = Math.max(0.1, height);

      // Vertex color: dry sand + dark patches
      const patchNoise = fbm(x * 0.3 + 200 + seed, y * 0.3 + 200 + seed, 3);
      color.copy(drySand);
      if (patchNoise > 0.55) {
        color.lerp(darkPatch, Math.min(1, (patchNoise - 0.55) * 3));
      }
      // Wet sand near shore
      if (normalized > 0.65) {
        color.lerp(wetSand, (normalized - 0.65) / 0.2);
      }
    }

    pos.setZ(i, height);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.computeVertexNormals();

  // Procedural sand normal map (grainy surface detail)
  const sandNormalMap = generateSandNormalMap();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.0,
    normalMap: sandNormalMap,
    normalScale: new THREE.Vector2(0.3, 0.3),
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  island.add(mesh);

  // ── Shore ring (wet sand transition) ──────────────────

  const shoreGeom = new THREE.RingGeometry(13, 16, 64);
  shoreGeom.rotateX(-Math.PI / 2);
  const shoreMat = new THREE.MeshStandardMaterial({
    color: 0x9a8055,
    roughness: 0.6,
    metalness: 0.15,
    transparent: true,
    opacity: 0.4,
  });
  const shore = new THREE.Mesh(shoreGeom, shoreMat);
  shore.position.y = 0.02;
  island.add(shore);

  // ── Beach rocks (varied shapes, colors, clustered) ────

  const rockColors = [0x5a5a5a, 0x6b6b6b, 0x4a4a4a, 0x707060, 0x585850];
  const rockGeoms = [
    new THREE.DodecahedronGeometry(0.25, 0),
    new THREE.DodecahedronGeometry(0.25, 1), // smoother
    new THREE.IcosahedronGeometry(0.2, 0),
  ];

  // Deform rock geometries for natural look
  for (const g of rockGeoms) {
    const p = g.attributes.position;
    for (let j = 0; j < p.count; j++) {
      p.setX(j, p.getX(j) * (0.8 + hash2D(j * 7, j * 13) * 0.4));
      p.setY(j, p.getY(j) * (0.7 + hash2D(j * 11, j * 17) * 0.6));
      p.setZ(j, p.getZ(j) * (0.8 + hash2D(j * 19, j * 23) * 0.4));
    }
    g.computeVertexNormals();
  }

  for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = radius * (0.5 + Math.random() * 0.4);
    const geom = rockGeoms[Math.floor(Math.random() * rockGeoms.length)];
    const mat = new THREE.MeshStandardMaterial({
      color: rockColors[Math.floor(Math.random() * rockColors.length)],
      roughness: 0.9 + Math.random() * 0.1,
      metalness: 0.05,
    });
    const rock = new THREE.Mesh(geom, mat);
    rock.position.set(
      Math.cos(angle) * dist,
      0.02 + Math.random() * 0.12,
      Math.sin(angle) * dist
    );
    const s = 0.3 + Math.random() * 1.5;
    rock.scale.set(s, s * (0.4 + Math.random() * 0.6), s);
    rock.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
    rock.castShadow = true;
    rock.receiveShadow = true;
    island.add(rock);
  }

  return island;
}

// ─── Procedural Sand Normal Map ──────────────────────────

function generateSandNormalMap() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Multi-scale noise for sand grain detail
      const fine = smoothNoise(x * 0.5, y * 0.5);
      const med = smoothNoise(x * 0.15, y * 0.15);
      const coarse = smoothNoise(x * 0.04, y * 0.04);
      const val = fine * 0.5 + med * 0.3 + coarse * 0.2;

      // Compute normal from heightmap (central differences)
      const dx = smoothNoise((x + 1) * 0.5, y * 0.5) - smoothNoise((x - 1) * 0.5, y * 0.5);
      const dy = smoothNoise(x * 0.5, (y + 1) * 0.5) - smoothNoise(x * 0.5, (y - 1) * 0.5);

      // Normal map: tangent-space (R=X, G=Y, B=Z)
      data[idx] = Math.floor((dx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.floor((dy * 0.5 + 0.5) * 255);
      data[idx + 2] = 255; // Z always up
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8); // Tile across the island
  return texture;
}

// ─── Palm Trees ──────────────────────────────────────────

function buildPalmTrees(seed = 0) {
  const group = new THREE.Group();
  const radius = 14; // Island radius (match buildIsland)

  // Palm tree positions — scattered across the island, avoiding dead center
  // Seed offsets the positions slightly for variety between islands
  const basePalms = [
    { x: 3, z: 2, height: 6, lean: 0.15 },
    { x: -4, z: 3, height: 7, lean: 0.2 },
    { x: 5, z: -3, height: 5.5, lean: 0.1 },
    { x: -2, z: -5, height: 6.5, lean: 0.18 },
    { x: 7, z: 1, height: 5, lean: 0.25 },
    { x: -6, z: -2, height: 7.5, lean: 0.12 },
    { x: 1, z: 6, height: 6, lean: 0.2 },
    { x: -1, z: -7, height: 5.5, lean: 0.15 },
    { x: 8, z: -5, height: 4.5, lean: 0.3 },
    { x: -8, z: 4, height: 5, lean: 0.22 },
    { x: 4, z: -8, height: 4, lean: 0.28 },
    { x: -5, z: -8, height: 4.5, lean: 0.2 },
  ];

  // Apply seed-based offsets for uniqueness
  const palmPositions = basePalms.map((p, i) => ({
    x: p.x + (hash2D(i + seed, seed * 3) - 0.5) * 2,
    z: p.z + (hash2D(seed * 5, i + seed) - 0.5) * 2,
    height: p.height + (hash2D(i * 7 + seed, seed) - 0.5) * 1.5,
    lean: p.lean + (hash2D(seed, i * 11) - 0.5) * 0.1,
  }));

  for (const palm of palmPositions) {
    // Skip palms outside the island
    const dist = Math.sqrt(palm.x * palm.x + palm.z * palm.z);
    if (dist > radius * 0.8) continue;

    const tree = buildSinglePalm(palm.height, palm.lean);
    tree.position.set(palm.x, 0, palm.z);
    // Random rotation around Y for variety
    tree.rotation.y = hash2D(palm.x * 17 + seed, palm.z * 31 + seed) * Math.PI * 2;
    group.add(tree);
  }

  return group;
}

function buildSinglePalm(height, lean) {
  const tree = new THREE.Group();

  // ── Trunk (curved using segments) ──────────────────────
  const trunkSegments = 8;
  const trunkRadius = 0.12;
  const trunkColor = new THREE.Color(0x6b4226); // dark brown
  const trunkTopColor = new THREE.Color(0x8b6914); // lighter at top

  for (let i = 0; i < trunkSegments; i++) {
    const t = i / trunkSegments;
    const segHeight = height / trunkSegments;
    // Radius tapers toward top
    const r = trunkRadius * (1 - t * 0.5);
    const geom = new THREE.CylinderGeometry(r * 0.85, r, segHeight, 6);
    const color = trunkColor.clone().lerp(trunkTopColor, t);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.95,
      metalness: 0.0,
    });
    const seg = new THREE.Mesh(geom, mat);

    // Curved lean: accumulates toward one direction
    const leanX = lean * Math.sin(t * Math.PI * 0.7) * height;
    seg.position.set(leanX, t * height + segHeight / 2, 0);
    seg.castShadow = true;
    tree.add(seg);
  }

  // ── Coconut cluster (small spheres at trunk top) ────────
  const topX = lean * Math.sin(0.7 * Math.PI) * height;
  const topY = height;

  const coconutGeom = new THREE.SphereGeometry(0.08, 8, 8);
  const coconutMat = new THREE.MeshStandardMaterial({
    color: 0x3d2b1f,
    roughness: 0.8,
  });
  for (let i = 0; i < 3; i++) {
    const coconut = new THREE.Mesh(coconutGeom, coconutMat);
    const angle = (i / 3) * Math.PI * 2;
    coconut.position.set(
      topX + Math.cos(angle) * 0.15,
      topY - 0.1,
      Math.sin(angle) * 0.15
    );
    coconut.castShadow = true;
    tree.add(coconut);
  }

  // ── Fronds (radiating leaf planes) ──────────────────────
  const frondCount = 7;
  const frondLength = 3.5;
  const frondWidth = 0.8;

  for (let i = 0; i < frondCount; i++) {
    const angle = (i / frondCount) * Math.PI * 2;
    const frond = buildFrond(frondLength, frondWidth);
    frond.position.set(topX, topY, 0);
    frond.rotation.y = angle;
    // Droop: older fronds hang lower
    const droop = 0.3 + hash2D(i * 7, i * 13) * 0.4;
    frond.rotation.x = droop;
    tree.add(frond);
  }

  return tree;
}

function buildFrond(length, width) {
  const frond = new THREE.Group();

  // Frond spine (thin tapered shape)
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(length * 0.3, width * 0.5, length * 0.5, width * 0.3);
  shape.quadraticCurveTo(length * 0.8, width * 0.1, length, 0);
  shape.quadraticCurveTo(length * 0.8, -width * 0.1, length * 0.5, -width * 0.3);
  shape.quadraticCurveTo(length * 0.3, -width * 0.5, 0, 0);

  const geom = new THREE.ShapeGeometry(shape, 4);
  // Bend the frond downward along its length
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const t = x / length;
    // Droop increases toward tip
    pos.setZ(i, -t * t * length * 0.4);
  }
  geom.computeVertexNormals();

  // Two-sided green leaf
  const leafGreen = 0x2d5a1e + Math.floor(Math.random() * 0x101010);
  const mat = new THREE.MeshStandardMaterial({
    color: leafGreen,
    roughness: 0.7,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  frond.add(mesh);

  return frond;
}

// ─── Rock Formation (prominent boulders) ─────────────────

function buildRockFormation(seed = 0) {
  const group = new THREE.Group();

  // Main boulder cluster — seed rotates the cluster position around the island
  const clusterAngle = seed * 0.5; // Rotate cluster position by seed
  const cosA = Math.cos(clusterAngle), sinA = Math.sin(clusterAngle);
  const baseBoulders = [
    { x: -7, z: -4, scale: 2.2, squash: 0.6, color: 0x5a5550 },   // Main boulder
    { x: -6, z: -3.2, scale: 1.4, squash: 0.55, color: 0x625b52 }, // Leaning companion
    { x: -7.8, z: -3.5, scale: 1.0, squash: 0.7, color: 0x4e4a44 },// Small side rock
    { x: -6.5, z: -5, scale: 0.8, squash: 0.5, color: 0x58544e },  // Flat step stone
    { x: -8.2, z: -4.5, scale: 0.6, squash: 0.65, color: 0x6b6560 }, // Pebble
  ];
  const boulders = baseBoulders.map(b => ({
    ...b,
    x: b.x * cosA - b.z * sinA,
    z: b.x * sinA + b.z * cosA,
  }));

  for (const b of boulders) {
    // Start from icosahedron, deform for natural organic shape
    const detail = b.scale > 1.5 ? 2 : 1;
    const geom = new THREE.IcosahedronGeometry(b.scale, detail);
    const pos = geom.attributes.position;

    // Deform vertices — noise-based displacement for weathered look
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);

      // Noise displacement
      const n = fbm(vx * 1.5 + b.x + seed, vz * 1.5 + b.z + seed, 3);
      const displacement = 1 + (n - 0.5) * 0.35;

      pos.setX(i, vx * displacement);
      pos.setY(i, vy * b.squash * displacement); // Squash vertically
      pos.setZ(i, vz * displacement);
    }
    geom.computeVertexNormals();

    // Material: rough stone with slight color variation
    const mat = new THREE.MeshStandardMaterial({
      color: b.color,
      roughness: 0.95,
      metalness: 0.02,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(b.x, b.scale * b.squash * 0.4, b.z);
    mesh.rotation.y = hash2D(b.x * 17, b.z * 31) * Math.PI * 2;
    mesh.rotation.x = (hash2D(b.x * 7, b.z * 13) - 0.5) * 0.3; // Slight tilt
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}

// ─── Procedural Cloud Layer ──────────────────────────────

function buildClouds() {
  const group = new THREE.Group();

  // Generate cloud texture on canvas
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;

      // FBM cloud pattern
      const n = fbm(nx * 4 + 100, ny * 4 + 100, 5);

      // Cloud shape: threshold + soft edges
      const cloud = Math.max(0, (n - 0.4) / 0.35);
      const alpha = Math.min(1, cloud * cloud) * 0.6; // soft, not opaque

      // Golden hour tint: warm white to soft orange
      data[idx] = 255;
      data[idx + 1] = Math.floor(240 + n * 15);
      data[idx + 2] = Math.floor(210 + n * 30);
      data[idx + 3] = Math.floor(alpha * 255);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const cloudTexture = new THREE.CanvasTexture(canvas);
  cloudTexture.wrapS = cloudTexture.wrapT = THREE.RepeatWrapping;

  // Two cloud planes at different heights for depth
  for (const [height, scale, opacity] of [[80, 300, 0.5], [120, 400, 0.3]]) {
    const planeGeom = new THREE.PlaneGeometry(scale, scale);
    const planeMat = new THREE.MeshBasicMaterial({
      map: cloudTexture,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(planeGeom, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = height;
    group.add(plane);
  }

  return group;
}
