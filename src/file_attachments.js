// src/file_attachments.js
// File attachments, downloads, Office previews (deer-flow "File Previews").
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

function saveAttachment(name, data, encoding) {
  const dir = path.join(DATA_DIR, 'attachments');
  fs.mkdirSync(dir, { recursive: true });
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const p = path.join(dir, Date.now() + '_' + safe);
  fs.writeFileSync(p, Buffer.from(data || '', encoding || 'base64'));
  return { path: p, name: safe, size: Buffer.byteLength(data || '', encoding || 'base64') };
}
function list() {
  const dir = path.join(DATA_DIR, 'attachments');
  try { return fs.readdirSync(dir).map((f) => ({ name: f, path: path.join(dir, f), size: fs.statSync(path.join(dir, f)).size })); } catch (e) { return []; }
}
function previewText(p) {
  try {
    const buf = fs.readFileSync(p);
    if (buf.includes(0)) return { ok: false, note: 'binary file (' + buf.length + ' bytes)' };
    return { ok: true, text: buf.toString('utf8').slice(0, 4000) };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

module.exports = { saveAttachment, list, previewText };
