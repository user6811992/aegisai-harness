const test = require('node:test');
const assert = require('node:assert');
const seq = require('../src/sequential_thinking');
const fetch = require('../src/fetch_url');
const time = require('../src/time_tool');
const mcpReg = require('../src/mcp_registry_browser');
const everything = require('../src/mcp_everything');

test('sequential thinking', () => {
  seq.reset();
  const r = seq.think('first thought', true, 1, 3);
  assert.equal(r.thoughtNumber, 1);
  assert.equal(r.nextThoughtNeeded, true);
  assert.equal(seq.history().length, 1);
});

test('fetch url validates', () => {
  assert.equal(fetch.normalizeUrl('http://127.0.0.1').ok, false);
  assert.equal(fetch.normalizeUrl('https://example.com').ok, true);
});

test('time tool', () => {
  const r = time.now('UTC');
  assert.equal(r.ok, true);
  assert.ok(r.iso);
  assert.ok(Array.isArray(time.listTimezones()));
});

test('mcp registry browser', async () => {
  const r = await mcpReg.browse('test', 1);
  assert.ok('ok' in r);
});

test('everything manifest', () => {
  const m = everything.manifest();
  assert.ok(m.tools.length >= 3);
  assert.equal(everything.handleTool('add', { a: 2, b: 3 }).content[0].text, '5');
});
