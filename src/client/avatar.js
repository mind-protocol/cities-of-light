/**
 * Avatar — a human citizen's presence in the Cities.
 * Phase 1: Simple geometric form with head tracking.
 */

import * as THREE from 'three';

export function createAvatar({ color = 0x00ff88, name = 'Citizen' } = {}) {
  const group = new THREE.Group();
  group.name = name;

  // ─── Head (sphere, tracks VR headset) ──────────────────

  const headGeom = new THREE.SphereGeometry(0.15, 16, 16);
  const headMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.3,
    metalness: 0.4,
    roughness: 0.6,
  });
  const head = new THREE.Mesh(headGeom, headMat);
  head.position.y = 1.7; // Eye height
  head.castShadow = true;
  group.add(head);

  // ─── Body (cylinder, standing) ─────────────────────────

  const bodyGeom = new THREE.CylinderGeometry(0.15, 0.2, 1.2, 8);
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: 0.6,
    metalness: 0.2,
    roughness: 0.8,
  });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.y = 0.9; // Torso center
  group.add(body);

  // ─── Glow (point light around citizen) ─────────────────

  const glow = new THREE.PointLight(color, 0.5, 5);
  glow.position.y = 1.2;
  group.add(glow);

  // ─── Name label (sprite, always faces camera) ──────────

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'transparent';
  ctx.fillRect(0, 0, 256, 64);
  ctx.font = '24px monospace';
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.textAlign = 'center';
  ctx.fillText(name, 128, 40);

  const labelTexture = new THREE.CanvasTexture(canvas);
  const labelMat = new THREE.SpriteMaterial({
    map: labelTexture,
    transparent: true,
  });
  const label = new THREE.Sprite(labelMat);
  label.position.y = 2.1;
  label.scale.set(1.5, 0.375, 1);
  group.add(label);

  // ─── Hands container (populated by network hand sync) ───
  const handsGroup = new THREE.Group();
  handsGroup.name = 'hands';
  group.add(handsGroup);

  return group;
}

// ─── AI Citizen Avatar (geometric shapes with glow) ──────

const AI_SHAPES = {
  icosahedron: () => new THREE.IcosahedronGeometry(0.25, 1),
  octahedron: () => new THREE.OctahedronGeometry(0.3, 0),
  torusknot: () => new THREE.TorusKnotGeometry(0.18, 0.06, 48, 8),
};

/**
 * Create an AI citizen avatar — glowing geometric form.
 * @param {{ color: number, name: string, shape: string }} opts
 */
export function createAICitizenAvatar({ color = 0xffffff, name = 'AI', shape = 'icosahedron' } = {}) {
  const group = new THREE.Group();
  group.name = name;
  group.userData.isAI = true;

  // Body (geometric shape)
  const geomFactory = AI_SHAPES[shape] || AI_SHAPES.icosahedron;
  const geom = geomFactory();
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.6,
    metalness: 0.5,
    roughness: 0.3,
    transparent: true,
    opacity: 0.85,
  });
  const body = new THREE.Mesh(geom, mat);
  body.position.y = 1.2;
  body.castShadow = true;
  group.add(body);

  // Glow ring
  const ringGeom = new THREE.TorusGeometry(0.35, 0.03, 8, 24);
  const ringMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.3,
  });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.position.y = 1.2;
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  // Point light
  const glow = new THREE.PointLight(color, 0.6, 5);
  glow.position.y = 1.2;
  group.add(glow);

  // Name label
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);
  ctx.font = 'bold 24px monospace';
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.textAlign = 'center';
  ctx.fillText(name, 128, 40);

  const labelTexture = new THREE.CanvasTexture(canvas);
  const labelMat = new THREE.SpriteMaterial({
    map: labelTexture,
    transparent: true,
    depthWrite: false,
  });
  const label = new THREE.Sprite(labelMat);
  label.position.y = 1.8;
  label.scale.set(1.5, 0.375, 1);
  group.add(label);

  return group;
}

// ─── Joint sphere pool for hand rendering ────────────────

const JOINT_SPHERE_RADIUS = 0.008;
const JOINT_COUNT = 25; // per hand
const CONTROLLER_RAY_LENGTH = 0.5;

/**
 * Create or get hand joint meshes for a remote avatar.
 * Returns { left: Group, right: Group } attached to avatar's hands group.
 */
export function ensureHandMeshes(avatar, color = 0x00ff88) {
  const handsGroup = avatar.children.find(c => c.name === 'hands');
  if (!handsGroup) return null;

  if (!handsGroup.userData._initialized) {
    const jointMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
    });
    const jointGeom = new THREE.SphereGeometry(JOINT_SPHERE_RADIUS, 6, 6);

    // Lines connecting joints (tendons)
    const lineMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.4,
    });

    for (const side of ['left', 'right']) {
      const handGroup = new THREE.Group();
      handGroup.name = side;
      handGroup.visible = false;

      // Joint spheres
      const spheres = [];
      for (let j = 0; j < JOINT_COUNT; j++) {
        const sphere = new THREE.Mesh(jointGeom, jointMat);
        sphere.frustumCulled = false;
        handGroup.add(sphere);
        spheres.push(sphere);
      }
      handGroup.userData.spheres = spheres;

      // Finger lines (wrist→thumb, wrist→index, etc.)
      const fingerChains = [
        [0, 1, 2, 3, 4],         // thumb
        [0, 5, 6, 7, 8, 9],      // index
        [0, 10, 11, 12, 13, 14], // middle
        [0, 15, 16, 17, 18, 19], // ring
        [0, 20, 21, 22, 23, 24], // pinky
      ];
      const lines = [];
      for (const chain of fingerChains) {
        const points = chain.map(() => new THREE.Vector3());
        const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(lineGeom, lineMat);
        line.frustumCulled = false;
        line.userData.chain = chain;
        handGroup.add(line);
        lines.push(line);
      }
      handGroup.userData.lines = lines;

      // Controller representation (hidden by default, shown in controller mode)
      const ctrlGroup = new THREE.Group();
      ctrlGroup.name = 'controller';
      ctrlGroup.visible = false;
      // Small box for controller body
      const ctrlBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.03, 0.12),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 })
      );
      ctrlGroup.add(ctrlBody);
      // Pointer ray
      const rayGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -CONTROLLER_RAY_LENGTH),
      ]);
      const ray = new THREE.Line(rayGeom, new THREE.LineBasicMaterial({
        color, transparent: true, opacity: 0.4,
      }));
      ctrlGroup.add(ray);
      handGroup.add(ctrlGroup);
      handGroup.userData.controllerMesh = ctrlGroup;

      handsGroup.add(handGroup);
    }

    handsGroup.userData._initialized = true;
  }

  return {
    left: handsGroup.children.find(c => c.name === 'left'),
    right: handsGroup.children.find(c => c.name === 'right'),
  };
}

/**
 * Update hand visualization from network data.
 * @param {THREE.Group} handGroup — the left or right group from ensureHandMeshes
 * @param {Object} data — { mode: 'hand', joints: [[x,y,z],...] } or { mode: 'controller', position, rotation }
 */
export function updateHandFromData(handGroup, data) {
  if (!handGroup || !data) {
    if (handGroup) handGroup.visible = false;
    return;
  }

  handGroup.visible = true;

  if (data.mode === 'hand') {
    // Show joint spheres, hide controller
    const { spheres, lines, controllerMesh } = handGroup.userData;
    if (controllerMesh) controllerMesh.visible = false;

    const joints = data.joints;
    for (let j = 0; j < JOINT_COUNT; j++) {
      const sphere = spheres[j];
      const joint = joints[j];
      if (joint) {
        sphere.position.set(joint[0], joint[1], joint[2]);
        sphere.visible = true;
      } else {
        sphere.visible = false;
      }
    }

    // Update finger lines
    for (const line of lines) {
      const chain = line.userData.chain;
      const positions = line.geometry.attributes.position;
      for (let k = 0; k < chain.length; k++) {
        const joint = joints[chain[k]];
        if (joint) {
          positions.setXYZ(k, joint[0], joint[1], joint[2]);
        }
      }
      positions.needsUpdate = true;
    }
  } else if (data.mode === 'controller') {
    // Show controller, hide joint spheres
    const { spheres, lines, controllerMesh } = handGroup.userData;
    for (const s of spheres) s.visible = false;
    for (const l of lines) l.visible = false;

    if (controllerMesh) {
      controllerMesh.visible = true;
      controllerMesh.position.set(data.position.x, data.position.y, data.position.z);
      if (data.rotation) {
        controllerMesh.quaternion.set(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w);
      }
    }
  }
}
