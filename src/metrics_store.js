// src/metrics_store.js
// Append-only local metrics store (JSONL) for the unified Performance Dashboard.
// Keeps HTTP phase timings, tool timings, and token snapshots in one place.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

const FILE = () => path.join(DATA_DIR, 'metrics.jsonl');

function record(kind, data) {
  const entry = Object.assign({ kind, ts: Date.now() }, data || {});
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(FILE(), JSON.stringify(entry) + '\n');
  return entry;
}

function read(limit) {
  if (!fs.existsSync(FILE())) return [];
  const lines = fs.readFileSync(FILE(), 'utf8').split(/\r?\n/).filter(Boolean);
  const slice = limit ? lines.slice(-limit) : lines;
  return slice.map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
}

function byKind(kind, limit) {
  return read().filter((e) => e.kind === kind).slice(-(limit || 100));
}

function clear() {
  try { fs.unlinkSync(FILE()); return { ok: true }; }
  catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

module.exports = { record, read, byKind, clear, FILE };
