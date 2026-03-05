/**
 * Zone Definitions — shared by client and server.
 *
 * Each zone in the archipelago has unique visual, ambient, and gameplay params.
 * This file is ES module compatible (browser + Node with "type":"module").
 */

export const ZONES = [
  {
    id: 'island',
    name: 'The Island',
    loreName: "Nicolas's Island",
    position: { x: 0, z: 0 },
    seed: 0,
    mode: 'home',
    terrain: {
      palette: 'warm-sand',
      vegetation: 'palms',
      rockDensity: 1.0,
    },
    ambient: {
      fogColor: 0x8faac0,
      fogDensity: 0.008,
      particleColor: 0xffcc44,
      particleType: 'fireflies',
      lightColor: 0xffcc88,
      lightIntensity: 2.5,
    },
    waypoints: ['archive', 'garden', 'agora', 'bassel'],
  },
  {
    id: 'bassel',
    name: 'Bassel',
    loreName: "Bassel's Shore",
    position: { x: 42, z: 18 },
    seed: 777,
    mode: 'memory',
    terrain: {
      palette: 'tropical',
      vegetation: 'palms',
      rockDensity: 0.8,
    },
    ambient: {
      fogColor: 0xa08050,
      fogDensity: 0.006,
      particleColor: 0xffaa33,
      particleType: 'fireflies',
      lightColor: 0xffaa55,
      lightIntensity: 2.8,
    },
    waypoints: ['island', 'agora'],
  },
  {
    id: 'archive',
    name: 'The Archive',
    loreName: 'The Archive of Voices',
    position: { x: -30, z: -25 },
    seed: 333,
    mode: 'contemplation',
    terrain: {
      palette: 'deep-blue',
      vegetation: 'crystals',
      rockDensity: 0.8,
    },
    ambient: {
      fogColor: 0x1a2a4a,
      fogDensity: 0.012,
      particleColor: 0x44ccff,
      particleType: 'embers',
      lightColor: 0x4488ff,
      lightIntensity: 1.8,
    },
    waypoints: ['island', 'garden'],
  },
  {
    id: 'garden',
    name: 'The Garden',
    loreName: 'The Garden of Remembrance',
    position: { x: 25, z: -35 },
    seed: 555,
    mode: 'growth',
    terrain: {
      palette: 'green-moss',
      vegetation: 'flowers',
      rockDensity: 0.3,
    },
    ambient: {
      fogColor: 0x3a5a2a,
      fogDensity: 0.010,
      particleColor: 0x88ff44,
      particleType: 'pollen',
      lightColor: 0x88cc44,
      lightIntensity: 2.0,
    },
    waypoints: ['island', 'archive', 'agora'],
  },
  {
    id: 'agora',
    name: 'The Agora',
    loreName: 'The Agora of Minds',
    position: { x: -20, z: 40 },
    seed: 888,
    mode: 'gathering',
    terrain: {
      palette: 'marble',
      vegetation: 'columns',
      rockDensity: 0.3,
    },
    ambient: {
      fogColor: 0xc0a880,
      fogDensity: 0.007,
      particleColor: 0xff8833,
      particleType: 'sparks',
      lightColor: 0xffcc66,
      lightIntensity: 2.2,
    },
    waypoints: ['island', 'garden', 'bassel'],
  },
];

/**
 * Find the nearest zone to a world-space position.
 * @param {{ x: number, z: number }} pos - World position (y ignored)
 * @returns {{ zone: object, distance: number }}
 */
export function detectNearestZone(pos) {
  let nearest = ZONES[0];
  let minDist = Infinity;

  for (const zone of ZONES) {
    const dx = pos.x - zone.position.x;
    const dz = pos.z - zone.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < minDist) {
      minDist = dist;
      nearest = zone;
    }
  }

  return { zone: nearest, distance: minDist };
}

/**
 * Get a zone by ID.
 */
export function getZoneById(id) {
  return ZONES.find(z => z.id === id) || null;
}
