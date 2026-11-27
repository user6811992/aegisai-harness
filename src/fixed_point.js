// src/fixed_point.js
// Recursive Self-Improving Loopers — fixed-point detection (eelbaz research).
// Stop an improvement loop when output stops changing meaningfully.
function hash(value) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 12);
}
function step(history, output, opts) {
  opts = opts || {};
  const h = hash(output);
  const list = (history || []).concat([h]);
  const last = list[list.length - 1], prev = list[list.length - 2];
  // The current output always counts as one run; a repeat extends it.
  const stableRuns = prev === last ? (opts.stableRuns || 1) + 1 : 1;
  return { ok: true, history: list, hash: h, stableRuns, converged: stableRuns >= (opts.required || 2), note: 'converged loops should stop to avoid token waste' };
}
function tools() {
  return [{ name: 'fixed_point_step', description: 'Track an iterative improvement loop for convergence.', inputSchema: { type: 'object', properties: { history: { type: 'array' }, output: {} }, required: ['output'] } }];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'fixed_point_step') return step(args.history, args.output, args);
  throw new Error('unknown fixed_point tool: ' + name);
}
module.exports = { hash, step, tools, dispatch };
