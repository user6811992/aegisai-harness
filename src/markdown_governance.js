// src/markdown_governance.js
// Markdown-based declarative governance: parse GOVERNANCE.md into rules.
const fs = require('fs');
const path = require('path');

function parse(text) {
  const gov = { rules: [], delegation: [], hooks: [] };
  let section = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      const h = line.match(/^##\s+(.+)$/);
      if (h) section = h[1].toLowerCase().replace(/\s+/g, '_');
      continue;
    }
    if (line.startsWith('- ')) {
      const item = line.slice(2).trim();
      if (section === 'rules') gov.rules.push(item);
      else if (section === 'delegation') gov.delegation.push(item);
      else if (section === 'hooks') gov.hooks.push(item);
    }
  }
  return gov;
}
function load(root) {
  root = root || process.cwd();
  for (const f of ['GOVERNANCE.md', '.aegisai/GOVERNANCE.md']) {
    const p = path.join(root, f);
    if (fs.existsSync(p)) return Object.assign({ path: p }, parse(fs.readFileSync(p, 'utf8')));
  }
  return null;
}
function toCharter(gov) {
  if (!gov) return null;
  return {
    protected_paths: gov.rules.filter((r) => /path|file|directory/i.test(r)),
    forbidden_tools: gov.rules.filter((r) => /^(no|never|forbid|ban)\b/i.test(r)).map((r) => r.replace(/^(no|never|forbid|ban)\s+/i, '').split(/\s+/)[0]),
    require_approval: gov.delegation || [],
    quality_gates: gov.hooks || [],
  };
}

module.exports = { parse, load, toCharter };
