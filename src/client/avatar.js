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

  return group;
}
