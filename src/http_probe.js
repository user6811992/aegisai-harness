// src/http_probe.js
// httpx-style HTTP probing: status, title, server, tech fingerprint, redirect chain.
const TECH_SIGNATURES = [
  { name: 'nginx', re: /nginx/i, where: 'server' },
  { name: 'apache', re: /apache/i, where: 'server' },
  { name: 'iis', re: /microsoft-iis/i, where: 'server' },
  { name: 'cloudflare', re: /cloudflare/i, where: 'any' },
  { name: 'vercel', re: /vercel/i, where: 'any' },
  { name: 'netlify', re: /netlify/i, where: 'any' },
  { name: 'express', re: /^express$/i, where: 'x-powered-by' },
  { name: 'next.js', re: /next\.js/i, where: 'any' },
  { name: 'react', re: /react/i, where: 'body' },
  { name: 'vue', re: /vue\.js|__vue__/i, where: 'body' },
  { name: 'preact', re: /preact/i, where: 'body' },
  { name: 'wordpress', re: /wp-content|wordpress/i, where: 'body' },
  { name: 'drupal', re: /drupal/i, where: 'body' },
  { name: 'joomla', re: /joomla/i, where: 'body' },
  { name: 'shopify', re: /shopify/i, where: 'any' },
  { name: 'php', re: /php/i, where: 'x-powered-by' },
  { name: 'asp.net', re: /asp\.net/i, where: 'any' },
  { name: 'django', re: /csrftoken|django/i, where: 'body' },
  { name: 'rails', re: /rails|_session_id/i, where: 'any' },
  { name: 'flask', re: /werkzeug/i, where: 'server' },
  { name: 'grafana', re: /grafana/i, where: 'any' },
  { name: 'jenkins', re: /jenkins/i, where: 'any' },
  { name: 'gitlab', re: /gitlab/i, where: 'any' },
  { name: 'github-pages', re: /github\.com|x-github/i, where: 'any' },
  { name: 'tomcat', re: /tomcat|coyote/i, where: 'any' },
  { name: 'jetty', re: /jetty/i, where: 'server' },
];

function fingerprint(headers, body, setCookie) {
  const found = new Set();
  const lower = String(body || '').slice(0, 20000);
  for (const sig of TECH_SIGNATURES) {
    let hay = '';
    if (sig.where === 'server') hay = headers['server'] || '';
    else if (sig.where === 'x-powered-by') hay = headers['x-powered-by'] || '';
    else if (sig.where === 'body') hay = lower;
    else hay = [headers['server'], headers['x-powered-by'], headers['via'], setCookie, lower].filter(Boolean).join(' ');
    if (sig.re.test(hay)) found.add(sig.name);
  }
  return Array.from(found).sort();
}

function extractTitle(body) {
  const m = String(body || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 120) : '';
}

async function probeOne(target, opts) {
  opts = opts || {};
  const started = Date.now();
  const chain = [];
  let res;
  let body = '';
  try {
    res = await fetch(target, {
      method: opts.method || 'GET',
      redirect: 'manual',
      headers: Object.assign({ 'User-Agent': 'aegisai-httpx' }, opts.headers || {}),
      signal: AbortSignal.timeout(opts.timeoutMs || 8000),
    });
  } catch (e) {
    return { url: target, ok: false, error: String((e && e.message) || e), duration: Date.now() - started };
  }
  let current = res;
  let hops = 0;
  while (current && current.status >= 300 && current.status < 400 && hops < 5) {
    const loc = current.headers.get('location');
    chain.push({ status: current.status, location: loc || '' });
    if (!loc) break;
    let next;
    try { next = new URL(loc, target).toString(); } catch (e) { break; }
    try {
      current = await fetch(next, { redirect: 'manual', headers: { 'User-Agent': 'aegisai-httpx' }, signal: AbortSignal.timeout(opts.timeoutMs || 8000) });
    } catch (e) { break; }
    hops += 1;
  }
  try { body = await current.text(); } catch (e) { body = ''; }
  const headers = {};
  current.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  const setCookie = current.headers.get('set-cookie') || '';
  return {
    url: target,
    finalUrl: current.url || target,
    ok: current.ok,
    status: current.status,
    duration: Date.now() - started,
    title: extractTitle(body),
    server: headers['server'] || '',
    contentType: headers['content-type'] || '',
    bytes: body.length,
    redirects: chain,
    tech: fingerprint(headers, body, setCookie),
    headers: opts.includeHeaders ? headers : undefined,
  };
}

async function probe(targets, opts) {
  const list = Array.isArray(targets) ? targets : [targets];
  const concurrency = Math.max(1, Math.min(8, (opts && opts.concurrency) || 4));
  const results = [];
  let i = 0;
  async function worker() {
    while (i < list.length) {
      const idx = i++;
      results[idx] = await probeOne(list[idx], opts);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
  return {
    results,
    summary: {
      total: results.length,
      alive: results.filter((r) => r.ok).length,
      errored: results.filter((r) => r.error).length,
      tech: Array.from(new Set(results.flatMap((r) => r.tech || []))).sort(),
    },
  };
}

const advanced = require('./http_advanced');
module.exports = {
  probe, probeOne, fingerprint, extractTitle, TECH_SIGNATURES,
  // Advanced capabilities (phased timings, CDN detection, load simulation)
  timedGet: advanced.timedGet,
  detectCdn: advanced.detectCdn,
  loadTest: advanced.loadTest,
  advancedTools: advanced.tools,
};
