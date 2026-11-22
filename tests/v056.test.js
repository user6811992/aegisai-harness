const test = require('node:test');
const assert = require('node:assert');
const swarm = require('../src/swarm');
const patch = require('../src/patch');
const task = require('../src/task');
const hunt = require('../src/hunt');
const awesomeRe = require('../src/awesome_re');
const mcpPresets = require('../src/mcp_presets');
const vulnPatterns = require('../src/vuln_patterns');
const markdownMemory = require('../src/markdown_memory');
const metrics = require('../src/metrics');
const db = require('../src/storage/db');
const os = require('os');
const path = require('path');
const fs = require('fs');
const dir = path.join(os.tmpdir(), 'aegisai-v056-test');
fs.mkdirSync(dir, { recursive: true });
try { db.open(path.join(dir, 'test.db')); } catch (e) {}

test('swarm toSubtasks', () => {
  const subs = swarm.toSubtasks(['a', 'b', { id: 'x', prompt: 'y' }]);
  assert.equal(subs.length, 3);
  assert.equal(subs[0].id, 'sub-1');
  assert.equal(subs[2].id, 'x');
});

test('patch proposePatch (dry run)', () => {
  const pkgPath = path.join(dir, 'package.json');
  fs.writeFileSync(pkgPath, JSON.stringify({ name: 't', dependencies: { foo: '1.0.0' } }, null, 2));
  const r = patch.proposePatch({ projectRoot: dir, dependency: 'foo', fixedVersion: '1.2.3' });
  assert.equal(r.ok, true);
  assert.equal(r.dryRun, true);
  assert.equal(r.from, '1.0.0');
  assert.equal(r.to, '1.2.3');
  assert.ok(r.diff.includes('+'));
});

test('task sandbox', () => {
  assert.equal(task.sandboxTaskContext({ url: 'https://example.com' }).ok, true);
  assert.equal(task.sandboxTaskContext({ url: 'http://127.0.0.1/x' }).blocked, true);
  assert.equal(task.sandboxTaskStep({ name: 'fetch', args: { url: 'https://example.com' } }).ok, true);
  assert.equal(task.TASK_PHASES.length, 4);
});

test('hunt start/vulnSearch/report/list', () => {
  const s = hunt.start('https://example.com', 'scope', 10);
  assert.equal(s.ok, true);
  const v = hunt.vulnSearch('sql', 5);
  assert.equal(v.ok, true);
  assert.ok(Array.isArray(v.result.patterns));
  const r = hunt.report([{ title: 'SQLi', severity: 'high', cwe: 'CWE-89' }], 'Test Report');
  assert.equal(r.ok, true);
  assert.ok(r.result.report.includes('SQLi'));
  assert.ok(hunt.list().length > 0);
});

test('awesome-re search', () => {
  assert.ok(Array.isArray(awesomeRe.search('test', { limit: 5 })));
});

test('mcp presets', () => {
  const presets = mcpPresets.buildPresets(['fs', 'git', 'time'], dir);
  assert.ok(presets.length >= 3);
  assert.ok(presets.some((p) => p.id === 'preset-fs'));
});

test('vuln patterns', () => {
  const r = vulnPatterns.searchPatterns('sql', { limit: 5 });
  assert.ok(r.length > 0);
  assert.ok(vulnPatterns.VULN_CLASSES.length >= 8);
});

test('markdown memory', () => {
  const r = markdownMemory.append('test fact', { title: 't' });
  assert.equal(r.ok, true);
  assert.ok(markdownMemory.search('test').length > 0);
});

test('metrics', () => {
  const name = 'test_metric_' + Date.now();
  metrics.record(name, 42, { a: 1 });
  const s = metrics.summary(name);
  assert.equal(s.count, 1);
  assert.equal(s.avg, 42);
  assert.ok(Array.isArray(metrics.all()));
});
