import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INTENT_TYPES,
  createIntent,
  createLocalLoopStudio,
} from './loop-studio-intents.js';

function act(studio, type, payload = {}) {
  const sensed = studio.sense();
  return studio.act(createIntent(type, payload, sensed.revision));
}

function proveHealthy(studio) {
  assert.equal(act(studio, INTENT_TYPES.APPLY_SCENARIO, { scenario: 'healthy' }).status, 'committed');
  assert.equal(act(studio, INTENT_TYPES.RUN_PROOF).status, 'committed');
  const health = studio.sense().snapshot.nodes.find((node) => node.subtype === 'health');
  assert.equal(health.health, 'healthy');
}

test('semantic edit invalidates a previous healthy assessment', () => {
  const studio = createLocalLoopStudio();
  proveHealthy(studio);

  const receipt = act(studio, INTENT_TYPES.MODIFY_ROLE, {
    targetId: 'objective:loop-studio-demo-v0',
    patch: { title: 'Changed objective' },
  });
  const sensed = studio.sense();

  assert.equal(receipt.status, 'committed');
  assert.equal(sensed.snapshot.observation.failureFront, 'unverified_change');
  assert.equal(sensed.snapshot.observation.invalidatedBy, 'ModifyRoleIntent');
  assert.equal(sensed.snapshot.nodes.find((node) => node.subtype === 'health').health, 'stale');
  assert.deepEqual(sensed.snapshot.nodes.find((node) => node.subtype === 'health').evidenceRefs, []);
});

test('visual edit invalidates a previous healthy assessment', () => {
  const studio = createLocalLoopStudio();
  proveHealthy(studio);

  act(studio, INTENT_TYPES.MODIFY_VISUAL, {
    targetId: 'observer:loop-studio-demo-v0',
    patch: { shell: 2.5 },
  });

  const sensed = studio.sense();
  assert.equal(sensed.snapshot.observation.invalidatedBy, 'ModifyVisualIntent');
  assert.ok(sensed.snapshot.nodes.every((node) => node.health === 'stale'));
});

test('Built movement invalidates proof and clears Derived placement', () => {
  const studio = createLocalLoopStudio();
  proveHealthy(studio);

  act(studio, INTENT_TYPES.MOVE_VISUAL, {
    targetId: 'implementation:loop-studio-demo-v0',
    position: { x: 301, y: 401, source: 'Built' },
  });

  const sensed = studio.sense();
  const implementation = sensed.snapshot.nodes.find((node) => node.subtype === 'implementation');
  assert.equal(sensed.snapshot.observation.invalidatedBy, 'MoveVisualIntent');
  assert.deepEqual(implementation.position, { x: 301, y: 401, source: 'Built' });
  assert.equal(implementation.derivedPosition, null);
  assert.equal(implementation.health, 'stale');
});

test('sense independently measures the receipt-chain replay', () => {
  const studio = createLocalLoopStudio();
  act(studio, INTENT_TYPES.MODIFY_ROLE, {
    targetId: 'pattern:loop-studio-demo-v0',
    patch: { title: 'Receipt-backed pattern' },
  });

  const chain = studio.sense().observation.receiptChain;
  assert.equal(chain.status, 'measured');
  assert.equal(chain.passed, true);
  assert.equal(chain.replayRevision, 1);
  assert.equal(chain.failures.length, 0);
});
