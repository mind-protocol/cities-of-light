import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INTENT_TYPES,
  createIntent,
  createLocalLoopStudio,
  observePhysicalizationManifest,
} from './loop-studio-intents.js';
import {
  compilePhysicalizationManifest,
} from './loop-studio-physicalization.js';

const node = {
  id: 'health:loop-studio-demo-v0',
  subtype: 'health',
  lifecycle: 'materialized',
  epistemic: 'measured',
  visual: {
    scale: 1,
    roundness: 20,
    shell: 1.2,
    emission: 0.8,
    pulse: 1,
    opacity: 1,
  },
};

function observedManifest() {
  const manifest = compilePhysicalizationManifest(node);
  const materializedPrimitives = manifest.plans.flatMap((plan) =>
    plan.primitives.map((primitive) => ({
      id: primitive.id,
      type: primitive.type,
      role: primitive.role,
      status: plan.status,
      visible: primitive.properties?.visible !== false && (primitive.material?.opacity ?? 1) > 0,
    })));
  return {
    ...manifest,
    renderer: 'test-renderer-v0',
    observedAt: new Date().toISOString(),
    materializedPrimitives,
    materializedPrimitiveTypes: [...new Set(materializedPrimitives.map((primitive) => primitive.type))],
    drawCallCount: materializedPrimitives.filter((primitive) => primitive.visible).length,
  };
}

test('independent manifest observer accepts a faithful materialization', () => {
  const observed = observePhysicalizationManifest(observedManifest());

  assert.equal(observed.informationStatus, 'measured');
  assert.equal(observed.evidenceComplete, true);
  assert.equal(observed.renderedPlanParity, true);
  assert.equal(observed.completeStatusCoverage, true);
  assert.deepEqual(observed.hardFailures, []);
});

test('RunProofIntent derives healthy from fresh renderer evidence', () => {
  const studio = createLocalLoopStudio();
  const before = studio.sense();
  const receipt = studio.act(createIntent(
    INTENT_TYPES.RUN_PROOF,
    { physicalizationManifest: observedManifest() },
    before.revision,
  ));
  const sensed = studio.sense();
  const health = sensed.snapshot.nodes.find((candidate) => candidate.subtype === 'health');

  assert.equal(receipt.status, 'committed');
  assert.equal(receipt.producedMomentIds.length, 3);
  assert.equal(health.health, 'healthy');
  assert.equal(sensed.snapshot.rendererManifest.independentObservation.evidenceComplete, true);
  assert.equal(sensed.snapshot.rendererManifest.physicalizationEvidence.renderer, 'test-renderer-v0');
});

test('visible unmeasured core becomes a measured degradation', () => {
  const manifest = observedManifest();
  const unmeasuredCore = manifest.materializedPrimitives.find((primitive) =>
    primitive.status === 'not_measured' && primitive.role === 'semantic_core');
  unmeasuredCore.visible = true;

  const observed = observePhysicalizationManifest(manifest);
  assert.equal(observed.informationStatus, 'measured');
  assert.equal(observed.evidenceComplete, true);
  assert.equal(observed.unmeasuredSignalsRendered, 1);
  assert.ok(observed.hardFailures.includes('unmeasured_signal_fabrication'));

  const studio = createLocalLoopStudio();
  const receipt = studio.act(createIntent(
    INTENT_TYPES.RUN_PROOF,
    { physicalizationManifest: manifest },
    0,
  ));
  const health = studio.sense().snapshot.nodes.find((candidate) => candidate.subtype === 'health');

  assert.equal(receipt.status, 'committed');
  assert.equal(health.health, 'degraded');
});

test('missing status evidence remains unknown rather than degraded', () => {
  const manifest = observedManifest();
  manifest.plans = manifest.plans.filter((plan) => plan.status !== 'measurement_failed');
  manifest.materializedPrimitives = manifest.materializedPrimitives
    .filter((primitive) => primitive.status !== 'measurement_failed');

  const observed = observePhysicalizationManifest(manifest);
  assert.equal(observed.informationStatus, 'unknown');
  assert.equal(observed.evidenceComplete, false);
  assert.equal(observed.completeStatusCoverage, false);
  assert.ok(observed.hardFailures.includes('missing_status_physicalization'));

  const studio = createLocalLoopStudio();
  const receipt = studio.act(createIntent(
    INTENT_TYPES.RUN_PROOF,
    { physicalizationManifest: manifest },
    0,
  ));
  const health = studio.sense().snapshot.nodes.find((candidate) => candidate.subtype === 'health');

  assert.equal(receipt.status, 'committed');
  assert.equal(health.health, 'unknown');
});

test('forbidden materialized primitive is observed rather than rejected', () => {
  const manifest = observedManifest();
  manifest.materializedPrimitives.push({
    id: 'forged-orb',
    type: 'glow-orb',
    role: 'decorative_lie',
    status: 'healthy',
    visible: true,
  });

  const observed = observePhysicalizationManifest(manifest);
  assert.equal(observed.evidenceComplete, true);
  assert.ok(observed.forbiddenPrimitives.includes('glow-orb'));
  assert.ok(observed.hardFailures.includes('forbidden_primitive'));
  assert.ok(observed.hardFailures.includes('renderer_plan_mismatch'));
});

test('malformed renderer evidence is rejected before commit', () => {
  const studio = createLocalLoopStudio();
  const receipt = studio.act(createIntent(
    INTENT_TYPES.RUN_PROOF,
    { physicalizationManifest: { schema: 'wrong' } },
    0,
  ));

  assert.equal(receipt.status, 'rejected');
  assert.equal(studio.sense().revision, 0);
  assert.match(receipt.error, /Unsupported physicalization manifest schema/);
});
