const test = require('node:test');
const assert = require('node:assert');
const board = require('../src/task_board');
const eventBus = require('../src/event_bus');
const acp = require('../src/acp');
const benchmarks = require('../src/benchmarks_real');
const pentest = require('../src/pentest_pipeline');
const contextFS = require('../src/context_fs');
const db = require('../src/storage/db');
const path = require('path');
const os = require('os');
const fs = require('fs');
const dir = path.join(os.tmpdir(), 'aegisai-v030-test');
fs.mkdirSync(dir, { recursive: true });
try { db.open(path.join(dir, 'test.db')); } catch (e) {}

test('task board dependency unblocking', () => {
  const a = board.add('A', 'task a');
  const b = board.add('B', 'task b', [a.id]);
  const r = board.complete(a.id);
  assert.ok(r.unblocked.includes(b.id));
});

test('event bus priority and wildcard', async () => {
  const bus = new eventBus.EventBus();
  let order = [];
  bus.on('x', () => order.push('low'), { priority: 1 });
  bus.on('x', () => order.push('high'), { priority: 10 });
  bus.on('*', () => order.push('wild'), { priority: 5 });
  await bus.emit('x', {});
  assert.deepEqual(order, ['high', 'wild', 'low']);
});

test('ACP initialize and session', async () => {
  const s = acp.createServer();
  const init = await s.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  assert.equal(init.result.agentInfo.name, 'aegisai-harness');
  const ns = await s.handle({ jsonrpc: '2.0', id: 2, method: 'session/new', params: {} });
  assert.ok(ns.result.sessionId);
});

test('benchmark catalogs', () => {
  assert.equal(benchmarks.POLYGLOT.length, 5);
  assert.equal(benchmarks.LONG_HORIZON.length, 3);
});

test('pentest pipeline on local dir', async () => {
  const r = await pentest.run(dir);
  assert.equal(r.ok, true);
  assert.ok(r.stages.some((s) => s.stage === 'report'));
});

test('context filesystem lists docs', () => {
  const list = contextFS.list('/docs');
  assert.ok(list.some((p) => p.includes('README.md')));
});
