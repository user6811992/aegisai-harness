const test = require('node:test');
const assert = require('node:assert');
const gates = require('../src/decision_gates');
const workflow = require('../src/workflow');
const geo = require('../src/geometric_memory');
const arch = require('../src/arch_rules');
const aibom = require('../src/aibom');
const ssh = require('../src/ssh_bridge');
const converter = require('../src/session_converter');
const twoBar = require('../src/two_bar');
const db = require('../src/storage/db');
const path = require('path');
const os = require('os');
const fs = require('fs');
const dir = path.join(os.tmpdir(), 'aegisai-v035-test');
fs.mkdirSync(dir, { recursive: true });
try { db.open(path.join(dir, 'test.db')); } catch (e) {}

test('decision gates', () => {
  assert.equal(gates.evaluate({ input: '' }).proceed, false);
  assert.equal(gates.evaluate({ input: 'hello world' }).proceed, true);
});

test('workflow state machine', () => {
  const wf = workflow.create({ initial: 'a', states: { a: { next: [{ event: 'go', to: 'b' }] }, b: { next: [] } } });
  assert.equal(workflow.transition(wf, 'go').ok, true);
  assert.equal(wf.current, 'b');
  assert.equal(workflow.transition(wf, 'go').ok, false);
});

test('geometric memory store and query', () => {
  geo.store('test', 'hello geometric world');
  const r = geo.query('geometric', 3);
  assert.ok(Array.isArray(r));
});

test('architecture layers', () => {
  const l = arch.inferLayers(path.join(__dirname, '..', 'src'));
  assert.ok(Array.isArray(l));
});

test('AIBOM CycloneDX', () => {
  const b = aibom.generate();
  assert.equal(b.bomFormat, 'CycloneDX');
  assert.equal(b.specVersion, '1.6');
});

test('SSH bridge peers', () => {
  assert.ok(Array.isArray(ssh.peers()));
});

test('session converter', () => {
  const s = { id: 's1', title: 't', messages: [{ role: 'user', content: 'hi' }], created: new Date().toISOString() };
  db.saveSession(s);
  const out = converter.exportSession('s1', 'claude');
  assert.equal(out.messages[0].role, 'user');
});

test('two-bar goal', () => {
  const g = twoBar.setGoal('test task');
  assert.ok(g.sessionId);
  assert.equal(twoBar.cheapCheck(g, { input: 'xyz' }).pass, true);
});
