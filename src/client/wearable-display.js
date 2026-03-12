/**
 * WearableDisplay — Pedestal with collectible wearable preview.
 *
 * Placed on The Agora. Displays a rotating avatar accessory
 * that can be "collected" via proximity + grip/click.
 * Local state only — no backend, no persistence.
 *
 * CPU cost:  ~0.1ms (rotation + proximity check)
 * GPU cost:  ~150 tris, 1-2 draw calls
 * Memory:    ~30 KB
 */

import * as THREE from 'three';

const _worldPos = new THREE.Vector3();

export class WearableDisplay {
  /**
   * @param {Object} opts
   * @param {string} opts.name - Wearable name
   * @param {string} opts.description - Short text
   * @param {number} opts.color - Accent color
   * @param {string} opts.type - 'crown' | 'mask' | 'wings'
   */
  constructor(opts = {}) {
    this.name = opts.name || 'Wearable';
    this.description = opts.description || '';
    this.color = opts.color || 0xff8833;
    this.type = opts.type || 'crown';
    this.collected = false;
    this.isNearby = false;

    this.group = new THREE.Group();
    this.group.userData.type = 'wearable-display';
    this.group.userData.name = this.name;

    this._buildPedestal();
    this._buildWearable();
    this._buildLabel();
    this._buildPrompt();
  }

  _buildPedestal() {
    // Stone pedestal
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.6, 0.15, 8),
      new THREE.MeshStandardMaterial({
        color: 0xc0b8a0,
        roughness: 0.75,
        metalness: 0.1,
      }),
    );
    base.position.y = 0.075;
    base.receiveShadow = true;
    this.group.add(base);

    // Column
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.15, 1.0, 6),
      new THREE.MeshStandardMaterial({
        color: 0xd0c8b0,
        roughness: 0.6,
        metalness: 0.15,
      }),
    );
    col.position.y = 0.65;
    this.group.add(col);

    // Display platform
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.25, 0.08, 8),
      new THREE.MeshStandardMaterial({
        color: 0xe0d8c0,
        roughness: 0.5,
        metalness: 0.2,
        emissive: new THREE.Color(this.color),
        emissiveIntensity: 0.1,
      }),
    );
    platform.position.y = 1.19;
    this.group.add(platform);
    this._platform = platform;
  }

  _buildWearable() {
    const color = new THREE.Color(this.color);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x222233,
      emissive: color,
      emissiveIntensity: 0.6,
      metalness: 0.7,
      roughness: 0.2,
      transparent: true,
      opacity: 0.9,
    });

    let mesh;
    if (this.type === 'crown') {
      // Crown: torus with spikes (small cones)
      const crownGroup = new THREE.Group();
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.03, 8, 16),
        mat,
      );
      band.rotation.x = Math.PI / 2;
      crownGroup.add(band);

      // 5 spikes
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.03, 0.12, 4),
          mat,
        );
        spike.position.set(
          Math.cos(angle) * 0.15,
          0.06,
          Math.sin(angle) * 0.15,
        );
        crownGroup.add(spike);
      }
      crownGroup.position.y = 1.4;
      this.group.add(crownGroup);
      this._wearable = crownGroup;

    } else if (this.type === 'mask') {
      // Mask: flattened sphere with eye holes
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI),
        mat,
      );
      mesh.scale.z = 0.4;
      mesh.position.y = 1.45;
      this.group.add(mesh);
      this._wearable = mesh;

    } else if (this.type === 'wings') {
      // Wings: two mirrored triangles
      const wingGroup = new THREE.Group();
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.lineTo(0.3, 0.15);
      wingShape.lineTo(0.25, -0.1);
      wingShape.lineTo(0, -0.05);

      const wingGeo = new THREE.ShapeGeometry(wingShape);
      const leftWing = new THREE.Mesh(wingGeo, mat);
      const rightWing = new THREE.Mesh(wingGeo, mat.clone());
      rightWing.scale.x = -1;
      wingGroup.add(leftWing, rightWing);
      wingGroup.position.y = 1.4;
      this.group.add(wingGroup);
      this._wearable = wingGroup;
    }
  }

  _buildLabel() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillStyle = `#${new THREE.Color(this.color).getHexString()}`;
    ctx.textAlign = 'center';
    ctx.fillText(this.name, 128, 28);

    if (this.description) {
      ctx.font = '14px "Courier New", monospace';
      ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
      ctx.fillText(this.description, 128, 50);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      }),
    );
    label.scale.set(1.5, 0.375, 1);
    label.position.y = 1.9;
    this.group.add(label);
  }

  _buildPrompt() {
    // "Collect" prompt — only visible on approach
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    ctx.font = '16px "Courier New", monospace';
    ctx.fillStyle = 'rgba(0, 255, 136, 0.9)';
    ctx.textAlign = 'center';
    ctx.fillText('[ grip to collect ]', 128, 30);

    const texture = new THREE.CanvasTexture(canvas);
    this._prompt = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    this._prompt.scale.set(1.2, 0.225, 1);
    this._prompt.position.y = 0.4;
    this.group.add(this._prompt);
  }

  /**
   * Per-frame update.
   * @param {number} elapsed
   * @param {THREE.Vector3} playerPos
   * @param {boolean} gripActive
   */
  update(elapsed, playerPos, gripActive) {
    if (this.collected) return;

    // Rotate wearable
    if (this._wearable) {
      this._wearable.rotation.y = elapsed * 0.8;
    }

    // Float bob
    if (this._wearable) {
      this._wearable.position.y = 1.4 + Math.sin(elapsed * 1.2) * 0.05;
    }

    // Platform glow pulse
    if (this._platform?.material) {
      this._platform.material.emissiveIntensity = 0.08 + Math.sin(elapsed * 2) * 0.05;
    }

    // Proximity
    this.group.getWorldPosition(_worldPos);
    const dist = playerPos.distanceTo(_worldPos);
    this.isNearby = dist < 2.5;

    // Show/hide collect prompt
    if (this._prompt) {
      this._prompt.material.opacity = this.isNearby ? 0.9 : 0;
    }

    // Collect interaction
    if (this.isNearby && gripActive && !this.collected) {
      this._collect();
    }
  }

  _collect() {
    this.collected = true;

    // Hide wearable
    if (this._wearable) this._wearable.visible = false;

    // Change prompt to "Collected!"
    if (this._prompt) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 48;
      const ctx = canvas.getContext('2d');
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillStyle = 'rgba(0, 255, 136, 1)';
      ctx.textAlign = 'center';
      ctx.fillText('Collected!', 128, 30);
      this._prompt.material.map = new THREE.CanvasTexture(canvas);
      this._prompt.material.opacity = 1.0;

      // Fade out after 2 seconds
      setTimeout(() => {
        if (this._prompt) this._prompt.material.opacity = 0;
      }, 2000);
    }

    // Dim the platform
    if (this._platform?.material) {
      this._platform.material.emissiveIntensity = 0;
    }

    console.log(`Wearable collected: ${this.name}`);
  }
}

/**
 * Build wearable displays for the world.
 */
export function createWorldWearables() {
  const displays = [];

  // The Agora: "Citizen Crown" — first wearable
  const crown = new WearableDisplay({
    name: 'Citizen Crown',
    description: 'Mark of the first citizens',
    color: 0xffaa33,
    type: 'crown',
  });
  // Place on The Agora island, near the columns
  crown.group.position.set(-20 + 2, 0, 40 - 3);
  displays.push(crown);

  // The Island: "Luminous Mask"
  const mask = new WearableDisplay({
    name: 'Luminous Mask',
    description: 'See through another\'s eyes',
    color: 0x00ff88,
    type: 'mask',
  });
  // Place on The Island, near shore
  mask.group.position.set(4, 0, 3);
  displays.push(mask);

  return displays;
}
