// src/durable.js
// Persist always-on runtime state in SQLite so restarts resume work (aegisai-next server/runtime/durable.js).
const db = require('./storage/db');

function enabled() { try { return !!db.get(); } catch (e) { return false; } }
function safeParse(text, fallback) {
  if (text === null || text === undefined) return fallback;
  try { return JSON.parse(text); } catch (e) { return fallback; }
}
function ensureTables() { initTables(); }
function saveSession(session) {
  if (!enabled()) return;
  ensureTables();
  try { db.get().prepare('INSERT OR REPLACE INTO runtime_sessions (id, goal, status, policy, created, last_result) VALUES (?,?,?,?,?,?)').run(session.id, session.goal || '', session.status || 'idle', JSON.stringify(session.policy || {}), session.createdAt || Date.now(), session.lastResult === null || session.lastResult === undefined ? null : JSON.stringify(session.lastResult)); } catch (e) {}
}
function deleteSession(sessionId) { if (!enabled()) return; ensureTables(); try { db.get().prepare('DELETE FROM runtime_sessions WHERE id = ?').run(sessionId); } catch (e) {} }
function saveJob(sessionId, job) {
  if (!enabled()) return;
  ensureTables();
  try { db.get().prepare('INSERT OR REPLACE INTO runtime_jobs (id, session_id, goal, status, payload, result, error, attempts, created) VALUES (?,?,?,?,?,?,?,?,?)').run(job.id, sessionId, job.goal || '', job.status || 'queued', JSON.stringify(job), job.result === undefined ? null : JSON.stringify(job.result), job.error || null, job.attempts || 0, job.createdAt || Date.now()); } catch (e) {}
}
function saveOutboxEvent(event) {
  if (!enabled()) return;
  ensureTables();
  const s = event.session;
  const sessionId = (s && typeof s === 'object') ? s.id : (s || event.sessionId || null);
  try { db.get().prepare('INSERT INTO runtime_outbox (session_id, job_id, type, payload, created) VALUES (?,?,?,?,?)').run(sessionId || null, (event.job && event.job.id) || event.jobId || null, event.type || 'event', JSON.stringify(event), Date.now()); } catch (e) {}
}
function loadSessions() {
  if (!enabled()) return [];
  ensureTables();
  try { return db.get().prepare('SELECT id, goal, status, policy, created, last_result FROM runtime_sessions ORDER BY created').all().map((r) => ({ id: r.id, goal: r.goal, status: r.status, policy: safeParse(r.policy, {}), createdAt: r.created, lastResult: safeParse(r.last_result, null), queue: [], jobs: [] })); } catch (e) { return []; }
}
function loadJobs(sessionId) {
  if (!enabled()) return [];
  ensureTables();
  try { return db.get().prepare('SELECT payload FROM runtime_jobs WHERE session_id = ? ORDER BY created').all(sessionId).map((r) => safeParse(r.payload, null)).filter(Boolean); } catch (e) { return []; }
}
function listOutbox(sessionId, limit) {
  if (!enabled()) return [];
  ensureTables();
  try { return db.get().prepare('SELECT payload FROM runtime_outbox WHERE session_id = ? ORDER BY id DESC LIMIT ?').all(sessionId, limit || 50).map((r) => safeParse(r.payload, null)).filter(Boolean); } catch (e) { return []; }
}
function restoreRuntime(runtime) {
  const sessions = loadSessions();
  for (const session of sessions) {
    const jobs = loadJobs(session.id);
    session.jobs = jobs.slice();
    session.queue = jobs.filter((j) => j.status === 'queued' || j.status === 'running').map((j) => ({ ...j, status: 'queued' }));
    session.status = session.queue.length ? 'queued' : 'idle';
    if (runtime && runtime.sessions) runtime.sessions.set(session.id, session);
  }
  return sessions.length;
}
// ensure tables exist
function initTables() {
  if (!enabled()) return;
  try {
    db.get().exec('CREATE TABLE IF NOT EXISTS runtime_sessions (id TEXT PRIMARY KEY, goal TEXT, status TEXT, policy TEXT, created INTEGER, last_result TEXT)');
    db.get().exec('CREATE TABLE IF NOT EXISTS runtime_jobs (id TEXT PRIMARY KEY, session_id TEXT, goal TEXT, status TEXT, payload TEXT, result TEXT, error TEXT, attempts INTEGER, created INTEGER)');
    db.get().exec('CREATE TABLE IF NOT EXISTS runtime_outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, job_id TEXT, type TEXT, payload TEXT, created INTEGER)');
  } catch (e) {}
}
initTables();

module.exports = { enabled, saveSession, deleteSession, saveJob, saveOutboxEvent, loadSessions, loadJobs, listOutbox, restoreRuntime };
