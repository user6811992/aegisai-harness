const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { detectProjectType, getTestCommand } = require('../src/project_init');

test('comprehension: detectProjectType reads repo root for node', () => {
  // Running from repo root, package.json should be detected
  const result = detectProjectType(process.cwd());
  assert.ok(result === 'node' || result === 'generic', `Expected node or generic, got ${result}`);
});

test('comprehension: getTestCommand returns npm test for node', () => {
  assert.equal(getTestCommand('node'), 'npm test');
});

test('comprehension: getTestCommand returns pytest for python', () => {
  assert.equal(getTestCommand('python'), 'pytest');
});

test('comprehension: getTestCommand returns cargo test for rust', () => {
  assert.equal(getTestCommand('rust'), 'cargo test');
});

test('comprehension: getTestCommand returns go test for go', () => {
  assert.equal(getTestCommand('go'), 'go test ./...');
});

test('comprehension: getTestCommand returns mvn test for java', () => {
  assert.equal(getTestCommand('java'), 'mvn test');
});

test('comprehension: getTestCommand returns dotnet test for dotnet', () => {
  assert.equal(getTestCommand('dotnet'), 'dotnet test');
});

test('comprehension: getTestCommand returns echo for generic', () => {
  assert.equal(getTestCommand('generic'), 'echo "no test command configured"');
});

test('comprehension: governance module exports all expected functions', () => {
  const gov = require('../src/governance');
  const expected = [
    'setBaseline', 'getBaseline', 'recordEvidence', 'getEvidence',
    'hasSufficientEvidence', 'detectDrift', 'verificationGate', 'reset'
  ];
  expected.forEach((fn) => {
    assert.ok(typeof gov[fn] === 'function', `${fn} should be a function`);
  });
});

test('comprehension: governance setBaseline records state', () => {
  const gov = require('../src/governance');
  gov.reset();
  gov.setBaseline({ model: 'llama', tokens: 100 });
  const baseline = gov.getBaseline();
  assert.ok(baseline);
  assert.equal(baseline.model, 'llama');
  assert.equal(baseline.tokens, 100);
  assert.ok(baseline.ts > 0);
});

test('comprehension: governance recordEvidence collects entries', () => {
  const gov = require('../src/governance');
  gov.reset();
  gov.recordEvidence({ type: 'tool_result', name: 'read_file', ok: true, durationMs: 50 });
  gov.recordEvidence({ type: 'verification', name: 'test_suite', ok: true });
  const evidence = gov.getEvidence();
  assert.equal(evidence.length, 2);
  assert.equal(evidence[0].type, 'tool_result');
  assert.equal(evidence[1].type, 'verification');
});

test('comprehension: governance hasSufficientEvidence checks minimum count', () => {
  const gov = require('../src/governance');
  gov.reset();
  assert.equal(gov.hasSufficientEvidence().sufficient, false);
  assert.equal(gov.hasSufficientEvidence({ minEvidence: 1 }).sufficient, false);
  gov.recordEvidence({ type: 'tool_result', name: 'test', ok: true });
  assert.equal(gov.hasSufficientEvidence({ minEvidence: 1 }).sufficient, true);
  assert.equal(gov.hasSufficientEvidence({ minEvidence: 2 }).sufficient, false);
});

test('comprehension: governance detectDrift detects changes', () => {
  const gov = require('../src/governance');
  gov.reset();
  gov.setBaseline({ toolCount: 5, model: 'llama' });
  const noChange = gov.detectDrift({ toolCount: 5, model: 'llama' });
  assert.equal(noChange.drifted, false);
  const change = gov.detectDrift({ toolCount: 8, model: 'llama' });
  assert.equal(change.drifted, true);
  assert.equal(change.changes.length, 1);
  assert.equal(change.changes[0].key, 'toolCount');
});

test('comprehension: governance verificationGate verifies with evidence', () => {
  const gov = require('../src/governance');
  gov.reset();
  gov.recordEvidence({ type: 'tool_result', name: 'write_file', ok: true });
  const vr = gov.verificationGate('Task complete', [{ name: 'write_file' }]);
  assert.equal(vr.verified, true);
  assert.equal(vr.issues.length, 0);
});

test('comprehension: governance verificationGate rejects claim without evidence', () => {
  const gov = require('../src/governance');
  gov.reset();
  const vr = gov.verificationGate('All done and verified', []);
  assert.equal(vr.verified, false);
  assert.ok(vr.issues.some((i) => i.includes('supporting evidence')), `Issues: ${vr.issues.join(', ')}`);
});

test('comprehension: governance reset clears all state', () => {
  const gov = require('../src/governance');
  gov.reset();
  gov.setBaseline({ x: 1 });
  gov.recordEvidence({ type: 'test' });
  gov.reset();
  assert.equal(gov.getBaseline(), null);
  assert.equal(gov.getEvidence().length, 0);
});