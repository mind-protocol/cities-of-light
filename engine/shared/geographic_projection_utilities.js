/**
 * Geographic projection helpers for world-space placement.
 *
 * Uses equirectangular projection around a reference lat/lng.
 */

const EARTH_RADIUS_METERS = 6378137;

export function degreesToRadians(deg) {
  return (deg * Math.PI) / 180;
}

export function createEquirectangularProjector(referenceLat, referenceLng, scale = 1) {
  if (typeof referenceLat !== 'number' || typeof referenceLng !== 'number') {
    throw new Error('Geographic projector requires numeric referenceLat/referenceLng');
  }

  const lat0 = degreesToRadians(referenceLat);
  const lng0 = degreesToRadians(referenceLng);

  return ({ lat, lng }) => {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new Error('Projection input must include numeric lat/lng');
    }

    const phi = degreesToRadians(lat);
    const lam = degreesToRadians(lng);
    const xMeters = (lam - lng0) * Math.cos(lat0) * EARTH_RADIUS_METERS;
    const zMeters = (phi - lat0) * EARTH_RADIUS_METERS;
    return { x: xMeters * scale, z: -zMeters * scale };
  };
}

export function centroidFromPolygon(points) {
  if (!Array.isArray(points) || points.length === 0) {
    throw new Error('centroidFromPolygon requires a non-empty points array');
  }

  let sx = 0;
  let sz = 0;
  for (const p of points) {
    sx += p.x;
    sz += p.z;
  }
  return { x: sx / points.length, z: sz / points.length };
}
