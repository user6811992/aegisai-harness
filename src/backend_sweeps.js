// src/backend_sweeps.js
// Time-boxed backend parameter sweeps — clean-room VykosX/Llama-Optimizer idea.
// Scores candidate configurations by measured metrics; results feed
// metrics_store and the performance dashboard. No external deps.
const { record } = require('./metrics_store');

function score(result, weights) {
  weights = weights || { speed: 0.5, quality: 0.3, cost: 0.2 };
  return +(
    (result.tokensPerSec || 0) / 100 * weights.speed +
    (result.quality || 0) * weights.quality +
    (1 - Math.min(1, (result.cost || 0))) * weights.cost
  ).toFixed(3);
}

function sweep(candidates, opts) {
  opts = opts || {};
  const budgetMs = opts.budgetMs || 30000;
  const started = Date.now();
  const results = [];
  for (const c of candidates || []) {
    if (Date.now() - started > budgetMs) { results.push({ config: c, skipped: true, reason: 'time budget exceeded' }); continue; }
    // In a full integration this would launch the backend and measure; here we
    // accept externally supplied measurements so the harness stays universal.
    const m = c.measured || {};
    results.push({ config: c.config || c, tokensPerSec: m.tokensPerSec || 0, quality: m.quality || 0, cost: m.cost || 0, score: score(m, opts.weights) });
  }
  results.sort((a, b) => (b.score || 0) - (a.score || 0));
  if (opts.persist !== false) {
    try { record('backend_sweep', { results: results.slice(0, 10), budgetMs }); } catch (e) {}
  }
  return { ok: true, count: results.length, best: results[0] || null, results, elapsedMs: Date.now() - started };
}

function tools() {
  return [{ name: 'backend_sweep', description: 'Score candidate backend configs by measured speed/quality/cost.', inputSchema: { type: 'object', properties: { candidates: { type: 'array' }, budgetMs: { type: 'number' } }, required: ['candidates'] } }];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'backend_sweep') return sweep(args.candidates, args);
  throw new Error('unknown backend_sweeps tool: ' + name);
}
module.exports = { score, sweep, tools, dispatch };
