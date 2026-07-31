import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyScenario,
  createInitialLoop,
  deriveHealth,
  executeProof,
  validateStructure,
} from './loop-studio-core.js';

test('fresh complete evidence derives healthy', () => {
  assert.equal(deriveHealth({
    observerExecution: 'success',
    requiredMeasurementsExecuted: true,
    evidenceComplete: true,
    evidenceAgeSeconds: 2,
    ttlSeconds: 300,
    hardFailureCount: 0,
    allThresholdsPass: true,
  }), 'healthy');
});

test('observer failure does not claim implementation degradation', () => {
  const loop = createInitialLoop();
  applyScenario(loop, 'observer_failure');
  const proof = executeProof(loop);
  assert.equal(proof.healthAssessment.derivedState, 'measurement_failed');
  const implementation = loop.nodes.find((node) => node.subtype === 'implementation');
  assert.equal(implementation.health, 'unknown');
});

test('stale proof can never remain healthy', () => {
  const loop = createInitialLoop();
  applyScenario(loop, 'stale');
  const proof = executeProof(loop);
  assert.equal(proof.healthAssessment.derivedState, 'stale');
});

test('built position beats derived proposal', () => {
  const loop = createInitialLoop();
  applyScenario(loop, 'built_precedence');
  const implementation = loop.nodes.find((node) => node.subtype === 'implementation');
  const built = { ...implementation.position };
  executeProof(loop);
  assert.deepEqual(implementation.position, built);
  const assessment = loop.runtimeMoments.find((moment) => moment.subtype === 'health_assessment');
  assert.equal(assessment.metricVector.built_precedence_violations, 0);
});

test('runtime moments are not pre-created and structure is complete', () => {
  const loop = createInitialLoop();
  assert.equal(loop.runtimeMoments.length, 0);
  assert.equal(validateStructure(loop).passed, true);
});

test('forbidden primitive is independently detected as degraded', () => {
  const loop = createInitialLoop();
  applyScenario(loop, 'degraded');
  const proof = executeProof(loop);
  assert.equal(proof.healthAssessment.derivedState, 'degraded');
  assert.equal(proof.healthAssessment.failureFront, 'renderer_manifest');
});
