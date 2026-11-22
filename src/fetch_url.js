// src/fetch_url.js
// Dedicated fetch tool with HTML→Markdown conversion (modelcontextprotocol/servers "Fetch").
const { fromUrl } = require('./markdown_extract');

function normalizeUrl(url) {
  const v = require('./url_validate').validate(url);
  if (!v.ok) return { ok: false, error: v.reason };
  return { ok: true, url: v.url };
}

async function fetch(url, opts) {
  opts = opts || {};
  const v = normalizeUrl(url);
  if (!v.ok) return { ok: false, error: v.error };
  const text = await fromUrl(v.url);
  if (String(text).startsWith('error:')) return { ok: false, error: text };
  return { ok: true, url: v.url, content: text, length: text.length, truncated: text.length >= 20000 };
}

module.exports = { normalizeUrl, fetch };
