// src/backend_setup.js
// Opt-in backend installation/startup. Nothing is downloaded or launched unless
// the caller explicitly confirms. Works offline for already-installed backends.
const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { DEFAULT_URLS, isSupportedBackend, normalizeBackendType } = require('./backends');

const SPECS = {
  ollama: {
    binary: 'ollama', health: '/api/tags', docs: 'https://ollama.com/download',
    install: {
      win32: { cmd: 'winget', args: ['install', '--id', 'Ollama.Ollama', '-e', '--accept-source-agreements', '--accept-package-agreements'] },
      darwin: { cmd: 'brew', args: ['install', 'ollama'] },
      linux: { cmd: 'sh', args: ['-c', 'curl -fsSL https://ollama.com/install.sh | sh'] },
    },
    start: { cmd: 'ollama', args: ['serve'] },
  },
  llamacpp: { binary: 'llama-server', health: '/v1/models', docs: 'https://github.com/ggml-org/llama.cpp/releases', install: null, start: null },
  lmstudio: { binary: 'lms', health: '/v1/models', docs: 'https://lmstudio.ai/download', install: null, start: null },
  openai: { binary: null, health: '/v1/models', docs: 'Remote API — set BACKEND_API_KEY and BACKEND_URL', install: null, start: null },
  router: { binary: null, health: '/api/tags', docs: 'Comma-separated BACKEND_URL list', install: null, start: null },
  inproc: { binary: null, health: '', docs: 'In-process ggml binding (feature-gated)', install: null, start: null },
};

function spec(type) {
  const t = normalizeBackendType(type);
  if (!isSupportedBackend(t)) return { ok: false, error: 'unsupported backend: ' + type };
  return { ok: true, type: t, ...(SPECS[t] || { binary: null, health: '/api/tags', docs: '', install: null, start: null }) };
}

// An installer can add a binary to the user PATH after this process started,
// so also check the known per-user install locations.
function knownPaths(name) {
  const local = process.env.LOCALAPPDATA || '';
  if (name === 'ollama' && local) return [path.join(local, 'Programs', 'Ollama', 'ollama.exe')];
  if (name === 'llama-server' && local) return [path.join(local, 'Programs', 'llama.cpp', 'llama-server.exe')];
  return [];
}
function binaryPath(name) {
  if (!name) return null;
  const tool = process.platform === 'win32' ? 'where' : 'which';
  const r = spawnSync(tool, [name], { encoding: 'utf8', timeout: 5000, windowsHide: true });
  if (r.status === 0) return String(r.stdout || '').split(/\r?\n/)[0].trim() || name;
  return knownPaths(name).find((p) => fs.existsSync(p)) || null;
}
function hasBinary(name) { return !!binaryPath(name); }

async function healthy(type, url, timeoutMs) {
  const s = spec(type);
  if (!s.ok || !s.health || !url || url.startsWith('inproc://')) return false;
  try {
    const r = await fetch(url.replace(/\/$/, '') + s.health, { signal: AbortSignal.timeout(timeoutMs || 1500) });
    return r.ok;
  } catch (e) { return false; }
}

async function status(type) {
  const s = spec(type);
  if (!s.ok) return s;
  const url = DEFAULT_URLS[s.type] || getUrl();
  const installed = hasBinary(s.binary);
  const running = await healthy(s.type, url, 2000);
  return { ok: true, type: s.type, installed, running, binary: s.binary, url, docs: s.docs,
    canInstall: !!(s.install && s.install[process.platform]), canStart: !!(s.start && installed) };
}

async function plan(type) {
  const s = spec(type);
  if (!s.ok) return s;
  const st = await status(type);
  const step = s.install && s.install[process.platform]
    ? { command: s.install[process.platform].cmd, args: s.install[process.platform].args }
    : null;
  return { ok: true, type: s.type, status: st, install: step, start: s.start, docs: s.docs,
    note: step ? 'Install and start require explicit confirmation; offline mode blocks install.' : 'No universal installer — follow the docs link, then use Start.' };
}

async function ensure(type, opts) {
  opts = opts || {};
  const s = spec(type);
  if (!s.ok) return s;
  if (opts.confirmed !== true) return { ok: false, error: 'explicit confirmation required (confirmed: true)' };
  const offline = process.env.AEGISAI_OFFLINE === 'true';
  const url = opts.url || DEFAULT_URLS[s.type] || getUrl();
  let output = '';
  let installed = hasBinary(s.binary);

  if (opts.install) {
    if (offline) return { ok: false, error: 'install disabled in offline mode' };
    if (!s.install || !s.install[process.platform]) return { ok: false, error: 'no universal installer for ' + s.type + '; see docs: ' + s.docs };
    if (!installed) {
      const ins = s.install[process.platform];
      const r = spawnSync(ins.cmd, ins.args, { encoding: 'utf8', timeout: (opts.timeoutMs || 600000), windowsHide: true });
      output = String(r.stdout || '') + String(r.stderr || '');
      if (r.status !== 0) return { ok: false, error: 'install failed (exit ' + r.status + ')', output: output.slice(-2000) };
      installed = hasBinary(s.binary);
    }
  }

  let started = false;
  if (opts.start && s.start && installed && !(await healthy(s.type, url, 1000))) {
    const child = spawn(binaryPath(s.binary) || s.start.cmd, s.start.args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    started = true;
  }

  const deadline = Date.now() + (opts.waitMs || 15000);
  let running = await healthy(s.type, url, 1500);
  while (!running && Date.now() < deadline) {
    await new Promise((res) => setTimeout(res, 500));
    running = await healthy(s.type, url, 1500);
  }
  return { ok: running, type: s.type, installed, running, started, url, output: output.slice(-2000),
    error: running ? null : 'backend did not become healthy at ' + url };
}

function tools() {
  return [
    { name: 'backend_status', description: 'Check whether a backend is installed and reachable.', inputSchema: { type: 'object', properties: { type: { type: 'string' } }, required: ['type'] } },
    { name: 'backend_plan', description: 'Plan an opt-in backend install/start.', inputSchema: { type: 'object', properties: { type: { type: 'string' } }, required: ['type'] } },
    { name: 'backend_ensure', description: 'Install/start a backend with explicit confirmation.', inputSchema: { type: 'object', properties: { type: { type: 'string' }, install: { type: 'boolean' }, start: { type: 'boolean' }, confirmed: { type: 'boolean' } }, required: ['type','confirmed'] } },
  ];
}
async function dispatch(name, args) {
  args = args || {};
  if (name === 'backend_status') return status(args.type);
  if (name === 'backend_plan') return plan(args.type);
  if (name === 'backend_ensure') return ensure(args.type, args);
  throw new Error('unknown backend_setup tool: ' + name);
}
module.exports = { SPECS, spec, knownPaths, binaryPath, hasBinary, healthy, status, plan, ensure, tools, dispatch };
