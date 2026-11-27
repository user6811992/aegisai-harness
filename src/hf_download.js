// src/hf_download.js
// Hugging Face model downloader with streaming progress and optional checksum.
// Network-dependent and opt-in — disabled in offline mode (AEGISAI_OFFLINE=true).
// Inspired by thad0ctor/llama-server-launcher's HF downloader (MIT), clean-room.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { DATA_DIR } = require('./core/config');

const HF_HOST = 'https://huggingface.co';
const DEFAULT_CACHE = () => path.join(process.env.HF_HUB_CACHE || path.join(os.homedir(), '.cache', 'huggingface', 'hub'), 'models');

function offline() {
  return process.env.AEGISAI_OFFLINE === 'true';
}

// Validate a repo id like "owner/model" — no traversal, no absolute paths.
function validateRepo(repo) {
  if (typeof repo !== 'string' || !/^[\w.\-]+\/[\w.\-]+$/.test(repo) || repo.includes('..')) {
    throw new Error('invalid Hugging Face repo id (expected "owner/model"): ' + repo);
  }
  return repo;
}

function validateFilename(filename) {
  if (typeof filename !== 'string' || !filename || filename.includes('..') || path.isAbsolute(filename) || /[\\]/.test(filename)) {
    throw new Error('invalid model filename: ' + filename);
  }
  return filename;
}

function resolveUrl(repo, filename, revision) {
  validateRepo(repo);
  const rev = revision || 'main';
  if (!/^[\w.\-]+$/.test(rev)) throw new Error('invalid revision');
  const file = filename ? validateFilename(filename) : '';
  return `${HF_HOST}/${repo}/resolve/${encodeURIComponent(rev)}/${file.split('/').map(encodeURIComponent).join('/')}`;
}

function safeDest(repo, filename, opts) {
  const base = opts.dest || DEFAULT_CACHE();
  // Prevent escaping the destination root via crafted repo/filename.
  const target = path.resolve(base, validateRepo(repo), validateFilename(filename));
  const root = path.resolve(base);
  if (!target.startsWith(root + path.sep) && target !== root) throw new Error('download target escapes destination root');
  return target;
}

async function download(repo, filename, opts) {
  opts = opts || {};
  if (offline()) return { ok: false, error: 'downloads disabled in offline mode' };
  const url = resolveUrl(repo, filename, opts.revision);
  const target = safeDest(repo, filename, opts);
  if (fs.existsSync(target) && !opts.force) {
    return { ok: true, path: target, bytes: fs.statSync(target).size, url, cached: true };
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  let response;
  try {
    response = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'aegisai-model-downloader' },
      ...(opts.timeoutMs > 0 ? { signal: AbortSignal.timeout(opts.timeoutMs) } : {}),
    });
  } catch (e) {
    return { ok: false, error: 'download failed: ' + String((e && e.message) || e), url };
  }
  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status}`, status: response.status, url };
  }
  const total = Number(response.headers.get('content-length') || 0);
  let downloaded = 0;
  const tmp = target + '.part';
  const hash = opts.sha256 ? crypto.createHash('sha256') : null;
  try {
    const file = fs.createWriteStream(tmp);
    if (response.body && response.body.getReader) {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const buf = Buffer.from(value);
        file.write(buf);
        if (hash) hash.update(buf);
        downloaded += buf.length;
        if (opts.onProgress) opts.onProgress(downloaded, total);
      }
    } else {
      const buf = Buffer.from(await response.arrayBuffer());
      file.write(buf);
      if (hash) hash.update(buf);
      downloaded = buf.length;
      if (opts.onProgress) opts.onProgress(downloaded, total);
    }
    await new Promise((resolve, reject) => { file.end(); file.on('finish', resolve); file.on('error', reject); });
    if (opts.sha256 && hash.digest('hex') !== opts.sha256.toLowerCase()) {
      fs.rmSync(tmp, { force: true });
      return { ok: false, error: 'sha256 mismatch', url };
    }
    if (total && downloaded !== total) {
      fs.rmSync(tmp, { force: true });
      return { ok: false, error: `incomplete download: ${downloaded}/${total}`, url };
    }
    fs.renameSync(tmp, target);
    return { ok: true, path: target, bytes: downloaded, url, cached: false };
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    return { ok: false, error: String((e && e.message) || e), url };
  }
}

async function manifest(repo, opts) {
  opts = opts || {};
  if (offline()) return { ok: false, error: 'manifest lookup disabled in offline mode' };
  const id = validateRepo(repo);
  const url = `${HF_HOST}/api/models/${id}`;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'aegisai-model-discovery' },
      signal: AbortSignal.timeout(opts.timeoutMs || 10000),
    });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}`, url };
    const d = await r.json();
    const files = (d.siblings || []).map((s) => s.rfilename).filter((f) => /\.(gguf|safetensors|bin|json)$/i.test(f));
    return { ok: true, repo: id, files, url, modelCount: files.length };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), url };
  }
}

function tools() {
  return [
    { name: 'hf_model_url', description: 'Resolve a Hugging Face model file URL without downloading.', inputSchema: { type: 'object', properties: { repo: { type: 'string' }, filename: { type: 'string' }, revision: { type: 'string' } }, required: ['repo'] } },
    { name: 'hf_model_manifest', description: 'List model files in a Hugging Face repo (network, opt-in).', inputSchema: { type: 'object', properties: { repo: { type: 'string' } }, required: ['repo'] } },
    { name: 'hf_model_download', description: 'Stream a model file from Hugging Face to local cache (network, opt-in).', inputSchema: { type: 'object', properties: { repo: { type: 'string' }, filename: { type: 'string' }, dest: { type: 'string' }, sha256: { type: 'string' } }, required: ['repo', 'filename'] } },
  ];
}

async function dispatch(name, args) {
  args = args || {};
  if (name === 'hf_model_url') {
    try { return { ok: true, url: resolveUrl(args.repo, args.filename, args.revision) }; }
    catch (e) { return { ok: false, error: String(e.message || e) }; }
  }
  if (name === 'hf_model_manifest') return manifest(args.repo, args);
  if (name === 'hf_model_download') return download(args.repo, args.filename, args);
  throw new Error('unknown hf download tool: ' + name);
}

module.exports = { resolveUrl, validateRepo, validateFilename, safeDest, download, manifest, tools, dispatch, offline, HF_HOST, DEFAULT_CACHE };
