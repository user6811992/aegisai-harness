const test = require('node:test');
const assert = require('node:assert');
const mp = require('../src/plugin_marketplace');

test('marketplace categories', () => {
  const cats = mp.categories();
  assert.ok(Array.isArray(cats));
  assert.ok(cats.length > 0);
  assert.ok(cats.includes('development'));
});

test('marketplace search with filters', async () => {
  const r = await mp.search('review', { category: 'development' });
  assert.ok(Array.isArray(r));
  assert.ok(r.length > 0);
  const r2 = await mp.search('', { minRating: 4.5 });
  assert.ok(r2.every((p) => (p.rating || 0) >= 4.5));
});

test('marketplace info', () => {
  const i = mp.info('pr-review');
  assert.ok(i);
  assert.equal(i.name, 'pr-review');
  assert.equal(i.installed, false);
});

test('marketplace install + enable/disable + uninstall', async () => {
  const r = await mp.install('pr-review');
  assert.equal(r.ok, true);
  assert.equal(mp.isInstalled('pr-review'), true);
  const info = mp.getInstalled('pr-review');
  assert.ok(info);
  assert.equal(mp.enable('pr-review').enabled, true);
  assert.equal(mp.disable('pr-review').enabled, false);
  assert.equal(mp.uninstall('pr-review').ok, true);
  assert.equal(mp.isInstalled('pr-review'), false);
});

test('marketplace stats', () => {
  const s = mp.stats();
  assert.ok('installed' in s);
  assert.ok('categories' in s);
  assert.ok('featured' in s);
  assert.ok(s.featured >= 8);
});

test('marketplace install from content', async () => {
  const r = await mp.install('test-plugin', { content: 'module.exports = { hello: () => 42 };', description: 'test', category: 'test' });
  assert.equal(r.ok, true);
  assert.equal(mp.isInstalled('test-plugin'), true);
  mp.uninstall('test-plugin');
});
