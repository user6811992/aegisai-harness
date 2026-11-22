// src/mcp_apps.js
// MCP Apps protocol: render UIs embedded in chat served by MCP servers (modelcontextprotocol/ext-apps).
const UI_RESOURCE_PREFIX = 'ui://';

function isAppResource(uri) { return String(uri || '').startsWith(UI_RESOURCE_PREFIX); }
function parseAppUri(uri) {
  // ui://server/view?params
  const u = new URL(uri.replace('ui://', 'http://'));
  return { server: u.hostname, view: u.pathname.replace(/^\//, ''), params: Object.fromEntries(u.searchParams) };
}
function renderTag(uri, opts) {
  opts = opts || {};
  const w = opts.width || '100%';
  const h = opts.height || '400px';
  return '<iframe src="' + uri + '" style="width:' + w + ';height:' + h + ';border:1px solid var(--border);border-radius:8px;" sandbox="allow-scripts allow-same-origin"></iframe>';
}

module.exports = { UI_RESOURCE_PREFIX, isAppResource, parseAppUri, renderTag };
