const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const leanrea = require('../src/leanrea_skill');
const defaultSkills = require('../src/default_skills');

test('leanrea: skill has frontmatter-ready fields', () => {
  const s = leanrea.skill();
  assert.equal(s.name, 'lean-rea');
  assert.ok(s.description.length > 20);
  assert.ok(s.body.length > 500);
});

test('leanrea: BODY contains all target types', () => {
  for (const t of ['electron', 'macho', 'go', 'pe', 'apk', 'elf', 'archive', 'network']) {
    assert.ok(leanrea.BODY.includes('### ' + t), 'missing target: ' + t);
  }
});

test('leanrea: BODY includes known traps and no-new-tools rule', () => {
  assert.ok(leanrea.BODY.includes('Known traps'));
  assert.ok(leanrea.BODY.includes('No new tools are registered'));
});

test('leanrea: detectTarget identifies common targets', () => {
  assert.equal(leanrea.detectTarget('app.asar'), 'electron');
  assert.equal(leanrea.detectTarget('tool.exe'), 'pe');
  assert.equal(leanrea.detectTarget('app.apk'), 'apk');
  assert.equal(leanrea.detectTarget('capture.pcap'), 'network');
  assert.equal(leanrea.detectTarget('libfoo.so'), 'elf');
});

test('leanrea: reconFor returns commands for target type', () => {
  const r = leanrea.reconFor('app.asar');
  assert.equal(r.type, 'electron');
  assert.ok(r.commands.length > 0);
  assert.ok(r.commands[0].includes('asar'));
  assert.equal(r.traps.length, leanrea.TRAPS.length);
});

test('leanrea: reconFor unknown target falls back to elf', () => {
  const r = leanrea.reconFor('mystery.unknown');
  assert.equal(r.type, 'elf');
  assert.ok(r.commands.some((c) => c.includes('file')));
});

test('leanrea: availableCommands returns boolean map', () => {
  const c = leanrea.availableCommands();
  assert.ok('file' in c);
  assert.ok('strings' in c);
  assert.equal(typeof c.file, 'boolean');
});

test('leanrea: install writes SKILL.md to data dir', () => {
  const prev = process.env.AEGISAI_DATA_DIR;
  const tmp = path.join(os.tmpdir(), 'aegisai-leanrea-' + Date.now());
  process.env.AEGISAI_DATA_DIR = tmp;
  try {
    // fresh require to pick up new DATA_DIR
    delete require.cache[require.resolve('../src/core/config')];
    const fresh = require('../src/leanrea_skill');
    const r = fresh.install();
    assert.equal(r.ok, true);
    assert.ok(fs.existsSync(r.path));
    const content = fs.readFileSync(r.path, 'utf8');
    assert.ok(content.startsWith('---'));
    assert.ok(content.includes('name: lean-rea'));
  } finally {
    if (prev == null) delete process.env.AEGISAI_DATA_DIR; else process.env.AEGISAI_DATA_DIR = prev;
    delete require.cache[require.resolve('../src/core/config')];
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }
});

test('leanrea: bundled in default skills', () => {
  const s = defaultSkills.get('lean-rea');
  assert.ok(s);
  assert.equal(s.name, 'lean-rea');
  assert.ok(s.body.length > 500);
});

test('leanrea: MCP tools exposed and dispatch works', () => {
  const names = leanrea.tools().map((t) => t.name);
  assert.deepEqual(names, ['leanrea_recon', 'leanrea_skill']);
  assert.equal(leanrea.dispatch('leanrea_recon', { target: 'a.exe' }).type, 'pe');
  assert.equal(leanrea.dispatch('leanrea_skill', {}).name, 'lean-rea');
});
