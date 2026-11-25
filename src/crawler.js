// src/crawler.js
// Endpoint crawler (katana-style, bounded): follows links and extracts URLs/paths
// from HTML and JavaScript. Same-origin by default; no auth bypass, no fuzzing.
const MAX_PAGES_DEFAULT = 30;

function extractLinks(html, baseUrl) {
  const out = new Set();
  const push = (raw) => {
    if (!raw) return;
    let u;
    try { u = new URL(raw, baseUrl); } catch (e) { return; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
    out.add(u.origin + u.pathname + (u.search || ''));
  };
  const hrefRe = /(?:href|src|action)\s*=\s*["']([^"'#]+)["']/gi;
  let m;
  while ((m = hrefRe.exec(html)) !== null) push(m[1]);
  // Absolute URLs anywhere in the document (catches JS fetch/axios targets).
  const urlRe = /https?:\/\/[^\s"'`<>()\\]+/g;
  while ((m = urlRe.exec(html)) !== null) push(m[0]);
  // Relative API paths in JS strings.
  const apiRe = /["'`](\/[A-Za-z0-9_\-./]{2,120})["'`]/g;
  while ((m = apiRe.exec(html)) !== null) push(m[1]);
  return Array.from(out);
}

function sameOrigin(u, base) {
  try { return new URL(u).origin === new URL(base).origin; } catch (e) { return false; }
}

async function crawl(startUrl, opts) {
  opts = opts || {};
  const maxPages = opts.maxPages || MAX_PAGES_DEFAULT;
  const sameSiteOnly = opts.sameOrigin !== false;
  const seen = new Set();
  const queue = [startUrl];
  const pages = [];
  const endpoints = new Set();
  while (queue.length && pages.length < maxPages) {
    const url = queue.shift();
    if (!url || seen.has(url)) continue;
    if (sameSiteOnly && !sameOrigin(url, startUrl)) continue;
    seen.add(url);
    let res;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(opts.timeoutMs || 10000), redirect: 'follow', headers: { 'User-Agent': 'aegisai-crawler' } });
    } catch (e) {
      pages.push({ url, error: String((e && e.message) || e) });
      continue;
    }
    const type = res.headers.get('content-type') || '';
    let body = '';
    try { body = await res.text(); } catch (e) { body = ''; }
    const found = /text\/html|javascript|application\/json/i.test(type) ? extractLinks(body, url) : [];
    for (const f of found) {
      if (sameSiteOnly && !sameOrigin(f, startUrl)) continue;
      if (new URL(f).pathname !== new URL(url).pathname) endpoints.add(f);
      if (!seen.has(f) && queue.length + pages.length < maxPages * 3) queue.push(f);
    }
    pages.push({ url, status: res.status, contentType: type, bytes: body.length, links: found.length });
  }
  return {
    startUrl,
    pages,
    endpoints: Array.from(endpoints).sort(),
    summary: { pages: pages.length, endpoints: endpoints.size, errors: pages.filter((p) => p.error).length },
  };
}

module.exports = { crawl, extractLinks, sameOrigin };
