// src/spans5.js
// 5-layer span model: entry → agent → step → chat → tool (Tencent agentobs pattern).
const spans = [];

function emit(kind, name, attrs, parent) {
  const s = { id: 'sp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), kind, name, attrs: attrs || {}, parent: parent || null, ts: Date.now() };
  spans.push(s);
  return s;
}
function tree() {
  return spans.slice(-100);
}
function layerOf(kind) { return ['entry', 'agent', 'step', 'chat', 'tool'].indexOf(kind) + 1; }

module.exports = { emit, tree, layerOf };
