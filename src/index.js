#!/usr/bin/env node
// src/index.js
const { VERSION } = require('./version');
const { resolvePublicPath, tokenMatches } = require('./http_utils');
const { detectBackend, getType, getUrl } = require('./backends');
const db = require('./storage/db');
const { runAgent } = require('./agent/run');
const mcp = require('./integrations/mcp');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { DATA_DIR, OFFLINE } = require('./core/config');
const profiles = require('./agents/profiles');
const vault = require('./vault');
const skillsImport = require('./skills_import');
const updater = require('./updater');
const backup = require('./backup');
const evalMod = require('./eval');
const { healthCheck, isCircuitOpen } = require('./backends');
const logger = require('./core/logger');

function askApproval(name, args) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    rl.question(`Approve tool "${name}" with args ${JSON.stringify(args).slice(0,200)}? [y/N] `, (ans) => {
      rl.close();
      resolve(/^y(es)?$/i.test((ans || '').trim()));
    });
  });
}

async function main() {
  if (process.argv.includes('--version') || process.argv.includes('-v')) {
    console.log(VERSION);
    process.exit(0);
  }
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log([
      `AegisAi Harness v${VERSION}`,
      '',
      'Usage: node src/index.js [flags] [prompt]',
      '',
      '  --web                 Start the web UI (http://127.0.0.1:8080)',
      '  --tui                 Terminal workbench',
      '  --repl                Interactive REPL (default with no prompt)',
      '  --mcp-server          MCP server on 127.0.0.1:3001',
      '  --json "<prompt>"     Headless JSON output',
      '  --proxy               OpenAI-compatible proxy',
      '  --rpc / --acp / --jsonrpc',
      '  --model <name>        Override model',
      '  --root <path>         Project root',
      '  --version             Print version and exit',
      '  --help                Show this help',
      '',
      'Docs: https://github.com/user6811992/aegisai-harness',
    ].join('\n'));
    process.exit(0);
  }
  await detectBackend();
  logger.info('backend', { type: getType(), url: getUrl() });
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    db.open(path.join(DATA_DIR, 'harness.db'));
    logger.info('db opened', { path: path.join(DATA_DIR, 'harness.db') });
  } catch (e) {
    logger.warn('db open failed; continuing without persistence', { error: String(e.message || e) });
  }

  // connect MCP servers (if configured)
  let mcpTools = [];
  try {
    const clients = await mcp.connectAll();
    mcpTools = mcp.aggregateTools(clients).map((t) => ({
      src: t.src, name: t.name, description: t.description, inputSchema: t.inputSchema,
      remoteName: t.name, client: t.client,
    }));
    if (mcpTools.length) {
      const scan = require('./mcp_security').scanTools(mcpTools);
      if (scan.unsafe.length) {
        logger.warn('mcp tools blocked by security scanner', { count: scan.unsafe.length });
        mcpTools = mcpTools.filter((t) => scan.results.find((r) => r.name === t.name)?.safe);
      }
      logger.info('mcp tools loaded', { count: mcpTools.length });
    }
  } catch (e) {
    logger.warn('mcp connect failed', { error: String(e.message || e) });
  }

  const args = process.argv.slice(2);
  const replFlag = args.includes('--repl');
  const proxyFlag = args.includes('--proxy');
  const updateFlag = args.includes('--update');
  const webFlag = args.includes('--web');
  const jsonFlag = args.includes('--json');
  const contextFlag = args.includes('--context');
  const readOnlyFlag = args.includes('--read-only');
  const piiFlag = args.includes('--pii-redact');
  const amIdx = args.indexOf('--approval-mode');
  const approvalMode = amIdx >= 0 ? args[amIdx + 1] : null;
  const charterFlag = args.includes('--charter');
  const actionGuardFlag = args.includes('--action-guard');
  const rpcFlag = args.includes('--rpc');
  const acpFlag = args.includes('--acp');
  const mcpServerFlag = args.includes('--mcp-server');
  const tuiFlag = args.includes('--tui');
  const autoCommitFlag = args.includes('--auto-commit');

  if (tuiFlag) {
    const tui = require('./tui').launch({ title: 'AegisAi Harness TUI', status: 'ready' });
    tui.on('command', async (cmd) => {
      if (!cmd) return;
      try {
        const r = await runAgent({ model: process.env.AEGISAI_MODEL || 'llama3.2:3b', messages: [{ role: 'user', content: cmd }], projectRoot: process.cwd(), autoApprove: true, onEvent: () => {} });
        tui.addMessage('assistant', (r.final && r.final.final) || '(no reply)');
      } catch (e) { tui.addMessage('assistant', 'Error: ' + (e.message || e)); }
    });
    tui.on('exit', () => { try { process.exit(0); } catch (e) {} });
    return;
  }

  if (mcpServerFlag) {
    const portIdx = args.indexOf('--port');
    const cliPort = portIdx >= 0 ? parseInt(args[portIdx + 1], 10) : 0;
    const port = cliPort || parseInt(process.env.AEGISAI_MCP_PORT || '3001', 10);
    require('./mcp_server').start(port, process.env.HOST || '127.0.0.1');
    return;
  }

  if (acpFlag) {
    const acp = require('./acp').createServer();
    const rlAcp = require('readline').createInterface({ input: process.stdin });
    rlAcp.on('line', async (line) => {
      try { const res = await acp.handle(JSON.parse(line)); process.stdout.write(JSON.stringify(res) + '\n'); }
      catch (e) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }) + '\n'); }
    });
    return;
  }

  if (rpcFlag) {
    const readlineRPC = require('readline').createInterface({ input: process.stdin });
    readlineRPC.on('line', async (line) => {
      try {
        const req = JSON.parse(line);
        const r = await runAgent({ model: req.model || process.env.AEGISAI_MODEL || 'llama3.2:3b', messages: [{ role: 'user', content: req.prompt || '' }], projectRoot: process.cwd(), autoApprove: true, onEvent: () => {} });
        process.stdout.write(JSON.stringify({ id: req.id, final: (r.final && r.final.final) || '', toolLog: r.toolLog || [] }) + '\n');
      } catch (e) { process.stdout.write(JSON.stringify({ error: String(e.message || e) }) + '\n'); }
    });
    return;
  }

  if (webFlag) {
    const http = require('http');
    const path = require('path');
    const port = parseInt(process.env.PORT || '8080', 10);
    const host = process.env.HOST || '127.0.0.1';
    // Read the token per request: /api/config can update it at runtime.
    const currentToken = () => process.env.AEGISAI_TOKEN || process.env.LOCALAI_TOKEN || '';
    const rateLimit = parseInt(process.env.AEGISAI_RATE_LIMIT || '0', 10);
    const rateWindow = parseInt(process.env.AEGISAI_RATE_WINDOW || '60', 10) * 1000;
    const rateHits = new Map();
    const sessions = new Map(); // session id -> messages array
    const sessionToolLogs = new Map(); // session id -> last tool log (for /api/context)
    const sessionUpdated = new Map(); // session id -> ISO timestamp
    const warnMissing = (v) => String(v || 'default');

    // Session persistence: in-memory cache + SQLite fallback so history survives restarts.
    let dbMod = null;
    function dbSafe() { if (!dbMod) { try { dbMod = require('./storage/db'); dbMod.get(); } catch (e) { dbMod = null; } } return dbMod; }
    function rememberSession(sid, msgs) {
      sessions.set(sid, msgs);
      sessionUpdated.set(sid, new Date().toISOString());
      try {
        const firstUser = (msgs || []).find((m) => m.role === 'user');
        const d = dbSafe();
        if (d) d.saveSession({ id: sid, title: firstUser ? String(firstUser.content || '').slice(0, 60) : sid, messages: msgs });
      } catch (e) {}
    }
    function getSessionMessages(sid) {
      if (sessions.has(sid)) return sessions.get(sid);
      try { const d = dbSafe(); const s = d && d.getSession(sid); if (s) { sessions.set(sid, s.messages || []); return s.messages || []; } } catch (e) {}
      return [];
    }
    const pendingActions = new Map();

    function readJson(req) {
      const MAX_BODY = parseInt(process.env.AEGISAI_MAX_BODY_BYTES || '1048576', 10); // 1 MiB default
      return new Promise((resolve, reject) => {
        let body = '';
        let bytes = 0;
        let aborted = false;
        req.on('data', (c) => {
          if (aborted) return;
          bytes += c.length;
          if (bytes > MAX_BODY) { aborted = true; reject(Object.assign(new Error('request body too large'), { status: 413 })); req.resume(); return; }
          body += c;
        });
        req.on('error', (e) => { if (!aborted) { aborted = true; reject(e); } });
        req.on('end', () => { if (aborted) return; try { resolve(JSON.parse(body || '{}')); } catch (e) { reject(Object.assign(e, { status: 400 })); } });
      });
    }
    function sendJson(res, status, obj) {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    }

    // Scope required by a route. Read-only GETs need `read`; anything that
    // executes the agent or mutates state needs `execute`.
    function requiredScope(method, urlPath) {
      if (method !== 'GET') return 'execute';
      // Side-effecting GETs require execute, not read.
      if (urlPath === '/api/probe' || urlPath === '/api/ab-test' || urlPath === '/api/i18n') return 'execute';
      const readOnly = ['/api/version', '/api/config', '/api/models', '/api/models/scan', '/api/models/hf-search',
        '/api/context', '/api/sessions', '/api/sessions/search', '/api/search-sessions', '/api/files', '/api/file',
        '/api/projects', '/api/skills', '/api/memories', '/api/errors', '/api/integrations', '/api/dag-runs',
        '/api/stream', '/api/events'];
      return readOnly.includes(urlPath) ? 'read' : 'read';
    }

    // Filesystem roots the file browser/editor may touch.
    function allowedRoots() {
      const configured = (process.env.AEGISAI_PROJECT_ROOT_ALLOWLIST || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (configured.length) return configured.map((r) => path.resolve(r));
      return [path.resolve(process.cwd())];
    }
    function assertAllowedPath(target) {
      const fs = require('fs');
      const resolved = path.resolve(String(target || ''));
      const roots = allowedRoots();
      // Resolve symlinks/junctions so a link can't escape the allowed root.
      // When the target does not exist yet (e.g. a new file being created),
      // resolve the parent directory instead so junctions are still caught.
      let real = resolved;
      try { real = fs.realpathSync(resolved); }
      catch (e) {
        try { real = path.join(fs.realpathSync(path.dirname(resolved)), path.basename(resolved)); }
        catch (e2) { real = resolved; }
      }
      for (const root of roots) {
        let rootReal = root;
        try { rootReal = fs.realpathSync(root); } catch (e) {}
        const rel = path.relative(rootReal, real);
        if (!rel.startsWith('..') && !path.isAbsolute(rel)) return real;
      }
      throw Object.assign(new Error('path outside allowed roots'), { status: 403 });
    }

    const handleRequest = async (req, res) => {
      // CORS: never wildcard. Reflect only same-host origins; reject cross-site.
      const origin = req.headers.origin;
      const hostHdr = req.headers.host || '';
      if (origin) {
        let originHost = '';
        try { originHost = new URL(origin).host; } catch (e) { originHost = ''; }
        if (originHost && originHost !== hostHdr) { sendJson(res, 403, { error: 'cross-origin request blocked' }); return; }
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
      // ---- auth ----
      // Static assets stay public so a fresh browser can load the UI shell and
      // prompt for a token. Only /api/* and /mcp are gated.
      const urlPathOnly = req.url.split('?')[0];
      const needsAuth = urlPathOnly.startsWith('/api/') || urlPathOnly === '/mcp';
      const expectedToken = currentToken();
      if (expectedToken && needsAuth) {
        const supplied = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '') || new URL(req.url, 'http://x').searchParams.get('token') || '';
        let authorized = tokenMatches(supplied, expectedToken);
        let patScopes = null;
        if (!authorized) {
          // A personal access token may stand in, but only within its scopes.
          try {
            const pats = require('./access_tokens');
            const v = pats.verify ? pats.verify(supplied) : null;
            if (v && v.ok !== false) { authorized = true; patScopes = Array.isArray(v.scopes) ? v.scopes : []; }
          } catch (e) { authorized = false; }
        }
        if (!authorized) { sendJson(res, 401, { error: 'unauthorized' }); return; }
        if (patScopes) {
          // /api/stream performs its own scope check (stream/execute) inside stream_actions.
          if (urlPathOnly !== '/api/stream') {
            const required = requiredScope(req.method, urlPathOnly);
            const allowed = patScopes.includes('*') || patScopes.includes(required) || (required === 'read' && patScopes.includes('execute'));
            if (!allowed) { sendJson(res, 403, { error: 'insufficient_scope', required, granted: patScopes }); return; }
          }
          // Admin-only routes: PATs cannot change auth/backend config.
          if (req.method === 'POST' && (urlPathOnly === '/api/config' || urlPathOnly === '/api/backend')) {
            sendJson(res, 403, { error: 'admin token required' }); return;
          }
        }
      }
      // rate limit — API only; static assets must not consume the API budget
      if (rateLimit > 0 && req.url.split('?')[0].startsWith('/api/')) {
        const ip = req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const arr = (rateHits.get(ip) || []).filter((t) => now - t < rateWindow);
        if (arr.length >= rateLimit) { sendJson(res, 429, { error: 'rate limited' }); return; }
        arr.push(now); rateHits.set(ip, arr);
      }

      try {
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/chat') {
          const parsed = await readJson(req);
          const sid = parsed.sessionId || 'default';
          const history = Array.isArray(parsed.history) ? parsed.history : getSessionMessages(sid);
          const stream = parsed.stream === true;
          const autoApprove = process.env.AEGISAI_WEB_AUTO_APPROVE === 'true';
          if (stream) {
            res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
            let fullReply = '';
            const writeEvent = (obj) => { try { if (!res.writableEnded && !res.destroyed) res.write('data: ' + JSON.stringify(obj) + '\n\n'); } catch (e) {} };
            try {
              const result = await runAgent({
                model: parsed.model || process.env.AEGISAI_MODEL || 'llama3.2:3b',
                messages: history.concat([{ role: 'user', content: parsed.message || '' }]),
                projectRoot: process.cwd(),
                onEvent: (e) => {
                  if (e.type === 'token') { fullReply += (e.content || ''); writeEvent({ type: 'token', content: e.content || '' }); }
                  else if (e.type === 'tool_call') { writeEvent({ type: 'tool_call', name: e.name, args: e.args }); }
                  else if (e.type === 'tool_result') { writeEvent({ type: 'tool_result', preview: (e.preview || '').slice(0, 200) }); }
                  else if (e.type === 'status') { writeEvent({ type: 'status', message: e.message }); }
                },
                autoApprove,
                approvalHandler: async () => false,
              });
              const reply = (result.final && result.final.final) || fullReply;
              const updated = history.concat([{ role: 'user', content: parsed.message || '' }, { role: 'assistant', content: reply }]);
              rememberSession(sid, updated);
              sessionToolLogs.set(sid, result.toolLog || []);
              writeEvent({ type: 'done', reply, toolLog: result.toolLog || [] });
            } catch (err) {
              // Headers already sent: emit an SSE error frame instead of a JSON 500.
              writeEvent({ type: 'error', message: String((err && err.message) || err) });
            }
            try { if (!res.writableEnded) res.end(); } catch (e) {}
            return;
          }
          const result = await runAgent({
            model: parsed.model || process.env.AEGISAI_MODEL || 'llama3.2:3b',
            messages: history.concat([{ role: 'user', content: parsed.message || '' }]),
            projectRoot: process.cwd(),
            onEvent: () => {},
            // Tool execution from the browser is opt-in. Default: no writes.
            autoApprove,
            approvalHandler: async () => false,
          });
          const reply = (result.final && result.final.final) || '';
          const updated = history.concat([{ role: 'user', content: parsed.message || '' }, { role: 'assistant', content: reply }]);
          rememberSession(sid, updated);
          sessionToolLogs.set(sid, result.toolLog || []);
          sessionUpdated.set(sid, new Date().toISOString());
          sendJson(res, 200, { reply, toolLog: result.toolLog || [], pendingActions: pendingActions.get(sid) || [] });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/branch') {
          const parsed = await readJson(req);
          const sid = parsed.sessionId;
          if (!sid) { sendJson(res, 400, { error: 'sessionId required' }); return; }
          const hist = getSessionMessages(sid);
          if (!hist || hist.length === 0) { sendJson(res, 404, { error: 'session not found' }); return; }
          const idx = parsed.index;
          if (idx !== undefined && idx !== null) {
            if (!Number.isInteger(idx) || idx < 0 || idx > hist.length) {
              sendJson(res, 400, { error: 'index must be an integer in [0, ' + hist.length + ']' }); return;
            }
          }
          const i = (idx == null) ? 0 : idx;
          const branched = hist.slice(0, i);
          const newId = sid + '_' + Date.now();
          sessions.set(newId, branched);
          try { require('./storage/db').saveSession({ id: newId, messages: branched, updated: new Date().toISOString() }); } catch (e) {}
          sendJson(res, 200, { id: newId, messages: branched });
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/backends') {
          const { state } = require('./backends');
          sendJson(res, 200, { backends: ['ollama', 'llamacpp', 'lmstudio', 'openai', 'router'], current: state.type });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/backend') {
          const parsed = await readJson(req);
          require('./backends').setBackend(parsed.type);
          sendJson(res, 200, { ok: true, type: parsed.type });
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/models') {
          let models = [];
          try { const r = await require('./backends').backendListModels(); models = r.models || []; } catch (e) {}
          sendJson(res, 200, { models });
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/models/scan') {
          const roots = new URL(req.url, 'http://x').searchParams.get('roots');
          const rootList = roots ? roots.split(',') : undefined;
          const backend = require('./backends').getType();
          const found = require('./model_discovery').scan(rootList, 500, backend);
          // Also list models from the active backend
          try {
            const r = await require('./backends').backendListModels();
            const backendModels = (r.models || []).map((m) => ({ path: backend + '://' + (m.name || m), name: m.name || m, sizeGB: m.size ? +(m.size / 1024 ** 3).toFixed(2) : 0, type: backend }));
            // Only add if not already in found
            const existingNames = new Set(found.map((f) => f.name));
            for (const bm of backendModels) {
              if (!existingNames.has(bm.name)) found.push(bm);
            }
          } catch (e) {}
          sendJson(res, 200, { models: found, backend });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/export') {
          const parsed = await readJson(req);
          const sid = parsed.sessionId || 'default';
          const history = getSessionMessages(sid);
          if (!history || history.length === 0) { sendJson(res, 404, { error: 'session not found or empty' }); return; }
          const format = parsed.format || 'markdown';
          const meta = { title: parsed.title, model: process.env.AEGISAI_MODEL || 'llama3.2:3b', date: new Date().toISOString() };
          let outPath = parsed.outputPath;
          if (outPath) {
            try { outPath = assertAllowedPath(outPath); }
            catch (e) { sendJson(res, e.status || 403, { error: String(e.message || e) }); return; }
          } else {
            const ext = format === 'json' ? '.json' : format === 'pdf' ? '.pdf' : '.md';
            outPath = require('path').join(require('os').tmpdir(), 'conversation-export-' + Date.now() + ext);
          }
          const result = require('./conversation_export').exportToFile(history.map((m) => ({ role: m.role, content: m.content })), meta, format, outPath);
          sendJson(res, 200, result);
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/compare') {
          const parsed = await readJson(req);
          const models = parsed.models || [process.env.AEGISAI_MODEL || 'llama3.2:3b'];
          const result = await require('./model_compare').compare(parsed.prompt || '', models, { projectRoot: process.cwd() });
          const analysis = require('./model_compare').analyze(result);
          sendJson(res, 200, { comparison: result, formatted: require('./model_compare').formatComparison(result), analysis });
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/code-map') {
          const u = new URL(req.url, 'http://x');
          const limit = Math.max(5, Math.min(400, parseInt(u.searchParams.get('limit') || '60', 10) || 60));
          const cacheKey = 'code-map:' + process.cwd() + ':' + limit;
          const fresh = u.searchParams.get('refresh') === '1';
          if (!fresh && global.__codeMapCache && global.__codeMapCache.key === cacheKey && Date.now() - global.__codeMapCache.at < 60000) {
            sendJson(res, 200, global.__codeMapCache.data);
            return;
          }
          try {
            const cm = require('./code_map');
            const files = cm.build(process.cwd(), limit) || [];
            const nodes = [];
            const edges = [];
            const langs = new Set();
            for (const f of files) {
              const rel = require('path').relative(process.cwd(), f.path).split(require('path').sep).join('/');
              nodes.push({ path: rel });
              const ext = require('path').extname(f.path).replace('.', '').toLowerCase();
              if (ext) langs.add(ext);
              for (const call of f.calls || []) {
                const target = require('path').relative(process.cwd(), call.path || call.file || '').split(require('path').sep).join('/');
                if (target && target !== rel) edges.push({ from: rel, to: target, kind: 'call' });
              }
            }
            const data = { nodes, edges: edges.slice(0, 4000), languages: Array.from(langs).sort(), root: process.cwd() };
            global.__codeMapCache = { key: cacheKey, at: Date.now(), data };
            sendJson(res, 200, data);
          } catch (e) { sendJson(res, 500, { error: String(e.message || e), nodes: [], edges: [] }); }
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/probe') {
          const u = new URL(req.url, 'http://x');
          const r = await require('./http_probe').probe(String(u.searchParams.get('url') || ''), { includeHeaders: u.searchParams.get('headers') === '1' });
          sendJson(res, 200, r);
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/pentest-eval') {
          const parsed = await readJson(req);
          const r = await require('./pentest_eval').run({ ids: parsed.ids });
          sendJson(res, 200, r);
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/decide') {
          const parsed = await readJson(req);
          const r = await require('./tiny_router').decide(parsed.question, { model: parsed.model, allowModel: parsed.allowModel });
          sendJson(res, 200, r);
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/deck') {
          const parsed = await readJson(req);
          let out = parsed.path;
          if (out) {
            try { out = assertAllowedPath(out); }
            catch (e) { sendJson(res, e.status || 403, { error: String(e.message || e) }); return; }
          } else {
            out = require('path').join(require('os').tmpdir(), 'deck-' + Date.now() + '.pdf');
          }
          const r = require('./deck').generate(parsed.outline || parsed.slides || [], out, parsed.meta);
          sendJson(res, 200, { ok: true, slides: r.slides, bytes: r.bytes, path: r.path });
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/skill-schema') {
          const u = new URL(req.url, 'http://x');
          const target = u.searchParams.get('path');
          if (!target) { sendJson(res, 400, { error: 'path required' }); return; }
          let allowed;
          try { allowed = assertAllowedPath(target); }
          catch (e) { sendJson(res, e.status || 403, { error: String(e.message || e) }); return; }
          try {
            const r = require('./skill_schema').validateFile(allowed);
            sendJson(res, 200, r);
          } catch (e) { sendJson(res, 500, { error: String(e.message || e) }); }
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/guardrail') {
          const parsed = await readJson(req);
          const r = require('./guardrail_api').evaluate(parsed);
          sendJson(res, 200, r);
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/ioc') {
          const parsed = await readJson(req);
          const ioc = require('./ioc_import');
          if (parsed.content) {
            const p = ioc.parseFeed(parsed.content, parsed.source);
            const r = parsed.persist ? ioc.importToKb(p) : null;
            sendJson(res, 200, { summary: ioc.summarize(p), parsed: p, kb: r });
            return;
          }
          if (parsed.text) { sendJson(res, 200, { hits: require('./security_kb').matchIndicators(parsed.text) }); return; }
          sendJson(res, 400, { error: 'content or text required' });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/security-logs') {
          const parsed = await readJson(req);
          const doc = require('./security_logs').generate({ seed: parsed.seed, perScenario: parsed.perScenario, ids: parsed.ids });
          if (parsed.format === 'jsonl') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end(require('./security_logs').toJsonl(doc)); return; }
          if (parsed.format === 'csv') { res.writeHead(200, { 'Content-Type': 'text/csv' }); res.end(require('./security_logs').toCsv(doc)); return; }
          sendJson(res, 200, Object.assign({}, doc, { expectations: require('./security_logs').expectations(doc) }));
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/agent-cli') {
          sendJson(res, 200, { adapters: require('./agent_cli').detect() });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/package-guard') {
          const parsed = await readJson(req);
          sendJson(res, 200, require('./package_guard').checkCommand(parsed.command || '', { strict: parsed.strict }));
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/channels-extra') {
          sendJson(res, 200, require('./channels_extra').status());
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/ab-test') {
          const u = new URL(req.url, 'http://x');
          const models = (u.searchParams.get('models') || '').split(',').map((s) => s.trim()).filter(Boolean);
          const prompts = (u.searchParams.get('prompts') || u.searchParams.get('prompt') || '').split('||').map((s) => s.trim()).filter(Boolean);
          const trials = parseInt(u.searchParams.get('trials') || '3', 10);
          const r = await require('./ab_testing').run({ models, prompts: prompts.length ? prompts : [''], trials, projectRoot: process.cwd() });
          sendJson(res, 200, r);
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/ab-test') {
          const parsed = await readJson(req);
          const r = await require('./ab_testing').run({ models: parsed.models, prompts: parsed.prompts || [parsed.prompt || ''], trials: parsed.trials, projectRoot: process.cwd() });
          sendJson(res, 200, r);
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/malware-scan') {
          const parsed = await readJson(req);
          const targets = parsed.targets || (parsed.path ? [parsed.path] : []);
          let allowed;
          try { allowed = targets.map((t) => assertAllowedPath(t)); }
          catch (e) { sendJson(res, e.status || 403, { error: String(e.message || e) }); return; }
          sendJson(res, 200, require('./malware_scan').scan(allowed, { recursive: parsed.recursive }));
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/skills-catalog') {
          const r = require('./skills_catalog').loadCatalog();
          sendJson(res, 200, r);
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/skills-catalog/fetch') {
          const parsed = await readJson(req);
          if (!parsed.url) { sendJson(res, 400, { error: 'url required' }); return; }
          // SSRF protection: block private/loopback/link-local hosts.
          try {
            const u = new URL(parsed.url);
            let host = u.hostname.toLowerCase();
            host = host.replace(/\.$/, '');
            host = host.replace(/^\[|\]$/g, '');
            const blocked = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0' ||
                /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
                /^169\.254\./.test(host) || /^127\./.test(host) || host.endsWith('.local') ||
                host === 'localhost.' || host.endsWith('.localhost') ||
                /^\d+$/.test(host) || /^0x/i.test(host) || /^0\d/.test(host) ||
                /^fc/i.test(host) || /^fd/i.test(host) || /^fe80/i.test(host) || /^::ffff:127\./i.test(host);
            if (blocked) { sendJson(res, 403, { error: 'fetching private/loopback addresses is not allowed' }); return; }
            // DNS resolution check.
            try {
              const dns = require('dns');
              const { promisify } = require('util');
              const lookup = promisify(dns.lookup);
              const resolved = await lookup(host);
              const ip = resolved.address;
              if (ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0' ||
                  /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
                  /^169\.254\./.test(ip) || /^127\./.test(ip) || /^fc/i.test(ip) || /^fd/i.test(ip) || /^fe80/i.test(ip)) {
                sendJson(res, 403, { error: 'fetching private/loopback addresses is not allowed' }); return;
              }
            } catch (e) { /* DNS resolution failed, allow (will fail at fetch) */ }
          } catch (e) { sendJson(res, 400, { error: 'invalid url' }); return; }
          try {
            const r = await require('./skills_catalog').fetchCatalog(parsed.url);
            sendJson(res, 200, { count: r.count, fetched: r.skills.length });
          } catch (e) { sendJson(res, 502, { error: String(e.message || e) }); }
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/i18n') {
          const loc = new URL(req.url, 'http://x').searchParams.get('locale') || require('./i18n').getLocale();
          require('./i18n').setLocale(loc);
          sendJson(res, 200, { locale: require('./i18n').getLocale(), available: require('./i18n').available(), strings: {} });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/diff') {
          const parsed = await readJson(req);
          const d = require('./text_diff');
          sendJson(res, 200, { diff: d.diffWords(parsed.a || '', parsed.b || ''), similarity: +d.similarity(parsed.a || '', parsed.b || '').toFixed(3) });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/probe') {
          const parsed = await readJson(req);
          const r = await require('./model_probes').runAgainstBackend(parsed.model, { ids: parsed.ids });
          sendJson(res, 200, parsed.sarif ? { sarif: require('./model_probes').toSarif(r), summary: r.summary } : r);
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/skill-scan') {
          const parsed = await readJson(req);
          if (!parsed.text && !parsed.path) { sendJson(res, 400, { error: 'text or path required' }); return; }
          const target = parsed.text ? null : assertAllowedPath(parsed.path);
          const findings = parsed.text ? require('./skill_scan').scanText(parsed.text, parsed.source || '<inline>') : require('./skill_scan').scanDir(target);
          sendJson(res, 200, { summary: require('./skill_scan').summarize(findings), findings, sarif: parsed.sarif ? require('./skill_scan').toSarif(findings) : undefined });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/secret-scan') {
          const parsed = await readJson(req);
          if (parsed.text == null && !parsed.path) { sendJson(res, 400, { error: 'text or path required' }); return; }
          const text = parsed.text != null ? String(parsed.text) : require('fs').readFileSync(assertAllowedPath(parsed.path), 'utf8');
          const findings = await require('./secret_verify').scan(text, { source: parsed.path || '<inline>', verify: Boolean(parsed.verify), offline: Boolean(parsed.offline) });
          sendJson(res, 200, { summary: require('./secret_verify').summarize(findings), findings: findings.map(({ raw, ...x }) => x) });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/audit') {
          const parsed = await readJson(req);
          const r = await require('./audit_pipeline').run(assertAllowedPath(parsed.path || process.cwd()), {});
          sendJson(res, 200, parsed.sarif ? { summary: r.summary, sarif: require('./audit_pipeline').toSarif(r) } : r);
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/mcp-inspect') {
          const m = require('./mcp_server');
          const r = await require('./mcp_inspect').inspect(m);
          sendJson(res, 200, r);
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/doc-convert') {
          const parsed = await readJson(req);
          if (!parsed.path) { sendJson(res, 400, { error: 'path required' }); return; }
          const r = require('./doc_convert').toMarkdown(assertAllowedPath(parsed.path));
          sendJson(res, 200, { format: r.format, markdown: r.markdown.slice(0, 200000), bytes: r.markdown.length });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/ab') {
          const parsed = await readJson(req);
          const r = await require('./model_compare').abTest(parsed.prompt || '', parsed.models || [], { runs: parsed.runs, projectRoot: process.cwd(), check: parsed.contains ? (t) => String(t).toLowerCase().includes(String(parsed.contains).toLowerCase()) : null });
          sendJson(res, 200, { best: r.best, arms: r.arms.map((a) => ({ model: a.model, passRate: a.passRate, meanDuration: a.meanDuration, meanChars: a.meanChars })), comparisons: r.comparisons });
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/templates') {
          sendJson(res, 200, { templates: require('./conversation_templates').list() });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/handoff') {
          const parsed = await readJson(req);
          const h = require('./handoff');
          if (parsed.register) { sendJson(res, 200, h.register(parsed.register)); return; }
          const r = await h.handoff(parsed.to, parsed.history || [{ role: 'user', content: parsed.message || '' }], { note: parsed.note, projectRoot: process.cwd() });
          sendJson(res, 200, r);
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/file') {
          const parsed = await readJson(req);
          if (!parsed.path) { sendJson(res, 400, { error: 'path required' }); return; }
          let resolved;
          try { resolved = assertAllowedPath(parsed.path); }
          catch (e) { sendJson(res, e.status || 403, { error: String(e.message || e) }); return; }
          try {
            require('fs').writeFileSync(resolved, String(parsed.content == null ? '' : parsed.content), 'utf8');
            sendJson(res, 200, { ok: true, path: resolved, bytes: Buffer.byteLength(String(parsed.content || '')) });
          } catch (e) { sendJson(res, 500, { error: String(e.message || e) }); }
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/models/hf-search') {
          const q = new URL(req.url, 'http://x').searchParams.get('q') || '';
          let results = [];
          try {
            // Search without filter first, then filter for gguf client-side
            const r = await fetch('https://huggingface.co/api/models?search=' + encodeURIComponent(q) + '&sort=downloads&direction=-1&limit=30', { signal: AbortSignal.timeout(15000) });
            if (r.ok) {
              const data = await r.json();
              const all = Array.isArray(data) ? data : [];
              // Filter for GGUF models (have gguf tag or name contains gguf)
              const gguf = all.filter((m) => (m.tags || []).includes('gguf') || (m.id || '').toLowerCase().includes('gguf'));
              // If no gguf results, return all results (user can still see what's available)
              const toShow = gguf.length > 0 ? gguf : all;
              results = toShow.slice(0, 20).map((m) => ({
                id: m.id || m.modelId,
                downloads: m.downloads || 0,
                likes: m.likes || 0,
                tags: m.tags || [],
                isGguf: (m.tags || []).includes('gguf'),
              }));
            }
          } catch (e) { console.error('HF search error:', e.message); }
          sendJson(res, 200, { results, query: q });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/models/pull') {
          const parsed = await readJson(req);
          let ok = false;
          try {
            const r = await fetch(require('./backends').getUrl() + '/api/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: parsed.model }) });
            ok = r.ok;
          } catch (e) {}
          sendJson(res, 200, { ok });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/approve') {
          const parsed = await readJson(req);
          const sid = parsed.sessionId;
          if (!sid) { sendJson(res, 400, { error: 'sessionId required' }); return; }
          const acts = pendingActions.get(sid);
          if (!acts) { sendJson(res, 404, { error: 'session not found' }); return; }
          const idx = parsed.index;
          if (idx == null || !acts[idx]) { sendJson(res, 404, { error: 'pending action not found' }); return; }
          acts[idx].decision = parsed.approve ? 'allow' : 'deny';
          sendJson(res, 200, { ok: true, id: acts[idx].id, decision: acts[idx].decision });
          return;
        }
      } catch (e) { sendJson(res, (e && e.status) || 500, { error: String(e.message || e) }); return; }

      if (req.method === 'GET' && req.url.split('?')[0] === '/api/stream') {
        const u = new URL(req.url, 'http://x');
        require('./stream_actions').stream(u.searchParams.get('token'), u.searchParams.get('prompt') || '', res, { projectRoot: process.cwd() });
        return;
      }
      if (req.method === 'GET' && req.url.split('?')[0] === '/api/profile') {
        sendJson(res, 200, require('./profiler').report());
        return;
      }
      if (req.method === 'POST' && req.url.split('?')[0] === '/api/image-gen') {
        const parsed = await readJson(req);
        if (!parsed.prompt) { sendJson(res, 400, { error: 'prompt required' }); return; }
        let outPath = parsed.output;
        if (outPath) {
          try { outPath = assertAllowedPath(outPath); }
          catch (e) { sendJson(res, e.status || 403, { error: String(e.message || e) }); return; }
        }
        const r = await require('./image_gen').generate(parsed.prompt, { size: parsed.size, output: outPath, url: parsed.url });
        sendJson(res, r.ok ? 200 : 502, r);
        return;
      }
      if (req.method === 'GET' && req.url.split('?')[0] === '/api/snippets') {
        const q = new URL(req.url, 'http://x').searchParams.get('q');
        sendJson(res, 200, { snippets: q ? require('./snippets').search(q) : require('./snippets').list() });
        return;
      }
      if (req.method === 'POST' && req.url.split('?')[0] === '/api/snippets') {
        const parsed = await readJson(req);
        if (!parsed.code && !parsed.name) { sendJson(res, 400, { error: 'code or name required' }); return; }
        const r = require('./snippets').save(parsed);
        sendJson(res, 200, r);
        return;
      }
      if (req.method === 'DELETE' && req.url.split('?')[0] === '/api/snippets') {
        const u = new URL(req.url, 'http://x');
        const id = u.searchParams.get('id');
        if (!id) { sendJson(res, 400, { error: 'id required' }); return; }
        sendJson(res, 200, require('./snippets').remove(id));
        return;
      }
      if (req.method === 'POST' && req.url.split('?')[0] === '/api/sessions/import') {
        const parsed = await readJson(req);
        if (!parsed.session || !parsed.session.id) { sendJson(res, 400, { error: 'session with id required' }); return; }
        const s = parsed.session;
        if (!Array.isArray(s.messages)) { sendJson(res, 400, { error: 'messages must be an array' }); return; }
        for (const m of s.messages) {
          if (!m || typeof m !== 'object' || Array.isArray(m)) { sendJson(res, 400, { error: 'each message must be an object' }); return; }
          if (typeof m.role !== 'string' || typeof m.content !== 'string') { sendJson(res, 400, { error: 'message must have string role and content' }); return; }
        }
        const existing = sessions.get(s.id);
        if (existing) { sendJson(res, 409, { error: 'session already exists; pass overwrite:true to replace' }); return; }
        const d = dbSafe();
        if (d) d.saveSession({ id: s.id, title: s.title || s.id, messages: s.messages, updated: s.updated || new Date().toISOString(), tags: s.tags || [] });
        sessions.set(s.id, s.messages);
        sendJson(res, 200, { ok: true, id: s.id });
        return;
      }
      if (req.method === 'POST' && req.url.split('?')[0] === '/api/webhook') {
        const event = req.headers['x-github-event'] || new URL(req.url, 'http://x').searchParams.get('event') || 'push';
        const parsed = await readJson(req);
        const secret = process.env.AEGISAI_WEBHOOK_SECRET;
        const sig = req.headers['x-hub-signature-256'];
        if (secret && sig) {
          const ok = require('./webhooks').verifySignature(JSON.stringify(parsed), sig, secret);
          if (!ok) { sendJson(res, 401, { error: 'invalid signature' }); return; }
        }
        const r = await require('./webhooks').handle(event, parsed, { projectRoot: process.cwd() });
        sendJson(res, 200, r);
        return;
      }
      if (req.method === 'GET' && req.url.split('?')[0] === '/api/scheduled-tasks') {
        sendJson(res, 200, { tasks: require('./scheduled_tasks').list() });
        return;
      }
      if (req.method === 'POST' && req.url.split('?')[0] === '/api/scheduled-tasks') {
        const parsed = await readJson(req);
        if (!parsed.prompt && !parsed.name) { sendJson(res, 400, { error: 'prompt or name required' }); return; }
        const r = require('./scheduled_tasks').create(parsed);
        sendJson(res, 200, r);
        return;
      }
      if (req.method === 'DELETE' && req.url.split('?')[0] === '/api/scheduled-tasks') {
        const u = new URL(req.url, 'http://x');
        const id = u.searchParams.get('id');
        if (!id) { sendJson(res, 400, { error: 'id required' }); return; }
        sendJson(res, 200, require('./scheduled_tasks').remove(id));
        return;
      }
      if (req.method === 'POST' && req.url.split('?')[0] === '/api/sandbox') {
        const parsed = await readJson(req);
        if (!parsed.code) { sendJson(res, 400, { error: 'code required' }); return; }
        const lang = parsed.language || 'python';
        const r = await require('./code_sandbox').run(parsed.code, lang, { timeout: parsed.timeout, runtime: parsed.runtime });
        sendJson(res, r.ok ? 200 : 400, r);
        return;
      }
      if (req.method === 'GET' && req.url.split('?')[0] === '/api/git-blame') {
        const u = new URL(req.url, 'http://x');
        const filePath = u.searchParams.get('path');
        if (!filePath) { sendJson(res, 400, { error: 'path required' }); return; }
        let allowed;
        try { allowed = assertAllowedPath(filePath); }
        catch (e) { sendJson(res, e.status || 403, { error: String(e.message || e) }); return; }
        const r = require('./git_integration').blame(require('path').dirname(allowed), allowed);
        sendJson(res, r.ok ? 200 : 400, r);
        return;
      }
      if (req.method === 'GET' && req.url.split('?')[0] === '/api/context') {
        const tokenizer = require('./tokenizer');
        const sid = new URL(req.url, 'http://x').searchParams.get('session') || 'default';
        const history = getSessionMessages(sid);
        const tokens = tokenizer.countMessages(history || []);
        const tl = sessionToolLogs.get(sid) || [];
        sendJson(res, 200, { tokens, limit: 8192, ratio: +(tokens / 8192).toFixed(3), compacted: tl.some((t) => t.name === '__compact__') });
        return;
      }
      if (req.url.split('?')[0] === '/mcp') {
        require('./mcp_server').createHandler()(req, res);
        return;
      }
      if (req.method === 'GET' && req.url.split('?')[0] === '/api/search-sessions') {
        const q = (new URL(req.url, 'http://x').searchParams.get('q') || '').toLowerCase();
        const results = [];
        const seen = new Set();
        const scan = (sid, msgs) => {
          for (const m of msgs || []) {
            if ((m.content || '').toLowerCase().includes(q)) {
              results.push({ sessionId: sid, role: m.role, snippet: (m.content || '').slice(0, 140), match: true });
              return;
            }
          }
        };
        // Persisted sessions first so search survives restarts.
        try {
          const d = dbSafe();
          for (const s of (d ? d.listSessions() : [])) {
            if (seen.has(s.id)) continue;
            seen.add(s.id);
            scan(s.id, s.messages);
          }
        } catch (e) {}
        for (const [sid, msgs] of sessions.entries()) {
          if (seen.has(sid)) continue;
          scan(sid, msgs);
        }
        sendJson(res, 200, { results, query: q });
        return;
      }
      if (req.method === 'GET' && req.url.split('?')[0] === '/api/files') {
        let dir;
        try { dir = assertAllowedPath(new URL(req.url, 'http://x').searchParams.get('dir') || process.cwd()); }
        catch (e) { sendJson(res, e.status || 403, { error: String(e.message || e) }); return; }
        let entries = [];
        try {
          const fs = require('fs');
          const path = require('path');
          const items = fs.readdirSync(dir, { withFileTypes: true });
          entries = items.map((e) => ({
            name: e.name,
            type: e.isDirectory() ? 'dir' : 'file',
            size: e.isFile() ? (fs.statSync(path.join(dir, e.name)).size) : 0,
            path: path.join(dir, e.name),
          })).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : (a.type === 'dir' ? -1 : 1)));
        } catch (e) {}
        sendJson(res, 200, { dir, entries });
        return;
      }
      if (req.method === 'GET' && req.url.split('?')[0] === '/api/file') {
        const requested = new URL(req.url, 'http://x').searchParams.get('path');
        if (!requested) { sendJson(res, 400, { error: 'path required' }); return; }
        let filePath;
        try { filePath = assertAllowedPath(requested); }
        catch (e) { sendJson(res, e.status || 403, { error: String(e.message || e) }); return; }
        try {
          const fs = require('fs');
          const MAX_FILE = parseInt(process.env.AEGISAI_MAX_FILE_BYTES || '2097152', 10); // 2 MiB
          const st = fs.statSync(filePath);
          if (st.size > MAX_FILE) { sendJson(res, 413, { error: 'file too large', size: st.size, limit: MAX_FILE }); return; }
          const content = fs.readFileSync(filePath, 'utf8');
          sendJson(res, 200, { content, path: filePath, size: st.size });
        } catch (e) { sendJson(res, 500, { error: String(e.message || e) }); }
        return;
      }
      if (req.method === 'GET' && req.url.split('?')[0] === '/api/projects') {
        const list = require('./projects').list();
        const details = list.map((n) => require('./projects').get(n));
        sendJson(res, 200, { projects: details });
        return;
      }
      if (req.method === 'POST' && req.url.split('?')[0] === '/api/projects') {
        const parsed = await readJson(req);
        const p = require('./projects').create(parsed.name, parsed.instructions);
        sendJson(res, 200, { project: p });
        return;
      }
      if (req.method === 'GET' && req.url.split('?')[0] === '/api/token-dashboard') {
        sendJson(res, 200, require('./token_dashboard').summary());
        return;
      }
      if (req.method === 'GET' && req.url.split('?')[0] === '/api/plugins') {
        sendJson(res, 200, { events: require('./event_bus').bus.events() });
        return;
      }
      if (req.method === 'GET' && req.url.split('?')[0] === '/api/sessions') {
        const u = new URL(req.url, 'http://x');
        const wantId = u.searchParams.get('id');
        if (wantId) {
          const sid = warnMissing(wantId);
          const msgs = getSessionMessages(sid);
          sendJson(res, 200, { id: sid, messages: msgs });
          return;
        }
        const byId = new Map();
        // Persisted sessions first (survive restarts).
        try {
          const d = dbSafe();
          for (const s of (d ? d.listSessions() : [])) {
            byId.set(s.id, { id: s.id, title: s.title || s.id, messages: (s.messages || []).length, updated: s.updated || null, tags: s.tags || [] });
          }
        } catch (e) {}
        // Merge live in-memory sessions (fresher).
        for (const [id, msgs] of sessions.entries()) {
          const firstUser = (msgs || []).find((m) => m.role === 'user');
          byId.set(id, {
            id,
            title: firstUser ? String(firstUser.content || '').slice(0, 60) : id,
            messages: (msgs || []).length,
            updated: sessionUpdated.get(id) || (byId.get(id) || {}).updated || null,
            tags: (byId.get(id) || {}).tags || [],
          });
        }
        const list = Array.from(byId.values()).sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));
        sendJson(res, 200, { sessions: list });
        return;
      }
      if (req.method === 'POST' && req.url.split('?')[0] === '/api/sessions/tags') {
        const parsed = await readJson(req);
        if (!parsed.id) { sendJson(res, 400, { error: 'session id required' }); return; }
        const sid = String(parsed.id);
        const tags = Array.isArray(parsed.tags) ? parsed.tags.map((t) => String(t).trim()).filter(Boolean) : [];
        const d = dbSafe();
        const r = d ? d.setSessionTags(sid, tags) : { ok: false, error: 'db unavailable' };
        sendJson(res, r.ok ? 200 : 404, r);
        return;
      }
      if (req.method === 'GET' && req.url.split('?')[0] === '/api/events') {
        require('./event_stream').subscribe(res, req);
        return;
      }
      try {
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/dag-runs') {
          sendJson(res, 200, { runs: require('./dag').listRuns() });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/dag-run') {
          const parsed = await readJson(req);
          const r = await require('./orchestrator').run(parsed.nodes || [], { projectRoot: process.cwd() });
          sendJson(res, 200, { id: r.id, waves: r.waves, nodes: r.nodes });
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/integrations') {
          sendJson(res, 200, require('./integrations/retools').status());
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/skills') {
          let rows = [];
          try { rows = db.get().prepare('SELECT name, description, created, updated FROM skills ORDER BY updated DESC').all(); } catch (e) {}
          sendJson(res, 200, { skills: rows });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/skills') {
          const parsed = await readJson(req);
          let ok = false;
          try {
            db.get().prepare('INSERT OR REPLACE INTO skills (name, description, code, created, updated) VALUES (?,?,?,?,?)')
              .run(parsed.name, parsed.description || '', parsed.code || '', new Date().toISOString(), new Date().toISOString());
            ok = true;
          } catch (e) {}
          sendJson(res, 200, { ok });
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/memories') {
          let rows = [];
          try { rows = db.listMemories(); } catch (e) {}
          sendJson(res, 200, { memories: rows });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/memories') {
          const parsed = await readJson(req);
          let ok = false;
          try { db.saveMemory({ text: parsed.text, tags: parsed.tags || [] }); ok = true; } catch (e) {}
          sendJson(res, 200, { ok });
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/version') {
          const v = require('./updater');
          let info = v.checkLocal();
          if (!info || typeof info !== 'object') info = {};
          info.version = require('./version').VERSION;
          try { info.node = process.version; } catch (e) {}
          sendJson(res, 200, info);
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/errors') {
          let lines = [];
          try {
            const logPath = path.join(DATA_DIR, 'error.log');
            if (fs.existsSync(logPath)) lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/).slice(-50);
          } catch (e) {}
          sendJson(res, 200, { errors: lines });
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/backup') {
          let data = { ok: false };
          try { data = require('./backup').exportState(); } catch (e) { data = { ok: false, error: String(e.message || e) }; }
          sendJson(res, 200, { backup: data });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/backup/import') {
          const parsed = await readJson(req);
          const data = parsed && parsed.data;
          const keys = (data && typeof data === 'object') ? Object.keys(data) : [];
          const known = keys.filter((k) => require('./backup').TABLES.includes(k));
          if (known.length === 0) { sendJson(res, 400, { error: 'data with at least one known table array required' }); return; }
          let ok = false;
          try { require('./backup').importState(data); ok = true; }
          catch (e) { sendJson(res, 400, { error: String(e.message || e) }); return; }
          sendJson(res, 200, { ok });
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/config') {
          sendJson(res, 200, {
            projectRootAllowlist: process.env.AEGISAI_PROJECT_ROOT_ALLOWLIST || '',
            sttUrl: process.env.STT_URL || '',
            ttsUrl: process.env.TTS_URL || '',
            BACKEND_TYPE: process.env.BACKEND_TYPE || '',
            BACKEND_URL: process.env.BACKEND_URL || '',
            AEGISAI_MODEL: process.env.AEGISAI_MODEL || '',
            REA_BIN: process.env.REA_BIN || '',
            GHIDRA_MCP_URL: process.env.GHIDRA_MCP_URL || '',
            CRAFT_BIN: process.env.CRAFT_BIN || '',
          });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/config') {
          const parsed = await readJson(req);
          if (parsed.projectRootAllowlist !== undefined) process.env.AEGISAI_PROJECT_ROOT_ALLOWLIST = parsed.projectRootAllowlist;
          if (parsed.sttUrl !== undefined) process.env.STT_URL = parsed.sttUrl;
          if (parsed.ttsUrl !== undefined) process.env.TTS_URL = parsed.ttsUrl;
          for (const k of ['BACKEND_TYPE', 'BACKEND_URL', 'AEGISAI_MODEL', 'AEGISAI_TOKEN', 'AEGISAI_WEB_AUTO_APPROVE', 'REA_BIN', 'GHIDRA_MCP_URL', 'CRAFT_BIN']) {
            if (parsed[k] !== undefined) process.env[k] = parsed[k];
          }
          sendJson(res, 200, { ok: true });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/stt') {
          // proxy audio body to configured STT URL (OpenAI-compatible /v1/audio/transcriptions)
          const url = process.env.STT_URL;
          if (!url) { sendJson(res, 400, { error: 'STT_URL not configured' }); return; }
          try {
            const MAX_AUDIO = parseInt(process.env.AEGISAI_MAX_AUDIO_BYTES || '26214400', 10); // 25 MiB
            const chunks = [];
            let total = 0;
            for await (const c of req) { total += c.length; if (total > MAX_AUDIO) { sendJson(res, 413, { error: 'audio too large' }); return; } chunks.push(c); }
            const body = Buffer.concat(chunks);
            const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': req.headers['content-type'] || 'audio/webm' }, body, signal: AbortSignal.timeout(60000) });
            const data = await r.json();
            sendJson(res, 200, { text: data.text || '' });
          } catch (e) { sendJson(res, 500, { error: String(e.message || e) }); }
          return;
        }
      } catch (e) { sendJson(res, 500, { error: String(e.message || e) }); return; }

      // serve static — resolvePublicPath blocks ../ traversal and encoded variants
      let urlPath = req.url.split('?')[0];
      let filePath;
      try { filePath = resolvePublicPath(path.join(__dirname, '..', 'public'), urlPath); }
      catch (e) { res.writeHead(400); res.end(); return; }
      if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const ct = ext === '.html' ? 'text/html'
          : (ext === '.js' || ext === '.mjs') ? 'text/javascript'
          : ext === '.css' ? 'text/css'
          : ext === '.json' ? 'application/json'
          : ext === '.webmanifest' ? 'application/manifest+json'
          : ext === '.svg' ? 'image/svg+xml'
          : ext === '.png' ? 'image/png'
          : ext === '.map' ? 'application/json'
          : 'text/plain';
        res.writeHead(200, { 'Content-Type': ct });
        res.end(fs.readFileSync(filePath));
      } else { res.writeHead(404); res.end(); }
    };
    const server = http.createServer((req, res) => {
      handleRequest(req, res).catch((e) => {
        try {
          if (!res.headersSent) sendJson(res, (e && e.status) || 500, { error: String((e && e.message) || e) });
          else res.end();
        } catch (_) { try { res.end(); } catch (__) {} }
      });
    });
    // Never let a stray rejection kill the web server.
    process.on('unhandledRejection', (e) => { try { console.error('[unhandledRejection]', (e && e.stack) || e); } catch (_) {} });
    server.listen(port, host, () => { console.log('Web UI at http://' + host + ':' + port); try { require('./scheduled_tasks').startScheduler(); } catch (e) {} });
    return;
  }

  if (updateFlag) {
    const url = process.env.AEGISAI_UPDATE_URL;
    const info = url ? await updater.checkRemote(url) : updater.checkLocal();
    console.log(JSON.stringify(info, null, 2));
    process.exit(0);
  }
  const dl = args.indexOf('--update-download');
  if (dl >= 0 && args[dl + 1]) {
    const out = args[dl + 2] || path.join(process.cwd(), 'update-download.bin');
    const r = await updater.downloadUpdate(args[dl + 1], out);
    console.log(JSON.stringify(r));
    process.exit(0);
  }
  // --config <file>
  const ci = args.indexOf('--config');
  if (ci >= 0 && args[ci + 1]) {
    try {
      const cfg = require('./config_toml').loadConfig(args[ci + 1]);
      if (cfg.backend_type) process.env.BACKEND_TYPE = cfg.backend_type;
      if (cfg.backend_url) process.env.BACKEND_URL = cfg.backend_url;
      if (cfg.backend_router_strategy) process.env.BACKEND_ROUTER_STRATEGY = cfg.backend_router_strategy;
      console.log('loaded config:', args[ci + 1]);
    } catch (e) { console.error('config load failed:', e.message); }
  }

  if (proxyFlag) {
    const http = require('http');
    const port = parseInt(process.env.AEGISAI_PROXY_PORT || '4000', 10);
    const host = process.env.HOST || '127.0.0.1';
    const MAX_BODY = parseInt(process.env.AEGISAI_PROXY_MAX_BODY || String(10 * 1024 * 1024), 10);
    const proxyToken = () => process.env.AEGISAI_TOKEN || process.env.LOCALAI_TOKEN || '';
    const sendErr = (res, status, message, type) => {
      try { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { message, type: type || 'invalid_request_error' } })); } catch (e) {}
    };
    const server = http.createServer(async (req, res) => {
      const urlPath = req.url.split('?')[0];
      // Auth when a token is configured.
      const expected = proxyToken();
      if (expected) {
        const supplied = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '') || new URL(req.url, 'http://x').searchParams.get('token') || '';
        if (!tokenMatches(supplied, expected)) { sendErr(res, 401, 'unauthorized', 'authentication_error'); return; }
      }
      if (req.method === 'GET' && (urlPath === '/v1/models' || urlPath === '/models')) {
        let ids = [];
        try { const r = await require('./backends').backendListModels(); ids = (r.models || []).map((m) => m.name || m); } catch (e) {}
        if (!ids.length) ids = [process.env.AEGISAI_MODEL || 'llama3.2:3b'];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ object: 'list', data: ids.map((id) => ({ id, object: 'model', owned_by: 'aegisai' })) }));
        return;
      }
      if (req.method === 'POST' && (urlPath === '/v1/chat/completions' || urlPath === '/chat/completions')) {
        let body = '';
        let bytes = 0;
        let tooBig = false;
        req.on('data', (c) => {
          if (tooBig) return;
          bytes += c.length;
          if (bytes > MAX_BODY) { tooBig = true; sendErr(res, 413, 'request body too large'); return; }
          body += c;
        });
        req.on('end', async () => {
          if (tooBig) return;
          let parsed;
          try { parsed = JSON.parse(body); } catch (e) { sendErr(res, 400, 'invalid JSON body'); return; }
          const model = parsed.model || process.env.AEGISAI_MODEL || 'llama3.2:3b';
          if (parsed.stream) {
            let headersSent = false;
            const send = (obj) => {
              try {
                if (!headersSent) { res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }); headersSent = true; }
                if (!res.writableEnded) res.write('data: ' + JSON.stringify(obj) + '\n\n');
              } catch (e) {}
            };
            try {
              let text = '';
              await runAgent({
                model,
                messages: parsed.messages || [],
                projectRoot: process.cwd(),
                onEvent: (e) => {
                  if (e.type === 'token' && e.content) {
                    text += e.content;
                    send({ id: 'chatcmpl-x', object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: { content: e.content }, finish_reason: null }] });
                  }
                },
                autoApprove: true,
              });
              send({ id: 'chatcmpl-x', object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
              try { if (!res.writableEnded) { res.write('data: [DONE]\n\n'); res.end(); } } catch (e) {}
            } catch (e) {
              if (!headersSent) sendErr(res, 500, String(e.message || e), 'server_error');
              else { try { res.write('data: [DONE]\n\n'); res.end(); } catch (_) {} }
            }
            return;
          }
          try {
            const result = await runAgent({
              model,
              messages: parsed.messages || [],
              projectRoot: process.cwd(),
              onEvent: () => {},
              autoApprove: true,
            });
            const resp = { id: 'chatcmpl-' + Date.now(), object: 'chat.completion', created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, message: { role: 'assistant', content: (result.final && result.final.final) || '' }, finish_reason: 'stop' }] };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(resp));
          } catch (e) { sendErr(res, 500, String(e.message || e), 'server_error'); }
        });
        return;
      }
      sendErr(res, 404, 'not found', 'invalid_request_error');
    });
    server.listen(port, host, () => console.log('Proxy listening on http://' + host + ':' + port));
    return;
  }

  if (args.length === 0 || replFlag) {
    console.log('AegisAi Harness v' + VERSION + ' REPL. Type /exit to quit, /help for commands.');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'harness> ' });
    let model = process.env.AEGISAI_MODEL || 'llama3.2:3b';
    let root = process.cwd();
    let sandbox = false;
    let autoApprove = process.env.AEGISAI_AUTO_APPROVE === 'true';
    let offline = OFFLINE;
    let approvalMode = process.env.AEGISAI_APPROVAL_MODE || null;
    let lastToolLog = [];
    global.__dbg = new (require('./debugger').HarnessDebugger)();
    const runOne = async (prompt) => {
      const result = await runAgent({
        model, messages: [{ role: 'user', content: prompt }], projectRoot: root,
        onEvent: (e) => { if (e.type === 'token') process.stdout.write(e.content || ''); else if (e.type === 'status') process.stderr.write('[status] ' + e.message + '\n'); },
        mcpTools, sandbox, autoApprove, offline,
        approvalHandler: autoApprove ? null : askApproval,
        tokenBudgetTotal: parseInt(process.env.AEGISAI_TOKEN_BUDGET_TOTAL || '0', 10),
        contextFiles: true,
        debuggerInstance: global.__dbg,
        approvalMode,
        autoCommit: autoCommitFlag,
      });
      lastToolLog = result.toolLog || [];
      process.stdout.write('\n');
      console.log('--- final ---');
      console.log(result.final.final);
    };
    rl.prompt();
    rl.on('line', async (line) => {
      try {
      const t = line.trim();
      if (!t) { rl.prompt(); return; }
      if (t === '/exit' || t === '/quit') { rl.close(); return; }
      if (t === '/help') {
        const groups = [
          ['Session', ['/exit', '/model <name>', '/root <path>', '/sandbox on|off', '/autoapprove on|off', '/offline on|off', '/agent <name>', '/plan <goal>']],
          ['Index & replay', ['/index', '/replay <sessionId>', '/traces', '/search-sessions <q>', '/session-export <id>|<format>']],
          ['Health & data', ['/health', '/backup <file>', '/restore <file>', '/vault set|get|list|delete ...', '/metrics', '/score', '/reliability']],
          ['Eval & bench', ['/eval add|run|list', '/pass-at-k', '/bench <models...>', '/failure-clusters', '/lint', '/stress']],
          ['Models', ['/providers', '/provider-list', '/model-scan', '/models', '/cheapest <prompt>', '/cost-route', '/routing-eval']],
          ['Memory', ['/remember <text>', '/recall <q>', '/reflect', '/sremember', '/srecall', '/tremember', '/tasof', '/memory-graph', '/habits', '/geo-wake', '/mem-reindex']],
          ['Memory (graph)', ['/graph-observe', '/graph-recall', '/graph-prompt', '/mem-md-search', '/memory-hierarchy']],
          ['Governance', ['/charter', '/governance', '/constitution', '/constitution-propose', '/constitution-decide', '/policy', '/auto-rules', '/ahp-check', '/security-layers', '/identity-list']],
          ['Audit & evidence', ['/ledger-verify', '/ledger-replay', '/ledger-rewind', '/merkle-root', '/evidence-bundle', '/contract-save', '/contract-check', '/contracts', '/honesty', '/waste', '/diagnose', '/evolve']],
          ['Orchestration', ['/dag <json|file>', '/dag-runs', '/critique <text>', '/board', '/board-add', '/task-create', '/task-update', '/tasks', '/team-create', '/team-run', '/teams', '/swarm <plan>', '/schedule', '/sched-tick']],
          ['Tools', ['/tools', '/tool-contract', '/tool-eval', '/tool-state', '/equipment', '/equipment-add', '/semantic-tools <q>', '/mcp-pins', '/mcp-registry', '/mcp-market']],
          ['Security & RE', ['/vuln-scan <path>', '/security-kb', '/sarif <path>', '/pentest <target>', '/rea-status', '/ghidra-status', '/craft-status', '/re-search <q>', '/re-categories', '/re-online <q>']],
          ['Browser & web', ['/browser-targets', '/browser-nav <url>', '/browser-snapshot', '/browser-eval <js>', '/extract <url>', '/search <q>', '/multi-search <q>', '/fetch <url>', '/squeeze <url>|<q>']],
          ['Workspace', ['/git-status', '/git-diff', '/git-branch', '/git-log', '/git-stash', '/git-show', '/diff-review', '/review-start', '/project-create', '/projects', '/project-add-doc', '/ctxfs', '/files']],
          ['Batch 4', ['/probe-http <url>', '/pentest-eval', '/decide <question>', '/deck <outline|file>|<out>', '/skill-schema <path>', '/guardrail <tool>|<json args>', '/ioc <file>|persist', '/sec-logs [seed]|[n]|[out]', '/agent-cli', '/package-guard <command>', '/channels-extra', '/rename <lang>|<file>|<line>|<col>|<newName>|apply', '/map']],
          ['Misc', ['/time', '/export <format>|<title>', '/compare <prompt>|<model1>|<model2>', '/ui-record', '/ui-replay', '/plugins-ui', '/dag-ui', '/trajectory-ui', '/backup', '/help']],
        ];
        console.log('\nAegisAi Harness — command reference\n');
        for (const [g, cmds] of groups) {
          console.log(g + ':');
          console.log('  ' + cmds.join(', '));
        }
        console.log('\nType /<command> to run. Many commands accept "|" separated arguments.');
        rl.prompt(); return;
      }
      if (t.startsWith('/model ')) { model = t.slice(7).trim(); console.log('model =', model); rl.prompt(); return; }
      if (t.startsWith('/root ')) { root = t.slice(6).trim(); console.log('root =', root); rl.prompt(); return; }
      if (t.startsWith('/sandbox ')) { sandbox = t.slice(9).trim() === 'on'; console.log('sandbox =', sandbox); rl.prompt(); return; }
      if (t.startsWith('/autoapprove ')) { autoApprove = t.slice(13).trim() === 'on'; console.log('autoApprove =', autoApprove); rl.prompt(); return; }
      if (t.startsWith('/offline ')) { offline = t.slice(9).trim() === 'on'; console.log('offline =', offline); rl.prompt(); return; }
      if (t.startsWith('/agent ')) { const p = profiles.getProfile(t.slice(7).trim()); model = p.model || model; /* apply profile defaults */ console.log('agent =', p.name); rl.prompt(); return; }
      if (t === '/index') { const ci = require('./indexing/codeindex'); ci.ensureSchema(db.get()); const n = ci.indexProject(root, db.get()); console.log('indexed symbols:', n); rl.prompt(); return; }
      if (t.startsWith('/replay ')) { const r = require('./replay'); const res = await r.replaySession(t.slice(8).trim(), { projectRoot: root }); console.log(JSON.stringify(res.replayed.final, null, 2).slice(0, 500)); rl.prompt(); return; }
      if (t.startsWith('/skill import ')) { const r = skillsImport.importSkill(t.slice(14).trim()); console.log('imported skill:', r.name); rl.prompt(); return; }
      if (t.startsWith('/skill auto ')) { const name = t.slice(12).trim(); const r = require('./skill_auto').autoCreateSkill(name, [], 'auto'); console.log('auto skill:', r); rl.prompt(); return; }
      if (t.startsWith('/policy')) { console.log(JSON.stringify(require('./policy').loadPolicies(), null, 2).slice(0, 1000)); rl.prompt(); return; }
      if (t.startsWith('/capture ')) { const parts = t.slice(9).trim().split('|').map((s) => s.trim()); const id = require('./capture').recordEpisode(parts[0] || 'note', parts[1] || '', parts[2] || ''); console.log('recorded', id); rl.prompt(); return; }
      if (t === '/episodes') { console.log(JSON.stringify(require('./capture').listEpisodes(20), null, 2).slice(0, 1000)); rl.prompt(); return; }
      if (t === '/update') { const info = updater.checkLocal(); console.log(JSON.stringify(info)); rl.prompt(); return; }
      if (t === '/score') { console.log(JSON.stringify(require('./harness_score').score())); rl.prompt(); return; }
      if (t === '/reliability') { console.log(JSON.stringify(require('./reliability').report())); rl.prompt(); return; }
      if (t === '/events') { console.log(JSON.stringify(require('./alwayson').events())); rl.prompt(); return; }
      if (t === '/timers') { console.log(JSON.stringify(require('./alwayson').dueTimers())); rl.prompt(); return; }
      if (t === '/outbox') { console.log(JSON.stringify(require('./alwayson').outboxItems())); rl.prompt(); return; }
      if (t.startsWith('/emit ')) { const id = require('./alwayson').emit(t.slice(6).trim().split(' ')[0], { text: t.slice(6).trim() }); console.log('emitted', id); rl.prompt(); return; }
      if (t.startsWith('/remember ')) { const r = require('./decision_memory').remember(t.slice(10).trim()); console.log('remembered', r.id); rl.prompt(); return; }
      if (t.startsWith('/recall ')) { const r = await require('./decision_memory').recall(t.slice(8).trim()); console.log(r); rl.prompt(); return; }
      if (t === '/reflect') { const r = await require('./decision_memory').reflect(); console.log(r); rl.prompt(); return; }
      if (t.startsWith('/plan ')) { const r = await runAgent({ model: process.env.AEGISAI_MODEL || 'llama3.2:3b', messages: [{ role: 'user', content: t.slice(6).trim() }], projectRoot: root, planMode: true, onEvent: () => {}, autoApprove: true }); console.log(r.final.final); rl.prompt(); return; }
      if (t.startsWith('/dag ')) {
        const spec = t.slice(5).trim();
        let nodes;
        try { nodes = JSON.parse(fs.existsSync(spec) ? fs.readFileSync(spec, 'utf8') : spec); } catch (e) { console.log('invalid DAG JSON'); rl.prompt(); return; }
        const r = await require('./orchestrator').run(nodes, { projectRoot: root });
        console.log(JSON.stringify({ id: r.id, waves: r.waves, retries: r.retries, outputs: Object.keys(r.results) }, null, 2));
        rl.prompt(); return;
      }
      if (t === '/dag-runs') { console.log(JSON.stringify(require('./dag').listRuns(), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/critique ')) { const r = await require('./critic').critique('manual', t.slice(10).trim()); console.log(JSON.stringify(r, null, 2)); rl.prompt(); return; }
      if (t === '/browser-targets') { console.log(JSON.stringify(await require('./integrations/browser').targets(), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/browser-nav ')) { const r = await require('./integrations/browser').handle('browser_navigate', { url: t.slice(13).trim() }); console.log(JSON.stringify(r)); rl.prompt(); return; }
      if (t === '/browser-snapshot') { const r = await require('./integrations/browser').handle('browser_snapshot', {}); console.log(r.output); rl.prompt(); return; }
      if (t.startsWith('/browser-eval ')) { const r = await require('./integrations/browser').handle('browser_eval', { expression: t.slice(14).trim() }); console.log(r.output); rl.prompt(); return; }
      if (t.startsWith('/search-engines ')) { const r = await require('./keyless_search').search(t.slice(16).trim(), undefined, 8); console.log(JSON.stringify(r, null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t === '/engines') { console.log(JSON.stringify(require('./keyless_search').ENGINES.map((e) => e.name))); rl.prompt(); return; }
      if (t.startsWith('/sim-approve ')) { const p = t.slice(13).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(require('./simulated_approval').queue(p[0], p[1] || 'tool', {}))); rl.prompt(); return; }
      if (t.startsWith('/sim-result ')) { console.log(JSON.stringify(require('./simulated_approval').simulate(t.slice(12).trim()))); rl.prompt(); return; }
      if (t.startsWith('/citations ')) { console.log(JSON.stringify(require('./citations').render(t.slice(11).trim()), null, 2)); rl.prompt(); return; }
      if (t === '/netvein-status') { console.log(JSON.stringify(require('./netvein_adapter').status(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/vision-test ')) { console.log(JSON.stringify(require('./vision').imageMessage(t.slice(13).trim(), []))); rl.prompt(); return; }
      if (t.startsWith('/re-index ')) { console.log(JSON.stringify(require('./re_index').search(t.slice(10).trim()), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t === '/ast-chunks') { const c = require('./ast_chunk').chunkProject(root, 5); console.log(JSON.stringify(c.slice(0, 3), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/mem-search ')) { console.log(JSON.stringify(require('./memory_rag').search(t.slice(12).trim()), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t === '/mem-reindex') { console.log(JSON.stringify(require('./memory_rag').reindex())); rl.prompt(); return; }
      if (t.startsWith('/mem-extract ')) { console.log(JSON.stringify(await require('./memory_extract').extract([{ role: 'user', content: t.slice(13).trim() }]), null, 2).slice(0, 1200)); rl.prompt(); return; }
      if (t === '/model-scan') { console.log(JSON.stringify(require('./model_discovery').scan(), null, 2).slice(0, 1800)); rl.prompt(); return; }
      if (t.startsWith('/hf-pull ')) { console.log(JSON.stringify(require('./model_discovery').huggingFacePull(t.slice(9).trim()))); rl.prompt(); return; }
      if (t.startsWith('/lenient ')) { console.log(JSON.stringify(require('./lenient_parse').parse(t.slice(9).trim()), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/url-check ')) { console.log(JSON.stringify(require('./url_validate').validate(t.slice(11).trim()))); rl.prompt(); return; }
      if (t === '/default-skills') { console.log(JSON.stringify(require('./default_skills').list(), null, 2)); rl.prompt(); return; }
      if (t === '/skills-install-defaults') { console.log('installed ' + require('./default_skills').installAll() + ' skills'); rl.prompt(); return; }
      if (t.startsWith('/squeeze ')) { const p = t.slice(9).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(await require('./squeeze').squeeze(p[0], p[1] || ''), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/think ')) { console.log(JSON.stringify(require('./sequential_thinking').think(t.slice(7).trim()), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/fetch ')) { const r = await require('./fetch_url').fetch(t.slice(7).trim()); console.log(JSON.stringify(r, null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t === '/time') { console.log(JSON.stringify(require('./time_tool').now())); rl.prompt(); return; }
      if (t.startsWith('/probe')) { const m = t.slice(6).trim(); const r = await require('./model_probes').runAgainstBackend(m || undefined); console.log(JSON.stringify({ summary: r.summary, flagged: r.results.filter((x) => x.flagged).map((x) => x.id) }, null, 2)); rl.prompt(); return; }
      if (t.startsWith('/probe-sarif ')) { const m = t.slice(13).trim(); const r = await require('./model_probes').runAgainstBackend(m || undefined); console.log(JSON.stringify(require('./model_probes').toSarif(r), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/skill-scan ')) { const p = t.slice(12).trim(); const f = require('./skill_scan').scanDir(p); console.log(JSON.stringify({ summary: require('./skill_scan').summarize(f), findings: f.slice(0, 20) }, null, 2)); rl.prompt(); return; }
      if (t.startsWith('/secret-scan ')) { const raw = t.slice(13).trim(); const verify = /--verify\b/.test(raw); const target = raw.replace(/--verify/g, '').trim() || root; let text = ''; try { text = require('fs').readFileSync(target, 'utf8'); } catch (e) { text = ''; }
        const f = await require('./secret_verify').scan(text, { source: target, verify }); console.log(JSON.stringify({ summary: require('./secret_verify').summarize(f), findings: f.map(({ raw: _r, ...x }) => x).slice(0, 20) }, null, 2)); rl.prompt(); return; }
      if (t.startsWith('/audit ')) { const p = t.slice(7).trim() || root; const r = await require('./audit_pipeline').run(p); console.log(JSON.stringify({ summary: r.summary, confirmed: r.confirmed.slice(0, 20) }, null, 2)); rl.prompt(); return; }
      if (t === '/mcp-inspect') { const m = require('./mcp_server'); const r = await require('./mcp_inspect').inspect(m); console.log(JSON.stringify(r.summary, null, 2)); rl.prompt(); return; }
      if (t.startsWith('/vuln-template ')) { const p = t.slice(15).trim().split('|').map((x) => x.trim()); const tpls = require('./vuln_templates').loadTemplates(p[0] || root); const r = await require('./vuln_templates').run(tpls, p[1] || 'http://127.0.0.1:8080'); console.log(JSON.stringify({ summary: r.summary, matches: r.matches.slice(0, 20) }, null, 2)); rl.prompt(); return; }
      if (t.startsWith('/crawl ')) { const url = t.slice(7).trim(); const r = await require('./crawler').crawl(url, { maxPages: 10 }); console.log(JSON.stringify({ summary: r.summary, endpoints: r.endpoints.slice(0, 40) }, null, 2)); rl.prompt(); return; }
      if (t.startsWith('/doc ')) { const p = t.slice(5).trim(); const r = require('./doc_convert').toMarkdown(p); console.log(r.markdown.slice(0, 3000)); rl.prompt(); return; }
      if (t.startsWith('/handoff-add ')) { const p = t.slice(13).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(require('./handoff').register({ name: p[0], model: p[1] || undefined, systemPrompt: p[2] || '' }))); rl.prompt(); return; }
      if (t === '/handoff-list') { console.log(JSON.stringify(require('./handoff').list(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/handoff ')) { const p = t.slice(9).trim().split('|').map((x) => x.trim()); const r = await require('./handoff').handoff(p[0], [{ role: 'user', content: p[1] || '' }], { projectRoot: root }); console.log(r.reply); rl.prompt(); return; }
      if (t === '/templates') { console.log(JSON.stringify(require('./conversation_templates').list().map((x) => x.id + ' — ' + x.name), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/tpl-use ')) { const p = t.slice(9).trim().split('|').map((x) => x.trim()); const vars = {}; for (const kv of (p[1] || '').split(',')) { const i = kv.indexOf('='); if (i > 0) vars[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); } const r = require('./conversation_templates').render(p[0], vars); console.log(r ? r.rendered : 'template not found'); rl.prompt(); return; }
      if (t.startsWith('/ab ')) { const p = t.slice(4).trim().split('|').map((x) => x.trim()); const models2 = (p[0] || '').split(',').map((s) => s.trim()).filter(Boolean); const r = await require('./model_compare').abTest(p[2] || '', models2, { runs: parseInt(p[1] || '3', 10), projectRoot: root }); console.log(JSON.stringify({ best: r.best && r.best.model, arms: r.arms.map((a) => ({ model: a.model, passRate: a.passRate, meanDuration: a.meanDuration })), comparisons: r.comparisons }, null, 2)); rl.prompt(); return; }
      if (t.startsWith('/export ')) { const p = t.slice(8).trim().split('|').map((x) => x.trim()); const r = require('./conversation_export').exportToFile(lastToolLog.length ? [] : [], { title: p[1] || 'export', model: process.env.AEGISAI_MODEL || 'llama3.2:3b' }, p[0] || 'markdown', p[2]); console.log(JSON.stringify(r)); rl.prompt(); return; }
      if (t.startsWith('/compare ')) { const p = t.slice(9).trim().split('|').map((x) => x.trim()); const r = await require('./model_compare').compare(p[0] || '', p.slice(1).filter(Boolean), { projectRoot: root }); console.log(require('./model_compare').formatComparison(r).slice(0, 3000)); rl.prompt(); return; }
      if (t.startsWith('/probe-http ')) { const u = t.slice(12).trim(); const r = await require('./http_probe').probe(u, { headers: true }); console.log(JSON.stringify(r.results[0], null, 2)); rl.prompt(); return; }
      if (t.startsWith('/pentest-eval')) { const r = await require('./pentest_eval').run({}); console.log(JSON.stringify(r.summary, null, 2)); console.log(JSON.stringify(r.fixtures.map((f) => ({ id: f.id, s: f.score })), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/decide ')) { const q = t.slice(8).trim(); const r = await require('./tiny_router').decide(q); console.log(JSON.stringify(r)); rl.prompt(); return; }
      if (t.startsWith('/deck ')) { const p = t.slice(6).trim().split('|'); const outline = require('fs').existsSync(p[0]) ? require('fs').readFileSync(p[0], 'utf8') : p[0]; const out = p[1] || require('path').join(root, 'deck-' + Date.now() + '.pdf'); const r = require('./deck').generate(outline, out); console.log(JSON.stringify({ slides: r.slides, bytes: r.bytes, path: r.path })); rl.prompt(); return; }
      if (t.startsWith('/skill-schema ')) { const p = t.slice(14).trim(); const r = require('fs').statSync(p).isDirectory() ? require('./skill_schema').validateDir(p) : [require('./skill_schema').validateFile(p)]; console.log(JSON.stringify({ summary: require('./skill_schema').summarize(r), results: r.map((x) => ({ file: x.file, ok: x.ok, errors: x.errors, warnings: x.warnings })) }, null, 2).slice(0, 3000)); rl.prompt(); return; }
      if (t.startsWith('/guardrail ')) { const p = t.slice(11).trim().split('|'); const r = require('./guardrail_api').evaluate({ tool: p[0], args: p[1] ? JSON.parse(p[1]) : {}, context: { projectRoot: root, readOnly: process.env.AEGISAI_READ_ONLY === 'true' } }); console.log(JSON.stringify({ decision: r.decision, reasons: r.reasons }, null, 2)); rl.prompt(); return; }
      if (t.startsWith('/ioc ')) { const p = t.slice(5).trim().split('|'); const r = require('fs').existsSync(p[0]) ? require('./ioc_import').importFile(p[0], { persist: p[1] === 'persist' }) : { parsed: require('./ioc_import').parseFeed(p[0], 'inline'), summary: require('./ioc_import').summarize(require('./ioc_import').parseFeed(p[0], 'inline')) }; console.log(JSON.stringify(r.summary, null, 2)); rl.prompt(); return; }
      if (t.startsWith('/sec-logs')) { const p = t.slice(9).trim().split('|'); const doc = require('./security_logs').generate({ seed: Number(p[0] || 42), perScenario: Number(p[1] || 12) }); if (p[2]) { require('fs').writeFileSync(p[2], p[2].endsWith('.csv') ? require('./security_logs').toCsv(doc) : require('./security_logs').toJsonl(doc)); console.log('wrote', p[2], doc.events.length, 'events'); } else { console.log(JSON.stringify({ summary: doc.summary, expectations: require('./security_logs').expectations(doc) }, null, 2)); } rl.prompt(); return; }
      if (t === '/agent-cli') { console.log(JSON.stringify(require('./agent_cli').detect(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/package-guard ')) { console.log(JSON.stringify(require('./package_guard').checkCommand(t.slice(15).trim()), null, 2)); rl.prompt(); return; }
      if (t === '/channels-extra') { console.log(JSON.stringify(require('./channels_extra').status(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/image-gen ')) { const p = t.slice(11).trim().split('|'); const r = await require('./image_gen').generate(p[0], { size: p[1], output: p[2] }); console.log(JSON.stringify(r)); rl.prompt(); return; }
      if (t === '/profile') { console.log(JSON.stringify(require('./profiler').report(), null, 2).slice(0, 3000)); rl.prompt(); return; }
      if (t.startsWith('/snippets')) { const q = t.slice(10).trim(); const r = q ? require('./snippets').search(q) : require('./snippets').list(); console.log(JSON.stringify(r.map((s) => ({ id: s.id, name: s.name, lang: s.language })), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/rename ')) { const p = t.slice(8).trim().split('|').map((x) => x.trim()); const edit = await require('./lsp').rename(p[0], p[1], Number(p[2]), Number(p[3]), p[4]); const applied = require('./lsp').applyWorkspaceEdit(edit, { dryRun: p[5] !== 'apply' }); console.log(JSON.stringify(applied, null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t.startsWith('/ab-test ')) { const p = t.slice(9).trim().split('|').map((x) => x.trim()); const r = await require('./ab_testing').run({ prompts: [p[0] || ''], models: p.slice(1).filter(Boolean), trials: Number(p[p.length-1]) || 3, projectRoot: root }); console.log(require('./ab_testing').format(r)); rl.prompt(); return; }
      if (t.startsWith('/malware-scan ')) { const p = t.slice(14).trim().split('|').map((x) => x.trim()); const r = require('./malware_scan').scan(p[0].split(','), { recursive: p.includes('recursive') }); console.log(JSON.stringify(r, null, 2).slice(0, 3000)); rl.prompt(); return; }
      if (t.startsWith('/ioc-match ')) { const p = t.slice(11).trim().split('|'); console.log(JSON.stringify(require('./ioc_import').match(p[1] || '', require('./ioc_import').parseFeed(p[0] || '', 'inline')))); rl.prompt(); return; }
      if (t.startsWith('/skill-schema ')) { const p = t.slice(14).trim(); const r = require('fs').statSync(p).isDirectory() ? require('./skill_schema').validateDir(p) : [require('./skill_schema').validateFile(p)]; console.log(JSON.stringify({ summary: require('./skill_schema').summarize(r), results: r.map((x) => ({ file: x.file, ok: x.ok, errors: x.errors, warnings: x.warnings })) }, null, 2).slice(0, 3000)); rl.prompt(); return; }
      if (t.startsWith('/guardrail ')) { const p = t.slice(11).trim().split('|'); const r = require('./guardrail_api').evaluate({ tool: p[0], args: p[1] ? JSON.parse(p[1]) : {}, context: { projectRoot: root, readOnly: process.env.AEGISAI_READ_ONLY === 'true' } }); console.log(JSON.stringify({ decision: r.decision, reasons: r.reasons }, null, 2)); rl.prompt(); return; }
      if (t.startsWith('/sec-logs')) { const p = t.slice(9).trim().split('|'); const doc = require('./security_logs').generate({ seed: Number(p[0] || 42), perScenario: Number(p[1] || 12) }); if (p[2]) { require('fs').writeFileSync(p[2], p[2].endsWith('.csv') ? require('./security_logs').toCsv(doc) : require('./security_logs').toJsonl(doc)); console.log('wrote', p[2], doc.events.length, 'events'); } else { console.log(JSON.stringify({ summary: doc.summary, expectations: require('./security_logs').expectations(doc) }, null, 2)); } rl.prompt(); return; }
      if (t === '/agent-cli') { console.log(JSON.stringify(require('./agent_cli').detect(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/package-guard ')) { console.log(JSON.stringify(require('./package_guard').checkCommand(t.slice(15).trim()), null, 2)); rl.prompt(); return; }
      if (t === '/channels-extra') { console.log(JSON.stringify(require('./channels_extra').status(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/image-gen ')) { const p = t.slice(11).trim().split('|'); const r = await require('./image_gen').generate(p[0], { size: p[1], output: p[2] }); console.log(JSON.stringify(r)); rl.prompt(); return; }
      if (t === '/profile') { console.log(JSON.stringify(require('./profiler').report(), null, 2).slice(0, 3000)); rl.prompt(); return; }
      if (t.startsWith('/snippets')) { const q = t.slice(10).trim(); const r = q ? require('./snippets').search(q) : require('./snippets').list(); console.log(JSON.stringify(r.map((s) => ({ id: s.id, name: s.name, lang: s.language })), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/skills-catalog')) { const u = t.slice(15).trim(); if (!u) { console.log('Usage: /skills-catalog <url>'); rl.prompt(); return; } const r = await require('./skills_catalog').fetchCatalog(u); console.log(JSON.stringify({ count: r.count }, null, 2)); rl.prompt(); return; }
      if (t.startsWith('/skills-import ')) { const u = t.slice(15).trim(); const name = u.split('/').pop().replace(/\.md$/i, '') || 'imported'; const r = await require('./skills_catalog').importSkill(u, name); console.log(JSON.stringify(r)); rl.prompt(); return; }
      if (t.startsWith('/ab-test ')) { const p = t.slice(9).trim().split('|').map((x) => x.trim()); const r = await require('./ab_testing').run({ prompts: [p[0] || ''], models: p.slice(1, -1).filter(Boolean), trials: Number(p[p.length-1]) || 3, projectRoot: root }); console.log(require('./ab_testing').format(r)); rl.prompt(); return; }
      if (t.startsWith('/malware-scan ')) { const p = t.slice(14).trim().split('|').map((x) => x.trim()); const r = require('./malware_scan').scan(p[0].split(','), { recursive: p.includes('recursive') }); console.log(JSON.stringify(r, null, 2).slice(0, 3000)); rl.prompt(); return; }
      if (t.startsWith('/probe-http ')) { const u = t.slice(12).trim(); const r = await require('./http_probe').probe(u, { headers: true }); console.log(JSON.stringify(r.results[0], null, 2)); rl.prompt(); return; }
      if (t.startsWith('/pentest-eval')) { const r = await require('./pentest_eval').run({}); console.log(JSON.stringify(r.summary, null, 2)); console.log(JSON.stringify(r.fixtures.map((f) => ({ id: f.id, s: f.score })), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/time ')) { console.log(JSON.stringify(require('./time_tool').now(t.slice(6).trim()))); rl.prompt(); return; }
      if (t.startsWith('/mcp-registry ')) { const r = await require('./mcp_registry_browser').browse(t.slice(14).trim()); console.log(JSON.stringify(r, null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t === '/everything-manifest') { console.log(JSON.stringify(require('./mcp_everything').manifest(), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/goal ')) { const p = t.slice(6).trim().split('|').map((x) => x.trim()); const g = require('./session_goals').create('default', p[0], { description: p[1] || '' }); console.log(JSON.stringify(g)); rl.prompt(); return; }
      if (t === '/goals') { console.log(JSON.stringify(require('./session_goals').list('default'), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/goal-update ')) { const p = t.slice(13).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(require('./session_goals').update(p[0], { progress: Number(p[1] || 0) }))); rl.prompt(); return; }
      if (t.startsWith('/pat ')) { const p = t.slice(5).trim().split(/\s+/); console.log(JSON.stringify(require('./access_tokens').mint(p.join(' '), ['read', 'execute']))); rl.prompt(); return; }
      if (t === '/pats') { console.log(JSON.stringify(require('./access_tokens').list(), null, 2).slice(0, 1200)); rl.prompt(); return; }
      if (t === '/tokens') { console.log(JSON.stringify(require('./token_dashboard').summary(), null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t.startsWith('/pow ')) { console.log(JSON.stringify(require('./proof_of_work').create('manual', { ci: { status: t.slice(5).trim() } }), null, 2)); rl.prompt(); return; }
      if (t === '/proofs') { console.log(JSON.stringify(require('./proof_of_work').list().map((p) => p.runId + ':' + p.verdict))); rl.prompt(); return; }
      if (t.startsWith('/project-create ')) { const p = t.slice(15).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(require('./projects').create(p[0], p[1] || ''))); rl.prompt(); return; }
      if (t === '/projects') { console.log(JSON.stringify(require('./projects').list())); rl.prompt(); return; }
      if (t.startsWith('/project-add-doc ')) { const p = t.slice(17).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(require('./projects').addDoc(p[0], p[1], p[2] || ''))); rl.prompt(); return; }
      if (t.startsWith('/hippocampus ')) { console.log(JSON.stringify(require('./hippocampus').consolidate(t.slice(13).trim(), t.slice(13).trim().split(/\s+/)))); rl.prompt(); return; }
      if (t.startsWith('/skill-factory ')) { const r = await require('./skill_factory').proposeSkill(t.slice(15).trim()); console.log(JSON.stringify(r, null, 2)); rl.prompt(); return; }
      if (t.startsWith('/python ')) { const r = await require('./python_client').run(t.slice(8).trim()); console.log(JSON.stringify(r, null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t === '/token-dashboard') { console.log(JSON.stringify(require('./token_dashboard').summary(), null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t.startsWith('/channel ')) { const p = t.slice(9).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(await require('./channels').handle(p[0], { text: p[1] || '' }))); rl.prompt(); return; }
      if (t === '/channels') { console.log(JSON.stringify(require('./channels').status(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/gh-webhook ')) { const p = t.slice(12).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(await require('./github_webhooks').handle(p[0], JSON.parse(p[1] || '{}')))); rl.prompt(); return; }
      if (t.startsWith('/attach ')) { console.log(JSON.stringify(require('./file_attachments').saveAttachment(t.slice(8).trim(), ''))); rl.prompt(); return; }
      if (t === '/attachments') { console.log(JSON.stringify(require('./file_attachments').list(), null, 2).slice(0, 1200)); rl.prompt(); return; }
      if (t.startsWith('/kb-add ')) { const p = t.slice(8).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(require('./private_kb').add(p[0], p[1] || ''))); rl.prompt(); return; }
      if (t.startsWith('/kb-search ')) { console.log(JSON.stringify(require('./private_kb').search(t.slice(11).trim()), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/office-preview ')) { console.log(JSON.stringify(await require('./office_preview').preview(t.slice(16).trim()), null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t.startsWith('/fs-resources ')) { console.log(JSON.stringify(require('./fs_resources').list(t.slice(14).trim() || process.cwd()).slice(0, 20), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/stream-action ')) { const p = t.slice(15).trim().split('|').map((x) => x.trim()); console.log('use /stream-action via HTTP: GET /api/stream?token=...&prompt=...'); rl.prompt(); return; }
      if (t === '/rea-status') { console.log(JSON.stringify(require('./rea').status(), null, 2)); rl.prompt(); return; }
      if (t === '/ghidra-status') { console.log(JSON.stringify(require('./ghidra').status(), null, 2)); rl.prompt(); return; }
      if (t === '/craft-status') { console.log(JSON.stringify(require('./craft').status(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/re-search ')) { const r = require('./re_index').search(t.slice(11).trim()); console.log(JSON.stringify(r, null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t === '/re-categories') { console.log(JSON.stringify(require('./re_index').categories())); rl.prompt(); return; }
      if (t.startsWith('/re-online ')) { const r = await require('./re_index').online(t.slice(11).trim()); console.log(JSON.stringify(r, null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t.startsWith('/swarm ')) { const plan = t.slice(7).trim().split('|').map((x) => x.trim()); const r = await require('./swarm').runSwarm({ plan, model: process.env.AEGISAI_MODEL || 'llama3.2:3b', projectRoot: root }); console.log(JSON.stringify(r, null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t.startsWith('/patch ')) { const p = t.slice(7).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(require('./patch').proposePatch({ projectRoot: root, dependency: p[0], fixedVersion: p[1], dryRun: true }), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/task ')) { const r = await require('./task').runTask({ goal: t.slice(6).trim(), model: process.env.AEGISAI_MODEL || 'llama3.2:3b', projectRoot: root }); console.log(JSON.stringify(r, null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t.startsWith('/hunt-start ')) { console.log(JSON.stringify(require('./hunt').start(t.slice(12).trim()))); rl.prompt(); return; }
      if (t.startsWith('/hunt-search ')) { console.log(JSON.stringify(require('./hunt').vulnSearch(t.slice(13).trim()))); rl.prompt(); return; }
      if (t.startsWith('/hunt-report ')) { console.log(JSON.stringify(require('./hunt').report([], t.slice(13).trim()))); rl.prompt(); return; }
      if (t === '/hunt-list') { console.log(JSON.stringify(require('./hunt').list())); rl.prompt(); return; }
      if (t.startsWith('/awesome-re ')) { const r = await require('./awesome_re').refresh(); console.log('refreshed:', r ? (Array.isArray(r) ? r.length : 'ok') : 'null'); rl.prompt(); return; }
      if (t.startsWith('/awesome-search ')) { const r = require('./awesome_re').search(t.slice(16).trim(), { limit: 10 }); console.log(JSON.stringify(r, null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t === '/mcp-presets') { console.log(JSON.stringify(require('./mcp_presets').buildPresets(null, root), null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t.startsWith('/vuln-patterns ')) { console.log(JSON.stringify(require('./vuln_patterns').searchPatterns(t.slice(16).trim()), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/mem-md ')) { console.log(JSON.stringify(require('./markdown_memory').append(t.slice(8).trim()))); rl.prompt(); return; }
      if (t === '/mem-md-search') { console.log(JSON.stringify(require('./markdown_memory').search(''), null, 2).slice(0, 1000)); rl.prompt(); return; }
      if (t === '/metrics') { console.log(JSON.stringify(require('./metrics').all(), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/delivery-test ')) { const c = require('./delivery').createEventChannel(); c.send({ msg: t.slice(15).trim() }); console.log('delivered'); rl.prompt(); return; }
      if (t.startsWith('/isolation-check ')) { const p = require('./isolation').createSessionPolicy({ root: process.cwd() }); console.log(JSON.stringify(require('./isolation').checkJobAgainstPolicy(p, { url: t.slice(17).trim() }))); rl.prompt(); return; }
      if (t.startsWith('/consolidate-now')) { console.log(JSON.stringify(await require('./consolidation_scheduler').createConsolidationScheduler().runNow())); rl.prompt(); return; }
      if (t.startsWith('/mcp-search ')) { console.log(JSON.stringify(await require('./mcp_search').search(t.slice(12).trim()))); rl.prompt(); return; }
      if (t.startsWith('/mcp-registry-full ')) { const r = await require('./mcp_registry').fetchRegistry({ query: t.slice(19).trim(), limit: 5 }); console.log(JSON.stringify(r, null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/mcp-preset ')) { console.log(JSON.stringify(require('./mcp_presets').buildPresets(t.slice(12).trim().split(/\s+/), process.cwd()), null, 2).slice(0, 1200)); rl.prompt(); return; }
      if (t.startsWith('/lsp-start ')) { console.log(JSON.stringify(require('./lsp').start(t.slice(11).trim(), root))); rl.prompt(); return; }
      if (t === '/lsp-list') { console.log(JSON.stringify(require('./lsp').list())); rl.prompt(); return; }
      if (t.startsWith('/lsp-hover ')) { const p = t.slice(11).trim().split(/\s+/); console.log(JSON.stringify(await require('./lsp').hover(p[0], p[1], Number(p[2] || 1), Number(p[3] || 1)))); rl.prompt(); return; }
      if (t.startsWith('/lsp-def ')) { const p = t.slice(9).trim().split(/\s+/); console.log(JSON.stringify(await require('./lsp').definition(p[0], p[1], Number(p[2] || 1), Number(p[3] || 1)))); rl.prompt(); return; }
      if (t.startsWith('/lsp-open ')) { const p = t.slice(10).trim().split(/\s+/); console.log(JSON.stringify(require('./lsp').openDocument(p[0], p[1]))); rl.prompt(); return; }
      if (t.startsWith('/lsp-diag ')) { console.log(JSON.stringify(require('./lsp').allDiagnostics(t.slice(11).trim()))); rl.prompt(); return; }
      if (t.startsWith('/lsp-stop ')) { console.log(JSON.stringify(require('./lsp').stop(t.slice(10).trim()))); rl.prompt(); return; }
      if (t === '/git-status') { console.log(JSON.stringify(require('./git_integration').status(root), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/git-diff')) { const p = t.slice(9).trim(); console.log(require('./git_integration').diff(root, { staged: p === '--staged', stat: p === '--stat' }).diff || '(no diff)'); rl.prompt(); return; }
      if (t.startsWith('/git-commit ')) { console.log(JSON.stringify(require('./git_integration').commit(root, t.slice(12).trim()))); rl.prompt(); return; }
      if (t.startsWith('/git-blame ')) { console.log(JSON.stringify(require('./git_integration').blame(root, t.slice(11).trim()), null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t.startsWith('/git-branch')) { const p = t.slice(12).trim(); console.log(JSON.stringify(require('./git_integration').branch(root, p || null))); rl.prompt(); return; }
      if (t === '/git-log') { console.log(JSON.stringify(require('./git_integration').log(root), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t === '/diff-review') { console.log(JSON.stringify(require('./diff_review').fullReview(root), null, 2).slice(0, 3000)); rl.prompt(); return; }
      if (t === '/diff-review-staged') { console.log(JSON.stringify(require('./diff_review').stagedReview(root), null, 2).slice(0, 3000)); rl.prompt(); return; }
      if (t === '/review-start') { const s = require('./diff_review_ui').startSession(root); if (!s.ok) { console.log('error:', s.error); rl.prompt(); return; } global.__reviewSession = s.session; console.log('Started review: ' + s.session.files.length + ' files'); console.log(require('./diff_review_ui').renderCurrent(s.session)); rl.prompt(); return; }
      if (t === '/review-accept') { const r = require('./diff_review_ui').acceptHunk(global.__reviewSession); console.log(JSON.stringify(r)); console.log(require('./diff_review_ui').renderCurrent(global.__reviewSession)); rl.prompt(); return; }
      if (t === '/review-reject') { const r = require('./diff_review_ui').rejectHunk(global.__reviewSession); console.log(JSON.stringify(r)); console.log(require('./diff_review_ui').renderCurrent(global.__reviewSession)); rl.prompt(); return; }
      if (t === '/review-accept-file') { console.log(JSON.stringify(require('./diff_review_ui').acceptFile(global.__reviewSession))); rl.prompt(); return; }
      if (t === '/review-reject-file') { console.log(JSON.stringify(require('./diff_review_ui').rejectFile(global.__reviewSession))); rl.prompt(); return; }
      if (t === '/review-next') { require('./diff_review_ui').nextHunk(global.__reviewSession); console.log(require('./diff_review_ui').renderCurrent(global.__reviewSession)); rl.prompt(); return; }
      if (t === '/review-prev') { require('./diff_review_ui').prevHunk(global.__reviewSession); console.log(require('./diff_review_ui').renderCurrent(global.__reviewSession)); rl.prompt(); return; }
      if (t === '/review-next-file') { require('./diff_review_ui').nextFile(global.__reviewSession); console.log(require('./diff_review_ui').renderCurrent(global.__reviewSession)); rl.prompt(); return; }
      if (t === '/review-prev-file') { require('./diff_review_ui').prevFile(global.__reviewSession); console.log(require('./diff_review_ui').renderCurrent(global.__reviewSession)); rl.prompt(); return; }
      if (t === '/review-status') { console.log(JSON.stringify(require('./diff_review_ui').status(global.__reviewSession), null, 2)); rl.prompt(); return; }
      if (t === '/review-finish') { console.log(JSON.stringify(require('./diff_review_ui').finish(global.__reviewSession), null, 2)); global.__reviewSession = null; rl.prompt(); return; }
      if (t.startsWith('/git-stash')) { const p = t.slice(11).trim() || 'push'; console.log(JSON.stringify(require('./git_integration').stash(root, p))); rl.prompt(); return; }
      if (t.startsWith('/git-show')) { const p = t.slice(10).trim(); console.log(require('./git_integration').show(root, p || 'HEAD').output); rl.prompt(); return; }
      if (t === '/providers') { console.log(JSON.stringify(await require('./providers').detect(), null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t === '/provider-list') { console.log(JSON.stringify(require('./providers').list().map((p) => p.id + ': ' + p.name + ' (' + (p.local ? 'local' : 'cloud') + ')'))); rl.prompt(); return; }
      if (t.startsWith('/provider-auto')) { console.log(JSON.stringify(await require('./providers').autoSelect())); rl.prompt(); return; }
      if (t.startsWith('/plugin-search ')) { console.log(JSON.stringify(await require('./plugin_marketplace').search(t.slice(15).trim()), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/plugin-install ')) { console.log(JSON.stringify(await require('./plugin_marketplace').install(t.slice(16).trim()))); rl.prompt(); return; }
      if (t === '/plugin-list') { console.log(JSON.stringify(require('./plugin_marketplace').list(), null, 2)); rl.prompt(); return; }
      if (t === '/plugin-categories') { console.log(JSON.stringify(require('./plugin_marketplace').categories())); rl.prompt(); return; }
      if (t.startsWith('/plugin-search ')) { const p = t.slice(15).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(await require('./plugin_marketplace').search(p[0], { category: p[1], tag: p[2], minRating: Number(p[3] || 0) }), null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t.startsWith('/plugin-info ')) { console.log(JSON.stringify(require('./plugin_marketplace').info(t.slice(13).trim()), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/plugin-enable ')) { console.log(JSON.stringify(require('./plugin_marketplace').enable(t.slice(15).trim()))); rl.prompt(); return; }
      if (t.startsWith('/plugin-disable ')) { console.log(JSON.stringify(require('./plugin_marketplace').disable(t.slice(16).trim()))); rl.prompt(); return; }
      if (t === '/plugin-stats') { console.log(JSON.stringify(require('./plugin_marketplace').stats(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/plugin-update ')) { console.log(JSON.stringify(await require('./plugin_marketplace').update(t.slice(15).trim()))); rl.prompt(); return; }
      if (t.startsWith('/plugin-uninstall ')) { console.log(JSON.stringify(require('./plugin_marketplace').uninstall(t.slice(18).trim()))); rl.prompt(); return; }
      if (t.startsWith('/session-brief ')) { console.log(JSON.stringify(require('./session_brief').brief(t.slice(14).trim()), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/det-compact ')) { const r = require('./deterministic_compact').compact([{ role: 'tool', content: t.slice(13).trim() }]); console.log(JSON.stringify({ originalsId: r.originalsId, compacted: r.compacted })); rl.prompt(); return; }
      if (t.startsWith('/recover-decide ')) { const p = t.slice(15).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(require('./error_recovery').decide(p[0], Number(p[1] || 0)))); rl.prompt(); return; }
      if (t.startsWith('/chaos ')) { console.log(JSON.stringify(require('./chaos').inject(t.slice(7).trim()))); rl.prompt(); return; }
      if (t === '/honesty') { console.log(JSON.stringify(require('./honesty').score('done', lastToolLog), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/boundary ')) { console.log(JSON.stringify(require('./boundary_bench').evaluate(t.slice(10).trim().split(/\s+/)))); rl.prompt(); return; }
      if (t === '/replay-guard-reset') { require('./replay_guard').clear(); console.log('cleared'); rl.prompt(); return; }
      if (t.startsWith('/mcp-pin ')) { const p = t.slice(9).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(require('./mcp_pinning').pin(p[0], { command: p[1] }))); rl.prompt(); return; }
      if (t === '/merkle-root') { console.log(JSON.stringify(require('./merkle').ledgerRoot())); rl.prompt(); return; }
      if (t === '/readiness') { console.log(JSON.stringify(require('./readiness_audit').audit(root), null, 2)); rl.prompt(); return; }
      if (t === '/trajectory-ui') { console.log('Open /trajectory.html in the web UI (--web)'); rl.prompt(); return; }
      if (t === '/cost-route') { console.log(JSON.stringify(require('./cost_routing').route([{ name: 'a', quality: 0.9, cost: 0.01 }, { name: 'b', quality: 0.5, cost: 0.001 }], { budget: 0.005 }))); rl.prompt(); return; }
      if (t === '/tool-contract') { const tools = require('./tools/registry').assemble({ includeCoding: true }); console.log(JSON.stringify(require('./tool_contract').exportContract(tools).slice(0, 5), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/agent-tool ')) { console.log(JSON.stringify(require('./agents_as_tools').register(t.slice(12).trim()))); rl.prompt(); return; }
      if (t.startsWith('/equipment-add ')) { const p = t.slice(14).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(require('./equipment_registry').add(p[0], p[1] || 'tool'))); rl.prompt(); return; }
      if (t === '/equipment') { console.log(JSON.stringify(require('./equipment_registry').list(), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/tool-state ')) { const p = t.slice(12).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(require('./tool_state').set(p[0], p[1] || 'default', JSON.parse(p[2] || '{}')))); rl.prompt(); return; }
      if (t === '/tool-eval') { const tools = require('./tools/registry').assemble({ includeCoding: true }); console.log(JSON.stringify(require('./tool_eval').grade(tools), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t === '/config-matrix') { console.log(JSON.stringify(require('./config_matrix').all(), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t === '/migration-recipes') { console.log(JSON.stringify(require('./migration_recipes').list())); rl.prompt(); return; }
      if (t === '/confidence-store') { console.log(JSON.stringify(require('./confidence_memory').store('sample fact', 'test', 0.7))); rl.prompt(); return; }
      if (t.startsWith('/event-replay ')) { console.log(JSON.stringify(require('./event_sourced').replay(t.slice(14).trim()), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t === '/span-tree') { console.log(JSON.stringify(require('./spans5').tree(), null, 2).slice(0, 1200)); rl.prompt(); return; }
      if (t === '/evidence-bundle') { console.log(JSON.stringify(require('./evidence_bundle').bundle('manual', { final: 'done', toolLog: lastToolLog }), null, 2)); rl.prompt(); return; }
      if (t === '/composable') { const api = require('./composable_api').create(); console.log(JSON.stringify(require('./composable_api').status(api))); rl.prompt(); return; }
      if (t === '/identity-list') { console.log(JSON.stringify(require('./identity_audit').list(), null, 2).slice(0, 1200)); rl.prompt(); return; }
      if (t.startsWith('/sim-nav ')) { const b = new (require('./sim_browser').SimBrowser)(); console.log(JSON.stringify(b.navigate(t.slice(9).trim()))); rl.prompt(); return; }
      if (t === '/security-layers') { console.log(JSON.stringify(require('./security_layers').posture(), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t === '/layer-registry') { const l = require('./layer_registry'); console.log(JSON.stringify(l.layers().map((x) => ({ layer: x, ...l.get(x) })), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/layer-use ')) { const p = t.slice(11).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(require('./layer_registry').use(p[0], p[1]))); rl.prompt(); return; }
      if (t === '/governance') { console.log(JSON.stringify(require('./markdown_governance').load(root))); rl.prompt(); return; }
      if (t === '/trace-status') { console.log(JSON.stringify(require('./trace_export').status(), null, 2)); rl.prompt(); return; }
      if (t === '/native-adapters') { console.log(JSON.stringify(require('./native_adapters').status(), null, 2)); rl.prompt(); return; }
      if (t === '/plugins-ui') { console.log('Open /plugins.html in the web UI (--web)'); rl.prompt(); return; }
      if (t === '/conformance') { const tools = require('./mcp_server').toolsList().map((x) => ({ name: x.name, description: x.description, inputSchema: x.inputSchema })); const resources = require('./mcp_server').resourcesList().map((x) => ({ uri: x.uri, name: x.name })); const prompts = require('./mcp_server').promptsList().map((x) => ({ name: x.name, arguments: x.arguments })); const r = require('./mcp_conformance').run({ tools, resources, prompts }); console.log(JSON.stringify(r, null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/mcpb-install ')) { console.log(JSON.stringify(require('./mcpb').install(t.slice(14).trim()))); rl.prompt(); return; }
      if (t === '/mcpb-list') { console.log(JSON.stringify(require('./mcpb').list(), null, 2).slice(0, 1200)); rl.prompt(); return; }
      if (t === '/mcp-skills') { console.log(JSON.stringify(require('./mcp_skills').list())); rl.prompt(); return; }
      if (t.startsWith('/intercept ')) { const id = require('./mcp_interceptors').register(async () => ({ ok: true }), { phase: t.slice(11).trim() || 'pre' }); console.log('registered', id); rl.prompt(); return; }
      if (t === '/interceptors') { console.log(JSON.stringify(require('./mcp_interceptors').interceptors.map((i) => i.id + ':' + i.phase))); rl.prompt(); return; }
      if (t.startsWith('/mcp-upload ')) { console.log(JSON.stringify(require('./mcp_file_uploads').store({ data: t.slice(12).trim(), filename: 'upload.txt' }))); rl.prompt(); return; }
      if (t === '/slack-status') { console.log(JSON.stringify(require('./slack_gateway').status(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/slack-handle ')) { const r = await require('./slack_gateway').handle({ text: t.slice(13).trim(), channel: 'mock', user: 'mock' }); console.log(JSON.stringify(r, null, 2).slice(0, 1000)); rl.prompt(); return; }
      if (t === '/ws-status') { console.log(JSON.stringify(require('./ws_bridge').status(), null, 2)); rl.prompt(); return; }
      if (t === '/fn-list') { console.log(JSON.stringify(require('./serverless').list(), null, 2)); rl.prompt(); return; }
      if (t === '/podman-status') { console.log(JSON.stringify(require('./podman').status(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/pr-review ')) { const r = await require('./pr_review').review(t.slice(11).trim()); console.log(JSON.stringify(r, null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t === '/ci-allowlist') { console.log(JSON.stringify(require('./ci_resolver').allowlist(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/ci-allow ')) { console.log(JSON.stringify(require('./ci_resolver').setAllowlist(t.slice(9).trim().split(',').map((s) => s.trim())))); rl.prompt(); return; }
      if (t.startsWith('/cve-reach ')) { console.log(JSON.stringify(require('./cve_reachability').prove(root, t.slice(11).trim()), null, 2)); rl.prompt(); return; }
      if (t === '/brain-sandbox') { const agent = new (require('./brain_sandbox').Agent)({}); console.log(JSON.stringify({ brain: agent.brain.name, sandbox: agent.sandbox.name }, null, 2)); rl.prompt(); return; }
      if (t.startsWith('/health-select ')) { console.log(JSON.stringify(await require('./health_failover').select(t.slice(14).trim().split(/\s+/)))); rl.prompt(); return; }
      if (t.startsWith('/bug-repro ')) { const p = t.slice(11).trim().split('|').map((x) => x.trim()); const r = await require('./bug_repro').reproduce(p[0], p[1] || ''); console.log(JSON.stringify(r, null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t === '/maintenance-templates') { console.log(JSON.stringify(require('./maintenance_templates').list(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/speed-bench ')) { const e = JSON.parse(t.slice(12).trim()); console.log(JSON.stringify(require('./speed_bench').summarize(e), null, 2)); rl.prompt(); return; }
      if (t === '/runtime-contract') { console.log(JSON.stringify(require('./runtime_contract').CONTRACT, null, 2)); rl.prompt(); return; }
      if (t.startsWith('/git-snapshot ')) { console.log(JSON.stringify(require('./git_state').snapshot(null, { note: t.slice(13).trim() }))); rl.prompt(); return; }
      if (t === '/sandbox-fingerprint') { console.log(JSON.stringify(require('./sandbox_fingerprint').fingerprint(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/gate-check ')) { console.log(JSON.stringify(require('./decision_gates').evaluate({ input: t.slice(12).trim() }), null, 2)); rl.prompt(); return; }
      if (t === '/workflow-demo') { const wf = require('./workflow').create({ initial: 'start', states: { start: { next: [{ event: 'go', to: 'done' }] }, done: { next: [] } } }); console.log(JSON.stringify(require('./workflow').transition(wf, 'go'))); rl.prompt(); return; }
      if (t === '/geo-wake') { console.log(require('./geometric_memory').wakeInjection('default') || '(no handoff)'); rl.prompt(); return; }
      if (t === '/arch-layers') { console.log(JSON.stringify(require('./arch_rules').inferLayers(root), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t === '/aibom') { console.log(JSON.stringify(require('./aibom').generate(), null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t.startsWith('/ssh-peers ')) { console.log(JSON.stringify(require('./ssh_bridge').send(t.slice(11).trim().split(' ')[0], '', t.slice(11).trim().split(' ').slice(1).join(' ')))); rl.prompt(); return; }
      if (t === '/ssh-peers') { console.log(JSON.stringify(require('./ssh_bridge').peers())); rl.prompt(); return; }
      if (t.startsWith('/session-export ')) { const p = t.slice(15).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(require('./session_converter').exportSession(p[0], p[1] || 'generic'), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/goal-set ')) { console.log(JSON.stringify(require('./two_bar').setGoal(t.slice(10).trim()))); rl.prompt(); return; }
      if (t.startsWith('/semantic-tools ')) { const tools = require('./tools/registry').assemble({ includeCoding: true }); const r = require('./semantic_tools').retrieve(tools, t.slice(15).trim(), 8); console.log(JSON.stringify(r.map((x) => (x.function || x).name))); rl.prompt(); return; }
      if (t === '/yaml-eval') { console.log('Use /eval; YAML eval specs supported via src/yaml_eval.js'); rl.prompt(); return; }
      if (t === '/pass-at-k') { console.log(JSON.stringify(require('./pass_at_k').compare({ a: [[true,false],[true,true]], b: [[false,false],[true,false]] }), null, 2)); rl.prompt(); return; }
      if (t === '/failure-clusters') { console.log(JSON.stringify(require('./failure_cluster').cluster(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/ledger-rewind ')) { console.log(JSON.stringify(require('./ledger').rewind(Number(t.slice(14).trim())), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/gem-distill ')) { console.log(JSON.stringify(require('./gems').distill(t.slice(13).trim()))); rl.prompt(); return; }
      if (t === '/gems') { console.log(JSON.stringify(require('./gems').list().map((g) => g.name))); rl.prompt(); return; }
      if (t === '/ahp-check') { console.log(JSON.stringify(require('./ahp').supervise('read_file', { path: 'a' }, { readOnly: true }), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/sarif ')) { const r = require('./vuln_scan').scan(t.slice(7).trim()); console.log(JSON.stringify(require('./sarif').fromFindings(r.findings), null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t.startsWith('/contest-observe ')) { console.log(JSON.stringify(require('./contest_memory').observe(t.slice(15).trim(), t.slice(15).trim().split(/\s+/)))); rl.prompt(); return; }
      if (t === '/habits') { console.log(JSON.stringify(require('./contest_memory').habits(), null, 2).slice(0, 1200)); rl.prompt(); return; }
      if (t.startsWith('/constitution-propose ')) { console.log(JSON.stringify(require('./constitution').propose(t.slice(21).trim()))); rl.prompt(); return; }
      if (t.startsWith('/constitution-decide ')) { const p = t.slice(20).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(require('./constitution').decide(p[0], p[1] || 'approve'))); rl.prompt(); return; }
      if (t === '/constitution') { console.log(JSON.stringify(require('./constitution').all(), null, 2).slice(0, 1200)); rl.prompt(); return; }
      if (t.startsWith('/bidi-nav ')) { const b = new (require('./integrations/bidi').BiDi)(); console.log(JSON.stringify(await b.navigate(t.slice(10).trim()))); rl.prompt(); return; }
      if (t.startsWith('/install-preview ')) { console.log(JSON.stringify(require('./config_installer').preview(t.slice(16).trim()), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/install-config ')) { console.log(JSON.stringify(require('./config_installer').install(t.slice(15).trim()))); rl.prompt(); return; }
      if (t.startsWith('/multi-search ')) { const r = await require('./multi_search').search(t.slice(14).trim()); console.log(JSON.stringify(r, null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t === '/routing-eval') { console.log(JSON.stringify(require('./routing_eval').evaluate(), null, 2)); rl.prompt(); return; }
      if (t === '/cp-trace') { console.log(JSON.stringify(require('./control_plane').trace(), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/cp-govern ')) { const p = t.slice(11).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(require('./control_plane').govern(p[0], p[1] ? JSON.parse(p[1]) : {}))); rl.prompt(); return; }
      if (t.startsWith('/graph-observe ')) { console.log(JSON.stringify(require('./graph_memory').observe(t.slice(14).trim()))); rl.prompt(); return; }
      if (t.startsWith('/graph-recall ')) { console.log(JSON.stringify(require('./graph_memory').recall(t.slice(13).trim()), null, 2).slice(0, 1200)); rl.prompt(); return; }
      if (t === '/graph-prompt') { console.log(require('./graph_memory').evolvePrompt('You are a helpful assistant.', '')); rl.prompt(); return; }
      if (t.startsWith('/ui-record ')) { const p = t.slice(11).trim().split('|').map((x) => x.trim()); console.log(require('./ui_replay').record({ action: p[0], args: p[1] ? JSON.parse(p[1]) : {} })); rl.prompt(); return; }
      if (t === '/ui-replay') { console.log(JSON.stringify(require('./ui_replay').replay(), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/sep-create ')) { const id = require('./separation').createSession(t.slice(12).trim(), 'executor-1'); console.log(id); rl.prompt(); return; }
      if (t.startsWith('/sep-verify ')) { const p = t.slice(12).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(require('./separation').verify(p[0], p[1], p[2] || 'approve'))); rl.prompt(); return; }
      if (t.startsWith('/auto-policy-learn ')) { console.log(JSON.stringify(require('./auto_policy').learn({ name: t.slice(18).trim() }), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t === '/auto-rules') { console.log(JSON.stringify(require('./auto_policy').rules(), null, 2).slice(0, 1200)); rl.prompt(); return; }
      if (t === '/debug-state') { console.log(JSON.stringify(global.__dbg ? global.__dbg.state() : 'no debugger attached')); rl.prompt(); return; }
      if (t.startsWith('/bp ')) { console.log(JSON.stringify(global.__dbg.setBreakpoint(t.slice(4).trim()))); rl.prompt(); return; }
      if (t === '/step') { global.__dbg.step(1); console.log('step queued'); rl.prompt(); return; }
      if (t === '/resume') { global.__dbg.resume(); console.log('resumed'); rl.prompt(); return; }
      if (t === '/debug-trace') { console.log(JSON.stringify(global.__dbg.inspect(20), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/cheapest ')) { const r = await require('./cheapest_model').find(t.slice(10).trim().split(/\s+/)); console.log(JSON.stringify(r, null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t === '/code-map') { const m = require('./code_map').build(root, 50); console.log(JSON.stringify(m.map((f) => ({ path: f.path, calls: f.calls.length, dataFlow: f.dataFlow.length, control: f.control.length, hierarchy: f.hierarchy.length })), null, 2).slice(0, 1800)); rl.prompt(); return; }
      if (t === '/a2a-card') { console.log(JSON.stringify(require('./a2a').agentCard(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/a2a-task ')) { const r = await require('./a2a').sendTask({ prompt: t.slice(10).trim() }); console.log(JSON.stringify(r, null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t === '/voice-status') { console.log(JSON.stringify(require('./voice_adapter').status(), null, 2)); rl.prompt(); return; }
      if (t === '/sealed-check') { console.log(JSON.stringify({ docker: require('./sealed').available() })); rl.prompt(); return; }
      if (t.startsWith('/sealed-run ')) { console.log(JSON.stringify(require('./sealed').run(t.slice(12).trim()), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t === '/tenants') { console.log(JSON.stringify(require('./tenants').list(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/tenant-create ')) { console.log(JSON.stringify(require('./tenants').create(t.slice(14).trim()))); rl.prompt(); return; }
      if (t.startsWith('/tenant-use ')) { console.log(JSON.stringify(require('./tenants').use(t.slice(12).trim()))); rl.prompt(); return; }
      if (t === '/dag-ui') { console.log('Open /dag.html in the web UI (--web)'); rl.prompt(); return; }
      if (t.startsWith('/board-add ')) { const p = t.slice(11).trim().split('|').map((x) => x.trim()); const task = require('./task_board').add(p[0], p[1] || '', (p[2] || '').split(',').filter(Boolean)); console.log(JSON.stringify(task)); rl.prompt(); return; }
      if (t === '/board') { console.log(JSON.stringify(require('./task_board').list(), null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t.startsWith('/board-done ')) { console.log(JSON.stringify(require('./task_board').complete(t.slice(12).trim()))); rl.prompt(); return; }
      if (t === '/ctxfs') { console.log(JSON.stringify(require('./context_fs').list('/'), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/ctxfs-read ')) { console.log(JSON.stringify(require('./context_fs').read(t.slice(12).trim()), null, 2).slice(0, 1000)); rl.prompt(); return; }
      if (t.startsWith('/ctxfs-search ')) { console.log(JSON.stringify(require('./context_fs').search(t.slice(14).trim()), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/bench-real ')) { const r = await require('./benchmarks_real').run(t.slice(12).trim()); console.log(JSON.stringify(r, null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t.startsWith('/pentest ')) { const r = await require('./pentest_pipeline').run(t.slice(9).trim()); console.log(JSON.stringify(r, null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t === '/hardware') { const hw = require('./hardware').detect(); console.log(JSON.stringify({ hw, recommend: require('./hardware').recommend(hw) }, null, 2)); rl.prompt(); return; }
      if (t.startsWith('/gw-allow ')) { const p = t.slice(10).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(require('./gateway').allow(p[0], p[1], p[2] || 'read'))); rl.prompt(); return; }
      if (t.startsWith('/gw-auth ')) { const p = t.slice(9).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(require('./gateway').authorize(p[0], p[1], p[2] || 'read'))); rl.prompt(); return; }
      if (t === '/gw-rules') { console.log(JSON.stringify(require('./gateway').rules(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/admit ')) { console.log(JSON.stringify(require('./admission').request(t.slice(7).trim(), {}))); rl.prompt(); return; }
      if (t.startsWith('/admit-confirm ')) { console.log(JSON.stringify(require('./admission').admit(t.slice(15).trim()))); rl.prompt(); return; }
      if (t.startsWith('/research ')) { const r = await require('./deep_research').research(t.slice(10).trim()); console.log(JSON.stringify(r, null, 2).slice(0, 2500)); rl.prompt(); return; }
      if (t === '/continual') { const r = require('./continual').cycle('', []); console.log(JSON.stringify(r, null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t === '/memory-hierarchy') { console.log(JSON.stringify(require('./memory_hierarchy').status(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/vuln-scan ')) { const r = require('./vuln_scan').scan(t.slice(11).trim() || root); console.log(JSON.stringify(r, null, 2).slice(0, 2500)); rl.prompt(); return; }
      if (t === '/security-kb') { console.log(JSON.stringify(require('./security_kb').list())); rl.prompt(); return; }
      if (t.startsWith('/sec-match ')) { console.log(JSON.stringify(require('./security_kb').match(t.slice(11).trim()), null, 2)); rl.prompt(); return; }
      if (t === '/runtimes') { console.log(JSON.stringify(require('./runtime_manager').detect(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/runtime-register ')) { const parts = t.slice(17).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(require('./runtime_manager').register(parts[0], parts[1]))); rl.prompt(); return; }
      if (t === '/shadow-ai') { console.log(JSON.stringify(require('./shadow_ai').scan(), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t === '/harnesses') { console.log(JSON.stringify(require('./harness_discovery').discover(), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t === '/mcp-market') { console.log(JSON.stringify(require('./mcp_marketplace').list(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/skill-install ')) { const parts = t.slice(14).trim().split('|').map((x) => x.trim()); console.log(JSON.stringify(require('./skill_pkg').install(parts[0], parts[1] || ''))); rl.prompt(); return; }
      if (t === '/skill-pkgs') { console.log(JSON.stringify(require('./skill_pkg').list(), null, 2)); rl.prompt(); return; }
      if (t === '/self-improve') { console.log(JSON.stringify(require('./self_improve').propose(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/improve-approve ')) { console.log(JSON.stringify(require('./self_improve').approve(t.slice(17).trim()))); rl.prompt(); return; }
      if (t.startsWith('/improve-ship ')) { console.log(JSON.stringify(require('./self_improve').ship(t.slice(14).trim()))); rl.prompt(); return; }
      if (t === '/templates') { console.log(JSON.stringify(Object.keys(require('./prompt_templates').list()))); rl.prompt(); return; }
      if (t.startsWith('/tpl ')) { const parts = t.slice(5).trim().split(/\s+/); console.log(require('./prompt_templates').render(parts[0], { code: parts.slice(1).join(' ') })); rl.prompt(); return; }
      if (t.startsWith('/spec-load ')) { const s = require('./harness_spec').load(t.slice(11).trim()); console.log(JSON.stringify({ spec: s, validation: require('./harness_spec').validate(s) }, null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/spec-apply ')) { const s = require('./harness_spec').load(t.slice(12).trim()); console.log(JSON.stringify(require('./harness_spec').apply(s))); rl.prompt(); return; }
      if (t.startsWith('/peer-review ')) { const r = await require('./peer_review').review(t.slice(13).trim()); console.log(JSON.stringify(r, null, 2)); rl.prompt(); return; }
      if (t.startsWith('/review ')) { const r = require('./content_review').review(t.slice(8).trim()); console.log(JSON.stringify(r, null, 2)); rl.prompt(); return; }
      if (t.startsWith('/search ')) { const r = await require('./web_search').search(t.slice(8).trim()); console.log(JSON.stringify(r, null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t.startsWith('/task-create ')) { const s = require('./task_state').create(t.slice(13).trim()); console.log(JSON.stringify(s, null, 2)); rl.prompt(); return; }
      if (t.startsWith('/task-update ')) { const parts = t.slice(13).trim().split('|').map((x) => x.trim()); const s = require('./task_state').update(parts[0], JSON.parse(parts[1] || '{}')); console.log(JSON.stringify(s, null, 2).slice(0, 1000)); rl.prompt(); return; }
      if (t === '/tasks') { console.log(JSON.stringify(require('./task_state').list(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/rollback ')) { const r = require('./rollback').restore(t.slice(10).trim()); console.log(JSON.stringify(r)); rl.prompt(); return; }
      if (t === '/rollbacks') { console.log(JSON.stringify(require('./rollback').list(), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/mail ')) { const parts = t.slice(6).trim().split('|').map((x) => x.trim()); const id = require('./mailbox').send(parts[0], 'user', parts[1] || '', parts[2] || ''); console.log('sent', id); rl.prompt(); return; }
      if (t.startsWith('/inbox ')) { const r = require('./mailbox').inbox(t.slice(7).trim()); console.log(JSON.stringify(r, null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t === '/waste') { const r = require('./waste').detect(lastToolLog); console.log(JSON.stringify(r, null, 2)); rl.prompt(); return; }
      if (t === '/diagnose') { const r = require('./counterfactual').diagnose(); console.log(JSON.stringify(r, null, 2)); rl.prompt(); return; }
      if (t === '/evolve') { const r = require('./counterfactual').evolve(); console.log(JSON.stringify(r, null, 2)); rl.prompt(); return; }
      if (t === '/ledger-verify') { console.log(JSON.stringify(require('./ledger').verify())); rl.prompt(); return; }
      if (t === '/ledger-replay') { console.log(JSON.stringify(require('./ledger').replay(), null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t.startsWith('/tremember ')) { const parts = t.slice(11).trim().split('|').map((x) => x.trim()); const id = require('./temporal_memory').remember(parts[0], parts[1] || 'manual', (parts[2] || '').split(',').filter(Boolean)); console.log('remembered', id); rl.prompt(); return; }
      if (t.startsWith('/tasof ')) { const parts = t.slice(7).trim().split('|').map((x) => x.trim()); const r = require('./temporal_memory').recallAsOf(parts[0], parts[1]); console.log(JSON.stringify(r, null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t === '/memory-graph') { const r = require('./temporal_memory').graph(); console.log(JSON.stringify(r, null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/pairing ')) { const parts = t.slice(9).trim().split(/\s+/); const r = await require('./pairing').runPairing([parts[0]], parts.slice(1)); console.log(JSON.stringify(r, null, 2)); rl.prompt(); return; }
      if (t === '/charter') { const c = require('./charter').load(root); console.log(c ? JSON.stringify(c, null, 2) : 'no charter found'); rl.prompt(); return; }
      if (t.startsWith('/team-create ')) { const parts = t.slice(13).trim().split('|').map((x) => x.trim()); const def = JSON.parse(parts[1] || '{}'); require('./teams').create(parts[0], def); console.log('created team', parts[0]); rl.prompt(); return; }
      if (t.startsWith('/team-run ')) { const parts = t.slice(10).trim().split('|').map((x) => x.trim()); const r = await require('./teams').run(parts[0], parts[1] || '', { projectRoot: root }); console.log(r.final || JSON.stringify(r)); rl.prompt(); return; }
      if (t === '/teams') { console.log(JSON.stringify(require('./teams').list(), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/extract ')) { const out = await require('./markdown_extract').fromUrl(t.slice(9).trim()); console.log(out.slice(0, 3000)); rl.prompt(); return; }
      if (t.startsWith('/schedule ')) { const parts = t.slice(10).trim().split('|').map((x) => x.trim()); const r = require('./scheduler').schedule(parts[0], parts[1], parts[2] || ''); console.log(JSON.stringify(r)); rl.prompt(); return; }
      if (t === '/sched-tick') { const r = await require('./scheduler').tick({ projectRoot: root }); console.log(JSON.stringify(r)); rl.prompt(); return; }
      if (t === '/optimize') { const r = require('./optimizer').analyze(); console.log(JSON.stringify(r, null, 2)); rl.prompt(); return; }
      if (t === '/optimize-apply') { const r = require('./optimizer').analyze(); console.log(JSON.stringify(require('./optimizer').apply(r.suggestions), null, 2)); rl.prompt(); return; }
      if (t.startsWith('/contract-save ')) { const r = require('./contracts').snapshot(t.slice(15).trim(), lastToolLog); console.log(JSON.stringify(r)); rl.prompt(); return; }
      if (t.startsWith('/contract-check ')) { const r = require('./contracts').check(t.slice(15).trim(), lastToolLog); console.log(JSON.stringify(r, null, 2)); rl.prompt(); return; }
      if (t === '/contracts') { console.log(JSON.stringify(require('./contracts').list(), null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/sremember ')) { const parts = t.slice(11).trim().split('|').map((x) => x.trim()); const id = require('./source_memory').remember(parts[0], parts[1] || 'manual'); console.log('remembered', id); rl.prompt(); return; }
      if (t.startsWith('/srecall ')) { const r = require('./source_memory').recall(t.slice(9).trim()); console.log(JSON.stringify(r, null, 2).slice(0, 1500)); rl.prompt(); return; }
      if (t.startsWith('/skill-eval ')) { const r = require('./skill_eval').evaluateFile(t.slice(12).trim()); console.log(JSON.stringify(r, null, 2)); rl.prompt(); return; }
      if (t === '/lint') { const r = require('./harness_lint').lint(); console.log(JSON.stringify(r, null, 2).slice(0, 2000)); rl.prompt(); return; }
      if (t === '/stress') { const r = require('./adversarial').run(); console.log(JSON.stringify(r, null, 2)); rl.prompt(); return; }
      if (t.startsWith('/search-sessions ')) { const hits = require('./session_search').searchSessions(t.slice(17).trim()); console.log('hits:', hits.length); rl.prompt(); return; }
      if (t === '/health') { const ok = await healthCheck(); console.log('backend healthy:', ok, 'circuit open:', isCircuitOpen()); rl.prompt(); return; }
      if (t.startsWith('/backup ')) { const p = t.slice(8).trim(); backup.backup(p); console.log('backup written:', p); rl.prompt(); return; }
      if (t.startsWith('/restore ')) { const p = t.slice(9).trim(); backup.restore(p); console.log('restored:', p); rl.prompt(); return; }
      if (t.startsWith('/vault ')) {
        const parts = t.slice(7).trim().split(/\s+/);
        const cmd = parts[0];
        if (cmd === 'set') { vault.setSecret(parts[1], parts.slice(2).join(' ')); console.log('set', parts[1]); }
        else if (cmd === 'get') { console.log(vault.getSecret(parts[1])); }
        else if (cmd === 'list') { console.log(vault.listSecrets().join(', ')); }
        else if (cmd === 'delete') { vault.deleteSecret(parts[1]); console.log('deleted', parts[1]); }
        rl.prompt(); return;
      }
      if (t.startsWith('/eval ')) {
        const parts = t.slice(6).trim().split(/\s+/);
        const cmd = parts[0];
        if (cmd === 'add') {
          // /eval add name | prompt | expected
          const rest = t.slice(6).trim().slice(4).trim();
          const segs = rest.split('|').map((s) => s.trim());
          const id = evalMod.addEval(segs[0] || 'case', segs[1] || '', segs[2] || '', 'default');
          console.log('added eval', id);
        } else if (cmd === 'run') {
          const r = await evalMod.runEvals({ projectRoot: root, model });
          console.log(JSON.stringify(r, null, 2).slice(0, 1000));
        } else if (cmd === 'list') {
          console.log(JSON.stringify(evalMod.listEvals(), null, 2).slice(0, 1000));
        }
        rl.prompt(); return;
      }
      if (t.startsWith('/bench')) {
        const parts = t.slice(6).trim().split(/\s+/).filter(Boolean);
        const models = parts.length ? parts : [process.env.AEGISAI_MODEL || 'llama3.2:3b'];
        const r = await require('./benchmark').runBenchmark({ models, projectRoot: root });
        console.log(JSON.stringify(r, null, 2).slice(0, 2000));
        rl.prompt(); return;
      }
      if (t === '/traces') {
        try {
          const rows = db.get().prepare('SELECT id, started, ended FROM traces ORDER BY started DESC LIMIT 10').all();
          console.log(JSON.stringify(rows, null, 2));
        } catch (e) { console.log('no traces'); }
        rl.prompt(); return;
      }
      try { await runOne(t); } catch (e) { console.error('error:', e.message || e); }
      rl.prompt();
      } catch (err) {
        console.error('[command error]', (err && err.message) || err);
        try { rl.prompt(); } catch (_) {}
      }
    });
    rl.on('close', () => { db.close(); process.exit(0); });
    return;
  }

  let model = process.env.AEGISAI_MODEL || 'llama3.2:3b';
  let root = process.cwd();
  let sandbox = false;
  let autoApprove = process.env.AEGISAI_AUTO_APPROVE === 'true';
  let offline = OFFLINE;
  let agentName = 'default';
  let trace = false;
  let doomLoop = false;
  const promptParts = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model') { model = args[++i]; continue; }
    if (args[i] === '--root') { root = args[++i]; continue; }
    if (args[i] === '--sandbox') { sandbox = true; continue; }
    if (args[i] === '--auto-approve') { autoApprove = true; continue; }
    if (args[i] === '--offline') { offline = true; continue; }
    if (args[i] === '--agent') { agentName = args[++i]; continue; }
    if (args[i] === '--trace') { trace = true; continue; }
    if (args[i] === '--doomloop') { doomLoop = true; continue; }
    promptParts.push(args[i]);
  }
  const prompt = promptParts.join(' ');
  const profile = profiles.getProfile(agentName);
  if (profile.model) model = profile.model;
  if (profile.sandbox) sandbox = true;

  const onEvent = (e) => {
    if (jsonFlag) return;
    if (e.type === 'token') process.stdout.write(e.content || '');
    else if (e.type === 'tool_call') console.error('\n[tool]', e.name, JSON.stringify(e.args || {}).slice(0, 200));
    else if (e.type === 'tool_result') console.error('[result]', (e.preview || '').slice(0, 200));
    else if (e.type === 'approval_denied') console.error('[approval denied]', e.name);
    else if (e.type === 'status') console.error('[status]', e.message);
  };

  const result = await runAgent({
    model,
    messages: [{ role: 'system', content: profile.systemPrompt }, { role: 'user', content: prompt }],
    projectRoot: root,
    onEvent,
    mcpTools,
    sandbox: sandbox || profile.sandbox,
    offline,
    autoApprove,
    includeCoding: profile.includeCoding !== false,
    cleanRoom: profile.cleanRoom,
    allowedTools: profile.allowedTools,
    deniedTools: profile.deniedTools,
    approvalHandler: autoApprove ? null : askApproval,
    tokenBudgetTotal: parseInt(process.env.AEGISAI_TOKEN_BUDGET_TOTAL || '0', 10),
    trace,
    doomLoop,
    contextFiles: contextFlag,
    readOnly: readOnlyFlag,
    piiProtection: piiFlag,
    charter: charterFlag,
    actionGuard: actionGuardFlag,
    approvalMode,
  });

  if (jsonFlag) {
    console.log(JSON.stringify({ final: result.final.final, tokenStats: result.final.tokenStats || null, toolLog: result.toolLog || [] }));
  } else {
    console.log('\n\n--- final ---');
    console.log(result.final.final);
    if (result.final.tokenStats) console.log('tokens:', JSON.stringify(result.final.tokenStats));
  }
  db.close();
}

main().catch((e) => { console.error('fatal:', e); process.exit(1); });
