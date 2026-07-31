import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import {
  INTENT_TYPES,
  createIntent,
} from '../client/loop-studio-intents.js';
import { createHttpLoopStudioTransport } from '../client/loop-studio-transport.js';
import { attachLoopStudioApi } from './loop-studio-api.js';

async function startServer() {
  const app = express();
  app.use(express.json());
  attachLoopStudioApi(app);

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

function transport(baseUrl) {
  return createHttpLoopStudioTransport({
    kind: 'server',
    senseUrl: `${baseUrl}/api/loop-studio/sense`,
    actUrl: `${baseUrl}/api/loop-studio/act`,
  });
}

test('two HTTP clients observe one committed semantic authority', async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const designer = transport(baseUrl);
  const observer = transport(baseUrl);
  const before = await designer.sense();
  const intent = createIntent(
    INTENT_TYPES.MODIFY_ROLE,
    {
      targetId: 'behavior:loop-studio-demo-v0',
      patch: { title: 'Committed over HTTP' },
    },
    before.revision,
  );

  const receipt = await designer.act(intent);
  const observed = await observer.sense();

  assert.equal(receipt.status, 'committed');
  assert.equal(observed.revision, 1);
  assert.equal(observed.receipts.length, 1);
  assert.equal(observed.receipts[0].id, receipt.id);
  assert.equal(
    observed.snapshot.nodes.find((node) => node.id === 'behavior:loop-studio-demo-v0').title,
    'Committed over HTTP',
  );
  assert.equal(observed.observation.receiptChain.passed, true);
});

test('HTTP revision conflict leaves shared authority unchanged', async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const firstClient = transport(baseUrl);
  const secondClient = transport(baseUrl);
  const original = await firstClient.sense();

  const committed = await firstClient.act(createIntent(
    INTENT_TYPES.MODIFY_ROLE,
    {
      targetId: 'pattern:loop-studio-demo-v0',
      patch: { title: 'First writer' },
    },
    original.revision,
  ));
  const conflict = await secondClient.act(createIntent(
    INTENT_TYPES.MODIFY_ROLE,
    {
      targetId: 'pattern:loop-studio-demo-v0',
      patch: { title: 'Stale writer' },
    },
    original.revision,
  ));
  const observed = await secondClient.sense();

  assert.equal(committed.status, 'committed');
  assert.equal(conflict.status, 'conflict');
  assert.equal(observed.revision, 1);
  assert.equal(
    observed.snapshot.nodes.find((node) => node.id === 'pattern:loop-studio-demo-v0').title,
    'First writer',
  );
});
