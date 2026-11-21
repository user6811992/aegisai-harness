// src/contest_memory.js
// Dual-graph memory: semantic + episodic, weighted edges, habit formation.
const db = require('./storage/db');

function node(id, kind) {
  try { db.get().prepare('INSERT OR IGNORE INTO contest_nodes (id, kind, created) VALUES (?,?,?)').run(id, kind || 'concept', new Date().toISOString()); } catch (e) {}
  return id;
}
function link(a, b, graph, weight) {
  try { db.get().prepare('INSERT OR REPLACE INTO contest_edges (a, b, graph, weight) VALUES (?,?,?,?)').run(a, b, graph || 'semantic', weight || 1); } catch (e) {}
}
function reinforce(a, b, graph, delta) {
  const row = (() => { try { return db.get().prepare('SELECT weight FROM contest_edges WHERE a=? AND b=? AND graph=?').get(a, b, graph || 'semantic'); } catch (e) { return null; } })();
  link(a, b, graph, (row ? row.weight : 0) + (delta || 1));
}
function habits(threshold) {
  threshold = threshold || 4;
  try { return db.get().prepare('SELECT a, b, graph, weight FROM contest_edges WHERE weight >= ? ORDER BY weight DESC').all(threshold); } catch (e) { return []; }
}
function observe(event, concepts) {
  node('ev_' + Buffer.from(event).toString('base64url').slice(0, 20), 'episode');
  for (const c of concepts || []) {
    node('c_' + c.toLowerCase().replace(/\W+/g, '_'));
    reinforce('ev_' + Buffer.from(event).toString('base64url').slice(0, 20), 'c_' + c.toLowerCase().replace(/\W+/g, '_'), 'episodic', 1);
  }
  return concepts || [];
}

module.exports = { node, link, reinforce, habits, observe };
