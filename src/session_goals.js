// src/session_goals.js
// Durable goal tracking per session: create, update progress, complete, list.
const db = require('./storage/db');

function create(sessionId, title, opts) {
  opts = opts || {};
  const id = 'goal_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const goal = { id, sessionId: sessionId || 'default', title, description: opts.description || '', progress: 0, status: 'active', created: new Date().toISOString(), updated: new Date().toISOString() };
  save(goal);
  return goal;
}
function save(g) { g.updated = new Date().toISOString(); try { db.get().prepare('INSERT OR REPLACE INTO session_goals (id, session_id, created, data) VALUES (?,?,?,?)').run(g.id, g.sessionId, g.created, JSON.stringify(g)); } catch (e) {} }
function get(id) { try { const r = db.get().prepare('SELECT data FROM session_goals WHERE id = ?').get(id); return r ? JSON.parse(r.data) : null; } catch (e) { return null; } }
function update(id, patch) { const g = get(id); if (!g) return null; Object.assign(g, patch || {}); if (patch && patch.progress >= 100) g.status = 'completed'; return save(g); }
function list(sessionId) {
  try {
    const rows = db.get().prepare('SELECT data FROM session_goals ' + (sessionId ? 'WHERE session_id = ?' : '') + ' ORDER BY created DESC').all(...(sessionId ? [sessionId] : []));
    return rows.map((r) => JSON.parse(r.data));
  } catch (e) { return []; }
}
function active(sessionId) { return list(sessionId).filter((g) => g.status === 'active'); }

module.exports = { create, get, update, list, active };
