const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const mf = require('../src/model_fit');
const cg = require('../src/code_graph');
const prom = require('../src/prometheus');
const dq = require('../src/data_query');
const er = require('../src/escalation_router');

function tmp(n) { const p = path.join(os.tmpdir(), 'aegisai-p2-' + n + '-' + Date.now()); fs.mkdirSync(p, { recursive: true }); return p; }
function gguf(p, size) {
  const buf = Buffer.alloc(size);
  buf.write('GGUF', 0, 'ascii');
  buf.writeUInt32LE(3, 4);
  fs.writeFileSync(p, buf);
}

// ---- model_fit ----
test('model_fit: readGgufMeta rejects non-GGUF', () => {
  const root = tmp('gguf');
  const p = path.join(root, 'bad.gguf');
  fs.writeFileSync(p, 'not a model');
  const r = mf.readGgufMeta(p);
  assert.equal(r.ok, false);
  assert.ok(r.error.includes('GGUF'));
});
test('model_fit: estimate returns memory estimates', () => {
  const root = tmp('est');
  const p = path.join(root, 'model-Q4_K_M.gguf');
  gguf(p, 1024 * 1024);
  const r = mf.estimate(p, { context: 8192 });
  assert.equal(r.ok, true);
  assert.ok(r.totalGB > 0);
  assert.ok(r.kvCacheGB > 0);
});
test('model_fit: fit plans across GPUs and RAM', () => {
  const root = tmp('fit');
  const p = path.join(root, 'small-Q4_K_M.gguf');
  gguf(p, 512 * 1024);
  const r = mf.fit(p, [{ name: 'GPU0', vramGB: 8 }], { context: 4096, ramGB: 32 });
  assert.equal(r.ok, true);
  assert.equal(r.fits, true);
  assert.ok(r.command.includes('llama-server'));
});
test('model_fit: fit fails when insufficient', () => {
  const root = tmp('nofit');
  const p = path.join(root, 'big-Q4_K_M.gguf');
  gguf(p, 2 * 1024 * 1024);
  const r = mf.fit(p, [], { context: 131072, ramGB: 0.001 });
  assert.equal(r.fits, false);
});

// ---- code_graph ----
test('code_graph: map builds graph of symbols/imports', () => {
  const prev = process.env.AEGISAI_DATA_DIR;
  const root = tmp('code');
  fs.writeFileSync(path.join(root, 'a.js'), 'const fs = require("fs");\nfunction alpha() {}\nconst beta = () => 1;\n');
  process.env.AEGISAI_DATA_DIR = root;
  try {
    delete require.cache[require.resolve('../src/core/config')];
    const fresh = require('../src/code_graph');
    const r = fresh.map(root, {});
    assert.equal(r.ok, true);
    assert.ok(r.symbols >= 2);
    assert.ok(r.edges >= 1);
    const e = fresh.explain('alpha');
    assert.ok(e.symbols.some((s) => s.name === 'alpha'));
  } finally {
    if (prev == null) delete process.env.AEGISAI_DATA_DIR; else process.env.AEGISAI_DATA_DIR = prev;
    delete require.cache[require.resolve('../src/core/config')];
  }
});
test('code_graph: dryRun does not write', () => {
  const root = tmp('dry');
  fs.writeFileSync(path.join(root, 'a.js'), 'function x(){}');
  const r = cg.map(root, { dryRun: true });
  assert.equal(r.dryRun, true);
  assert.equal(r.ok, true);
});

// ---- prometheus ----
test('prometheus: collect emits standard exposition', () => {
  const text = prom.collect({ stats: { total: { runs: 3, tokens: 100, tools: 5 }, models: [{ model: 'm', tokens: 100, successRate: 90 }] } });
  assert.ok(text.includes('# HELP'));
  assert.ok(text.includes('aegisai_runs_total 3'));
  assert.ok(text.includes('aegisai_model_tokens{model="m"}'));
});
test('prometheus: escapes labels', () => {
  assert.equal(prom.esc('a"b\\c'), 'a\\"b\\\\c');
});

// ---- data_query ----
test('data_query: generates count SQL', () => {
  assert.ok(dq.toSql('how many users').includes('COUNT(*)'));
});
test('data_query: dryRun returns SQL without executing', () => {
  const r = dq.run('list all sessions', { dryRun: true });
  assert.equal(r.ok, true);
  assert.ok(r.sql.includes('SELECT'));
});

// ---- escalation_router ----
test('router: complexity estimate scales with task', () => {
  assert.ok(er.estimate('hi') < er.estimate('implement and refactor and verify and debug this architecture'));
});
test('router: route returns choice and ladder', () => {
  const r = er.route('implement a feature', {});
  assert.equal(r.ok, true);
  assert.ok(r.choice);
  assert.ok(r.escalationLadder.length > 0);
  assert.ok(!r.escalationLadder.includes(r.choice));
});
test('router: max_quality picks top tier', () => {
  const r = er.route('anything', { mode: 'max_quality' });
  assert.equal(r.tier, 4);
});

// ---- MCP ----
test('phase2: tools registered', () => {
  const fs2 = require('fs');
  const mcp = fs2.readFileSync(path.join(__dirname, '..', 'src', 'mcp_server.js'), 'utf8');
  for (const t of ['model_fit', 'code_graph', 'prometheus', 'data_query', 'escalation_router']) assert.ok(mcp.includes(`./${t}`));
});
