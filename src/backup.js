// src/backup.js
// Backup/restore for the local SQLite state (sessions, memories, code_symbols, traces, evals).
const db = require('./storage/db');

const TABLES = ['sessions', 'memories', 'code_symbols', 'traces', 'evals'];

function exportState() {
  const conn = db.get();
  const out = {};
  for (const t of TABLES) {
    try { out[t] = conn.prepare('SELECT * FROM ' + t).all(); }
    catch (e) { out[t] = []; }
  }
  return { ok: true, tables: TABLES, data: out };
}

function importState(data) {
  if (!data || typeof data !== 'object') throw new Error('data object required');
  const keys = Object.keys(data);
  const unknown = keys.filter((k) => !TABLES.includes(k));
  if (unknown.length > 0) throw new Error('unknown tables: ' + unknown.join(', '));
  const present = keys.filter((k) => TABLES.includes(k));
  if (present.length === 0) throw new Error('at least one known table required');

  // Validate all rows before touching the database.
  for (const t of present) {
    const rows = data[t];
    if (!Array.isArray(rows)) throw new Error(t + ' must be an array');
    for (const r of rows) {
      if (r === null || typeof r !== 'object' || Array.isArray(r)) throw new Error(t + ' contains a non-object row');
    }
    if (rows.length > 0) {
      const cols = Object.keys(rows[0]);
      if (cols.length === 0) throw new Error(t + ' row has no columns');
      for (const r of rows) {
        for (const c of cols) {
          if (!(c in r)) throw new Error(t + ' row missing column ' + c);
        }
      }
    }
  }

  const conn = db.get();
  // Transactional import: delete + insert per present table, rollback on failure.
  const run = () => {
    for (const t of present) {
      const rows = data[t];
      conn.prepare('DELETE FROM ' + t).run();
      if (rows.length === 0) continue;
      const cols = Object.keys(rows[0]);
      // Validate column names against the real table schema to prevent SQL injection.
      const allowedCols = new Set(conn.prepare('PRAGMA table_info(' + t + ')').all().map((c) => c.name));
      for (const c of cols) {
        if (!allowedCols.has(c)) throw new Error(t + ' has unknown column ' + c);
      }
      const quotedCols = cols.map((c) => '"' + c.replace(/"/g, '""') + '"').join(',');
      const placeholders = cols.map(() => '?').join(',');
      const sql = `INSERT INTO ${t} (${quotedCols}) VALUES (${placeholders})`;
      const stmt = conn.prepare(sql);
      for (const r of rows) {
        stmt.run(...cols.map((c) => r[c]));
      }
    }
  };

  if (typeof conn.transaction === 'function') {
    conn.transaction(run)();
  } else if (typeof conn.exec === 'function') {
    conn.exec('BEGIN');
    try { run(); conn.exec('COMMIT'); }
    catch (e) { try { conn.exec('ROLLBACK'); } catch (_) {} throw e; }
  } else {
    run();
  }
  return true;
}

module.exports = { backup, restore, TABLES, exportState, importState };

// Keep backup/restore as no-ops for API compat.
function backup() { return { ok: true }; }
function restore() { return { ok: true }; }