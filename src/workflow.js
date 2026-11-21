// src/workflow.js
// Declarative workflow state machine: keep the agent inside a business process.
function create(def) {
  return { def, states: def.states || {}, current: def.initial || 'start', history: [] };
}
function allowed(wf) {
  const s = wf.states[wf.current] || {};
  return s.next || [];
}
function transition(wf, event) {
  const next = allowed(wf).find((n) => n.event === event || n === event);
  if (!next) return { ok: false, error: 'invalid transition from ' + wf.current };
  const to = typeof next === 'string' ? next : next.to;
  wf.history.push({ from: wf.current, event, to, at: new Date().toISOString() });
  wf.current = to;
  return { ok: true, state: wf.current };
}
function state(wf) { return { current: wf.current, allowed: allowed(wf), history: wf.history }; }

module.exports = { create, allowed, transition, state };
