// src/netvein_adapter.js
// netvein (123 web-RE tools) MCP adapter — graceful fallback if not configured.
const mcp = require('./integrations/mcp');

async function connect() {
  const cfg = process.env.NETVEIN_MCP_URL || process.env.NETVEIN_MCP_COMMAND;
  if (!cfg) return { ok: false, note: 'netvein MCP not configured (set NETVEIN_MCP_URL or NETVEIN_MCP_COMMAND)' };
  try {
    const server = cfg.startsWith('http') ? { name: 'netvein', transport: 'http', url: cfg } : { name: 'netvein', transport: 'stdio', command: cfg };
    const client = new mcp.McpClient(server);
    await client.start();
    return { ok: true, tools: client.tools.map((t) => t.name) };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}
function status() { return { configured: !!(process.env.NETVEIN_MCP_URL || process.env.NETVEIN_MCP_COMMAND), tools: 123 }; }

module.exports = { connect, status };
