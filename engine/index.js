/**
 * Cities of Light — Engine Entry Point
 *
 * Starts the engine with a WorldManifest.
 *
 * Usage:
 *   node engine/index.js --world ./worlds/venezia/world-manifest.json
 *   WORLD_MANIFEST=./worlds/venezia/world-manifest.json node engine/index.js
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { createServer } from './server/state-server.js';
import { EntityManager } from './server/entity-manager.js';
import { VoicePipeline } from './server/voice-pipeline.js';

function getManifestPath() {
  // CLI arg: --world <path>
  const worldArgIdx = process.argv.indexOf('--world');
  if (worldArgIdx !== -1 && process.argv[worldArgIdx + 1]) {
    return resolve(process.argv[worldArgIdx + 1]);
  }
  // Env var
  if (process.env.WORLD_MANIFEST) {
    return resolve(process.env.WORLD_MANIFEST);
  }
  // No manifest specified
  console.error('Usage: node engine/index.js --world <path/to/world-manifest.json>');
  console.error('  or: WORLD_MANIFEST=<path> node engine/index.js');
  process.exit(1);
}

async function main() {
  const manifestPath = getManifestPath();

  if (!existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`);
    process.exit(1);
  }

  console.log(`\n  Cities of Light Engine`);
  console.log(`  ─────────────────────\n`);

  // 1. Load manifest
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  const basePath = dirname(manifestPath);
  console.log(`  World: ${manifest.display_name || manifest.name}`);
  console.log(`  Version: ${manifest.version}`);

  // 1b. If geographic terrain, load lands data and create zones from it
  if (manifest.terrain?.generator === 'geographic' && manifest.lands) {
    const landsPath = resolve(basePath, manifest.lands.path || 'data/lands.json');
    if (existsSync(landsPath)) {
      const landsData = JSON.parse(readFileSync(landsPath, 'utf-8'));
      // Create zone entries from each land
      for (const land of landsData) {
        manifest.zones.push({
          id: land.id,
          name: land.name,
          position: land.center,
          mode: 'default',
        });
      }
      console.log(`  Lands: ${landsData.length} (geographic zones created)`);
    }
  }
  console.log(`  Zones: ${manifest.zones?.length || 0}`);

  // 2. Load entity descriptors from world repo
  const entityDescriptors = loadEntities(manifest, basePath);
  console.log(`  Entities: ${entityDescriptors.length}`);

  // 3. Start server
  const port = parseInt(process.env.PORT || '8800');
  const { app, wss, broadcast } = createServer({ port, manifest, basePath });

  // 4. Create LLM client if AI is configured
  let llmClient = null;
  if (manifest.ai_config) {
    try {
      const OpenAI = (await import('openai')).default;
      llmClient = new OpenAI();
    } catch (e) {
      console.warn('  OpenAI SDK not available — entities will not respond to voice');
    }
  }

  // 5. Create entity manager
  const entityManager = new EntityManager(manifest, broadcast, { llmClient });
  entityManager.loadEntities(entityDescriptors);
  entityManager.start();

  // 6. Wire entity states to new client connections
  wss.on('connection', (ws) => {
    const states = entityManager.getAllStates();
    for (const state of states) {
      ws.send(JSON.stringify(state));
    }
  });

  // 7. HTTP API routes — manifest and entity data
  app.get('/api/manifest', (req, res) => {
    res.json(manifest);
  });

  app.get('/api/entities', (req, res) => {
    res.json(entityManager.getAllStates());
  });

  // 8. Attach entity manager to app for voice routing and tier updates
  app.entityManager = entityManager;

  // 9. Voice pipeline — STT (Whisper) -> EntityManager -> TTS (ElevenLabs)
  if (llmClient) {
    const ttsConfig = manifest.ai_config?.tts || {};
    const voicePipeline = new VoicePipeline({
      entityManager,
      llmClient,
      broadcast,
      ttsConfig,
    });
    app.voicePipeline = voicePipeline;
    console.log(`  Voice: pipeline active (STT + TTS)`);
  } else {
    console.log(`  Voice: disabled (no LLM client)`);
  }

  // 10. Physics bridge (if configured)
  if (manifest.physics?.engine && manifest.physics.engine !== 'none') {
    console.log(`  Physics: ${manifest.physics.engine} (tick: ${manifest.physics.tick_interval_ms}ms)`);
  } else {
    console.log(`  Physics: none`);
  }

  console.log(`\n  Server: http://localhost:${port}`);
  console.log(`  Ready.\n`);
}

/**
 * Load entity descriptors from the world repo filesystem.
 *
 * Supports two layouts:
 * 1. Directory of subdirectories: path="citizens/" → reads citizens/vox/entity.json, citizens/lyra/entity.json, ...
 * 2. Single JSON file: path="data/citizens.json" → reads array of entity descriptors directly
 *
 * @param {object} manifest — parsed WorldManifest
 * @param {string} basePath — directory containing the manifest
 * @returns {Array} entity descriptor objects
 */
function loadEntities(manifest, basePath) {
  if (!manifest.entities) return [];

  const source = manifest.entities.source || 'local';

  if (source !== 'local') {
    console.warn(`  Entity source '${source}' not supported at startup — use /api/entities endpoint`);
    return [];
  }

  const entitiesPath = resolve(basePath, manifest.entities.path || 'citizens/');

  if (!existsSync(entitiesPath)) {
    console.warn(`  Entities path not found: ${entitiesPath}`);
    return [];
  }

  // Single JSON file (V2 pattern: data/citizens.json)
  if (entitiesPath.endsWith('.json')) {
    const data = JSON.parse(readFileSync(entitiesPath, 'utf-8'));
    if (!Array.isArray(data)) {
      console.warn(`  Entities file is not an array: ${entitiesPath}`);
      return [];
    }
    return data;
  }

  // Directory of subdirectories (V1 pattern: citizens/vox/entity.json)
  const dirs = readdirSync(entitiesPath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const descriptors = [];

  for (const dir of dirs) {
    const entityJsonPath = join(entitiesPath, dir, 'entity.json');
    const promptPath = join(entitiesPath, dir, 'CLAUDE.md');

    if (!existsSync(entityJsonPath)) continue;

    const entity = JSON.parse(readFileSync(entityJsonPath, 'utf-8'));

    // Load system prompt if it exists alongside entity.json
    if (existsSync(promptPath)) {
      entity.system_prompt = readFileSync(promptPath, 'utf-8');
    }

    entity.prompt_path = promptPath;
    descriptors.push(entity);
  }

  return descriptors;
}

main().catch(e => {
  console.error('Engine failed to start:', e);
  process.exit(1);
});
