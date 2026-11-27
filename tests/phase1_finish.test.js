const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const safeConfig = require('../src/safe_config');
const council = require('../src/council');
const skillSync = require('../src/skill_sync');
const memoryBridge = require('../src/memory_bridge');
const recipes = require('../src/model_recipes');
const reliability = require('../src/reliability_skills');

function tmp(name) { const p = path.join(os.tmpdir(), 'aegisai-p1-' + name + '-' + Date.now()); fs.mkdirSync(p, { recursive: true }); return p; }

// ---- safe_config ----
test('safe_config: validates schema with whitelist', () => {
  const schema = { name: { type: 'string', required: true, maxLength: 20 }, port: { type: 'number', min: 1, max: 65535 }, mode: { type: 'string', enum: ['a','b'] } };
  const r = safeConfig.validate(schema, { name: 'ok', port: 8080, mode: 'a' });
  assert.equal(r.ok, true);
  assert.equal(safeConfig.validate(schema, { name: 'x', port: 0, extra: 1 }).ok, false);
  assert.ok(safeConfig.validate(schema, { name: 'x', port: 1, extra: 1 }).issues.some((i) => i.includes('unknown field')));
});

test('safe_config: atomic write with backup', () => {
  const root = tmp('cfg');
  const p = path.join(root, 'config.json');
  fs.writeFileSync(p, '{"old":true}');
  const r = safeConfig.atomicWrite(p, { new: true }, { backup: true });
  assert.equal(r.ok, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(p, 'utf8')), { new: true });
  assert.ok(fs.existsSync(p + '.bak'));
});

// ---- council ----
test('council: convene returns personas and phases', () => {
  const r = council.convene('Should we open-source?', { mode: 'council' });
  assert.equal(r.ok, true);
  assert.equal(r.personas.length, 4);
  assert.ok(r.verdictSchema.killCriteria);
  assert.ok(r.verdictSchema.dissent);
});

test('council: duo and quick modes', () => {
  assert.equal(council.convene('x', { mode: 'duo' }).personas.length, 2);
  assert.equal(council.convene('x', { mode: 'quick' }).personas.length, 3);
});

// ---- skill_sync ----
test('skill_sync: plan includes harness targets', () => {
  const r = skillSync.plan(['claude', 'codex'], { dryRun: true });
  assert.equal(r.ok, true);
  assert.equal(r.targets.length, 2);
  assert.ok(r.targets.some((t) => t.harness === 'claude'));
});

test('skill_sync: invalid targets ignored', () => {
  const r = skillSync.plan(['nope'], { dryRun: true });
  assert.equal(r.targets.length, 0);
});

// ---- memory_bridge ----
test('memory_bridge: init, append, list, read', () => {
  const root = tmp('mem');
  assert.equal(memoryBridge.init(root).ok, true);
  assert.equal(memoryBridge.appendNote('Project A', '# Heading\nDetail', root).ok, true);
  assert.ok(memoryBridge.notes(root).includes('Project_A.md'));
  const idx = memoryBridge.readIndex(root);
  assert.equal(idx.ok, true);
  assert.ok(idx.text.includes('Project_A'));
});

// ---- model_recipes ----
test('model_recipes: save/list/get', () => {
  const prev = process.env.AEGISAI_DATA_DIR;
  const root = tmp('recipes');
  process.env.AEGISAI_DATA_DIR = root;
  try {
    delete require.cache[require.resolve('../src/core/config')];
    const fresh = require('../src/model_recipes');
    const r = fresh.save({ name: 'qwen-local', model: 'qwen3:8b', runtime: 'ollama', gpu: ['cuda'], context: 8192 });
    assert.equal(r.ok, true);
    assert.ok(fresh.list().some((x) => x.name === 'qwen-local'));
    assert.equal(fresh.get('qwen-local').model, 'qwen3:8b');
    assert.equal(fresh.save({ name: 'bad' }).ok, false);
  } finally {
    if (prev == null) delete process.env.AEGISAI_DATA_DIR; else process.env.AEGISAI_DATA_DIR = prev;
    delete require.cache[require.resolve('../src/core/config')];
  }
});

// ---- reliability_skills ----
test('reliability_skills: list and get loops', () => {
  assert.ok(reliability.list().length >= 9);
  assert.ok(reliability.get('ds-verify-loop').body.includes('Max 5 rounds'));
  assert.ok(reliability.get('ds-unstick').body.includes('shared assumption'));
});

// ---- MCP surface ----
test('phase1: MCP tools registered in server', () => {
  const fs2 = require('fs');
  const mcp = fs2.readFileSync(path.join(__dirname, '..', 'src', 'mcp_server.js'), 'utf8');
  for (const t of ['safe_config', 'council', 'skill_sync', 'memory_bridge', 'model_recipes', 'reliability_skills']) {
    assert.ok(mcp.includes(`./${t}`), `missing ${t} registration`);
  }
});
