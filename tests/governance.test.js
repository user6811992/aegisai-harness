const { test } = require('node:test');
const assert = require('node:assert');
const gov = require('../src/governance');

test('governance: setBaseline and getBaseline', () => {
  gov.reset();
  gov.setBaseline({ model: 'test', count: 5 });
  const b = gov.getBaseline();
  assert.ok(b);
  assert.equal(b.model, 'test');
  assert.equal(b.count, 5);
});

test('governance: recordEvidence and getEvidence', () => {
  gov.reset();
  gov.recordEvidence({ type: 'tool_result', name: 'read_file', ok: true });
  gov.recordEvidence({ type: 'test', name: 'npm test', ok: true });
  const ev = gov.getEvidence();
  assert.equal(ev.length, 2);
  assert.equal(ev[0].type, 'tool_result');
});

test('governance: hasSufficientEvidence', () => {
  gov.reset();
  assert.equal(gov.hasSufficientEvidence().sufficient, false);
  gov.recordEvidence({ type: 'tool_result', name: 'read_file', ok: true });
  assert.equal(gov.hasSufficientEvidence({ minEvidence: 1 }).sufficient, true);
  assert.equal(gov.hasSufficientEvidence({ minEvidence: 2 }).sufficient, false);
});

test('governance: hasSufficientEvidence with requireVerification', () => {
  gov.reset();
  gov.recordEvidence({ type: 'tool_result', name: 'read_file', ok: true });
  assert.equal(gov.hasSufficientEvidence({ requireVerification: true }).sufficient, false);
  gov.recordEvidence({ type: 'verification', name: 'test', ok: true });
  assert.equal(gov.hasSufficientEvidence({ requireVerification: true }).sufficient, true);
});

test('governance: detectDrift', () => {
  gov.reset();
  gov.setBaseline({ toolCount: 3, model: 'test' });
  const noDrift = gov.detectDrift({ toolCount: 3, model: 'test' });
  assert.equal(noDrift.drifted, false);
  const drift = gov.detectDrift({ toolCount: 5, model: 'test' });
  assert.equal(drift.drifted, true);
  assert.equal(drift.changes.length, 1);
  assert.equal(drift.changes[0].key, 'toolCount');
});

test('governance: verificationGate - no evidence with tools', () => {
  gov.reset();
  const vr = gov.verificationGate('Task complete', [{ name: 'write_file' }]);
  assert.equal(vr.verified, false);
  assert.ok(vr.issues.length > 0);
});

test('governance: verificationGate - with evidence', () => {
  gov.reset();
  gov.recordEvidence({ type: 'tool_result', name: 'write_file', ok: true });
  const vr = gov.verificationGate('Task complete', [{ name: 'write_file' }]);
  assert.equal(vr.verified, true);
  assert.equal(vr.issues.length, 0);
});

test('governance: verificationGate - completion claim without evidence', () => {
  gov.reset();
  const vr = gov.verificationGate('All tests passed and verified', []);
  assert.equal(vr.verified, false);
});

test('governance: reset clears state', () => {
  gov.reset();
  gov.setBaseline({ x: 1 });
  gov.recordEvidence({ type: 'test' });
  gov.reset();
  assert.equal(gov.getBaseline(), null);
  assert.equal(gov.getEvidence().length, 0);
});