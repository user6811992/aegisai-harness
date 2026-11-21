const test = require('node:test');
const assert = require('node:assert');
const browser = require('../src/integrations/browser');

test('browser tool definitions present', () => {
  const names = browser.TOOLS.map((t) => t.function.name);
  for (const n of ['browser_navigate', 'browser_snapshot', 'browser_click', 'browser_type', 'browser_eval', 'browser_ax', 'browser_click_ref', 'browser_type_ref']) {
    assert.ok(names.includes(n), 'missing ' + n);
  }
});

test('CDP client parses messages', async () => {
  // mock WebSocket via a fake ws object
  const c = new browser.CDP('ws://fake');
  c.ws = {
    onopen: null, onerror: null, onmessage: null,
    send(msg) {
      const m = JSON.parse(msg);
      const p = c.pending.get(m.id);
      if (p) { c.pending.delete(m.id); p.resolve({ value: 42 }); }
    },
    close() {},
  };
  const r = await c.call('Runtime.evaluate', { expression: '1+1' });
  assert.equal(r.value, 42);
});
