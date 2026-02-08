/**
 * The Island — first piece of land in Cities of Light.
 * Sky (atmospheric scattering), ocean (reflective Water shader), sand island.
 */

import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';

// ─── Sun parameters (shared between sky and water) ──────

const sunParams = {
  turbidity: 4,
  rayleigh: 1.5,
  mieCoefficient: 0.005,
  mieDirectionalG: 0.8,
  elevation: 12, // Low sun — golden hour
  azimuth: 210,
};

/**
 * Compute sun position from elevation/azimuth angles.
 */
function getSunPosition() {
  const phi = THREE.MathUtils.degToRad(90 - sunParams.elevation);
  const theta = THREE.MathUtils.degToRad(sunParams.azimuth);
  return new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
}

/**
 * Simple 2D Simplex-like noise for terrain generation.
 * Deterministic — same seed gives same island every time.
 */
function noise2D(x, z) {
  // Hash-based pseudo-noise (no dependencies)
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

function fbm(x, z, octaves = 4) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, z * frequency) * amplitude;
    maxAmp += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / maxAmp;
}

// ─── Island geometry ────────────────────────────────────

function createIslandMesh() {
  // Circular disc — 30m diameter, high subdivision for terrain detail
  const radius = 15;
  const segments = 64;
  const geom = new THREE.CircleGeometry(radius, segments, 0, Math.PI * 2);
  geom.rotateX(-Math.PI / 2); // Lay flat

  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const dist = Math.sqrt(x * x + z * z);

    // Normalize distance (0 at center, 1 at edge)
    const t = dist / radius;

    // Height: dome shape with noise
    const domeHeight = Math.max(0, 1 - t * t) * 2.5; // Max 2.5m at center
    const noiseVal = fbm(x * 0.15, z * 0.15, 3) * 0.6;

    // Shore falloff — steep drop at edges
    const shoreFalloff = t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) : 1;

    const height = (domeHeight + noiseVal) * shoreFalloff;
    pos.setY(i, Math.max(-0.1, height));
  }

  geom.computeVertexNormals();

  // Sand material — warm with slight variation
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc9a96e,
    roughness: 0.92,
    metalness: 0.0,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.position.y = 0; // Water level is at y=0

  return mesh;
}

// ─── Shore ring (wet sand/foam transition) ──────────────

function createShoreRing() {
  const geom = new THREE.RingGeometry(13.5, 16, 64);
  geom.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x9a8055,
    roughness: 0.6,
    metalness: 0.15,
    transparent: true,
    opacity: 0.5,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.y = 0.02; // Just above water
  return mesh;
}

// ─── Exports ────────────────────────────────────────────

/**
 * Create the full environment: sky, water, island.
 * Returns { group, water, sky, sun } for animation loop access.
 */
export function createEnvironment(scene, renderer) {
  const group = new THREE.Group();

  // ─── Sky ────────────────────────────────────────────────

  const sky = new Sky();
  sky.scale.setScalar(10000);

  const skyUniforms = sky.material.uniforms;
  skyUniforms['turbidity'].value = sunParams.turbidity;
  skyUniforms['rayleigh'].value = sunParams.rayleigh;
  skyUniforms['mieCoefficient'].value = sunParams.mieCoefficient;
  skyUniforms['mieDirectionalG'].value = sunParams.mieDirectionalG;

  const sunPosition = getSunPosition();
  skyUniforms['sunPosition'].value.copy(sunPosition);

  scene.add(sky); // Sky added to scene directly (not group — it's a background)

  // ─── Sun light (match sky sun position) ─────────────────

  const sunLight = new THREE.DirectionalLight(0xffcc88, 2.5);
  sunLight.position.copy(sunPosition).multiplyScalar(100);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 1024; // Quest-friendly
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 200;
  sunLight.shadow.camera.left = -25;
  sunLight.shadow.camera.right = 25;
  sunLight.shadow.camera.top = 25;
  sunLight.shadow.camera.bottom = -25;
  group.add(sunLight);

  // ─── Water ──────────────────────────────────────────────

  const waterGeom = new THREE.PlaneGeometry(1000, 1000);
  const water = new Water(waterGeom, {
    textureWidth: 256, // Lower for Quest performance
    textureHeight: 256,
    waterNormals: new THREE.TextureLoader().load(
      'https://threejs.org/examples/textures/waternormals.jpg',
      (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      }
    ),
    sunDirection: sunPosition.clone().normalize(),
    sunColor: 0xffffff,
    waterColor: 0x001e4d,
    distortionScale: 2.0,
    fog: false,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  group.add(water);

  // ─── Island ─────────────────────────────────────────────

  const island = createIslandMesh();
  group.add(island);

  // Shore transition
  const shore = createShoreRing();
  group.add(shore);

  // ─── PMREMGenerator for environment reflections ─────────

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const sceneEnv = new THREE.Scene();
  sceneEnv.add(sky.clone());
  const renderTarget = pmremGenerator.fromScene(sceneEnv);
  scene.environment = renderTarget.texture;
  pmremGenerator.dispose();
  sceneEnv.clear();

  return { group, water, sky, sunLight };
}

/**
 * Update water animation. Call every frame.
 */
export function updateEnvironment(env, elapsed) {
  if (env.water?.material?.uniforms?.['time']) {
    env.water.material.uniforms['time'].value = elapsed * 0.5;
  }
}
