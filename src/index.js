// src/index.js
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
  const charterFlag = args.includes('--charter');
  const actionGuardFlag = args.includes('--action-guard');

  if (webFlag) {
    const http = require('http');
    const path = require('path');
    const port = parseInt(process.env.PORT || '8080', 10);
    const host = process.env.HOST || '127.0.0.1';
    const token = process.env.AEGISAI_TOKEN || process.env.LOCALAI_TOKEN || '';
    const rateLimit = parseInt(process.env.AEGISAI_RATE_LIMIT || '0', 10);
    const rateWindow = parseInt(process.env.AEGISAI_RATE_WINDOW || '60', 10) * 1000;
    const rateHits = new Map();
    const sessions = new Map(); // session id -> messages array
    const pendingActions = new Map();

    function readJson(req) {
      return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch (e) { reject(e); } });
      });
    }
    function sendJson(res, status, obj) {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    }

    const server = http.createServer(async (req, res) => {
      // auth
      if (token) {
        const supplied = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '') || new URL(req.url, 'http://x').searchParams.get('token');
        if (supplied !== token) { sendJson(res, 401, { error: 'unauthorized' }); return; }
      }
      // rate limit
      if (rateLimit > 0) {
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
          const history = Array.isArray(parsed.history) ? parsed.history : (sessions.get(sid) || []);
          const result = await runAgent({
            model: parsed.model || process.env.AEGISAI_MODEL || 'llama3.2:3b',
            messages: history.concat([{ role: 'user', content: parsed.message || '' }]),
            projectRoot: process.cwd(),
            onEvent: () => {},
            autoApprove: true,
          });
          const reply = (result.final && result.final.final) || '';
          const updated = history.concat([{ role: 'user', content: parsed.message || '' }, { role: 'assistant', content: reply }]);
          sessions.set(sid, updated);
          sendJson(res, 200, { reply, toolLog: result.toolLog || [], pendingActions: pendingActions.get(sid) || [] });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/branch') {
          const parsed = await readJson(req);
          const sid = parsed.sessionId || 'default';
          const hist = sessions.get(sid) || [];
          const idx = Math.max(0, Math.min(parsed.index || 0, hist.length));
          const branched = hist.slice(0, idx);
          sessions.set(sid + '_' + Date.now(), branched);
          sendJson(res, 200, { messages: branched });
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
          const sid = parsed.sessionId || 'default';
          const acts = pendingActions.get(sid) || [];
          if (acts[parsed.index]) acts[parsed.index].decision = parsed.approve ? 'allow' : 'deny';
          sendJson(res, 200, { ok: true });
          return;
        }
      } catch (e) { sendJson(res, 500, { error: String(e.message || e) }); return; }

      try {
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
          let ok = false;
          try { require('./backup').importState(parsed.data); ok = true; } catch (e) {}
          sendJson(res, 200, { ok });
          return;
        }
        if (req.method === 'GET' && req.url.split('?')[0] === '/api/config') {
          sendJson(res, 200, {
            projectRootAllowlist: process.env.AEGISAI_PROJECT_ROOT_ALLOWLIST || '',
            sttUrl: process.env.STT_URL || '',
            ttsUrl: process.env.TTS_URL || '',
          });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/config') {
          const parsed = await readJson(req);
          if (parsed.projectRootAllowlist) process.env.AEGISAI_PROJECT_ROOT_ALLOWLIST = parsed.projectRootAllowlist;
          if (parsed.sttUrl !== undefined) process.env.STT_URL = parsed.sttUrl;
          if (parsed.ttsUrl !== undefined) process.env.TTS_URL = parsed.ttsUrl;
          sendJson(res, 200, { ok: true });
          return;
        }
        if (req.method === 'POST' && req.url.split('?')[0] === '/api/stt') {
          // proxy audio body to configured STT URL (OpenAI-compatible /v1/audio/transcriptions)
          const url = process.env.STT_URL;
          if (!url) { sendJson(res, 400, { error: 'STT_URL not configured' }); return; }
          try {
            const chunks = [];
            for await (const c of req) chunks.push(c);
            const body = Buffer.concat(chunks);
            const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': req.headers['content-type'] || 'audio/webm' }, body });
            const data = await r.json();
            sendJson(res, 200, { text: data.text || '' });
          } catch (e) { sendJson(res, 500, { error: String(e.message || e) }); }
          return;
        }
      } catch (e) { sendJson(res, 500, { error: String(e.message || e) }); return; }

      // serve static
      let urlPath = req.url.split('?')[0];
      let filePath = path.join(__dirname, '..', 'public', urlPath === '/' ? 'index.html' : urlPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const ct = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : ext === '.json' ? 'application/json' : ext === '.webmanifest' ? 'application/manifest+json' : 'text/plain';
        res.writeHead(200, { 'Content-Type': ct });
        res.end(fs.readFileSync(filePath));
      } else { res.writeHead(404); res.end(); }
    });
    server.listen(port, host, () => console.log('Web UI at http://' + host + ':' + port));
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
    const server = http.createServer(async (req, res) => {
      if (req.method === 'POST' && req.url.includes('/chat/completions')) {
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body);
            const result = await runAgent({
              model: parsed.model || process.env.AEGISAI_MODEL || 'llama3.2:3b',
              messages: parsed.messages || [],
              projectRoot: process.cwd(),
              onEvent: () => {},
              autoApprove: true,
            });
            const resp = { id: 'chatcmpl-' + Date.now(), object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: parsed.model, choices: [{ index: 0, message: { role: 'assistant', content: (result.final && result.final.final) || '' }, finish_reason: 'stop' }] };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(resp));
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(e.message || e) }));
          }
        });
      } else {
        res.writeHead(404); res.end();
      }
    });
    server.listen(port, () => console.log('Proxy listening on :' + port));
    return;
  }

  if (args.length === 0 || replFlag) {
    console.log('AegisAi Harness v0.3.0 REPL. Type /exit to quit, /help for commands.');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'harness> ' });
    let model = process.env.AEGISAI_MODEL || 'llama3.2:3b';
    let root = process.cwd();
    let sandbox = false;
    let autoApprove = process.env.AEGISAI_AUTO_APPROVE === 'true';
    let offline = OFFLINE;
    let lastToolLog = [];
    const runOne = async (prompt) => {
      const result = await runAgent({
        model, messages: [{ role: 'user', content: prompt }], projectRoot: root,
        onEvent: (e) => { if (e.type === 'token') process.stdout.write(e.content || ''); else if (e.type === 'status') process.stderr.write('[status] ' + e.message + '\n'); },
        mcpTools, sandbox, autoApprove, offline,
        approvalHandler: autoApprove ? null : askApproval,
        tokenBudgetTotal: parseInt(process.env.AEGISAI_TOKEN_BUDGET_TOTAL || '0', 10),
        contextFiles: true,
      });
      lastToolLog = result.toolLog || [];
      process.stdout.write('\n');
      console.log('--- final ---');
      console.log(result.final.final);
    };
    rl.prompt();
    rl.on('line', async (line) => {
      const t = line.trim();
      if (!t) { rl.prompt(); return; }
      if (t === '/exit' || t === '/quit') { rl.close(); return; }
      if (t === '/help') { console.log('Commands: /exit, /model <name>, /root <path>, /sandbox on|off, /autoapprove on|off, /offline on|off, /agent <name>, /index, /replay <sessionId>, /health, /backup <file>, /restore <file>, /vault set|get|list|delete ..., /eval add|run|list, /traces'); rl.prompt(); return; }
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
