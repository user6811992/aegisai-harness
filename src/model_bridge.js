// src/model_bridge.js
// Ollama <-> LM Studio model store bridge.
// Inspired by eelbaz/ollama-lmstudio-bridge: share one model set between
// backends by symlinking Ollama blobs into LM Studio's models directory.
const fs = require('fs');
const os = require('os');
const path = require('path');

function defaultRoot() {
  return os.homedir();
}

function storePaths(root) {
  root = root || process.env.USERPROFILE || defaultRoot();
  const ollama = path.join(root, '.ollama', 'models');
  const lmStudio = path.join(root, '.lmstudio', 'models', 'lmstudio');
  return { ollama, lmStudio, manifests: path.join(ollama, 'manifests', 'registry.ollama.ai'), blobs: path.join(ollama, 'blobs') };
}

function exists(p) {
  try { return fs.existsSync(p); } catch (e) { return false; }
}

function countFiles(dir) {
  if (!exists(dir)) return 0;
  let n = 0;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isFile()) n += 1;
    }
  } catch (e) {}
  return n;
}

function detectModelStores(root) {
  const p = storePaths(root);
  return {
    ollama: { path: p.ollama, exists: exists(p.ollama), manifests: exists(p.manifests), blobCount: countFiles(p.blobs) },
    lmStudio: { path: p.lmStudio, exists: exists(p.lmStudio), modelCount: countFiles(p.lmStudio) },
    canBridge: exists(p.manifests) && exists(p.blobs),
    paths: p,
  };
}

// Walk manifests and return [{ name, manifestPath, blobPaths }]
function listOllamaModels(root) {
  const p = storePaths(root);
  const out = [];
  if (!exists(p.manifests)) return out;
  function walk(dir, prefix) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, prefix ? prefix + '/' + e.name : e.name);
      else if (e.isFile()) {
        let manifest;
        try { manifest = JSON.parse(fs.readFileSync(full, 'utf8')); } catch (err) { continue; }
        const layers = Array.isArray(manifest.layers) ? manifest.layers : [];
        const blobPaths = layers
          .map((l) => l && l.digest && String(l.digest).startsWith('sha256:')
            ? path.join(p.blobs, 'sha256-' + String(l.digest).slice(7))
            : null)
          .filter((b) => b && exists(b));
        out.push({ name: prefix, tag: e.name, manifestPath: full, blobPaths });
      }
    }
  }
  walk(p.manifests, '');
  return out;
}

function ensureLink(target, linkPath, opts) {
  opts = opts || {};
  if (opts.dryRun) return { ok: true, dryRun: true, linkPath };
  if (!exists(target)) return { ok: false, error: 'source blob missing: ' + target, linkPath };
  try {
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    if (exists(linkPath)) return { ok: true, skipped: true, linkPath };
    const type = process.platform === 'win32' ? 'file' : undefined;
    fs.symlinkSync(target, linkPath, type);
    return { ok: true, created: true, linkPath };
  } catch (e) {
    return {
      ok: false,
      linkPath,
      error: String((e && e.message) || e),
      hint: process.platform === 'win32'
        ? 'Windows symlinks require Developer Mode or an elevated shell.'
        : 'Check write permissions on the target directory.',
    };
  }
}

function syncModels(root, opts) {
  opts = opts || {};
  const p = storePaths(root);
  const models = listOllamaModels(root);
  const created = [];
  const skipped = [];
  const errors = [];
  for (const m of models) {
    const dir = path.join(p.lmStudio, m.name.replace(/[\/\\]/g, '__'));
    for (const blob of m.blobPaths) {
      const linkPath = path.join(dir, path.basename(blob));
      const r = ensureLink(blob, linkPath, opts);
      if (r.dryRun) { skipped.push({ linkPath, reason: 'dryRun' }); }
      else if (r.created) created.push({ linkPath, source: blob });
      else if (r.skipped) skipped.push({ linkPath, reason: 'exists' });
      else errors.push({ linkPath, error: r.error, hint: r.hint });
    }
  }
  return {
    ok: errors.length === 0,
    models: models.length,
    created: created.length,
    skipped: skipped.length,
    errors,
    createdLinks: created,
    skippedLinks: skipped,
  };
}

// Register as a tool for the harness tool registry / MCP surface.
function tools() {
  return [
    {
      name: 'model_bridge_status',
      description: 'Detect Ollama and LM Studio model stores and whether they can be bridged.',
      inputSchema: { type: 'object', properties: { root: { type: 'string' } } },
    },
    {
      name: 'model_bridge_sync',
      description: 'Symlink Ollama model blobs into the LM Studio models directory (opt-in).',
      inputSchema: {
        type: 'object',
        properties: { root: { type: 'string' }, dryRun: { type: 'boolean' } },
      },
    },
  ];
}

function dispatch(name, args) {
  args = args || {};
  if (name === 'model_bridge_status') return detectModelStores(args.root);
  if (name === 'model_bridge_sync') return syncModels(args.root, { dryRun: !!args.dryRun });
  throw new Error('unknown model_bridge tool: ' + name);
}

module.exports = {
  detectModelStores, listOllamaModels, syncModels, ensureLink, storePaths, tools, dispatch,
};
