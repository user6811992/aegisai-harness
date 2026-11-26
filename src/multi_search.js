// src/multi_search.js
// Multi-engine web search + evidence synthesis.
const ws = require('./web_search');
const { craap } = require('./deep_research');

const ENGINES = [{ name: 'duckduckgo', fn: (q) => ws.search(q, 8, 'duckduckgo') }];
if (process.env.BRAVE_API_KEY) ENGINES.push({ name: 'brave', fn: (q) => ws.search(q, 8, 'brave') });
if (process.env.SEARX_URL) ENGINES.push({ name: 'searx', fn: async (q) => {
  try {
    const r = await fetch(process.env.SEARX_URL + '/search?q=' + encodeURIComponent(q) + '&format=json', { signal: AbortSignal.timeout(12000) });
    const d = await r.json();
    return { results: (d.results || []).map((x) => ({ title: x.title, url: x.url, snippet: x.content })) };
  } catch (e) { return { results: [], error: String(e.message || e) }; }
} });

async function search(query) {
  const all = [];
  const errors = [];
  for (const e of ENGINES) {
    const r = await e.fn(query);
    if (r.error) errors.push(e.name + ': ' + r.error);
    for (const x of r.results || []) all.push(Object.assign({}, x, { engine: e.name, assessment: craap(x) }));
  }
  const seen = new Set();
  const deduped = all.filter((x) => { if (seen.has(x.url)) return false; seen.add(x.url); return true; });
  const evidence = deduped.filter((x) => x.assessment.total >= 6).slice(0, 8);
  return { query, engines: ENGINES.map((e) => e.name), results: deduped, evidence, errors };
}

module.exports = { ENGINES, search };
