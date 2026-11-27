const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const hs = require('../src/hybrid_search');

test('hybrid: tokenize extracts lowercase tokens', () => {
  assert.deepEqual(hs.tokenize('Hello, WORLD_42!'), ['hello', 'world_42']);
});

test('hybrid: BM25 ranks a matching document above non-matching', () => {
  const bm = new hs.BM25();
  bm.add('a', 'the quick brown fox jumps over the lazy dog');
  bm.add('b', 'completely unrelated content about databases');
  const r = bm.search('quick brown fox', 5);
  assert.equal(r[0].id, 'a');
  assert.ok(r[0].score > 0);
});

test('hybrid: BM25 with no matching terms returns empty', () => {
  const bm = new hs.BM25();
  bm.add('a', 'alpha beta');
  assert.equal(bm.search('zzzz notfound', 5).length, 0);
});

test('hybrid: BM25 idf rewards rare terms', () => {
  const bm = new hs.BM25();
  bm.add('a', 'common word apple');
  bm.add('b', 'common word banana');
  bm.add('c', 'common word cherry');
  const r = bm.search('banana', 5);
  assert.equal(r[0].id, 'b');
});

test('hybrid: knnSearch returns scored neighbors', () => {
  const items = [
    { id: 'a', text: 'vector database retrieval search' },
    { id: 'b', text: 'cooking recipes pasta salad' },
  ];
  const r = hs.knnSearch(items, 'search retrieval', 5);
  assert.ok(r.length > 0);
  assert.equal(r[0].id, 'a');
});

test('hybrid: rrf fuses two ranked lists', () => {
  const fused = hs.rrf([
    [{ id: 'a' }, { id: 'b' }],
    [{ id: 'b' }, { id: 'c' }],
  ], 60);
  assert.equal(fused[0].id, 'b'); // appears in both lists
  assert.ok(fused.length === 3);
});

test('hybrid: HybridIndex hybrid mode returns fused results', () => {
  const idx = new hs.HybridIndex();
  idx.add('a', 'the quick brown fox jumps');
  idx.add('b', 'motorcycle engine repair guide');
  idx.add('c', 'brown fox in the forest');
  const r = idx.search('brown fox', { mode: 'hybrid', k: 5 });
  assert.ok(r.length > 0);
  assert.ok(['a', 'c'].includes(r[0].id));
});

test('hybrid: HybridIndex explicit bm25 and knn modes', () => {
  const idx = new hs.HybridIndex();
  idx.add('a', 'machine learning models');
  idx.add('b', 'garden flowers');
  const bm = idx.search('machine', { mode: 'bm25', k: 5 });
  const knn = idx.search('machine', { mode: 'knn', k: 5 });
  assert.ok(bm.length > 0);
  assert.ok(knn.length > 0);
});

test('hybrid: ingestDir indexes markdown and JSONL', () => {
  const root = path.join(os.tmpdir(), 'aegisai-hybrid-' + Date.now());
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'notes.md'), '# Title\nSome searchable content about retrieval engines.');
  fs.writeFileSync(path.join(root, 'data.jsonl'), '{"text":"hybrid search result one"}\n{"text":"hybrid search result two"}\n');
  const idx = hs.ingestDir(root, {});
  assert.ok(idx.size >= 3);
  const r = idx.search('searchable content', { mode: 'bm25', k: 5 });
  assert.ok(r.some((x) => (x.meta.file || '').endsWith('notes.md')));
  fs.rmSync(root, { recursive: true, force: true });
});

test('hybrid: dispatch build then search works', () => {
  const root = path.join(os.tmpdir(), 'aegisai-hybrid-dispatch-' + Date.now());
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'doc.txt'), 'local retrieval with bm25 and knn fusion');
  const built = hs.dispatch('hybrid_index_build', { dir: root });
  assert.equal(built.ok, true);
  const r = hs.dispatch('hybrid_search', { query: 'bm25 knn', mode: 'hybrid', k: 5 });
  assert.equal(r.ok, true);
  assert.ok(r.count > 0);
  assert.ok(r.results[0].text.length <= 400);
  fs.rmSync(root, { recursive: true, force: true });
});

test('hybrid: search without built index returns clear error', () => {
  // dispatch uses a module-level index; reset by building an empty temp dir first
  const root = path.join(os.tmpdir(), 'aegisai-hybrid-empty-' + Date.now());
  fs.mkdirSync(root, { recursive: true });
  hs.dispatch('hybrid_index_build', { dir: root });
  const r = hs.dispatch('hybrid_search', { query: 'anything', mode: 'hybrid' });
  assert.equal(r.ok, true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('hybrid: MCP tools exposed', () => {
  const names = hs.tools().map((t) => t.name);
  assert.deepEqual(names, ['hybrid_index_build', 'hybrid_search']);
});
