// src/session_converter.js
// Convert session formats across harnesses (generic/Claude/Codex shapes).
const db = require('./storage/db');

function exportSession(id, format) {
  const s = db.getSession(id);
  if (!s) return null;
  const msgs = s.messages || [];
  if (format === 'claude') {
    return { sessionId: id, messages: msgs.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: [{ type: 'text', text: String(m.content || '') }] })) };
  }
  if (format === 'codex') {
    return { id, turns: msgs.map((m) => ({ role: m.role, text: String(m.content || '') })) };
  }
  return { id, messages: msgs, title: s.title, created: s.created };
}
function importSession(obj, format) {
  let msgs = [];
  if (format === 'claude') msgs = (obj.messages || []).map((m) => ({ role: m.role, content: (m.content || []).map((c) => c.text || '').join('') }));
  else if (format === 'codex') msgs = (obj.turns || []).map((t) => ({ role: t.role, content: t.text }));
  else msgs = obj.messages || [];
  const id = obj.id || obj.sessionId || ('imp_' + Date.now());
  db.saveSession({ id, title: obj.title || 'imported', messages: msgs, created: obj.created || new Date().toISOString(), updated: new Date().toISOString() });
  return { id, messages: msgs.length };
}

module.exports = { exportSession, importSession };
