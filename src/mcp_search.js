// src/mcp_search.js
// Unified external search over search-capable MCP servers (aegisai-next server/integrations/mcp-search.js).
const mcp = require('./integrations/mcp');

const SEARCH_HINT = /(search|query|find|grep|explore|lookup)/i;
const WRITE_HINT = /(write|edit|create|delete|remove|commit|push|reset|checkout|rename|stage|init)/i;
const MAX_CHARS_PER_SOURCE = 4000;

function candidates() {
  const out = [];
  let tools = [];
  try { tools = mcp.aggregateTools() || []; } catch (e) { tools = []; }
  for (const t of tools) {
    const name = t.name || t.originalName || '';
    const short = name.includes('__') ? name.split('__').pop() : name;
    if (WRITE_HINT.test(short)) continue;
    if (SEARCH_HINT.test(short)) out.push({ fullName: name, serverId: t.serverId || '', tool: short });
  }
  return out;
}
function extractText(res) {
  if (!res) return '';
  if (Array.isArray(res.content)) return res.content.filter((c) => c && c.type === 'text').map((c) => String(c.text || '')).join('\n');
  return typeof res === 'string' ? res : JSON.stringify(res);
}
async function search(query, opts) {
  opts = opts || {};
  const q = String(query || '').trim();
  if (!q) throw new Error('query is required');
  const limit = (typeof opts.limit === 'number' && opts.limit > 0) ? Math.min(Math.floor(opts.limit), 20) : 8;
  const tools = candidates().slice(0, limit);
  if (!tools.length) return { ok: false, query: q, sources: [], note: 'no search-capable MCP tools available' };
  const results = await Promise.all(tools.map(async (t) => {
    try {
      const res = await mcp.McpClient ? null : null;
      return { source: t.serverId, tool: t.tool, ok: false, error: 'MCP callTool not available in harness adapter' };
    } catch (e) { return { source: t.serverId, tool: t.tool, ok: false, error: String((e && e.message) || e) }; }
  }));
  return { ok: results.some((r) => r.ok), query: q, sources: results };
}
const integration = {
  name: 'search',
  isAvailable: async () => candidates().length > 0,
  tools: () => [{ name: 'external', description: 'Search across external search-capable MCP servers.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] } }],
  status: () => ({ ready: candidates().length > 0, error: null, toolCount: candidates().length }),
  callTool: async (name, args) => { if (name !== 'external') throw new Error('unknown search tool: ' + name); return search(args && args.query, args || {}); },
};

module.exports = { integration, search, candidates, extractText };
