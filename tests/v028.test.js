const test = require('node:test');
const assert = require('node:assert');
const shadow = require('../src/shadow_ai');
const discovery = require('../src/harness_discovery');
const marketplace = require('../src/mcp_marketplace');
const templates = require('../src/prompt_templates');
const themes = require('../src/themes');
const spec = require('../src/harness_spec');
const runtime = require('../src/runtime_manager');
const selfImprove = require('../src/self_improve');

test('shadow AI scan returns structure', () => {
  const r = shadow.scan();
  assert.ok(Array.isArray(r.scanned));
  assert.ok(Array.isArray(r.found));
});

test('harness discovery returns array', () => {
  assert.ok(Array.isArray(discovery.discover()));
});

test('MCP marketplace catalog', () => {
  assert.ok(marketplace.list().length > 0);
  assert.ok(marketplace.configEntry('memory'));
});

test('prompt template substitution', () => {
  const out = templates.render('explain', { topic: 'JSON' });
  assert.ok(out.includes('JSON'));
});

test('themes', () => {
  assert.ok(themes.list().includes('dark'));
  assert.ok(themes.color('dark', 'tool', 'x').includes('x'));
});

test('harness spec parse/validate', () => {
  const s = spec.parse('harness:\n  model: llama3.2:3b\n  backend: ollama');
  assert.equal(s.harness.model, 'llama3.2:3b');
  assert.equal(spec.validate(s).ok, true);
});

test('runtime detect returns array', () => {
  assert.ok(Array.isArray(runtime.detect()));
});

test('self-improvement propose', () => {
  assert.ok(Array.isArray(selfImprove.propose()));
});
