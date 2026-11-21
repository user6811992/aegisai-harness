// src/constitution.js
// Constitution evolution: propose → human approval → adopted public history.
const db = require('./storage/db');

function propose(text) {
  const id = 'con_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  try { db.get().prepare('INSERT INTO constitution (id, text, status, created) VALUES (?,?,?,?)').run(id, text, 'proposed', new Date().toISOString()); } catch (e) {}
  return { id, text, status: 'proposed' };
}
function decide(id, decision) {
  const status = decision === 'approve' ? 'adopted' : 'rejected';
  try { db.get().prepare('UPDATE constitution SET status = ? WHERE id = ?').run(status, id); } catch (e) {}
  return { id, status };
}
function all() {
  try { return db.get().prepare('SELECT * FROM constitution ORDER BY created DESC').all(); } catch (e) { return []; }
}
function adopted() { return all().filter((c) => c.status === 'adopted'); }
function current() { return adopted()[0] || null; }

module.exports = { propose, decide, all, adopted, current };
