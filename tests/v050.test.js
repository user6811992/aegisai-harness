const test = require('node:test');
const assert = require('node:assert');
const goals = require('../src/session_goals');
const tokens = require('../src/access_tokens');
const dash = require('../src/token_dashboard');
const pow = require('../src/proof_of_work');
const db = require('../src/storage/db');
const os = require('os');
const path = require('path');
const fs = require('fs');
const dir = path.join(os.tmpdir(), 'aegisai-v050-test');
fs.mkdirSync(dir, { recursive: true });
try { db.open(path.join(dir, 'test.db')); } catch (e) {}

test('session goals create/update/active', () => {
  const g = goals.create('s1', 'finish feature', { description: 'desc' });
  assert.ok(g.id);
  goals.update(g.id, { progress: 50 });
  assert.equal(goals.get(g.id).progress, 50);
  goals.update(g.id, { progress: 100 });
  assert.equal(goals.get(g.id).status, 'completed');
  assert.ok(Array.isArray(goals.active('s1')));
});

test('access tokens mint/verify/revoke', () => {
  const t = tokens.mint('test', ['read', 'execute']);
  assert.ok(t.token.startsWith('pat_'));
  assert.equal(tokens.verify(t.token).ok, true);
  assert.equal(tokens.hasScope(t.token, 'execute'), true);
  assert.equal(tokens.revoke(t.id).ok, true);
});

test('token dashboard summary', () => {
  const s = dash.summary();
  assert.ok('total' in s);
  assert.ok(Array.isArray(s.models));
});

test('proof of work', () => {
  const p = pow.create('run-1', { ci: { status: 'green' }, complexity: 5 });
  assert.equal(p.verdict, 'accepted');
  assert.ok(pow.list().some((x) => x.runId === 'run-1'));
});
