const test = require('node:test');
const assert = require('node:assert');
const hardware = require('../src/hardware');
const gateway = require('../src/gateway');
const admission = require('../src/admission');
const vuln = require('../src/vuln_scan');
const securityKB = require('../src/security_kb');
const continual = require('../src/continual');
const memoryHierarchy = require('../src/memory_hierarchy');
const db = require('../src/storage/db');
const path = require('path');
const os = require('os');
const fs = require('fs');
const dir = path.join(os.tmpdir(), 'aegisai-v029-test');
fs.mkdirSync(dir, { recursive: true });
try { db.open(path.join(dir, 'test.db')); } catch (e) {}

test('hardware detection and recommendation', () => {
  const hw = hardware.detect();
  assert.ok(hw.totalRAM_GB > 0);
  const rec = hardware.recommend(hw);
  assert.ok(rec.model);
  assert.ok(rec.context > 0);
});

test('gateway authorize and inject', () => {
  gateway.allow('agent-a', 'db-prod', 'read');
  assert.equal(gateway.authorize('agent-a', 'db-prod', 'read').allowed, true);
  assert.equal(gateway.authorize('agent-b', 'db-prod', 'read').allowed, false);
  const inj = gateway.injectSecret('agent-a', 'db-prod', 'pw');
  assert.equal(inj.ok, true);
  assert.ok(!JSON.stringify(inj).includes('secret-value'));
});

test('admission gate tokens', () => {
  const r = admission.request('write_file', { path: 'a' });
  assert.equal(r.required, true);
  assert.equal(admission.admit(r.token).ok, true);
  assert.equal(admission.admit(r.token).ok, false);
});

test('vulnerability scanner finds patterns', () => {
  const p = path.join(dir, 'vuln.js');
  fs.writeFileSync(p, 'const x = eval("1+1");\nconst apiKey = "abcdefghijklmnop";\n');
  const r = vuln.scan(dir);
  assert.ok(r.findings.some((f) => f.label === 'dynamic code execution'));
});

test('security KB match', () => {
  assert.equal(securityKB.CLASSES.length, 24);
  const m = securityKB.match("' OR 1=1 --");
  assert.ok(m.some((x) => x.id === 'sqli'));
});

test('continual cycle returns shape', () => {
  const r = continual.cycle('done', []);
  assert.ok(r.review);
  assert.ok(Array.isArray(r.refinements));
});

test('memory hierarchy status', () => {
  const s = memoryHierarchy.status();
  assert.ok('L2_fact' in s);
});
