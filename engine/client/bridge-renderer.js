/**
 * BridgeRenderer — Renders bridges from loaded bridge data.
 *
 * Constructs Three.js meshes for bridges that connect two world
 * coordinates. Each bridge consists of a deck, optional arch
 * deformation, railings, and a name label sprite.
 *
 * Bridge data format (from bridges.json via WorldLoader):
 *   {
 *     "id": "rialto",
 *     "name": "Ponte di Rialto",
 *     "from": { "x": 1, "z": 2 },
 *     "to":   { "x": 3, "z": 4 },
 *     "style": "venetian-arch",
 *     "width": 5
 *   }
 *
 * Supported styles:
 *   - venetian-arch: arched deck with stone railings (default)
 *   - flat: simple flat deck, no arch
 *
 * Usage:
 *   const renderer = new BridgeRenderer(scene, {
 *     style: 'venetian-arch',
 *     width: 3,
 *     rail_height: 1.0,
 *     surface_y: 1.5,
 *   });
 *   renderer.render(bridgesArray);
 *   // later:
 *   renderer.dispose();
 */

import * as THREE from 'three';

// ─── Materials ──────────────────────────────────────────

const STONE_COLOR = 0xC0B090;
const RAILING_COLOR = 0xA89878;
const LABEL_FONT = 'bold 48px sans-serif';
const LABEL_CANVAS_WIDTH = 512;
const LABEL_CANVAS_HEIGHT = 128;

// ─── Style Builders ─────────────────────────────────────

/**
 * Style registry. Each entry is a function that receives bridge
 * parameters and returns a THREE.Group with the bridge meshes.
 *
 * @typedef {object} BridgeParams
 * @property {number} span       — distance between from and to
 * @property {number} width      — deck width
 * @property {number} surfaceY   — Y level of the bridge deck surface
 * @property {number} railHeight — railing height above deck
 * @property {string} name       — display name for label
 */
const STYLE_BUILDERS = {
  'venetian-arch': buildVenetianArch,
  'grand-arch': buildVenetianArch,   // alias — same visual treatment
  'flat': buildFlat,
};

// ─── Venetian Arch Builder ──────────────────────────────

/**
 * Build a venetian-arch style bridge: arched deck + two railings + label.
 *
 * The deck is a box whose vertices are displaced vertically to form
 * a gentle arch (center higher, ends lower). Railings follow the
 * same arch profile.
 *
 * @param {BridgeParams} params
 * @returns {THREE.Group}
 */
function buildVenetianArch({ span, width, surfaceY, railHeight, name }) {
  const group = new THREE.Group();

  // Arch geometry constants
  const deckThickness = 0.3;
  const archHeight = span * 0.15;
  const deckSegments = 24;  // enough subdivisions to curve smoothly

  // ── Deck ───────────────────────────────────────────
  const deckGeo = new THREE.BoxGeometry(
    span, deckThickness, width,
    deckSegments, 1, 1
  );
  applyArchDeformation(deckGeo, span, archHeight);

  const stoneMat = new THREE.MeshStandardMaterial({
    color: STONE_COLOR,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true,
  });

  const deck = new THREE.Mesh(deckGeo, stoneMat);
  deck.position.y = surfaceY - deckThickness / 2;
  group.add(deck);

  // ── Railings ───────────────────────────────────────
  const railWidth = 0.15;
  const railGeo = new THREE.BoxGeometry(
    span, railHeight, railWidth,
    deckSegments, 1, 1
  );
  applyArchDeformation(railGeo, span, archHeight);

  const railMat = new THREE.MeshStandardMaterial({
    color: RAILING_COLOR,
    roughness: 0.85,
    metalness: 0.0,
    flatShading: true,
  });

  // Left railing
  const railLeft = new THREE.Mesh(railGeo, railMat);
  railLeft.position.set(0, surfaceY + railHeight / 2, -(width / 2 - railWidth / 2));
  group.add(railLeft);

  // Right railing
  const railRight = new THREE.Mesh(railGeo.clone(), railMat);
  railRight.position.set(0, surfaceY + railHeight / 2, (width / 2 - railWidth / 2));
  group.add(railRight);

  // ── Name label ─────────────────────────────────────
  if (name) {
    const label = createLabelSprite(name);
    label.position.set(0, surfaceY + railHeight + 1.5, 0);
    group.add(label);
  }

  return group;
}

// ─── Flat Builder ───────────────────────────────────────

/**
 * Build a flat style bridge: simple box deck + label. No arch,
 * no railings.
 *
 * @param {BridgeParams} params
 * @returns {THREE.Group}
 */
function buildFlat({ span, width, surfaceY, name }) {
  const group = new THREE.Group();

  const deckThickness = 0.3;

  const deckGeo = new THREE.BoxGeometry(span, deckThickness, width);
  const stoneMat = new THREE.MeshStandardMaterial({
    color: STONE_COLOR,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true,
  });

  const deck = new THREE.Mesh(deckGeo, stoneMat);
  deck.position.y = surfaceY - deckThickness / 2;
  group.add(deck);

  if (name) {
    const label = createLabelSprite(name);
    label.position.set(0, surfaceY + 1.5, 0);
    group.add(label);
  }

  return group;
}

// ─── Geometry Helpers ───────────────────────────────────

/**
 * Displace vertices of a box geometry along the Y axis to form
 * a smooth arch. Vertices at the horizontal center are lifted by
 * archHeight; vertices at the edges stay at their original Y.
 *
 * The arch profile is a cosine curve: y += archHeight * cos(pi * x / span).
 * This yields a natural curve that peaks at center and touches zero
 * at both ends.
 *
 * @param {THREE.BoxGeometry} geometry — must be oriented along the X axis
 * @param {number} span       — total length along X
 * @param {number} archHeight — maximum vertical displacement at center
 */
function applyArchDeformation(geometry, span, archHeight) {
  const positions = geometry.attributes.position;
  const halfSpan = span / 2;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    // Normalized position along the span: 0 at edges, 1 at center
    const t = 1 - Math.abs(x) / halfSpan;
    // Cosine arch profile for smooth curvature
    const lift = archHeight * Math.cos((1 - t) * Math.PI / 2);
    positions.setY(i, positions.getY(i) + lift);
  }

  geometry.computeVertexNormals();
}

/**
 * Create a text label sprite using a canvas texture.
 *
 * The sprite always faces the camera and scales with distance.
 *
 * @param {string} text — label text
 * @returns {THREE.Sprite}
 */
function createLabelSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = LABEL_CANVAS_WIDTH;
  canvas.height = LABEL_CANVAS_HEIGHT;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Text styling
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Drop shadow for readability
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  // Scale to keep label readable at world scale
  sprite.scale.set(6, 1.5, 1);

  return sprite;
}

// ─── BridgeRenderer Class ───────────────────────────────

export class BridgeRenderer {
  /**
   * @param {THREE.Scene} scene — the scene to add bridges to
   * @param {object} [config] — configuration from manifest.bridges
   * @param {string}  [config.style='venetian-arch'] — default bridge style
   * @param {number}  [config.width=3]               — default bridge width
   * @param {number}  [config.rail_height=1.0]        — railing height above deck
   * @param {number}  [config.surface_y=1.5]          — Y level of the deck surface
   */
  constructor(scene, config = {}) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'bridges';
    this.scene.add(this.group);

    // Defaults from manifest.bridges config
    this.defaultStyle = config.style || 'venetian-arch';
    this.defaultWidth = config.width || 3;
    this.railHeight = config.rail_height || 1.0;
    this.surfaceY = config.surface_y ?? 1.5;

    /** @type {Map<string, THREE.Group>} */
    this.bridges = new Map();
  }

  /**
   * Render an array of bridge definitions.
   *
   * Each entry is added to the scene as a positioned and rotated
   * THREE.Group. Previously rendered bridges are preserved; call
   * dispose() first if you need a full reset.
   *
   * @param {object[]} bridgesData — array of bridge definitions
   */
  render(bridgesData) {
    if (!Array.isArray(bridgesData)) {
      throw new Error('BridgeRenderer.render expects an array of bridge definitions');
    }

    for (const bridgeDef of bridgesData) {
      if (this.bridges.has(bridgeDef.id)) {
        // Already rendered — skip duplicate
        continue;
      }

      const mesh = this._createBridgeMesh(bridgeDef);
      this.group.add(mesh);
      this.bridges.set(bridgeDef.id, mesh);
    }
  }

  /**
   * Get a rendered bridge group by ID.
   *
   * @param {string} id
   * @returns {THREE.Group|undefined}
   */
  getBridge(id) {
    return this.bridges.get(id);
  }

  /**
   * Remove all bridges from the scene and free GPU resources.
   */
  dispose() {
    for (const [id, bridgeGroup] of this.bridges) {
      this.group.remove(bridgeGroup);
      this._disposeGroup(bridgeGroup);
    }
    this.bridges.clear();

    this.scene.remove(this.group);
    this.group = null;
  }

  // ─── Private Methods ──────────────────────────────

  /**
   * Build a positioned and rotated bridge group from a definition.
   *
   * The bridge mesh is constructed along the local X axis, then
   * rotated and translated so that it spans from `from` to `to`.
   *
   * @param {object} def — single bridge definition
   * @returns {THREE.Group}
   */
  _createBridgeMesh(def) {
    const from = def.from;
    const to = def.to;

    // Calculate span (2D distance, bridges are horizontal structures)
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const span = Math.sqrt(dx * dx + dz * dz);

    // Angle to rotate the bridge from X-axis alignment to from→to direction
    const angle = Math.atan2(dz, dx);

    // Resolve style and width, falling back to instance defaults
    const style = def.style || this.defaultStyle;
    const width = def.width || this.defaultWidth;

    // Select the builder for this style
    const builder = STYLE_BUILDERS[style];
    if (!builder) {
      console.warn(`Unknown bridge style "${style}" for bridge "${def.id}", using venetian-arch`);
    }
    const buildFn = builder || STYLE_BUILDERS['venetian-arch'];

    // Build the bridge mesh group (centered at origin, along X axis)
    const bridgeGroup = buildFn({
      span,
      width,
      surfaceY: this.surfaceY,
      railHeight: this.railHeight,
      name: def.name || null,
    });

    bridgeGroup.name = `bridge_${def.id}`;

    // Position at the midpoint between from and to
    const cx = (from.x + to.x) / 2;
    const cz = (from.z + to.z) / 2;
    bridgeGroup.position.set(cx, 0, cz);

    // Rotate to align with the from→to direction
    bridgeGroup.rotation.y = -angle;

    return bridgeGroup;
  }

  /**
   * Recursively dispose all geometries, materials, and textures
   * within a group.
   *
   * @param {THREE.Object3D} obj
   */
  _disposeGroup(obj) {
    obj.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        for (const mat of materials) {
          if (mat.map) mat.map.dispose();
          mat.dispose();
        }
      }
    });
  }
}
