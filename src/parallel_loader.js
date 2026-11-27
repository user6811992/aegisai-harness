// src/parallel_loader.js
// Parallel GPU weight loading — clean-room sergey-automation/parallel-gpu-weight-loading
// idea. Plan shard placement across devices with a simple greedy fit; the
// actual tensor copy is performed by the caller's backend. No GPU required.
function plan(shards, devices, opts) {
  opts = opts || {};
  const caps = (devices || []).map((d) => ({ id: d.id || d, free: d.freeBytes || d.free || 0 }));
  const assignments = [];
  for (const s of shards || []) {
    const target = caps.slice().sort((a, b) => b.free - a.free)[0];
    if (!target || target.free < (s.bytes || 0)) return { ok: false, error: 'insufficient VRAM to place shard ' + (s.id || ''), shard: s.id };
    target.free -= s.bytes || 0;
    assignments.push({ shard: s.id, device: target.id, bytes: s.bytes || 0 });
  }
  return { ok: true, assignments, workers: (opts.workers || caps.length || 1), strategy: 'greedy-largest-first', note: 'caller performs the parallel copy' };
}
function tools() {
  return [{ name: 'parallel_load_plan', description: 'Plan parallel GPU weight-shard placement.', inputSchema: { type: 'object', properties: { shards: { type: 'array' }, devices: { type: 'array' } }, required: ['shards','devices'] } }];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'parallel_load_plan') return plan(args.shards, args.devices, args);
  throw new Error('unknown parallel_loader tool: ' + name);
}
module.exports = { plan, tools, dispatch };
