// src/handoff.js
// Multi-agent handoff: transfer a conversation (with context) to another agent.
// Distinct from agents-as-tools: the receiving agent continues the thread rather
// than returning a single tool result.
const { runAgent } = require('./agent/run');

const registry = new Map(); // name -> { name, model, systemPrompt, tools, reason }

function register(def) {
  const name = String((def && def.name) || '').trim();
  if (!name) throw Object.assign(new Error('agent name required'), { status: 400 });
  const entry = {
    name,
    model: def.model || process.env.AEGISAI_MODEL || 'llama3.2:3b',
    systemPrompt: def.systemPrompt || '',
    allowedTools: def.allowedTools || null,
    description: def.description || '',
  };
  registry.set(name, entry);
  return entry;
}

function list() { return Array.from(registry.values()); }
function get(name) { return registry.get(name) || null; }
function clear() { registry.clear(); }

/**
 * Hand off `history` to agent `to`. Returns the agent's reply plus the new history
 * so the caller can keep threading.
 */
async function handoff(to, history, opts) {
  opts = opts || {};
  const target = registry.get(to);
  if (!target) throw Object.assign(new Error('unknown handoff target: ' + to), { status: 404 });
  const messages = [];
  if (target.systemPrompt) messages.push({ role: 'system', content: target.systemPrompt });
  for (const m of history || []) messages.push({ role: m.role, content: m.content });
  if (opts.note) messages.push({ role: 'user', content: opts.note });
  const result = await runAgent({
    model: target.model,
    messages,
    projectRoot: opts.projectRoot || process.cwd(),
    onEvent: opts.onEvent || (() => {}),
    autoApprove: Boolean(opts.autoApprove),
    allowedTools: target.allowedTools || undefined,
  });
  const reply = (result.final && result.final.final) || '';
  return {
    from: opts.from || 'current',
    to,
    reply,
    history: messages.concat([{ role: 'assistant', content: reply }]),
    toolLog: result.toolLog || [],
  };
}

module.exports = { register, list, get, clear, handoff };
