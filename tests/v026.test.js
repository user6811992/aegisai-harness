const test = require('node:test');
const assert = require('node:assert');
const ledger = require('../src/ledger');
const actionGuard = require('../src/action_guard');
const waste = require('../src/waste');
const counterfactual = require('../src/counterfactual');
const mailbox = require('../src/mailbox');
const db = require('../src/storage/db');
const path = require('path');
const os = require('os');
const dir = path.join(os.tmpdir(), 'aegisai-v026-test');
require('fs').mkdirSync(dir, { recursive: true });
try { db.open(path.join(dir, 'test.db')); } catch (e) {}

test('ledger is hash-chained and verifies', () => {
  ledger.append('test', { a: 1 });
  ledger.append('test', { a: 2 });
  assert.equal(ledger.verify().ok, true);
  const rows = ledger.list();
  assert.ok(rows.length >= 2);
  assert.equal(rows[1].prev, rows[0].hash);
});

test('action guard blocks blind writes', () => {
  const r = actionGuard.gate('write_file', { path: 'src/a.js' }, { toolLog: [] });
  assert.equal(r.allowed, false);
  const r2 = actionGuard.gate('write_file', { path: 'src/a.js' }, { toolLog: [{ name: 'read_file', args: { path: 'src/a.js' } }] });
  assert.equal(r2.allowed, true);
});

test('waste detection flags repeated reads', () => {
  const log = Array.from({ length: 5 }, () => ({ name: 'read_file', args: { path: 'a.js' } }));
  const r = waste.detect(log);
  assert.equal(r.wasteful, true);
  assert.ok(r.flags.some((f) => f.type === 'over-verification'));
});

test('counterfactual diagnosis returns shape', () => {
  const r = counterfactual.diagnose();
  assert.ok(Array.isArray(r.diagnoses));
});

test('mailbox send and inbox', () => {
  const id = mailbox.send('agent-x', 'user', 'hi', 'body');
  assert.ok(id);
  assert.ok(mailbox.inbox('agent-x').some((m) => m.id === id));
});
