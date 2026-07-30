import {
  EPISTEMIC_STATES,
  LIFECYCLE_STATES,
  applyMaintenance,
  applyScenario,
  createInitialLoop,
  executeProof,
  validateStructure,
} from './loop-studio-core.js';
import {
  ALLOWED_VISUAL_PRIMITIVES,
  PHYSICALIZATION_STATUSES,
} from './loop-studio-physicalization.js';

export const INTENT_TYPES = Object.freeze({
  MODIFY_ROLE: 'ModifyRoleIntent',
  MODIFY_VISUAL: 'ModifyVisualIntent',
  MOVE_VISUAL: 'MoveVisualIntent',
  APPLY_SCENARIO: 'ApplyScenarioIntent',
  RUN_PROOF: 'RunProofIntent',
  APPLY_MAINTENANCE: 'ApplyMaintenanceIntent',
  RESET_LOOP: 'ResetLoopIntent',
});

const ROLE_PATCH_FIELDS = new Set(['title', 'content', 'lifecycle', 'epistemic']);
const EPISTEMIC_SET = new Set(EPISTEMIC_STATES);
const LIFECYCLE_SET = new Set(LIFECYCLE_STATES);
const VISUAL_LIMITS = Object.freeze({
  scale: [0.5, 2],
  roundness: [0, 80],
  shell: [0.1, 8],
  emission: [0, 1],
  pulse: [0, 4],
  opacity: [0.05, 1],
});
const SCENARIOS = new Set([
  'not_measured',
  'healthy',
  'observer_failure',
  'stale',
  'unknown',
  'degraded',
  'built_precedence',
  'unmeasured_energy',
]);
const FIXTURE_SCENARIOS = new Set([
  'observer_failure',
  'stale',
  'unknown',
  'degraded',
  'built_precedence',
  'unmeasured_energy',
]);
const MAINTENANCE_ACTIONS = new Set([
  'retry_observer',
  'suspend_modulation',
  'recalibrate',
  'relink',
  'rematerialize',
  'restore_built',
]);

const nowIso = () => new Date().toISOString();

function randomId(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${uuid}`;
}

function deepClone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

export function stateDigest(value) {
  const input = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function equal(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function diffState(before, after) {
  const beforeNodes = new Map(before.nodes.map((node) => [node.id, node]));
  const afterNodes = new Map(after.nodes.map((node) => [node.id, node]));
  const changedNodes = [];
  const removedNodeIds = [];

  for (const [id, node] of afterNodes) {
    if (!beforeNodes.has(id) || !equal(beforeNodes.get(id), node)) {
      changedNodes.push(deepClone(node));
    }
  }
  for (const id of beforeNodes.keys()) {
    if (!afterNodes.has(id)) removedNodeIds.push(id);
  }

  const fields = {};
  for (const key of Object.keys(after)) {
    if (key === 'nodes') continue;
    if (!equal(before[key], after[key])) fields[key] = deepClone(after[key]);
  }
  for (const key of Object.keys(before)) {
    if (key === 'nodes' || key in after) continue;
    fields[key] = { $deleted: true };
  }

  return { changedNodes, removedNodeIds, fields };
}

export function applyStateDelta(snapshot, delta) {
  const next = deepClone(snapshot);
  const nodeById = new Map(next.nodes.map((node) => [node.id, node]));

  for (const id of delta.removedNodeIds ?? []) nodeById.delete(id);
  for (const node of delta.changedNodes ?? []) nodeById.set(node.id, deepClone(node));
  next.nodes = [...nodeById.values()];

  for (const [key, value] of Object.entries(delta.fields ?? {})) {
    if (value && typeof value === 'object' && value.$deleted === true) {
      delete next[key];
    } else {
      next[key] = deepClone(value);
    }
  }

  return next;
}

function nodeOrThrow(snapshot, id) {
  const node = snapshot.nodes.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`Unknown node: ${id}`);
  return node;
}

function validateFiniteNumber(name, value, [minimum, maximum]) {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  if (value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
}

function validatePhysicalizationManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('RunProofIntent physicalizationManifest must be an object');
  }
  if (manifest.schema !== 'mind.physicalization_manifest.v0') {
    throw new Error(`Unsupported physicalization manifest schema: ${manifest.schema}`);
  }
  if (!manifest.semanticTarget || !manifest.semanticRole) {
    throw new Error('Physicalization manifest requires semanticTarget and semanticRole');
  }
  if (!Array.isArray(manifest.plans) || manifest.plans.length === 0) {
    throw new Error('Physicalization manifest requires plans');
  }
  if (manifest.materializedPrimitives && !Array.isArray(manifest.materializedPrimitives)) {
    throw new Error('materializedPrimitives must be an array');
  }
  for (const plan of manifest.plans) {
    if (!PHYSICALIZATION_STATUSES.includes(plan.status)) {
      throw new Error(`Unknown physicalization status in manifest: ${plan.status}`);
    }
    if (!Array.isArray(plan.primitives)) {
      throw new Error(`Physicalization plan ${plan.status} requires primitives`);
    }
  }
}

export function observePhysicalizationManifest(manifest) {
  validatePhysicalizationManifest(manifest);
  const expected = manifest.plans.flatMap((plan) =>
    plan.primitives.map((primitive) => ({
      id: primitive.id,
      type: primitive.type,
      role: primitive.role,
      status: plan.status,
      visible: primitive.properties?.visible !== false && (primitive.material?.opacity ?? 1) > 0,
      emission: primitive.material?.emission ?? 0,
      pulse: primitive.properties?.pulse ?? 0,
    })));
  const materialized = manifest.materializedPrimitives?.length
    ? manifest.materializedPrimitives
    : expected;
  const primitiveTypes = [...new Set(materialized.map((primitive) => primitive.type))];
  const forbiddenPrimitives = primitiveTypes.filter((type) => !ALLOWED_VISUAL_PRIMITIVES.includes(type));
  const expectedIds = expected.map((primitive) => `${primitive.status}:${primitive.id}`).sort();
  const actualIds = materialized.map((primitive) => `${primitive.status}:${primitive.id}`).sort();
  const statusCoverage = new Set(manifest.plans.map((plan) => plan.status));
  const notMeasuredExpected = expected.filter((primitive) => primitive.status === 'not_measured');
  const notMeasuredActual = materialized.filter((primitive) => primitive.status === 'not_measured');
  const falseEnergyDisplays = notMeasuredExpected.filter((primitive) =>
    primitive.role === 'semantic_core' && (primitive.emission > 0 || primitive.pulse > 0)).length;
  const unmeasuredSignalsRendered = notMeasuredActual.filter((primitive) =>
    primitive.role === 'semantic_core' && primitive.visible === true).length;
  const renderedPlanParity = stableStringify(expectedIds) === stableStringify(actualIds);
  const completeStatusCoverage = PHYSICALIZATION_STATUSES.every((status) => statusCoverage.has(status));
  const drawCalls = Number.isFinite(manifest.drawCallCount)
    ? manifest.drawCallCount
    : materialized.filter((primitive) => primitive.visible !== false).length;
  const hardFailures = [];

  if (!renderedPlanParity) hardFailures.push('renderer_plan_mismatch');
  if (!completeStatusCoverage) hardFailures.push('missing_status_physicalization');
  if (forbiddenPrimitives.length > 0) hardFailures.push('forbidden_primitive');
  if (falseEnergyDisplays > 0) hardFailures.push('false_energy_display');
  if (unmeasuredSignalsRendered > 0) hardFailures.push('unmeasured_signal_fabrication');

  return {
    informationStatus: 'measured',
    observedAt: manifest.observedAt || nowIso(),
    renderer: manifest.renderer || 'unknown-renderer',
    semanticTarget: manifest.semanticTarget,
    primitiveTypes,
    forbiddenPrimitives,
    drawCalls,
    falseEnergyDisplays,
    unmeasuredSignalsRendered,
    renderedPlanParity,
    completeStatusCoverage,
    evidenceComplete: hardFailures.length === 0,
    hardFailures,
    failureFront: hardFailures.length ? 'renderer_manifest' : null,
  };
}

function applyPhysicalizationEvidence(snapshot, manifest) {
  const observed = observePhysicalizationManifest(manifest);
  const preserveFixture = FIXTURE_SCENARIOS.has(snapshot.scenario);
  const existingFailures = preserveFixture ? snapshot.observation.hardFailures : [];
  const combinedFailures = [...new Set([...existingFailures, ...observed.hardFailures])];

  snapshot.rendererManifest = {
    ...snapshot.rendererManifest,
    primitives: [...observed.primitiveTypes],
    allowedPrimitives: [...ALLOWED_VISUAL_PRIMITIVES],
    falseEnergyDisplays: observed.falseEnergyDisplays,
    unmeasuredSignalsRendered: observed.unmeasuredSignalsRendered,
    drawCalls: observed.drawCalls,
    physicalizationEvidence: deepClone(manifest),
    independentObservation: observed,
  };

  if (!preserveFixture) {
    snapshot.observation.executionStatus = 'success';
    snapshot.observation.evidenceComplete = observed.evidenceComplete;
    snapshot.observation.observedAt = observed.observedAt;
    snapshot.observation.hardFailures = combinedFailures;
    snapshot.observation.failureFront = observed.failureFront;
  } else {
    snapshot.observation.hardFailures = combinedFailures;
    snapshot.observation.failureFront = snapshot.observation.failureFront || observed.failureFront;
  }

  snapshot.history.push({
    at: nowIso(),
    action: 'observe_physicalization',
    renderer: observed.renderer,
    semanticTarget: observed.semanticTarget,
    result: observed.evidenceComplete ? 'measured' : 'degraded',
    hardFailures: [...observed.hardFailures],
  });
  return observed;
}

export function createIntent(type, payload = {}, expectedRevision = null) {
  if (!Object.values(INTENT_TYPES).includes(type)) {
    throw new Error(`Unknown intent type: ${type}`);
  }
  return {
    id: randomId('semantic-intent'),
    type,
    payload: deepClone(payload),
    expectedRevision,
    createdAt: nowIso(),
  };
}

export function validateIntent(snapshot, intent) {
  if (!intent || typeof intent !== 'object') throw new Error('Intent envelope is required');
  if (!intent.id || !intent.type) throw new Error('Intent id and type are required');
  if (!Object.values(INTENT_TYPES).includes(intent.type)) {
    throw new Error(`Unsupported intent type: ${intent.type}`);
  }

  const payload = intent.payload ?? {};

  switch (intent.type) {
    case INTENT_TYPES.MODIFY_ROLE: {
      nodeOrThrow(snapshot, payload.targetId);
      const patch = payload.patch;
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        throw new Error('ModifyRoleIntent.patch must be an object');
      }
      for (const key of Object.keys(patch)) {
        if (!ROLE_PATCH_FIELDS.has(key)) {
          throw new Error(`Role field is protected or unsupported: ${key}`);
        }
      }
      if ('title' in patch && typeof patch.title !== 'string') {
        throw new Error('title must be a string');
      }
      if ('lifecycle' in patch && !LIFECYCLE_SET.has(patch.lifecycle)) {
        throw new Error(`Unknown lifecycle state: ${patch.lifecycle}`);
      }
      if ('epistemic' in patch && !EPISTEMIC_SET.has(patch.epistemic)) {
        throw new Error(`Unknown epistemic state: ${patch.epistemic}`);
      }
      break;
    }
    case INTENT_TYPES.MODIFY_VISUAL: {
      nodeOrThrow(snapshot, payload.targetId);
      const patch = payload.patch;
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        throw new Error('ModifyVisualIntent.patch must be an object');
      }
      for (const [key, value] of Object.entries(patch)) {
        if (!(key in VISUAL_LIMITS)) throw new Error(`Unsupported visual parameter: ${key}`);
        validateFiniteNumber(key, value, VISUAL_LIMITS[key]);
      }
      break;
    }
    case INTENT_TYPES.MOVE_VISUAL:
      nodeOrThrow(snapshot, payload.targetId);
      validateFiniteNumber('x', payload.position?.x, [0, 1000]);
      validateFiniteNumber('y', payload.position?.y, [0, 680]);
      if (payload.position?.source !== 'Built') {
        throw new Error('Authored movement must produce a Built position');
      }
      break;
    case INTENT_TYPES.APPLY_SCENARIO:
      if (!SCENARIOS.has(payload.scenario)) throw new Error(`Unknown scenario: ${payload.scenario}`);
      break;
    case INTENT_TYPES.APPLY_MAINTENANCE:
      if (!MAINTENANCE_ACTIONS.has(payload.action)) {
        throw new Error(`Unknown maintenance action: ${payload.action}`);
      }
      break;
    case INTENT_TYPES.RUN_PROOF:
      if (payload.physicalizationManifest) validatePhysicalizationManifest(payload.physicalizationManifest);
      break;
    case INTENT_TYPES.RESET_LOOP:
      break;
    default:
      throw new Error(`No validator for intent type: ${intent.type}`);
  }

  return true;
}

function invalidateProof(snapshot, cause) {
  const hasAssessment = (snapshot.runtimeMoments ?? [])
    .some((moment) => moment.subtype === 'health_assessment');
  const nextHealth = hasAssessment ? 'stale' : 'not_measured';

  snapshot.observation = {
    ...snapshot.observation,
    evidenceComplete: false,
    failureFront: 'unverified_change',
    invalidatedBy: cause,
    invalidatedAt: nowIso(),
  };

  for (const node of snapshot.nodes) {
    node.health = nextHealth;
    node.evidenceRefs = [];
  }
}

function reduceIntent(snapshot, intent) {
  const next = deepClone(snapshot);
  const payload = intent.payload ?? {};

  switch (intent.type) {
    case INTENT_TYPES.MODIFY_ROLE: {
      const node = nodeOrThrow(next, payload.targetId);
      Object.assign(node, deepClone(payload.patch));
      invalidateProof(next, intent.type);
      break;
    }
    case INTENT_TYPES.MODIFY_VISUAL: {
      const node = nodeOrThrow(next, payload.targetId);
      node.visual = { ...node.visual, ...deepClone(payload.patch) };
      invalidateProof(next, intent.type);
      break;
    }
    case INTENT_TYPES.MOVE_VISUAL: {
      const node = nodeOrThrow(next, payload.targetId);
      node.position = deepClone(payload.position);
      node.derivedPosition = null;
      invalidateProof(next, intent.type);
      break;
    }
    case INTENT_TYPES.APPLY_SCENARIO:
      applyScenario(next, payload.scenario);
      break;
    case INTENT_TYPES.RUN_PROOF:
      if (payload.physicalizationManifest) {
        applyPhysicalizationEvidence(next, payload.physicalizationManifest);
      }
      executeProof(next);
      break;
    case INTENT_TYPES.APPLY_MAINTENANCE:
      applyMaintenance(next, payload.action);
      break;
    case INTENT_TYPES.RESET_LOOP:
      return createInitialLoop();
    default:
      throw new Error(`No reducer for intent type: ${intent.type}`);
  }

  return next;
}

function changedMomentIds(before, after) {
  const beforeIds = new Set((before.runtimeMoments ?? []).map((moment) => moment.id));
  return (after.runtimeMoments ?? [])
    .filter((moment) => !beforeIds.has(moment.id))
    .map((moment) => moment.id);
}

function receiptBase(intent, revision, beforeDigest) {
  return {
    id: randomId('commit-receipt'),
    subtype: 'commit_receipt',
    intentRef: intent?.id ?? 'invalid-intent',
    intentType: intent?.type ?? 'invalid',
    intent: deepClone(intent ?? {}),
    transactionId: randomId('transaction'),
    adapter: 'local-universe-v0',
    revisionBefore: revision,
    revisionAfter: revision,
    committedAt: nowIso(),
    stateDigestBefore: beforeDigest,
    stateDigestAfter: beforeDigest,
    changedNodeIds: [],
    producedMomentIds: [],
    validation: null,
    stateDelta: null,
  };
}

export function createLocalLoopStudio(initialSnapshot = createInitialLoop()) {
  const genesis = deepClone(initialSnapshot);
  let snapshot = deepClone(initialSnapshot);
  let revision = 0;
  const receipts = [];

  function sense() {
    const receiptChain = verifyReceiptChain(genesis, receipts);
    return {
      revision,
      snapshot: deepClone(snapshot),
      receipts: deepClone(receipts),
      latestReceipt: receipts.length ? deepClone(receipts[receipts.length - 1]) : null,
      observation: {
        observedAt: nowIso(),
        stateDigest: stateDigest(snapshot),
        informationStatus: 'observed',
        receiptChain: {
          status: receiptChain.passed ? 'measured' : 'measurement_failed',
          passed: receiptChain.passed,
          replayRevision: receiptChain.revision,
          replayDigest: receiptChain.stateDigest,
          failures: deepClone(receiptChain.failures),
        },
      },
    };
  }

  function act(intent) {
    const before = deepClone(snapshot);
    const beforeDigest = stateDigest(before);
    const receipt = receiptBase(intent, revision, beforeDigest);

    if (intent?.expectedRevision !== null && intent?.expectedRevision !== undefined && intent.expectedRevision !== revision) {
      receipt.status = 'conflict';
      receipt.error = `Expected revision ${intent.expectedRevision}, observed ${revision}`;
      receipts.push(receipt);
      return deepClone(receipt);
    }

    try {
      validateIntent(before, intent);
      const candidate = reduceIntent(before, intent);
      const structuralValidation = validateStructure(candidate);

      if (!structuralValidation.passed) {
        throw new Error(`Post-condition failed: ${JSON.stringify(structuralValidation)}`);
      }

      const delta = diffState(before, candidate);
      revision += 1;
      snapshot = candidate;

      receipt.status = 'committed';
      receipt.revisionAfter = revision;
      receipt.stateDigestAfter = stateDigest(snapshot);
      receipt.changedNodeIds = delta.changedNodes.map((node) => node.id);
      receipt.producedMomentIds = changedMomentIds(before, snapshot);
      receipt.validation = {
        status: 'observed',
        structural: structuralValidation,
        independentDigest: receipt.stateDigestAfter,
      };
      receipt.stateDelta = delta;
    } catch (error) {
      receipt.status = 'rejected';
      receipt.error = error instanceof Error ? error.message : String(error);
      receipt.validation = {
        status: 'observed',
        structural: validateStructure(before),
      };
    }

    receipts.push(receipt);
    return deepClone(receipt);
  }

  function exportBundle() {
    return {
      schema: 'mind.loop_studio.local_universe_bundle.v0',
      genesis: deepClone(genesis),
      revision,
      snapshot: deepClone(snapshot),
      receipts: deepClone(receipts),
      observation: sense().observation,
    };
  }

  return { sense, act, exportBundle };
}

export function verifyReceiptChain(genesis, receipts) {
  let snapshot = deepClone(genesis);
  let revision = 0;
  const failures = [];

  for (const receipt of receipts) {
    if (receipt.status !== 'committed') continue;

    if (receipt.revisionBefore !== revision) {
      failures.push({
        receiptId: receipt.id,
        kind: 'revision_before_mismatch',
        expected: revision,
        observed: receipt.revisionBefore,
      });
    }

    const beforeDigest = stateDigest(snapshot);
    if (beforeDigest !== receipt.stateDigestBefore) {
      failures.push({
        receiptId: receipt.id,
        kind: 'before_digest_mismatch',
        expected: beforeDigest,
        observed: receipt.stateDigestBefore,
      });
    }

    snapshot = applyStateDelta(snapshot, receipt.stateDelta);
    revision += 1;

    const afterDigest = stateDigest(snapshot);
    if (afterDigest !== receipt.stateDigestAfter) {
      failures.push({
        receiptId: receipt.id,
        kind: 'after_digest_mismatch',
        expected: afterDigest,
        observed: receipt.stateDigestAfter,
      });
    }
    if (receipt.revisionAfter !== revision) {
      failures.push({
        receiptId: receipt.id,
        kind: 'revision_after_mismatch',
        expected: revision,
        observed: receipt.revisionAfter,
      });
    }
  }

  return {
    passed: failures.length === 0,
    revision,
    snapshot,
    stateDigest: stateDigest(snapshot),
    failures,
  };
}

export function serializeStudioBundle(studio) {
  return JSON.stringify(studio.exportBundle(), null, 2);
}
