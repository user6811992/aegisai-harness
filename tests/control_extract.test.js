const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('../src/local_control');
const ce = require('../src/content_extract');

// ---- control plane ----

test('control: classify maps tools to risk tiers', () => {
  assert.equal(cp.classify('read_file').tier, 'read');
  assert.equal(cp.classify('write_file').tier, 'write');
  assert.equal(cp.classify('delete_file').tier, 'destructive');
  assert.equal(cp.classify('fetch_url').tier, 'external');
  assert.equal(cp.classify('unknown_tool').tier, 'write');
});

test('control: policy defaults are local-first', () => {
  const p = cp.policy();
  assert.equal(p.allowRemote, false);
  assert.equal(p.requireApprovalAbove, 1);
  assert.equal(p.rollbackSnapshots, true);
});

test('control: gate blocks destructive without approval', () => {
  const r = cp.gate('delete_file', { path: 'x.txt' }, {}, cp.policy());
  assert.equal(r.allowed, false);
  assert.ok(r.issues.some((i) => i.includes('approval required')));
});

test('control: gate blocks external in offline mode', () => {
  const r = cp.gate('fetch_url', { url: 'http://x' }, { offline: true }, cp.policy({ allowRemote: false }));
  assert.equal(r.allowed, false);
  assert.ok(r.issues.some((i) => i.includes('offline')));
});

test('control: gate allows approved destructive action with evidence', () => {
  const r = cp.gate('delete_file', { path: 'x.txt' }, {
    approved: true,
    toolLog: [{ name: 'read_file', args: { path: 'x.txt' } }],
  }, cp.policy());
  assert.equal(r.allowed, true);
});

test('control: gate enforces maxTier', () => {
  const r = cp.gate('fetch_url', { url: 'http://x' }, {}, cp.policy({ maxTier: 'write' }));
  assert.equal(r.allowed, false);
  assert.ok(r.issues.some((i) => i.includes('exceeds max')));
});

test('control: record and list runs', () => {
  const prev = process.env.AEGISAI_DATA_DIR;
  const tmp = path.join(os.tmpdir(), 'aegisai-cp-' + Date.now());
  process.env.AEGISAI_DATA_DIR = tmp;
  try {
    delete require.cache[require.resolve('../src/core/config')];
    const fresh = require('../src/local_control');
    const r = fresh.recordRun('test-run', { verdict: 'shipped', toolLog: [{ name: 'read_file' }] });
    assert.equal(r.runId, 'test-run');
    const got = fresh.getRun('test-run');
    assert.equal(got.verdict, 'shipped');
    const list = fresh.listRuns();
    assert.ok(list.some((x) => x.runId === 'test-run'));
  } finally {
    if (prev == null) delete process.env.AEGISAI_DATA_DIR; else process.env.AEGISAI_DATA_DIR = prev;
    delete require.cache[require.resolve('../src/core/config')];
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }
});

test('control: toolLogSummary includes tiers', () => {
  const s = cp.toolLogSummary([{ name: 'read_file' }, { name: 'delete_file', ok: false }]);
  assert.equal(s[0].tier, 'read');
  assert.equal(s[1].tier, 'destructive');
  assert.equal(s[1].ok, false);
});

test('control: MCP tools exposed and dispatch works', () => {
  const names = cp.tools().map((t) => t.name);
  assert.ok(names.includes('local_control_gate'));
  assert.equal(cp.dispatch('local_control_gate', { toolName: 'read_file' }).allowed, true);
  assert.equal(cp.dispatch('local_control_policy', {}).allowRemote, false);
});

// ---- content extract ----

const SAMPLE_HTML = `<html><head><title>Test Article</title>
<meta name="description" content="A sample description">
<meta name="author" content="Jane Doe"></head><body>
<nav>Navigation clutter here</nav>
<header>Site header</header>
<main><article><h1>Real Heading</h1><p>This is the primary article content with enough text to be considered the main body of the page and should be extracted correctly.</p><p>Second paragraph with more details about the topic at hand.</p></article></main>
<aside>Sidebar ads</aside><footer>Footer links</footer>
<script>var x = 1;</script></body></html>`;

test('extract: stripTags removes clutter and decodes entities', () => {
  const s = ce.stripTags('<p>Hello &amp; goodbye</p><script>alert(1)</script>');
  assert.ok(s.includes('Hello & goodbye'));
  assert.ok(!s.includes('alert'));
});

test('extract: extractMain prefers <main>', () => {
  const m = ce.extractMain(SAMPLE_HTML);
  assert.ok(m.includes('Real Heading'));
  assert.ok(!m.includes('Navigation clutter'));
});

test('extract: metadata reads title, description, author', () => {
  const m = ce.metadata(SAMPLE_HTML);
  assert.equal(m.title, 'Test Article');
  assert.equal(m.description, 'A sample description');
  assert.equal(m.author, 'Jane Doe');
});

test('extract: toMarkdown returns readable text without nav', () => {
  const md = ce.toMarkdown(SAMPLE_HTML);
  assert.ok(md.includes('Real Heading'));
  assert.ok(!md.includes('Navigation clutter'));
  assert.ok(!md.includes('Site header'));
});

test('extract: extract returns ok result with word count', () => {
  const r = ce.extract(SAMPLE_HTML, { markdown: true });
  assert.equal(r.ok, true);
  assert.equal(r.title, 'Test Article');
  assert.ok(r.words > 20);
  assert.ok(r.text.includes('primary article content'));
});

test('extract: file helper reads local HTML', () => {
  const root = path.join(os.tmpdir(), 'aegisai-extract-' + Date.now());
  fs.mkdirSync(root, { recursive: true });
  const p = path.join(root, 'page.html');
  fs.writeFileSync(p, SAMPLE_HTML);
  const r = ce.extractFile(p);
  assert.equal(r.ok, true);
  assert.equal(r.title, 'Test Article');
  fs.rmSync(root, { recursive: true, force: true });
});

test('extract: MCP tools exposed and dispatch works', () => {
  const names = ce.tools().map((t) => t.name);
  assert.deepEqual(names, ['content_extract', 'content_extract_file']);
  assert.equal(ce.dispatch('content_extract', { html: SAMPLE_HTML }).ok, true);
});
