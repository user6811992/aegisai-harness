// src/simulated_approval.js
// HITL via simulation: continue with simulated tool results while awaiting bulk approval.
const pending = new Map();

function queue(actionId, toolName, args) {
  pending.set(actionId, { actionId, toolName, args, status: 'pending', created: new Date().toISOString() });
  return pending.get(actionId);
}
function simulate(actionId) {
  const a = pending.get(actionId);
  if (!a) return null;
  return { ok: true, simulated: true, output: '[SIMULATED RESULT] ' + a.toolName + ' — awaiting approval for ' + a.actionId };
}
function decide(actionId, approve) {
  const a = pending.get(actionId);
  if (!a) return { ok: false };
  a.status = approve ? 'approved' : 'rejected';
  return { ok: true, status: a.status };
}
function list() { return [...pending.values()]; }

module.exports = { queue, simulate, decide, list };
