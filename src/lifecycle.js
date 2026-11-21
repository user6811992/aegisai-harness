// src/lifecycle.js
// Agent lifecycle: provision → heartbeat → credential rotation → orphan detection → decommission.
const crypto = require('crypto');
const db = require('./storage/db');

function provision(name, opts) {
  opts = opts || {};
  const cred = crypto.randomBytes(16).toString('hex');
  const id = 'agent_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  try {
    db.get().prepare('INSERT OR REPLACE INTO agent_lifecycle (id, name, status, credential, created, heartbeat, rotated) VALUES (?,?,?,?,?,?,?)')
      .run(id, name, 'active', cred, new Date().toISOString(), Date.now(), 0);
  } catch (e) {}
  return { id, name, credential: cred };
}
function get(id) {
  try { const r = db.get().prepare('SELECT * FROM agent_lifecycle WHERE id = ?').get(id); return r || null; } catch (e) { return null; }
}
function list() {
  try { return db.get().prepare('SELECT id, name, status, created, heartbeat, rotated FROM agent_lifecycle ORDER BY created DESC').all(); } catch (e) { return []; }
}
function heartbeat(id) {
  try { db.get().prepare('UPDATE agent_lifecycle SET heartbeat = ? WHERE id = ?').run(Date.now(), id); return true; } catch (e) { return false; }
}
function rotate(id) {
  const cred = crypto.randomBytes(16).toString('hex');
  try { db.get().prepare('UPDATE agent_lifecycle SET credential = ?, rotated = rotated + 1 WHERE id = ?').run(cred, id); } catch (e) {}
  return { id, credential: cred };
}
function orphans(ttlMs) {
  ttlMs = ttlMs || 3600000;
  const cutoff = Date.now() - ttlMs;
  try { return db.get().prepare("SELECT id, name, heartbeat FROM agent_lifecycle WHERE status = 'active' AND heartbeat < ?").all(cutoff); } catch (e) { return []; }
}
function decommission(id) {
  try { db.get().prepare("UPDATE agent_lifecycle SET status = 'decommissioned', credential = '' WHERE id = ?").run(id); return true; } catch (e) { return false; }
}

module.exports = { provision, get, list, heartbeat, rotate, orphans, decommission };
