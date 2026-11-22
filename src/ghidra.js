// src/ghidra.js
// Ghidra native integration via GhidrAssistMCP (Ghidra 12.x + Java 25+).
const fs = require('fs');

function url() { return process.env.GHIDRA_MCP_URL || ''; }
function available() { return !!url(); }
function status() {
  const installDir = process.env.GHIDRA_INSTALL_DIR || '';
  const javaHome = process.env.JAVA_HOME || '';
  return {
    available: available(),
    url: url(),
    ghidraInstalled: installDir ? fs.existsSync(installDir) : 'unknown',
    javaHome: javaHome || 'not set',
    installDir: installDir || 'not set',
  };
}
const TOOLS = [
  { type: 'function', function: { name: 'ghidra_decompile', description: 'Decompile a function in Ghidra by address/name.', parameters: { type: 'object', properties: { address: { type: 'string' }, function: { type: 'string' } }, required: [] } } },
  { type: 'function', function: { name: 'ghidra_xrefs', description: 'Find cross-references to an address/symbol in Ghidra.', parameters: { type: 'object', properties: { target: { type: 'string' } }, required: ['target'] } } },
  { type: 'function', function: { name: 'ghidra_strings', description: 'List strings in the Ghidra project.', parameters: { type: 'object', properties: { filter: { type: 'string' } } } } },
];
function invoke(tool, args) {
  if (!available()) return { ok: false, output: 'Ghidra MCP not configured (set GHIDRA_MCP_URL)' };
  return { ok: false, output: 'Ghidra MCP configured at ' + url() + ' — invoke via MCP client (stdio/HTTP) not yet wired for direct calls' };
}

module.exports = { url, available, status, invoke, TOOLS };
