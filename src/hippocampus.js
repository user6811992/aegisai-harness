// src/hippocampus.js
// Hippocampus memory: spreading activation, Hebbian writeback, post-turn consolidation (constellation-engine pattern).
const db = require('./storage/db');
const graphMemory = require('./graph_memory');

function consolidate(turnText, concepts) {
  const r = graphMemory.observe(turnText || '', concepts || []);
  const ids = r.ids || [];
  return { nodes: ids.length, edges: Math.max(0, ids.length - 1) };
}
function spreadingActivation(seed, depth) {
  depth = depth || 2;
  return graphMemory.recall(seed || '', depth);
}
function writeback(conceptA, conceptB, delta) {
  graphMemory.add_edge ? null : null;
  try { graphMemory.addEdge(conceptA, conceptB, 'hebbian'); } catch (e) {}
  return { a: conceptA, b: conceptB, delta: delta || 1 };
}
function recall(seed, depth) { return spreadingActivation(seed, depth); }

module.exports = { consolidate, spreadingActivation, writeback, recall };
