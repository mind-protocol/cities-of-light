import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INTENT_TYPES,
  createIntent,
} from '../client/loop-studio-intents.js';
import { createLoopStudioApi } from './loop-studio-api.js';

function modifyObjective(revision, title) {
  return createIntent(
    INTENT_TYPES.MODIFY_ROLE,
    {
      targetId: 'objective:loop-studio-demo-v0',
      patch: { title },
    },
    revision,
  );
}

test('two observers read the same server-memory authority', () => {
  const api = createLoopStudioApi();
  const firstObserver = api.sense();
  const result = api.act(modifyObjective(firstObserver.revision, 'Shared objective'));
  const secondObserver = api.sense();

  assert.equal(result.receipt.status, 'committed');
  assert.equal(secondObserver.revision, 1);
  assert.equal(
    secondObserver.snapshot.nodes.find((node) => node.id === 'objective:loop-studio-demo-v0').title,
    'Shared objective',
  );
  assert.equal(secondObserver.adapter, 'engine-memory-v0');
});

test('server adapter preserves revision conflicts', () => {
  const api = createLoopStudioApi();
  assert.equal(api.act(modifyObjective(0, 'First')).receipt.status, 'committed');
  const conflict = api.act(modifyObjective(0, 'Stale write'));

  assert.equal(conflict.receipt.status, 'conflict');
  assert.equal(api.sense().revision, 1);
});

test('server adapter exposes genesis and replay evidence', () => {
  const api = createLoopStudioApi();
  api.act(modifyObjective(0, 'Receipt backed'));
  const sensed = api.sense();

  assert.ok(sensed.genesis);
  assert.equal(sensed.observation.receiptChain.passed, true);
  assert.equal(sensed.observation.receiptChain.replayRevision, 1);
});

test('route attachment returns result envelopes', () => {
  const routes = new Map();
  const fakeApp = {
    post(path, handler) {
      routes.set(path, handler);
    },
  };
  const api = createLoopStudioApi();
  api.attach(fakeApp);

  let responsePayload = null;
  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      responsePayload = payload;
      return this;
    },
  };

  routes.get('/api/loop-studio/sense')({}, response);
  assert.equal(responsePayload.result.revision, 0);

  routes.get('/api/loop-studio/act')({ body: {} }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(responsePayload.information_status, 'measurement_failed');
});
