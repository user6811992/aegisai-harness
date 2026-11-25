// src/snippets.js
// Save and reuse code snippets across conversations.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

function dir() { return path.join(DATA_DIR, 'snippets'); }
function ensureDir() { fs.mkdirSync(dir(), { recursive: true }); }

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
  try { return JSON.parse(fs.readFileSync(path.join(dir(), id + '.json'), 'utf8')); }
  catch (e) { return null; }
}

function save(snip) {
  ensureDir();
  const id = String((snip && (snip.id || snip.name)) || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('snip-' + Date.now());
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
  fs.writeFileSync(path.join(dir(), id + '.json'), JSON.stringify(record, null, 2));
  return record;
}

function remove(id) {
  try { fs.unlinkSync(path.join(dir(), id + '.json')); return { ok: true, id }; }
  catch (e) { return { ok: false, id, error: String(e.message || e) }; }
}

function search(query) {
  const q = (query || '').toLowerCase();
  return list().filter((s) => (s.name || '').toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q) || (s.tags || []).some((t) => t.toLowerCase().includes(q)));
}

module.exports = { list, get, save, remove, search };