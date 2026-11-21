const test = require('node:test');
const assert = require('node:assert');
const pii = require('../src/pii');
const charter = require('../src/charter');
const fsRobust = require('../src/fs_robust');
const temporal = require('../src/temporal_memory');
const lifecycle = require('../src/lifecycle');
const db = require('../src/storage/db');
const path = require('path');
const os = require('os');
const dir = path.join(os.tmpdir(), 'aegisai-v025-test');
require('fs').mkdirSync(dir, { recursive: true });
try { db.open(path.join(dir, 'test.db')); } catch (e) {}

test('PII redaction', () => {
  const r = pii.redact('Email bob@example.com or call 555-123-4567');
  assert.ok(r.changed);
  assert.ok(!r.text.includes('bob@example.com'));
  assert.ok(r.findings.includes('email'));
});

test('charter parsing and enforcement', () => {
  const c = charter.parse('protected_paths:\n  - src/generated\nforbidden_tools:\n  - run_command\nrequire_approval:\n  - write_file');
  assert.equal(charter.enforce(c, 'run_command', {}).allowed, false);
  assert.equal(charter.enforce(c, 'write_file', { path: 'src/app.js' }).approval, true);
  assert.equal(charter.enforce(c, 'write_file', { path: 'src/generated/x.js' }).allowed, false);
});

test('Windows shell separator normalization', () => {
  assert.equal(fsRobust.shellCompatible('a && b'), fsRobust.IS_WINDOWS ? 'a ; b' : 'a && b');
});

test('temporal memory supersession', () => {
  const id = temporal.remember('old fact', 'test', ['x']);
  const newId = temporal.supersede(id, 'new fact', 'test');
  assert.ok(newId);
  const rows = temporal.recallAsOf('fact');
  assert.ok(rows.some((r) => r.text === 'new fact'));
  assert.ok(!rows.some((r) => r.text === 'old fact'));
});

test('agent lifecycle provision and decommission', () => {
  const a = lifecycle.provision('test-agent');
  assert.ok(a.credential);
  assert.ok(lifecycle.list().some((x) => x.id === a.id));
  lifecycle.decommission(a.id);
  assert.equal(lifecycle.get(a.id).status, 'decommissioned');
});
