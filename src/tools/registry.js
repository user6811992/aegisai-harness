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
  const offline = !!opts.offline;
  let tools = [];
  if (includeCoding) {
    let codingTools = coding.codingToolsAsOllama();
    if (offline) {
      // remove network-dependent tools in offline mode
      codingTools = codingTools.filter((t) => t.function.name !== 'web_search');
    }
    tools = tools.concat(codingTools);
  }
  const ext = opts.externalTools || {};
  for (const src of Object.keys(ext)) {
    for (const t of (ext[src] || [])) {
      tools.push({ type: 'function', function: { name: `${src}_${t.name}`, description: t.description || '', parameters: t.inputSchema || { type: 'object', properties: {} } } });
    }
  }
  tools = capabilities.filterTools(tools, { allowedTools, deniedTools });
  if (tools.length > toolBudget) {
    const codingNames = new Set(coding.CODING_TOOLS.map((t) => t.name));
    const external = (n) => !codingNames.has(n);
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
