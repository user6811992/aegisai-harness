// src/tools/registry.js
// Assembles the tool list for an agent run and applies capability/budget filters.
const coding = require('./coding');
const capabilities = require('../core/capabilities');

const CLEAN_ROOM_BLOCKED = new Set([
  'read_file','write_file','delete_file','list_files','search_files',
  'run_command','run_python',
]);

function isCleanRoomBlocked(name) {
  if (CLEAN_ROOM_BLOCKED.has(name)) return true;
  if (/(^|_)(read|file|exec|run|fetch|search)/i.test(name) && !/memory/i.test(name)) return true;
  return false;
}

function assemble(opts) {
  opts = opts || {};
  const toolBudget = opts.toolBudget || 64;
  const allowedTools = opts.allowedTools;
  const deniedTools = opts.deniedTools;
  const includeCoding = opts.includeCoding !== false;
  let tools = [];
  if (includeCoding) tools = tools.concat(coding.codingToolsAsOllama());
  // external tools (MCP/plugins) can be injected via opts.externalTools
  const ext = opts.externalTools || {};
  for (const src of Object.keys(ext)) {
    for (const t of (ext[src] || [])) {
      tools.push({ type: 'function', function: { name: `${src}_${t.name}`, description: t.description || '', parameters: t.inputSchema || { type: 'object', properties: {} } } });
    }
  }
  tools = capabilities.filterTools(tools, { allowedTools, deniedTools });
  if (tools.length > toolBudget) {
    const external = (n) => /^(ghidra|craft|are|rea|mcp)_/.test(n);
    const codingTools = tools.filter((t) => !external(t.function.name));
    const externals = tools.filter((t) => external(t.function.name));
    const kept = [...codingTools];
    let rem = toolBudget - kept.length;
    for (const t of externals) { if (rem <= 0) break; kept.push(t); rem -= 1; }
    tools = kept;
  }
  return tools;
}

module.exports = { assemble, isCleanRoomBlocked };
