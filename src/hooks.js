// src/hooks.js
// Hook/transform registry. Hooks are functions called at lifecycle points.
const hooks = { beforeModel: [], afterModel: [], beforeTool: [], afterTool: [] };

function register(event, fn) {
  if (!hooks[event]) hooks[event] = [];
  hooks[event].push(fn);
}

async function run(event, ctx) {
  for (const fn of (hooks[event] || [])) {
    try { await fn(ctx); } catch (e) { /* swallow */ }
  }
}

function list() { return Object.keys(hooks).map((k) => ({ event: k, count: hooks[k].length })); }

module.exports = { register, run, list, hooks };
