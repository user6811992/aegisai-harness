const test = require('node:test');
const assert = require('node:assert');
const providers = require('../src/providers');
const marketplace = require('../src/plugin_marketplace');
const os = require('os');
const path = require('path');
const fs = require('fs');

test('providers list', () => {
  const list = providers.list();
  assert.ok(list.length >= 18);
  assert.ok(list.some((p) => p.id === 'ollama'));
  assert.ok(list.some((p) => p.id === 'anthropic'));
  assert.ok(list.some((p) => p.id === 'gemini'));
});

test('providers local/cloud', () => {
  assert.ok(providers.local().length > 0);
  assert.ok(providers.cloud().length > 0);
  assert.ok(providers.get('groq'));
});

test('provider autoSelect', async () => {
  const r = await providers.autoSelect();
  // may fail if no local provider running; just check shape
  assert.ok('ok' in r);
});

test('plugin marketplace list', () => {
  assert.ok(Array.isArray(marketplace.list()));
});

test('plugin marketplace search', async () => {
  const r = await marketplace.search('');
  assert.ok(Array.isArray(r));
});

test('plugin marketplace install (missing)', async () => {
  const r = await marketplace.install('nonexistent-plugin-xyz');
  assert.equal(r.ok, false);
});

test('plugin marketplace isInstalled', () => {
  assert.equal(marketplace.isInstalled('nonexistent-plugin-xyz'), false);
});
