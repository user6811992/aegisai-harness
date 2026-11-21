// src/backup.js
// Full-state backup/restore for the harness SQLite database.
const fs = require('fs');
const path = require('path');
const db = require('./storage/db');

const TABLES = ['sessions', 'memories', 'code_symbols', 'traces', 'evals'];

function backup(outPath) {
  const conn = db.get();
  const data = {};
  for (const t of TABLES) {
    try { data[t] = conn.prepare('SELECT * FROM ' + t).all(); }
    catch (e) { data[t] = []; }
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  return outPath;
}

function restore(inPath) {
  const data = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const conn = db.get();
  for (const t of TABLES) {
    const rows = data[t] || [];
    // clear
    try { conn.prepare('DELETE FROM ' + t).run(); } catch (e) {}
    if (rows.length === 0) continue;
    const cols = Object.keys(rows[0]);
    const placeholders = cols.map(() => '?').join(',');
    const sql = `INSERT INTO ${t} (${cols.join(',')}) VALUES (${placeholders})`;
    for (const r of rows) {
      try { conn.prepare(sql).run(...cols.map((c) => r[c])); } catch (e) {}
    }
  }
  return inPath;
}

module.exports = { backup, restore, TABLES };
