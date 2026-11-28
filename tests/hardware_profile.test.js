const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SRC = path.join(__dirname, '..', 'src');
const originalDataDir = process.env.AEGISAI_DATA_DIR;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aegisai-hwprof-'));
process.env.AEGISAI_DATA_DIR = tmp;
delete require.cache[require.resolve(path.join(SRC, 'core', 'config'))];
delete require.cache[require.resolve(path.join(SRC, 'hardware_profile'))];
const hp = require(path.join(SRC, 'hardware_profile'));

const baseProfile = {
  name: 'my-amd-vulkan',
  backendType: 'llamacpp',
  engine: 'llama.cpp (Vulkan)',
  quant: 'Q4_K_M',
  context: 16384,
  threads: 12,
  gpuLayers: 40,
  host: '127.0.0.1',
  port: 8081,
  model: 'D:\\AiModels\\model.gguf',
  flags: ['--n-gpu-to-vulkan'],
  notes: 'RX 5700 XT 8GB',
};

test('hardware_profile: validation drops unknown and unsafe fields', () => {
  const v = hp.validate({ ...baseProfile, command: 'rm -rf /', flags: ['--ok; curl evil'] });
  assert.equal(v.ok, true);
  assert.equal(v.profile.command, undefined);
  assert.ok(v.warnings.some((w) => w.includes('command')));
  assert.ok(v.warnings.some((w) => w.includes('flags')));
  assert.equal(v.profile.flags, undefined);
  assert.deepEqual(hp.validate(baseProfile).profile.flags, baseProfile.flags);
  const bad = hp.validate({ name: 'x', context: -5 });
  assert.equal(bad.profile.context, undefined);
  assert.ok(bad.warnings.some((w) => w.includes('context')));
});

test('hardware_profile: save, list, get, export, import', () => {
  const s = hp.save('my-amd-vulkan', baseProfile);
  assert.equal(s.ok, true);
  assert.equal(hp.get('my-amd-vulkan').engine, baseProfile.engine);
  assert.equal(hp.list().length, 1);
  const ex = hp.exportProfile('my-amd-vulkan');
  assert.equal(ex.ok, true);
  assert.equal(hp.remove('my-amd-vulkan').ok, true);
  const im = hp.importProfile(ex.json);
  assert.equal(im.ok, true);
  assert.equal(hp.list().length, 1);
});

test('hardware_profile: active profile applies env at startup', () => {
  assert.equal(hp.setActive('my-amd-vulkan').ok, true);
  const applied = hp.applyActive();
  assert.equal(applied.ok, true);
  assert.equal(applied.env.BACKEND_TYPE, 'llamacpp');
  assert.equal(applied.env.BACKEND_URL, 'http://127.0.0.1:8081');
  assert.equal(process.env.AEGISAI_CONTEXT, '16384');
  assert.equal(process.env.AEGISAI_BACKEND_FLAGS, '--n-gpu-to-vulkan');
  const settings = JSON.parse(fs.readFileSync(path.join(tmp, 'settings.json'), 'utf8'));
  assert.equal(settings.BACKEND_TYPE, 'llamacpp');
});

test('hardware_profile: suggest produces a usable profile', () => {
  const s = hp.suggest();
  assert.equal(s.ok, true);
  const v = hp.validate(s.profile);
  assert.equal(v.ok, true);
});

test('hardware_profile: startup loader, routes and MCP tools wired', () => {
  const root = path.join(__dirname, '..');
  const idx = fs.readFileSync(path.join(root, 'src', 'index.js'), 'utf8');
  const mcp = fs.readFileSync(path.join(root, 'src', 'mcp_server.js'), 'utf8');
  const ui = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  assert.ok(idx.includes('./hardware_profile'));
  assert.ok(idx.includes("'/api/hardware-profile'"));
  assert.ok(mcp.includes('./hardware_profile'));
  assert.ok(mcp.includes("name.startsWith('hardware_profile')"));
  assert.ok(ui.includes('/api/hardware-profile'));
});

test.after(() => {
  if (originalDataDir == null) delete process.env.AEGISAI_DATA_DIR;
  else process.env.AEGISAI_DATA_DIR = originalDataDir;
  fs.rmSync(tmp, { recursive: true, force: true });
});
