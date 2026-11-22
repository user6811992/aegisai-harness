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

function scan(roots, maxFiles) {
  roots = roots || ROOTS;
  const found = [];
  let count = 0;
  function walk(dir, depth) {
    if (depth > 6 || count >= (maxFiles || 300)) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      if (count >= (maxFiles || 300)) break;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (/\.gguf$/i.test(e.name)) {
        let size = 0;
        try { size = fs.statSync(p).size; } catch (err) {}
        found.push({ path: p, name: e.name, sizeGB: +(size / 1024 ** 3).toFixed(2) });
        count += 1;
      }
    }
  }
  for (const r of roots) walk(r, 0);
  return found;
}
function huggingFacePull(repo, filename) {
  const url = 'https://huggingface.co/' + repo + '/resolve/main/' + (filename || '');
  return { ok: true, url, note: 'streaming download not implemented; open URL or use huggingface-cli' };
}

module.exports = { ROOTS, scan, huggingFacePull };
