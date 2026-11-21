// src/admission.js
// Admission gate: every consequential action needs an explicit admission token.
const CONSEQUENTIAL = new Set(['write_file', 'delete_file', 'run_command', 'run_python', 'send_message', 'http_request']);
const pending = new Map();

function isConsequential(name) { return CONSEQUENTIAL.has(name); }
function request(name, args) {
  if (!isConsequential(name)) return { required: false };
  const token = 'adm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  pending.set(token, { name, args, at: Date.now() });
  return { required: true, token, name, args };
}
function admit(token) {
  const p = pending.get(token);
  if (!p) return { ok: false, error: 'invalid or expired token' };
  pending.delete(token);
  return { ok: true, action: p.name };
}
function pendingCount() { return pending.size; }

module.exports = { CONSEQUENTIAL, isConsequential, request, admit, pendingCount };
