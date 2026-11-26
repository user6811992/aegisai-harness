// src/tenants.js
// Multi-tenant isolation: each tenant gets its own data directory and DB.
// Provides tenant-scoped resources, quotas, and isolation gates.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const db = require('./storage/db');
const { acquireLock, releaseLock, isLocked } = require('./resource_broker');

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
function getQuota(id) {
  const r = readRegistry();
  return r.tenants[id] && r.tenants[id].quota
    ? r.tenants[id].quota
    : { maxAgents: 10, maxSessions: 50, maxStorageMb: 100, maxConcurrentTools: 5 };
}
function incrementUsage(id, key) {
  const r = readRegistry();
  if (!r.tenants[id]) return false;
  if (!r.tenants[id].usage) r.tenants[id].usage = {};
  r.tenants[id].usage[key] = (r.tenants[id].usage[key] || 0) + 1;
  writeRegistry(r);
  return true;
}
function checkQuota(id, key) {
  const quota = getQuota(id);
  const usage = (r.tenants[id] && r.tenants[id].usage && r.tenants[id].usage[key]) || 0;
  return usage < quota[key];
}
function checkToolAccess(id, toolName) {
  const quota = getQuota(id);
  if (!checkQuota(id, 'maxConcurrentTools')) return { ok: false, error: 'maxConcurrentTools quota exceeded' };
  incrementUsage(id, 'maxConcurrentTools');
  return { ok: true };
}
function sessionDir(id, sessionId) {
  return path.join(dataDir(id), 'sessions', sessionId + '.json');
}
function saveSession(id, sessionId, sessionData) {
  const dir = path.join(dataDir(id), 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(sessionDir(id, sessionId), JSON.stringify(sessionData, null, 2));
  return true;
}
function loadSession(id, sessionId) {
  try {
    return JSON.parse(fs.readFileSync(sessionDir(id, sessionId), 'utf8'));
  } catch (e) {
    return null;
  }
}
function openTenantDb(id) {
  const dir = dataDir(id);
  db.close();
  db.open(path.join(dir, 'harness.db'));
  return db;
}

module.exports = { create, list, get, dataDir, use, getQuota, incrementUsage, checkQuota, checkToolAccess, sessionDir, saveSession, loadSession, openTenantDb };