// src/session_search.js
// Search past sessions by keyword, with optional LLM summarization.
const db = require('./storage/db');
const backends = require('./backends');

function searchSessions(query) {
  const q = (query || '').toLowerCase();
  const sessions = db.listSessions();
  const hits = [];
  for (const s of sessions) {
    const text = (s.messages || []).map((m) => (typeof m.content === 'string' ? m.content : '')).join(' ').toLowerCase();
    if (text.includes(q) || (s.title || '').toLowerCase().includes(q)) {
      hits.push(s);
    }
  }
  return hits;
}

async function summarizeHits(hits, model) {
  if (!hits || hits.length === 0) return '';
  const text = hits.slice(0, 5).map((s) => (s.title || 'Untitled') + ': ' + (s.messages || []).slice(-2).map((m) => m.content).join(' | ')).join('\n');
  try {
    const r = await backends.backendChat({ model: model || 'llama3.2:3b', messages: [{ role: 'system', content: 'Summarize these past conversation snippets concisely.' }, { role: 'user', content: text }], tools: [], stream: false, maxTokens: 256 }, () => {});
    const d = r && r.data ? r.data : r;
    return (d && d.message && d.message.content) || '';
  } catch (e) { return ''; }
}

module.exports = { searchSessions, summarizeHits };
