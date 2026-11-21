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
    if (mcpTools.length) logger.info('mcp tools loaded', { count: mcpTools.length });
  } catch (e) {
    logger.warn('mcp connect failed', { error: String(e.message || e) });
  }

  const args = process.argv.slice(2);
  const replFlag = args.includes('--repl');
  const proxyFlag = args.includes('--proxy');

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
    const runOne = async (prompt) => {
      const result = await runAgent({
        model, messages: [{ role: 'user', content: prompt }], projectRoot: root,
        onEvent: (e) => { if (e.type === 'token') process.stdout.write(e.content || ''); else if (e.type === 'status') process.stderr.write('[status] ' + e.message + '\n'); },
        mcpTools, sandbox, autoApprove, offline,
        approvalHandler: autoApprove ? null : askApproval,
        tokenBudgetTotal: parseInt(process.env.AEGISAI_TOKEN_BUDGET_TOTAL || '0', 10),
      });
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
  });

  console.log('\n\n--- final ---');
  console.log(result.final.final);
  if (result.final.tokenStats) console.log('tokens:', JSON.stringify(result.final.tokenStats));
  db.close();
}

main().catch((e) => { console.error('fatal:', e); process.exit(1); });
