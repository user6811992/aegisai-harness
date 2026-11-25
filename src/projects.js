// src/projects.js
// Project-scoped context: instructions + document shelf (deer-flow "Projects").
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

function dir() { return path.join(DATA_DIR, 'projects'); }

// Reject traversal/absolute paths for project names.
function safeName(name) {
  if (typeof name !== 'string') throw Object.assign(new Error('project name must be a string'), { status: 400 });
  const n = name.trim();
  if (!n) throw Object.assign(new Error('project name is required'), { status: 400 });
  if (n.includes('..') || n.includes('/') || n.includes('\\') || n.includes('\0') || path.isAbsolute(n)) {
    throw Object.assign(new Error('invalid project name (no path separators or "..")'), { status: 400 });
  }
  return n;
}

// Reject anything that isn't a plain filename for documents.
function safeFilename(filename) {
  if (typeof filename !== 'string') throw Object.assign(new Error('filename must be a string'), { status: 400 });
  const f = path.basename(filename.trim());
  if (!f || f === '.' || f === '..' || f.includes('\0')) {
    throw Object.assign(new Error('invalid filename'), { status: 400 });
  }
  return f;
}

// Ensure the resolved target stays inside the projects base.
function resolveInside(base, target) {
  const resolvedBase = path.resolve(base);
  const resolved = path.resolve(resolvedBase, target);
  const rel = path.relative(resolvedBase, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw Object.assign(new Error('path escapes projects directory'), { status: 400 });
  }
  return resolved;
}

function create(name, instructions) {
  const n = safeName(name);
  const p = resolveInside(dir(), n);
  fs.mkdirSync(p, { recursive: true });
  fs.mkdirSync(path.join(p, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(p, 'instructions.md'), instructions || '# ' + n + '\n');
  return { name: n, path: p };
}
function get(name) {
  const n = safeName(name);
  const p = resolveInside(dir(), n);
  if (!fs.existsSync(p)) return null;
  let instructions = '';
  try { instructions = fs.readFileSync(path.join(p, 'instructions.md'), 'utf8'); } catch (e) {}
  let shelf = [];
  try { shelf = fs.readdirSync(path.join(p, 'docs')).filter((f) => f.endsWith('.md') || f.endsWith('.txt')); } catch (e) {}
  return { name: n, path: p, instructions, shelf };
}
function addDoc(name, filename, content) {
  const n = safeName(name);
  const f = safeFilename(filename);
  const base = resolveInside(dir(), n);
  const p = resolveInside(path.join(base, 'docs'), f);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content || '');
  return { name: n, file: f };
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
  return 'Project: ' + p.name + '\n\n' + p.instructions + (docs.length ? '\n\n## Document shelf\n\n' + docs.join('\n\n---\n\n') : '');
}

module.exports = { create, get, addDoc, list, systemText, safeName, safeFilename };
