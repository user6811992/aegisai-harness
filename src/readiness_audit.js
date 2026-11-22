// src/readiness_audit.js
// Project agent-readiness audit: AGENTS.md, context, tools, eval, guardrails.
const fs = require('fs');
const path = require('path');

function audit(root) {
  root = root || process.cwd();
  const checks = [
    { name: 'AGENTS.md / CLAUDE.md', present: ['AGENTS.md', 'CLAUDE.md'].some((f) => fs.existsSync(path.join(root, f))) },
    { name: 'context files', present: ['AGENTS.md', '.aegisai/charter.yaml'].some((f) => fs.existsSync(path.join(root, f))) },
    { name: 'MCP config', present: ['mcp.json', '.mcp.json'].some((f) => fs.existsSync(path.join(root, f))) },
    { name: 'tests', present: fs.existsSync(path.join(root, 'tests')) || fs.existsSync(path.join(root, 'test')) },
    { name: 'CI workflow', present: fs.existsSync(path.join(root, '.github', 'workflows')) },
    { name: 'README', present: fs.existsSync(path.join(root, 'README.md')) },
  ];
  const passed = checks.filter((c) => c.present).length;
  return { ready: passed >= 4, score: Math.round((passed / checks.length) * 100), checks };
}

module.exports = { audit };
