import * as THREE from 'three';
import {
  PHYSICALIZATION_STATUSES,
  compilePhysicalizationManifest,
} from './loop-studio-physicalization.js';

const STATUS_COLORS = Object.freeze({
  healthy: 0x68d7a0,
  degraded: 0xe0b25e,
  stale: 0x858b96,
  unknown: 0x7187ad,
  not_measured: 0x566271,
  measurement_failed: 0xd46d72,
});

function geometryFor(type, roundness = 12) {
  const detail = roundness > 24 ? 2 : 1;
  switch (type) {
    case 'sphere': return new THREE.SphereGeometry(0.72, 24, 16);
    case 'box': return new THREE.BoxGeometry(1.15, 1.15, 1.15, 2, 2, 2);
    case 'cylinder': return new THREE.CylinderGeometry(0.58, 0.72, 1.25, 20);
    case 'torus': return new THREE.TorusGeometry(0.63, 0.2, 12, 30);
    case 'icosahedron': return new THREE.IcosahedronGeometry(0.82, detail);
    case 'octahedron': return new THREE.OctahedronGeometry(0.86, detail);
    case 'ring': return new THREE.TorusGeometry(0.72, 0.05, 8, 32);
    case 'socket': return new THREE.TorusGeometry(0.42, 0.09, 8, 28);
    case 'shell': return new THREE.IcosahedronGeometry(1, detail);
    default: return new THREE.BoxGeometry(1, 1, 1);
  }
}

function applyTransform(object, transform) {
  object.position.fromArray(transform.position ?? [0, 0, 0]);
  object.rotation.set(...(transform.rotation ?? [0, 0, 0]));
  object.scale.fromArray(transform.scale ?? [1, 1, 1]);
}

function materialFor(primitive, status) {
  const color = new THREE.Color(STATUS_COLORS[status]);
  const material = primitive.material ?? {};
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.52 + (material.patina ?? 0) * 0.34,
    metalness: Math.max(0.05, 0.5 - (material.patina ?? 0) * 0.35),
    emissive: color,
    emissiveIntensity: material.emission ?? 0,
    transparent: (material.opacity ?? 1) < 1,
    opacity: material.opacity ?? 1,
    wireframe: material.wireframe ?? false,
    depthWrite: (material.opacity ?? 1) > 0.35,
  });
}

function createConnector(primitive, status) {
  const continuity = primitive.properties?.continuity ?? 1;
  const group = new THREE.Group();
  const color = new THREE.Color(STATUS_COLORS[status]);
  const segmentMaterial = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: primitive.material?.emission ?? 0,
    transparent: true,
    opacity: primitive.material?.opacity ?? 0.7,
    roughness: 0.45,
    metalness: 0.55,
  });

  if (continuity > 0.02) {
    const length = Math.max(0.12, continuity * 1.1);
    const geometry = new THREE.CylinderGeometry(0.045, 0.045, length, 10);
    const segment = new THREE.Mesh(geometry, segmentMaterial);
    segment.position.y = -length / 2;
    group.add(segment);
  } else {
    const geometry = new THREE.CylinderGeometry(0.045, 0.045, 0.38, 10);
    const upper = new THREE.Mesh(geometry, segmentMaterial.clone());
    const lower = new THREE.Mesh(geometry, segmentMaterial.clone());
    upper.position.set(-0.12, -0.25, 0);
    upper.rotation.z = 0.18;
    lower.position.set(0.12, -0.82, 0);
    lower.rotation.z = -0.18;
    group.add(upper, lower);
  }

  applyTransform(group, primitive.transform);
  return group;
}

function createFailureMarker(primitive, status) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: STATUS_COLORS[status],
    transparent: true,
    opacity: primitive.material?.opacity ?? 0.95,
  });
  const geometry = new THREE.BoxGeometry(0.08, 1.25, 0.08);
  const first = new THREE.Mesh(geometry, material);
  const second = new THREE.Mesh(geometry, material.clone());
  first.rotation.z = Math.PI / 4;
  second.rotation.z = -Math.PI / 4;
  group.add(first, second);
  applyTransform(group, primitive.transform);
  return group;
}

function createPrimitiveObject(primitive, status, plan) {
  let object;
  if (primitive.type === 'connector') {
    object = createConnector(primitive, status);
  } else if (primitive.role === 'failure_front') {
    object = createFailureMarker(primitive, status);
  } else {
    const geometryType = primitive.type === 'shell'
      ? plan.primitives.find((item) => item.role === 'semantic_core')?.type ?? 'icosahedron'
      : primitive.type;
    object = new THREE.Mesh(
      geometryFor(geometryType, plan.parameters.roundness),
      materialFor(primitive, status),
    );
    applyTransform(object, primitive.transform);
    object.visible = primitive.properties?.visible !== false && (primitive.material?.opacity ?? 1) > 0;
  }

  object.userData.physicalizationPrimitive = {
    id: primitive.id,
    type: primitive.type,
    role: primitive.role,
    status,
  };
  return object;
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  });
}

function visibleThroughHierarchy(object) {
  let current = object;
  while (current) {
    if (current.visible === false) return false;
    current = current.parent;
  }
  return true;
}

function countVisibleMeshes(root) {
  let count = 0;
  root.traverse((child) => {
    if (child.isMesh && visibleThroughHierarchy(child)) count += 1;
  });
  return count;
}

function readNodeFromInspector() {
  const id = document.querySelector('#selected-id')?.textContent?.trim();
  const subtypeText = document.querySelector('#selected-subtype')?.textContent?.trim() ?? '';
  const subtype = subtypeText.split('·').at(-1)?.trim() || 'physicalization_toolkit';
  if (!id) return null;

  const number = (selector, fallback) => {
    const value = Number(document.querySelector(selector)?.value);
    return Number.isFinite(value) ? value : fallback;
  };

  return {
    id,
    subtype,
    lifecycle: document.querySelector('#selected-lifecycle')?.value || 'unknown',
    epistemic: document.querySelector('#selected-epistemic')?.value || 'unknown',
    visual: {
      scale: number('#visual-scale', 1),
      roundness: number('#visual-roundness', 12),
      shell: number('#visual-shell', 1),
      emission: number('#visual-emission', 0),
      pulse: number('#visual-pulse', 0),
      opacity: number('#visual-opacity', 1),
    },
  };
}

export function createPhysicalizationPreview({ canvas, manifestElement }) {
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Physicalization preview requires a canvas.');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 1.1, 11.5);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xbfd7ff, 0x121722, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(5, 8, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8aa9ff, 1.2);
  rim.position.set(-6, 2, -4);
  scene.add(rim);

  const root = new THREE.Group();
  scene.add(root);
  let compiled = [];
  let manifest = null;

  function resize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const pixelWidth = Math.floor(width * renderer.getPixelRatio());
    const pixelHeight = Math.floor(height * renderer.getPixelRatio());
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }

  function clear() {
    for (const child of [...root.children]) {
      root.remove(child);
      disposeObject(child);
    }
    compiled = [];
  }

  function update(node) {
    clear();
    const compiledManifest = compilePhysicalizationManifest(node);
    const materialized = [];
    const positions = [
      [-3.5, 1.45, 0], [0, 1.45, 0], [3.5, 1.45, 0],
      [-3.5, -1.55, 0], [0, -1.55, 0], [3.5, -1.55, 0],
    ];

    compiledManifest.plans.forEach((plan, index) => {
      const group = new THREE.Group();
      group.position.set(...positions[index]);
      group.userData.plan = plan;
      group.userData.phase = index * 0.7;
      for (const primitive of plan.primitives) {
        const object = createPrimitiveObject(primitive, plan.status, plan);
        group.add(object);
        materialized.push({ ...object.userData.physicalizationPrimitive, visible: object.visible !== false });
      }
      root.add(group);
      compiled.push(group);
    });

    root.updateMatrixWorld(true);
    const expectedIds = compiledManifest.plans.flatMap((plan) =>
      plan.primitives.map((primitive) => `${plan.status}:${primitive.id}`));
    const materializedIds = materialized.map((primitive) => `${primitive.status}:${primitive.id}`);
    const materializedPrimitiveTypes = [...new Set(materialized.map((primitive) => primitive.type))];
    const drawnPrimitiveTypes = [...new Set(materialized.filter((primitive) => primitive.visible).map((primitive) => primitive.type))];
    const actualDrawCallCount = countVisibleMeshes(root);

    manifest = {
      ...compiledManifest,
      renderer: 'three-js-preview-v0',
      observedAt: new Date().toISOString(),
      materializedPrimitives: materialized,
      materializedPrimitiveTypes,
      drawnPrimitiveTypes,
      drawCallCount: actualDrawCallCount,
      drawCallMeasurement: 'visible-mesh-count',
      observerClaims: {
        ...compiledManifest.observerClaims,
        renderedPlanParity: JSON.stringify(materializedIds.sort()) === JSON.stringify(expectedIds.sort()),
      },
    };

    if (manifestElement) {
      const claims = Object.values(manifest.observerClaims);
      const passed = claims.every(Boolean);
      manifestElement.dataset.health = passed ? 'healthy' : 'degraded';
      manifestElement.textContent = `${passed ? 'manifest verified' : 'manifest degraded'} · ${manifest.archetype} · ${manifest.drawCallCount} visible meshes`;
      manifestElement.title = JSON.stringify(manifest.observerClaims, null, 2);
    }
  }

  const clock = new THREE.Clock();
  function animate() {
    resize();
    const elapsed = clock.getElapsedTime();
    for (const group of compiled) {
      const plan = group.userData.plan;
      const pulse = plan.parameters.pulse * plan.statusModulation.motionFactor;
      const factor = 1 + Math.sin(elapsed * Math.max(0.2, pulse) + group.userData.phase) * pulse * 0.025;
      group.scale.setScalar(factor);
      if (plan.status !== 'stale' && plan.status !== 'not_measured' && plan.status !== 'measurement_failed') {
        group.rotation.y = elapsed * 0.12 * plan.statusModulation.motionFactor;
      }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  return Object.freeze({
    update,
    getManifest: () => manifest ? structuredClone(manifest) : null,
    destroy() {
      resizeObserver.disconnect();
      clear();
      renderer.dispose();
    },
  });
}

function autoload() {
  const canvas = document.querySelector('#physicalization-canvas');
  if (!canvas) return;
  const preview = createPhysicalizationPreview({
    canvas,
    manifestElement: document.querySelector('#physicalization-manifest-status'),
  });
  globalThis.loopStudioPhysicalizationPreview = preview;

  let scheduled = false;
  const scheduleUpdate = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const node = readNodeFromInspector();
      if (node) preview.update(node);
    });
  };

  const watched = [
    '#selected-id', '#selected-subtype', '#selected-lifecycle', '#selected-epistemic',
    '#visual-scale', '#visual-roundness', '#visual-shell', '#visual-emission',
    '#visual-pulse', '#visual-opacity',
  ];
  for (const selector of watched) {
    const element = document.querySelector(selector);
    element?.addEventListener('input', scheduleUpdate);
    element?.addEventListener('change', scheduleUpdate);
  }

  const identityObserver = new MutationObserver(scheduleUpdate);
  const selectedId = document.querySelector('#selected-id');
  const selectedSubtype = document.querySelector('#selected-subtype');
  if (selectedId) identityObserver.observe(selectedId, { childList: true, subtree: true, characterData: true });
  if (selectedSubtype) identityObserver.observe(selectedSubtype, { childList: true, subtree: true, characterData: true });

  scheduleUpdate();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoload, { once: true });
} else {
  autoload();
}
