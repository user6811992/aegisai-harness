// src/model_discovery.js
// Discover local model files (GGUF, Ollama blobs, LM Studio) + HuggingFace pull.
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOTS_BY_BACKEND = {
  ollama: [
    path.join(os.homedir(), '.ollama'),
  ],
  lmstudio: [
    path.join(os.homedir(), '.cache', 'lm-studio'),
    path.join(os.homedir(), 'LM Studio'),
    path.join(os.homedir(), '.lmstudio'),
  ],
  llamacpp: [
    path.join(os.homedir(), 'models'),
    path.join(os.homedir(), 'llama.cpp', 'models'),
  ],
  vllm: [],
  openai: [],
  generic: [
    path.join(os.homedir(), 'models'),
    path.join(os.homedir(), 'Downloads'),
  ],
};

function getDefaultRoots(backend) {
  const roots = [...(ROOTS_BY_BACKEND[backend] || ROOTS_BY_BACKEND.generic)];
  // Add common roots for all backends
  if (!roots.includes(path.join(os.homedir(), 'models'))) {
    roots.push(path.join(os.homedir(), 'models'));
  }
  if (process.platform === 'win32') {
    for (const drive of ['C:', 'D:', 'E:', 'F:']) {
      const modelsDir = drive + '\\models';
      try { if (fs.existsSync(modelsDir)) roots.push(modelsDir); } catch (e) {}
      const ollamaDir = drive + '\\.ollama';
      try { if (fs.existsSync(ollamaDir)) roots.push(ollamaDir); } catch (e) {}
      // LM Studio on Windows
      const lmStudioDir = drive + '\\LM Studio';
      try { if (fs.existsSync(lmStudioDir)) roots.push(lmStudioDir); } catch (e) {}
    }
  }
  // Deduplicate
  return [...new Set(roots)];
}

// Detect which backend is active
function detectBackend() {
  const envType = process.env.BACKEND_TYPE || '';
  if (envType && ROOTS_BY_BACKEND[envType]) return envType;
  // Check if Ollama is running
  try {
    const http = require('http');
    // Synchronous check not possible; return 'generic' as default
  } catch (e) {}
  return 'generic';
}

function splitShardInfo(name) {
  const m = String(name || '').match(/^(.*)-(\d{5})-of-(\d{5})\.gguf$/i);
  if (!m) return null;
  return { base: m[1], index: parseInt(m[2], 10), total: parseInt(m[3], 10) };
}

function scan(roots, maxFiles, backend) {
  // If no roots provided, use backend-specific defaults
  if (!roots || (Array.isArray(roots) && roots.length === 0)) {
    roots = getDefaultRoots(backend || detectBackend());
  }
  const found = [];
  let count = 0;
  const extensions = /\.(gguf|bin|safetensors)$/i;
  function walk(dir, depth) {
    if (depth > 8 || count >= (maxFiles || 500)) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      if (count >= (maxFiles || 500)) break;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        // Skip node_modules, .git, etc.
        if (['node_modules', '.git', 'AppData', 'Windows', 'Program Files'].includes(e.name)) continue;
        walk(p, depth + 1);
      } else if (extensions.test(e.name)) {
        let size = 0;
        try { size = fs.statSync(p).size; } catch (err) {}
        const ext = path.extname(e.name).slice(1).toLowerCase();
        // `.bin` is used by many non-model artefacts; require a model-sized file.
        const MIN_BIN_BYTES = 50 * 1024 * 1024;
        if (ext === 'bin' && size < MIN_BIN_BYTES) continue;
        found.push({ path: p, name: e.name, sizeGB: +(size / 1024 ** 3).toFixed(2), type: ext });
        count += 1;
      }
    }
  }
  for (const r of roots) walk(r, 0);

  // Also check Ollama models
  try {
    const ollamaDir = path.join(os.homedir(), '.ollama', 'models');
    if (fs.existsSync(ollamaDir)) {
      // Ollama stores models as blobs; list the manifests
      const manifestsDir = path.join(ollamaDir, 'manifests');
      if (fs.existsSync(manifestsDir)) {
        function walkManifests(dir, prefix) {
          let entries = [];
          try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
          for (const e of entries) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) walkManifests(p, prefix + e.name + '/');
            else {
              found.push({ path: p, name: (prefix + e.name).replace(/\//g, ':'), sizeGB: 0, type: 'ollama' });
              count += 1;
            }
          }
        }
        walkManifests(manifestsDir, '');
      }
    }
  } catch (e) {}

  // Split GGUF models are one model in several shards. llama.cpp loads the
  // rest automatically when pointed at the first shard, so list one entry
  // instead of every shard.
  const groups = new Map();
  const output = [];
  for (const f of found) {
    const info = splitShardInfo(f.name);
    if (!info) { output.push(f); continue; }
    const key = path.dirname(f.path) + '|' + info.base;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ file: f, info });
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.info.index - b.info.index);
    if (group[0].info.index !== 1) {
      output.push(...group.map((x) => x.file));
      continue;
    }
    const first = group[0];
    let totalBytes = 0;
    for (const item of group) {
      try { totalBytes += fs.statSync(item.file.path).size; }
      catch (e) { totalBytes += Math.round((item.file.sizeGB || 0) * 1024 ** 3); }
    }
    output.push(Object.assign({}, first.file, {
      sizeGB: +(totalBytes / 1024 ** 3).toFixed(2),
      split: { index: 1, total: first.info.total, shards: group.map((x) => x.file.path) },
    }));
  }

  return output;
}

const hf = require('./hf_download');

// Backward-compatible: returns the resolved URL synchronously (the REPL and
// older tests rely on `.url`). Use `hfDownload` for the real streaming pull.
function huggingFacePull(repo, filename) {
  try {
    const url = hf.resolveUrl(repo, filename, 'main');
    return { ok: true, url, note: 'call hfDownload(repo, filename) to stream to local cache' };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

// Real streaming download with progress + optional checksum (network, opt-in).
function hfDownload(repo, filename, opts) { return hf.download(repo, filename, opts); }
function hfManifest(repo, opts) { return hf.manifest(repo, opts); }

module.exports = { ROOTS: [], getDefaultRoots, scan, huggingFacePull, hfDownload, hfManifest };
