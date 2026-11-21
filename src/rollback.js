// src/rollback.js
// Action rollback: snapshot files before destructive tools, restore on demand.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

function dir() { return path.join(DATA_DIR, 'rollback'); }
function snapshotFile(filePath, projectRoot) {
  const full = path.isAbsolute(filePath) ? filePath : path.join(projectRoot || process.cwd(), filePath);
  const id = 'rb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const rec = { id, path: full, at: new Date().toISOString(), existed: fs.existsSync(full), content: null };
  if (rec.existed) { try { rec.content = fs.readFileSync(full).toString('base64'); } catch (e) {} }
  fs.mkdirSync(dir(), { recursive: true });
  fs.writeFileSync(path.join(dir(), id + '.json'), JSON.stringify(rec));
  return id;
}
function get(id) {
  try { return JSON.parse(fs.readFileSync(path.join(dir(), id + '.json'), 'utf8')); } catch (e) { return null; }
}
function restore(id) {
  const r = get(id);
  if (!r) return { ok: false, error: 'no snapshot: ' + id };
  try {
    if (r.existed) fs.writeFileSync(r.path, Buffer.from(r.content || '', 'base64'));
    else if (fs.existsSync(r.path)) fs.unlinkSync(r.path);
    return { ok: true, path: r.path };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}
function list() {
  try { return fs.readdirSync(dir()).filter((f) => f.endsWith('.json')).map((f) => { const r = get(f.slice(0, -5)); return r ? { id: r.id, path: r.path, at: r.at, existed: r.existed } : null; }).filter(Boolean); } catch (e) { return []; }
}

module.exports = { snapshotFile, get, restore, list };
