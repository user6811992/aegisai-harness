// src/metrics.js
// Metrics aggregation (aegisai-next server/core/metrics.js).
const db = require('./storage/db');

function record(name, value, labels) {
  try { db.get().prepare('INSERT INTO metrics (name, value, labels, ts) VALUES (?,?,?,?)').run(name, value, JSON.stringify(labels || {}), Date.now()); } catch (e) {}
}
function summary(name, since) {
  try {
    const rows = db.get().prepare('SELECT value FROM metrics WHERE name = ? AND ts >= ?').all(name, since || 0);
    const vals = rows.map((r) => r.value);
    return { name, count: vals.length, sum: vals.reduce((a, b) => a + b, 0), avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, min: vals.length ? Math.min(...vals) : 0, max: vals.length ? Math.max(...vals) : 0 };
  } catch (e) { return { name, count: 0, sum: 0, avg: 0, min: 0, max: 0 }; }
}
function all() {
  try { return db.get().prepare('SELECT name, COUNT(*) AS n, AVG(value) AS avg, SUM(value) AS sum FROM metrics GROUP BY name').all(); } catch (e) { return []; }
}

module.exports = { record, summary, all };
