// src/context_fs.js
// Unified context filesystem: code + memory + docs + sessions in one file-like interface.
const db = require('./storage/db');
const fs = require('fs');
const path = require('path');

function nodes() {
  const out = [];
  try { for (const r of db.get().prepare('SELECT path, symbol, kind, line FROM code_symbols').all()) out.push({ path: '/code/' + r.path + ':' + r.line, type: 'symbol', name: r.symbol, kind: r.kind, content: r.kind + ' ' + r.symbol + ' at line ' + r.line }); } catch (e) {}
  try { for (const m of db.listMemories()) out.push({ path: '/memory/' + m.id, type: 'memory', name: m.text.slice(0, 60), content: m.text }); } catch (e) {}
  try { for (const s of db.listSessions()) out.push({ path: '/session/' + s.id, type: 'session', name: s.title || s.id, content: JSON.stringify(s.messages || []).slice(0, 1000) }); } catch (e) {}
  const docs = path.join(__dirname, '..');
  for (const f of ['README.md', 'ROADMAP.md', 'llms.txt']) {
    const p = path.join(docs, f);
    try { out.push({ path: '/docs/' + f, type: 'doc', name: f, content: fs.readFileSync(p, 'utf8').slice(0, 5000) }); } catch (e) {}
  }
  return out;
}
function list(prefix) {
  const all = nodes();
  return (prefix ? all.filter((n) => n.path.startsWith(prefix)) : all).map((n) => n.path);
}
function read(p) {
  return nodes().find((n) => n.path === p) || null;
}
function search(query) {
  const q = (query || '').toLowerCase();
  return nodes().filter((n) => (n.content || '').toLowerCase().includes(q) || (n.name || '').toLowerCase().includes(q)).slice(0, 30);
}

module.exports = { nodes, list, read, search };
