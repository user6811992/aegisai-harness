// src/tenants.js
// Multi-tenant isolation: each tenant gets its own data directory and DB.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const db = require('./storage/db');

const ROOT = path.join(DATA_DIR, 'tenants');
const REGISTRY = path.join(ROOT, 'registry.json');

function readRegistry() {
  try { return JSON.parse(fs.readFileSync(REGISTRY, 'utf8')); } catch (e) { return { tenants: {} }; }
}
function writeRegistry(r) {
  fs.mkdirSync(ROOT, { recursive: true });
  fs.writeFileSync(REGISTRY, JSON.stringify(r, null, 2));
}
function create(id, meta) {
  const r = readRegistry();
  r.tenants[id] = Object.assign({ id, created: new Date().toISOString() }, meta || {});
  writeRegistry(r);
  fs.mkdirSync(path.join(ROOT, id), { recursive: true });
  return r.tenants[id];
}
function list() { return Object.values(readRegistry().tenants); }
function get(id) { return readRegistry().tenants[id] || null; }
function dataDir(id) {
  if (!get(id)) throw new Error('unknown tenant: ' + id);
  return path.join(ROOT, id);
}
function use(id) {
  const dir = dataDir(id);
  db.close();
  db.open(path.join(dir, 'harness.db'));
  return { tenant: id, db: dir };
}

module.exports = { create, list, get, dataDir, use };
