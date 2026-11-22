// src/projects.js
// Project-scoped context: instructions + document shelf (deer-flow "Projects").
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

function dir() { return path.join(DATA_DIR, 'projects'); }
function create(name, instructions) {
  const p = path.join(dir(), name);
  fs.mkdirSync(p, { recursive: true });
  fs.mkdirSync(path.join(p, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(p, 'instructions.md'), instructions || '# ' + name + '\n');
  return { name, path: p };
}
function get(name) {
  const p = path.join(dir(), name);
  if (!fs.existsSync(p)) return null;
  let instructions = '';
  try { instructions = fs.readFileSync(path.join(p, 'instructions.md'), 'utf8'); } catch (e) {}
  let shelf = [];
  try { shelf = fs.readdirSync(path.join(p, 'docs')).filter((f) => f.endsWith('.md') || f.endsWith('.txt')); } catch (e) {}
  return { name, path: p, instructions, shelf };
}
function addDoc(name, filename, content) {
  const p = path.join(dir(), name, 'docs', filename);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content || '');
  return { name, file: filename };
}
function list() {
  try { return fs.readdirSync(dir()).filter((d) => fs.statSync(path.join(dir(), d)).isDirectory()); } catch (e) { return []; }
}
function systemText(name) {
  const p = get(name);
  if (!p) return '';
  const docs = p.shelf.map((f) => {
    try { return '### ' + f + '\n' + fs.readFileSync(path.join(p.path, 'docs', f), 'utf8').slice(0, 4000); } catch (e) { return ''; }
  }).filter(Boolean);
  return 'Project: ' + name + '\n\n' + p.instructions + (docs.length ? '\n\n## Document shelf\n\n' + docs.join('\n\n---\n\n') : '');
}

module.exports = { create, get, addDoc, list, systemText };
