// src/lightpanda.js
// Opt-in Lightpanda browser backend — a headless browser written in Zig that
// speaks CDP, MCP, CLI fetch, WebDriver (Classic + BiDi), and PandaScript.
// Clean-room integration of ideas from lightpanda-io/browser + agent-skill.
// NOT bundled: requires a separately installed `lightpanda` binary.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');
const { DATA_DIR } = require('./core/config');

const DEFAULT_CDP_PORT = 9223;
const DEFAULT_MCP_PORT = 1234;

// Binary detection without executing untrusted paths.
function available() {
  const explicit = process.env.LIGHTPANDA_BIN;
  const candidates = explicit ? [explicit] : ['lightpanda', path.join(os.homedir(), '.local', 'bin', 'lightpanda'), '/usr/local/bin/lightpanda'];
  const out = { available: false, binary: null, candidates, source: 'PATH' };
  for (const c of candidates) {
    try {
      const tool = process.platform === 'win32' ? 'where' : 'which';
      const r = spawnSync(tool, [c], { encoding: 'utf8', timeout: 3000 });
      if (r.status === 0 && r.stdout.trim()) { out.available = true; out.binary = c; break; }
      if (explicit && fs.existsSync(c)) { out.available = true; out.binary = c; break; }
    } catch (e) {}
  }
  return out;
}

function version() {
  const a = available();
  if (!a.available) return { ok: false, error: 'lightpanda binary not found' };
  try {
    const r = spawnSync(a.binary, ['version'], { encoding: 'utf8', timeout: 5000 });
    return { ok: r.status === 0, output: (r.stdout || r.stderr || '').trim().slice(0, 300), binary: a.binary };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

let child = null;
function start(opts) {
  opts = opts || {};
  const a = available();
  if (!a.available) return { ok: false, error: 'lightpanda binary not found; install from https://github.com/lightpanda-io/browser' };
  if (child && !child.killed) return { ok: true, alreadyRunning: true, cdpUrl: cdpUrl(opts) };
  const port = opts.port || DEFAULT_CDP_PORT;
  const args = ['serve', '--host', '127.0.0.1', '--port', String(port)];
  if (opts.headless !== false) args.push('--headless');
  try {
    child = spawn(a.binary, args, { stdio: 'ignore', detached: false });
    return { ok: true, pid: child.pid, cdpUrl: cdpUrl({ port }), args };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

function stop() {
  if (!child) return { ok: true, stopped: false };
  try { child.kill(); } catch (e) {}
  child = null;
  return { ok: true, stopped: true };
}

function cdpUrl(opts) {
  return (opts && opts.cdpUrl) || process.env.LIGHTPANDA_CDP_URL || `http://127.0.0.1:${(opts && opts.port) || DEFAULT_CDP_PORT}`;
}

// Use the existing CDP-based browser tools against Lightpanda by pointing the
// integration at Lightpanda's CDP endpoint (no duplicate CDP implementation).
async function useBrowser(name, args, opts) {
  const url = cdpUrl(opts);
  process.env.CDP_URL = url;
  try { delete require.cache[require.resolve('./integrations/browser')]; } catch (e) {}
  const browser = require('./integrations/browser');
  return browser.handle(name, args || {});
}

// CLI one-shot extraction (fast path — no persistent process).
function fetchPage(target, opts) {
  opts = opts || {};
  const a = available();
  if (!a.available) return { ok: false, error: 'lightpanda binary not found' };
  try {
    const r = spawnSync(a.binary, ['fetch', target], { encoding: 'utf8', timeout: opts.timeoutMs || 15000, maxBuffer: 8 * 1024 * 1024 });
    return { ok: r.status === 0, output: (r.stdout || '').slice(0, 100000), error: r.status !== 0 ? (r.stderr || '').slice(0, 500) : null };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

// PandaScript: deterministic, token-free replay scripts. Store scripts locally
// so repeated browser tasks don't need an LLM call.
const SCRIPT_DIR = () => path.join(DATA_DIR, 'pandascripts');
function saveScript(name, commands) {
  fs.mkdirSync(SCRIPT_DIR(), { recursive: true });
  const safe = String(name || 'script').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  const p = path.join(SCRIPT_DIR(), safe + '.json');
  const script = { name: safe, created: new Date().toISOString(), commands: commands || [] };
  fs.writeFileSync(p, JSON.stringify(script, null, 2));
  return { ok: true, name: safe, path: p, commands: script.commands.length };
}
function listScripts() {
  if (!fs.existsSync(SCRIPT_DIR())) return [];
  return fs.readdirSync(SCRIPT_DIR()).filter((f) => f.endsWith('.json')).map((f) => {
    try { const s = JSON.parse(fs.readFileSync(path.join(SCRIPT_DIR(), f), 'utf8')); return { name: s.name, commands: (s.commands || []).length }; }
    catch (e) { return null; }
  }).filter(Boolean);
}
function runScript(name, opts) {
  const safe = String(name || 'script').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  const p = path.join(SCRIPT_DIR(), safe + '.json');
  if (!fs.existsSync(p)) return { ok: false, error: 'script not found: ' + safe };
  const script = JSON.parse(fs.readFileSync(p, 'utf8'));
  // Replay via existing CDP browser handlers; deterministic, no LLM call.
  const results = [];
  for (const cmd of (script.commands || [])) {
    if (opts && opts.dryRun) { results.push({ command: cmd, dryRun: true }); continue; }
    const r = useBrowser(cmd.tool || 'browser_navigate', cmd.args || {}, opts);
    results.push(Promise.resolve(r).then((x) => ({ command: cmd, result: x })));
  }
  return Promise.all(results).then((r) => ({ ok: true, name: safe, results: r }));
}

const SKILL_NAME = 'lightpanda';
const SKILL_DESCRIPTION = 'Use Lightpanda, a 16x lighter headless browser, for fast local web automation and data extraction via CDP/MCP/CLI.';
const SKILL_BODY = `# ${SKILL_NAME}

${SKILL_DESCRIPTION}

## Interfaces (choose the cheapest)
- **CLI fetch** — \`lightpanda fetch <url>\` for one-off page extraction (no process).
- **CDP server** — reuse the harness browser tools by setting \`LIGHTPANDA_CDP_URL\` / \`CDP_URL\` to Lightpanda's endpoint (default port 9223).
- **MCP server** — native MCP for interactive browsing (navigate/click/extract).
- **WebDriver Classic/BiDi** — Selenium/Puppeteer compatibility.
- **PandaScript** — save deterministic replay scripts; repeat tasks token-free.

## Rules
- Check \`lightpanda_available\` first; if missing, suggest installing from github.com/lightpanda-io/browser.
- Prefer CLI fetch for single pages; use CDP only for multi-step interactive tasks.
- Save repeated task sequences as PandaScript and replay instead of re-asking the model.
- Network-dependent and opt-in; respect offline mode and local-only guarantees.
`;

function skill() { return { name: SKILL_NAME, description: SKILL_DESCRIPTION, body: SKILL_BODY }; }

function tools() {
  return [
    { name: 'lightpanda_available', description: 'Check whether the opt-in Lightpanda binary is installed.', inputSchema: { type: 'object' } },
    { name: 'lightpanda_start', description: 'Start a local Lightpanda CDP server (opt-in).', inputSchema: { type: 'object', properties: { port: { type: 'number' } } } },
    { name: 'lightpanda_fetch', description: 'One-shot page extraction via lightpanda fetch CLI.', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
    { name: 'lightpanda_script_save', description: 'Save a deterministic PandaScript for token-free replay.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, commands: { type: 'array' } }, required: ['name', 'commands'] } },
    { name: 'lightpanda_script_list', description: 'List saved PandaScripts.', inputSchema: { type: 'object' } },
    { name: 'lightpanda_skill', description: 'Read the Lightpanda agent skill.', inputSchema: { type: 'object' } },
  ];
}

async function dispatch(name, args) {
  args = args || {};
  if (name === 'lightpanda_available') return available();
  if (name === 'lightpanda_version') return version();
  if (name === 'lightpanda_start') return start(args);
  if (name === 'lightpanda_stop') return stop();
  if (name === 'lightpanda_fetch') return fetchPage(args.url, args);
  if (name === 'lightpanda_script_save') return saveScript(args.name, args.commands);
  if (name === 'lightpanda_script_list') return { ok: true, scripts: listScripts() };
  if (name === 'lightpanda_script_run') return runScript(args.name, args);
  if (name === 'lightpanda_skill') return Object.assign({ ok: true }, skill());
  throw new Error('unknown lightpanda tool: ' + name);
}

module.exports = {
  available, version, start, stop, cdpUrl, useBrowser, fetchPage,
  saveScript, listScripts, runScript, skill, tools, dispatch,
  DEFAULT_CDP_PORT, SKILL_NAME,
};
