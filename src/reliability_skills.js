// src/reliability_skills.js
// Reliability skills — clean-room aicodeking/deepseek-stack idea. Short-loop
// skills that close cheap-model failure modes: plan, verify, unstick,
// context-reset, ledger, review, jury, best-of-n, swarm. Bundled as SKILL.md
// content; purely procedural, no new tools.
const SKILLS = {
  'ds-plan-loop': { name: 'ds-plan-loop', body: 'Plan with a check per step. Critique once in a fresh pass. Build one step at a time, verifying each before proceeding.' },
  'ds-verify-loop': { name: 'ds-verify-loop', body: 'Edit → run the real check → read the real error → fix the root cause. Max 5 rounds; stop and report if still failing.' },
  'ds-unstick': { name: 'ds-unstick', body: 'Same failure twice: name the shared assumption, test it directly, then pick a genuinely different approach.' },
  'ds-context-reset': { name: 'ds-context-reset', body: 'Keep a PROGRESS.md and continue in a fresh context when the run gets long. Summary must include errors, decisions, and next step.' },
  'ds-ledger': { name: 'ds-ledger', body: 'One row per decision for long or unattended runs; re-read before each step.' },
  'ds-review-loop': { name: 'ds-review-loop', body: 'Author plus fresh-context reviewer until both agree. Max 4 rounds, then escalate with unresolved points.' },
  'ds-jury': { name: 'ds-jury', body: 'Reviews from two or three different models until they agree; preserve dissent when they do not.' },
  'ds-best-of-n': { name: 'ds-best-of-n', body: 'N parallel attempts, pick the best, graft in the strong parts of the rest. Record why the winner won.' },
  'ds-swarm': { name: 'ds-swarm', body: 'Fan out parallel workers and merge their results into one report with evidence and conflicts noted.' },
};

function list() { return Object.values(SKILLS).map((s) => ({ name: s.name })); }
function get(name) { return SKILLS[name] || null; }
function install() {
  const fs = require('fs');
  const path = require('path');
  const { DATA_DIR } = require('./core/config');
  const dir = path.join(DATA_DIR, 'skills', 'reliability-skills');
  fs.mkdirSync(dir, { recursive: true });
  for (const s of Object.values(SKILLS)) fs.writeFileSync(path.join(dir, s.name + '.md'), `---\nname: ${s.name}\ndescription: ${s.name.replace(/^ds-/, '')} reliability loop\n---\n\n${s.body}\n`);
  return { ok: true, dir, count: Object.keys(SKILLS).length };
}
function tools() { return [{ name: 'reliability_skills_list', description: 'List bundled cheap-model reliability skills.', inputSchema: { type: 'object' } }]; }
function dispatch(name) {
  if (name === 'reliability_skills_list' || name === 'reliability_skills_install') return name.endsWith('install') ? install() : { ok: true, skills: list() };
  throw new Error('unknown reliability_skills tool: ' + name);
}
module.exports = { SKILLS, list, get, install, tools, dispatch };
