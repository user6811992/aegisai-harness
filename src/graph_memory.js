// src/graph_memory.js
// Graph memory: extraction loop, spreading-activation recall, system-prompt evolution.
const db = require('./storage/db');

function addNode(name, kind) {
  const id = 'gn_' + Buffer.from(name).toString('base64url').slice(0, 24);
  try { db.get().prepare('INSERT OR IGNORE INTO graph_nodes (id, name, kind, created) VALUES (?,?,?,?)').run(id, name, kind || 'entity', new Date().toISOString()); } catch (e) {}
  return id;
}
function addEdge(a, b, relation) {
  try { db.get().prepare('INSERT OR IGNORE INTO graph_edges (a, b, relation, created) VALUES (?,?,?,?)').run(a, b, relation || 'related', new Date().toISOString()); } catch (e) {}
}
function observe(text) {
  const words = String(text || '').match(/\b[A-Z][a-zA-Z0-9]{2,}\b/g) || [];
  const nodes = [...new Set(words)].slice(0, 12);
  const ids = nodes.map((n) => addNode(n, 'entity'));
  for (let i = 0; i < ids.length - 1; i++) addEdge(ids[i], ids[i + 1], 'co-occurs');
  return { nodes, ids, edges: Math.max(0, ids.length - 1) };
}
function graph() {
  let n = [], e = [];
  try { n = db.get().prepare('SELECT * FROM graph_nodes').all(); e = db.get().prepare('SELECT * FROM graph_edges').all(); } catch (err) {}
  return { nodes: n, edges: e };
}
function recall(query, depth) {
  depth = depth || 2;
  const g = graph();
  const start = new Set(g.nodes.filter((n) => String(query || '').toLowerCase().includes(n.name.toLowerCase())).map((n) => n.id));
  const seen = new Set(start);
  let frontier = [...start];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const e of g.edges) {
      if (frontier.includes(e.a) && !seen.has(e.b)) { seen.add(e.b); next.push(e.b); }
      if (frontier.includes(e.b) && !seen.has(e.a)) { seen.add(e.a); next.push(e.a); }
    }
    frontier = next;
  }
  return g.nodes.filter((n) => seen.has(n.id));
}
function evolvePrompt(currentPrompt, query) {
  const related = recall(query || '', 2).slice(0, 5).map((n) => n.name);
  if (!related.length) return currentPrompt;
  return String(currentPrompt || '') + '\n\nKnown context: ' + related.join(', ') + '.';
}

module.exports = { addNode, addEdge, observe, graph, recall, evolvePrompt };
