// src/code_intelligence.js
// Token-lean code intelligence — clean-room morluto/leantoken (MIT/Apache-2.0)
// idea. Select the smallest set of files/symbols relevant to a task so agent
// context stays lean; measured 20–37% fewer input tokens upstream.
const fs = require('fs');
const path = require('path');

function relevance(text, query) {
  const terms = String(query || '').toLowerCase().match(/[a-z0-9_]+/g) || [];
  const hay = String(text || '').toLowerCase();
  let hits = 0;
  for (const t of terms) if (new RegExp('\\b' + t + '\\b').test(hay)) hits += 1;
  return terms.length ? hits / terms.length : 0;
}

function select(files, query, opts) {
  opts = opts || {};
  const maxTokens = opts.maxTokens || 8000;
  const scored = (files || []).map((f) => {
    let text = '';
    try { text = fs.readFileSync(f, 'utf8'); } catch (e) { return null; }
    return { file: f, score: relevance(text, query), tokens: Math.ceil(text.length / 4), text };
  }).filter(Boolean).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  const chosen = [];
  let used = 0;
  for (const s of scored) {
    if (used + s.tokens > maxTokens) continue;
    chosen.push({ file: s.file, score: +s.score.toFixed(3), tokens: s.tokens, preview: s.text.slice(0, 200) });
    used += s.tokens;
  }
  return { ok: true, query, files: chosen, tokensUsed: used, budget: maxTokens, savedVsAll: scored.reduce((a,s)=>a+s.tokens,0) - used };
}

function tools() {
  return [{ name: 'code_select', description: 'Select a token-lean set of files relevant to a task.', inputSchema: { type: 'object', properties: { files: { type: 'array' }, query: { type: 'string' }, maxTokens: { type: 'number' } }, required: ['files','query'] } }];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'code_select') return select(args.files, args.query, args);
  throw new Error('unknown code_intelligence tool: ' + name);
}
module.exports = { relevance, select, tools, dispatch };
