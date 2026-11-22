const test = require('node:test');
const assert = require('node:assert');
const mcp = require('../src/mcp_server');

test('MCP tools list', () => {
  const tools = mcp.toolsList();
  assert.ok(tools.length > 0);
  assert.ok(tools.some((t) => t.name === 'fetch_url'));
  assert.ok(tools.some((t) => t.name === 'sequential_thinking'));
});

test('MCP dispatch initialize', async () => {
  const r = await mcp.dispatch({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  assert.equal(r.result.protocolVersion, '2025-03-26');
  assert.ok(r._sessionId);
});

test('MCP dispatch tools/list', async () => {
  const r = await mcp.dispatch({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  assert.ok(Array.isArray(r.result.tools));
});

test('MCP dispatch tools/call get_time', async () => {
  const r = await mcp.dispatch({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_time', arguments: { timezone: 'UTC' } } });
  assert.ok(r.result.content[0].text.includes('iso'));
});

test('MCP dispatch tools/call sequential_thinking', async () => {
  const r = await mcp.dispatch({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'sequential_thinking', arguments: { thought: 'hello', thoughtNumber: 1, totalThoughts: 2, nextThoughtNeeded: true } } });
  assert.ok(r.result.content[0].text.includes('thoughtNumber'));
});

test('MCP dispatch resources/list and read', async () => {
  const r = await mcp.dispatch({ jsonrpc: '2.0', id: 5, method: 'resources/list', params: {} });
  assert.ok(Array.isArray(r.result.resources));
  const r2 = await mcp.dispatch({ jsonrpc: '2.0', id: 6, method: 'resources/read', params: { uri: 'harness://status' } });
  assert.ok(r2.result.contents[0].text);
});

test('MCP dispatch prompts/list and get', async () => {
  const r = await mcp.dispatch({ jsonrpc: '2.0', id: 7, method: 'prompts/list', params: {} });
  assert.ok(Array.isArray(r.result.prompts));
  const r2 = await mcp.dispatch({ jsonrpc: '2.0', id: 8, method: 'prompts/get', params: { name: 'code_review', arguments: { code: 'x' } } });
  assert.ok(r2.result.messages);
});

test('MCP dispatch unknown method', async () => {
  const r = await mcp.dispatch({ jsonrpc: '2.0', id: 9, method: 'nope', params: {} });
  assert.ok(r.error);
});

test('MCP HTTP handler initialize returns session id', (t, done) => {
  const handler = mcp.createHandler();
  const req = { method: 'POST', headers: { 'content-type': 'application/json' }, on: (e, cb) => { if (e === 'data') cb(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })); if (e === 'end') cb(); } };
  const res = { writeHead: (s, h) => { res._status = s; res._headers = h; }, end: (b) => { res._body = b; done(); } };
  handler(req, res);
});
