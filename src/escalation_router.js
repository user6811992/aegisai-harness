// src/escalation_router.js
// Cheapest-model router with escalation ladder — clean-room
// aicodeking/PandaOrchestrator idea. Picks a starting model and returns the
// ladder to try on failure. Local, deterministic; no model calls.
const MODELS = [
  { id: 'qwen3:0.6b', tier: 0, cost: 0.02, quality: 0.45 },
  { id: 'llama3.2:3b', tier: 1, cost: 0.05, quality: 0.62 },
  { id: 'qwen3:8b', tier: 2, cost: 0.12, quality: 0.78 },
  { id: 'llama3.1:14b', tier: 3, cost: 0.22, quality: 0.86 },
  { id: 'deepseek-r1:32b', tier: 4, cost: 0.45, quality: 0.94 },
];

function route(task, opts) {
  opts = opts || {};
  const complexity = Math.min(1, Math.max(0, opts.complexity != null ? opts.complexity : estimate(task)));
  const mode = opts.mode || 'max_utility';
  let choice;
  if (mode === 'cheapest_above_threshold') {
    choice = MODELS.find((m) => m.quality >= (opts.threshold || 0.75)) || MODELS[MODELS.length - 1];
  } else if (mode === 'max_quality') choice = MODELS[MODELS.length - 1];
  else {
    const scored = MODELS.map((m) => ({ m, utility: m.quality * (0.5 + complexity) - m.cost }));
    scored.sort((a, b) => b.utility - a.utility);
    choice = scored[0].m;
  }
  const ladder = MODELS.filter((m) => m.tier > choice.tier).sort((a, b) => a.tier - b.tier).map((m) => m.id);
  return { ok: true, task: String(task||'').slice(0, 120), complexity, mode, choice: choice.id, tier: choice.tier, escalationLadder: ladder, traceId: 'route_' + Date.now().toString(36), note: 'router returns a name only; caller must run and verify' };
}

function estimate(text) {
  const t = String(text || '');
  const signals = (t.match(/\b(implement|refactor|debug|design|verify|prove|why|analyze)\b/gi) || []).length;
  const len = Math.min(1, t.length / 2000);
  return Math.min(1, 0.25 + signals * 0.12 + len * 0.4);
}

function tools() {
  return [{ name: 'model_route', description: 'Pick a starting model and escalation ladder for a task.', inputSchema: { type: 'object', properties: { task: { type: 'string' }, mode: { type: 'string' }, complexity: { type: 'number' } }, required: ['task'] } }];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'model_route') return route(args.task, args);
  throw new Error('unknown escalation_router tool: ' + name);
}
module.exports = { MODELS, route, estimate, tools, dispatch };
