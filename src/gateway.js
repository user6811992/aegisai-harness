// src/gateway.js
// Credentialless agent gateway: agents request access; gateway injects secrets, never exposes them.
const db = require('./storage/db');

function allow(agent, resource, action) {
  try { db.get().prepare('INSERT OR REPLACE INTO gateway_rules (agent, resource, action, created) VALUES (?,?,?,?)').run(agent, resource, action, new Date().toISOString()); } catch (e) {}
  return { agent, resource, action };
}
function deny(agent, resource, action) {
  try { db.get().prepare('DELETE FROM gateway_rules WHERE agent = ? AND resource = ? AND action = ?').run(agent, resource, action); } catch (e) {}
  return { ok: true };
}
function rules() {
  try { return db.get().prepare('SELECT * FROM gateway_rules ORDER BY created DESC').all(); } catch (e) { return []; }
}
function authorize(agent, resource, action) {
  const ok = rules().some((r) => r.agent === agent && (r.resource === '*' || r.resource === resource) && (r.action === '*' || r.action === action));
  return { allowed: ok, reason: ok ? 'gateway rule matched' : 'no matching gateway rule' };
}
function injectSecret(agent, resource, secretName) {
  const auth = authorize(agent, resource, 'read');
  if (!auth.allowed) return { ok: false, error: 'not authorized' };
  // never return the secret; return a reference the tool runtime resolves internally
  return { ok: true, reference: 'vault://' + resource + '/' + secretName, note: 'secret injected at execution time, not exposed to agent' };
}

module.exports = { allow, deny, rules, authorize, injectSecret };
