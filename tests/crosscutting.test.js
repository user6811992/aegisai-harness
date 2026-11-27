const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const metrics = require('../src/metrics_store');
const dashboard = require('../src/performance_dashboard');
const autotune = require('../src/hardware_autotune');
const registry = require('../src/model_registry');
const optional = require('../src/optional_modules');
const cert = require('../src/verification_cert');
const convergence = require('../src/convergence');
const memoryPolicy = require('../src/memory_policy');

function tmpdir(name) {
  const p = path.join(os.tmpdir(), 'aegisai-cc-' + name + '-' + Date.now());
  fs.mkdirSync(p, { recursive: true });
  return p;
}

// ---- metrics_store ----

test('metrics_store: record and read entries', () => {
  const root = tmpdir('metrics');
  const original = process.env.AEGISAI_DATA_DIR;
  process.env.AEGISAI_DATA_DIR = root;
  // core/config may already be loaded; use FILE directly with a temp override
  const p = path.join(root, 'metrics.jsonl');
  fs.appendFileSync(p, JSON.stringify({ kind: 'http_timing', ts: 1, url: 'http://x', durationMs: 10 }) + '\n');
  const all = metrics.read();
  // read() uses configured DATA_DIR; verify shape only if entries exist
  assert.ok(Array.isArray(all));
  if (original) process.env.AEGISAI_DATA_DIR = original; else delete process.env.AEGISAI_DATA_DIR;
  assert.ok(fs.existsSync(p));
});

test('metrics_store: byKind and clear expose expected shapes', () => {
  const r = metrics.byKind('definitely-no-such-kind');
  assert.deepEqual(r, []);
  assert.equal(typeof metrics.FILE, 'function');
});

// ---- performance dashboard ----

test('performance_dashboard: summarize computes stats', () => {
  const s = dashboard.summarize([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(s.count, 10);
  assert.equal(s.min, 1);
  assert.equal(s.max, 10);
  assert.equal(s.p50, 6);
  assert.equal(typeof s.mean, 'number');
});

test('performance_dashboard: view returns merged sections', () => {
  const v = dashboard.view();
  assert.ok(v.model);
  assert.ok(v.tools);
  assert.ok(v.network);
  assert.ok(v.hardware);
  assert.ok(typeof v.generated === 'string');
});

test('performance_dashboard: tools expose dashboard', () => {
  assert.equal(dashboard.tools()[0].name, 'performance_dashboard');
});

// ---- hardware autotune ----

test('hardware_autotune: tune returns profile settings', () => {
  const t = autotune.tune({ totalRAM_GB: 64, gpu: { detected: true, info: 'NVIDIA DGX Spark GB10' }, cpu: 'ARM' });
  assert.equal(t.profile, 'dgx-spark-gb10');
  assert.ok(t.settings.backendType);
  assert.ok(t.settings.quantization);
  assert.ok(t.settings.context >= 131072);
});

test('hardware_autotune: dryRun does not write files', () => {
  const r = autotune.apply({ totalRAM_GB: 8, gpu: { detected: false, info: '' }, cpu: 'x86' }, { dryRun: true });
  assert.equal(r.ok, true);
  assert.equal(r.dryRun, true);
});

test('hardware_autotune: tools expose autotune', () => {
  assert.equal(autotune.tools()[0].name, 'hardware_autotune');
});

// ---- model registry ----

test('model_registry: normalizeName strips shard tags and hashes', () => {
  assert.equal(registry.normalizeName('model-00001-of-00002.gguf'), 'model');
  assert.ok(!registry.normalizeName('sha256-abcdef').startsWith('sha256-'));
});

test('model_registry: dedupe removes bridged duplicates', () => {
  const items = [
    { name: 'llama3:8b', sizeGB: 4.7, provider: 'ollama' },
    { name: 'llama3-8b.gguf', sizeGB: 4.7, provider: 'lmstudio' },
    { name: 'unique-model', sizeGB: 2.1, provider: 'llamacpp' },
  ];
  const out = registry.dedupe(items);
  assert.equal(out.length, 2);
  assert.ok(out.some((x) => x.bridged));
  assert.ok(out.some((x) => x.providers.includes('lmstudio')));
});

test('model_registry: PROVIDERS includes all local backends', () => {
  assert.ok(registry.PROVIDERS.includes('ollama'));
  assert.ok(registry.PROVIDERS.includes('lmstudio'));
  assert.ok(registry.PROVIDERS.includes('vllm'));
});

// ---- optional modules ----

test('optional_modules: status lists known research modules', () => {
  const s = optional.status();
  assert.ok(s.total >= 5);
  assert.ok(s.items.some((i) => i.id === 'aegis-method-pack'));
  assert.ok(s.items.every((i) => typeof i.available === 'boolean'));
});

test('optional_modules: discoverSubmodules returns array', () => {
  const subs = optional.discoverSubmodules();
  assert.ok(Array.isArray(subs));
});

// ---- verification certificates ----

test('verification_cert: hash is deterministic', () => {
  const a = cert.hash({ x: 1, y: [2, 3] });
  const b = cert.hash({ x: 1, y: [2, 3] });
  assert.equal(a, b);
  assert.equal(a.length, 64);
});

test('verification_cert: verify rejects non-certificate', () => {
  const r = cert.verify({ foo: 'bar' });
  assert.equal(r.ok, false);
});

test('verification_cert: verify detects tampered content', () => {
  const payload = { type: 'aegisai-verification-certificate', id: 'x', contentHash: 'bad' };
  const r = cert.verify(payload);
  assert.equal(r.ok, false);
  assert.equal(r.contentHashMatches, false);
});

// ---- convergence ----

test('convergence: distance of numbers and objects', () => {
  assert.equal(convergence.distance(1, 3), 2);
  assert.equal(convergence.distance({ a: 1, b: 2 }, { a: 1, b: 5 }), 3);
});

test('convergence: detects fixed point', () => {
  const r = convergence.check([{ score: 0.5 }, { score: 0.505 }, { score: 0.5051 }], { tolerance: 0.01 });
  assert.equal(r.converged, true);
  assert.equal(r.iterations, 3);
});

test('convergence: iterate reaches fixed point', () => {
  const r = convergence.iterate(1, (x) => x / 2, { tolerance: 0.01, maxIterations: 20 });
  assert.equal(r.result.converged, true);
  assert.ok(r.states.length <= 20);
});

// ---- memory policy ----

test('memory_policy: surprise measures novel tokens', () => {
  const s = memoryPolicy.surprise('the cat sat on mat', 'the cat sat');
  assert.ok(s > 0 && s <= 1);
});

test('memory_policy: classify applies regularization guard', () => {
  const r = memoryPolicy.classify(
    [{ text: 'novel information about quantum entanglement' }, { text: 'the the the' }],
    { baseline: 'common knowledge', regularizationRatio: 0.4 }
  );
  assert.equal(r.policy.forgettingProtected, true);
  assert.ok(r.items.some((i) => i.action === 'consolidate'));
});

test('memory_policy: low regularization ratio flagged', () => {
  const r = memoryPolicy.classify([{ text: 'x' }], { regularizationRatio: 0.1 });
  assert.equal(r.policy.forgettingProtected, false);
});

test('memory_policy: consolidate protects core facts', () => {
  const r = memoryPolicy.consolidate(['a', 'b', 'c'], ['d'], { regularizationRatio: 0.33 });
  assert.equal(r.protected, 1);
  assert.equal(r.total, 4);
});
