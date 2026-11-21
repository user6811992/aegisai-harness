// src/shadow_ai.js
// Discover unregistered agent configs/skills/MCP servers on this machine (read-only).
const fs = require('fs');
const path = require('path');
const os = require('os');

const PATTERNS = ['.claude', '.codex', '.cursor', '.opencode', '.aegisai', '.config/opencode'];

function scan() {
  const home = os.homedir();
  const found = [];
  for (const p of PATTERNS) {
    const dir = path.join(home, p);
    if (fs.existsSync(dir)) {
      let files = [];
      try { files = fs.readdirSync(dir).slice(0, 50); } catch (e) {}
      found.push({ path: dir, type: 'agent-home', entries: files.length });
    }
  }
  // scan cwd for agent config files
  const cwd = process.cwd();
  for (const name of ['AGENTS.md', 'CLAUDE.md', '.aegisai/charter.yaml', 'mcp.json', '.mcp.json']) {
    const p = path.join(cwd, name);
    if (fs.existsSync(p)) found.push({ path: p, type: 'config-file' });
  }
  return { scanned: [home, cwd], found, unregistered: found.filter((f) => f.type === 'agent-home') };
}

module.exports = { scan, PATTERNS };
