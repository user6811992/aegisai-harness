// src/identity_audit.js
// Least-privilege per-agent identity + audit for tool calls (agent-guard).
const db = require('./storage/db');
const ledger = require('./ledger');

function create(agent, grants) {
  const id = 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  try { db.get().prepare('INSERT OR REPLACE INTO identities (id, agent, grants, created) VALUES (?,?,?,?)').run(id, agent, JSON.stringify(grants || []), new Date().toISOString()); } catch (e) {}
  return { id, agent, grants: grants || [] };
}
function authorize(agent, tool) {
  let row = null;
  try { row = db.get().prepare('SELECT * FROM identities WHERE agent = ? ORDER BY created DESC LIMIT 1').get(agent); } catch (e) {}
  const grants = row ? JSON.parse(row.grants || '[]') : [];
  const allowed = grants.includes('*') || grants.includes(tool);
  try { ledger.append('identity_audit', { agent, tool, allowed }); } catch (e) {}
  return { allowed, agent, tool, grants };
}
function list() { try { return db.get().prepare('SELECT * FROM identities ORDER BY created DESC').all(); } catch (e) { return []; } }

module.exports = { create, authorize, list };
