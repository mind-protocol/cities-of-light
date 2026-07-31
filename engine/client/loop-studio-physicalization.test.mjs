import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALLOWED_VISUAL_PRIMITIVES,
  PHYSICALIZATION_STATUSES,
  compilePhysicalizationManifest,
  compilePhysicalizationPlan,
} from './loop-studio-physicalization.js';

const node = {
  id: 'health:test',
  subtype: 'health',
  lifecycle: 'materialized',
  epistemic: 'measured',
  visual: {
    scale: 1.2,
    roundness: 24,
    shell: 1.8,
    emission: 0.9,
    pulse: 1.4,
    opacity: 0.95,
  },
};

test('all six states preserve one semantic archetype', () => {
  const manifest = compilePhysicalizationManifest(node);
  assert.deepEqual(manifest.statuses, PHYSICALIZATION_STATUSES);
  assert.equal(manifest.observerClaims.identityStableAcrossStatuses, true);
  assert.ok(manifest.plans.every((plan) => plan.archetype === 'diagnostic-core'));
});

test('not measured never fabricates emission or activity', () => {
  const plan = compilePhysicalizationPlan(node, 'not_measured');
  const core = plan.primitives.find((primitive) => primitive.role === 'semantic_core');

  assert.equal(plan.statusModulation.emission, 0);
  assert.equal(core.material.emission, 0);
  assert.equal(core.properties.visible, false);
  assert.equal(core.properties.pulse, 0);
  assert.equal(plan.invariants.unmeasuredEmission, 0);
});

test('measurement failure localizes a broken evidence path', () => {
  const plan = compilePhysicalizationPlan(node, 'measurement_failed');
  const connector = plan.primitives.find((primitive) => primitive.role === 'evidence_path');
  const marker = plan.primitives.find((primitive) => primitive.role === 'failure_front');

  assert.equal(connector.properties.broken, true);
  assert.equal(connector.properties.continuity, 0);
  assert.equal(marker.properties.localized, true);
});

test('renderer manifest contains only allowed primitives', () => {
  const manifest = compilePhysicalizationManifest(node);
  assert.equal(manifest.observerClaims.primitivesAllowed, true);
  assert.ok(manifest.primitiveTypes.every((type) => ALLOWED_VISUAL_PRIMITIVES.includes(type)));
});

test('unknown remains identifiable without looking measured', () => {
  const plan = compilePhysicalizationPlan(node, 'unknown');
  const shell = plan.primitives.find((primitive) => primitive.role === 'semantic_identity');
  const core = plan.primitives.find((primitive) => primitive.role === 'semantic_core');

  assert.equal(plan.invariants.identityPreserved, true);
  assert.equal(shell.material.wireframe, true);
  assert.ok(shell.material.opacity > core.material.opacity);
  assert.equal(core.material.emission, 0);
});

test('visual inputs are bounded before reaching the renderer', () => {
  const unbounded = {
    ...node,
    visual: { scale: 99, roundness: -8, shell: 0, emission: 4, pulse: 20, opacity: -1 },
  };
  const plan = compilePhysicalizationPlan(unbounded, 'healthy');

  assert.deepEqual(plan.parameters, {
    scale: 2,
    roundness: 0,
    shell: 0.1,
    emission: 1,
    pulse: 4,
    opacity: 0.05,
  });
});
