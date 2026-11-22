const test = require('node:test');
const assert = require('node:assert');
const sim = require('../src/sim_browser');
const security = require('../src/security_layers');
const registry = require('../src/layer_registry');
const gov = require('../src/markdown_governance');
const trace = require('../src/trace_export');
const native = require('../src/native_adapters');

test('simulated browser navigate/snapshot/click', () => {
  const b = new sim.SimBrowser({ '/home': '<a id="go" href="/next">Next</a>' });
  assert.equal(b.navigate('/home').ok, true);
  assert.ok(b.snapshot().includes('Next'));
  assert.equal(b.click('go').url, '/next');
  assert.equal(b.type('go', 'x').ok, false);
});

test('5-layer security posture', () => {
  const p = security.posture();
  assert.equal(p.layers.length, 5);
  assert.ok(p.score >= 0);
});

test('layer registry swap', () => {
  assert.ok(registry.layers().includes('brain'));
  const r = registry.use('sandbox', 'sealed');
  assert.equal(r.ok, true);
  registry.use('sandbox', 'local');
});

test('markdown governance parse', () => {
  const g = gov.parse('## Rules\n- no run_command\n- protect src/generated\n\n## Delegation\n- write_file');
  assert.ok(g.rules.length >= 2);
  const c = gov.toCharter(g);
  assert.ok(c.forbidden_tools.length >= 1);
});

test('trace export status', () => {
  const s = trace.status();
  assert.ok('buffered' in s);
});

test('native adapters status', () => {
  const s = native.status();
  assert.equal(s.inProcessModel.available, false);
  assert.ok('reason' in s.windowsRPA);
});
