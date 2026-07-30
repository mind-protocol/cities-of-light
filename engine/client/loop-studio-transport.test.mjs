import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INTENT_TYPES,
  createIntent,
} from './loop-studio-intents.js';
import {
  createHttpLoopStudioTransport,
  createLocalLoopStudioTransport,
  createLoopStudioTransport,
  createLoopStudioTransportFromLocation,
} from './loop-studio-transport.js';

test('transport contract exposes sense and act with validated envelopes', async () => {
  const transport = createLoopStudioTransport({
    kind: 'test',
    sense: async () => ({
      revision: 0,
      snapshot: { nodes: [] },
      receipts: [],
    }),
    act: async () => ({
      id: 'receipt:test',
      subtype: 'commit_receipt',
      status: 'committed',
    }),
  });

  assert.equal(transport.kind, 'test');
  assert.equal((await transport.sense()).revision, 0);
  assert.equal((await transport.act({})).status, 'committed');
});

test('local transport preserves sense → act → receipt → sense', async () => {
  const transport = createLocalLoopStudioTransport();
  const before = await transport.sense();
  const intent = createIntent(
    INTENT_TYPES.MODIFY_ROLE,
    {
      targetId: 'objective:loop-studio-demo-v0',
      patch: { title: 'Committed through transport' },
    },
    before.revision,
  );

  const receipt = await transport.act(intent);
  const after = await transport.sense();

  assert.equal(receipt.status, 'committed');
  assert.equal(after.revision, 1);
  assert.equal(after.receipts.length, 1);
  assert.equal(
    after.snapshot.nodes.find((node) => node.id === 'objective:loop-studio-demo-v0').title,
    'Committed through transport',
  );
  assert.ok(after.genesis);
});

test('HTTP transport calls only sense and act endpoints', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({
      url,
      method: options.method,
      body: JSON.parse(options.body),
    });

    if (url === '/custom/sense') {
      return {
        ok: true,
        json: async () => ({
          revision: 4,
          snapshot: { nodes: [] },
          receipts: [],
        }),
      };
    }

    return {
      ok: true,
      json: async () => ({
        receipt: {
          id: 'receipt:remote',
          subtype: 'commit_receipt',
          status: 'committed',
        },
      }),
    };
  };

  const transport = createHttpLoopStudioTransport({
    kind: 'server',
    graph: 'l2:test',
    loopId: 'space:l2:test:loop-v0',
    senseUrl: '/custom/sense',
    actUrl: '/custom/act',
    fetchImpl: fakeFetch,
  });

  await transport.sense();
  await transport.act({ id: 'intent:test', type: 'ModifyRoleIntent' });

  assert.equal(transport.kind, 'server');
  assert.deepEqual(calls.map((call) => call.url), ['/custom/sense', '/custom/act']);
  assert.deepEqual(calls[0].body, {
    graph: 'l2:test',
    target_id: 'space:l2:test:loop-v0',
    include: ['snapshot', 'receipts', 'genesis'],
  });
  assert.deepEqual(calls[1].body, {
    graph: 'l2:test',
    semantic_intent: { id: 'intent:test', type: 'ModifyRoleIntent' },
  });
});

test('HTTP transport preserves failure instead of fabricating success', async () => {
  const transport = createHttpLoopStudioTransport({
    fetchImpl: async () => ({
      ok: false,
      status: 502,
      json: async () => ({ error: 'mind unavailable' }),
    }),
  });

  await assert.rejects(() => transport.sense(), /mind unavailable/);
});

test('location selects local, shared server and Mind transports explicitly', () => {
  assert.equal(
    createLoopStudioTransportFromLocation({ search: '' }).kind,
    'local',
  );
  assert.equal(
    createLoopStudioTransportFromLocation({ search: '?transport=server' }).kind,
    'server',
  );
  assert.equal(
    createLoopStudioTransportFromLocation({ search: '?transport=mind' }).kind,
    'mind',
  );
});
