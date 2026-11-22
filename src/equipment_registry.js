// src/equipment_registry.js
// Harness equipment registry with tested-vs-catalogued verdicts.
const db = require('./storage/db');

function add(name, category, opts) {
  const rec = { name, category, verdict: 'catalogued', testedAt: null, note: (opts && opts.note) || '' };
  try { db.get().prepare('INSERT OR REPLACE INTO equipment (name, created, data) VALUES (?,?,?)').run(name, new Date().toISOString(), JSON.stringify(rec)); } catch (e) {}
  return rec;
}
function markTested(name, result) {
  let row = null;
  try { row = db.get().prepare('SELECT data FROM equipment WHERE name = ?').get(name); } catch (e) {}
  if (!row) return null;
  const rec = JSON.parse(row.data || '{}');
  rec.verdict = result === 'pass' ? 'tested-pass' : 'tested-fail';
  rec.testedAt = new Date().toISOString();
  try { db.get().prepare('UPDATE equipment SET data = ? WHERE name = ?').run(JSON.stringify(rec), name); } catch (e) {}
  return rec;
}
function list(category) {
  try {
    return db.get().prepare('SELECT data FROM equipment ORDER BY created DESC').all().map((r) => JSON.parse(r.data || '{}')).filter((r) => !category || r.category === category);
  } catch (e) { return []; }
}

module.exports = { add, markTested, list };
