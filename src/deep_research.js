// src/deep_research.js
// Deep research: source credibility (CRAAP) scoring + cross-verification.
const webSearch = require('./web_search');
const { fromUrl } = require('./markdown_extract');

function craap(source) {
  const s = source || {};
  const text = ((s.title || '') + ' ' + (s.snippet || '') + ' ' + (s.url || '')).toLowerCase();
  let currency = 5, relevance = 5, authority = 3, accuracy = 3, purpose = 5;
  if (/20\d\d/.test(text)) currency = 8;
  if (/\b(edu|gov|org)\b/.test(s.url || '')) authority = 8;
  if (/\b(study|research|paper|evidence|data)\b/.test(text)) accuracy = 8;
  if (/\b(opinion|blog|sponsored|ad)\b/.test(text)) purpose = 3;
  const words = (s.snippet || '').length;
  if (words > 80) relevance = 8;
  const total = +((currency + relevance + authority + accuracy + purpose) / 5).toFixed(1);
  return { currency, relevance, authority, accuracy, purpose, total };
}

async function research(query, limit) {
  const search = await webSearch.search(query, limit || 6);
  const sources = [];
  for (const r of search.results || []) {
    const content = await fromUrl(r.url);
    sources.push(Object.assign({}, r, { assessment: craap(r), content: String(content).slice(0, 2000) }));
  }
  // cross-verification: terms appearing in >=2 sources
  const terms = {};
  for (const s of sources) {
    for (const w of (s.content.toLowerCase().match(/[a-z]{4,}/g) || [])) terms[w] = (terms[w] || 0) + 1;
  }
  const verified = Object.entries(terms).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([t]) => t);
  const credible = sources.filter((s) => s.assessment.total >= 6);
  return { query, sources: sources.map((s) => ({ title: s.title, url: s.url, assessment: s.assessment })), credibleCount: credible.length, crossVerifiedTerms: verified };
}

module.exports = { craap, research };
