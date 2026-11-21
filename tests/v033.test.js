const test = require('node:test');
const assert = require('node:assert');
const contest = require('../src/contest_memory');
const constitution = require('../src/constitution');
const bidi = require('../src/integrations/bidi');
const eventStream = require('../src/event_stream');
const installer = require('../src/config_installer');
const multiSearch = require('../src/multi_search');
const routingEval = require('../src/routing_eval');
const controlPlane = require('../src/control_plane');
const db = require('../src/storage/db');
const path = require('path');
const os = require('os');
const fs = require('fs');
const dir = path.join(os.tmpdir(), 'aegisai-v033-test');
fs.mkdirSync(dir, { recursive: true });
try { db.open(path.join(dir, 'test.db')); } catch (e) {}

test('contest memory habits', () => {
  contest.node('a', 'concept'); contest.node('b', 'concept');
  for (let i = 0; i < 5; i++) contest.reinforce('a', 'b', 'semantic', 1);
  assert.ok(contest.habits(4).some((h) => h.a === 'a' && h.b === 'b'));
});

test('constitution propose/decide', () => {
  const p = constitution.propose('Be honest');
  const d = constitution.decide(p.id, 'approve');
  assert.equal(d.status, 'adopted');
  assert.ok(constitution.adopted().some((c) => c.id === p.id));
});

test('BiDi backend loads', () => {
  assert.ok(bidi.BIDI_URL.includes('4444'));
});

test('event stream has subscribe', () => {
  assert.equal(typeof eventStream.subscribe, 'function');
});

test('config installer preview', () => {
  const p = installer.preview('hello');
  assert.ok(p.length > 0);
});

test('multi search engines array', () => {
  assert.ok(Array.isArray(multiSearch.ENGINES));
});

test('routing eval', () => {
  const r = routingEval.evaluate();
  assert.ok(r.best);
  assert.equal(Object.keys(r.strategies).length, 4);
});

test('control plane govern', () => {
  const r = controlPlane.govern('read_file', { path: 'a' });
  assert.equal(typeof r.allowed, 'boolean');
  const cp = controlPlane.checkpoint('t1', { x: 1 });
  assert.ok(controlPlane.resume(cp.id));
});
