// src/markdown_memory.js
// Markdown memory store: append facts to a Markdown file with frontmatter (aegisai-next server/storage/markdown-memory.js).
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

const FILE = () => path.join(DATA_DIR, 'memory.md');

function load() {
  try { return fs.readFileSync(FILE(), 'utf8'); } catch (e) { return '# Memory\n\n'; }
}
function append(text, meta) {
  meta = meta || {};
  fs.mkdirSync(path.dirname(FILE()), { recursive: true });
  const entry = '\n## ' + new Date().toISOString() + (meta.title ? ' — ' + meta.title : '') + '\n\n' + text + '\n';
  fs.appendFileSync(FILE(), entry);
  return { ok: true, file: FILE() };
}
function search(query) {
  const text = load();
  const q = String(query || '').toLowerCase();
  const sections = text.split(/^## /m).slice(1);
  return sections.filter((s) => s.toLowerCase().includes(q)).map((s) => s.slice(0, 500));
}
function list() { return load(); }

module.exports = { load, append, search, list, FILE };
