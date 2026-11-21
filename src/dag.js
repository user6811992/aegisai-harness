// src/dag.js
// DAG task orchestration: topological waves, parallel execution, state persistence.
const db = require('./storage/db');

function validate(nodes) {
  const ids = new Set(nodes.map((n) => n.id));
  for (const n of nodes) {
    for (const d of (n.deps || [])) {
      if (!ids.has(d)) throw new Error('unknown dependency: ' + d + ' in node ' + n.id);
    }
  }
  return true;
}

function waves(nodes) {
  validate(nodes);
  const remaining = new Map(nodes.map((n) => [n.id, Object.assign({}, n)]));
  const out = [];
  while (remaining.size) {
    const ready = [...remaining.values()].filter((n) => (n.deps || []).every((d) => !remaining.has(d)));
    if (!ready.length) throw new Error('cycle detected in DAG');
    out.push(ready);
    for (const n of ready) remaining.delete(n.id);
  }
  return out;
}

function saveRun(run) {
  const id = 'dag_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  try { db.get().prepare('INSERT INTO dag_runs (id, created, data) VALUES (?,?,?)').run(id, new Date().toISOString(), JSON.stringify(run)); } catch (e) {}
  return id;
}

function listRuns(limit) {
  try { return db.get().prepare('SELECT * FROM dag_runs ORDER BY created DESC LIMIT ?').all(limit || 20); } catch (e) { return []; }
}

module.exports = { validate, waves, saveRun, listRuns };
