/**
 * Perception Pipeline — Manemus's visual feed from the Cities.
 *
 * Periodically captures what Manemus "sees" from its camera position
 * and sends the frame to Manemus infrastructure for processing.
 *
 * In Phase 1, this is a data endpoint — the client renders a frame
 * from Manemus's camera POV, encodes it as base64, and POSTs here.
 * This server stores it and makes it available to Manemus.
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const PERCEPTION_DIR = join(process.cwd(), 'perception');
const MANEMUS_SCREENSHOTS = process.env.MANEMUS_SCREENSHOTS || '/mnt/c/Temp/NarratorScreenshots';

// Ensure perception directory exists
if (!existsSync(PERCEPTION_DIR)) {
  mkdirSync(PERCEPTION_DIR, { recursive: true });
}

/**
 * Store a perception frame from Manemus's camera.
 * @param {string} base64Image - The frame as base64-encoded PNG
 * @param {object} metadata - Camera position, rotation, visible citizens
 * @returns {string} Path to saved frame
 */
export function storeFrame(base64Image, metadata = {}) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `frame_${timestamp}.png`;
  const filepath = join(PERCEPTION_DIR, filename);

  // Decode and save
  const buffer = Buffer.from(base64Image, 'base64');
  writeFileSync(filepath, buffer);

  // Save metadata alongside
  const metaPath = join(PERCEPTION_DIR, `frame_${timestamp}.json`);
  writeFileSync(metaPath, JSON.stringify({
    ts: new Date().toISOString(),
    filename,
    ...metadata,
  }, null, 2));

  // Also copy to Manemus screenshots directory for the existing perception pipeline
  try {
    const manemusPath = join(MANEMUS_SCREENSHOTS, `cities_${timestamp}.png`);
    writeFileSync(manemusPath, buffer);
  } catch (e) {
    // Manemus dir might not exist — not critical
  }

  // Write latest frame pointer (quick access for Manemus hook)
  try {
    writeFileSync(join(PERCEPTION_DIR, 'latest.png'), buffer);
    writeFileSync(join(PERCEPTION_DIR, 'latest.json'), JSON.stringify({
      ts: new Date().toISOString(),
      filename,
      ...metadata,
    }, null, 2));
  } catch (e) {
    // Not critical
  }

  return filepath;
}

/**
 * Express middleware for perception routes.
 */
export function perceptionRoutes(app) {
  // Client POSTs a frame from Manemus's camera
  app.post('/perception/frame', (req, res) => {
    const { image, camera_position, camera_rotation, visible_citizens } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image data' });
    }

    const filepath = storeFrame(image, {
      camera_position,
      camera_rotation,
      visible_citizens,
    });

    res.json({ ok: true, path: filepath });
  });

  // Get latest frame metadata
  app.get('/perception/latest', (req, res) => {
    const files = readdirSync(PERCEPTION_DIR)
      .filter(f => f.endsWith('.json') && f !== 'latest.json')
      .sort()
      .reverse();

    if (files.length === 0) {
      return res.json({ frame: null });
    }

    const latest = JSON.parse(readFileSync(join(PERCEPTION_DIR, files[0]), 'utf-8'));
    res.json({ frame: latest });
  });
}
