const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const tree = require('../src/tree_index');
const nc = require('../src/network_checks');
const sweeps = require('../src/backend_sweeps');
const ci = require('../src/code_intelligence');

function tmp(n) { const p = path.join(os.tmpdir(), 'aegisai-p2b-' + n + '-' + Date.now()); fs.mkdirSync(p, { recursive: true }); return p; }

// ---- tree index ----
test('tree: buildDocument splits by headings', () => {
  const t = tree.buildDocument('guide.md', '# Intro\nHello world\n\n## Details\nMore content here\n\n## End\nFinal section');
  assert.equal(t.kind, 'document');
  assert.ok(t.nodes.length >= 3);
  assert.equal(t.nodes[0].title, 'Intro');
});

test('tree: buildConversation preserves turns', () => {
  const t = tree.buildConversation('chat', [{ role: 'user', content: 'Hello there' }, { role: 'assistant', content: 'Hi!' }]);
  assert.equal(t.kind, 'conversation');
  assert.equal(t.nodes.length, 2);
});

test('tree: index and search', () => {
  const prev = process.env.AEGISAI_DATA_DIR;
  const root = tmp('tree');
  process.env.AEGISAI_DATA_DIR = root;
  try {
    delete require.cache[require.resolve('../src/core/config')];
    const fresh = require('../src/tree_index');
    const r = fresh.index(fresh.buildDocument('a.md', '# Authentication\nTokens expire after refresh'));
    assert.equal(r.ok, true);
    const s = fresh.search('tokens', {});
    assert.ok(s.results.some((x) => x.title.includes('Authentication')));
    assert.ok(fresh.list().trees.length > 0);
  } finally {
    if (prev == null) delete process.env.AEGISAI_DATA_DIR; else process.env.AEGISAI_DATA_DIR = prev;
    delete require.cache[require.resolve('../src/core/config')];
  }
});

// ---- network checks ----
test('netcheck: compare operators', () => {
  assert.equal(nc.compare(200, { op: 'eq', expected: 200 }), true);
  assert.equal(nc.compare(200, { op: 'gte', expected: 200 }), true);
  assert.equal(nc.compare('application/json', { op: 'contains', expected: 'json' }), true);
  assert.equal(nc.compare('abc', { op: 'regex', expected: '^a' }), true);
  assert.equal(nc.compare(199, { op: 'lt', expected: 200 }), true);
});

test('netcheck: check conditions with actual values', () => {
  const r = nc.check([{ name: 'status', op: 'eq', expected: 200, actual: 200 }, { name: 'latency', op: 'lt', expected: 100, actual: 250 }]);
  assert.equal(r.pass, false);
  assert.equal(r.results[0].pass, true);
  assert.equal(r.results[1].pass, false);
});

// ---- backend sweeps ----
test('sweeps: score weights speed/quality/cost', () => {
  const a = sweeps.score({ tokensPerSec: 100, quality: 0.9, cost: 0.1 });
  const b = sweeps.score({ tokensPerSec: 10, quality: 0.5, cost: 0.8 });
  assert.ok(a > b);
});

test('sweeps: returns best config', () => {
  const r = sweeps.sweep([
    { config: 'A', measured: { tokensPerSec: 20, quality: 0.6, cost: 0.2 } },
    { config: 'B', measured: { tokensPerSec: 80, quality: 0.9, cost: 0.1 } },
  ], { persist: false });
  assert.equal(r.ok, true);
  assert.equal(r.best.config, 'B');
});

// ---- code intelligence ----
test('code_select: relevance scores term overlap', () => {
  assert.ok(ci.relevance('auth token refresh', 'token refresh') > 0);
  assert.equal(ci.relevance('unrelated content', 'token refresh'), 0);
});

test('code_select: picks relevant files within budget', () => {
  const root = tmp('code');
  const f1 = path.join(root, 'auth.js');
  const f2 = path.join(root, 'other.js');
  fs.writeFileSync(f1, 'const tokenRefresh = () => {}; // auth token refresh flow\n');
  fs.writeFileSync(f2, 'const greet = () => "hello";\n');
  const r = ci.select([f1, f2], 'token refresh', { maxTokens: 100000 });
  assert.equal(r.ok, true);
  assert.ok(r.files.some((f) => f.file === f1));
  assert.ok(r.tokensUsed <= r.budget);
});

// ---- MCP ----
test('phase2b: tools registered', () => {
  const mcp = fs.readFileSync(path.join(__dirname, '..', 'src', 'mcp_server.js'), 'utf8');
  for (const t of ['tree_index', 'network_checks', 'backend_sweeps', 'code_intelligence']) assert.ok(mcp.includes(`./${t}`));
});
