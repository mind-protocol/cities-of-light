export const PHYSICALIZATION_STATUSES = Object.freeze([
  'healthy',
  'degraded',
  'stale',
  'unknown',
  'not_measured',
  'measurement_failed',
]);

export const ALLOWED_VISUAL_PRIMITIVES = Object.freeze([
  'sphere',
  'box',
  'cylinder',
  'torus',
  'icosahedron',
  'octahedron',
  'line',
  'ring',
  'shell',
  'connector',
  'socket',
]);

export const ROLE_ARCHETYPES = Object.freeze({
  physicalization_toolkit: { id: 'workbench', core: 'icosahedron' },
  objective: { id: 'beacon', core: 'sphere' },
  pattern: { id: 'lattice', core: 'icosahedron' },
  vocabulary: { id: 'lexicon', core: 'box' },
  behavior: { id: 'gate', core: 'torus' },
  algorithm: { id: 'sequencer', core: 'cylinder' },
  code: { id: 'blueprint', core: 'octahedron' },
  implementation: { id: 'machine', core: 'box' },
  justification: { id: 'foundation', core: 'cylinder' },
  validation: { id: 'test-rig', core: 'octahedron' },
  observability_algorithm: { id: 'probe', core: 'torus' },
  metric: { id: 'instrument-array', core: 'cylinder' },
  health: { id: 'diagnostic-core', core: 'sphere' },
  maintenance: { id: 'repair-dock', core: 'box' },
});

const STATUS_MODULATIONS = Object.freeze({
  healthy: {
    coreVisible: true,
    coreOpacity: 1,
    shellOpacity: 0.4,
    shellWireframe: false,
    emissionFactor: 1,
    motionFactor: 1,
    continuity: 1,
    tilt: 0,
    patina: 0,
    socket: false,
    failureMarker: false,
  },
  degraded: {
    coreVisible: true,
    coreOpacity: 0.82,
    shellOpacity: 0.34,
    shellWireframe: false,
    emissionFactor: 0.45,
    motionFactor: 0.42,
    continuity: 0.55,
    tilt: 0.16,
    patina: 0.2,
    socket: false,
    failureMarker: true,
  },
  stale: {
    coreVisible: true,
    coreOpacity: 0.7,
    shellOpacity: 0.26,
    shellWireframe: false,
    emissionFactor: 0.08,
    motionFactor: 0,
    continuity: 0.8,
    tilt: 0,
    patina: 0.9,
    socket: false,
    failureMarker: false,
  },
  unknown: {
    coreVisible: true,
    coreOpacity: 0.14,
    shellOpacity: 0.58,
    shellWireframe: true,
    emissionFactor: 0,
    motionFactor: 0.15,
    continuity: 0.28,
    tilt: 0,
    patina: 0,
    socket: false,
    failureMarker: false,
  },
  not_measured: {
    coreVisible: false,
    coreOpacity: 0,
    shellOpacity: 0.55,
    shellWireframe: true,
    emissionFactor: 0,
    motionFactor: 0,
    continuity: 0,
    tilt: 0,
    patina: 0,
    socket: true,
    failureMarker: false,
  },
  measurement_failed: {
    coreVisible: true,
    coreOpacity: 0.22,
    shellOpacity: 0.48,
    shellWireframe: true,
    emissionFactor: 0,
    motionFactor: 0,
    continuity: 0,
    tilt: -0.2,
    patina: 0,
    socket: true,
    failureMarker: true,
  },
});

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizedVisual(node) {
  const visual = node?.visual ?? {};
  return {
    scale: clamp(finiteOr(visual.scale, 1), 0.5, 2),
    roundness: clamp(finiteOr(visual.roundness, 12), 0, 80),
    shell: clamp(finiteOr(visual.shell, 1), 0.1, 8),
    emission: clamp(finiteOr(visual.emission, 0), 0, 1),
    pulse: clamp(finiteOr(visual.pulse, 0), 0, 4),
    opacity: clamp(finiteOr(visual.opacity, 1), 0.05, 1),
  };
}

function primitive(id, type, role, overrides = {}) {
  if (!ALLOWED_VISUAL_PRIMITIVES.includes(type)) {
    throw new Error(`Forbidden visual primitive: ${type}`);
  }
  return {
    id,
    type,
    role,
    transform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      ...(overrides.transform ?? {}),
    },
    material: {
      opacity: 1,
      emission: 0,
      wireframe: false,
      patina: 0,
      ...(overrides.material ?? {}),
    },
    ...(overrides.properties ? { properties: overrides.properties } : {}),
  };
}

export function compilePhysicalizationPlan(node, status) {
  if (!node || typeof node !== 'object') throw new Error('A semantic node is required.');
  if (!PHYSICALIZATION_STATUSES.includes(status)) throw new Error(`Unknown physicalization status: ${status}`);

  const archetype = ROLE_ARCHETYPES[node.subtype] ?? { id: 'module', core: 'box' };
  const visual = normalizedVisual(node);
  const modulation = STATUS_MODULATIONS[status];
  const provenEmission = status === 'healthy' || status === 'degraded' || status === 'stale'
    ? visual.emission * modulation.emissionFactor
    : 0;
  const coreOpacity = modulation.coreVisible
    ? visual.opacity * modulation.coreOpacity
    : 0;

  const primitives = [
    primitive('identity-shell', 'shell', 'semantic_identity', {
      transform: {
        rotation: [0, modulation.tilt, 0],
        scale: [visual.scale * 1.22, visual.scale * 1.22, visual.scale * 1.22],
      },
      material: {
        opacity: modulation.shellOpacity,
        emission: 0,
        wireframe: modulation.shellWireframe,
        patina: modulation.patina,
      },
      properties: {
        archetype: archetype.id,
        shellThickness: visual.shell,
        roundness: visual.roundness,
      },
    }),
    primitive('semantic-core', archetype.core, 'semantic_core', {
      transform: {
        rotation: [modulation.tilt * 0.5, modulation.tilt, 0],
        scale: [visual.scale, visual.scale, visual.scale],
      },
      material: {
        opacity: coreOpacity,
        emission: provenEmission,
        wireframe: false,
        patina: modulation.patina,
      },
      properties: {
        visible: modulation.coreVisible,
        pulse: visual.pulse * modulation.motionFactor,
        roundness: visual.roundness,
      },
    }),
    primitive('evidence-connector', 'connector', 'evidence_path', {
      transform: {
        position: [0, -1.28 * visual.scale, 0],
        scale: [modulation.continuity, 1, 1],
      },
      material: {
        opacity: Math.max(0.12, modulation.continuity),
        emission: provenEmission * 0.4,
      },
      properties: {
        continuity: modulation.continuity,
        broken: modulation.continuity < 0.25,
      },
    }),
  ];

  if (modulation.socket) {
    primitives.push(primitive('measurement-socket', 'socket', 'measurement_socket', {
      transform: { position: [0, 0, 0.7 * visual.scale], scale: [0.38, 0.38, 0.38] },
      material: { opacity: 0.85, wireframe: true },
      properties: { empty: status === 'not_measured' },
    }));
  }

  if (modulation.failureMarker) {
    primitives.push(primitive('failure-marker', 'line', 'failure_front', {
      transform: { rotation: [0, 0, Math.PI / 4], scale: [0.75, 0.75, 0.75] },
      material: { opacity: 0.95, emission: 0 },
      properties: { localized: true },
    }));
  }

  return {
    schema: 'mind.physicalization_plan.v0',
    semanticTarget: node.id,
    semanticRole: node.subtype,
    archetype: archetype.id,
    status,
    source: {
      kind: 'VisualDefinition',
      lifecycle: node.lifecycle ?? 'unknown',
      epistemic: node.epistemic ?? 'unknown',
    },
    parameters: visual,
    statusModulation: { ...modulation, emission: provenEmission },
    primitives,
    invariants: {
      identityPreserved: true,
      healthAuthoredByRenderer: false,
      unmeasuredEmission: status === 'not_measured' ? provenEmission : null,
      allowedPrimitiveSet: [...ALLOWED_VISUAL_PRIMITIVES],
    },
    justification: [
      `The ${archetype.id} archetype expresses semantic role ${node.subtype}.`,
      `Status ${status} modulates the archetype without replacing its identity.`,
      status === 'not_measured'
        ? 'No measured signal exists, so emission and core activity remain absent.'
        : 'Visual dynamics are bounded by the authored VisualDefinition and status contract.',
    ],
  };
}

export function compilePhysicalizationManifest(node) {
  const plans = PHYSICALIZATION_STATUSES.map((status) => compilePhysicalizationPlan(node, status));
  const primitiveTypes = [...new Set(plans.flatMap((plan) => plan.primitives.map((item) => item.type)))];
  return {
    schema: 'mind.physicalization_manifest.v0',
    semanticTarget: node.id,
    semanticRole: node.subtype,
    archetype: plans[0].archetype,
    statuses: [...PHYSICALIZATION_STATUSES],
    primitiveTypes,
    plans,
    observerClaims: {
      identityStableAcrossStatuses: plans.every((plan) => plan.archetype === plans[0].archetype),
      primitivesAllowed: primitiveTypes.every((type) => ALLOWED_VISUAL_PRIMITIVES.includes(type)),
      notMeasuredEmissionIsZero: plans.find((plan) => plan.status === 'not_measured').statusModulation.emission === 0,
      failedMeasurementHasLocalizedMarker: plans
        .find((plan) => plan.status === 'measurement_failed')
        .primitives.some((item) => item.role === 'failure_front'),
    },
  };
}
