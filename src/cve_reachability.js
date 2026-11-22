// src/cve_reachability.js
// Prove CVE reachability before patching (cve-swarm / dependency-security pattern).
const fs = require('fs');
const path = require('path');

function readLockfile(root) {
  root = root || process.cwd();
  for (const f of ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'requirements.txt']) {
    const p = path.join(root, f);
    if (fs.existsSync(p)) return { file: f, text: fs.readFileSync(p, 'utf8').slice(0, 200000) };
  }
  return null;
}
function isPresent(lock, pkg) {
  return lock ? lock.text.toLowerCase().includes(pkg.toLowerCase()) : false;
}
function importedFiles(root, pkg) {
  const out = [];
  function walk(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      if (['node_modules', '.git', 'data'].includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|ts|tsx|py)$/.test(e.name)) {
        try { const t = fs.readFileSync(p, 'utf8'); if (t.includes(pkg)) out.push(path.relative(root, p)); } catch (err) {}
      }
    }
  }
  walk(root);
  return out.slice(0, 30);
}
function prove(root, pkg) {
  const lock = readLockfile(root);
  const present = isPresent(lock, pkg);
  const importers = present ? importedFiles(root, pkg) : [];
  return { pkg, lockfile: lock ? lock.file : null, present, reachable: importers.length > 0, importers, verdict: !present ? 'not-present' : importers.length ? 'reachable' : 'present-but-unreferenced' };
}

module.exports = { readLockfile, isPresent, importedFiles, prove };
