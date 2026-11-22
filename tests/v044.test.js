const test = require('node:test');
const assert = require('node:assert');
const rag = require('../src/memory_rag');
const lenient = require('../src/lenient_parse');
const url = require('../src/url_validate');
const skills = require('../src/default_skills');
const discovery = require('../src/model_discovery');
const db = require('../src/storage/db');
const os = require('os');
const path = require('path');
const fs = require('fs');
const dir = path.join(os.tmpdir(), 'aegisai-v044-test');
fs.mkdirSync(dir, { recursive: true });
try { db.open(path.join(dir, 'test.db')); } catch (e) {}

test('memory RAG index and search', () => {
  db.saveMemory({ text: 'The sky is blue', source: 'test' });
  const r = rag.search('sky', 5);
  assert.ok(Array.isArray(r));
  assert.equal(rag.reindex().reindexed > 0, true);
});

test('lenient tool parsing', () => {
  const r = lenient.parse('```json\n{"name":"read_file","arguments":{"path":"a"}}\n```');
  assert.ok(r.some((c) => c.name === 'read_file'));
  const r2 = lenient.parse('write_file: {"path":"src/a.js"}');
  assert.ok(r2.some((c) => c.name === 'write_file'));
});

test('URL validation blocks private hosts', () => {
  assert.equal(url.validate('http://127.0.0.1:8080').ok, false);
  assert.equal(url.validate('http://169.254.169.254/latest').ok, false);
  assert.equal(url.validate('https://example.com').ok, true);
});

test('default skills pack', () => {
  const list = skills.list();
  assert.ok(list.length >= 7);
  assert.ok(skills.get('pr-review'));
});

test('model discovery', () => {
  assert.ok(Array.isArray(discovery.scan([dir])));
  assert.ok(discovery.huggingFacePull('user/model').url.includes('huggingface.co'));
});
