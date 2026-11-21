// src/geometric_memory.js
// Geometric memory: points in a small embedding space + session handoff injection at wake.
const { embed, cosine } = require('./semantic_tools');
const db = require('./storage/db');

function store(concept, text, meta) {
  const vec = embed(text);
  try { db.get().prepare('INSERT OR REPLACE INTO geo_memory (id, concept, text, vec, meta, created) VALUES (?,?,?,?,?,?)')
    .run(concept, concept, text, JSON.stringify(vec), JSON.stringify(meta || {}), new Date().toISOString()); } catch (e) {}
  return concept;
}
function query(text, k) {
  const q = embed(text);
  let rows = [];
  try { rows = db.get().prepare('SELECT * FROM geo_memory').all(); } catch (e) {}
  return rows.map((r) => ({ concept: r.concept, text: r.text, score: cosine(q, JSON.parse(r.vec || '[]')) }))
    .sort((a, b) => b.score - a.score).slice(0, k || 5);
}
function handoff(sessionId, messages) {
  const summary = (messages || []).map((m) => m.role + ': ' + String(m.content || '').slice(0, 200)).join('\n');
  const text = '# Session handoff ' + sessionId + '\n' + summary.slice(0, 3000);
  store('handoff:' + sessionId, text, { sessionId });
  return text;
}
function wakeInjection(sessionId) {
  const r = query('handoff:' + sessionId, 1)[0];
  return r ? r.text : '';
}

module.exports = { store, query, handoff, wakeInjection };
