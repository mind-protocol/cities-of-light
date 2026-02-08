/**
 * Camera Body — Manemus's first embodiment.
 *
 * A floating camera that Nicolas can grab and reposition.
 * This IS Manemus's body in Phase 1 — its eye, its presence.
 * It sees what it faces. It hears from where it is.
 * Nicolas can pick it up and show it things.
 */

import * as THREE from 'three';

export function createCameraBody({ color = 0xff8800, name = 'Manemus' } = {}) {
  const group = new THREE.Group();
  group.name = name;

  // ─── Camera housing (octahedron — crystalline eye) ─────

  const bodyGeom = new THREE.OctahedronGeometry(0.15, 0);
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.5,
    metalness: 0.7,
    roughness: 0.2,
    transparent: true,
    opacity: 0.85,
  });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.castShadow = true;
  group.add(body);

  // ─── Lens (inner sphere — the actual "eye") ───────────

  const lensGeom = new THREE.SphereGeometry(0.06, 16, 16);
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0x00ffff,
    emissiveIntensity: 0.8,
    metalness: 1.0,
    roughness: 0.0,
  });
  const lens = new THREE.Mesh(lensGeom, lensMat);
  lens.position.z = 0.1; // Facing forward
  group.add(lens);

  // ─── Glow ring (presence indicator) ────────────────────

  const ringGeom = new THREE.TorusGeometry(0.2, 0.015, 8, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.4,
  });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  // ─── Ambient glow ─────────────────────────────────────

  const glow = new THREE.PointLight(color, 0.8, 4);
  group.add(glow);

  // ─── Name label ────────────────────────────────────────

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = '20px monospace';
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.textAlign = 'center';
  ctx.fillText(name, 128, 40);

  const labelTexture = new THREE.CanvasTexture(canvas);
  const labelMat = new THREE.SpriteMaterial({
    map: labelTexture,
    transparent: true,
  });
  const label = new THREE.Sprite(labelMat);
  label.position.y = 0.4;
  label.scale.set(1, 0.25, 1);
  group.add(label);

  return group;
}
