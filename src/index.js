// src/index.js
// AegisAi Harness entry point (CLI).
const { detectBackend, getType, getUrl } = require('./backends');
const db = require('./storage/db');
const { runAgent } = require('./agent/run');
const path = require('path');
const fs = require('fs');
const { DATA_DIR } = require('./core/config');
const logger = require('./core/logger');

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

  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('AegisAi Harness v0.1.0');
    console.log('Usage: node src/index.js "your prompt" [--model name] [--root /path]');
    console.log('Backend:', getType(), getUrl());
    process.exit(0);
  }

  let model = process.env.AEGISAI_MODEL || 'llama3.2:3b';
  let root = process.cwd();
  const promptParts = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model') { model = args[++i]; continue; }
    if (args[i] === '--root') { root = args[++i]; continue; }
    promptParts.push(args[i]);
  }
  const prompt = promptParts.join(' ');

  const onEvent = (e) => {
    if (e.type === 'token') process.stdout.write(e.content || '');
    else if (e.type === 'tool_call') console.error('\n[tool]', e.name, JSON.stringify(e.args || {}).slice(0, 200));
    else if (e.type === 'tool_result') console.error('[result]', (e.preview || '').slice(0, 200));
    else if (e.type === 'status') console.error('[status]', e.message);
  };

  const result = await runAgent({
    model,
    messages: [{ role: 'user', content: prompt }],
    projectRoot: root,
    onEvent,
  });

  console.log('\n\n--- final ---');
  console.log(result.final.final);
  if (result.final.tokenStats) console.log('tokens:', JSON.stringify(result.final.tokenStats));
  db.close();
}

main().catch((e) => { console.error('fatal:', e); process.exit(1); });
