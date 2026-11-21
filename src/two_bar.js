// src/two_bar.js
// Two-bar goal system: cheap gate before expensive work + independent verifier blind to reasoning.
const gates = require('./decision_gates');
const separation = require('./separation');

function setGoal(task, cheapBar, qualityBar) {
  return { task, cheapBar: cheapBar || 'input non-empty and not repeated', qualityBar: qualityBar || 'verified by independent reviewer', sessionId: separation.createSession(task, 'worker-' + Date.now()) };
}
function cheapCheck(goal, session) {
  const r = gates.evaluate(session);
  return { pass: r.proceed, bar: goal.cheapBar, failed: r.failed };
}
function verify(goal, verifier, verdict, evidence) {
  return separation.verify(goal.sessionId, verifier, verdict, evidence);
}

module.exports = { setGoal, cheapCheck, verify };
