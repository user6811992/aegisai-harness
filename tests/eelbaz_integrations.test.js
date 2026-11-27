const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const modelBridge = require('../src/model_bridge');
const httpAdvanced = require('../src/http_advanced');
const hardware = require('../src/hardware');
const influx = require('../src/influxdb');
const lean = require('../src/lean_verify');
const httpProbe = require('../src/http_probe');

function tmpdir(name) {
  const p = path.join(os.tmpdir(), 'aegisai-test-' + name + '-' + Date.now());
  fs.mkdirSync(p, { recursive: true });
  return p;
}

// ---- model_bridge ----

test('model_bridge: storePaths returns ollama and lmstudio locations', () => {
  const p = modelBridge.storePaths('/fakehome');
  assert.ok(p.ollama.includes('ollama'));
  assert.ok(p.lmStudio.includes('lmstudio'));
  assert.ok(p.manifests.includes('manifests'));
  assert.ok(p.blobs.includes('blobs'));
});

test('model_bridge: detectModelStores reports missing stores cleanly', () => {
  const r = modelBridge.detectModelStores(path.join(os.tmpdir(), 'aegisai-no-such-home-' + Date.now()));
  assert.equal(r.ollama.exists, false);
  assert.equal(r.lmStudio.exists, false);
  assert.equal(r.canBridge, false);
});

test('model_bridge: listOllamaModels reads manifests and blob digests', () => {
  const root = tmpdir('bridge-models');
  const p = modelBridge.storePaths(root);
  fs.mkdirSync(path.join(p.manifests, 'library', 'llama3.2'), { recursive: true });
  fs.mkdirSync(p.blobs, { recursive: true });
  const blobName = 'sha256-abcdef123456';
  fs.writeFileSync(path.join(p.blobs, blobName), 'fakeblob');
  fs.writeFileSync(
    path.join(p.manifests, 'library', 'llama3.2', 'latest'),
    JSON.stringify({ layers: [{ digest: 'sha256:abcdef123456' }] })
  );
  const models = modelBridge.listOllamaModels(root);
  assert.equal(models.length, 1);
  assert.ok(models[0].name.includes('llama3.2'));
  assert.equal(models[0].blobPaths.length, 1);
});

test('model_bridge: syncModels dryRun does not create links', () => {
  const root = tmpdir('bridge-dry');
  const r = modelBridge.syncModels(root, { dryRun: true });
  assert.equal(r.ok, true);
  assert.ok(Array.isArray(r.skippedLinks));
});

test('model_bridge: tools expose status and sync', () => {
  const tools = modelBridge.tools();
  assert.equal(tools.length, 2);
  assert.equal(tools[0].name, 'model_bridge_status');
  assert.equal(tools[1].name, 'model_bridge_sync');
});

// ---- http_advanced / http_probe ----

test('http_advanced: detectCdn identifies known CDNs from headers', () => {
  const r = httpAdvanced.detectCdn({ server: 'cloudflare', 'cf-ray': 'abc' });
  assert.ok(r.cdns.includes('cloudflare'));
  assert.ok(typeof r.evidence === 'string');
});

test('http_advanced: detectCdn returns empty list for unknown headers', () => {
  const r = httpAdvanced.detectCdn({ server: 'custom' });
  assert.deepEqual(r.cdns, []);
});

test('http_advanced: percentile computes p50/p95 correctly', () => {
  const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(httpAdvanced.percentile(sorted, 50), 6);
  assert.equal(httpAdvanced.percentile(sorted, 95), 10);
  assert.equal(httpAdvanced.percentile([], 50), null);
});

test('http_probe: re-exports advanced capabilities', () => {
  assert.equal(typeof httpProbe.detectCdn, 'function');
  assert.equal(typeof httpProbe.timedGet, 'function');
  assert.equal(typeof httpProbe.loadTest, 'function');
  assert.equal(httpProbe.advancedTools().length, 3);
});

// ---- hardware profiles ----

test('hardware: detectProfile identifies DGX Spark GB10', () => {
  const r = hardware.detectProfile({ gpu: { detected: true, info: 'NVIDIA DGX Spark GB10 sm_121' }, cpu: 'ARM64' });
  assert.equal(r.id, 'dgx-spark-gb10');
  assert.equal(r.engine, 'vllm');
  assert.ok(r.context >= 131072);
});

test('hardware: detectProfile identifies Apple Silicon', () => {
  const r = hardware.detectProfile({ gpu: { detected: false, info: '' }, cpu: 'Apple M4 Max' });
  assert.equal(r.id, 'apple-silicon');
  assert.equal(r.engine, 'llama.cpp (MLX)');
});

test('hardware: detectProfile falls back to generic', () => {
  const r = hardware.detectProfile({ gpu: { detected: false, info: '' }, cpu: 'Intel Xeon' });
  assert.equal(r.id, 'generic');
  assert.equal(r.detected, false);
});

test('hardware: recommend includes profile fields', () => {
  const r = hardware.recommend({ totalRAM_GB: 64, gpu: { detected: true, info: 'NVIDIA DGX Spark GB10' }, cpu: 'ARM' });
  assert.equal(r.profile, 'dgx-spark-gb10');
  assert.ok(r.profileLabel);
  assert.ok(r.note.includes('DGX Spark'));
});

// ---- influxdb ----

test('influxdb: line escapes tags and string fields correctly', () => {
  const l = influx.line('metrics', { host: 'a b', url: 'http://x' }, { value: 42, name: 'a"b' }, 1000);
  assert.ok(l.startsWith('metrics,host=a\\ b,url=http://x '));
  assert.ok(l.includes('name="a\\"b"'));
  assert.ok(l.includes('value=42'));
});

test('influxdb: line rejects empty field set', () => {
  assert.throws(() => influx.line('m', {}, {}, 1), /at least one field/);
});

test('influxdb: lines joins multiple points', () => {
  const out = influx.lines([
    { measurement: 'm', tags: { a: 'b' }, fields: { v: 1 } },
    { measurement: 'm', tags: { a: 'c' }, fields: { v: 2 } },
  ]);
  assert.equal(out.split('\n').length, 2);
});

test('influxdb: fromSpans converts telemetry spans', () => {
  const pts = influx.fromSpans([{ name: 'agent', start: 100, end: 300, status: 'ok' }]);
  assert.equal(pts.length, 1);
  assert.equal(pts[0].measurement, 'harness_span');
  assert.equal(pts[0].fields.durationMs, 200);
});

test('influxdb: fromLoadTest converts load results', () => {
  const pts = influx.fromLoadTest({ url: 'http://x', ok: 10, failed: 0, latency: { mean: 12.5, p95: 20 }, requestsPerSecond: 100 });
  assert.equal(pts.length, 1);
  assert.equal(pts[0].fields.p95Ms, 20);
});

test('influxdb: exportMetrics writes to file when configured', async () => {
  const root = tmpdir('influx');
  const file = path.join(root, 'metrics.txt');
  const result = await influx.exportMetrics([{ measurement: 'm', tags: {}, fields: { v: 1 } }], { file });
  assert.equal(result.ok, true);
  assert.ok(fs.existsSync(file));
  assert.ok(fs.readFileSync(file, 'utf8').includes('v=1'));
});

// ---- lean_verify ----

test('lean_verify: available returns structured status', () => {
  const r = lean.available();
  assert.equal(typeof r.lake, 'boolean');
  assert.equal(typeof r.lean, 'boolean');
  assert.ok(typeof r.note === 'string');
});

test('lean_verify: verify reports unavailable gracefully', () => {
  const r = lean.verify(os.tmpdir());
  assert.equal(typeof r.ok, 'boolean');
  assert.equal(typeof r.available, 'boolean');
});

test('lean_verify: tools expose status and verify', () => {
  const tools = lean.tools();
  assert.equal(tools.length, 2);
  assert.equal(tools[0].name, 'lean_verify_status');
  assert.equal(tools[1].name, 'lean_verify_project');
});
