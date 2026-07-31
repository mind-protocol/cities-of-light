import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INTENT_TYPES,
  createIntent,
  createLocalLoopStudio,
  stateDigest,
  verifyReceiptChain,
} from './loop-studio-intents.js';

function freshStudio() {
  return createLocalLoopStudio();
}

test('sense returns a detached observation rather than mutable authority', () => {
  const studio = freshStudio();
  const first = studio.sense();
  first.snapshot.nodes[0].title = 'forged';

  const second = studio.sense();
  assert.notEqual(second.snapshot.nodes[0].title, 'forged');
  assert.equal(second.revision, 0);
});

test('ModifyRoleIntent commits atomically and returns a receipt', () => {
  const studio = freshStudio();
  const before = studio.sense();
  const targetId = 'objective:loop-studio-demo-v0';
  const intent = createIntent(
    INTENT_TYPES.MODIFY_ROLE,
    { targetId, patch: { title: 'Observable objective' } },
    before.revision,
  );

  const receipt = studio.act(intent);
  const after = studio.sense();

  assert.equal(receipt.status, 'committed');
  assert.equal(receipt.revisionBefore, 0);
  assert.equal(receipt.revisionAfter, 1);
  assert.deepEqual(receipt.changedNodeIds, [targetId]);
  assert.equal(after.snapshot.nodes.find((node) => node.id === targetId).title, 'Observable objective');
});

test('derived health cannot be authored directly', () => {
  const studio = freshStudio();
  const before = studio.sense();
  const intent = createIntent(
    INTENT_TYPES.MODIFY_ROLE,
    {
      targetId: 'health:loop-studio-demo-v0',
      patch: { health: 'healthy' },
    },
    before.revision,
  );

  const receipt = studio.act(intent);
  const after = studio.sense();

  assert.equal(receipt.status, 'rejected');
  assert.equal(after.revision, 0);
  assert.equal(after.snapshot.nodes.find((node) => node.subtype === 'health').health, 'not_measured');
});

test('stale expected revision is rejected as a conflict', () => {
  const studio = freshStudio();
  const first = createIntent(
    INTENT_TYPES.MODIFY_ROLE,
    { targetId: 'pattern:loop-studio-demo-v0', patch: { title: 'Pattern v1' } },
    0,
  );
  assert.equal(studio.act(first).status, 'committed');

  const stale = createIntent(
    INTENT_TYPES.MODIFY_ROLE,
    { targetId: 'pattern:loop-studio-demo-v0', patch: { title: 'Pattern v2' } },
    0,
  );
  const receipt = studio.act(stale);

  assert.equal(receipt.status, 'conflict');
  assert.equal(studio.sense().revision, 1);
});

test('MoveVisualIntent commits Built and clears Derived', () => {
  const studio = freshStudio();
  let sensed = studio.sense();

  studio.act(createIntent(
    INTENT_TYPES.APPLY_SCENARIO,
    { scenario: 'built_precedence' },
    sensed.revision,
  ));

  sensed = studio.sense();
  const targetId = 'implementation:loop-studio-demo-v0';
  assert.ok(sensed.snapshot.nodes.find((node) => node.id === targetId).derivedPosition);

  const receipt = studio.act(createIntent(
    INTENT_TYPES.MOVE_VISUAL,
    { targetId, position: { x: 333, y: 222, source: 'Built' } },
    sensed.revision,
  ));

  const node = studio.sense().snapshot.nodes.find((candidate) => candidate.id === targetId);
  assert.equal(receipt.status, 'committed');
  assert.deepEqual(node.position, { x: 333, y: 222, source: 'Built' });
  assert.equal(node.derivedPosition, null);
});

test('RunProofIntent produces runtime moments through execution', () => {
  const studio = freshStudio();
  let sensed = studio.sense();

  studio.act(createIntent(
    INTENT_TYPES.APPLY_SCENARIO,
    { scenario: 'healthy' },
    sensed.revision,
  ));
  sensed = studio.sense();

  const receipt = studio.act(createIntent(
    INTENT_TYPES.RUN_PROOF,
    {},
    sensed.revision,
  ));
  const after = studio.sense();
  const momentTypes = after.snapshot.runtimeMoments.map((moment) => moment.subtype);

  assert.equal(receipt.status, 'committed');
  assert.deepEqual(momentTypes, ['validation_run', 'observer_run', 'health_assessment']);
  assert.equal(receipt.producedMomentIds.length, 3);
  assert.equal(after.snapshot.runtimeMoments.at(-1).derivedState, 'healthy');
});

test('receipt chain replays to the exact observed state digest', () => {
  const studio = freshStudio();
  let sensed = studio.sense();

  studio.act(createIntent(
    INTENT_TYPES.MODIFY_VISUAL,
    {
      targetId: 'observer:loop-studio-demo-v0',
      patch: { emission: 0.42, shell: 2.2 },
    },
    sensed.revision,
  ));
  sensed = studio.sense();

  studio.act(createIntent(
    INTENT_TYPES.APPLY_SCENARIO,
    { scenario: 'observer_failure' },
    sensed.revision,
  ));

  const bundle = studio.exportBundle();
  const replay = verifyReceiptChain(bundle.genesis, bundle.receipts);

  assert.equal(replay.passed, true);
  assert.equal(replay.revision, bundle.revision);
  assert.equal(replay.stateDigest, stateDigest(bundle.snapshot));
});

test('rejected intent leaves semantic state unchanged', () => {
  const studio = freshStudio();
  const before = studio.sense();
  const intent = createIntent(
    INTENT_TYPES.MODIFY_VISUAL,
    {
      targetId: 'objective:loop-studio-demo-v0',
      patch: { emission: 9 },
    },
    before.revision,
  );

  const receipt = studio.act(intent);
  const after = studio.sense();

  assert.equal(receipt.status, 'rejected');
  assert.equal(after.revision, before.revision);
  assert.equal(after.observation.stateDigest, before.observation.stateDigest);
});
