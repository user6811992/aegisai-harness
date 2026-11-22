const test = require('node:test');
const assert = require('node:assert');
const conf = require('../src/mcp_conformance');
const apps = require('../src/mcp_apps');
const tasks = require('../src/mcp_tasks');
const mcpb = require('../src/mcpb');
const interceptors = require('../src/mcp_interceptors');
const uploads = require('../src/mcp_file_uploads');
const skills = require('../src/mcp_skills');
const mcp = require('../src/mcp_server');

test('MCP conformance', () => {
  const r = conf.run({ tools: mcp.toolsList(), resources: mcp.resourcesList(), prompts: mcp.promptsList() });
  assert.equal(r.ok, true);
  assert.equal(conf.validateTool({ name: 'x', inputSchema: { type: 'object' } }).ok, true);
});

test('MCP apps', () => {
  assert.equal(apps.isAppResource('ui://server/view'), true);
  const p = apps.parseAppUri('ui://srv/view?x=1');
  assert.equal(p.server, 'srv');
  assert.equal(p.view, 'view');
  assert.ok(apps.renderTag('ui://x/y').includes('iframe'));
});

test('MCP tasks', () => {
  const t = tasks.create({ name: 'long' });
  assert.equal(t.status, 'working');
  tasks.update(t.id, { status: 'completed', result: 'done' });
  assert.equal(tasks.get(t.id).status, 'completed');
});

test('MCPB install', () => {
  const os = require('os');
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(os.tmpdir(), 'mcpbtest');
  fs.mkdirSync(dir, { recursive: true });
  const bundle = path.join(dir, 'bundle.json');
  fs.writeFileSync(bundle, JSON.stringify({ name: 'test-bundle', command: 'echo', args: ['hi'] }));
  const r = mcpb.install(bundle);
  assert.equal(r.ok, true);
  assert.ok(mcpb.list().some((m) => m.name === 'test-bundle'));
});

test('interceptors', async () => {
  const id = interceptors.register(async (ctx) => ({ ok: true }), { phase: 'pre' });
  const r = await interceptors.runPhase('pre', {});
  assert.equal(r.blocked, false);
  assert.ok(r.results.length > 0);
});

test('file uploads', () => {
  const r = uploads.store({ data: 'aGVsbG8=', filename: 'hello.txt' });
  assert.ok(r.id);
  assert.ok(uploads.get(r.id));
});

test('MCP skills', () => {
  assert.ok(Array.isArray(skills.list()));
});
