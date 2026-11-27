const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ap = require('../src/admin_panel_metrics');

test('dashboard: renders HTML panel with metrics', () => {
  const r = ap.dispatch('dashboard_panel');
  assert.equal(r.ok, true);
  assert.ok(r.html.includes('Performance Dashboard'));
  assert.ok(r.html.includes('<table'));
  assert.ok(r.html.includes('AegisAi Harness') || r.html.includes('v1.0.'));
});
test('dashboard: escapes values', () => {
  assert.equal(ap.esc('<x>'), '&lt;x&gt;');
});
test('dashboard: MCP tool registered', () => {
  const mcp = fs.readFileSync(path.join(__dirname,'..','src','mcp_server.js'),'utf8');
  assert.ok(mcp.includes('./admin_panel_metrics'));
  assert.equal(ap.tools()[0].name, 'dashboard_panel');
});
