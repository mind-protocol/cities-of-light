import { HEALTH_STATES } from './loop-studio-core.js';

export const PHYSICAL_PRIMITIVES = Object.freeze([
  'mesh',
  'shell',
  'ring',
  'bar',
  'socket',
  'fracture',
  'marker',
]);

export const ROLE_ARCHETYPES = Object.freeze({
  physicalization_toolkit: {
    id: 'loop-container',
    basePrimitive: 'mesh',
    geometry: 'dodecahedron',
    semanticCue: 'contains and coordinates the complete loop',
  },
  objective: {
    id: 'target-core',
    basePrimitive: 'ring',
    geometry: 'target',
    semanticCue: 'observable destination and success boundary',
  },
  pattern: {
    id: 'structural-frame',
    basePrimitive: 'shell',
    geometry: 'frame',
    semanticCue: 'stable architectural form',
  },
  vocabulary: {
    id: 'lexicon-stack',
    basePrimitive: 'bar',
    geometry: 'stack',
    semanticCue: 'ordered distinctions and shared terms',
  },
  behavior: {
    id: 'promise-gate',
    basePrimitive: 'ring',
    geometry: 'gate',
    semanticCue: 'externally observable input-output promise',
  },
  algorithm: {
    id: 'causal-sequencer',
    basePrimitive: 'bar',
    geometry: 'sequencer',
    semanticCue: 'ordered transformation and decision flow',
  },
  code: {
    id: 'executable-core',
    basePrimitive: 'mesh',
    geometry: 'icosahedron',
    semanticCue: 'canonical executable definition',
  },
  implementation: {
    id: 'materialized-machine',
    basePrimitive: 'mesh',
    geometry: 'machine',
    semanticCue: 'current physical realization',
  },
  justification: {
    id: 'load-bearing-support',
    basePrimitive: 'bar',
    geometry: 'support',
    semanticCue: 'reason the mechanism can bear the objective',
  },
  validation: {
    id: 'test-rig',
    basePrimitive: 'ring',
    geometry: 'test-rig',
    semanticCue: 'challenge boundary and negative fixture',
  },
  observability_algorithm: {
    id: 'independent-probe',
    basePrimitive: 'socket',
    geometry: 'probe',
    semanticCue: 'independent access to real evidence',
  },
  metric: {
    id: 'instrument-array',
    basePrimitive: 'bar',
    geometry: 'instrument-array',
    semanticCue: 'vector of measured dimensions',
  },
  health: {
    id: 'diagnostic-core',
    basePrimitive: 'mesh',
    geometry: 'sphere',
    semanticCue: 'living state derived from fresh evidence',
  },
  maintenance: {
    id: 'repair-kit',
    basePrimitive: 'mesh',
    geometry: 'octahedron',
    semanticCue: 'available causal repair affordances',
  },
});

export const HEALTH_MODULATIONS = Object.freeze({
  healthy: {
    shellMode: 'solid',
    integrity: 1,
    saturation: 1,
    opacityFactor: 1,
    motionFactor: 1,
    interiorVisibility: 1,
    tilt: 0,
    additions: [],
  },
  degraded: {
    shellMode: 'double',
    integrity: 0.72,
    saturation: 0.82,
    opacityFactor: 1,
    motionFactor: 0.45,
    interiorVisibility: 1,
    tilt: 0.08,
    additions: ['stress-band'],
  },
  stale: {
    shellMode: 'solid',
    integrity: 1,
    saturation: 0.34,
    opacityFactor: 0.82,
    motionFactor: 0,
    interiorVisibility: 1,
    tilt: 0,
    additions: ['age-ring'],
  },
  unknown: {
    shellMode: 'wire',
    integrity: 1,
    saturation: 0.48,
    opacityFactor: 0.52,
    motionFactor: 0,
    interiorVisibility: 0,
    tilt: 0,
    additions: ['unresolved-shell'],
  },
  not_measured: {
    shellMode: 'dashed',
    integrity: 1,
    saturation: 0.56,
    opacityFactor: 0.72,
    motionFactor: 0,
    interiorVisibility: 0.35,
    tilt: 0,
    additions: ['empty-socket'],
  },
  measurement_failed: {
    shellMode: 'broken',
    integrity: 0.34,
    saturation: 0.9,
    opacityFactor: 0.88,
    motionFactor: 0,
    interiorVisibility: 0.55,
    tilt: 0.16,
    additions: ['fracture', 'failure-marker'],
  },
});

const DEFAULT_VISUAL = Object.freeze({
  scale: 1,
  roundness: 18,
  shell: 1,
  emission: 0,
  pulse: 0,
  opacity: 1,
});

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizedVisual(visual = {}) {
  return {
    scale: clamp(finiteOr(visual.scale, DEFAULT_VISUAL.scale), 0.5, 2),
    roundness: clamp(finiteOr(visual.roundness, DEFAULT_VISUAL.roundness), 0, 80),
    shell: clamp(finiteOr(visual.shell, DEFAULT_VISUAL.shell), 0.1, 8),
    emission: clamp(finiteOr(visual.emission, DEFAULT_VISUAL.emission), 0, 1),
    pulse: clamp(finiteOr(visual.pulse, DEFAULT_VISUAL.pulse), 0, 4),
    opacity: clamp(finiteOr(visual.opacity, DEFAULT_VISUAL.opacity), 0.05, 1),
  };
}

function resolveEnergy(node) {
  const energy = node.signals?.energy;
  if (!energy) {
    return {
      epistemic: 'not_measured',
      value: null,
      normalized: 0,
      signalEmission: 0,
    };
  }

  if (energy.epistemic !== 'measured' || !Number.isFinite(energy.value)) {
    return {
      epistemic: energy.epistemic ?? 'unknown',
      value: null,
      normalized: 0,
      signalEmission: 0,
    };
  }

  const minimum = Number.isFinite(energy.minimum) ? energy.minimum : 0;
  const maximum = Number.isFinite(energy.maximum) && energy.maximum > minimum
    ? energy.maximum
    : Math.max(minimum + 1, energy.value);
  const normalized = clamp((energy.value - minimum) / (maximum - minimum), 0, 1);

  return {
    epistemic: 'measured',
    value: energy.value,
    normalized,
    signalEmission: normalized,
  };
}

function roleArchetype(subtype) {
  return ROLE_ARCHETYPES[subtype] ?? {
    id: 'generic-semantic-object',
    basePrimitive: 'mesh',
    geometry: 'sphere',
    semanticCue: 'generic semantic identity',
  };
}

function statusPrimitives(modulation) {
  return modulation.additions.map((addition) => {
    if (addition.includes('ring') || addition === 'stress-band') return 'ring';
    if (addition === 'empty-socket') return 'socket';
    if (addition === 'fracture') return 'fracture';
    if (addition === 'failure-marker') return 'marker';
    return 'shell';
  });
}

export function compileNodeVisualPlan(node, { previewHealth = null } = {}) {
  if (!node || typeof node !== 'object') throw new Error('A semantic node is required');

  const health = previewHealth ?? node.health ?? 'not_measured';
  if (!HEALTH_STATES.includes(health)) throw new Error(`Unknown health state: ${health}`);

  const archetype = roleArchetype(node.subtype);
  const visual = normalizedVisual(node.visual);
  const modulation = HEALTH_MODULATIONS[health];
  const energy = resolveEnergy(node);
  const position = node.position?.source === 'Built'
    ? { ...node.position }
    : node.position
      ? { ...node.position, source: node.position.source ?? 'Derived' }
      : { x: 0, y: 0, source: 'IdentityDefault' };
  const primitives = [archetype.basePrimitive, 'shell', ...statusPrimitives(modulation)];

  return {
    semanticTarget: node.id,
    role: node.subtype,
    health,
    epistemic: node.epistemic ?? 'unknown',
    identity: {
      archetypeId: archetype.id,
      geometry: archetype.geometry,
      semanticCue: archetype.semanticCue,
    },
    transform: {
      position,
      scale: visual.scale,
      tilt: modulation.tilt,
    },
    material: {
      shellThickness: visual.shell,
      roundness: visual.roundness,
      opacity: clamp(visual.opacity * modulation.opacityFactor, 0.05, 1),
      saturation: modulation.saturation,
      shellMode: modulation.shellMode,
      aestheticEmission: visual.emission,
      signalEmission: energy.signalEmission,
    },
    dynamics: {
      authoredPulse: visual.pulse,
      effectivePulse: visual.pulse * modulation.motionFactor,
      motionFactor: modulation.motionFactor,
    },
    structure: {
      integrity: modulation.integrity,
      interiorVisibility: modulation.interiorVisibility,
      additions: [...modulation.additions],
    },
    protectedChannels: {
      energy: {
        epistemic: energy.epistemic,
        measuredValue: energy.value,
        normalizedValue: energy.normalized,
        signalEmission: energy.signalEmission,
        invariant: 'signalEmission is zero unless energy is measured',
      },
      authoredEmission: {
        value: visual.emission,
        semanticClaim: 'aesthetic only; never evidence of measured energy',
      },
    },
    primitives,
    estimatedDrawCalls: new Set(primitives).size,
    justifications: [
      `${archetype.geometry} preserves the ${node.subtype} identity`,
      `${health} applies ${modulation.shellMode} status modulation without replacing identity`,
      energy.epistemic === 'measured'
        ? 'signal emission is derived from measured energy'
        : `signal emission remains zero because energy is ${energy.epistemic}`,
      `${position.source} position is preserved as the spatial authority`,
    ],
  };
}

export function compileLoopVisualManifest(loop, options = {}) {
  if (!loop || !Array.isArray(loop.nodes)) throw new Error('A loop snapshot with nodes is required');

  const plans = loop.nodes.map((node) => compileNodeVisualPlan(node, {
    previewHealth: options.previewHealthByNode?.[node.id] ?? null,
  }));
  const primitiveCounts = Object.fromEntries(PHYSICAL_PRIMITIVES.map((primitive) => [primitive, 0]));
  let estimatedDrawCalls = 0;
  let unmeasuredSignalEmissionViolations = 0;
  let builtPrecedenceViolations = 0;

  for (const plan of plans) {
    estimatedDrawCalls += plan.estimatedDrawCalls;
    for (const primitive of plan.primitives) {
      primitiveCounts[primitive] = (primitiveCounts[primitive] ?? 0) + 1;
    }
    if (plan.protectedChannels.energy.epistemic !== 'measured' && plan.material.signalEmission !== 0) {
      unmeasuredSignalEmissionViolations += 1;
    }

    const sourceNode = loop.nodes.find((node) => node.id === plan.semanticTarget);
    if (sourceNode?.derivedPosition && plan.transform.position.source !== 'Built') {
      builtPrecedenceViolations += 1;
    }
  }

  const drawCallBudget = loop.rendererManifest?.drawCallBudget ?? 120;
  const forbiddenPrimitives = Object.keys(primitiveCounts)
    .filter((primitive) => !PHYSICAL_PRIMITIVES.includes(primitive));

  return {
    schema: 'mind.visual_physicalization_manifest.v0',
    loopId: loop.id,
    plans,
    primitiveCounts,
    estimatedDrawCalls,
    drawCallBudget,
    budgetCompliant: estimatedDrawCalls <= drawCallBudget,
    forbiddenPrimitives,
    unmeasuredSignalEmissionViolations,
    builtPrecedenceViolations,
    health: {
      primitiveCompliance: forbiddenPrimitives.length === 0,
      energyHonesty: unmeasuredSignalEmissionViolations === 0,
      builtPrecedence: builtPrecedenceViolations === 0,
      budgetCompliance: estimatedDrawCalls <= drawCallBudget,
    },
  };
}
