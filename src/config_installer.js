// src/config_installer.js
// One-click install of skills/MCP/rules across discovered harnesses.
const fs = require('fs');
const path = require('path');
const os = require('os');
const discovery = require('./harness_discovery');

const TARGETS = [
  { harness: 'opencode', file: 'AGENTS.md' },
  { harness: 'claude', file: 'CLAUDE.md' },
  { harness: 'project', file: 'AGENTS.md' },
  { harness: 'aegisai', file: '.aegisai/charter.yaml' },
];

function preview(content) {
  return TARGETS.map((t) => ({ harness: t.harness, path: path.join(process.cwd(), t.file), exists: fs.existsSync(path.join(process.cwd(), t.file)), bytes: Buffer.byteLength(content || '') }));
}
function install(content, only) {
  const written = [];
  for (const t of TARGETS) {
    if (only && !only.includes(t.harness)) continue;
    const p = path.join(process.cwd(), t.file);
    try { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content || ''); written.push(p); } catch (e) {}
  }
  return { written };
}
function discovered() { return discovery.discover(); }

module.exports = { TARGETS, preview, install, discovered };
