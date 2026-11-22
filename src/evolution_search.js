// src/evolution_search.js
// Automated prompt/tool/harness evolution via search over candidate configs (polyharness).

function candidates(base, knobs) {
  const out = [Object.assign({}, base)];
  for (const [key, values] of Object.entries(knobs || {})) {
    for (const v of values) out.push(Object.assign({}, base, { [key]: v }));
  }
  return out;
}
function search(scoreFn, cands, opts) {
  opts = opts || {};
  const results = [];
  for (const c of cands || []) {
    let score = 0;
    try { score = scoreFn(c); } catch (e) { score = 0; }
    results.push({ config: c, score });
  }
  results.sort((a, b) => b.score - a.score);
  return { evaluated: results.length, best: results[0] || null, ranked: results.slice(0, opts.top || 10) };
}

module.exports = { candidates, search };
