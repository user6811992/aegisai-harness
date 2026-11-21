const test = require('node:test');
const assert = require('node:assert');
const graph = require('../src/graph_memory');
const uiReplay = require('../src/ui_replay');
const separation = require('../src/separation');
const autoPolicy = require('../src/auto_policy');
const debuggerMod = require('../src/debugger');
const cheapest = require('../src/cheapest_model');
const codeMap = require('../src/code_map');
const db = require('../src/storage/db');
const path = require('path');
const os = require('os');
const fs = require('fs');
const dir = path.join(os.tmpdir(), 'aegisai-v032-test');
fs.mkdirSync(dir, { recursive: true });
try { db.open(path.join(dir, 'test.db')); } catch (e) {}

test('graph memory observe and recall', () => {
  const r = graph.observe('Alice works with Bob on ProjectX');
  assert.ok(r.nodes.includes('Alice'));
  const related = graph.recall('Alice');
  assert.ok(Array.isArray(related));
});

test('UI replay records steps', () => {
  const n = uiReplay.record({ action: 'navigate', args: { url: 'http://x' } });
  assert.ok(n > 0);
});

test('separation rejects self-verification', () => {
  const id = separation.createSession('task', 'executor-1');
  separation.submitOutput(id, 'done');
  assert.equal(separation.verify(id, 'executor-1', 'approve').ok, false);
  assert.equal(separation.verify(id, 'verifier-2', 'approve').ok, true);
});

test('auto policy learns from attack', () => {
  const r = autoPolicy.learn({ name: 'run_command', command: 'rm -rf /' });
  assert.ok(Array.isArray(r.candidates));
});

test('debugger breakpoints and step', () => {
  const d = new debuggerMod.HarnessDebugger();
  d.setBreakpoint('write_file');
  assert.equal(d.shouldPause('write_file'), true);
  d.resume();
  d.step(1);
  assert.equal(d.shouldPause('read_file'), true);
});

test('cheapest model module loads', () => {
  assert.ok(cheapest.DEFAULT_PRICES);
});

test('code map builds', () => {
  const m = codeMap.build(path.join(__dirname, '..', 'src'), 3);
  assert.ok(Array.isArray(m));
});
