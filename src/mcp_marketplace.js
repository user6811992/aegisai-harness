// src/mcp_marketplace.js
// MCP marketplace: catalog of known useful MCP servers with install instructions.
const CATALOG = [
  { name: 'filesystem', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '.'], description: 'Filesystem access' },
  { name: 'git', command: 'npx', args: ['-y', '@modelcontextprotocol/server-git'], description: 'Git operations' },
  { name: 'sqlite', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sqlite'], description: 'SQLite queries' },
  { name: 'fetch', command: 'npx', args: ['-y', '@modelcontextprotocol/server-fetch'], description: 'Web fetch' },
  { name: 'memory', command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'], description: 'Knowledge graph memory' },
];

function list() { return CATALOG; }
function get(name) { return CATALOG.find((s) => s.name === name) || null; }
function configEntry(name) {
  const s = get(name);
  if (!s) return null;
  return { name, transport: 'stdio', command: s.command, args: s.args };
}

module.exports = { CATALOG, list, get, configEntry };
