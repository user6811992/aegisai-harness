// src/config_matrix.js
// Compatibility matrix: which config file each harness/tool reads.
const MATRIX = [
  { file: 'AGENTS.md', tools: ['Codex', 'Cursor', 'OpenCode', 'Copilot', 'Gemini CLI', 'Aider', 'AegisAi'] },
  { file: 'CLAUDE.md', tools: ['Claude Code', 'Cursor', 'AegisAi'] },
  { file: '.cursorrules', tools: ['Cursor'] },
  { file: '.github/copilot-instructions.md', tools: ['Copilot'] },
  { file: 'GEMINI.md', tools: ['Gemini CLI'] },
  { file: 'opencode.json(c)', tools: ['OpenCode', 'AegisAi'] },
  { file: '.aegisai/charter.yaml', tools: ['AegisAi'] },
  { file: 'mcp.json', tools: ['Claude Code', 'Cursor', 'OpenCode', 'AegisAi'] },
  { file: 'SKILL.md', tools: ['Claude Code', 'Codex', 'AegisAi', 'Cursor', 'Gemini CLI'] },
];
function forTool(tool) { return MATRIX.filter((m) => m.tools.some((t) => t.toLowerCase() === String(tool).toLowerCase())).map((m) => m.file); }
function forFile(file) { return MATRIX.find((m) => m.file === file) || null; }
function all() { return MATRIX; }

module.exports = { MATRIX, forTool, forFile, all };
