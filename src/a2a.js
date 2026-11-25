// src/a2a.js
// A2A (Agent-to-Agent) adapter: agent card + task dispatch.
const { runAgent } = require('./agent/run');

const tasks = new Map();

function agentCard() {
  return {
    name: 'aegisai-harness',
    description: 'Local-only AI agent harness',
    version: require('./version').VERSION,
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: true },
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    skills: [{ id: 'chat', name: 'General agent task', description: 'Run a prompt through the harness' }],
  };
}

async function sendTask(task) {
  const id = task.id || ('a2a_' + Date.now());
  tasks.set(id, { id, status: 'working', created: new Date().toISOString() });
  try {
    const text = (task.message && task.message.parts || []).map((p) => p.text || '').join('\n') || task.prompt || '';
    const r = await runAgent({ model: task.model || process.env.AEGISAI_MODEL || 'llama3.2:3b', messages: [{ role: 'user', content: text }], projectRoot: task.cwd || process.cwd(), autoApprove: true, onEvent: () => {} });
    const final = (r.final && r.final.final) || '';
    const rec = { id, status: 'completed', result: { parts: [{ kind: 'text', text: final }] }, toolLog: r.toolLog || [], completed: new Date().toISOString() };
    tasks.set(id, rec);
    return rec;
  } catch (e) {
    const rec = { id, status: 'failed', error: String(e.message || e) };
    tasks.set(id, rec);
    return rec;
  }
}
function getTask(id) { return tasks.get(id) || null; }

module.exports = { agentCard, sendTask, getTask };
