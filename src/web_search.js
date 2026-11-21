// src/web_search.js
// Agent-native web search with keyless defaults (DuckDuckGo HTML).
const { strip } = require('./markdown_extract');

async function search(query, limit) {
  limit = limit || 8;
  const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query || '');
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Mozilla/5.0 (AegisAiHarness/1.0)' } });
    if (!r.ok) return { results: [], error: 'HTTP ' + r.status };
    const html = await r.text();
    const results = [];
    const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) && results.length < limit) {
      let link = m[1];
      try { const u = new URL(link, 'https://duckduckgo.com'); link = u.searchParams.get('uddg') || link; } catch (e) {}
      results.push({ title: strip(m[2]), url: link, snippet: strip(m[3]) });
    }
    return { results, query };
  } catch (e) { return { results: [], error: String(e.message || e) }; }
}

module.exports = { search };
