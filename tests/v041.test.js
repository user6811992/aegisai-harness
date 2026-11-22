const test = require('node:test');
const assert = require('node:assert');
const toolState = require('../src/tool_state');
const toolEval = require('../src/tool_eval');
const evolution = require('../src/evolution_search');
const configMatrix = require('../src/config_matrix');
const recipes = require('../src/migration_recipes');
const conf = require('../src/confidence_memory');
const eventSourced = require('../src/event_sourced');
const contextReset = require('../src/context_reset');
const identity = require('../src/identity_audit');
const spans5 = require('../src/spans5');
const evidence = require('../src/evidence_bundle');
const composable = require('../src/composable_api');
const db = require('../src/storage/db');
const os = require('os');
const path = require('path');
const fs = require('fs');
const dir = path.join(os.tmpdir(), 'aegisai-v041-test');
fs.mkdirSync(dir, { recursive: true });
try { db.open(path.join(dir, 'test.db')); } catch (e) {}

test('tool state', () => {
  toolState.set('t', 's', { x: 1 });
  assert.equal(toolState.get('t', 's').x, 1);
});

test('tool eval', () => {
  const r = toolEval.grade([{ function: { name: 'a', description: 'a short thing', parameters: { properties: {} } } }]);
  assert.equal(r.tools, 1);
});

test('evolution search', () => {
  const cands = evolution.candidates({ a: 1 }, { a: [2, 3] });
  assert.equal(cands.length, 3);
  const r = evolution.search((c) => c.a, cands);
  assert.equal(r.best.config.a, 3);
});

test('config matrix', () => {
  assert.ok(configMatrix.forTool('Codex').includes('AGENTS.md'));
});

test('migration recipes', () => {
  assert.ok(recipes.list().includes('claude -> aegisai'));
});

test('confidence memory', () => {
  const m = conf.store('fact', 'test', 0.9);
  assert.equal(conf.gate({ tags: ['confidence:0.90'] }, 'act').pass, true);
});

test('event sourced replay', () => {
  const r = eventSourced.replay('none');
  assert.ok('verified' in r);
});

test('context wipe', () => {
  const r = contextReset.wipeAndRerun('s', [{ role: 'user', content: 'hi' }]);
  assert.equal(r.ok, true);
});

test('identity audit', () => {
  identity.create('bot', ['read_file']);
  assert.equal(identity.authorize('bot', 'read_file').allowed, true);
  assert.equal(identity.authorize('bot', 'write_file').allowed, false);
});

test('spans5', () => {
  spans5.emit('entry', 'run');
  assert.equal(spans5.layerOf('tool'), 5);
  assert.ok(spans5.tree().length > 0);
});

test('evidence bundle', () => {
  const r = evidence.bundle('test-run', { final: 'done', toolLog: [] });
  assert.ok(r.path);
});

test('composable api', () => {
  const api = composable.create();
  assert.equal(composable.advance(api, 'plan').ok, true);
  assert.equal(composable.advance(api, 'deliver').ok, false);
});
