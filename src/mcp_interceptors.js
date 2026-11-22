// src/mcp_interceptors.js
// Interceptors at protocol level: pre/post tool-call hooks (SEP-2624).
const interceptors = [];

function register(fn, opts) {
  opts = opts || {};
  const rec = { id: 'int_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), fn, phase: opts.phase || 'pre', priority: opts.priority || 0 };
  interceptors.push(rec);
  interceptors.sort((a, b) => b.priority - a.priority);
  return rec.id;
}
async function runPhase(phase, ctx) {
  const applicable = interceptors.filter((i) => i.phase === phase);
  const results = [];
  for (const i of applicable) {
    try { const r = await i.fn(ctx); results.push({ id: i.id, result: r }); if (r && r.block) { results.push({ blocked: true, by: i.id }); return { blocked: true, by: i.id, results }; } }
    catch (e) { results.push({ id: i.id, error: String(e.message || e) }); }
  }
  return { blocked: false, results };
}

module.exports = { register, runPhase, interceptors };
