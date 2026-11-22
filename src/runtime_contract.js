// src/runtime_contract.js
// Pluggable runtime contract for brain wrappers (oc-runtimes pattern).
const CONTRACT = {
  methods: ['run', 'abort', 'health'],
  events: ['start', 'message', 'tool_use', 'tool_result', 'error', 'done'],
  version: '1.0',
};

function conform(obj) {
  const missing = CONTRACT.methods.filter((m) => typeof obj[m] !== 'function');
  return { ok: missing.length === 0, missing, version: CONTRACT.version };
}
function wrap(name, opts) {
  opts = opts || {};
  return {
    name,
    async run(prompt) { return { agent: name, prompt, handledBy: opts.handler || 'default' }; },
    abort() { return { aborted: true }; },
    async health() { return { ok: true, name }; },
  };
}

module.exports = { CONTRACT, conform, wrap };
