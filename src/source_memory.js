// src/source_memory.js
// Source-bound memory: every durable fact cites where it came from.
const db = require('./storage/db');

function remember(text, source, tags) {
  return db.saveMemory({ text, source: source || 'manual', tags: tags || [] });
}

function recall(query, limit) {
  const q = (query || '').toLowerCase();
  let rows = db.listMemories();
  if (q) rows = rows.filter((m) => (m.text || '').toLowerCase().includes(q) || (m.tags || []).some((t) => t.toLowerCase().includes(q)));
  return (rows || []).slice(0, limit || 20).map((m) => ({
    text: m.text,
    source: m.source || 'unknown',
    tags: m.tags || [],
    citation: '[' + (m.source || 'unknown') + '] ' + m.text,
  }));
}

function sources() {
  const out = {};
  for (const m of db.listMemories()) out[m.source || 'unknown'] = (out[m.source || 'unknown'] || 0) + 1;
  return out;
}

module.exports = { remember, recall, sources };
