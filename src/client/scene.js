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
  sunLight.shadow.camera.left = -25;
  sunLight.shadow.camera.right = 25;
  sunLight.shadow.camera.top = 25;
  sunLight.shadow.camera.bottom = -25;
  group.add(sunLight);

  // ── Ocean ─────────────────────────────────────────────

  const waterGeom = new THREE.PlaneGeometry(2000, 2000);
  const water = new Water(waterGeom, {
    textureWidth: 256,
    textureHeight: 256,
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

  // ── Island ────────────────────────────────────────────

  const island = buildIsland();
  group.add(island);

  // ── Stars (subtle, near zenith) ───────────────────────

  const starCount = 400;
  const starGeom = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const t = Math.random() * Math.PI * 2;
    const p = Math.random() * Math.PI * 0.3;
    const r = 420;
    starPos[i * 3] = r * Math.sin(p) * Math.cos(t);
    starPos[i * 3 + 1] = r * Math.cos(p);
    starPos[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
  }
  starGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.5,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.3,
  });
  group.add(new THREE.Points(starGeom, starMat));

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

// ─── Island Construction ──────────────────────────────────

function buildIsland() {
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
      const noise = fbm(x * 0.12 + 50, y * 0.12 + 50, 4);
      height = falloff * (1.0 + (noise - 0.5) * 0.6);
      height = Math.max(0.1, height);

      // Vertex color: dry sand + dark patches
      const patchNoise = fbm(x * 0.3 + 200, y * 0.3 + 200, 3);
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

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.0,
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

  // ── Beach rocks ───────────────────────────────────────

  const rockGeom = new THREE.DodecahedronGeometry(0.25, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x555555,
    roughness: 0.95,
    metalness: 0.1,
  });

  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = radius * (0.6 + Math.random() * 0.3);
    const rock = new THREE.Mesh(rockGeom, rockMat);
    rock.position.set(
      Math.cos(angle) * dist,
      0.05 + Math.random() * 0.15,
      Math.sin(angle) * dist
    );
    rock.scale.setScalar(0.5 + Math.random() * 1.2);
    rock.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
    rock.castShadow = true;
    island.add(rock);
  }

  return island;
}
