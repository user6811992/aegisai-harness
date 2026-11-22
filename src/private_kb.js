// src/private_kb.js
// Private knowledge retrieval (RAGFlow-style): index local docs, search, retrieve (no cloud).
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const { embed, cosine } = require('./semantic_tools');

const DIR = () => path.join(DATA_DIR, 'private-kb');

function add(name, content) {
  fs.mkdirSync(DIR(), { recursive: true });
  const p = path.join(DIR(), name.replace(/[^a-zA-Z0-9._-]/g, '_'));
  fs.writeFileSync(p, content || '');
  const chunks = chunk(content || '');
  return { name, path: p, chunks: chunks.length };
}
function chunk(text) {
  return String(text || '').split(/\r?\n\r?\n/).map((c) => c.trim()).filter((c) => c.length > 20);
}
function list() {
  try { return fs.readdirSync(DIR()).map((f) => ({ name: f, size: fs.statSync(path.join(DIR(), f)).size })); } catch (e) { return []; }
}
function search(query, k) {
  const q = embed(query || '');
  const results = [];
  for (const f of list()) {
    let text = '';
    try { text = fs.readFileSync(path.join(DIR(), f.name), 'utf8'); } catch (e) { continue; }
    for (const c of chunk(text)) results.push({ file: f.name, text: c.slice(0, 500), score: cosine(q, embed(c)) });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, k || 8);
}
function remove(name) {
  try { fs.unlinkSync(path.join(DIR(), name)); return { ok: true }; } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

module.exports = { add, chunk, list, search, remove };
