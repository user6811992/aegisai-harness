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
    return { name: f.name, description: f.description || '', inputSchema: f.parameters || { type: 'object', properties: {} }, annotations: require('./tool_annotations').annotate(f.name) };
  });
  out.push({ name: 'fetch_url', description: 'Fetch a URL and return its content as Markdown.', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } });
  out.push({ name: 'sequential_thinking', description: 'Structured reflective thinking.', inputSchema: { type: 'object', properties: { thought: { type: 'string' } } } });
  out.push({ name: 'get_time', description: 'Current time in a timezone.', inputSchema: { type: 'object', properties: { timezone: { type: 'string' } } } });
  out.push(...require('./graph_mcp').tools());
  // eelbaz-inspired integrations (local-only by default; network tools skipped in offline mode)
  out.push(...require('./model_bridge').tools());
  out.push(...require('./hardware').tools());
  out.push(...require('./lean_verify').tools());
  out.push(...require('./influxdb').tools());
  out.push(...require('./performance_dashboard').tools());
  out.push(...require('./hardware_autotune').tools());
  out.push(...require('./model_registry').tools());
  out.push(...require('./optional_modules').tools());
  out.push(...require('./verification_cert').tools());
  out.push(...require('./dataset').tools());
  out.push(...require('./tool_guardrails').tools());
  out.push(...require('./leanrea_skill').tools());
  out.push(...require('./canbus_skill').tools());
  if (process.env.AEGISAI_OFFLINE !== 'true') {
    out.push(...require('./http_advanced').tools());
    out.push(...require('./hf_download').tools());
  }
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
  // eelbaz-inspired integrations
  if (name.startsWith('model_bridge_')) return { content: [{ type: 'text', text: JSON.stringify(require('./model_bridge').dispatch(name, args)) }] };
  if (name === 'hardware_detect') return { content: [{ type: 'text', text: JSON.stringify(require('./hardware').detect()) }] };
  if (name.startsWith('hardware_autotune')) return { content: [{ type: 'text', text: JSON.stringify(require('./hardware_autotune').dispatch(name, args)) }] };
  if (name.startsWith('model_registry_')) return { content: [{ type: 'text', text: JSON.stringify(require('./model_registry').dispatch(name, args)) }] };
  if (name.startsWith('dataset_')) {
    const r = await require('./dataset').dispatch(name, args);
    return { content: [{ type: 'text', text: JSON.stringify(r) }] };
  }
  if (name.startsWith('tool_guard_')) return { content: [{ type: 'text', text: JSON.stringify(require('./tool_guardrails').dispatch(name, args)) }] };
  if (name.startsWith('leanrea_')) return { content: [{ type: 'text', text: JSON.stringify(require('./leanrea_skill').dispatch(name, args)) }] };
  if (name.startsWith('canbus_')) return { content: [{ type: 'text', text: JSON.stringify(require('./canbus_skill').dispatch(name, args)) }] };
  if (name.startsWith('hf_model_')) {
    if (process.env.AEGISAI_OFFLINE === 'true') return { content: [{ type: 'text', text: 'disabled in offline mode' }], isError: true };
    const r = await require('./hf_download').dispatch(name, args);
    return { content: [{ type: 'text', text: JSON.stringify(r) }], isError: r.ok === false };
  }
  if (name === 'optional_modules_status') return { content: [{ type: 'text', text: JSON.stringify(require('./optional_modules').status()) }] };
  if (name === 'performance_dashboard') return { content: [{ type: 'text', text: JSON.stringify(require('./performance_dashboard').view()) }] };
  if (name.startsWith('certificate_')) {
    const c = name === 'certificate_issue'
      ? require('./verification_cert').issue(args.runId, args, args)
      : require('./verification_cert').verify(args.path || args.cert);
    return { content: [{ type: 'text', text: JSON.stringify(c) }], isError: c.ok === false };
  }
  if (name.startsWith('lean_verify_')) return { content: [{ type: 'text', text: JSON.stringify(require('./lean_verify').dispatch(name, args)) }] };
  if (name === 'metrics_export_influx') return { content: [{ type: 'text', text: JSON.stringify(await require('./influxdb').exportMetrics(args.points || [], args)) }] };
  if (['http_probe_timing', 'http_detect_cdn', 'http_load_test'].includes(name)) {
    if (process.env.AEGISAI_OFFLINE === 'true') return { content: [{ type: 'text', text: 'disabled in offline mode' }], isError: true };
    const r = await require('./http_advanced').dispatch(name, args);
    return { content: [{ type: 'text', text: JSON.stringify(r) }], isError: r.ok === false };
  }
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
      const MAX = parseInt(process.env.AEGISAI_MCP_MAX_BODY || String(2 * 1024 * 1024), 10);
      let body = '';
      let bytes = 0;
      let done = false;
      req.on('data', (c) => {
        if (done) return;
        bytes += c.length;
        if (bytes > MAX) {
          done = true;
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32600, message: 'request body too large' } }));
          req.resume();
          return;
        }
        body += c;
      });
      req.on('error', () => {
        if (done) return;
        done = true;
        try { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32600, message: 'request stream error' } })); } catch (e) {}
      });
      req.on('end', async () => {
        if (done) return;
        done = true;
        let msg;
        try { msg = JSON.parse(body); } catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'parse error' } })); return; }
        // Dispatch error boundary: a throwing tool must not kill the transport.
        let result;
        try {
          result = await dispatch(msg);
        } catch (e) {
          const id = msg && msg.id !== undefined ? msg.id : null;
          try { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32603, message: String((e && e.message) || e) } })); } catch (_) {}
          return;
        }
        if (result === null) { res.writeHead(202, { 'Content-Type': 'application/json' }); res.end(); return; }
        const headers = { 'Content-Type': 'application/json' };
        if (result._sessionId) { headers['Mcp-Session-Id'] = result._sessionId; delete result._sessionId; }
        const sid = req.headers['mcp-session-id'];
        if (sid && sessions.has(sid)) headers['Mcp-Session-Id'] = sid;
        try { res.writeHead(200, headers); res.end(JSON.stringify(result)); } catch (e) {}
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
  const handler = createHandler();
  const expected = () => process.env.AEGISAI_TOKEN || process.env.LOCALAI_TOKEN || '';
  const server = http.createServer((req, res) => {
    const want = expected();
    if (want) {
      const supplied = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '') || (() => { try { return new URL(req.url, 'http://x').searchParams.get('token') || ''; } catch (e) { return ''; } })();
      // Constant-time-ish comparison to avoid length leaks.
      let ok = supplied.length === want.length;
      if (ok) { let diff = 0; for (let i = 0; i < want.length; i++) diff |= supplied.charCodeAt(i) ^ want.charCodeAt(i); ok = diff === 0; }
      if (!ok) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message: 'unauthorized' } })); return; }
    }
    handler(req, res).catch((e) => {
      try { if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: String((e && e.message) || e) } })); } else res.end(); } catch (_) {}
    });
  });
  server.listen(port || 3001, host || '127.0.0.1', () => console.log('MCP server at http://' + (host || '127.0.0.1') + ':' + (port || 3001) + '/mcp' + (expected() ? ' (auth required)' : '')));
  return server;
}

module.exports = { createHandler, dispatch, toolsList, callTool, resourcesList, readResource, promptsList, getPrompt, start, sessions };
