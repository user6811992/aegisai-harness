const test = require('node:test');
const assert = require('node:assert');
const sessionBrief = require('../src/session_brief');
const detCompact = require('../src/deterministic_compact');
const recovery = require('../src/error_recovery');
const chaos = require('../src/chaos');
const silent = require('../src/silent_failure');
const honesty = require('../src/honesty');
const boundary = require('../src/boundary_bench');
const replay = require('../src/replay_guard');
const pinning = require('../src/mcp_pinning');
const merkle = require('../src/merkle');
const readiness = require('../src/readiness_audit');
const cost = require('../src/cost_routing');
const toolContract = require('../src/tool_contract');
const agentsAsTools = require('../src/agents_as_tools');
const equipment = require('../src/equipment_registry');
const db = require('../src/storage/db');
const os = require('os');
const path = require('path');
const fs = require('fs');
const dir = path.join(os.tmpdir(), 'aegisai-v043-test');
fs.mkdirSync(dir, { recursive: true });
try { db.open(path.join(dir, 'test.db')); } catch (e) {}

test('session brief', () => {
  assert.ok(typeof sessionBrief.brief === 'function');
});

test('deterministic compaction keeps errors and restores', () => {
  const r = detCompact.compact([{ role: 'tool', content: 'ERROR something failed' }]);
  assert.ok(r.originalsId);
  assert.ok(r.messages[0].content.includes('ERROR'));
  assert.ok(Array.isArray(detCompact.restore(r.originalsId)));
});

test('error recovery policy', () => {
  assert.equal(recovery.decide('tool_error', 0).retry, true);
  assert.equal(recovery.decide('budget', 0).retry, false);
});

test('chaos injection', () => {
  assert.equal(chaos.inject('tool_fail').injected, true);
});

test('silent failure detection', () => {
  const r = silent.detect('wrote the file', [{ name: 'write_file', resultPreview: '0 files written', result: { ok: true } }]);
  assert.equal(r.silentFailure, true);
});

test('honesty score', () => {
  const r = honesty.score('done', []);
  assert.ok('score' in r);
});

test('boundary benchmark', () => {
  const r = boundary.evaluate(['read_file', 'delete_file']);
  assert.ok(r.rate <= 1);
});

test('replay guard', () => {
  const r = replay.check('write_file', { path: 'a' });
  assert.equal(r.ok, true);
  assert.equal(replay.check('write_file', { path: 'a' }).ok, false);
});

test('MCP pinning', () => {
  pinning.pin('srv', { command: 'npx' });
  assert.equal(pinning.verify('srv', { command: 'npx' }).ok, true);
  assert.equal(pinning.verify('srv', { command: 'other' }).drift, true);
});

test('merkle root', () => {
  assert.ok(merkle.root(['a', 'b']).length === 64);
  assert.ok('root' in merkle.ledgerRoot());
});

test('readiness audit', () => {
  const r = readiness.audit(process.cwd());
  assert.ok('score' in r);
});

test('cost routing and convergence', () => {
  const r = cost.route([{ name: 'cheap', cost: 0.001, quality: 0.5 }], { budget: 0.005 });
  assert.equal(r.chosen.name, 'cheap');
  assert.equal(cost.converged(['hello world', 'hello world']).converged, true);
});

test('tool contract and agents-as-tools', () => {
  const c = toolContract.exportContract([{ function: { name: 'a', description: 'test tool here' } }]);
  assert.equal(c[0].discoverable, true);
  agentsAsTools.register('writer');
  assert.ok(agentsAsTools.asTools().some((t) => t.function.name === 'agent_writer'));
});

test('equipment registry', () => {
  equipment.add('tool-x', 'memory', { note: 'test' });
  const r = equipment.markTested('tool-x', 'pass');
  assert.equal(r.verdict, 'tested-pass');
});
