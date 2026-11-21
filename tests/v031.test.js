const test = require('node:test');
const assert = require('node:assert');
const a2a = require('../src/a2a');
const voice = require('../src/voice_adapter');
const sealed = require('../src/sealed');
const tenants = require('../src/tenants');

test('A2A agent card and task dispatch', async () => {
  const card = a2a.agentCard();
  assert.equal(card.name, 'aegisai-harness');
  const r = await a2a.sendTask({ prompt: 'say hi' });
  assert.ok(r.id);
  assert.ok(['completed', 'failed'].includes(r.status));
  assert.ok(a2a.getTask(r.id));
});

test('voice adapter status', () => {
  const s = voice.status();
  assert.equal(s.localOnly, true);
});

test('sealed runner available check', () => {
  assert.equal(typeof sealed.available(), 'boolean');
});

test('tenant registry', () => {
  const t = tenants.create('test-tenant-' + Date.now(), { plan: 'free' });
  assert.ok(tenants.get(t.id));
  assert.ok(tenants.list().some((x) => x.id === t.id));
});
