/**
 * Sculpture — Geometric art anchors for Cities of Light.
 *
 * Each sculpture is a deterministic, locally-rendered art piece
 * placed at a fixed position within a zone. No backend dependency.
 *
 * The Archive gets the first sculpture: a memorial figure
 * made of nested geometric forms — evoking a citizen preserved in crystal.
 *
 * CPU cost:  0 (static geometry, only rotation per frame)
 * GPU cost:  ~200 tris, 1 draw call (merged group)
 * Memory:    ~50 KB
 */

import * as THREE from 'three';

const _worldPos = new THREE.Vector3();

export class Sculpture {
  /**
   * @param {Object} opts
   * @param {string} opts.name - Display name
   * @param {string} opts.inscription - Plaque text
   * @param {number} opts.color - Primary emissive color
   * @param {string} opts.shape - 'citizen' | 'obelisk' | 'totem'
   */
  constructor(opts = {}) {
    this.name = opts.name || 'Untitled';
    this.inscription = opts.inscription || '';
    this.color = opts.color || 0x44ccff;
    this.shape = opts.shape || 'citizen';
    this.isNearby = false;

    this.group = new THREE.Group();
    this.group.userData.type = 'sculpture';
    this.group.userData.name = this.name;

    this._buildSculpture();
    this._buildPlaque();
  }

  _buildSculpture() {
    const color = new THREE.Color(this.color);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x111122,
      emissive: color,
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.15,
      transparent: true,
      opacity: 0.85,
    });

    if (this.shape === 'citizen') {
      // Core: a human-scale icosahedron — the preserved citizen
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.35, 1),
        mat,
      );
      core.position.y = 2.2;
      core.castShadow = true;
      this.group.add(core);
      this._core = core;

      // Shell: outer translucent dodecahedron — the archive casing
      const shellMat = mat.clone();
      shellMat.opacity = 0.3;
      shellMat.emissiveIntensity = 0.3;
      const shell = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.6, 0),
        shellMat,
      );
      shell.position.y = 2.2;
      this.group.add(shell);
      this._shell = shell;

      // Orbit ring: torus around the core
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.02, 8, 32),
        new THREE.MeshBasicMaterial({
          color: this.color,
          transparent: true,
          opacity: 0.5,
        }),
      );
      ring.position.y = 2.2;
      ring.rotation.x = Math.PI * 0.3;
      this.group.add(ring);
      this._ring = ring;

      // Base pedestal: short cylinder
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.5, 0.3, 8),
        new THREE.MeshStandardMaterial({
          color: 0x2a2a3a,
          roughness: 0.6,
          metalness: 0.3,
        }),
      );
      pedestal.position.y = 0.15;
      pedestal.receiveShadow = true;
      this.group.add(pedestal);

      // Column: thin cylinder connecting pedestal to core
      const column = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 1.6, 6),
        new THREE.MeshStandardMaterial({
          color: 0x3a3a4a,
          roughness: 0.5,
          metalness: 0.4,
          emissive: color,
          emissiveIntensity: 0.15,
        }),
      );
      column.position.y = 1.1;
      this.group.add(column);

    } else if (this.shape === 'obelisk') {
      // Tall pointed crystal
      const obelisk = new THREE.Mesh(
        new THREE.ConeGeometry(0.3, 2.5, 6),
        mat,
      );
      obelisk.position.y = 1.25;
      obelisk.castShadow = true;
      this.group.add(obelisk);
      this._core = obelisk;
    }
  }

  _buildPlaque() {
    if (!this.inscription) return;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Dark plaque background
    ctx.fillStyle = 'rgba(20, 20, 30, 0.9)';
    ctx.fillRect(0, 0, 512, 128);

    // Border
    ctx.strokeStyle = `#${new THREE.Color(this.color).getHexString()}`;
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, 504, 120);

    // Title
    ctx.font = 'bold 24px "Courier New", monospace';
    ctx.fillStyle = `#${new THREE.Color(this.color).getHexString()}`;
    ctx.textAlign = 'center';
    ctx.fillText(this.name, 256, 45);

    // Inscription
    ctx.font = '16px "Courier New", monospace';
    ctx.fillStyle = 'rgba(200, 200, 220, 0.8)';
    // Word wrap
    const words = this.inscription.split(' ');
    let line = '';
    let y = 75;
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > 480 && line) {
        ctx.fillText(line.trim(), 256, y);
        line = word + ' ';
        y += 22;
      } else {
        line = test;
      }
    }
    if (line.trim()) ctx.fillText(line.trim(), 256, y);

    const texture = new THREE.CanvasTexture(canvas);
    const plaque = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      }),
    );
    plaque.scale.set(2.5, 0.625, 1);
    plaque.position.y = 0.8;
    plaque.position.z = 0.6;
    this.group.add(plaque);
    this._plaque = plaque;
  }

  /**
   * Per-frame update.
   * @param {number} elapsed
   * @param {THREE.Vector3} playerPos
   */
  update(elapsed, playerPos) {
    // Slow rotation
    if (this._core) this._core.rotation.y = elapsed * 0.3;
    if (this._shell) this._shell.rotation.y = -elapsed * 0.15;
    if (this._ring) this._ring.rotation.z = elapsed * 0.4;

    // Pulse emissive
    if (this._core?.material) {
      this._core.material.emissiveIntensity = 0.4 + Math.sin(elapsed * 1.5) * 0.15;
    }

    // Proximity detection (4m)
    this.group.getWorldPosition(_worldPos);
    const dist = playerPos.distanceTo(_worldPos);
    const wasNearby = this.isNearby;
    this.isNearby = dist < 4;

    // Plaque visibility
    if (this._plaque) {
      this._plaque.material.opacity = this.isNearby ? 1.0 : 0.0;
    }
  }
}

/**
 * Build the sculpture anchors for the world.
 * Returns an array of Sculpture instances with world positions set.
 */
export function createWorldSculptures() {
  const sculptures = [];

  // The Archive: "Citizen Zero" — first preserved consciousness
  const citizenZero = new Sculpture({
    name: 'Citizen Zero',
    inscription: 'The first voice archived. Where memory becomes architecture.',
    color: 0x44ccff,
    shape: 'citizen',
  });
  // Place on The Archive island: offset from center toward the crystals
  citizenZero.group.position.set(-30 + 3, 0, -25 - 2);
  sculptures.push(citizenZero);

  return sculptures;
}
