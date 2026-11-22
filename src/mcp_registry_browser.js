// src/mcp_registry_browser.js
// Browse published MCP servers (modelcontextprotocol/registry) instead of hardcoded catalog.
const https = (typeof fetch !== 'undefined') ? null : null;

async function browse(query, limit) {
  limit = limit || 20;
  const url = 'https://registry.modelcontextprotocol.io/v0/servers?search=' + encodeURIComponent(query || '') + '&limit=' + limit;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { 'Accept': 'application/json' } });
    if (!r.ok) return { ok: false, error: 'HTTP ' + r.status, results: [] };
    const d = await r.json();
    const servers = (d.servers || d.results || d || []).map((s) => ({ name: s.name || s.id || '', description: s.description || '', url: s.url || '', source: s.source || '' }));
    return { ok: true, query, count: servers.length, servers };
  } catch (e) { return { ok: false, error: String(e.message || e), results: [] }; }
}

function fallback() {
  return require('./mcp_marketplace').list();
}

module.exports = { browse, fallback };
