/**
 * WorldLoader — Loads a WorldManifest and initializes the 3D world.
 *
 * This is the engine's entry point for world initialization.
 * It reads the manifest, configures terrain, zones, atmosphere,
 * and entity sources. It does NOT contain world-specific logic.
 *
 * Usage:
 *   const loader = new WorldLoader(scene, renderer);
 *   const world = await loader.load('/worlds/venezia/world-manifest.json');
 *   // world.zones, world.entities, world.physics, world.manifest
 */

import * as THREE from 'three';
import { createEquirectangularProjector, centroidFromPolygon } from '../shared/geographic_projection_utilities.js';

export class WorldLoader {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.currentWorld = null;
  }

  /**
   * Load a world from a manifest path or URL.
   * @param {string} manifestPath — path to world-manifest.json
   * @returns {Promise<World>} — the loaded world instance
   */
  async load(manifestPath) {
    // 1. Fetch and parse manifest
    const manifest = await this._fetchManifest(manifestPath);
    this._validate(manifest);

    // Store manifest base path for resolving relative paths
    const basePath = manifestPath.substring(0, manifestPath.lastIndexOf('/') + 1);

    // 2. Unload previous world if any
    if (this.currentWorld) {
      await this.unload();
    }

    // 3. Create world container
    const world = {
      manifest,
      basePath,
      group: new THREE.Group(),
      zones: new Map(),
      entityDescriptors: [],
      portalZones: [],
      atmosphere: null,
      _cleanupFns: [],
      projection: null,
    };

    // Projection used for geographic terrain/building/bridge placement
    if (manifest.terrain?.generator === 'geographic') {
      const ref = manifest.terrain.reference || manifest.reference || null;
      if (!ref || typeof ref.lat !== 'number' || typeof ref.lng !== 'number') {
        throw new Error('Geographic terrain requires terrain.reference { lat, lng } in manifest');
      }
      world.projection = createEquirectangularProjector(ref.lat, ref.lng, manifest.terrain.scale || 1);
    }

    // 4. Configure global atmosphere
    world.atmosphere = this._setupAtmosphere(manifest, world.group);

    // 5. Generate terrain
    await this._generateTerrain(manifest, world);

    // 6. Setup zones
    this._setupZones(manifest, world);

    // 7. Load entity descriptors (don't spawn yet — EntityManager handles that)
    world.entityDescriptors = await this._loadEntityDescriptors(manifest, basePath);

    // 8. Load buildings data (renderers are separate client modules)
    if (manifest.buildings) {
      world.buildings = await this._loadBuildingsData(manifest, basePath);
    }

    // 9. Load bridges data (renderers are separate client modules)
    if (manifest.bridges) {
      world.bridgesData = await this._loadBridgesData(manifest, basePath);
    }

    // 10. Setup portals
    if (manifest.portals) {
      world.portalZones = this._setupPortals(manifest, world);
    }

    // 11. Add to scene
    this.scene.add(world.group);
    this.currentWorld = world;

    console.log(`World loaded: ${manifest.display_name || manifest.name} (${world.zones.size} zones, ${world.entityDescriptors.length} entities)`);

    return world;
  }

  /**
   * Unload the current world.
   */
  async unload() {
    if (!this.currentWorld) return;

    // Run cleanup functions
    for (const fn of this.currentWorld._cleanupFns) {
      fn();
    }

    // Remove from scene
    this.scene.remove(this.currentWorld.group);

    // Dispose geometries and materials
    this.currentWorld.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    this.currentWorld = null;
  }

  // ─── Private Methods ──────────────────────────────

  async _fetchManifest(path) {
    // Support both file paths (for node/local) and URLs
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load manifest: ${path} (${response.status})`);
    }
    return response.json();
  }

  _validate(manifest) {
    // Essential fields check (full JSON Schema validation can be added later)
    if (!manifest.name) throw new Error('Manifest missing required field: name');
    if (!manifest.version) throw new Error('Manifest missing required field: version');
    if (!manifest.terrain) throw new Error('Manifest missing required field: terrain');
    if (!manifest.zones || !manifest.zones.length) throw new Error('Manifest missing required field: zones (must have at least 1)');
    if (!manifest.terrain.generator) throw new Error('Manifest terrain missing required field: generator');
  }

  _setupAtmosphere(manifest, group) {
    const atmosphere = {
      fog: null,
      sky: null,
      sunPosition: null,
    };

    // Sky
    const skyModel = manifest.terrain.sky_model || 'preetham';
    if (skyModel === 'preetham') {
      // Dynamic import to keep engine modular
      // Sky setup delegated to terrain generator (it needs sun position)
      const sun = manifest.terrain.sun || { elevation: 12, azimuth: 220 };
      const phi = THREE.MathUtils.degToRad(90 - sun.elevation);
      const theta = THREE.MathUtils.degToRad(sun.azimuth);
      atmosphere.sunPosition = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    }

    // Global fog (from first zone as default, zones override locally)
    if (manifest.zones[0]?.atmosphere) {
      const a = manifest.zones[0].atmosphere;
      const fogColor = typeof a.fog_color === 'string'
        ? parseInt(a.fog_color.replace('0x', ''), 16)
        : a.fog_color;
      atmosphere.fog = new THREE.FogExp2(fogColor, a.fog_density || 0.008);
      this.scene.fog = atmosphere.fog;
    }

    return atmosphere;
  }

  async _generateTerrain(manifest, world) {
    const generator = manifest.terrain.generator;

    switch (generator) {
      case 'procedural-island':
        // Each zone becomes an island
        for (const zoneDef of manifest.zones) {
          const island = this._generateIsland(zoneDef, manifest.terrain, world.atmosphere);
          island.position.set(zoneDef.position.x, zoneDef.position.y || 0, zoneDef.position.z);
          world.group.add(island);
        }
        break;

      case 'heightmap':
        // Future: load heightmap from manifest.terrain.heightmap_path
        console.warn('Heightmap terrain generator not yet implemented');
        break;

      case 'geographic': {
        const landsData = await this._loadLandsData(manifest, world.basePath);

        // Water plane for canals and sea level reference
        const water = new THREE.Mesh(
          new THREE.PlaneGeometry(12000, 12000),
          new THREE.MeshStandardMaterial({ color: 0x2c6a92, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.9 })
        );
        water.rotation.x = -Math.PI / 2;
        water.position.y = manifest.terrain.water_level ?? 0;
        water.name = 'water_plane';
        world.group.add(water);

        for (const land of landsData) {
          const island = this._generateGeographicIsland(land, manifest.terrain);
          world.group.add(island);
          // Create zone from land
          world.zones.set(land.id, {
            id: land.id,
            name: land.name,
            loreName: land.english_name || land.name,
            position: new THREE.Vector3(land.center.x, 0, land.center.z),
            radius: this._calculateLandRadius(land.polygon),
            mode: 'default',
            atmosphere: {},
            waypoints: [],
            type: 'default',
          });
        }
        break;
      }

      case 'flat': {
        // Simple flat ground plane
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(1000, 1000),
          new THREE.MeshStandardMaterial({ color: 0x88aa66 })
        );
        ground.rotation.x = -Math.PI / 2;
        world.group.add(ground);
        break;
      }

      default:
        throw new Error(`Unknown terrain generator: ${generator}`);
    }
  }

  _generateIsland(zoneDef, terrainConfig, atmosphere) {
    // Procedural island generation — parameterized by zone config
    // This is the engine's built-in island generator, adapted from scene.js
    const group = new THREE.Group();
    group.name = `island_${zoneDef.id}`;

    const seed = zoneDef.seed || 0;
    const palette = zoneDef.terrain?.palette || 'warm-sand';
    const vegetation = zoneDef.terrain?.vegetation || 'none';
    const rockDensity = zoneDef.terrain?.rock_density ?? 1.0;

    // Color palettes (engine provides defaults, world can extend)
    const PALETTES = {
      'warm-sand': { ground: 0xc2b280, accent: 0xa08060 },
      'tropical': { ground: 0xd4b896, accent: 0xb09070 },
      'deep-blue': { ground: 0x2a3a5a, accent: 0x1a2a4a },
      'green-moss': { ground: 0x4a6a3a, accent: 0x3a5a2a },
      'marble': { ground: 0xd0c8b0, accent: 0xc0a880 },
    };

    const colors = PALETTES[palette] || PALETTES['warm-sand'];

    // Island terrain mesh (simplified procedural generation)
    const islandRadius = 15;
    const segments = 64;
    const geometry = new THREE.CircleGeometry(islandRadius, segments);
    geometry.rotateX(-Math.PI / 2);

    // Apply height noise based on seed
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const dist = Math.sqrt(x * x + z * z) / islandRadius;

      // Noise-based height (using seed for determinism)
      const nx = x * 0.15 + seed * 0.1;
      const nz = z * 0.15 + seed * 0.1;
      const noise = Math.sin(nx * 2.3 + nz * 1.7) * 0.5 +
                    Math.sin(nx * 5.1 + nz * 3.3) * 0.25;

      // Island falloff — edges are at water level
      const falloff = Math.max(0, 1 - dist * dist);
      const height = noise * falloff * 2;

      positions.setY(i, Math.max(height, -0.1));
    }

    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: colors.ground,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    // Zone-specific particle emitter placeholder
    // (particles are managed by ZoneAmbient system, not per-island)

    return group;
  }

  async _loadLandsData(manifest, basePath) {
    const landsPath = manifest.lands?.path || 'data/lands.json';
    const fullPath = basePath + landsPath;
    const response = await fetch(fullPath);
    if (!response.ok) {
      throw new Error(`Failed to load lands data: ${fullPath} (${response.status})`);
    }
    return response.json();
  }

  _generateGeographicIsland(land, terrainConfig) {
    const group = new THREE.Group();
    group.name = `island_${land.id}`;

    const islandHeight = terrainConfig.island_height ?? 1.5;
    const waterLevel = terrainConfig.water_level ?? 0;

    // Convert polygon points to THREE.Shape
    const shape = new THREE.Shape();
    const polygon = land.polygon;

    if (!polygon || polygon.length < 3) {
      console.warn(`Land "${land.name}" has insufficient polygon points, skipping`);
      return group;
    }

    shape.moveTo(polygon[0].x - land.center.x, polygon[0].z - land.center.z);
    for (let i = 1; i < polygon.length; i++) {
      shape.lineTo(polygon[i].x - land.center.x, polygon[i].z - land.center.z);
    }
    shape.closePath();

    // Extrude with beveled edges for natural island look
    const extrudeSettings = {
      depth: islandHeight,
      bevelEnabled: true,
      bevelThickness: 0.3,
      bevelSize: 0.5,
      bevelSegments: 3,
      bevelOffset: 0,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Rotate so extrusion goes upward (Y axis) instead of along Z
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      color: 0xc2b280, // sand-colored
      roughness: 0.9,
      metalness: 0.0,
      flatShading: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    // Position the island group at its center, at water level
    group.position.set(land.center.x, waterLevel, land.center.z);

    return group;
  }

  _calculateLandRadius(polygon) {
    if (!polygon || polygon.length === 0) return 0;

    // Calculate centroid
    let cx = 0;
    let cz = 0;
    for (const point of polygon) {
      cx += point.x;
      cz += point.z;
    }
    cx /= polygon.length;
    cz /= polygon.length;

    // Find max distance from centroid to any polygon point
    let maxDist = 0;
    for (const point of polygon) {
      const dx = point.x - cx;
      const dz = point.z - cz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > maxDist) maxDist = dist;
    }

    return maxDist;
  }

  async _loadBuildingsData(manifest, basePath) {
    const buildingsPath = manifest.buildings?.path || 'data/buildings.json';
    const fullPath = basePath + buildingsPath;
    const response = await fetch(fullPath);
    if (!response.ok) {
      throw new Error(`Failed to load buildings data: ${fullPath} (${response.status})`);
    }
    const buildings = await response.json();

    // Normalize to world-space positions for renderer consumption
    return buildings.map((b) => this._normalizeGeographicPlacement(b, manifest));
  }

  async _loadBridgesData(manifest, basePath) {
    const bridgesPath = manifest.bridges?.path || 'data/bridges.json';
    const fullPath = basePath + bridgesPath;
    const response = await fetch(fullPath);
    if (!response.ok) {
      throw new Error(`Failed to load bridges data: ${fullPath} (${response.status})`);
    }
    const bridges = await response.json();
    return bridges.map((b) => this._normalizeBridgePlacement(b, manifest));
  }

  _normalizeGeographicPlacement(entry, manifest) {
    if (entry.position && typeof entry.position.x === 'number' && typeof entry.position.z === 'number') {
      return entry;
    }

    if (manifest.terrain?.generator !== 'geographic') {
      throw new Error(`Entry ${entry.id || entry.name || 'unknown'} missing world-space position`);
    }

    const ref = manifest.terrain.reference || manifest.reference || null;
    if (!ref) throw new Error('Geographic placement requires terrain.reference');
    const project = createEquirectangularProjector(ref.lat, ref.lng, manifest.terrain.scale || 1);

    if (typeof entry.lat === 'number' && typeof entry.lng === 'number') {
      return { ...entry, position: project({ lat: entry.lat, lng: entry.lng }) };
    }

    if (Array.isArray(entry.polygon) && entry.polygon.length > 0) {
      const c = centroidFromPolygon(entry.polygon);
      return { ...entry, position: { x: c.x, z: c.z } };
    }

    throw new Error(`Geographic entry ${entry.id || entry.name || 'unknown'} missing lat/lng or polygon`);
  }

  _setupZones(manifest, world) {
    for (const zoneDef of manifest.zones) {
      const zone = {
        id: zoneDef.id,
        name: zoneDef.name,
        loreName: zoneDef.lore_name || zoneDef.name,
        position: new THREE.Vector3(
          zoneDef.position.x,
          zoneDef.position.y || 0,
          zoneDef.position.z
        ),
        seed: zoneDef.seed || 0,
        mode: zoneDef.mode || 'default',
        radius: zoneDef.radius || 30,
        atmosphere: zoneDef.atmosphere || {},
        waypoints: zoneDef.waypoints || [],
        type: zoneDef.type || 'default',
        targetManifest: zoneDef.target_manifest || null,
        targetSpawn: zoneDef.target_spawn || null,
      };
      world.zones.set(zone.id, zone);
    }
  }

  async _loadEntityDescriptors(manifest, basePath) {
    if (!manifest.entities) return [];

    const source = manifest.entities.source || 'local';

    switch (source) {
      case 'local': {
        // Load entity.json files from the citizens directory
        const entityPath = manifest.entities.path || 'citizens/';
        const fullPath = basePath + entityPath;

        // Fetch entity index (we need to discover entities)
        // For local source, we expect each subdirectory to have entity.json
        try {
          const response = await fetch(fullPath + 'index.json');
          if (response.ok) {
            const index = await response.json();
            return index;
          }
        } catch (e) {
          // No index.json — try to load known entities from manifest
        }

        // Fallback: entities might be listed directly (if served by the engine's server)
        return [];
      }

      case 'api': {
        const response = await fetch(manifest.entities.endpoint);
        if (!response.ok) return [];
        return response.json();
      }

      default:
        console.warn(`Entity source type '${source}' not yet implemented`);
        return [];
    }
  }

  _setupPortals(manifest, world) {
    const portals = [];

    for (const portalDef of manifest.portals) {
      const zone = world.zones.get(portalDef.zone);
      if (!zone) {
        console.warn(`Portal references unknown zone: ${portalDef.zone}`);
        continue;
      }

      // Create portal visual (a glowing ring)
      const portalGroup = new THREE.Group();
      portalGroup.name = `portal_${portalDef.id}`;

      const pos = portalDef.position || zone.position;
      portalGroup.position.set(pos.x, pos.y || 0, pos.z);

      // Portal ring geometry
      const ringGeometry = new THREE.TorusGeometry(1.5, 0.08, 8, 32);
      const ringMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ffcc,
        emissive: 0x00ffcc,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.7,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI / 2; // Horizontal ring
      ring.position.y = 1.5;
      portalGroup.add(ring);

      // Portal light
      const light = new THREE.PointLight(0x00ffcc, 2, 10);
      light.position.y = 1.5;
      portalGroup.add(light);

      world.group.add(portalGroup);

      portals.push({
        id: portalDef.id,
        targetManifest: portalDef.target_manifest,
        targetSpawn: portalDef.target_spawn,
        label: portalDef.label,
        position: new THREE.Vector3(pos.x, pos.y || 0, pos.z),
        mesh: portalGroup,
        zone: portalDef.zone,
      });
    }

    return portals;
  }

  // ─── Public Utilities ──────────────────────────────

  /**
   * Get nearest zone to a position.
   */
  getNearestZone(position) {
    if (!this.currentWorld) return null;
    let nearest = null;
    let minDist = Infinity;
    for (const [, zone] of this.currentWorld.zones) {
      const dist = position.distanceTo(zone.position);
      if (dist < minDist) {
        minDist = dist;
        nearest = zone;
      }
    }
    return { zone: nearest, distance: minDist };
  }

  /**
   * Get zone by ID.
   */
  getZone(id) {
    return this.currentWorld?.zones.get(id) || null;
  }

  /**
   * Check if position is inside a portal zone.
   * @returns {object|null} — portal def or null
   */
  checkPortalProximity(position, radius = 3) {
    if (!this.currentWorld) return null;
    for (const portal of this.currentWorld.portalZones) {
      if (position.distanceTo(portal.position) < radius) {
        return portal;
      }
    }
    return null;
  }

  /**
   * Get all zone definitions as an array (for compatibility).
   */
  getZonesArray() {
    if (!this.currentWorld) return [];
    return Array.from(this.currentWorld.zones.values());
  }

  /**
   * Resolve a relative path against the manifest's base path.
   */
  resolvePath(relativePath) {
    if (!this.currentWorld) return relativePath;
    return this.currentWorld.basePath + relativePath;
  }
}
