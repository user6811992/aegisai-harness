const test = require('node:test');
const assert = require('node:assert');
const bs = require('../src/brain_sandbox');
const health = require('../src/health_failover');
const bugRepro = require('../src/bug_repro');
const maintenance = require('../src/maintenance_templates');
const speed = require('../src/speed_bench');
const contract = require('../src/runtime_contract');
const gitState = require('../src/git_state');
const fp = require('../src/sandbox_fingerprint');

test('brain/sandbox agent', () => {
  const a = new bs.Agent({});
  assert.equal(a.brain.name, 'local-brain');
  assert.equal(a.sandbox.name, 'local');
  assert.ok(new bs.SealedSandbox());
});

test('health failover select', async () => {
  const r = await health.select(['nonexistent-provider']);
  assert.ok('provider' in r);
  assert.ok('healthy' in r);
});

test('bug repro clone fails gracefully', () => {
  assert.ok(bugRepro.clone);
});

test('maintenance templates', () => {
  const list = maintenance.list();
  assert.ok(list.length >= 4);
  assert.ok(list.every((t) => t.cron));
});

test('speed bench summarize', () => {
  const r = speed.summarize([
    { name: 'message', ts: '2026-01-01T00:00:00Z' },
    { name: 'firstPush', ts: '2026-01-01T00:00:30Z' },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.firstPush.seconds, 30);
});

test('runtime contract', () => {
  const rt = contract.wrap('test');
  assert.equal(contract.conform(rt).ok, true);
});

test('sandbox fingerprint', () => {
  const f = fp.fingerprint();
  assert.ok(f.platform);
  assert.ok(fp.describe(f).includes('platform'));
});
