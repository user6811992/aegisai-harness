// src/data_query.js
// Natural-language → SQL on local data — clean-room hardbyte/qabot (244⭐) idea.
// Uses the bundled better-sqlite3 (optional) if available, else returns the
// generated SQL for the caller to run. Never sends data to a cloud LLM.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

function quote(s) { return String(s).replace(/'/g, "''"); }

// Heuristic NL→SQL for common questions; universal, no model needed.
function toSql(question, opts) {
  const q = String(question || '').toLowerCase();
  let table = (opts && opts.table) || 'data';
  const tm = q.match(/\b(?:from|in)\s+([\w_]+)/);
  if (tm) table = tm[1];
  if (/\b(count|how many|number of)\b/.test(q)) {
    const where = q.match(/\bwhere\s+([\w_]+)\s*(?:=|is)\s*([\w\d_'-]+)/);
    return `SELECT COUNT(*) AS count FROM ${quote(table)}${where ? ` WHERE ${where[1]} = '${quote(where[2])}'` : ''};`;
  }
  if (/\b(top|highest|max|largest|best)\b/.test(q)) {
    const col = q.match(/\b(top|highest|max|largest|best)\s+([\w_]+)/);
    return `SELECT * FROM ${quote(table)} ORDER BY ${col ? col[2] : 'value'} DESC LIMIT ${(opts && opts.limit) || 10};`;
  }
  if (/\b(list|show|all)\b/.test(q)) return `SELECT * FROM ${quote(table)} LIMIT ${(opts && opts.limit) || 50};`;
  return `SELECT * FROM ${quote(table)} LIMIT ${(opts && opts.limit) || 50}; -- review: ${String(question||'').slice(0,80)}`;
}

function run(question, opts) {
  opts = opts || {};
  const sql = toSql(question, opts);
  if (opts.dryRun !== false) return { ok: true, sql, dryRun: true };
  let Database;
  try { Database = require('better-sqlite3'); }
  catch (e) { return { ok: false, error: 'better-sqlite3 not installed; use dry-run to get SQL', sql }; }
  const dbPath = opts.db || path.join(DATA_DIR, 'harness.db');
  if (!fs.existsSync(dbPath)) return { ok: false, error: 'database not found', sql };
  try {
    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare(sql).all();
    db.close();
    return { ok: true, sql, rows: rows.slice(0, (opts.maxRows || 100)) };
  } catch (e) { return { ok: false, error: String(e.message || e), sql }; }
}

function tools() {
  return [
    { name: 'data_query_sql', description: 'Generate (or optionally run) local SQL for a natural-language question.', inputSchema: { type: 'object', properties: { question: { type: 'string' }, table: { type: 'string' }, dryRun: { type: 'boolean' } }, required: ['question'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'data_query_sql' || name === 'data_query') return run(args.question, args);
  throw new Error('unknown data_query tool: ' + name);
}
module.exports = { quote, toSql, run, tools, dispatch };
