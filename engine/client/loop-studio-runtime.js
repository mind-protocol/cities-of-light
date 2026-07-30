import {
  EPISTEMIC_STATES,
  LIFECYCLE_STATES,
  applyMaintenance,
  applyScenario,
  createInitialLoop,
  executeProof,
  validateStructure,
} from './loop-studio-core.js';

const VISUAL_LIMITS = Object.freeze({
  scale: [0.5, 2],
  roundness: [0, 80],
  shell: [0, 5],
  emission: [0, 1],
  pulse: [0, 5],
  opacity: [0, 1],
});

const INTENT_TYPES = Object.freeze([
  'ModifyRoleIntent',
  'ModifyVisualIntent',
  'PlaceNodeIntent',
  'LoadFixtureIntent',
  'ProveLoopIntent',
  'RepairLoopIntent',
  'ResetLoopIntent',
]);

const clone = (value) => JSON.parse(JSON.stringify(value));
const nowIso = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}:${crypto.randomUUID()}`;

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

export function hashSnapshot(value) {
  const input = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function findNode(loop, nodeId) {
  const node = loop.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error(`Unknown node: ${nodeId}`);
  return node;
}

function validateRolePatch(patch) {
  assertObject(patch, 'ModifyRoleIntent.patch');
  const allowed = new Set(['title', 'content', 'lifecycle', 'epistemic']);
  for (const key of Object.keys(patch)) {
    if (!allowed.has(key)) throw new Error(`Protected or unknown role field: ${key}`);
  }
  if ('title' in patch && typeof patch.title !== 'string') throw new Error('title must be a string.');
  if ('lifecycle' in patch && !LIFECYCLE_STATES.includes(patch.lifecycle)) {
    throw new Error(`Invalid lifecycle: ${patch.lifecycle}`);
  }
  if ('epistemic' in patch && !EPISTEMIC_STATES.includes(patch.epistemic)) {
    throw new Error(`Invalid epistemic state: ${patch.epistemic}`);
  }
}

function validateVisualPatch(patch) {
  assertObject(patch, 'ModifyVisualIntent.patch');
  for (const [key, value] of Object.entries(patch)) {
    const limits = VISUAL_LIMITS[key];
    if (!limits) throw new Error(`Unknown visual parameter: ${key}`);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${key} must be a finite number.`);
    }
    if (value < limits[0] || value > limits[1]) {
      throw new Error(`${key} must remain in [${limits[0]}, ${limits[1]}].`);
    }
  }
}

export function validateSemanticIntent(intent) {
  assertObject(intent, 'SemanticIntent');
  if (!INTENT_TYPES.includes(intent.type)) throw new Error(`Unknown SemanticIntent: ${intent.type}`);

  switch (intent.type) {
    case 'ModifyRoleIntent':
      if (typeof intent.nodeId !== 'string') throw new Error('ModifyRoleIntent.nodeId is required.');
      validateRolePatch(intent.patch);
      break;
    case 'ModifyVisualIntent':
      if (typeof intent.nodeId !== 'string') throw new Error('ModifyVisualIntent.nodeId is required.');
      validateVisualPatch(intent.patch);
      break;
    case 'PlaceNodeIntent':
      if (typeof intent.nodeId !== 'string') throw new Error('PlaceNodeIntent.nodeId is required.');
      assertObject(intent.position, 'PlaceNodeIntent.position');
      if (!Number.isFinite(intent.position.x) || !Number.isFinite(intent.position.y)) {
        throw new Error('PlaceNodeIntent position must contain finite x/y coordinates.');
      }
      break;
    case 'LoadFixtureIntent':
      if (typeof intent.scenario !== 'string') throw new Error('LoadFixtureIntent.scenario is required.');
      break;
    case 'RepairLoopIntent':
      if (typeof intent.action !== 'string') throw new Error('RepairLoopIntent.action is required.');
      break;
    case 'ProveLoopIntent':
    case 'ResetLoopIntent':
      break;
    default:
      throw new Error(`Unhandled SemanticIntent: ${intent.type}`);
  }

  return true;
}

function invalidateProof(loop, cause) {
  const hasAssessment = loop.runtimeMoments.some((moment) => moment.subtype === 'health_assessment');
  loop.observation.evidenceComplete = false;
  loop.observation.failureFront = 'unverified_change';
  loop.observation.invalidatedBy = cause;
  loop.observation.invalidatedAt = nowIso();

  for (const node of loop.nodes) {
    node.health = hasAssessment ? 'stale' : 'not_measured';
    node.evidenceRefs = [];
  }
}

function applySemanticIntent(loop, intent) {
  switch (intent.type) {
    case 'ModifyRoleIntent': {
      const node = findNode(loop, intent.nodeId);
      Object.assign(node, clone(intent.patch));
      loop.history.push({ at: nowIso(), action: 'modify_role', nodeId: node.id, fields: Object.keys(intent.patch) });
      invalidateProof(loop, intent.type);
      return loop;
    }
    case 'ModifyVisualIntent': {
      const node = findNode(loop, intent.nodeId);
      node.visual = { ...node.visual, ...clone(intent.patch) };
      loop.history.push({ at: nowIso(), action: 'modify_visual', nodeId: node.id, fields: Object.keys(intent.patch) });
      invalidateProof(loop, intent.type);
      return loop;
    }
    case 'PlaceNodeIntent': {
      const node = findNode(loop, intent.nodeId);
      node.position = {
        x: Math.max(0, Math.min(1000, intent.position.x)),
        y: Math.max(0, Math.min(680, intent.position.y)),
        source: 'Built',
      };
      node.derivedPosition = null;
      loop.history.push({ at: nowIso(), action: 'place_node', nodeId: node.id, position: clone(node.position) });
      invalidateProof(loop, intent.type);
      return loop;
    }
    case 'LoadFixtureIntent':
      applyScenario(loop, intent.scenario);
      loop.history.push({ at: nowIso(), action: 'load_fixture', scenario: intent.scenario });
      return loop;
    case 'ProveLoopIntent':
      executeProof(loop);
      return loop;
    case 'RepairLoopIntent':
      applyMaintenance(loop, intent.action);
      return loop;
    case 'ResetLoopIntent':
      return createInitialLoop();
    default:
      throw new Error(`Unhandled SemanticIntent: ${intent.type}`);
  }
}

function changedNodeIds(before, after) {
  const beforeById = new Map(before.nodes.map((node) => [node.id, hashSnapshot(node)]));
  return after.nodes
    .filter((node) => beforeById.get(node.id) !== hashSnapshot(node))
    .map((node) => node.id);
}

function newRuntimeMomentRefs(before, after) {
  const beforeIds = new Set(before.runtimeMoments.map((moment) => moment.id));
  return after.runtimeMoments
    .filter((moment) => !beforeIds.has(moment.id))
    .map((moment) => moment.id);
}

export function createLoopStudioRuntime(initialLoop = createInitialLoop()) {
  const genesis = clone(initialLoop);
  let canonicalLoop = clone(initialLoop);
  let revision = 0;
  const receipts = [];
  const eventLog = [];

  function observeReceiptChain() {
    const genesisHash = hashSnapshot(genesis);
    let expectedBeforeHash = genesisHash;
    let replayed = clone(genesis);
    let firstFailure = null;

    for (const event of eventLog) {
      if (event.beforeHash !== expectedBeforeHash) {
        firstFailure = firstFailure || `before_hash:${event.sequence}`;
        break;
      }
      const committedHash = hashSnapshot(event.committedState);
      if (committedHash !== event.afterHash) {
        firstFailure = firstFailure || `committed_state:${event.sequence}`;
        break;
      }
      replayed = clone(event.committedState);
      expectedBeforeHash = event.afterHash;
    }

    const replayHash = hashSnapshot(replayed);
    const canonicalHash = hashSnapshot(canonicalLoop);
    const chainValid = firstFailure === null && replayHash === canonicalHash;

    return {
      observer: 'loop-studio-receipt-chain-observer-v0',
      epistemicStatus: 'measured',
      chainValid,
      replayMode: 'committed-snapshot-replay',
      eventCount: eventLog.length,
      genesisHash,
      replayHash,
      canonicalHash,
      firstFailure,
      observedAt: nowIso(),
    };
  }

  function sense() {
    return {
      schema: 'mind.loop_studio.runtime_observation.v0',
      revision,
      loop: clone(canonicalLoop),
      receipts: clone(receipts),
      eventLog: clone(eventLog.map(({ committedState, ...event }) => event)),
      receiptChainObservation: observeReceiptChain(),
    };
  }

  function rejectedReceipt(intent, reason, expectedRevision) {
    return {
      id: makeId('commit-receipt'),
      subtype: 'commit_receipt',
      status: 'rejected',
      intentId: intent?.id || null,
      intentType: intent?.type || 'unknown',
      expectedRevision,
      actualRevision: revision,
      rejectedAt: nowIso(),
      reason,
      epistemicStatus: 'observed',
    };
  }

  function act(intent, options = {}) {
    const expectedRevision = options.expectedRevision ?? revision;
    try {
      validateSemanticIntent(intent);
      if (expectedRevision !== revision) {
        return { accepted: false, receipt: rejectedReceipt(intent, 'revision_conflict', expectedRevision), observation: sense() };
      }

      const before = clone(canonicalLoop);
      const beforeHash = hashSnapshot(before);
      const working = clone(canonicalLoop);
      const candidate = applySemanticIntent(working, intent);
      const structure = validateStructure(candidate);
      if (!structure.passed) {
        return {
          accepted: false,
          receipt: rejectedReceipt(intent, 'postcondition_validation_failed', expectedRevision),
          validation: structure,
          observation: sense(),
        };
      }

      const afterHash = hashSnapshot(candidate);
      const committedAt = nowIso();
      const nextRevision = revision + 1;
      const receipt = {
        id: makeId('commit-receipt'),
        subtype: 'commit_receipt',
        status: 'committed',
        intentId: intent.id || makeId('semantic-intent'),
        intentType: intent.type,
        revisionBefore: revision,
        revisionAfter: nextRevision,
        beforeHash,
        afterHash,
        committedAt,
        changedNodeIds: changedNodeIds(before, candidate),
        runtimeMomentRefs: newRuntimeMomentRefs(before, candidate),
        validation: {
          structuralContractPassed: structure.passed,
          precreatedMomentCount: structure.precreatedMomentCount,
        },
        epistemicStatus: 'measured',
      };

      canonicalLoop = clone(candidate);
      revision = nextRevision;
      receipts.push(receipt);
      eventLog.push({
        sequence: eventLog.length + 1,
        receiptId: receipt.id,
        intent: clone(intent),
        revision: nextRevision,
        beforeHash,
        afterHash,
        committedAt,
        committedState: clone(candidate),
      });

      return { accepted: true, receipt: clone(receipt), observation: sense() };
    } catch (error) {
      return {
        accepted: false,
        receipt: rejectedReceipt(intent, error instanceof Error ? error.message : String(error), expectedRevision),
        observation: sense(),
      };
    }
  }

  function exportSnapshot() {
    return JSON.stringify({
      schema: 'mind.loop_studio.transactional_snapshot.v0',
      ...sense(),
    }, null, 2);
  }

  return Object.freeze({ sense, act, exportSnapshot });
}
