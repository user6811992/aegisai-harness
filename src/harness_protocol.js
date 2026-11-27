// src/harness_protocol.js
// Unified Harness Protocol adapter — clean-room HarnessRouter (Apache-2.0) idea.
// Normalize different agent harnesses behind one interface; expose OpenAI
// Responses-compatible task/result envelope. Local adapter registry only.
const ADAPTERS = {
  opencode: { cli: 'opencode', args: ['--json'] },
  claude: { cli: 'claude', args: ['-p'] },
  codex: { cli: 'codex', args: ['exec'] },
  gemini: { cli: 'gemini', args: [] },
  aegisai: { cli: 'aegisai', args: ['--json'] },
};

function resolve(name) {
  const key = String(name||'').toLowerCase();
  const a = ADAPTERS[key];
  if (!a) return { ok: false, error: 'unknown harness: ' + name };
  return { ok: true, harness: key, ...a };
}
function envelope(task, opts) {
  opts = opts || {};
  return {
    id: 'task_' + Date.now().toString(36),
    object: 'harness.task',
    created: Math.floor(Date.now()/1000),
    model: opts.model || 'default',
    harness: opts.harness || 'aegisai',
    task,
    status: 'queued',
  };
}
function result(taskId, output, opts) {
  return { id: 'res_' + Date.now().toString(36), object: 'harness.result', task: taskId, output: String(output||''), status: (opts&&opts.error)?'failed':'completed', usage: (opts&&opts.usage)||{} };
}
function tools() {
  return [
    { name: 'harness_resolve', description: 'Resolve a harness name to its CLI adapter.', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
    { name: 'harness_envelope', description: 'Build a unified task envelope.', inputSchema: { type: 'object', properties: { task: { type: 'string' }, harness: { type: 'string' } }, required: ['task'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'harness_resolve') return resolve(args.name);
  if (name === 'harness_envelope') return envelope(args.task, args);
  if (name === 'harness_result') return result(args.task, args.output, args);
  throw new Error('unknown harness_protocol tool: ' + name);
}
module.exports = { ADAPTERS, resolve, envelope, result, tools, dispatch };
