// src/snippets.js
// Save and reuse code snippets across conversations.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

function dir() { return path.join(DATA_DIR, 'snippets'); }
function ensureDir() { fs.mkdirSync(dir(), { recursive: true }); }

function safeId(id) {
  return String(id || '').replace(/[^a-z0-9-]/g, '');
}

function list() {
  ensureDir();
  const out = [];
  try {
    for (const f of fs.readdirSync(dir())) {
      if (!f.endsWith('.json')) continue;
      try {
        const s = JSON.parse(fs.readFileSync(path.join(dir(), f), 'utf8'));
        if (s && s.id) out.push(s);
      } catch (e) {}
    }
  } catch (e) {}
  return out.sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));
}

function get(id) {
  const safe = safeId(id);
  if (!safe) return null;
  try { return JSON.parse(fs.readFileSync(path.join(dir(), safe + '.json'), 'utf8')); }
  catch (e) { return null; }
}

function save(snip) {
  ensureDir();
  const id = safeId((snip && (snip.id || snip.name)) || '') || ('snip-' + Date.now());
  const record = {
    id,
    name: snip.name || id,
    language: snip.language || 'text',
    code: snip.code || '',
    tags: Array.isArray(snip.tags) ? snip.tags : [],
    description: snip.description || '',
    created: snip.created || new Date().toISOString(),
    updated: new Date().toISOString(),
  };
  const target = path.join(dir(), id + '.json');
  const resolved = path.resolve(target);
  const root = path.resolve(dir());
  if (!resolved.startsWith(root + path.sep)) throw new Error('path traversal blocked');
  fs.writeFileSync(target, JSON.stringify(record, null, 2));
  return record;
}

function remove(id) {
  const safe = safeId(id);
  if (!safe) return { ok: false, id, error: 'invalid id' };
  const target = path.join(dir(), safe + '.json');
  const resolved = path.resolve(target);
  const root = path.resolve(dir());
  if (!resolved.startsWith(root + path.sep)) return { ok: false, id: safe, error: 'path traversal blocked' };
  try { fs.unlinkSync(target); return { ok: true, id: safe }; }
  catch (e) { return { ok: false, id: safe, error: String(e.message || e) }; }
}

function search(query) {
  const q = (query || '').toLowerCase();
  return list().filter((s) => (s.name || '').toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q) || (s.tags || []).some((t) => t.toLowerCase().includes(q)));
}

module.exports = { list, get, save, remove, search };