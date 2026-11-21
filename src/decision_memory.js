// src/decision_memory.js
// Persistent decision memory: remember / recall / reflect over JSONL.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const backends = require('./backends');

function file() { return path.join(DATA_DIR, 'decisions.jsonl'); }
function all() {
  const p = file();
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
}
function remember(text, tags) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const rec = { id: 'd_' + Date.now(), timestamp: new Date().toISOString(), text, tags: tags || [] };
  fs.appendFileSync(file(), JSON.stringify(rec) + '\n');
  return rec;
}
async function recall(query, model) {
  const rows = all();
  if (rows.length === 0) return '(no decisions)';
  const text = rows.map((r) => r.timestamp + ' ' + r.text).join('\n');
  try {
    const r = await backends.backendChat({ model: model || 'llama3.2:3b', messages: [{ role: 'system', content: 'Return only the decisions relevant to the query.' }, { role: 'user', content: 'Query: ' + query + '\n\nDecisions:\n' + text }], tools: [], stream: false, maxTokens: 512 }, () => {});
    const d = r && r.data ? r.data : r;
    return (d && d.message && d.message.content) || '';
  } catch (e) { return rows.filter((r) => r.text.toLowerCase().includes((query || '').toLowerCase())).map((r) => r.text).join('\n') || '(no matches)'; }
}
async function reflect(model) {
  const rows = all();
  if (rows.length === 0) return '(no decisions)';
  const text = rows.map((r) => r.text).join('\n');
  try {
    const r = await backends.backendChat({ model: model || 'llama3.2:3b', messages: [{ role: 'system', content: 'Find patterns, contradictions, and gaps across these decisions.' }, { role: 'user', content: text }], tools: [], stream: false, maxTokens: 1024 }, () => {});
    const d = r && r.data ? r.data : r;
    const out = (d && d.message && d.message.content) || '';
    const p = path.join(DATA_DIR, 'reflections.md');
    fs.appendFileSync(p, '\n\n## ' + new Date().toISOString() + '\n' + out);
    return out;
  } catch (e) { return String(e.message || e); }
}

module.exports = { all, remember, recall, reflect };
