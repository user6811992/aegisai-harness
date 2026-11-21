// src/context_files.js
// Repo-scoped agent briefings: AGENTS.md / CLAUDE.md / .aegisai/context.md.
const fs = require('fs');
const path = require('path');
const NAMES = ['AGENTS.md', 'CLAUDE.md', '.aegisai/context.md'];

function load(root) {
  root = path.resolve(root || process.cwd());
  const found = [];
  let dir = root;
  for (let i = 0; i < 12; i++) {
    for (const n of NAMES) {
      const p = path.join(dir, n);
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        try { found.push({ path: p, content: fs.readFileSync(p, 'utf8') }); } catch (e) {}
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return found;
}

function systemText(root) {
  const files = load(root);
  if (!files.length) return '';
  return 'Project context files:\n\n' + files.map((f) => '### ' + path.relative(root, f.path) + '\n' + f.content).join('\n\n---\n\n');
}

function inject(messages, root) {
  const text = systemText(root);
  if (!text) return messages || [];
  return [{ role: 'system', content: text }].concat(messages || []);
}

module.exports = { load, systemText, inject, NAMES };
