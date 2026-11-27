// src/decompiler_bridge.js
// Kuna agent-first decompiler — clean-room morluto/kuna (11⭐, Rust) idea.
// A contract for an agent-guided decompilation loop: hypotheses are scored by
// evidence and re-run. No decompiler binary bundled.
function hypothesis(desc, evidence, opts) {
  opts = opts || {};
  const score = (evidence || []).length / Math.max(1, (opts.expected || 3));
  return { ok: true, description: desc, evidence: evidence || [], confidence: +Math.min(1, score).toFixed(2), status: score >= 1 ? 'accepted' : 'needs-evidence' };
}
function loop(hypotheses) {
  const ranked = (hypotheses || []).slice().sort((a, b) => b.confidence - a.confidence);
  return { ok: true, ranked, best: ranked[0] || null, note: 'agent re-runs the decompiler for low-confidence hypotheses' };
}
function tools() {
  return [
    { name: 'decompile_hypothesis', description: 'Score a decompilation hypothesis by supporting evidence.', inputSchema: { type: 'object', properties: { description: { type: 'string' }, evidence: { type: 'array' } }, required: ['description'] } },
    { name: 'decompile_loop', description: 'Rank decompilation hypotheses.', inputSchema: { type: 'object', properties: { hypotheses: { type: 'array' } }, required: ['hypotheses'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'decompile_hypothesis') return hypothesis(args.description, args.evidence, args);
  if (name === 'decompile_loop') return loop(args.hypotheses);
  throw new Error('unknown decompiler_bridge tool: ' + name);
}
module.exports = { hypothesis, loop, tools, dispatch };
