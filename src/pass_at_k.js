// src/pass_at_k.js
// pass@k metrics + multi-run comparison.
function comb(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

function passAtK(runs, k) {
  // runs: array of arrays of booleans (one array per task, each attempt pass/fail)
  k = k || 1;
  const out = [];
  for (const attempts of runs || []) {
    const successes = attempts.filter(Boolean).length;
    const n = attempts.length;
    if (n === 0) { out.push(0); continue; }
    const p = 1 - (comb(n - successes, k) / comb(n, k));
    out.push(Number.isFinite(p) ? +p.toFixed(3) : successes > 0 ? 1 : 0);
  }
  return out;
}
function mean(values) { return values.length ? +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(3) : 0; }

function compare(runsByConfig) {
  const out = {};
  for (const [name, runs] of Object.entries(runsByConfig || {})) {
    out[name] = { pass1: mean(passAtK(runs, 1)), pass3: mean(passAtK(runs, 3)), tasks: runs.length };
  }
  return out;
}

module.exports = { passAtK, mean, compare };
