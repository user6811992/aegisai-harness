// src/mcp_tasks.js
// MCP Tasks extension: long-running operations via MCP with status polling (modelcontextprotocol/ext-tasks).
const tasks = new Map();

function create(task) {
  const id = 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const rec = { id, status: 'working', created: new Date().toISOString(), progress: 0, result: null, error: null };
  tasks.set(id, rec);
  return rec;
}
function get(id) { return tasks.get(id) || null; }
function update(id, patch) {
  const t = tasks.get(id);
  if (!t) return null;
  Object.assign(t, patch || {});
  if (patch && patch.status === 'completed') t.completed = new Date().toISOString();
  return t;
}
function list() { return [...tasks.values()]; }
function cancel(id) { const t = tasks.get(id); if (t) t.status = 'cancelled'; return t; }

module.exports = { create, get, update, list, cancel };
