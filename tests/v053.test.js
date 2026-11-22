const test = require('node:test');
const assert = require('node:assert');
const privateKb = require('../src/private_kb');
const office = require('../src/office_preview');
const fsRes = require('../src/fs_resources');
const variants = require('../src/variants');
const annotations = require('../src/tool_annotations');
const accessIac = require('../src/access_iac');
const db = require('../src/storage/db');
const os = require('os');
const path = require('path');
const fs = require('fs');
const dir = path.join(os.tmpdir(), 'aegisai-v053-test');
fs.mkdirSync(dir, { recursive: true });
try { db.open(path.join(dir, 'test.db')); } catch (e) {}

test('private KB add/search', () => {
  privateKb.add('doc1', 'React is a JavaScript library for building user interfaces.');
  const r = privateKb.search('React', 5);
  assert.ok(r.length > 0);
  assert.ok(privateKb.list().some((x) => x.name === 'doc1'));
});

test('office preview unsupported', () => {
  const p = path.join(dir, 'x.txt');
  fs.writeFileSync(p, 'hi');
  const r = office.preview(p);
  assert.equal(r.ok, false);
});

test('fs resources list', () => {
  const r = fsRes.list(path.join(__dirname, '..'));
  assert.ok(r.some((x) => x.name === 'package.json'));
});

test('variants pick', () => {
  variants.register('greet', {});
  variants.addVariant('greet', 'hello', 1);
  variants.addVariant('greet', 'hi', 1);
  const v = variants.pick('greet');
  assert.ok(v === 'hello' || v === 'hi');
});

test('tool annotations', () => {
  const a = annotations.annotate('read_file');
  assert.equal(a.readOnlyHint, true);
  const applied = annotations.applyToTools([{ function: { name: 'read_file' } }]);
  assert.ok(applied[0].annotations);
});

test('access IaC parse/apply', () => {
  const rules = accessIac.parse('rules:\n  - agent1 resource1 read\n  - agent2 resource2 write');
  assert.equal(rules.length, 2);
  const r = accessIac.apply(rules);
  assert.equal(r.applied, 2);
});
