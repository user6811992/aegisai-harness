// src/rl_harness.js
// Reinforcement learning env/eval harness — clean-room morluto/reef +
// morluto/verifiers idea. Tabletop RL loop over tasks: observe, act, reward,
// reset. Local-only; no external trainer bundled.
function env(name, opts) {
  opts = opts || {};
  return { ok: true, name: String(name || 'task-env'), maxSteps: opts.maxSteps || 20, state: {}, step: 0, done: false };
}
function step(e, action, reward) {
  if (!e || e.done) return { ok: false, error: 'environment finished' };
  e.step += 1;
  e.state = { lastAction: action || null, reward: reward || 0 };
  e.done = e.step >= e.maxSteps;
  return { ok: true, step: e.step, reward: reward || 0, done: e.done, state: e.state };
}
function evaluate(name, episodes, opts) {
  const rewards = episodes || [];
  const total = rewards.reduce((a, b) => a + b, 0);
  return { ok: true, name, episodes: rewards.length, total, mean: rewards.length ? +(total / rewards.length).toFixed(3) : 0, note: 'continual eval: compare mean across runs' };
}
function tools() {
  return [
    { name: 'rl_env', description: 'Create a tabletop RL environment.', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
    { name: 'rl_evaluate', description: 'Summarize RL episode rewards.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, episodes: { type: 'array' } }, required: ['name','episodes'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'rl_env') return env(args.name, args);
  if (name === 'rl_step') return step(args.env, args.action, args.reward);
  if (name === 'rl_evaluate') return evaluate(args.name, args.episodes, args);
  throw new Error('unknown rl_harness tool: ' + name);
}
module.exports = { env, step, evaluate, tools, dispatch };
