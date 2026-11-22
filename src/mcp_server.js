// src/mcp_server.js
// Expose the harness as an MCP server over Streamable HTTP transport (MCP spec 2025-03-26).
const { runAgent } = require('./agent/run');
const { assemble } = require('./tools/registry');

const sessions = new Map();
let sessionCounter = 0;

function newSessionId() { return 'mcp_' + (++sessionCounter) + '_' + Date.now().toString(36); }

function toolsList() {
  const tools = assemble({ includeCoding: true, toolBudget: 64, allowedTools: null, deniedTools: null, externalTools: [], offline: process.env.AEGISAI_OFFLINE === 'true' });
  const out = tools.map((t) => {
    const f = t.function || t;
    return { name: f.name, description: f.description || '', inputSchema: f.parameters || { type: 'object', properties: {} } };
  });
  out.push({ name: 'fetch_url', description: 'Fetch a URL and return its content as Markdown.', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } });
  out.push({ name: 'sequential_thinking', description: 'Structured reflective thinking.', inputSchema: { type: 'object', properties: { thought: { type: 'string' } } } });
  out.push({ name: 'get_time', description: 'Current time in a timezone.', inputSchema: { type: 'object', properties: { timezone: { type: 'string' } } } });
  out.push(...require('./graph_mcp').tools());
  return out;
}

async function callTool(name, args) {
  args = args || {};
  const projectRoot = process.cwd();
  // built-in direct handlers for a curated subset
  if (name === 'get_time') return { content: [{ type: 'text', text: JSON.stringify(require('./time_tool').now(args.timezone)) }] };
  if (['create_entities', 'create_relations', 'add_observations', 'search_nodes', 'read_graph'].includes(name)) return require('./graph_mcp').handle(name, args);
  if (name === 'fetch_url') { const r = await require('./fetch_url').fetch(args.url); return { content: [{ type: 'text', text: r.ok ? r.content : 'error: ' + r.error }], isError: !r.ok }; }
  if (name === 'sequential_thinking') { const r = require('./sequential_thinking').think(args.thought, args.nextThoughtNeeded, args.thoughtNumber, args.totalThoughts, args.isRevision, null, null, args.branchId); return { content: [{ type: 'text', text: JSON.stringify(r) }] }; }
  // generic coding tools
  const coding = require('./tools/coding');
  const result = await coding.execCodingTool(name, args, projectRoot, { autoApprove: true });
  return { content: [{ type: 'text', text: String((result && (result.output || result.out)) || JSON.stringify(result)) }], isError: result && result.ok === false };
}

function resourcesList() {
  return [
    { uri: 'harness://status', name: 'Harness Status', description: 'Current harness status', mimeType: 'application/json' },
    { uri: 'harness://roadmap', name: 'Roadmap', description: 'Project roadmap', mimeType: 'text/markdown' },
  ];
}
async function readResource(uri) {
  if (uri === 'harness://status') return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ version: require('../package.json').version, tools: toolsList().length, pid: process.pid }) }] };
  if (uri === 'harness://roadmap') {
    const fs = require('fs'); const path = require('path');
    let text = '';
    try { text = fs.readFileSync(path.join(__dirname, '..', 'ROADMAP.md'), 'utf8'); } catch (e) {}
    return { contents: [{ uri, mimeType: 'text/markdown', text }] };
  }
  return { contents: [], isError: true };
}

function promptsList() {
  return [
    { name: 'code_review', description: 'Review code', arguments: [{ name: 'code', required: true }] },
    { name: 'explain', description: 'Explain a topic', arguments: [{ name: 'topic', required: true }] },
  ];
}
function getPrompt(name, args) {
  const templates = require('./prompt_templates');
  const rendered = templates.render(name, args || {});
  if (!rendered) return null;
  return { description: name, messages: [{ role: 'user', content: { type: 'text', text: rendered } }] };
}

async function dispatch(msg) {
  const { method, params, id } = msg;
  const reply = (result) => ({ jsonrpc: '2.0', id: id != null ? id : null, result });
  const err = (code, message) => ({ jsonrpc: '2.0', id: id != null ? id : null, error: { code, message } });

  switch (method) {
    case 'initialize': {
      const sid = newSessionId();
      sessions.set(sid, { created: Date.now() });
      return { jsonrpc: '2.0', id, result: { protocolVersion: '2025-03-26', capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false }, prompts: { listChanged: false } }, serverInfo: { name: 'aegisai-harness', version: require('../package.json').version } }, _sessionId: sid };
    }
    case 'notifications/initialized': return null;
    case 'tools/list': return reply({ tools: toolsList() });
    case 'tools/call': {
      const { name, arguments: a } = params || {};
      const r = await callTool(name, a || {});
      return reply(r);
    }
    case 'resources/list': return reply({ resources: resourcesList() });
    case 'resources/read': return reply(await readResource((params || {}).uri));
    case 'prompts/list': return reply({ prompts: promptsList() });
    case 'prompts/get': {
      const r = getPrompt((params || {}).name, (params || {}).arguments);
      if (!r) return err(-32602, 'unknown prompt');
      return reply(r);
    }
    case 'ping': return reply({});
    default: return err(-32601, 'method not found: ' + method);
  }
}

function createHandler() {
  return async (req, res) => {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', async () => {
        let msg;
        try { msg = JSON.parse(body); } catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'parse error' } })); return; }
        const result = await dispatch(msg);
        if (result === null) { res.writeHead(202, { 'Content-Type': 'application/json' }); res.end(); return; }
        const headers = { 'Content-Type': 'application/json' };
        if (result._sessionId) { headers['Mcp-Session-Id'] = result._sessionId; delete result._sessionId; }
        const sid = req.headers['mcp-session-id'];
        if (sid && sessions.has(sid)) headers['Mcp-Session-Id'] = sid;
        res.writeHead(200, headers);
        res.end(JSON.stringify(result));
      });
      return;
    }
    if (req.method === 'GET') {
      // SSE stream for server-initiated messages (optional, keep-alive)
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(': connected\n\n');
      const sid = req.headers['mcp-session-id'];
      if (sid) sessions.set(sid, sessions.get(sid) || { created: Date.now() });
      req.on('close', () => { try { res.end(); } catch (e) {} });
      return;
    }
    if (req.method === 'DELETE') {
      const sid = req.headers['mcp-session-id'];
      if (sid) sessions.delete(sid);
      res.writeHead(200); res.end();
      return;
    }
    res.writeHead(405); res.end();
  };
}

function start(port, host) {
  const http = require('http');
  const server = http.createServer(createHandler());
  server.listen(port || 3001, host || '127.0.0.1', () => console.log('MCP server at http://' + (host || '127.0.0.1') + ':' + (port || 3001) + '/mcp'));
  return server;
}

module.exports = { createHandler, dispatch, toolsList, callTool, resourcesList, readResource, promptsList, getPrompt, start, sessions };
