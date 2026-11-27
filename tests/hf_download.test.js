const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const hf = require('../src/hf_download');
const discovery = require('../src/model_discovery');

function tmpdir(name) {
  const p = path.join(os.tmpdir(), 'aegisai-hf-' + name + '-' + Date.now());
  fs.mkdirSync(p, { recursive: true });
  return p;
}

test('hf: resolveUrl builds correct resolve URL', () => {
  assert.equal(
    hf.resolveUrl('user/model', 'model.gguf'),
    'https://huggingface.co/user/model/resolve/main/model.gguf'
  );
});

test('hf: resolveUrl supports revision and nested filename', () => {
  const url = hf.resolveUrl('user/model', 'sub/model.gguf', 'v1.0');
  assert.equal(url, 'https://huggingface.co/user/model/resolve/v1.0/sub/model.gguf');
});

test('hf: validateRepo rejects traversal and malformed ids', () => {
  assert.throws(() => hf.validateRepo('../etc/passwd'), /invalid Hugging Face repo id/);
  assert.throws(() => hf.validateRepo('nope'), /invalid Hugging Face repo id/);
});

test('hf: validateFilename rejects absolute paths and traversal', () => {
  assert.throws(() => hf.validateFilename('../evil.gguf'), /invalid model filename/);
  assert.throws(() => hf.validateFilename('/abs/model.gguf'), /invalid model filename/);
});

test('hf: safeDest stays inside destination root', () => {
  const root = tmpdir('dest');
  const target = hf.safeDest('user/model', 'model.gguf', { dest: root });
  assert.ok(target.startsWith(path.resolve(root)));
});

test('hf: offline mode blocks downloads and manifest', async () => {
  const prev = process.env.AEGISAI_OFFLINE;
  process.env.AEGISAI_OFFLINE = 'true';
  const d = await hf.download('user/model', 'm.gguf');
  assert.equal(d.ok, false);
  assert.ok(d.error.includes('offline'));
  const m = await hf.manifest('user/model');
  assert.equal(m.ok, false);
  if (prev == null) delete process.env.AEGISAI_OFFLINE; else process.env.AEGISAI_OFFLINE = prev;
});

test('hf: dispatch hf_model_url validates without network', async () => {
  const r = await hf.dispatch('hf_model_url', { repo: 'user/model', filename: 'm.gguf' });
  assert.equal(r.ok, true);
  assert.ok(r.url.includes('huggingface.co'));
});

test('hf: tools expose url, manifest, download', () => {
  const names = hf.tools().map((t) => t.name);
  assert.deepEqual(names, ['hf_model_url', 'hf_model_manifest', 'hf_model_download']);
});

test('model_discovery: huggingFacePull remains backward-compatible', () => {
  const r = discovery.huggingFacePull('user/model', 'm.gguf');
  assert.equal(r.ok, true);
  assert.ok(r.url.includes('huggingface.co'));
});

test('model_discovery: huggingFacePull rejects invalid repo', () => {
  const r = discovery.huggingFacePull('../bad');
  assert.equal(r.ok, false);
});

test('model_discovery: exports hfDownload and hfManifest', () => {
  assert.equal(typeof discovery.hfDownload, 'function');
  assert.equal(typeof discovery.hfManifest, 'function');
});
