/**
 * BuildingRenderer — Renders buildings from loaded building data as 3D meshes.
 *
 * This is a client-side renderer that takes building data (loaded by WorldLoader
 * from buildings.json) and creates Three.js meshes: a sized box body, a roof,
 * and an optional floating name label (billboard sprite).
 *
 * Building dimensions are determined by category, then scaled by the building's
 * size field. Labels use CanvasTexture sprites that always face the camera.
 *
 * This is engine code — no world-specific references.
 *
 * Usage:
 *   const renderer = new BuildingRenderer(scene, manifest.buildings);
 *   renderer.render(world.buildings);
 *   // later:
 *   const b = renderer.getBuilding('palazzo-ducale');
 *   const nearest = renderer.getNearestBuilding(playerPosition);
 *   renderer.dispose();
 */

import * as THREE from 'three';

// ─── Category → Mesh Parameters ──────────────────────────

const CATEGORY_PARAMS = {
  Palace:      { width: 8,  height: 6,  depth: 6, color: 0xD4A574 },
  Church:      { width: 6,  height: 10, depth: 8, color: 0xE8D5B7 },
  Market:      { width: 6,  height: 3,  depth: 4, color: 0xC4956A },
  Workshop:    { width: 4,  height: 4,  depth: 4, color: 0xB8860B },
  Residential: { width: 3,  height: 5,  depth: 4, color: 0xD2B48C },
  Government:  { width: 10, height: 8,  depth: 8, color: 0xC0C0C0 },
  Monument:    { width: 2,  height: 12, depth: 2, color: 0x88CCFF },
};

const DEFAULT_PARAMS = { width: 4, height: 4, depth: 4, color: 0xBEBEBE };

// Roof color is a slightly darker shade of the building body
const ROOF_DARKEN_FACTOR = 0.7;

// Default Y placement — island surface height above water level
const DEFAULT_GROUND_Y = 1.5;

// Label rendering constants
const LABEL_CANVAS_WIDTH = 512;
const LABEL_CANVAS_HEIGHT = 128;
const LABEL_FONT = 'bold 48px Arial, Helvetica, sans-serif';
const LABEL_SPRITE_SCALE_X = 4;
const LABEL_SPRITE_SCALE_Y = 1;

/**
 * Darken a hex color by a factor (0–1). Factor 0.7 means 70% brightness.
 * @param {number} hex — 0xRRGGBB
 * @param {number} factor — multiplier (0–1)
 * @returns {number}
 */
function darkenColor(hex, factor) {
  const r = Math.floor(((hex >> 16) & 0xFF) * factor);
  const g = Math.floor(((hex >> 8) & 0xFF) * factor);
  const b = Math.floor((hex & 0xFF) * factor);
  return (r << 16) | (g << 8) | b;
}

export class BuildingRenderer {
  /**
   * @param {THREE.Scene} scene — the scene to add buildings to
   * @param {object} config — manifest.buildings config section
   * @param {boolean} [config.name_labels=true] — show floating name labels
   * @param {number}  [config.label_height=3.0] — label offset above building top
   * @param {string}  [config.default_style='venetian-procedural'] — mesh style
   * @param {number}  [config.ground_y=1.5] — Y coordinate of the ground surface
   */
  constructor(scene, config = {}) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'buildings';
    this.scene.add(this.group);

    // Config from manifest.buildings
    this.showLabels = config.name_labels !== false;
    this.labelHeight = config.label_height || 3.0;
    this.defaultStyle = config.default_style || 'venetian-procedural';
    this.groundY = config.ground_y ?? DEFAULT_GROUND_Y;

    // Building meshes by ID
    this.buildings = new Map();
  }

  /**
   * Render all buildings from loaded data.
   * Each building with a valid position gets a 3D mesh group added to the scene.
   *
   * @param {Array<object>} buildingsData — array of building objects from buildings.json
   */
  render(buildingsData) {
    if (!buildingsData || !Array.isArray(buildingsData)) {
      console.warn('BuildingRenderer: no buildings data to render');
      return;
    }

    for (const b of buildingsData) {
      if (!b.position) continue;

      const mesh = this._createBuildingMesh(b);
      this.group.add(mesh);
      this.buildings.set(b.id, { data: b, mesh });
    }

    console.log(`BuildingRenderer: ${this.buildings.size} buildings placed`);
  }

  /**
   * Get a building entry by ID.
   * Returns { data, mesh } or undefined.
   *
   * @param {string} id — building ID (e.g. 'palazzo-ducale')
   * @returns {{ data: object, mesh: THREE.Group } | undefined}
   */
  getBuilding(id) {
    return this.buildings.get(id);
  }

  /**
   * Get the nearest building to a world position.
   *
   * @param {THREE.Vector3} position — query position in world space
   * @returns {{ building: { data: object, mesh: THREE.Group }, distance: number } | null}
   */
  getNearestBuilding(position) {
    let nearest = null;
    let minDist = Infinity;

    for (const [, entry] of this.buildings) {
      const dx = entry.mesh.position.x - position.x;
      const dz = entry.mesh.position.z - position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < minDist) {
        minDist = dist;
        nearest = entry;
      }
    }

    if (!nearest) return null;
    return { building: nearest, distance: minDist };
  }

  /**
   * Remove all building meshes from the scene and free GPU resources.
   */
  dispose() {
    // Traverse and dispose all geometries, materials, and textures
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });

    this.scene.remove(this.group);
    this.buildings.clear();
    this.group = null;
  }

  // ─── Private Methods ──────────────────────────────

  /**
   * Create a THREE.Group for a single building: body, roof, and optional label.
   *
   * @param {object} b — building data object
   * @returns {THREE.Group}
   */
  _createBuildingMesh(b) {
    const buildingGroup = new THREE.Group();
    buildingGroup.name = `building_${b.id}`;

    // Resolve category parameters
    const params = CATEGORY_PARAMS[b.category] || DEFAULT_PARAMS;

    // Scale dimensions by building size (size=3 is baseline, so divide by 3)
    const sizeScale = (b.size || 3) / 3;
    const width  = params.width  * sizeScale;
    const height = params.height * sizeScale;
    const depth  = params.depth  * sizeScale;

    // ── Body ──
    const bodyGeometry = new THREE.BoxGeometry(width, height, depth);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: params.color,
      roughness: b.category === 'Monument' ? 0.3 : 0.85,
      metalness: b.category === 'Monument' ? 0.6 : 0.05,
      ...(b.category === 'Monument' && {
        emissive: 0x88CCFF,
        emissiveIntensity: 0.2,
      }),
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    // Position body so its bottom face sits at y=0 (local to group)
    body.position.y = height / 2;
    buildingGroup.add(body);

    // ── Roof ──
    const roofColor = darkenColor(params.color, ROOF_DARKEN_FACTOR);
    const roof = this._createRoof(b.category, width, depth, roofColor);
    roof.position.y = height;
    buildingGroup.add(roof);

    // ── Label ──
    if (this.showLabels && b.name) {
      const label = this._createLabel(b.name);
      // Float above the roof
      const roofTopY = height + this._getRoofHeight(b.category, width, depth);
      label.position.y = roofTopY + this.labelHeight;
      buildingGroup.add(label);
    }

    // Position the building group in world space
    buildingGroup.position.set(
      b.position.x,
      this.groundY,
      b.position.z
    );

    return buildingGroup;
  }

  /**
   * Create a roof mesh. Churches get a pointed cone; other categories get
   * a flat slab (slightly wider than the body for an eave overhang).
   *
   * @param {string} category — building category
   * @param {number} width — body width
   * @param {number} depth — body depth
   * @param {number} color — roof color (hex)
   * @returns {THREE.Mesh}
   */
  _createRoof(category, width, depth, color) {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      metalness: 0.1,
    });

    if (category === 'Church') {
      // Pointed steeple roof
      const roofHeight = Math.min(width, depth) * 0.6;
      const roofRadius = Math.max(width, depth) * 0.55;
      const geometry = new THREE.ConeGeometry(roofRadius, roofHeight, 4);
      geometry.rotateY(Math.PI / 4); // Align edges with box faces
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = roofHeight / 2;
      return mesh;
    }

    if (category === 'Monument') {
      // Sharp obelisk point — emissive crystal tip
      const roofHeight = Math.min(width, depth) * 1.5;
      const roofRadius = Math.max(width, depth) * 0.45;
      const geometry = new THREE.ConeGeometry(roofRadius, roofHeight, 4);
      geometry.rotateY(Math.PI / 4);
      const emissiveMaterial = new THREE.MeshStandardMaterial({
        color,
        emissive: 0x88CCFF,
        emissiveIntensity: 0.4,
        roughness: 0.3,
        metalness: 0.6,
      });
      const mesh = new THREE.Mesh(geometry, emissiveMaterial);
      mesh.position.y = roofHeight / 2;
      return mesh;
    }

    // Flat slab roof with slight overhang
    const overhang = 0.3;
    const roofThickness = 0.3;
    const geometry = new THREE.BoxGeometry(
      width + overhang,
      roofThickness,
      depth + overhang
    );
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = roofThickness / 2;
    return mesh;
  }

  /**
   * Get the total height of the roof above the body top.
   * Used to position the label sprite correctly.
   *
   * @param {string} category
   * @param {number} width
   * @param {number} depth
   * @returns {number}
   */
  _getRoofHeight(category, width, depth) {
    if (category === 'Church') {
      return Math.min(width, depth) * 0.6;
    }
    if (category === 'Monument') {
      return Math.min(width, depth) * 1.5;
    }
    return 0.3; // flat roof thickness
  }

  /**
   * Create a billboard text label as a THREE.Sprite with CanvasTexture.
   * White text on a transparent background; always faces the camera.
   *
   * @param {string} text — the building name to display
   * @returns {THREE.Sprite}
   */
  _createLabel(text) {
    const canvas = document.createElement('canvas');
    canvas.width = LABEL_CANVAS_WIDTH;
    canvas.height = LABEL_CANVAS_HEIGHT;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Optional: subtle dark backdrop for readability
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    const textMetrics = this._measureText(ctx, text);
    const padding = 16;
    const bgWidth = Math.min(textMetrics + padding * 2, canvas.width);
    const bgX = (canvas.width - bgWidth) / 2;
    ctx.beginPath();
    ctx.roundRect(bgX, 20, bgWidth, canvas.height - 40, 12);
    ctx.fill();

    // Text
    ctx.font = LABEL_FONT;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(LABEL_SPRITE_SCALE_X, LABEL_SPRITE_SCALE_Y, 1);

    return sprite;
  }

  /**
   * Measure text width on a canvas context (helper for backdrop sizing).
   * Sets the font before measuring.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} text
   * @returns {number} — width in pixels
   */
  _measureText(ctx, text) {
    ctx.font = LABEL_FONT;
    return ctx.measureText(text).width;
  }
}
