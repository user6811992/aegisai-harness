// src/cost_routing.js
// Cost-aware routing + convergence loops (aieos pattern).
function route(models, opts) {
  opts = opts || {};
  const budget = opts.budget || 1;
  const ranked = (models || []).map((m) => Object.assign({}, m, { score: (m.quality || 0.5) / Math.max(0.0001, m.cost || 0.001) })).sort((a, b) => b.score - a.score);
  const chosen = ranked.filter((m) => (m.cost || 0) <= budget)[0] || ranked[0] || null;
  return { chosen, ranked, budget };
}
function converged(outputs, threshold) {
  threshold = threshold || 0.9;
  if (!outputs || outputs.length < 2) return { converged: false };
  const a = String(outputs[outputs.length - 1] || '');
  const b = String(outputs[outputs.length - 2] || '');
  const wordsA = new Set(a.toLowerCase().split(/\W+/));
  const wordsB = new Set(b.toLowerCase().split(/\W+/));
  let inter = 0;
  for (const w of wordsA) if (wordsB.has(w)) inter += 1;
  const union = wordsA.size + wordsB.size - inter;
  const sim = union ? inter / union : 0;
  return { converged: sim >= threshold, similarity: +sim.toFixed(2) };
}

module.exports = { route, converged };
