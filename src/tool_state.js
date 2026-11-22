// src/tool_state.js
// Explicit tool state management: key/value state per tool, persistent shell cwd/env.
const state = new Map();
const shells = new Map();

function get(tool, id) { return state.get(tool + ':' + id) || {}; }
function set(tool, id, patch) {
  const k = tool + ':' + id;
  state.set(k, Object.assign(get(tool, id), patch || {}));
  return state.get(k);
}
function clear(tool, id) { state.delete(tool + ':' + id); }
function shell(id, cwd, env) {
  const k = id || 'default';
  shells.set(k, Object.assign(shells.get(k) || {}, { cwd: cwd || shells.get(k)?.cwd || process.cwd(), env: Object.assign({}, shells.get(k)?.env || {}, env || {}) }));
  return shells.get(k);
}
function shellState(id) { return shells.get(id || 'default') || { cwd: process.cwd(), env: {} }; }

module.exports = { get, set, clear, shell, shellState };
