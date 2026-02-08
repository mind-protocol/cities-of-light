/**
 * The Island — first piece of land in Cities of Light.
 * Water, sand, sky. A place to stand and meet.
 */

import * as THREE from 'three';

export function createIsland() {
  const group = new THREE.Group();

  // ─── Water plane (infinite ocean) ──────────────────────

  const waterGeom = new THREE.PlaneGeometry(500, 500, 64, 64);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0a2a4a,
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    opacity: 0.85,
  });
  const water = new THREE.Mesh(waterGeom, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.3;
  group.add(water);

  // ─── Island (raised sand disc) ─────────────────────────

  const islandGeom = new THREE.CylinderGeometry(12, 15, 1.5, 32, 4);
  // Displace vertices for organic feel
  const posAttr = islandGeom.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const dist = Math.sqrt(x * x + z * z);
    if (dist > 5) {
      // Roughen edges
      const noise = (Math.random() - 0.5) * 0.8;
      posAttr.setY(i, posAttr.getY(i) + noise);
    }
  }
  islandGeom.computeVertexNormals();

  const islandMat = new THREE.MeshStandardMaterial({
    color: 0xc2a060,
    roughness: 0.95,
    metalness: 0.0,
  });
  const island = new THREE.Mesh(islandGeom, islandMat);
  island.position.y = -0.5;
  island.receiveShadow = true;
  group.add(island);

  // ─── Sky dome ──────────────────────────────────────────

  const skyGeom = new THREE.SphereGeometry(200, 32, 32);
  const skyMat = new THREE.MeshBasicMaterial({
    color: 0x0d1b2a,
    side: THREE.BackSide,
  });
  const sky = new THREE.Mesh(skyGeom, skyMat);
  group.add(sky);

  // ─── Stars ─────────────────────────────────────────────

  const starCount = 800;
  const starGeom = new THREE.BufferGeometry();
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.5; // Upper hemisphere only
    const r = 180;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.cos(phi) + 20;
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.5,
    sizeAttenuation: true,
  });
  const stars = new THREE.Points(starGeom, starMat);
  group.add(stars);

  return group;
}
