import {
  createLocalLoopStudio,
} from './loop-studio-intents.js';

function assertSenseResult(result) {
  if (!result || typeof result !== 'object') {
    throw new Error('sense() must return an observation envelope');
  }
  if (!Number.isInteger(result.revision) || result.revision < 0) {
    throw new Error('sense() result requires a non-negative integer revision');
  }
  if (!result.snapshot || !Array.isArray(result.snapshot.nodes)) {
    throw new Error('sense() result requires a loop snapshot');
  }
  if (!Array.isArray(result.receipts)) {
    throw new Error('sense() result requires a receipt list');
  }
  return result;
}

function assertReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object') {
    throw new Error('act() must return a receipt');
  }
  if (!receipt.id || receipt.subtype !== 'commit_receipt') {
    throw new Error('act() result is not a commit receipt');
  }
  if (!['committed', 'rejected', 'conflict'].includes(receipt.status)) {
    throw new Error(`Unknown receipt status: ${receipt.status}`);
  }
  return receipt;
}

export function createLoopStudioTransport({ sense, act, kind = 'custom' }) {
  if (typeof sense !== 'function' || typeof act !== 'function') {
    throw new Error('Loop Studio transport requires exactly sense and act functions');
  }

  return Object.freeze({
    kind,
    async sense(request = {}) {
      return assertSenseResult(await sense(request));
    },
    async act(intent) {
      return assertReceipt(await act(intent));
    },
  });
}

export function createLocalLoopStudioTransport(initialSnapshot) {
  const localUniverse = createLocalLoopStudio(initialSnapshot);

  return createLoopStudioTransport({
    kind: 'local',
    sense: async () => {
      const observation = localUniverse.sense();
      return { ...observation, genesis: localUniverse.exportBundle().genesis };
    },
    act: async (intent) => localUniverse.act(intent),
  });
}

async function decodeJson(response, operation) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error ?? payload?.message ?? `${operation} failed with HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload?.result ?? payload;
}

export function createHttpLoopStudioTransport({
  kind = 'mind',
  graph = 'l2:mind-universe',
  loopId = 'space:l2:mind-universe:loop-studio-demo-v0',
  senseUrl = '/api/sense',
  actUrl = '/api/act',
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('HTTP transport requires fetch');
  }

  return createLoopStudioTransport({
    kind,
    sense: async (request = {}) => {
      const response = await fetchImpl(senseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graph,
          target_id: loopId,
          include: ['snapshot', 'receipts', 'genesis'],
          ...request,
        }),
      });
      return decodeJson(response, 'sense');
    },
    act: async (intent) => {
      const response = await fetchImpl(actUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graph,
          semantic_intent: intent,
        }),
      });
      const payload = await decodeJson(response, 'act');
      return payload.receipt ?? payload;
    },
  });
}

export function createLoopStudioTransportFromLocation(locationLike = globalThis.location) {
  const params = new URLSearchParams(locationLike?.search ?? '');
  const transport = params.get('transport');

  if (transport === 'server') {
    return createHttpLoopStudioTransport({
      kind: 'server',
      graph: params.get('graph') || 'l2:mind-universe',
      loopId: params.get('loop') || 'space:l2:mind-universe:loop-studio-demo-v0',
      senseUrl: params.get('sense_url') || '/api/loop-studio/sense',
      actUrl: params.get('act_url') || '/api/loop-studio/act',
    });
  }

  if (transport === 'mind') {
    return createHttpLoopStudioTransport({
      kind: 'mind',
      graph: params.get('graph') || 'l2:mind-universe',
      loopId: params.get('loop') || 'space:l2:mind-universe:loop-studio-demo-v0',
      senseUrl: params.get('sense_url') || '/api/sense',
      actUrl: params.get('act_url') || '/api/act',
    });
  }

  return createLocalLoopStudioTransport();
}
