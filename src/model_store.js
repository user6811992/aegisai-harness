// src/model_store.js
// Unified model-store bridging beyond Ollama/LM Studio — clean-room idea from
// the model-store survey. One registry of backends with a common contract:
// list, pull (opt-in), remove. Nothing is bundled or downloaded by default.
const BACKENDS = {
  ollama: { cli: 'ollama', listArgs: ['list'], pullArgs: ['pull'], removeArgs: ['rm'] },
  lmstudio: { cli: 'lms', listArgs: ['ls'], pullArgs: ['get'], removeArgs: ['unload'] },
  llamafile: { cli: 'llamafile', note: 'single-file models; no remote store' },
  huggingface: { cli: 'hf', listArgs: ['cache', 'list'], pullArgs: ['download'], note: 'requires huggingface_hub; opt-in' },
  local: { cli: 'fs', listArgs: ['list'] },
};

function resolve(name) {
  const b = BACKENDS[String(name || '').toLowerCase()];
  return b ? { ok: true, name, ...b } : { ok: false, error: 'unknown backend: ' + name };
}
function list() { return Object.entries(BACKENDS).map(([name, b]) => ({ name, ...b })); }
function planPull(backend, model) {
  const b = resolve(backend);
  if (!b.ok) return b;
  if (process.env.AEGISAI_OFFLINE === 'true') return { ok: false, error: 'model pulls disabled in offline mode' };
  return { ok: true, backend, model, command: [b.cli, ...(b.pullArgs || [])], note: 'caller executes; opt-in only' };
}

function tools() {
  return [
    { name: 'model_store_backends', description: 'List unified model-store backends.', inputSchema: { type: 'object' } },
    { name: 'model_store_resolve', description: 'Resolve a model-store backend contract.', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
    { name: 'model_store_pull_plan', description: 'Plan an opt-in model pull.', inputSchema: { type: 'object', properties: { backend: { type: 'string' }, model: { type: 'string' } }, required: ['backend','model'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'model_store_backends') return { ok: true, backends: list() };
  if (name === 'model_store_resolve') return resolve(args.name);
  if (name === 'model_store_pull_plan') return planPull(args.backend, args.model);
  throw new Error('unknown model_store tool: ' + name);
}
module.exports = { BACKENDS, resolve, list, planPull, tools, dispatch };
