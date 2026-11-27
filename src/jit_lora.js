// src/jit_lora.js
// JIT LoRA — clean-room eelbaz/jit-lora idea. Continuous in-conversation
// learning with a >=33% guard: only accept an adapter update when measured
// quality improves by at least the threshold. Research-grade contract.
function propose(before, after, opts) {
  opts = opts || {};
  const threshold = opts.threshold || 0.33;
  const gain = (after - before) / Math.max(1, Math.abs(before));
  const accepted = gain >= threshold;
  return { ok: true, before, after, gain: +gain.toFixed(3), threshold, accepted, note: 'rejected updates are discarded, never applied' };
}
function apply(state, proposal) {
  if (!proposal || !proposal.accepted) return { ok: false, error: 'update rejected by guard' };
  return { ok: true, adapterVersion: (state && state.adapterVersion || 0) + 1, applied: true };
}
function tools() {
  return [{ name: 'jit_lora_propose', description: 'Gate a JIT LoRA update behind a quality improvement threshold.', inputSchema: { type: 'object', properties: { before: { type: 'number' }, after: { type: 'number' } }, required: ['before','after'] } }];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'jit_lora_propose') return propose(args.before, args.after, args);
  if (name === 'jit_lora_apply') return apply(args.state, args.proposal);
  throw new Error('unknown jit_lora tool: ' + name);
}
module.exports = { propose, apply, tools, dispatch };
