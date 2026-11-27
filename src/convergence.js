// src/convergence.js
// Banach-style fixed-point convergence detection for iterative improvement.
// Inspired by eelbaz/Recursive-Self-Improving-Loopers (self-verified iteration,
// alignment via fixed-point stability). Pure-JS policy layer, no ML.
function distance(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b);
  const ka = a && typeof a === 'object' ? Object.keys(a).sort() : [];
  const kb = b && typeof b === 'object' ? Object.keys(b).sort() : [];
  const keys = Array.from(new Set(ka.concat(kb)));
  let sum = 0;
  for (const k of keys) {
    const va = a && a[k];
    const vb = b && b[k];
    if (typeof va === 'number' && typeof vb === 'number') sum += Math.abs(va - vb);
    else if (JSON.stringify(va) !== JSON.stringify(vb)) sum += 1;
  }
  return sum;
}

function check(states, opts) {
  opts = opts || {};
  const tolerance = opts.tolerance != null ? opts.tolerance : 0.01;
  const maxIterations = opts.maxIterations || 12;
  const list = states || [];
  if (list.length < 2) return { converged: false, reason: 'need at least two states', iterations: list.length };
  const deltas = [];
  for (let i = 1; i < list.length; i += 1) deltas.push(distance(list[i - 1], list[i]));
  const last = deltas[deltas.length - 1];
  const stable = deltas.slice(-3).every((d) => d <= tolerance);
  return {
    converged: stable,
    reason: stable ? 'fixed point reached (|x_n - x_{n-1}| <= tolerance)' : 'not yet stable',
    iterations: list.length,
    lastDelta: last,
    deltas,
    maxIterations,
    exhausted: list.length >= maxIterations && !stable,
  };
}

// Drive an arbitrary iterate function until convergence or max iterations.
function iterate(initial, step, opts) {
  opts = opts || {};
  const max = opts.maxIterations || 12;
  const tolerance = opts.tolerance != null ? opts.tolerance : 0.01;
  const states = [initial];
  let current = initial;
  for (let i = 0; i < max; i += 1) {
    const next = step(current, i);
    states.push(next);
    if (check(states, { tolerance, maxIterations: max }).converged) break;
    current = next;
  }
  return { states, result: check(states, { tolerance, maxIterations: max }) };
}

module.exports = { distance, check, iterate };
