const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const nb = require('../src/native_bindings');
const mm = require('../src/multimodal_tools');
const pl = require('../src/parallel_loader');
const pf = require('../src/phishing_filter');
const pd = require('../src/portable_dist');
const qa = require('../src/quant_advisor');
const gc = require('../src/grammar_constraints');
const tp = require('../src/terminal_preview');
const cs = require('../src/credential_seal');
const ae = require('../src/aws_emulator_target');
const pa = require('../src/paillier');
const ts = require('../src/thumb2_symbols');
const db = require('../src/decompiler_bridge');
const rl = require('../src/rl_harness');
const me = require('../src/moe_engine');
const bv = require('../src/backend_variants');

test('native: opt-in FFI contract', () => {
  assert.equal(nb.available().enabled, false);
  assert.equal(nb.plan('load_model', { path: 'm.gguf' }).ok, false);
  const prev = process.env.AEGISAI_NATIVE_INFERENCE;
  process.env.AEGISAI_NATIVE_INFERENCE = 'true';
  assert.equal(nb.plan('load_model', { path: 'm.gguf', n_gpu_layers: 32 }).ok, true);
  assert.equal(nb.plan('nope', {}).ok, false);
  if (prev == null) delete process.env.AEGISAI_NATIVE_INFERENCE; else process.env.AEGISAI_NATIVE_INFERENCE = prev;
});

test('multimodal: offline blocks generation, modalities listed', () => {
  assert.equal(mm.plan('text').ok, true);
  const prev = process.env.AEGISAI_OFFLINE;
  process.env.AEGISAI_OFFLINE = 'true';
  assert.equal(mm.plan('image').ok, false);
  if (prev == null) delete process.env.AEGISAI_OFFLINE; else process.env.AEGISAI_OFFLINE = prev;
  assert.equal(mm.MODALITIES.length, 4);
});

test('parallel loader: greedy placement and insufficient VRAM', () => {
  const r = pl.plan([{ id: 'a', bytes: 100 }, { id: 'b', bytes: 80 }], [{ id: 'g0', free: 150 }, { id: 'g1', free: 150 }]);
  assert.equal(r.ok, true);
  assert.equal(r.assignments.length, 2);
  assert.equal(pl.plan([{ id: 'x', bytes: 999 }], [{ id: 'g0', free: 10 }]).ok, false);
});

test('phishing: builtin blocklist and scan', () => {
  assert.equal(pf.isPhishing('https://paypa1.com/login').phishing, true);
  assert.equal(pf.isPhishing('https://example.com').phishing, false);
  const r = pf.scan(['paypa1.com', 'example.com']);
  assert.equal(r.blocked, 1);
});

test('portable dist: manifest with hash', () => {
  const m = pd.manifest('demo', [{ path: 'runtime', bytes: 100 }, { path: 'model.gguf', bytes: 200 }]);
  assert.equal(m.ok, true);
  assert.equal(m.totalBytes, 300);
  assert.ok(m.hash.length === 64);
});

test('quant advisor: VRAM and MoE recommendations', () => {
  const small = qa.recommend({ vramGB: 6, moe: true });
  const big = qa.recommend({ vramGB: 24, moe: false });
  assert.equal(small.quant, 'IQ3_K_R4');
  assert.equal(big.quant, 'Q5_K_M');
  assert.ok(small.caveats.length > 0);
});

test('grammar: enum and JSON GBNF', () => {
  const e = gc.fromEnum(['yes', 'no']);
  assert.ok(e.grammar.includes('"yes" | "no"'));
  const j = gc.jsonSchema({ name: 'string', age: 'number' });
  assert.ok(j.grammar.includes('-?[0-9]+'));
});

test('terminal preview: image and diff', () => {
  assert.ok(tp.preview('image', { width: 800, height: 600 }).text.includes('800x600'));
  assert.ok(tp.preview('diff', { text: '+added\n-removed' }).text.includes('added'));
});

test('credential seal: roundtrip and tamper detection', () => {
  const s = cs.seal('my-secret');
  assert.equal(cs.unsealed(s.sealed, s.key).value, 'my-secret');
  const bad = cs.unsealed(s.sealed, Buffer.alloc(32).toString('base64'));
  assert.equal(bad.ok, false);
  assert.equal(cs.status().hardware, false);
});

test('aws emulator: explicit authorization required', () => {
  assert.equal(ae.plan({ authorized: false }).ok, false);
  assert.equal(ae.plan({ authorized: true }).ok, true);
});

test('paillier: homomorphic addition', () => {
  const keys = pa.keygen(256);
  const a = pa.encrypt(keys.publicKey, 7);
  const b = pa.encrypt(keys.publicKey, 5);
  const sum = pa.add(keys.publicKey, a, b);
  assert.equal(pa.decrypt(keys.privateKey, sum), 12);
  assert.notEqual(pa.decrypt(keys.privateKey, a), 5);
});

test('thumb2: Ghidra status and recovery plan', () => {
  assert.equal(ts.available().ghidra, false);
  assert.equal(ts.plan('fw.bin').steps.length, 5);
  assert.equal(ts.plan().ok, false);
});

test('decompiler bridge: evidence scoring and ranking', () => {
  const h1 = db.hypothesis('function is malloc', ['xref', 'prologue', 'test'], { expected: 3 });
  const h2 = db.hypothesis('function is free', ['xref']);
  assert.equal(h1.status, 'accepted');
  assert.equal(db.loop([h2, h1]).best.description, 'function is malloc');
});

test('rl harness: env steps and episode evaluation', () => {
  const e = rl.env('demo', { maxSteps: 2 });
  assert.equal(rl.step(e, 'a', 1).done, false);
  assert.equal(rl.step(e, 'b', 2).done, true);
  assert.equal(rl.step(e, 'c', 3).ok, false);
  assert.equal(rl.evaluate('demo', [1, 2, 3]).mean, 2);
});

test('moe engine: expert offload plan', () => {
  const low = me.plan({ vramGB: 4, experts: 8 });
  const high = me.plan({ vramGB: 48, experts: 8 });
  assert.ok(low.offloadToCpu > 0);
  assert.equal(high.offloadToCpu, 0);
});

test('backend variants: native backends registered', () => {
  assert.equal(bv.resolve('sd_cpp').abi, 'cpp');
  assert.equal(bv.resolve('mlx').platform, 'darwin');
  assert.equal(bv.resolve('memex').moe, true);
  assert.equal(bv.compatible('mlx', 'llama_cpp').ok, false);
});

test('phase4: docker profile exists + tools registered', () => {
  const root = path.join(__dirname, '..');
  assert.ok(fs.existsSync(path.join(root, 'packaging', 'docker', 'docker-compose.ik_llama.yml')));
  const mcp = fs.readFileSync(path.join(root, 'src', 'mcp_server.js'), 'utf8');
  for (const m of ['native_bindings','multimodal_tools','parallel_loader','phishing_filter','portable_dist','quant_advisor','grammar_constraints','terminal_preview','credential_seal','aws_emulator_target','paillier','thumb2_symbols','decompiler_bridge','rl_harness','moe_engine']) assert.ok(mcp.includes('./' + m));
});
