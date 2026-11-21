// src/peer_review.js
// Cross-LLM peer review before completion: independent models judge the same output.
const backends = require('./backends');

async function review(output, models, criteria) {
  models = models && models.length ? models : [process.env.AEGISAI_MODEL || 'llama3.2:3b'];
  criteria = criteria || 'correctness, completeness, no hallucinated claims';
  const reviews = [];
  for (const model of models) {
    let verdict = 'unknown', notes = '';
    try {
      const prompt = 'Review this agent output. Return JSON {"verdict":"approve|reject","notes":"..."} based on: ' + criteria + '\n\n' + String(output).slice(0, 4000);
      const r = await backends.backendChat({ model, messages: [{ role: 'user', content: prompt }], tools: [], stream: false, maxTokens: 256 }, () => {});
      const d = r && r.data ? r.data : r;
      const text = (d && d.message && d.message.content) || '';
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { const j = JSON.parse(m[0]); verdict = j.verdict || 'unknown'; notes = j.notes || ''; }
    } catch (e) { notes = String(e.message || e); }
    reviews.push({ model, verdict, notes });
  }
  const approved = reviews.filter((r) => r.verdict === 'approve').length;
  return { approved: approved >= Math.ceil(reviews.length / 2), reviews };
}

module.exports = { review };
