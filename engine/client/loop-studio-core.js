export const REQUIRED_ROLE_SUBTYPES = Object.freeze([
  'objective',
  'pattern',
  'vocabulary',
  'behavior',
  'algorithm',
  'code',
  'implementation',
  'justification',
  'validation',
  'observability_algorithm',
  'metric',
  'health',
]);

export const REQUIRED_RELATIONS = Object.freeze([
  'IMPLEMENTED_IN',
  'DEFINED_BY_CODE',
  'IMPLEMENTED_BY',
  'JUSTIFIED_BY',
  'VALIDATED_BY',
  'OBSERVED_BY',
  'PRODUCES',
  'FEEDS',
  'SUPPORTS',
]);

export const HEALTH_STATES = Object.freeze([
  'healthy',
  'degraded',
  'stale',
  'unknown',
  'not_measured',
  'measurement_failed',
]);

export const EPISTEMIC_STATES = Object.freeze([
  'observed',
  'measured',
  'known_absent',
  'unknown',
  'not_measured',
  'measurement_failed',
]);

export const LIFECYCLE_STATES = Object.freeze([
  'planned',
  'graph-defined',
  'materialized',
  'wired',
  'running',
  'verified',
]);

const nowIso = () => new Date().toISOString();

const role = (id, subtype, title, x, y, content, visual = {}) => ({
  id,
  node_type: subtype === 'code' || subtype === 'implementation' ? 'thing' : 'narrative',
  subtype,
  title,
  content,
  lifecycle: subtype === 'implementation' ? 'materialized' : 'graph-defined',
  epistemic: 'observed',
  health: 'not_measured',
  evidenceRefs: [],
  position: { x, y, source: 'Built' },
  derivedPosition: null,
  visual: {
    scale: 1,
    roundness: 18,
    shell: 1,
    emission: 0,
    pulse: 0,
    opacity: 1,
    ...visual,
  },
});

export function createInitialLoop() {
  const rootId = 'space:l2:mind-universe:loop-studio-demo-v0';
  const nodes = [
    {
      id: rootId,
      node_type: 'space',
      subtype: 'physicalization_toolkit',
      title: 'Self-verifying visual toolkit',
      content: {
        contractKind: 'self_verifying_loop',
        parent_scope: {
          classification: 'standalone',
          justification: 'Loop Studio vertical slice before registry installation.',
        },
        runtime_moment_subtypes: ['validation_run', 'health_assessment'],
      },
      lifecycle: 'graph-defined',
      epistemic: 'observed',
      health: 'not_measured',
      evidenceRefs: [],
      position: { x: 420, y: 34, source: 'Built' },
      derivedPosition: null,
      visual: { scale: 1.08, roundness: 26, shell: 1.4, emission: 0, pulse: 0, opacity: 1 },
    },
    role('objective:loop-studio-demo-v0', 'objective', 'Objective', 56, 142,
      'Every toolkit exposes a truthful, readable and repairable path from promise to fresh health evidence.'),
    role('pattern:loop-studio-demo-v0', 'pattern', 'Pattern', 274, 142,
      'Evidence-bearing visual spine with identity-first status modulation.'),
    role('vocabulary:loop-studio-demo-v0', 'vocabulary', 'Vocabulary', 56, 308,
      'Built, Derived, measured, unknown, failure front, fresh evidence.'),
    role('behavior:loop-studio-demo-v0', 'behavior', 'Behavior', 492, 142,
      'GIVEN a toolkit, WHEN it renders, THEN every visible claim is backed by canonical state or explicit uncertainty.'),
    role('algorithm:loop-studio-demo-v0', 'algorithm', 'Algorithm', 710, 142,
      'Resolve → preserve unknown → apply Built precedence → validate → observe → derive health.'),
    role('code:loop-studio-demo-v0', 'code', 'CodeDefinition', 928, 142,
      'Canonical expression AST and visual binding definitions.'),
    role('implementation:loop-studio-demo-v0', 'implementation', 'Implementation', 928, 308,
      'Current materialized Loop Studio slice; not yet wired to the live Universe.', { emission: 0.08 }),
    role('justification:loop-studio-demo-v0', 'justification', 'Justification', 274, 308,
      'Independent evidence prevents attractive but false health animation.'),
    role('validation:loop-studio-demo-v0', 'validation', 'Validation', 710, 308,
      'Fixtures challenge missing roles, false edges, stale proof, unmeasured energy and Built precedence.'),
    role('validation:loop-studio-observer-v0', 'validation', 'Observer validation', 492, 474,
      'Proves the observer detects forged evidence and never turns absence into success.'),
    role('observer:loop-studio-demo-v0', 'observability_algorithm', 'Observer', 928, 474,
      'Reads the canonical snapshot, receipts, renderer manifest, budgets and timestamps independently.'),
    role('metric:loop-studio-demo-v0', 'metric', 'Metric vector', 710, 640,
      'Role coverage, relation fidelity, Built precedence, honesty, budgets and freshness.'),
    role('health:loop-studio-demo-v0', 'health', 'Health', 492, 640,
      'Derived only from fresh measured evidence; never defaulted.', { scale: 1.08 }),
    role('maintenance:loop-studio-demo-v0', 'maintenance', 'Maintenance', 274, 640,
      'Retry, inspect, suspend, recalibrate, relink, rematerialize or ask a human.'),
  ];

  const relations = [
    { source: rootId, predicate: 'IMPLEMENTED_IN', target: 'implementation:loop-studio-demo-v0' },
    { source: rootId, predicate: 'DEFINED_BY_CODE', target: 'code:loop-studio-demo-v0' },
    { source: 'code:loop-studio-demo-v0', predicate: 'IMPLEMENTED_BY', target: 'implementation:loop-studio-demo-v0' },
    { source: 'pattern:loop-studio-demo-v0', predicate: 'JUSTIFIED_BY', target: 'justification:loop-studio-demo-v0' },
    { source: 'behavior:loop-studio-demo-v0', predicate: 'VALIDATED_BY', target: 'validation:loop-studio-demo-v0' },
    { source: 'implementation:loop-studio-demo-v0', predicate: 'OBSERVED_BY', target: 'observer:loop-studio-demo-v0' },
    { source: 'observer:loop-studio-demo-v0', predicate: 'PRODUCES', target: 'metric:loop-studio-demo-v0' },
    { source: 'metric:loop-studio-demo-v0', predicate: 'FEEDS', target: 'health:loop-studio-demo-v0' },
    { source: 'objective:loop-studio-demo-v0', predicate: 'SUPPORTS', target: rootId },
    { source: 'observer:loop-studio-demo-v0', predicate: 'VALIDATED_BY', target: 'validation:loop-studio-observer-v0' },
    { source: 'health:loop-studio-demo-v0', predicate: 'SUPPORTS', target: 'maintenance:loop-studio-demo-v0' },
  ];

  return {
    schema: 'mind.loop_studio.document.v0',
    id: rootId,
    nodes,
    relations,
    runtimeMoments: [],
    rendererManifest: {
      primitives: ['panel', 'wire', 'socket', 'label', 'pulse'],
      allowedPrimitives: ['panel', 'wire', 'socket', 'label', 'pulse'],
      falseEnergyDisplays: 0,
      unmeasuredSignalsRendered: 0,
      drawCalls: 64,
      drawCallBudget: 120,
    },
    observation: {
      executionStatus: 'not_run',
      evidenceComplete: false,
      observedAt: null,
      ttlSeconds: 300,
      hardFailures: [],
      failureFront: null,
    },
    scenario: 'not_measured',
    selectedNodeId: rootId,
    history: [],
  };
}

export function deriveHealth(input) {
  if (input.observerExecution === 'failure') return 'measurement_failed';
  if (!input.requiredMeasurementsExecuted) return 'not_measured';
  if (!input.evidenceComplete) return 'unknown';
  if (input.evidenceAgeSeconds > input.ttlSeconds) return 'stale';
  if (input.hardFailureCount > 0 || !input.allThresholdsPass) return 'degraded';
  return 'healthy';
}

function nodeMap(loop) {
  return new Map(loop.nodes.map((node) => [node.id, node]));
}

function updateNode(loop, id, patch) {
  const node = loop.nodes.find((candidate) => candidate.id === id);
  if (node) Object.assign(node, patch);
}

function resetRuntime(loop) {
  loop.runtimeMoments = [];
  loop.observation = {
    executionStatus: 'not_run',
    evidenceComplete: false,
    observedAt: null,
    ttlSeconds: 300,
    hardFailures: [],
    failureFront: null,
  };
  for (const node of loop.nodes) {
    node.health = 'not_measured';
    node.evidenceRefs = [];
  }
}

export function applyScenario(loop, scenario) {
  resetRuntime(loop);
  loop.scenario = scenario;
  loop.rendererManifest.falseEnergyDisplays = 0;
  loop.rendererManifest.unmeasuredSignalsRendered = 0;
  loop.rendererManifest.primitives = [...loop.rendererManifest.allowedPrimitives];
  loop.rendererManifest.drawCalls = 64;

  switch (scenario) {
    case 'observer_failure':
      loop.observation.executionStatus = 'failure';
      loop.observation.failureFront = 'observer:loop-studio-demo-v0';
      updateNode(loop, 'observer:loop-studio-demo-v0', { health: 'measurement_failed', epistemic: 'measurement_failed' });
      updateNode(loop, 'metric:loop-studio-demo-v0', { health: 'not_measured', epistemic: 'not_measured' });
      updateNode(loop, 'health:loop-studio-demo-v0', { health: 'measurement_failed', epistemic: 'measurement_failed' });
      updateNode(loop, 'implementation:loop-studio-demo-v0', { health: 'unknown', epistemic: 'unknown' });
      break;
    case 'stale':
      loop.observation.executionStatus = 'success';
      loop.observation.evidenceComplete = true;
      loop.observation.observedAt = new Date(Date.now() - 900_000).toISOString();
      break;
    case 'degraded':
      loop.observation.executionStatus = 'success';
      loop.observation.evidenceComplete = true;
      loop.observation.observedAt = nowIso();
      loop.observation.hardFailures = ['forbidden_primitive'];
      loop.observation.failureFront = 'renderer_manifest';
      loop.rendererManifest.primitives.push('forbidden:glow-orb');
      break;
    case 'unknown':
      loop.observation.executionStatus = 'success';
      loop.observation.evidenceComplete = false;
      loop.observation.observedAt = nowIso();
      loop.observation.failureFront = 'evidence_bundle';
      break;
    case 'built_precedence': {
      const implementation = loop.nodes.find((node) => node.subtype === 'implementation');
      implementation.derivedPosition = { x: 120, y: 700, source: 'Derived' };
      loop.observation.executionStatus = 'success';
      loop.observation.evidenceComplete = true;
      loop.observation.observedAt = nowIso();
      break;
    }
    case 'unmeasured_energy':
      loop.observation.executionStatus = 'success';
      loop.observation.evidenceComplete = true;
      loop.observation.observedAt = nowIso();
      loop.rendererManifest.unmeasuredSignalsRendered = 0;
      break;
    case 'healthy':
      loop.observation.executionStatus = 'success';
      loop.observation.evidenceComplete = true;
      loop.observation.observedAt = nowIso();
      break;
    case 'not_measured':
    default:
      break;
  }

  return loop;
}

export function validateStructure(loop) {
  const roleSet = new Set(loop.nodes.map((node) => node.subtype));
  const relationSet = new Set(loop.relations.map((relation) => relation.predicate));
  const root = loop.nodes.find((node) => node.id === loop.id);
  const missingRoles = REQUIRED_ROLE_SUBTYPES.filter((roleSubtype) => !roleSet.has(roleSubtype));
  const missingRelations = REQUIRED_RELATIONS.filter((predicate) => !relationSet.has(predicate));
  const parentScope = root?.content?.parent_scope;
  const validScope = Boolean(
    parentScope &&
    ['root_loop', 'standalone', 'shared', 'parent'].includes(parentScope.classification) &&
    (parentScope.classification !== 'standalone' || parentScope.justification)
  );
  const precreatedMoments = loop.runtimeMoments.filter((moment) => !moment.producedByExecution);

  return {
    passed: missingRoles.length === 0 && missingRelations.length === 0 && validScope && precreatedMoments.length === 0,
    missingRoles,
    missingRelations,
    validScope,
    precreatedMomentCount: precreatedMoments.length,
  };
}

export function runObserver(loop, validationRun) {
  const nodeById = nodeMap(loop);
  const roleSet = new Set(loop.nodes.map((node) => node.subtype));
  const relationSet = new Set(loop.relations.map((relation) => relation.predicate));
  const builtPrecedenceViolations = loop.nodes.filter((node) =>
    node.derivedPosition && node.position?.source !== 'Built'
  ).length;
  const forbiddenPrimitives = loop.rendererManifest.primitives.filter(
    (primitive) => !loop.rendererManifest.allowedPrimitives.includes(primitive)
  );
  const evidenceAgeSeconds = loop.observation.observedAt
    ? Math.max(0, (Date.now() - Date.parse(loop.observation.observedAt)) / 1000)
    : null;

  const metrics = {
    role_coverage_ratio: roleSet.size === 0
      ? 0
      : REQUIRED_ROLE_SUBTYPES.filter((subtype) => roleSet.has(subtype)).length / REQUIRED_ROLE_SUBTYPES.length,
    relation_fidelity_ratio: REQUIRED_RELATIONS.filter((predicate) => relationSet.has(predicate)).length / REQUIRED_RELATIONS.length,
    built_precedence_violations: builtPrecedenceViolations,
    unmeasured_signal_honesty_ratio: loop.rendererManifest.unmeasuredSignalsRendered === 0 ? 1 : 0,
    false_energy_display_rate: loop.rendererManifest.falseEnergyDisplays,
    primitive_compliance_ratio: loop.rendererManifest.primitives.length === 0
      ? 1
      : (loop.rendererManifest.primitives.length - forbiddenPrimitives.length) / loop.rendererManifest.primitives.length,
    draw_call_budget_compliance: loop.rendererManifest.drawCalls <= loop.rendererManifest.drawCallBudget ? 1 : 0,
    evidence_freshness_seconds: evidenceAgeSeconds,
    validation_passed: validationRun.passed ? 1 : 0,
  };

  const hardFailures = [...loop.observation.hardFailures];
  if (!validationRun.passed) hardFailures.push('structural_validation_failed');
  if (builtPrecedenceViolations > 0) hardFailures.push('built_precedence_violation');
  if (forbiddenPrimitives.length > 0 && !hardFailures.includes('forbidden_primitive')) {
    hardFailures.push('forbidden_primitive');
  }
  if (metrics.unmeasured_signal_honesty_ratio < 1) hardFailures.push('unmeasured_signal_fabrication');
  if (metrics.false_energy_display_rate > 0) hardFailures.push('false_energy_display');
  if (metrics.draw_call_budget_compliance < 1) hardFailures.push('render_budget_exceeded');

  const allThresholdsPass = Object.entries(metrics).every(([name, value]) => {
    if (name === 'evidence_freshness_seconds') return true;
    if (name.includes('violations') || name.includes('rate')) return value === 0 || name === 'false_energy_display_rate';
    return value === 1;
  }) && metrics.false_energy_display_rate === 0;

  const executionStatus = loop.observation.executionStatus;
  const requiredMeasurementsExecuted = executionStatus !== 'not_run';
  const observerRun = {
    id: `observer-run:${crypto.randomUUID()}`,
    subtype: 'observer_run',
    producedByExecution: true,
    producedAt: nowIso(),
    executionStatus,
    evidenceRefs: [
      'canonical:loop-snapshot',
      'renderer:manifest',
      'runtime:validation-run',
    ],
    metrics,
    hardFailures,
    failureFront: loop.observation.failureFront || hardFailures[0] || null,
  };

  const health = deriveHealth({
    observerExecution: executionStatus,
    requiredMeasurementsExecuted,
    evidenceComplete: loop.observation.evidenceComplete,
    evidenceAgeSeconds: evidenceAgeSeconds ?? Number.POSITIVE_INFINITY,
    ttlSeconds: loop.observation.ttlSeconds,
    hardFailureCount: hardFailures.length,
    allThresholdsPass,
  });

  return { observerRun, health, allThresholdsPass, hardFailures, nodeById };
}

export function executeProof(loop) {
  const structure = validateStructure(loop);
  const validationRun = {
    id: `validation-run:${crypto.randomUUID()}`,
    subtype: 'validation_run',
    producedByExecution: true,
    producedAt: nowIso(),
    passed: structure.passed,
    results: structure,
    evidenceRefs: ['canonical:loop-snapshot'],
  };
  loop.runtimeMoments.push(validationRun);

  const observed = runObserver(loop, validationRun);
  loop.runtimeMoments.push(observed.observerRun);

  const healthAssessment = {
    id: `health-assessment:${crypto.randomUUID()}`,
    subtype: 'health_assessment',
    producedByExecution: true,
    producedAt: nowIso(),
    observerRunRef: observed.observerRun.id,
    validationRunRef: validationRun.id,
    derivedState: observed.health,
    freshUntil: loop.observation.observedAt
      ? new Date(Date.parse(loop.observation.observedAt) + loop.observation.ttlSeconds * 1000).toISOString()
      : null,
    failureFront: observed.observerRun.failureFront,
    metricVector: observed.observerRun.metrics,
    evidenceRefs: observed.observerRun.evidenceRefs,
  };
  loop.runtimeMoments.push(healthAssessment);

  for (const node of loop.nodes) {
    if (node.subtype === 'health') {
      node.health = observed.health;
      node.epistemic = observed.health === 'not_measured'
        ? 'not_measured'
        : observed.health === 'measurement_failed'
          ? 'measurement_failed'
          : 'measured';
      node.evidenceRefs = [healthAssessment.id];
    } else if (node.subtype === 'metric') {
      node.health = observed.health === 'measurement_failed' ? 'not_measured' : observed.health;
      node.epistemic = observed.health === 'measurement_failed' ? 'not_measured' : 'measured';
      node.evidenceRefs = [observed.observerRun.id];
    } else if (node.subtype === 'observability_algorithm') {
      node.health = loop.observation.executionStatus === 'failure' ? 'measurement_failed' : observed.health;
      node.epistemic = loop.observation.executionStatus === 'failure' ? 'measurement_failed' : 'observed';
      node.evidenceRefs = [observed.observerRun.id];
    } else if (node.subtype === 'implementation' && observed.health === 'measurement_failed') {
      node.health = 'unknown';
      node.epistemic = 'unknown';
    } else {
      node.health = observed.health;
      node.evidenceRefs = [validationRun.id];
    }
  }

  loop.history.push({
    at: nowIso(),
    action: 'prove',
    result: observed.health,
    failureFront: observed.observerRun.failureFront,
  });

  return { validationRun, observerRun: observed.observerRun, healthAssessment };
}

export function applyMaintenance(loop, action) {
  switch (action) {
    case 'retry_observer':
      loop.observation.executionStatus = 'success';
      loop.observation.evidenceComplete = true;
      loop.observation.observedAt = nowIso();
      loop.observation.hardFailures = [];
      loop.observation.failureFront = null;
      loop.rendererManifest.primitives = [...loop.rendererManifest.allowedPrimitives];
      return executeProof(loop);
    case 'suspend_modulation':
      loop.rendererManifest.falseEnergyDisplays = 0;
      loop.rendererManifest.unmeasuredSignalsRendered = 0;
      break;
    case 'recalibrate':
      loop.rendererManifest.drawCalls = Math.min(loop.rendererManifest.drawCalls, loop.rendererManifest.drawCallBudget);
      break;
    case 'relink':
      loop.observation.hardFailures = loop.observation.hardFailures.filter((failure) => failure !== 'missing_semantic_type');
      break;
    case 'rematerialize':
      loop.rendererManifest.primitives = [...loop.rendererManifest.allowedPrimitives];
      loop.observation.hardFailures = loop.observation.hardFailures.filter((failure) => failure !== 'forbidden_primitive');
      break;
    case 'restore_built':
      for (const node of loop.nodes) {
        node.derivedPosition = null;
        if (node.position) node.position.source = 'Built';
      }
      break;
    default:
      throw new Error(`Unknown maintenance action: ${action}`);
  }
  loop.history.push({ at: nowIso(), action, result: 'applied' });
  return null;
}

export function serializeLoop(loop) {
  return JSON.stringify(loop, null, 2);
}
