// src/index.js
const { detectBackend, getType, getUrl } = require('./backends');
const db = require('./storage/db');
const { runAgent } = require('./agent/run');
const mcp = require('./integrations/mcp');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { DATA_DIR, OFFLINE } = require('./core/config');
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
  if (args.length === 0) {
    console.log('AegisAi Harness v0.2.0');
    console.log('Usage: node src/index.js "your prompt" [--model name] [--root /path] [--sandbox] [--auto-approve] [--offline]');
    console.log('Backend:', getType(), getUrl(), '| offline:', OFFLINE);
    console.log('MCP tools:', mcpTools.length);
    process.exit(0);
  }

  let model = process.env.AEGISAI_MODEL || 'llama3.2:3b';
  let root = process.cwd();
  let sandbox = false;
  let autoApprove = process.env.AEGISAI_AUTO_APPROVE === 'true';
  let offline = OFFLINE;
  const promptParts = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model') { model = args[++i]; continue; }
    if (args[i] === '--root') { root = args[++i]; continue; }
    if (args[i] === '--sandbox') { sandbox = true; continue; }
    if (args[i] === '--auto-approve') { autoApprove = true; continue; }
    if (args[i] === '--offline') { offline = true; continue; }
    promptParts.push(args[i]);
  }
  const prompt = promptParts.join(' ');

  const onEvent = (e) => {
    if (e.type === 'token') process.stdout.write(e.content || '');
    else if (e.type === 'tool_call') console.error('\n[tool]', e.name, JSON.stringify(e.args || {}).slice(0, 200));
    else if (e.type === 'tool_result') console.error('[result]', (e.preview || '').slice(0, 200));
    else if (e.type === 'approval_denied') console.error('[approval denied]', e.name);
    else if (e.type === 'status') console.error('[status]', e.message);
  };

  const result = await runAgent({
    model,
    messages: [{ role: 'user', content: prompt }],
    projectRoot: root,
    onEvent,
    mcpTools,
    sandbox,
    offline,
    autoApprove,
    approvalHandler: autoApprove ? null : askApproval,
    tokenBudgetTotal: parseInt(process.env.AEGISAI_TOKEN_BUDGET_TOTAL || '0', 10),
  });

  console.log('\n\n--- final ---');
  console.log(result.final.final);
  if (result.final.tokenStats) console.log('tokens:', JSON.stringify(result.final.tokenStats));
  db.close();
}

main().catch((e) => { console.error('fatal:', e); process.exit(1); });
