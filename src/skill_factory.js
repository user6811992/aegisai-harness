// src/skill_factory.js
// Skill factory: autoresearch loop + multi-agent consensus verification (agent-skills-harness).
const { runAgent } = require('./agent/run');
const skills = require('./default_skills');

async function proposeSkill(topic, opts) {
  opts = opts || {};
  const prompt = 'Propose a reusable skill (name, description, instructions) for: ' + topic + '. Return JSON {"name","description","body"}.';
  let parsed = null;
  try {
    const r = await runAgent({ model: opts.model || process.env.AEGISAI_MODEL || 'llama3.2:3b', messages: [{ role: 'user', content: prompt }], projectRoot: process.cwd(), autoApprove: true, planMode: true, onEvent: () => {} });
    const text = (r.final && r.final.final) || '';
    const m = text.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch (e) {}
  return parsed;
}
async function consensusVerify(skill, critics) {
  critics = critics || ['general', 'security', 'clarity'];
  const results = [];
  for (const c of critics) {
    try {
      const r = await runAgent({ model: process.env.AEGISAI_MODEL || 'llama3.2:3b', messages: [{ role: 'user', content: 'You are a ' + c + ' critic. Score this skill 0-10 and return JSON {"score","notes"}.\n\n' + JSON.stringify(skill) }], projectRoot: process.cwd(), autoApprove: true, planMode: true, onEvent: () => {} });
      const text = (r.final && r.final.final) || '';
      const m = text.match(/\{[\s\S]*\}/);
      const j = m ? JSON.parse(m[0]) : { score: 5, notes: text.slice(0, 200) };
      results.push({ critic: c, score: Number(j.score) || 0, notes: j.notes || '' });
    } catch (e) { results.push({ critic: c, score: 0, notes: String(e.message || e) }); }
  }
  const avg = results.reduce((a, r) => a + r.score, 0) / (results.length || 1);
  return { skill, critics: results, avg: +avg.toFixed(2), approved: avg >= 6 };
}

module.exports = { proposeSkill, consensusVerify };
