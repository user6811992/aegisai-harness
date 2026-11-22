// src/trace_export.js
// External trace export: buffered HTTP/MCP/webhook with local disk fallback.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

const BUFFER = path.join(DATA_DIR, 'trace-export-buffer.jsonl');

function buffer(records) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const r of records || []) fs.appendFileSync(BUFFER, JSON.stringify(r) + '\n');
  return records.length;
}
async function flush(url, opts) {
  opts = opts || {};
  if (!fs.existsSync(BUFFER)) return { ok: false, error: 'nothing buffered' };
  const lines = fs.readFileSync(BUFFER, 'utf8').split(/\r?\n/).filter(Boolean);
  if (!url) return { ok: false, count: lines.length, note: 'no export URL configured' };
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }, body: JSON.stringify({ traces: lines.map((l) => { try { return JSON.parse(l); } catch (e) { return { raw: l }; } }) }), signal: AbortSignal.timeout(15000) });
    if (!r.ok) return { ok: false, status: r.status, count: lines.length };
    fs.writeFileSync(BUFFER, '');
    return { ok: true, count: lines.length };
  } catch (e) { return { ok: false, error: String(e.message || e), count: lines.length }; }
}
function status() {
  const n = fs.existsSync(BUFFER) ? fs.readFileSync(BUFFER, 'utf8').split(/\r?\n/).filter(Boolean).length : 0;
  return { buffered: n, url: process.env.AEGISAI_TRACE_URL || '' };
}

module.exports = { buffer, flush, status };
