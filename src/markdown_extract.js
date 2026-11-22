// src/markdown_extract.js
// Token-efficient Markdown extraction from web pages (browser39 pattern).
function fromHTML(html, url) {
  let s = String(html || '');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<nav[\s\S]*?<\/nav>/gi, '').replace(/<header[\s\S]*?<\/header>/gi, '').replace(/<footer[\s\S]*?<\/footer>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => '\n' + '#'.repeat(Number(n)) + ' ' + strip(t) + '\n');
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => '- ' + strip(t) + '\n');
  s = s.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => strip(t) + ' (' + href + ')');
  s = s.replace(/<(p|div|br|section|article)[^>]*>/gi, '\n').replace(/<\/(p|div|section|article)>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  s = s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).filter((l, i, a) => l !== a[i - 1]).join('\n');
  if (url) s = 'Source: ' + url + '\n\n' + s;
  return s.slice(0, 20000);
}

function strip(t) {
  return String(t || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

async function fromUrl(url) {
  const v = require('./url_validate').validate(url);
  if (!v.ok) return 'error: URL blocked (' + v.reason + ')';
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'AegisAiHarness/1.0' } });
    if (!r.ok) return 'error: HTTP ' + r.status;
    return fromHTML(await r.text(), url);
  } catch (e) { return 'error: ' + String(e.message || e); }
}

module.exports = { fromHTML, fromUrl, strip };
