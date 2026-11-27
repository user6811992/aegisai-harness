const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const dataset = require('../src/dataset');

function tmpdir(name) {
  const p = path.join(os.tmpdir(), 'aegisai-dataset-' + name + '-' + Date.now());
  fs.mkdirSync(p, { recursive: true });
  return p;
}

const alpaca = { instruction: 'Say hello', input: '', output: 'Hello there' };
const sharegpt = { conversations: [{ from: 'human', value: 'Hi' }, { from: 'gpt', value: 'Hello!' }] };

// ---- render / format detection ----

test('dataset: detectFormat identifies text, alpaca, sharegpt', () => {
  assert.equal(dataset.detectFormat('plain text'), 'text');
  assert.equal(dataset.detectFormat(alpaca), 'alpaca');
  assert.equal(dataset.detectFormat(sharegpt), 'sharegpt');
});

test('dataset: render extracts alpaca fields', () => {
  const r = dataset.render(alpaca);
  assert.ok(r.text.includes('Say hello'));
  assert.ok(r.text.includes('Hello there'));
  assert.equal(r.turns, 2);
  assert.ok(r.words > 0);
});

test('dataset: render extracts sharegpt turns', () => {
  const r = dataset.render(sharegpt);
  assert.equal(r.turns, 2);
  assert.ok(r.text.includes('Hi'));
  assert.ok(r.text.includes('Hello!'));
});

test('dataset: render handles nested generic objects', () => {
  const r = dataset.render({ a: 'foo', b: { c: 'bar' } });
  assert.ok(r.text.includes('foo'));
  assert.ok(r.text.includes('bar'));
});

// ---- loading ----

test('dataset: load JSONL file', async () => {
  const root = tmpdir('load-jsonl');
  const file = path.join(root, 'data.jsonl');
  fs.writeFileSync(file, [alpaca, sharegpt, 'plain'].map((x) => JSON.stringify(x)).join('\n'));
  const r = await dataset.load(file);
  assert.equal(r.items.length, 3);
  assert.equal(r.totalLines, 3);
});

test('dataset: load JSON array with element range', async () => {
  const root = tmpdir('load-json');
  const file = path.join(root, 'data.json');
  fs.writeFileSync(file, JSON.stringify([alpaca, sharegpt, 'plain', 'more']));
  const r = await dataset.load(file, { start: 1, end: 2 });
  assert.equal(r.items.length, 2);
  assert.equal(r.totalItems, 4);
});

test('dataset: load JSONL with element range', async () => {
  const root = tmpdir('load-range');
  const file = path.join(root, 'data.jsonl');
  fs.writeFileSync(file, ['a', 'b', 'c', 'd'].map((x) => JSON.stringify(x)).join('\n'));
  const r = await dataset.load(file, { start: 1, end: 2 });
  assert.deepEqual(r.items, ['b', 'c']);
});

// ---- filtering ----

test('dataset: filter by word count', () => {
  const items = ['one', 'two three four', 'five six'];
  const out = dataset.filter(items, { minWords: 2, maxWords: 3 });
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((x) => x.index), [1, 2]);
});

test('dataset: filter by regex search and match count', () => {
  const items = ['hello world', 'hello hello', 'goodbye'];
  const out = dataset.filter(items, { search: 'hello', regex: true, minMatches: 2 });
  assert.equal(out.length, 1);
  assert.equal(out[0].index, 1);
  assert.equal(out[0].matches, 2);
});

test('dataset: filter by turns', () => {
  const items = [alpaca, sharegpt, 'plain'];
  const out = dataset.filter(items, { minTurns: 2 });
  assert.equal(out.length, 2);
});

test('dataset: filter with invalid regex throws', () => {
  assert.throws(() => dataset.filter(['x'], { search: '[', regex: true }), /invalid search pattern/);
});

test('dataset: filter sorts by chars descending', () => {
  const out = dataset.filter(['a', 'longer text', 'mid'], { sort: { key: 'chars', direction: 'desc' } });
  assert.equal(out[0].item, 'longer text');
});

// ---- ngrams ----

test('dataset: ngram counts frequencies', () => {
  const grams = dataset.ngram(['hello world hello', 'hello there'], 2);
  assert.ok(grams.length > 0);
  assert.equal(grams[0].ng, 'hello world');
  assert.equal(grams[0].cnt, 1);
});

test('dataset: unigram counts', () => {
  const grams = dataset.ngram(['a a a b'], 1);
  assert.equal(grams[0].ng, 'a');
  assert.equal(grams[0].cnt, 3);
});

// ---- dedupe / merge / select ----

test('dataset: dedupe removes exact duplicates', () => {
  const d = dataset.dedupe(['a', 'b', 'a', 'c']);
  assert.equal(d.removed, 1);
  assert.deepEqual(d.items, ['a', 'b', 'c']);
});

test('dataset: dedupe normalized ignores case and punctuation', () => {
  const d = dataset.dedupe(['Hello, World!', 'hello world', 'other'], { normalized: true });
  assert.equal(d.removed, 1);
  assert.equal(d.items.length, 2);
});

test('dataset: merge modes', () => {
  assert.deepEqual(dataset.merge(['a'], ['b']).items, ['a', 'b']);
  assert.deepEqual(dataset.merge(['a'], ['b'], 'replace').items, ['b']);
  assert.deepEqual(dataset.merge(['a', 'b'], ['b'], 'subtract').items, ['a']);
});

test('dataset: select and erase by indices', () => {
  const items = ['a', 'b', 'c', 'd'];
  assert.deepEqual(dataset.select(items, [0, 2]), ['a', 'c']);
  assert.deepEqual(dataset.erase(items, [1, 3]), ['a', 'c']);
});

test('dataset: shuffle is deterministic with seed', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8];
  const a = dataset.shuffle(items, 42);
  const b = dataset.shuffle(items, 42);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, items);
});

// ---- transforms ----

test('dataset: replaceText substring on string items', () => {
  const r = dataset.replaceText(['hello world', 'goodbye'], 'hello', 'hi');
  assert.equal(r.changed, 1);
  assert.equal(r.items[0], 'hi world');
});

test('dataset: replaceText regex supports patterns', () => {
  const r = dataset.replaceText(['visit http://spam.com now', 'clean text'], 'https?://\\S+', '[LINK]', { regex: true });
  assert.equal(r.changed, 1);
  assert.ok(r.items[0].includes('[LINK]'));
  assert.ok(!r.items[0].includes('spam.com'));
});

test('dataset: replaceText dryRun does not modify', () => {
  const r = dataset.replaceText(['hello'], 'hello', 'bye', { dryRun: true });
  assert.equal(r.changed, 1);
  assert.equal(r.items[0], 'hello');
});

test('dataset: replaceField sets and deletes fields', () => {
  const items = [{ a: 1, b: 2 }, { a: 3 }];
  const set = dataset.replaceField(items, 'a', 99);
  assert.equal(set.changed, 2);
  assert.equal(set.items[0].a, 99);
  const del = dataset.replaceField(items, 'b', null);
  assert.equal(del.changed, 1);
  assert.ok(!('b' in del.items[0]));
});

// ---- export / stats / tools ----

test('dataset: exportData JSON and JSONL', () => {
  const items = [{ a: 1 }, { a: 2 }];
  const json = dataset.exportData(items, 'json');
  const jsonl = dataset.exportData(items, 'jsonl');
  assert.deepEqual(JSON.parse(json), items);
  assert.equal(jsonl.trim().split('\n').length, 2);
});

test('dataset: writeExport writes file', () => {
  const root = tmpdir('export');
  const out = path.join(root, 'nested', 'data.jsonl');
  const r = dataset.writeExport(['a', 'b'], out, 'jsonl');
  assert.equal(r.ok, true);
  assert.ok(fs.existsSync(out));
});

test('dataset: stats computes metrics', () => {
  const s = dataset.stats(['one two', 'three four five']);
  assert.equal(s.count, 2);
  assert.equal(s.words, 5);
  assert.equal(s.avgWords, 3);
  assert.ok(s.topNgrams.length > 0);
});

test('dataset: tools expose all 7 MCP tools', () => {
  const names = dataset.tools().map((t) => t.name);
  assert.equal(names.length, 7);
  assert.ok(names.includes('dataset_filter'));
  assert.ok(names.includes('dataset_replace'));
  assert.ok(names.includes('dataset_export'));
});

test('dataset: dispatch dataset_stats works on a file', async () => {
  const root = tmpdir('dispatch');
  const file = path.join(root, 'data.jsonl');
  fs.writeFileSync(file, ['hello world', 'foo bar'].map((x) => JSON.stringify(x)).join('\n'));
  const r = await dataset.dispatch('dataset_stats', { path: file });
  assert.equal(r.count, 2);
  assert.ok(r.words > 0);
});
