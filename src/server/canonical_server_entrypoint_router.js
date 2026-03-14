/**
 * Canonical server entrypoint router for Cities of Light.
 *
 * Modes:
 * - legacy (default): boots src/server/index.js
 * - engine: boots engine/index.js with WORLD_MANIFEST contract
 */

import { resolve } from 'path';
import { fileURLToPath } from 'url';

const mode = (process.env.CITIES_SERVER_MODE || 'legacy').trim().toLowerCase();

if (mode === 'legacy') {
  await import('./index.js');
} else if (mode === 'engine') {
  const manifest = process.env.WORLD_MANIFEST;
  if (!manifest) {
    throw new Error(
      'CITIES_SERVER_MODE=engine requires WORLD_MANIFEST (fail loud: no silent fallback to legacy)'
    );
  }

  const entrypointPath = fileURLToPath(new URL('../../engine/index.js', import.meta.url));

  if (!process.argv.includes('--world')) {
    process.argv.push('--world', resolve(manifest));
  }

  await import(entrypointPath);
} else {
  throw new Error(`Unsupported CITIES_SERVER_MODE: ${mode}. Expected "legacy" or "engine".`);
}
