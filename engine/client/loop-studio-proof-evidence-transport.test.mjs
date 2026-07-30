import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INTENT_TYPES,
  createIntent,
} from './loop-studio-intents.js';
import {
  enrichRunProofIntent,
} from './loop-studio-transport.js';

const manifest = {
  schema: 'mind.physicalization_manifest.v0',
  semanticTarget: 'health:test',
  semanticRole: 'health',
  plans: [],
};

test('RunProofIntent receives a detached renderer manifest', () => {
  const original = createIntent(INTENT_TYPES.RUN_PROOF, {}, 7);
  const enriched = enrichRunProofIntent(original, {
    getManifest: () => manifest,
  });

  assert.notEqual(enriched, original);
  assert.deepEqual(enriched.payload.physicalizationManifest, manifest);
  assert.equal(enriched.expectedRevision, 7);

  enriched.payload.physicalizationManifest.semanticTarget = 'forged';
  assert.equal(manifest.semanticTarget, 'health:test');
  assert.deepEqual(original.payload, {});
});

test('non-proof intents are not enriched', () => {
  const intent = createIntent(INTENT_TYPES.MODIFY_ROLE, {
    targetId: 'objective:test',
    patch: { title: 'x' },
  }, 0);
  const result = enrichRunProofIntent(intent, {
    getManifest: () => manifest,
  });

  assert.equal(result, intent);
});

test('proof without an observed preview remains explicit and unmodified', () => {
  const intent = createIntent(INTENT_TYPES.RUN_PROOF, {}, 0);
  const result = enrichRunProofIntent(intent, {
    getManifest: () => null,
  });

  assert.equal(result, intent);
  assert.equal(result.payload.physicalizationManifest, undefined);
});
