const test = require('node:test');
const assert = require('node:assert');
const rea = require('../src/rea');
const ghidra = require('../src/ghidra');
const craft = require('../src/craft');
const reIndex = require('../src/re_index');

test('REA status', () => {
  const s = rea.status();
  assert.ok('available' in s);
  assert.ok(Array.isArray(rea.TOOLS));
  assert.ok(rea.TOOLS.length >= 3);
});

test('Ghidra status', () => {
  const s = ghidra.status();
  assert.ok('available' in s);
  assert.ok(Array.isArray(ghidra.TOOLS));
});

test('Craft status', () => {
  const s = craft.status();
  assert.ok('available' in s);
  assert.ok(Array.isArray(craft.TOOLS));
});

test('RE index expanded catalog', () => {
  assert.ok(reIndex.CATALOG.length >= 30);
  assert.ok(reIndex.categories().length >= 5);
  const r = reIndex.search('ghidra');
  assert.ok(r.count > 0);
  const r2 = reIndex.search('', { category: 'Android' });
  assert.ok(r2.count >= 2);
  const r3 = reIndex.search('', { protocol: 'open' });
  assert.ok(r3.count > 0);
});

test('RE index byCategory', () => {
  const bc = reIndex.byCategory();
  assert.ok(bc['RE Tooling'] || bc['Disassembly']);
});
