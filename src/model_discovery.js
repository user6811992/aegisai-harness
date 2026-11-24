// src/model_discovery.js
// Discover local model files (GGUF, Ollama blobs, LM Studio) + HuggingFace pull.
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOTS = [
  path.join(os.homedir(), '.ollama'),
  path.join(os.homedir(), '.cache', 'lm-studio'),
  path.join(os.homedir(), 'LM Studio'),
  path.join(os.homedir(), 'models'),
];

// Also scan common drive roots on Windows
function getDefaultRoots() {
  const roots = [...ROOTS];
  if (process.platform === 'win32') {
    // Add common Windows locations
    for (const drive of ['C:', 'D:', 'E:']) {
      const modelsDir = drive + '\\models';
      try { if (fs.existsSync(modelsDir)) roots.push(modelsDir); } catch (e) {}
      const ollamaDir = drive + '\\.ollama';
      try { if (fs.existsSync(ollamaDir)) roots.push(ollamaDir); } catch (e) {}
    }
  }
  return roots;
}

function scan(roots, maxFiles) {
  roots = roots || getDefaultRoots();
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
        found.push({ path: p, name: e.name, sizeGB: +(size / 1024 ** 3).toFixed(2), type: path.extname(e.name).slice(1).toLowerCase() });
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

  return found;
}

function huggingFacePull(repo, filename) {
  const url = 'https://huggingface.co/' + repo + '/resolve/main/' + (filename || '');
  return { ok: true, url, note: 'streaming download not implemented; open URL or use huggingface-cli' };
}

module.exports = { ROOTS, getDefaultRoots, scan, huggingFacePull };
function huggingFacePull(repo, filename) {
  const url = 'https://huggingface.co/' + repo + '/resolve/main/' + (filename || '');
  return { ok: true, url, note: 'streaming download not implemented; open URL or use huggingface-cli' };
}

module.exports = { ROOTS, scan, huggingFacePull };
