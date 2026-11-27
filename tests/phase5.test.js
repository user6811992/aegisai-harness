const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ml = require('../src/mlattice');
const jl = require('../src/jit_lora');
const mm = require('../src/miras_memory');
const ep = require('../src/expert_prefetch');
const fp = require('../src/fixed_point');
const ph = require('../src/peerhive');
const debt = require('../src/shortcut_debt');
const bv = require('../src/backend_variants');
const me = require('../src/moe_engine');
const nb = require('../src/native_bindings');

test('mlattice: 9 cells/token and flat recall', () => {
  const r = ml.dispatch('mlattice_encode', { tokens: ['abc', 'de', 'abc'] });
  assert.equal(r.cellsPerToken, 9);
  assert.equal(r.lattice.length, 3);
  assert.ok(ml.recall(r.lattice, 'abc', 4).length > 0);
});

test('jit_lora: 33% quality guard', () => {
  assert.equal(jl.propose(1, 1.4).accepted, true);
  assert.equal(jl.propose(1, 1.2).accepted, false);
  const p = jl.propose(1, 1.5);
  assert.equal(jl.apply({ adapterVersion: 2 }, p).adapterVersion, 3);
  assert.equal(jl.apply({}, { accepted: false }).ok, false);
});

test('miras: surprise scoring and memory write gate', () => {
  const s = mm.surprise('the quick brown fox', 'a totally unexpected quantum zebra');
  assert.ok(s.score > 0.5);
  assert.equal(mm.write({ summary: 'the quick brown fox' }, { text: 'the quick brown fox' }, 0.5).accepted, false);
  assert.equal(mm.write({ summary: 'the quick brown fox' }, { text: 'unexpected zebra' }, 0.5).accepted, true);
});

test('expert_prefetch: predicts hot experts from router history', () => {
  const r = ep.predict([{ experts: [1, 2] }, { experts: [1, 3] }, { experts: [1, 2] }], { topK: 2 });
  assert.equal(r.predicted[0].expert, 1);
  assert.equal(r.predicted.length, 2);
});

test('fixed_point: detects convergence on repeated hashes', () => {
  const h = fp.hash({ a: 1 });
  let s = fp.step([], { a: 1 }, { required: 2 });
  s = fp.step(s.history, { a: 1 }, { required: 2 });
  assert.equal(s.converged, true);
  assert.equal(fp.step([h], { a: 2 }).converged, false);
});

test('peerhive: opt-in p2p join/publish', () => {
  const prev = process.env.AEGISAI_OFFLINE;
  process.env.AEGISAI_OFFLINE = 'true';
  assert.equal(ph.join('news').ok, false);
  process.env.AEGISAI_OFFLINE = 'false';
  assert.equal(ph.join('news', { peers: ['a', 'b'] }).peers.length, 2);
  assert.equal(ph.publish('news', 'hello', { peers: ['a'] }).delivered, 1);
  if (prev == null) delete process.env.AEGISAI_OFFLINE; else process.env.AEGISAI_OFFLINE = prev;
});

test('shortcut_debt: ledger scans repo read-only', () => {
  const r = debt.ledger({ all: true });
  assert.equal(r.ok, true);
  assert.ok(Array.isArray(r.items));
});

test('research corrections: MLX codecs, MoE flags, Tauri strategy', () => {
  const mlx = bv.resolve('mlx');
  assert.deepEqual(mlx.quants, ['IQ1_S_R4', 'IQ2_KS', 'IQ2_K']);
  const moe = me.plan({ vramGB: 4, experts: 8 });
  assert.ok(!moe.flags.some(f => f.includes('-rtr')));
  assert.ok(moe.caveats.some(c => c.includes('-rtr')));
  const prevEnv = process.env.AEGISAI_NATIVE_INFERENCE;
  process.env.AEGISAI_NATIVE_INFERENCE = 'true';
  const nat = nb.plan('load_model', { path: 'm.gguf', n_gpu_layers: 32, worker: true });
  assert.equal(nat.strategy, 'worker-process');
  if (prevEnv == null) delete process.env.AEGISAI_NATIVE_INFERENCE; else process.env.AEGISAI_NATIVE_INFERENCE = prevEnv;
});

test('phase5: tools registered', () => {
  const mcp = fs.readFileSync(path.join(__dirname, '..', 'src', 'mcp_server.js'), 'utf8');
  for (const m of ['mlattice','jit_lora','miras_memory','expert_prefetch','fixed_point','peerhive','shortcut_debt']) assert.ok(mcp.includes('./' + m));
});
