// src/mcp_file_uploads.js
// File uploads extension: upload files to tools over MCP (experimental-ext-file-uploads).
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

function store(upload) {
  const id = 'up_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const dir = path.join(DATA_DIR, 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, id + (upload.filename ? path.extname(upload.filename) : ''));
  if (upload.data) fs.writeFileSync(p, Buffer.from(upload.data, upload.encoding || 'base64'));
  return { id, path: p, size: upload.data ? Buffer.byteLength(upload.data, upload.encoding || 'base64') : 0 };
}
function get(id) {
  const dir = path.join(DATA_DIR, 'uploads');
  try { const files = fs.readdirSync(dir).filter((f) => f.startsWith(id)); if (!files.length) return null; return { id, path: path.join(dir, files[0]) }; } catch (e) { return null; }
}

module.exports = { store, get };
