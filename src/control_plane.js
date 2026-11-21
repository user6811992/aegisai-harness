// src/control_plane.js
// Governed tool control plane: policy + trace + resumable checkpoints.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const gateway = require('./gateway');
const autoPolicy = require('./auto_policy');

const FILE = () => path.join(DATA_DIR, 'control-plane.json');

function load() { try { return JSON.parse(fs.readFileSync(FILE(), 'utf8')); } catch (e) { return { trace: [], checkpoints: [] }; } }
function save(s) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(s, null, 2)); }
function checkpoint(name, state) {
  const s = load();
  const cp = { name, state: state || {}, at: new Date().toISOString(), id: 'cp_' + Date.now() };
  s.checkpoints.push(cp);
  save(s);
  return cp;
}
function resume(id) {
  const s = load();
  return s.checkpoints.find((c) => c.id === id) || null;
}
function govern(toolName, args, agent) {
  const trace = load();
  const checks = { policy: autoPolicy.check(toolName, args), gateway: agent ? gateway.authorize(agent, toolName, 'execute') : { allowed: true } };
  const allowed = checks.policy.allowed && checks.gateway.allowed;
  trace.trace.push({ at: new Date().toISOString(), tool: toolName, allowed, checks });
  save(trace);
  return { allowed, checks };
}
function trace(limit) { return load().trace.slice(-(limit || 50)); }

module.exports = { checkpoint, resume, govern, trace, load };
