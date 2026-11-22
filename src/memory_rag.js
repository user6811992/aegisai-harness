// src/memory_rag.js
// Memory RAG: local embeddings, cosine search, reindex after model change.
const db = require('./storage/db');
const { embed, cosine } = require('./semantic_tools');

function embedText(text) { return embed(String(text || '')); }
function indexMemory(id, text) {
  const m = db.getMemory(id);
  if (!m) return null;
  m.embedding = embedText(text || m.text);
  db.saveMemory(m);
  return { id, dimensions: m.embedding.length };
}
function search(query, k) {
  const q = embedText(query);
  return db.listMemories().map((m) => ({ id: m.id, text: m.text, source: m.source, score: m.embedding ? cosine(q, m.embedding) : cosine(q, embedText(m.text)) }))
    .sort((a, b) => b.score - a.score).slice(0, k || 8);
}
function reindex(model) {
  const rows = db.listMemories();
  for (const m of rows) { m.embedding = embedText(m.text); db.saveMemory(m); }
  return { reindexed: rows.length, model: model || 'local-hash', dimensions: 64 };
}

module.exports = { embedText, indexMemory, search, reindex };
