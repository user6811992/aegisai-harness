// src/agents_as_tools.js
// Agents-as-tools: register named agents in the tool registry.
const agents = new Map();

function register(name, opts) {
  agents.set(name, Object.assign({ name, model: opts && opts.model, systemPrompt: opts && opts.systemPrompt || 'You are ' + name }, opts || {}));
  return { name, registered: true };
}
function asTools() {
  return [...agents.values()].map((a) => ({
    type: 'function',
    function: {
      name: 'agent_' + a.name.replace(/\W+/g, '_'),
      description: 'Delegate a task to the ' + a.name + ' agent',
      parameters: { type: 'object', properties: { task: { type: 'string' } }, required: ['task'] },
    },
  }));
}
function list() { return [...agents.values()].map((a) => a.name); }

module.exports = { register, asTools, list };
