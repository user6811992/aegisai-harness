// src/critic.js
// Multi-critic evaluation pipeline: N critics score a result against criteria.
const backends = require('./backends');
const db = require('./storage/db');

const DEFAULT_CRITERIA = ['correctness', 'completeness', 'clarity'];

async function critique(target, result, opts) {
  opts = opts || {};
  const model = opts.model || process.env.AEGISAI_MODEL || 'llama3.2:3b';
  const criteria = opts.criteria || DEFAULT_CRITERIA;
  const critics = opts.critics || ['general'];
  const out = [];
  for (const c of critics) {
    const prompt = 'You are a critic focused on ' + c + '. Score the following result 0-10 on: ' + criteria.join(', ') + '. Return JSON with "score" and "notes".\n\nTarget: ' + target + '\n\nResult:\n' + String(result).slice(0, 4000);
    let score = 0, notes = '';
    try {
      const r = await backends.backendChat({ model, messages: [{ role: 'user', content: prompt }], tools: [], stream: false, maxTokens: 256 }, () => {});
      const d = r && r.data ? r.data : r;
      const text = (d && d.message && d.message.content) || '';
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { const j = JSON.parse(m[0]); score = Number(j.score) || 0; notes = j.notes || ''; }
      else { const sm = text.match(/(\d+)\s*\/\s*10|score\s*:\s*(\d+)/i); score = sm ? Number(sm[1] || sm[2]) : 0; notes = text.slice(0, 300); }
    } catch (e) { notes = String(e.message || e); }
    out.push({ critic: c, score, notes });
  }
  const avg = out.length ? out.reduce((a, c) => a + c.score, 0) / out.length : 0;
  const verdict = out.length && out.every((c) => c.score >= (opts.threshold || 6));
  const id = 'cr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  try { db.get().prepare('INSERT INTO critic_results (id, target, created, data) VALUES (?,?,?,?)').run(id, target, new Date().toISOString(), JSON.stringify({ out, avg, verdict })); } catch (e) {}
  return { id, target, critics: out, avg: +avg.toFixed(2), verdict };
}

module.exports = { critique, DEFAULT_CRITERIA };
