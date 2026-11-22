const test = require('node:test');
const assert = require('node:assert');
const keyless = require('../src/keyless_search');
const sim = require('../src/simulated_approval');
const citations = require('../src/citations');
const netvein = require('../src/netvein_adapter');
const vision = require('../src/vision');
const reindex = require('../src/re_index');
const ast = require('../src/ast_chunk');

test('keyless search engines list', () => {
  assert.ok(keyless.ENGINES.length >= 7);
  assert.ok(keyless.ENGINES.some((e) => e.name === 'brave'));
});

test('simulated approval', () => {
  sim.queue('a1', 'write_file', {});
  assert.equal(sim.simulate('a1').simulated, true);
  assert.equal(sim.decide('a1', true).status, 'approved');
});

test('citations', () => {
  const r = citations.render('See [1](https://example.com) for details.');
  assert.equal(r.text.includes('[1]'), true);
  assert.equal(r.citations[0].url, 'https://example.com');
});

test('netvein adapter status', () => {
  assert.ok('configured' in netvein.status());
});

test('vision image message', () => {
  const m = vision.imageMessage('what is this', [{ data: 'YWJj', mime: 'image/png' }]);
  assert.equal(vision.supportsVision(m), true);
});

test('RE index search', () => {
  assert.ok(reindex.search('ghidra').results.length > 0);
});

test('AST chunking', () => {
  const chunks = ast.chunkProject(require('path').join(__dirname, '..', 'src'), 2);
  assert.ok(Array.isArray(chunks));
});
