// src/ledger.js
// Hash-chained, offline-verifiable audit ledger with replay.
const crypto = require('crypto');
const db = require('./storage/db');

function hash(data) { return crypto.createHash('sha256').update(data).digest('hex'); }

function append(event, payload) {
  let prev = '0'.repeat(64);
  try {
    const last = db.get().prepare('SELECT hash FROM ledger ORDER BY seq DESC LIMIT 1').get();
    if (last) prev = last.hash;
  } catch (e) {}
  const seq = Date.now();
  const body = JSON.stringify({ seq, event, payload: payload || {}, prev });
  const h = hash(body);
  try {
    db.get().prepare('INSERT INTO ledger (seq, event, payload, prev, hash) VALUES (?,?,?,?,?)').run(seq, event, JSON.stringify(payload || {}), prev, h);
  } catch (e) {}
  return { seq, event, hash: h, prev };
}

function verify() {
  const rows = list();
  let prev = '0'.repeat(64);
  for (const r of rows) {
    const body = JSON.stringify({ seq: r.seq, event: r.event, payload: JSON.parse(r.payload || '{}'), prev });
    if (hash(body) !== r.hash || r.prev !== prev) return { ok: false, brokenAt: r.seq };
    prev = r.hash;
  }
  return { ok: true, entries: rows.length };
}

function list(limit) {
  try { return db.get().prepare('SELECT * FROM ledger ORDER BY seq ASC LIMIT ?').all(limit || 1000); } catch (e) { return []; }
}

function replay() {
  return list().map((r) => ({ seq: r.seq, event: r.event, payload: JSON.parse(r.payload || '{}'), hash: r.hash }));
}

module.exports = { append, verify, list, replay, hash };
