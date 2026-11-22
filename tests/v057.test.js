const test = require('node:test');
const assert = require('node:assert');
const delivery = require('../src/delivery');
const durable = require('../src/durable');
const isolation = require('../src/isolation');
const timers = require('../src/timers');
const consol = require('../src/consolidation_scheduler');
const mcpSearch = require('../src/mcp_search');
const mcpRegistry = require('../src/mcp_registry');
const settings = require('../src/settings');
const db = require('../src/storage/db');
const os = require('os');
const path = require('path');
const fs = require('fs');
const dir = path.join(os.tmpdir(), 'aegisai-v057-test');
fs.mkdirSync(dir, { recursive: true });
try { db.open(path.join(dir, 'test.db')); } catch (e) {}

test('delivery channels', async () => {
  const ch = delivery.createEventChannel();
  let received = null;
  ch.subscribe((e) => { received = e; });
  await ch.send({ hello: 'world' });
  assert.deepEqual(received, { hello: 'world' });
  const wh = delivery.createWebhookChannel({ url: 'http://127.0.0.1:9999/x', fetchImpl: async () => ({ ok: true, status: 200 }) });
  const r = await wh.send({ a: 1 });
  assert.equal(r.ok, true);
  const d = delivery.createDelivery({ channels: [ch, wh] });
  const res = await d.send({ b: 2 });
  assert.equal(res.length, 2);
});

test('durable sessions/jobs', () => {
  const s = { id: 's1', goal: 'test', status: 'idle', policy: {}, createdAt: Date.now(), lastResult: null };
  durable.saveSession(s);
  assert.equal(durable.loadSessions().length, 1);
  durable.saveJob('s1', { id: 'j1', goal: 'g', status: 'queued', createdAt: Date.now() });
  assert.equal(durable.loadJobs('s1').length, 1);
  durable.saveOutboxEvent({ session: 's1', type: 'test', job: { id: 'j1' } });
  assert.ok(durable.listOutbox('s1').length > 0);
  const rt = { sessions: new Map() };
  assert.equal(durable.restoreRuntime(rt), 1);
  durable.deleteSession('s1');
});

test('isolation policy', () => {
  const p = isolation.createSessionPolicy({ root: process.cwd(), maxJobs: 5, cleanRoom: true });
  assert.equal(p.maxJobs, 5);
  assert.equal(p.cleanRoom, true);
  assert.equal(isolation.checkJobAgainstPolicy(p, { url: 'https://example.com' }).ok, true);
  assert.equal(isolation.checkJobAgainstPolicy(p, { url: 'http://127.0.0.1/x' }).blocked, true);
});

test('timers schedule/cancel', async () => {
  const ts = timers.createTimerScheduler({ enqueue: async () => {} });
  const t = ts.schedule('s1', { goal: 'g' }, { everyMs: 10000, maxRuns: 1 });
  assert.ok(t.id);
  assert.equal(ts.list('s1').length, 1);
  assert.equal(ts.cancel(t.id), true);
  ts.clear();
});

test('consolidation scheduler', async () => {
  const cs = consol.createConsolidationScheduler({ consolidate: async () => ({ mergedGroups: 1, after: 5 }) });
  const r = await cs.runNow();
  assert.equal(r.mergedGroups, 1);
  const st = cs.start({ everyMs: 100000 });
  assert.equal(st.running, true);
  cs.stop();
});

test('mcp search candidates', () => {
  const c = mcpSearch.candidates();
  assert.ok(Array.isArray(c));
});

test('mcp registry fetch (network)', async () => {
  const r = await mcpRegistry.fetchRegistry({ query: 'filesystem', limit: 3 });
  assert.ok(Array.isArray(r.servers));
});

test('mcp registry buildSpec', () => {
  const entry = { name: 'test/server', title: 'Test', packages: [{ registryType: 'npm', identifier: '@modelcontextprotocol/server-filesystem', version: '1.0.0' }] };
  const spec = mcpRegistry.buildSpec(entry);
  assert.ok(spec.id);
  assert.ok(spec.command === 'npx' || spec.command === 'cmd');
});

test('settings load/save', () => {
  const s = settings.load();
  settings.save({ foo: 'bar' });
  assert.equal(settings.load().foo, 'bar');
});
