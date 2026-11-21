// src/storage/db.js
// SQLite persistence (sessions/chats + memories). Tries node:sqlite then better-sqlite3.
let backend = null;
let DatabaseCtor = null;
try {
  const ns = require('node:sqlite');
  DatabaseCtor = ns.DatabaseSync;
  backend = 'node';
} catch (e) {
  try { DatabaseCtor = require('better-sqlite3'); backend = 'better'; } catch (e2) { backend = null; }
}

let db = null;

function open(dbPath) {
  if (!backend) throw new Error('No SQLite backend available');
  if (backend === 'better') {
    db = new DatabaseCtor(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('foreign_keys = ON');
  } else {
    db = new DatabaseCtor(dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA busy_timeout = 5000');
    db.exec('PRAGMA foreign_keys = ON');
  }
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)');
  const vrow = (typeof db.prepare === 'function') ? db.prepare('SELECT version FROM schema_version').get() : null;
  let currentVersion = (vrow && vrow.version) || 0;
  const migrations = [
    function v1() {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL DEFAULT 'Untitled',
          updated TEXT NOT NULL,
          parent_id TEXT,
          branch_from INTEGER,
          messages TEXT NOT NULL DEFAULT '[]'
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated DESC);
        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          text TEXT NOT NULL,
          source TEXT,
          tags TEXT NOT NULL DEFAULT '[]',
          created TEXT NOT NULL,
          updated TEXT,
          embedding TEXT
        );
        CREATE TABLE IF NOT EXISTS code_symbols (
          id TEXT PRIMARY KEY,
          project TEXT,
          path TEXT,
          symbol TEXT,
          kind TEXT,
          line INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_code_symbols_symbol ON code_symbols(symbol);
      `);
    },
    function v2() {
      db.exec(`CREATE TABLE IF NOT EXISTS traces (id TEXT PRIMARY KEY, started TEXT NOT NULL, ended TEXT, data TEXT NOT NULL)`);
      db.exec(`CREATE TABLE IF NOT EXISTS evals (id TEXT PRIMARY KEY, name TEXT NOT NULL, prompt TEXT NOT NULL, expected TEXT, agent TEXT, created TEXT NOT NULL)`);
    },
    function v3() {
      try { db.exec('ALTER TABLE evals ADD COLUMN expected_tools TEXT'); } catch (e) {}
      try { db.exec('ALTER TABLE evals ADD COLUMN expected_state_value TEXT'); } catch (e) {}
    },
    function v4() {
      try { db.exec('ALTER TABLE evals ADD COLUMN expected_state TEXT'); } catch (e) {}
    },
    function v5() {
      db.exec(`CREATE TABLE IF NOT EXISTS context_episodes (id TEXT PRIMARY KEY, type TEXT, content TEXT, app TEXT, created TEXT)`);
    },
    function v6() {
      db.exec(`CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, started TEXT, ended TEXT, model TEXT, prompt TEXT, final TEXT, tool_count INTEGER, tools TEXT, tokens INTEGER, duration_ms INTEGER, ok INTEGER)`);
      db.exec(`CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, kind TEXT, payload TEXT, status TEXT, created TEXT)`);
      db.exec(`CREATE TABLE IF NOT EXISTS timers (id TEXT PRIMARY KEY, due INTEGER, payload TEXT, status TEXT, created TEXT)`);
      db.exec(`CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, payload TEXT, status TEXT, created TEXT)`);
    },
    function v7() {
      db.exec(`CREATE TABLE IF NOT EXISTS dag_runs (id TEXT PRIMARY KEY, created TEXT, data TEXT)`);
      db.exec(`CREATE TABLE IF NOT EXISTS critic_results (id TEXT PRIMARY KEY, target TEXT, created TEXT, data TEXT)`);
    },
    function v8() {
      db.exec(`CREATE TABLE IF NOT EXISTS contracts (name TEXT PRIMARY KEY, created TEXT, chain TEXT)`);
    },
    function v9() {
      db.exec(`CREATE TABLE IF NOT EXISTS teams (name TEXT PRIMARY KEY, created TEXT, data TEXT)`);
    },
    function v10() {
      db.exec(`CREATE TABLE IF NOT EXISTS agent_lifecycle (id TEXT PRIMARY KEY, name TEXT, status TEXT, credential TEXT, created TEXT, heartbeat INTEGER, rotated INTEGER)`);
      db.exec(`CREATE TABLE IF NOT EXISTS temporal_memories (id TEXT PRIMARY KEY, text TEXT, source TEXT, tags TEXT, valid_from INTEGER, valid_to INTEGER)`);
    },
    function v11() {
      db.exec(`CREATE TABLE IF NOT EXISTS ledger (seq INTEGER PRIMARY KEY, event TEXT, payload TEXT, prev TEXT, hash TEXT)`);
      db.exec(`CREATE TABLE IF NOT EXISTS mailbox (id TEXT PRIMARY KEY, recipient TEXT, sender TEXT, subject TEXT, body TEXT, status TEXT, created TEXT)`);
    },
    function v12() {
      db.exec(`CREATE TABLE IF NOT EXISTS task_states (id TEXT PRIMARY KEY, created TEXT, data TEXT)`);
    },
    function v13() {
      db.exec(`CREATE TABLE IF NOT EXISTS runtimes (name TEXT PRIMARY KEY, command TEXT, created TEXT)`);
      db.exec(`CREATE TABLE IF NOT EXISTS skill_packages (name TEXT PRIMARY KEY, source TEXT, created TEXT)`);
    },
    function v14() {
      db.exec(`CREATE TABLE IF NOT EXISTS gateway_rules (agent TEXT, resource TEXT, action TEXT, created TEXT, PRIMARY KEY(agent, resource, action))`);
    },
  ];
  for (let i = currentVersion; i < migrations.length; i++) {
    migrations[i]();
    currentVersion = i + 1;
    const exists = (typeof db.prepare === 'function') ? db.prepare('SELECT version FROM schema_version').get() : null;
    if (exists) db.prepare('UPDATE schema_version SET version = ?').run(currentVersion);
    else db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(currentVersion);
  }
  return db;
}

function get() { if (!db) throw new Error('Database not opened'); return db; }
function isOpen() { return !!db; }
function close() { if (db) { db.close(); db = null; } }

function one(sql, params) { return db.prepare(sql).get(...(params || [])); }
function all(sql, params) { return db.prepare(sql).all(...(params || [])); }
function run(sql, params) { db.prepare(sql).run(...(params || [])); }

function rowToSession(r) {
  let messages = [];
  try { messages = JSON.parse(r.messages || '[]'); } catch (e) { messages = []; }
  return { id: r.id, title: r.title, updated: r.updated, parent_id: r.parent_id, branch_from: r.branch_from, messages };
}
function listSessions() { return all('SELECT id, title, updated, parent_id, branch_from FROM sessions ORDER BY updated DESC').map(rowToSession); }
function getSession(id) { const row = one('SELECT * FROM sessions WHERE id = ?', [id]); return row ? rowToSession(row) : null; }
function saveSession(s) {
  const id = s.id || ('sess_' + Date.now());
  const title = s.title || 'Untitled';
  const messages = JSON.stringify(s.messages || []);
  const updated = new Date().toISOString();
  const parentId = s.parent_id || null;
  const branchFrom = (s.branch_from === undefined) ? null : s.branch_from;
  const existing = one('SELECT id FROM sessions WHERE id = ?', [id]);
  if (existing) {
    run('UPDATE sessions SET title=?, updated=?, messages=?, parent_id=?, branch_from=? WHERE id=?', [title, updated, messages, parentId, branchFrom, id]);
  } else {
    run('INSERT INTO sessions (id, title, updated, parent_id, branch_from, messages) VALUES (?,?,?,?,?,?)', [id, title, updated, parentId, branchFrom, messages]);
  }
  return id;
}
function deleteSession(id) { run('DELETE FROM sessions WHERE id = ?', [id]); }

function rowToMemory(r) {
  let tags = []; let embedding = null;
  try { tags = JSON.parse(r.tags || '[]'); } catch (e) { tags = []; }
  try { embedding = r.embedding ? JSON.parse(r.embedding) : null; } catch (e) { embedding = null; }
  return { id: r.id, text: r.text, source: r.source, tags, created: r.created, updated: r.updated, embedding };
}
function listMemories() { return all('SELECT * FROM memories ORDER BY created DESC').map(rowToMemory); }
function getMemory(id) { const r = one('SELECT * FROM memories WHERE id = ?', [id]); return r ? rowToMemory(r) : null; }
function saveMemory(m) {
  const id = m.id || ('m_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
  const existing = one('SELECT id FROM memories WHERE id = ?', [id]);
  if (existing) {
    let embeddingToStore;
    if (m.embedding === undefined) {
      const cur = one('SELECT embedding FROM memories WHERE id = ?', [id]);
      embeddingToStore = cur ? cur.embedding : null;
    } else {
      embeddingToStore = m.embedding ? JSON.stringify(m.embedding) : null;
    }
    run('UPDATE memories SET text=?, source=?, tags=?, updated=?, embedding=? WHERE id=?', [m.text, m.source || 'manual', JSON.stringify(m.tags || []), new Date().toISOString(), embeddingToStore, id]);
  } else {
    run('INSERT INTO memories (id, text, source, tags, created, embedding) VALUES (?,?,?,?,?,?)', [id, m.text, m.source || 'manual', JSON.stringify(m.tags || []), m.created || new Date().toISOString(), m.embedding ? JSON.stringify(m.embedding) : null]);
  }
  return id;
}
function deleteMemory(id) { run('DELETE FROM memories WHERE id = ?', [id]); }

module.exports = { open, get, isOpen, close, backend,
  listSessions, getSession, saveSession, deleteSession,
  listMemories, getMemory, saveMemory, deleteMemory };
