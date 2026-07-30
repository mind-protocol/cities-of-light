import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialLoop } from './loop-studio-core.js';
import {
  HEALTH_MODULATIONS,
  compileLoopVisualManifest,
  compileNodeVisualPlan,
} from './loop-physicalization-plan.js';

function node(subtype, health = 'healthy') {
  return {
    id: `${subtype}:test`,
    subtype,
    health,
    epistemic: 'observed',
    position: { x: 10, y: 20, source: 'Built' },
    derivedPosition: null,
    visual: {
      scale: 1,
      roundness: 18,
      shell: 1,
      emission: 0.6,
      pulse: 1.2,
      opacity: 1,
    },
  };
}

test('health modulation preserves role identity', () => {
  const semantic = node('observability_algorithm');
  const healthy = compileNodeVisualPlan(semantic, { previewHealth: 'healthy' });
  const failed = compileNodeVisualPlan(semantic, { previewHealth: 'measurement_failed' });

  assert.equal(healthy.identity.archetypeId, 'independent-probe');
  assert.equal(failed.identity.archetypeId, healthy.identity.archetypeId);
  assert.notEqual(failed.material.shellMode, healthy.material.shellMode);
  assert.ok(failed.structure.additions.includes('fracture'));
});

test('unknown state hides interior without deleting identity', () => {
  const plan = compileNodeVisualPlan(node('health', 'unknown'));

  assert.equal(plan.identity.archetypeId, 'diagnostic-core');
  assert.equal(plan.structure.interiorVisibility, 0);
  assert.equal(plan.material.shellMode, 'wire');
});

test('unmeasured energy never creates signal emission', () => {
  const semantic = node('implementation');
  semantic.signals = {
    energy: { epistemic: 'not_measured', value: 100 },
  };

  const plan = compileNodeVisualPlan(semantic);

  assert.equal(plan.material.aestheticEmission, 0.6);
  assert.equal(plan.material.signalEmission, 0);
  assert.equal(plan.protectedChannels.energy.epistemic, 'not_measured');
});

test('measured energy is normalized into a protected signal channel', () => {
  const semantic = node('implementation');
  semantic.signals = {
    energy: { epistemic: 'measured', value: 75, minimum: 0, maximum: 100 },
  };

  const plan = compileNodeVisualPlan(semantic);

  assert.equal(plan.material.signalEmission, 0.75);
  assert.equal(plan.protectedChannels.energy.measuredValue, 75);
});

test('Built position remains authoritative when Derived exists', () => {
  const semantic = node('algorithm');
  semantic.derivedPosition = { x: 900, y: 900, source: 'Derived' };

  const plan = compileNodeVisualPlan(semantic);

  assert.deepEqual(plan.transform.position, { x: 10, y: 20, source: 'Built' });
  assert.match(plan.justifications.at(-1), /Built/);
});

test('loop manifest measures budgets and protected-channel honesty', () => {
  const loop = createInitialLoop();
  loop.rendererManifest.drawCallBudget = 500;
  loop.nodes[0].signals = {
    energy: { epistemic: 'not_measured', value: 999 },
  };

  const manifest = compileLoopVisualManifest(loop);

  assert.equal(manifest.budgetCompliant, true);
  assert.equal(manifest.unmeasuredSignalEmissionViolations, 0);
  assert.equal(manifest.builtPrecedenceViolations, 0);
  assert.equal(manifest.health.energyHonesty, true);
  assert.equal(manifest.plans.length, loop.nodes.length);
});

test('all six health states have explicit non-color modulation', () => {
  const expected = [
    'healthy',
    'degraded',
    'stale',
    'unknown',
    'not_measured',
    'measurement_failed',
  ];

  for (const state of expected) {
    assert.ok(HEALTH_MODULATIONS[state]);
    assert.equal(typeof HEALTH_MODULATIONS[state].shellMode, 'string');
    assert.equal(typeof HEALTH_MODULATIONS[state].motionFactor, 'number');
  }
});
