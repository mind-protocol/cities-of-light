import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialLoop } from './loop-studio-core.js';
import { createLoopStudioRuntime } from './loop-studio-runtime.js';

function runtime() {
  return createLoopStudioRuntime(createInitialLoop());
}

test('sense returns a non-authoritative snapshot', () => {
  const subject = runtime();
  const first = subject.sense();
  first.loop.nodes[0].title = 'forged locally';
  const second = subject.sense();
  assert.notEqual(second.loop.nodes[0].title, 'forged locally');
  assert.equal(second.revision, 0);
});

test('ModifyRoleIntent commits atomically with a receipt', () => {
  const subject = runtime();
  const before = subject.sense();
  const result = subject.act({
    type: 'ModifyRoleIntent',
    nodeId: 'objective:loop-studio-demo-v0',
    patch: { title: 'Observable objective' },
  }, { expectedRevision: before.revision });

  assert.equal(result.accepted, true);
  assert.equal(result.receipt.status, 'committed');
  assert.equal(result.receipt.revisionBefore, 0);
  assert.equal(result.receipt.revisionAfter, 1);
  assert.ok(result.receipt.changedNodeIds.includes('objective:loop-studio-demo-v0'));
  assert.equal(subject.sense().loop.nodes.find((node) => node.id === 'objective:loop-studio-demo-v0').title, 'Observable objective');
});

test('stale expected revision is rejected without mutation', () => {
  const subject = runtime();
  subject.act({
    type: 'ModifyRoleIntent',
    nodeId: 'objective:loop-studio-demo-v0',
    patch: { title: 'First commit' },
  }, { expectedRevision: 0 });

  const rejected = subject.act({
    type: 'ModifyRoleIntent',
    nodeId: 'objective:loop-studio-demo-v0',
    patch: { title: 'Conflicting commit' },
  }, { expectedRevision: 0 });

  assert.equal(rejected.accepted, false);
  assert.equal(rejected.receipt.reason, 'revision_conflict');
  assert.equal(subject.sense().revision, 1);
  assert.equal(subject.sense().loop.nodes.find((node) => node.id === 'objective:loop-studio-demo-v0').title, 'First commit');
});

test('health cannot be directly authored through a role intent', () => {
  const subject = runtime();
  const result = subject.act({
    type: 'ModifyRoleIntent',
    nodeId: 'health:loop-studio-demo-v0',
    patch: { health: 'healthy' },
  });

  assert.equal(result.accepted, false);
  assert.match(result.receipt.reason, /Protected or unknown role field/);
  assert.equal(subject.sense().loop.nodes.find((node) => node.id === 'health:loop-studio-demo-v0').health, 'not_measured');
});

test('editing after proof makes previous health stale', () => {
  const subject = runtime();
  subject.act({ type: 'LoadFixtureIntent', scenario: 'healthy' });
  subject.act({ type: 'ProveLoopIntent' });
  assert.equal(subject.sense().loop.nodes.find((node) => node.subtype === 'health').health, 'healthy');

  subject.act({
    type: 'ModifyVisualIntent',
    nodeId: 'health:loop-studio-demo-v0',
    patch: { shell: 2 },
  });

  const observed = subject.sense();
  assert.equal(observed.loop.nodes.find((node) => node.subtype === 'health').health, 'stale');
  assert.equal(observed.loop.observation.failureFront, 'unverified_change');
});

test('receipt-chain observer replays committed snapshots to the canonical hash', () => {
  const subject = runtime();
  subject.act({
    type: 'PlaceNodeIntent',
    nodeId: 'algorithm:loop-studio-demo-v0',
    position: { x: 333, y: 222 },
  });
  subject.act({ type: 'LoadFixtureIntent', scenario: 'healthy' });
  subject.act({ type: 'ProveLoopIntent' });

  const observation = subject.sense().receiptChainObservation;
  assert.equal(observation.chainValid, true);
  assert.equal(observation.eventCount, 3);
  assert.equal(observation.replayHash, observation.canonicalHash);
  assert.equal(observation.epistemicStatus, 'measured');
});

test('ProveLoopIntent receipt references runtime-produced moments', () => {
  const subject = runtime();
  subject.act({ type: 'LoadFixtureIntent', scenario: 'healthy' });
  const result = subject.act({ type: 'ProveLoopIntent' });

  assert.equal(result.accepted, true);
  assert.equal(result.receipt.runtimeMomentRefs.length, 3);
  assert.deepEqual(
    subject.sense().loop.runtimeMoments.map((moment) => moment.subtype),
    ['validation_run', 'observer_run', 'health_assessment']
  );
});
