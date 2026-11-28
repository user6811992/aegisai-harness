const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const bs = require('../src/backend_setup');

test('backend_setup: spec covers installable and manual backends', () => {
  const ollama = bs.spec('ollama');
  assert.equal(ollama.ok, true);
  assert.equal(ollama.binary, 'ollama');
  assert.ok(ollama.install[process.platform]);
  assert.deepEqual(ollama.start, { cmd: 'ollama', args: ['serve'] });
  assert.equal(bs.spec('llamacpp').install, null);
  assert.equal(bs.spec('openai').binary, null);
  assert.equal(bs.spec('nope').ok, false);
});

test('backend_setup: aliases are normalized', () => {
  assert.equal(bs.spec('llama.cpp').type, 'llamacpp');
  assert.equal(bs.spec('LM Studio').type, 'lmstudio');
});

test('backend_setup: ensure requires explicit confirmation', async () => {
  const r = await bs.ensure('ollama', { install: true, start: true });
  assert.equal(r.ok, false);
  assert.match(r.error, /confirmation required/);
});

test('backend_setup: offline mode blocks install', async () => {
  const prev = process.env.AEGISAI_OFFLINE;
  process.env.AEGISAI_OFFLINE = 'true';
  const r = await bs.ensure('ollama', { install: true, confirmed: true });
  assert.equal(r.ok, false);
  assert.match(r.error, /offline/);
  if (prev == null) delete process.env.AEGISAI_OFFLINE; else process.env.AEGISAI_OFFLINE = prev;
});

test('backend_setup: llama.cpp uses official prebuilt binaries and a model path', async () => {
  const s = bs.SPECS.llamacpp;
  assert.deepEqual(s.download.win32, ['win-vulkan-x64', 'win-cpu-x64']);
  assert.ok(s.download.linux.includes('ubuntu-vulkan-x64'));
  assert.ok(bs.knownPaths('llama-server')[0].endsWith('llama-server.exe'));
  const p = await bs.plan('llamacpp');
  assert.ok(Array.isArray(p.download) && p.download.includes('win-vulkan-x64'));
  assert.deepEqual(s.start.args, ['--host', '127.0.0.1', '--port', '8081']);
});

test('backend_setup: status returns structured capability', async () => {
  const s = await bs.status('ollama');
  assert.equal(s.ok, true);
  assert.equal(s.type, 'ollama');
  assert.equal(typeof s.installed, 'boolean');
  assert.equal(typeof s.running, 'boolean');
  assert.equal(typeof s.canInstall, 'boolean');
  assert.ok(s.url.startsWith('http://127.0.0.1'));
});

test('backend_setup: HTTP routes and UI wiring present', () => {
  const root = path.join(__dirname, '..');
  const idx = fs.readFileSync(path.join(root, 'src', 'index.js'), 'utf8');
  const ui = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  const back = fs.readFileSync(path.join(root, 'src', 'backends', 'index.js'), 'utf8');
  assert.ok(idx.includes("'/api/backend/setup'"));
  assert.ok(ui.includes('/api/backend/setup'));
  assert.ok(ui.includes('Install & start'));
  assert.ok(back.includes('No backend is reachable at'));
});
