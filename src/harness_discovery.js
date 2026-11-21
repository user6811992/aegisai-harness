// src/harness_discovery.js
// Discover config/MCP files across harnesses on this machine (read-only).
const fs = require('fs');
const path = require('path');
const os = require('os');

const TARGETS = [
  ['.claude', ['settings.json', 'CLAUDE.md']],
  ['.codex', ['config.toml']],
  ['.config/opencode', ['opencode.json', 'opencode.jsonc']],
  ['.cursor', ['mcp.json']],
  ['.aegisai', ['charter.yaml', 'mcp.json']],
];

function discover() {
  const home = os.homedir();
  const found = [];
  for (const [dir, files] of TARGETS) {
    const base = path.join(home, dir);
    for (const f of files) {
      const p = path.join(base, f);
      if (fs.existsSync(p)) found.push({ harness: dir, path: p, type: f.includes('mcp') ? 'mcp' : 'config' });
    }
  }
  const cwd = process.cwd();
  for (const f of ['mcp.json', '.mcp.json', 'AGENTS.md', 'CLAUDE.md', '.aegisai/charter.yaml']) {
    const p = path.join(cwd, f);
    if (fs.existsSync(p)) found.push({ harness: 'project', path: p, type: f.includes('mcp') ? 'mcp' : 'config' });
  }
  return found;
}

module.exports = { TARGETS, discover };
