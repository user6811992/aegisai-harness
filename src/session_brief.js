// src/session_brief.js
// Auto session brief on return: analyze logs → human-readable summary (harness-mem).
const db = require('./storage/db');

function brief(sessionId) {
  const s = db.getSession(sessionId);
  if (!s) return null;
  const msgs = s.messages || [];
  const goals = msgs.filter((m) => m.role === 'user').map((m) => String(m.content || '').slice(0, 120));
  const tools = {};
  for (const m of msgs) if (m.tool_calls) for (const t of m.tool_calls) { const n = (t.function || t).name; tools[n] = (tools[n] || 0) + 1; }
  const last = msgs[msgs.length - 1];
  return {
    sessionId, title: s.title || sessionId,
    turns: msgs.length, userGoals: goals.slice(-5),
    toolsUsed: Object.entries(tools).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    lastMessage: last ? last.role + ': ' + String(last.content || '').slice(0, 200) : '',
    updated: s.updated,
  };
}

module.exports = { brief };
