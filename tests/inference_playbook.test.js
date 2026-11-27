const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const playbook = require('../src/inference_playbook');
const defaultSkills = require('../src/default_skills');

test('playbook: skill is universal and hardware-agnostic', () => {
  const s = playbook.skill();
  assert.equal(s.name, 'tune-local-inference');
  assert.ok(s.description.includes('ANY hardware'));
  assert.ok(s.body.includes('CPU-only'));
  assert.ok(s.body.includes('Apple Silicon'));
  assert.ok(s.body.includes('multi-GPU'));
  assert.ok(s.body.includes('8 GB GPU'));
});

test('playbook: body teaches measure-one-variable loop', () => {
  assert.ok(playbook.BODY.includes('Change ONE variable'));
  assert.ok(playbook.BODY.includes('Baseline'));
  assert.ok(playbook.BODY.includes('Keep or revert'));
  assert.ok(playbook.BODY.includes('NOT defaults'));
});

test('playbook: hypothesis catalog covers all groups', () => {
  for (const g of ['placement', 'quantization', 'decoding', 'context', 'system']) {
    assert.ok(playbook.HYPOTHESES[g], 'missing group ' + g);
    assert.ok(playbook.HYPOTHESES[g].length > 0);
  }
});

test('playbook: negative results are valued', () => {
  assert.ok(playbook.TRAPS.some((t) => t.toLowerCase().includes('fails')));
});

test('playbook: applicableFor CPU-only returns any+cpu hypotheses', () => {
  const r = playbook.applicableFor('generic', 'Intel Xeon');
  assert.ok(r.tags.includes('any'));
  assert.ok(r.tags.includes('cpu'));
  assert.ok(!r.tags.includes('nvidia'));
  assert.ok(r.groups.placement.length > 0);
});

test('playbook: applicableFor NVIDIA DGX returns nvidia+multi tags', () => {
  const r = playbook.applicableFor('dgx-spark-gb10', 'NVIDIA DGX Spark 4x GPU');
  assert.ok(r.tags.includes('nvidia'));
  assert.ok(r.tags.includes('multi-gpu'));
  assert.ok(r.groups.decoding.some((h) => h.id === 'cuda-graph'));
});

test('playbook: applicableFor Apple Silicon returns apple tag', () => {
  const r = playbook.applicableFor('apple-silicon', 'Apple M4 Max');
  assert.ok(r.tags.includes('apple'));
  assert.ok(!r.tags.includes('nvidia'));
});

test('playbook: experiment record includes provenance fields', () => {
  const e = playbook.experiment({ hardware: 'RX 5700 XT 8GB + 32GB RAM', model: 'qwen3:8b', hypothesis: 'expert-offload', baseline: { tok: 20 }, measured: { tok: 35 }, verdict: 'keep' });
  assert.ok(e.id.startsWith('exp_'));
  assert.equal(e.hardware, 'RX 5700 XT 8GB + 32GB RAM');
  assert.equal(e.verdict, 'keep');
  assert.equal(e.measured.tok, 35);
});

test('playbook: install writes SKILL.md', () => {
  const prev = process.env.AEGISAI_DATA_DIR;
  const tmp = path.join(os.tmpdir(), 'aegisai-playbook-' + Date.now());
  process.env.AEGISAI_DATA_DIR = tmp;
  try {
    delete require.cache[require.resolve('../src/core/config')];
    const fresh = require('../src/inference_playbook');
    const r = fresh.install();
    assert.equal(r.ok, true);
    assert.ok(fs.existsSync(r.path));
    assert.ok(fs.readFileSync(r.path, 'utf8').includes('name: tune-local-inference'));
  } finally {
    if (prev == null) delete process.env.AEGISAI_DATA_DIR; else process.env.AEGISAI_DATA_DIR = prev;
    delete require.cache[require.resolve('../src/core/config')];
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }
});

test('playbook: bundled in default skills', () => {
  const s = defaultSkills.get('tune-local-inference');
  assert.ok(s);
  assert.ok(s.body.includes('ANY hardware'));
});

test('playbook: MCP tools exposed and dispatch works', () => {
  const names = playbook.tools().map((t) => t.name);
  assert.deepEqual(names, ['tune_playbook_skill', 'tune_playbook_hypotheses', 'tune_playbook_record']);
  assert.equal(playbook.dispatch('tune_playbook_hypotheses', { profile: 'generic' }).ok, true);
  assert.equal(playbook.dispatch('tune_playbook_record', {}).verdict, 'pending');
});
