// src/web_search.js
// Agent-native web search with pluggable engines.
const { strip } = require('./markdown_extract');

const ENGINES = {
  duckduckgo: async (query, limit) => {
    if (process.env.AEGISAI_ALLOW_PRIVATE_URLS !== 'true' && !require('./url_validate').validate('https://duckduckgo.com').ok) return { results: [], error: 'search endpoint blocked' };
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
  },
  brave: async (query, limit) => {
    const key = process.env.BRAVE_API_KEY;
    if (!key) return { results: [], error: 'BRAVE_API_KEY not set' };
    try {
      const r = await fetch('https://api.search.brave.com/res/v1/web/search?q=' + encodeURIComponent(query || '') + '&count=' + limit, { signal: AbortSignal.timeout(12000), headers: { 'X-Subscription-Token': key, 'Accept': 'application/json' } });
      if (!r.ok) return { results: [], error: 'HTTP ' + r.status };
      const d = await r.json();
      const results = (d.web && d.web.results || []).slice(0, limit).map((x) => ({ title: x.title, url: x.url, snippet: x.description }));
      return { results, query };
    } catch (e) { return { results: [], error: String(e.message || e) }; }
  },
  searx: async (query, limit) => {
    const url = process.env.SEARX_URL;
    if (!url) return { results: [], error: 'SEARX_URL not set' };
    try {
      const r = await fetch(url + '/search?q=' + encodeURIComponent(query || '') + '&format=json', { signal: AbortSignal.timeout(12000) });
      if (!r.ok) return { results: [], error: 'HTTP ' + r.status };
      const d = await r.json();
      const results = (d.results || []).slice(0, limit).map((x) => ({ title: x.title, url: x.url, snippet: x.content }));
      return { results, query };
    } catch (e) { return { results: [], error: String(e.message || e) }; }
  },
  startpage: async (query, limit) => {
    try {
      const r = await fetch('https://www.startpage.com/sp/search?query=' + encodeURIComponent(query || ''), { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Mozilla/5.0 (AegisAiHarness/1.0)' } });
      if (!r.ok) return { results: [], error: 'HTTP ' + r.status };
      const html = await r.text();
      const results = [];
      const re = /<a[^>]+class="w-gl__result-title"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<p[^>]+class="w-gl__description"[^>]*>([\s\S]*?)<\/p>/gi;
      let m;
      while ((m = re.exec(html)) && results.length < limit) {
        results.push({ title: strip(m[2]), url: m[1], snippet: strip(m[3]) });
      }
      if (results.length === 0) {
        // fallback generic anchor parse
        const re2 = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]{3,80})<\/a>/gi;
        let m2;
        while ((m2 = re2.exec(html)) && results.length < limit) {
          if (!/startpage\.com/.test(m2[1])) results.push({ title: strip(m2[2]), url: m2[1], snippet: '' });
        }
      }
      return { results, query };
    } catch (e) { return { results: [], error: String(e.message || e) }; }
  },
  firecrawl: async (query, limit) => {
    const key = process.env.FIRECRAWL_API_KEY;
    if (!key) return { results: [], error: 'FIRECRAWL_API_KEY not set' };
    try {
      const r = await fetch('https://api.firecrawl.dev/v1/search', { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, limit }) });
      if (!r.ok) return { results: [], error: 'HTTP ' + r.status };
      const d = await r.json();
      const results = (d.data || d.results || []).slice(0, limit).map((x) => ({ title: x.title || x.metadata && x.metadata.title, url: x.url, snippet: x.description || x.markdown && x.markdown.slice(0, 200) }));
      return { results, query };
    } catch (e) { return { results: [], error: String(e.message || e) }; }
  },
};

function resolveEngine(name) {
  const n = (name || process.env.AEGISAI_SEARCH_ENGINE || 'duckduckgo').toLowerCase();
  return ENGINES[n] ? n : 'duckduckgo';
}

async function search(query, limitOrOpts, engine) {
  let limit = 8;
  let eng = engine;
  if (limitOrOpts && typeof limitOrOpts === 'object') {
    if (typeof limitOrOpts.limit === 'number') limit = limitOrOpts.limit;
    if (limitOrOpts.engine) eng = limitOrOpts.engine;
  } else if (typeof limitOrOpts === 'number') {
    limit = limitOrOpts;
  }
  eng = resolveEngine(eng);
  return ENGINES[eng](query, limit);
}

module.exports = { search, ENGINES, resolveEngine };
