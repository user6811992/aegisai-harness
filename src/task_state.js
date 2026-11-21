// src/task_state.js
// Structured task state instead of raw chat history.
const db = require('./storage/db');

function create(goal, opts) {
  opts = opts || {};
  const id = 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const state = {
    id, goal, status: 'active',
    scope: opts.scope || [], successCriteria: opts.successCriteria || [],
    steps: [], artifacts: [], decisions: [],
    created: new Date().toISOString(), updated: new Date().toISOString(),
  };
  save(state);
  return state;
}
function save(state) {
  state.updated = new Date().toISOString();
  try { db.get().prepare('INSERT OR REPLACE INTO task_states (id, created, data) VALUES (?,?,?)').run(state.id, state.created, JSON.stringify(state)); } catch (e) {}
  return state;
}
function get(id) {
  try { const r = db.get().prepare('SELECT * FROM task_states WHERE id = ?').get(id); return r ? JSON.parse(r.data || '{}') : null; } catch (e) { return null; }
}
function update(id, patch) {
  const s = get(id);
  if (!s) return null;
  Object.assign(s, patch || {});
  return save(s);
}
function list() {
  try { return db.get().prepare('SELECT id, goal, status, created, updated FROM task_states ORDER BY updated DESC LIMIT 50').all(); } catch (e) { return []; }
}

module.exports = { create, get, update, list };
