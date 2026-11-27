// src/moe_engine.js
// MoE engine for weak hardware — clean-room ambassadorOfCplusPlus/memex-engine-public
// idea. Plan expert offload for CPU/low-VRAM devices. Universal: no hardware
// assumptions beyond the VRAM/CPU figures the caller supplies.
function plan(opts) {
  opts = opts || {};
  const vram = Number(opts.vramGB || 4);
  const experts = Number(opts.experts || 8);
  const active = Math.min(experts, Number(opts.activeExperts || 2));
  const offload = Math.max(0, experts - Math.floor(vram / 1.5));
  return {
    ok: true, vramGB: vram, experts, activeExperts: active,
    offloadToCpu: offload, strategy: offload ? 'cpu-expert-offload' : 'gpu-resident',
    flags: offload ? ['--n-cpu-moe', '-rtr'] : [],
    note: 'adapter contract only; requires an installed MoE-capable runtime',
  };
}
function tools() {
  return [{ name: 'moe_plan', description: 'Plan MoE expert offload for a VRAM budget.', inputSchema: { type: 'object', properties: { vramGB: { type: 'number' }, experts: { type: 'number' } } } }];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'moe_plan') return plan(args);
  throw new Error('unknown moe_engine tool: ' + name);
}
module.exports = { plan, tools, dispatch };
