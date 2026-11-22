// src/keyless_search.js
// Keyless search engines (no API keys): DuckDuckGo HTML, Bing, Google, Brave, Mojeek, Startpage, SearX, Yahoo, Yandex.
const { strip } = require('./markdown_extract');
const { validate } = require('./url_validate');

const ENGINES = [
  { name: 'duckduckgo', url: (q) => 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), re: /class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi },
  { name: 'bing', url: (q) => 'https://www.bing.com/search?q=' + encodeURIComponent(q), re: /<h2><a href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi },
  { name: 'google', url: (q) => 'https://www.google.com/search?q=' + encodeURIComponent(q) + '&num=10', re: /<a href="\/url\?q=(https?:\/\/[^&"]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi },
  { name: 'brave', url: (q) => 'https://search.brave.com/search?q=' + encodeURIComponent(q), re: /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*class="[^"]*result-header[^"]*"[^>]*>([\s\S]*?)<\/a>/gi },
  { name: 'mojeek', url: (q) => 'https://www.mojeek.com/search?q=' + encodeURIComponent(q), re: /<a class="ob" href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi },
  { name: 'yahoo', url: (q) => 'https://search.yahoo.com/search?p=' + encodeURIComponent(q), re: /<h3[^>]*><a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a><\/h3>/gi },
  { name: 'yandex', url: (q) => 'https://yandex.com/search/?text=' + encodeURIComponent(q), re: /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*class="[^"]*OrganicTitle-Link[^"]*"[^>]*>([\s\S]*?)<\/a>/gi },
];

async function search(query, engines, limit) {
  limit = limit || 8;
  const out = [];
  const errors = [];
  for (const name of engines || ENGINES.map((e) => e.name)) {
    const e = ENGINES.find((x) => x.name === name);
    if (!e) { errors.push(name + ': unknown engine'); continue; }
    const u = validate(e.url(query));
    if (!u.ok) { errors.push(name + ': blocked URL'); continue; }
    try {
      const r = await fetch(u.url, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Mozilla/5.0 (AegisAiHarness/1.0)' } });
      if (!r.ok) { errors.push(name + ': HTTP ' + r.status); continue; }
      const html = await r.text();
      const re = new RegExp(e.re.source, e.re.flags);
      let m;
      while ((m = re.exec(html)) && out.length < limit) {
        let link = m[1];
        try { const parsed = new URL(link, u.url); link = parsed.searchParams.get('uddg') || parsed.href; } catch (err) {}
        if (!out.some((x) => x.url === link)) out.push({ engine: name, title: strip(m[2]), url: link, snippet: strip(m[3] || '') });
      }
    } catch (err) { errors.push(name + ': ' + err.message); }
  }
  return { query, results: out, errors };
}

module.exports = { ENGINES, search };
