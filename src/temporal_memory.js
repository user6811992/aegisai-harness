// src/temporal_memory.js
// Bi-temporal memory graph: facts are valid over time, with source and supersession chains.
const db = require('./storage/db');

function remember(text, source, tags, validFrom) {
  const id = 'tm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const from = validFrom || Date.now();
  try {
    db.get().prepare('INSERT INTO temporal_memories (id, text, source, tags, valid_from, valid_to) VALUES (?,?,?,?,?,?)')
      .run(id, text, source || 'manual', JSON.stringify(tags || []), from, null);
  } catch (e) {}
  return id;
}
function supersede(id, text, source) {
  const now = Date.now();
  let old = null;
  try { old = db.get().prepare('SELECT * FROM temporal_memories WHERE id = ?').get(id); } catch (e) {}
  if (!old) return null;
  try { db.get().prepare('UPDATE temporal_memories SET valid_to = ? WHERE id = ?').run(now, id); } catch (e) {}
  const tags = JSON.parse(old.tags || '[]');
  return remember(text, source || old.source, tags, now);
}
function all() {
  try { return db.get().prepare('SELECT * FROM temporal_memories ORDER BY valid_from DESC').all(); } catch (e) { return []; }
}
function recallAsOf(query, date) {
  const t = date ? new Date(date).getTime() : Date.now();
  const q = (query || '').toLowerCase();
  return all().filter((m) => m.valid_from <= t && (m.valid_to == null || m.valid_to > t))
    .filter((m) => !q || m.text.toLowerCase().includes(q))
    .map((m) => ({ id: m.id, text: m.text, source: m.source, tags: JSON.parse(m.tags || '[]'), validFrom: new Date(m.valid_from).toISOString(), validTo: m.valid_to ? new Date(m.valid_to).toISOString() : null }));
}
function graph() {
  const rows = all();
  const byTag = {};
  for (const m of rows) for (const tag of JSON.parse(m.tags || '[]')) (byTag[tag] = byTag[tag] || []).push(m.id);
  const edges = [];
  for (const ids of Object.values(byTag)) {
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) edges.push({ from: ids[i], to: ids[j] });
  }
  return { nodes: rows.map((m) => ({ id: m.id, text: m.text, source: m.source })), edges };
}

module.exports = { remember, supersede, all, recallAsOf, graph };
