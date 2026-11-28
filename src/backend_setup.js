// src/backend_setup.js
// Opt-in backend installation/startup. Nothing is downloaded or launched unless
// the caller explicitly confirms. Works offline for already-installed backends.
const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { DEFAULT_URLS, isSupportedBackend, normalizeBackendType, getUrl } = require('./backends');
const { DATA_DIR } = require('./core/config');
const BACKEND_DIR = () => path.join(DATA_DIR, 'backends', 'llama.cpp');
const RELEASES_API = 'https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=15';

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
  llamacpp: {
    binary: 'llama-server', health: '/v1/models', docs: 'https://github.com/ggml-org/llama.cpp/releases', install: null,
    // Official MIT-licensed prebuilt binaries, not vendored source.
    download: {
      win32: ['win-vulkan-x64', 'win-cpu-x64'],
      linux: ['ubuntu-vulkan-x64', 'ubuntu-x64'],
      darwin: ['macos-arm64', 'macos-x64'],
    },
    start: { cmd: 'llama-server', args: ['--host', '127.0.0.1', '--port', '8081'] },
  },
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
  if (name === 'llama-server') {
    const exe = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';
    return [path.join(BACKEND_DIR(), exe), ...(local ? [path.join(local, 'Programs', 'llama.cpp', exe)] : [])];
  }
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

async function resolveAsset(patterns) {
  const res = await fetch(RELEASES_API, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'aegisai-harness', Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error('llama.cpp release lookup failed: HTTP ' + res.status);
  const releases = await res.json();
  for (const rel of (Array.isArray(releases) ? releases : [])) {
    if (!/^b\d+$/.test(rel.tag_name || '')) continue;
    for (const pattern of patterns) {
      const prefix = `llama-${rel.tag_name}-bin-${pattern}.`;
      const asset = (rel.assets || []).find((a) => a.name.startsWith(prefix) && (a.name.endsWith('.zip') || a.name.endsWith('.tar.gz')));
      if (asset) return { tag: rel.tag_name, name: asset.name, url: asset.browser_download_url };
    }
  }
  throw new Error('no prebuilt asset for ' + patterns.join(' / '));
}

async function downloadBackend(opts) {
  const patterns = SPECS.llamacpp.download[process.platform];
  if (!patterns) throw new Error('no prebuilt llama.cpp package for ' + process.platform);
  const asset = await resolveAsset(patterns);
  const dir = BACKEND_DIR();
  fs.mkdirSync(dir, { recursive: true });
  const res = await fetch(asset.url, { signal: AbortSignal.timeout((opts && opts.downloadTimeoutMs) || 600000) });
  if (!res.ok) throw new Error('download failed: HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024 * 1024) throw new Error('download too small to be a llama.cpp binary');
  const archive = path.join(dir, asset.name);
  fs.writeFileSync(archive, buf);
  const tar = spawnSync('tar', ['-xf', asset.name], { cwd: dir, encoding: 'utf8', timeout: 120000, windowsHide: true });
  fs.rmSync(archive, { force: true });
  if (tar.status !== 0) throw new Error('extract failed: ' + String(tar.stderr || '').slice(-500));
  if (!fs.existsSync(knownPaths('llama-server')[0])) throw new Error('llama-server not found after extraction');
  return { tag: asset.tag, asset: asset.name, bytes: buf.length };
}

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
    canInstall: !!(s.install && s.install[process.platform]) || !!(s.download && s.download[process.platform]),
    canStart: !!(s.start && installed) };
}

async function plan(type) {
  const s = spec(type);
  if (!s.ok) return s;
  const st = await status(type);
  const step = s.install && s.install[process.platform]
    ? { command: s.install[process.platform].cmd, args: s.install[process.platform].args }
    : null;
  return { ok: true, type: s.type, status: st, install: step, download: s.download && s.download[process.platform], start: s.start, docs: s.docs,
    note: step || s.download ? 'Install and start require explicit confirmation; offline mode blocks install. llama.cpp uses official MIT-licensed prebuilt binaries (no source vendored).' : 'No universal installer — follow the docs link, then use Start.' };
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
    if (!installed) {
      if (s.install && s.install[process.platform]) {
        const ins = s.install[process.platform];
        const r = spawnSync(ins.cmd, ins.args, { encoding: 'utf8', timeout: (opts.timeoutMs || 600000), windowsHide: true });
        output = String(r.stdout || '') + String(r.stderr || '');
        if (r.status !== 0) return { ok: false, error: 'install failed (exit ' + r.status + ')', output: output.slice(-2000) };
      } else if (s.download && s.download[process.platform]) {
        try { output = JSON.stringify(await downloadBackend(opts)); }
        catch (e) { return { ok: false, error: String(e.message || e), docs: s.docs }; }
      } else return { ok: false, error: 'no universal installer for ' + s.type + '; see docs: ' + s.docs };
      installed = hasBinary(s.binary);
    }
  }

  let started = false;
  const alreadyRunning = await healthy(s.type, url, 1000);
  if (opts.start && s.start && installed && !alreadyRunning) {
    const args = s.start.args.slice();
    if (s.type === 'llamacpp') {
      if (!opts.model) return { ok: false, error: 'a GGUF model path is required to start llama.cpp (pass "model")', installed, docs: s.docs };
      args.unshift('-m', String(opts.model));
    }
    const child = spawn(binaryPath(s.binary) || s.start.cmd, args, { detached: true, stdio: 'ignore', windowsHide: true });
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
    { name: 'backend_ensure', description: 'Install/start a backend with explicit confirmation.', inputSchema: { type: 'object', properties: { type: { type: 'string' }, install: { type: 'boolean' }, start: { type: 'boolean' }, confirmed: { type: 'boolean' }, model: { type: 'string' } }, required: ['type','confirmed'] } },
  ];
}
async function dispatch(name, args) {
  args = args || {};
  if (name === 'backend_status') return status(args.type);
  if (name === 'backend_plan') return plan(args.type);
  if (name === 'backend_ensure') return ensure(args.type, args);
  throw new Error('unknown backend_setup tool: ' + name);
}
module.exports = { SPECS, BACKEND_DIR, resolveAsset, downloadBackend, spec, knownPaths, binaryPath, hasBinary, healthy, status, plan, ensure, tools, dispatch };
