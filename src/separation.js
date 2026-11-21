// src/separation.js
// Executor/verifier separation: the agent that does the work never judges it.
const sessions = new Map();

function createSession(task, executor) {
  const id = 'sep_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  sessions.set(id, { id, task, executor, output: null, verifier: null, verdict: null });
  return id;
}
function submitOutput(id, output) {
  const s = sessions.get(id);
  if (!s) return { ok: false, error: 'no session' };
  s.output = output;
  return { ok: true };
}
function verify(id, verifier, verdict, evidence) {
  const s = sessions.get(id);
  if (!s) return { ok: false, error: 'no session' };
  if (verifier === s.executor) return { ok: false, error: 'executor cannot verify its own work' };
  s.verifier = verifier;
  s.verdict = { approved: verdict === 'approve', evidence: evidence || '', at: new Date().toISOString() };
  return { ok: true, verdict: s.verdict };
}
function get(id) { return sessions.get(id) || null; }

module.exports = { createSession, submitOutput, verify, get };
