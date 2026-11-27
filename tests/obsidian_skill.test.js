const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ob = require('../src/obsidian_skill');
const defaultSkills = require('../src/default_skills');

test('obsidian: parseFrontmatter reads YAML subset', () => {
  const r = ob.parseFrontmatter('---\ntitle: My Note\ntags: [alpha, beta]\npublished: true\n---\n\n# Hello');
  assert.equal(r.meta.title, 'My Note');
  assert.deepEqual(r.meta.tags, ['alpha', 'beta']);
  assert.equal(r.meta.published, true);
  assert.ok(r.body.includes('# Hello'));
});

test('obsidian: parseFrontmatter handles no frontmatter', () => {
  const r = ob.parseFrontmatter('# Just a heading');
  assert.deepEqual(r.meta, {});
  assert.ok(r.body.includes('# Just a heading'));
});

test('obsidian: serializeFrontmatter round-trips', () => {
  const orig = ob.parseFrontmatter('---\ntitle: T\ntags: [a, b]\n---\n\nBody text');
  const out = ob.serializeFrontmatter(orig.meta, orig.body);
  const again = ob.parseFrontmatter(out);
  assert.equal(again.meta.title, 'T');
  assert.deepEqual(again.meta.tags, ['a', 'b']);
  assert.ok(again.body.includes('Body text'));
});

test('obsidian: links extracts wiki links with aliases', () => {
  const r = ob.links('See [[Project A]] and [[Project B|Alias B]].');
  assert.equal(r.length, 2);
  assert.equal(r[0].target, 'Project A');
  assert.equal(r[1].target, 'Project B');
  assert.equal(r[1].alias, 'Alias B');
});

test('obsidian: backlinks finds links case-insensitively', () => {
  const root = path.join(os.tmpdir(), 'aegisai-vault-' + Date.now());
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'a.md'), 'Links to [[Target Note]]');
  fs.writeFileSync(path.join(root, 'b.md'), 'No links here');
  const r = ob.backlinks(root, 'target note');
  assert.ok(r.includes('a.md'));
  assert.ok(!r.includes('b.md'));
  fs.rmSync(root, { recursive: true, force: true });
});

test('obsidian: createCanvas produces valid JSON Canvas', () => {
  const json = ob.createCanvas([{ id: 'n1', text: 'hello' }], [{ from: 'n1', to: 'n2' }]);
  const info = ob.readCanvas(json);
  assert.equal(info.ok, true);
  assert.equal(info.version, 1);
  assert.equal(info.nodes, 1);
  assert.equal(info.edges, 1);
});

test('obsidian: readCanvas rejects invalid JSON', () => {
  const r = ob.readCanvas('not json');
  assert.equal(r.ok, false);
});

test('obsidian: createBase produces a view definition', () => {
  const json = ob.createBase('My Base', { where: 'tags contains "work"' }, ['file.name', 'tags']);
  const r = JSON.parse(json);
  assert.equal(r.name, 'My Base');
  assert.ok(r.views.length > 0);
});

test('obsidian: scanVault lists md/canvas/base files', () => {
  const root = path.join(os.tmpdir(), 'aegisai-vault-scan-' + Date.now());
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'note.md'), '# Note');
  fs.writeFileSync(path.join(root, 'board.canvas'), '{}');
  fs.writeFileSync(path.join(root, 'view.base'), '{}');
  fs.mkdirSync(path.join(root, '.obsidian'));
  fs.writeFileSync(path.join(root, '.obsidian', 'config'), 'ignore');
  const files = ob.scanVault(root);
  assert.ok(files.some((f) => f.name === 'note.md'));
  assert.ok(files.some((f) => f.name === 'board.canvas'));
  assert.ok(!files.some((f) => f.path.includes('.obsidian')));
  fs.rmSync(root, { recursive: true, force: true });
});

test('obsidian: noteToKb extracts text and tags', () => {
  const root = path.join(os.tmpdir(), 'aegisai-vault-kb-' + Date.now());
  fs.mkdirSync(root, { recursive: true });
  const p = path.join(root, 'note.md');
  fs.writeFileSync(p, '---\ntitle: T\ntags: [a]\n---\n\n# Heading\nBody content');
  const r = ob.noteToKb(p);
  assert.equal(r.title, 'T');
  assert.deepEqual(r.tags, ['a']);
  assert.ok(r.text.includes('Body content'));
  fs.rmSync(root, { recursive: true, force: true });
});

test('obsidian: skill is local-only and bundled', () => {
  assert.ok(ob.BODY.includes('Stay local'));
  assert.ok(ob.BODY.includes('JSON Canvas'));
  const s = defaultSkills.get('obsidian-vault');
  assert.ok(s);
  assert.ok(s.body.includes('JSON Canvas'));
});

test('obsidian: MCP tools exposed and dispatch works', () => {
  const names = ob.tools().map((t) => t.name);
  assert.ok(names.includes('vault_scan'));
  assert.ok(names.includes('canvas_info'));
  assert.equal(ob.dispatch('obsidian_skill', {}).name, 'obsidian-vault');
  const r = ob.dispatch('canvas_create', { nodes: [{ id: 'x' }], edges: [] });
  assert.equal(r.ok, true);
});
